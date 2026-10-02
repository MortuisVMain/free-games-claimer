// Unity Asset Store claimer
// Automatically claims the weekly paid asset featured in "Publisher of the Week / Free Asset of the Week".

import { resolve, jsonDb, datetime, filenamify, notify, html_game_list, handleSIGINT } from './src/util.js';
import { cfg } from './src/config.js';
import { launchContext } from './src/browser.js';

const screenshot = (...a) => resolve(cfg.dir.screenshots, 'unity', ...a);

console.log(datetime(), 'started checking Unity Asset Store');

const db = await jsonDb('unity.json', {});
const dbEpic = await jsonDb('epic-games.json', {});
const user = Object.keys(dbEpic.data)[0] || 'default';
db.data[user] ||= {};

const notify_games = [];

const context = await launchContext(cfg, {
  channel: 'chrome',
  headless: false,
  viewport: null,
  locale: 'en-US',
  recordVideo: cfg.record ? { dir: 'data/record/', size: { width: cfg.width, height: cfg.height } } : undefined,
  recordHar: cfg.record ? { path: `data/record/unity-${filenamify(datetime())}.har` } : undefined,
  handleSIGINT: false,
});

handleSIGINT(context);

if (!cfg.debug) context.setDefaultTimeout(cfg.timeout);

const page = context.pages().length ? context.pages()[0] : await context.newPage();
await page.setViewportSize({ width: cfg.width, height: cfg.height });

try {
  // 1. Check login state by testing cart access
  console.log('Checking Unity ID login status...');
  await page.goto('https://assetstore.unity.com/account/cart', { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(4000);

  // Clear cookie banner if present
  page.locator('button:has-text("Accept All Cookies"), button:has-text("Одобрить все")').first().click().catch(() => {});

  const isLoggedOut = page.url().includes('id.unity.com') || (await page.locator('input#email, input[name="email"]').count()) > 0;

  if (isLoggedOut) {
    const loginPrompt = 'Not signed in to Unity ID. Run with --show to login: ClaimGames.cmd --show --claim unity';
    console.warn(`[WARN] ${loginPrompt}`);
    if (cfg.headless) {
      console.log('Skipping Unity Asset Store (requires interactive login once via --show).');
      // Do not crash the entire scheduled run; exit gracefully
      await context.close();
      process.exit(0);
    } else {
      console.log('Waiting for manual login in the browser window (up to 3 minutes)...');
      await page.waitForURL('**/assetstore.unity.com/**', { timeout: cfg.login_timeout || 180000 });
      console.log('Login detected! Continuing to asset discovery...');
    }
  }

  // 2. Discover Publisher of the Week free asset and weekly coupon code
  console.log('Navigating to Publisher Sale page: https://assetstore.unity.com/publisher-sale ...');
  await page.goto('https://assetstore.unity.com/publisher-sale', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(4000);

  // Find giveaway container
  const banner = page.locator('text=PUBLISHER ASSET GIVEAWAY').first();
  const hasGiveaway = await banner.isVisible().catch(() => false);

  if (!hasGiveaway) {
    console.log('No active "PUBLISHER ASSET GIVEAWAY" banner found on publisher-sale page.');
  } else {
    // Extract coupon code and asset link
    const bannerContainer = banner.locator('xpath=./ancestor::div[contains(@class, "rounded") or contains(@class, "flex") or contains(@class, "relative")][2]');
    const bannerText = (await bannerContainer.innerText().catch(() => '')) || (await page.evaluate(() => document.body.innerText));

    // Regex: "enter the coupon code CODE at checkout"
    const match = bannerText.match(/coupon code\s+([A-Z0-9_-]+)/i);
    const couponCode = match ? match[1].trim() : null;

    // Asset link button
    const giftBtn = page.locator('a:has-text("GET YOUR FREE GIFT")').first();
    const assetHref = (await giftBtn.getAttribute('href').catch(() => null)) || '';

    if (!couponCode || !assetHref) {
      console.warn(`[WARN] Could not parse giveaway details: coupon=${couponCode}, href=${assetHref}`);
    } else {
      const assetUrl = assetHref.startsWith('http') ? assetHref : `https://assetstore.unity.com${assetHref}`;
      const assetId = assetHref.split('-').pop() || assetHref;
      console.log(`Found weekly giveaway: Coupon=[${couponCode}], URL=[${assetUrl}]`);

      // 3. Inspect asset page
      console.log(`Navigating to asset: ${assetUrl} ...`);
      await page.goto(assetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3000);

      const title = (await page.locator('h1').innerText().catch(() => 'Unity Free Asset')).trim();
      console.log(`Asset Title: "${title}"`);

      db.data[user][assetId] ||= { title, time: datetime(), url: assetUrl, status: 'failed' };
      const notifyItem = { title, url: assetUrl, status: 'failed' };
      notify_games.push(notifyItem);

      // Check if already owned
      const isOwned = await page.locator('button:has-text("Open in Unity"), button:has-text("In Library")').count();
      if (isOwned > 0) {
        console.log(`  [Owned] "${title}" is already in your Unity library.`);
        db.data[user][assetId].status = 'existed';
        notifyItem.status = 'existed';
      } else {
        console.log(`  [Claiming] "${title}" with coupon [${couponCode}] ...`);

        if (cfg.dryrun) {
          console.log('    DRYRUN=1 -> Skip order');
        } else {
          // Clear cart first to prevent leftover paid items from blocking free checkout
          console.log('    Checking and clearing cart...');
          await page.goto('https://assetstore.unity.com/account/cart', { waitUntil: 'domcontentloaded', timeout: 35000 });
          await page.waitForTimeout(3000);

          const clearCartBtn = page.locator('button:has-text("Clear Cart")').first();
          if (await clearCartBtn.isVisible().catch(() => false)) {
            console.log('    Clearing existing cart items...');
            await clearCartBtn.click();
            await page.waitForTimeout(1000);
            const confirmClearBtn = page.locator('button:has-text("Confirm")').first();
            if (await confirmClearBtn.isVisible().catch(() => false)) {
              await confirmClearBtn.click();
              await page.waitForTimeout(2000);
            }
          }

          // Return to giveaway asset page and Add to Cart
          console.log(`    Adding "${title}" to cart...`);
          await page.goto(assetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
          await page.waitForTimeout(3000);

          const addToCartBtn = page.locator('button[aria-label="Add to Cart"], button:has-text("Add to Cart")').first();
          if (await addToCartBtn.isVisible()) {
            await addToCartBtn.click();
            await page.waitForTimeout(3000);
          }

          // Navigate to cart
          console.log('    Navigating to cart...');
          await page.goto('https://assetstore.unity.com/account/cart', { waitUntil: 'domcontentloaded', timeout: 35000 });
          await page.waitForTimeout(3000);

          // Proceed to Checkout
          const proceedBtn = page.locator('button:has-text("Proceed to Checkout")').first();
          if (!(await proceedBtn.isVisible())) {
            throw new Error('Proceed to Checkout button not found in cart');
          }
          await proceedBtn.click();
          await page.waitForTimeout(2000);

          // Handle Terms of Service modal if prompted
          const acceptBtn = page.locator('button:has-text("Accept")').filter({ hasText: 'Accept' }).last();
          if (await acceptBtn.isVisible().catch(() => false)) {
            console.log('    Accepting Terms of Service modal...');
            await acceptBtn.click();
          }

          // Wait for transition to checkout (pay.unity.com)
          for (let i = 0; i < 20; i++) {
            await page.waitForTimeout(1000);
            if (page.url().includes('pay.unity.com') || page.url().includes('checkout')) break;
          }
          await page.waitForTimeout(3000);

          // Fill address fields defensively if required by Unity for new accounts
          const addressForm = page.locator('#org_address_form');
          if (await addressForm.isVisible().catch(() => false)) {
            console.log('    Completing required billing address fields...');
            const regionSelect = page.locator('select[name="sta[region]"]');
            if (await regionSelect.count() > 0) {
              await regionSelect.selectOption({ index: 1 }).catch(() => {});
            }
            const setField = async (selector, val) => {
              const el = page.locator(selector);
              if (await el.count() > 0 && !(await el.inputValue().catch(() => ''))) {
                await el.fill(val).catch(() => {});
              }
            };
            const defaultName = (typeof user === 'string' && user.split('@')[0]) || 'User';
            await setField('input[name="sta[firstName]"]', defaultName);
            await setField('input[name="sta[lastName]"]', 'Claimer');
            await setField('input[name="sta[email]"]', (typeof user === 'string' && user.includes('@')) ? user : `${defaultName}@example.com`);
            await setField('input[name="sta[companyName]"]', 'Studio');
            await setField('input[name="sta[phoneNumber]"]', '1234567890');
            await setField('input[name="sta[streetAddress]"]', 'Main Street 1');
            await setField('input[name="sta[postalCode]"]', '10001');
            await setField('input[name="sta[locality]"]', 'City');

            const vatNoLabel = page.locator('label[for="vatRegisteredNo"]');
            if (await vatNoLabel.isVisible().catch(() => false)) {
              await vatNoLabel.click().catch(() => {});
              await page.waitForTimeout(1000);
            }
          }

          // Apply coupon code if not already applied
          const couponActive = (await page.locator(`text=${couponCode}`).count()) > 0;
          if (!couponActive) {
            console.log(`    Applying coupon: ${couponCode}...`);
            const couponInput = page.locator('dd.input input[type="text"]:visible, input[placeholder*="Coupon" i], input[placeholder*="Promo" i]').first();
            const applyBtn = page.locator('dd.input button.btn:visible, button:has-text("Apply"), button:has-text("Применить")').first();
            if (await couponInput.isVisible()) {
              await couponInput.fill(couponCode);
              await page.waitForTimeout(1000);
              await applyBtn.click();
              await page.waitForTimeout(4000);
            }
          }

          // Accept agreement checkbox on order
          console.log('    Accepting purchase terms...');
          await page.evaluate(() => {
            const terms = document.querySelectorAll('#order_terms, input[name="term"]');
            terms.forEach(cb => {
              cb.checked = true;
              cb.dispatchEvent(new Event('change', { bubbles: true }));
            });
          });
          await page.waitForTimeout(1000);

          // Submit final checkout
          const payBtn = page.locator('button.btn:visible').filter({ hasText: /Заплатить немедленно|Pay now|Complete|Place order|Оплатить/i }).first();
          if (!(await payBtn.isVisible())) {
            throw new Error('Checkout confirmation button not visible');
          }

          console.log('    Submitting final order...');
          await payBtn.click();

          // Wait for order confirmation
          let orderConfirmed = false;
          for (let i = 0; i < 25; i++) {
            await page.waitForTimeout(1000);
            const url = page.url();
            if (url.includes('/confirm') || url.includes('/thank-you') || url.includes('/success') || (url.includes('/orders/') && !url.includes('checkout'))) {
              orderConfirmed = true;
              break;
            }
          }

          if (orderConfirmed || (await page.locator('text=Thanks for your order, text=Thank you').count()) > 0) {
            console.log(`    >>> Successfully claimed: "${title}"!`);
            db.data[user][assetId].status = 'claimed';
            db.data[user][assetId].time = datetime();
            notifyItem.status = 'claimed';
            await page.screenshot({ path: screenshot(`${filenamify(title)}_${filenamify(datetime())}.png`) }).catch(() => {});
          } else {
            throw new Error(`Order checkout did not reach confirmation page (current URL: ${page.url()})`);
          }
        }
      }
    }
  }

} catch (error) {
  process.exitCode ||= 1;
  console.error('--- Exception in Unity claimer:', error);
  if (error.message && process.exitCode != 130) {
    notify(`Unity claimer failed: ${error.message.split('\n')[0]}`);
  }
} finally {
  await db.write();
  if (notify_games.filter(g => g.status != 'existed').length) {
    notify(`Unity Asset Store (${user}):<br>${html_game_list(notify_games)}`);
  }
  await context.close();
}

console.log(datetime(), 'finished checking Unity Asset Store');
