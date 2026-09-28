// Fab.com asset claimer (replaces legacy Unreal Engine Marketplace)
// Automatically discovers and claims Limited-Time Free assets and 100% discount promotional packs.

import { resolve, jsonDb, datetime, filenamify, notify, html_game_list, handleSIGINT } from './src/util.js';
import { cfg } from './src/config.js';
import { launchContext } from './src/browser.js';

const screenshot = (...a) => resolve(cfg.dir.screenshots, 'fab', ...a);

console.log(datetime(), 'started checking Fab (Unreal Engine assets)');

const db = await jsonDb('unrealengine.json', {});
const dbFab = await jsonDb('fab.json', {});
const dbEpic = await jsonDb('epic-games.json', {});

const user = Object.keys(dbEpic.data)[0] || 'default';
db.data[user] ||= {};
dbFab.data[user] ||= {};

const notify_games = [];

const context = await launchContext(cfg, {
  channel: 'chrome',
  headless: false,
  viewport: null,
  locale: 'en-US',
  recordVideo: cfg.record ? { dir: 'data/record/', size: { width: cfg.width, height: cfg.height } } : undefined,
  recordHar: cfg.record ? { path: `data/record/fab-${filenamify(datetime())}.har` } : undefined,
  handleSIGINT: false,
});

handleSIGINT(context);

if (!cfg.debug) context.setDefaultTimeout(cfg.timeout);

const page = context.pages().length ? context.pages()[0] : await context.newPage();
await page.setViewportSize({ width: cfg.width, height: cfg.height });

try {
  // 1. Check user login session on Fab
  console.log('Navigating to Fab limited-time free page...');
  await page.goto('https://www.fab.com/limited-time-free', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const isLoggedIn = await page.evaluate(async () => {
    try {
      const res = await fetch('https://www.fab.com/i/users/me/wallet');
      return res.status === 200;
    } catch (e) {
      return false;
    }
  });

  if (!isLoggedIn) {
    const errorMsg = 'Not signed in to Fab. Please run with --show to login: ClaimGames.cmd --show --claim fab';
    console.error(errorMsg);
    notify(`Fab: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  console.log(`Signed in to Fab as ${user}`);

  // 2. Discover promotional assets from /limited-time-free and search API
  console.log('Discovering promotional free assets...');
  const assetMap = new Map();

  // A. Extract from limited-time-free page
  const pageListings = await page.$$eval('a[href*="/listings/"]', els => els.map(a => {
    const parts = a.href.split('/listings/')[1]?.split(/[?#/]/)[0];
    return {
      uid: parts,
      title: a.innerText.trim().split('\n')[0] || parts,
      url: `https://www.fab.com/listings/${parts}`,
    };
  }));

  for (const item of pageListings) {
    if (item.uid && !assetMap.has(item.uid)) {
      assetMap.set(item.uid, item);
    }
  }

  // B. Query search API for is_free=1 items
  try {
    const searchData = await page.evaluate(async () => {
      const res = await fetch('https://www.fab.com/i/listings/search?is_free=1&count=50');
      return await res.json();
    });

    for (const r of searchData.results || []) {
      // Pick promotional 100% discount or limited-time assets
      const isPromo = r.priceTier?.isPromotional || r.priceTier?.discountPercentage === 100;
      if (isPromo && !assetMap.has(r.uid)) {
        assetMap.set(r.uid, {
          uid: r.uid,
          title: r.title,
          url: `https://www.fab.com/listings/${r.uid}`,
        });
      }
    }
  } catch (err) {
    console.warn('Failed to fetch search API listings, continuing with page listings:', err.message);
  }

  const assets = Array.from(assetMap.values());
  console.log(`Found ${assets.length} candidate free assets.`);

  if (!assets.length) {
    console.log('No promotional assets available to claim.');
  } else {
    // 3. Check ownership status in batch
    const query = assets.map(a => `listing_ids=${a.uid}`).join('&');
    const states = await page.evaluate(async (q) => {
      try {
        const res = await fetch(`https://www.fab.com/i/users/me/listings-states?${q}`);
        return await res.json();
      } catch (e) {
        return [];
      }
    }, query);

    const stateMap = new Map((states || []).map(s => [s.uid, s.acquired]));

    // 4. Process each asset
    for (const asset of assets) {
      const isAcquired = stateMap.get(asset.uid);
      db.data[user][asset.uid] ||= { title: asset.title, time: datetime(), url: asset.url, status: 'failed' };
      dbFab.data[user][asset.uid] ||= { title: asset.title, time: datetime(), url: asset.url, status: 'failed' };

      const notifyItem = { title: asset.title, url: asset.url, status: 'failed' };
      notify_games.push(notifyItem);

      if (isAcquired) {
        console.log(`  [Owned] "${asset.title}"`);
        db.data[user][asset.uid].status = 'existed';
        dbFab.data[user][asset.uid].status = 'existed';
        notifyItem.status = 'existed';
        continue;
      }

      console.log(`\n  [Claiming] "${asset.title}" (${asset.url}) ...`);

      if (cfg.dryrun) {
        console.log('    DRYRUN=1 -> Skip order');
        continue;
      }

      try {
        await page.goto(asset.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);

        const buyBtn = page.locator('button:has-text("Buy now"), button:has-text("Buy Now")').first();
        if (!(await buyBtn.isVisible())) {
          const ownedBtn = await page.locator('button:has-text("Download"), button:has-text("View in My Library")').count();
          if (ownedBtn > 0) {
            console.log(`    Already owned on page.`);
            db.data[user][asset.uid].status = 'existed';
            dbFab.data[user][asset.uid].status = 'existed';
            notifyItem.status = 'existed';
            continue;
          }
          throw new Error('Buy now button not visible');
        }

        await buyBtn.click();
        await page.waitForTimeout(2000);

        // Frame checkout modal
        const addBtn = page.frameLocator('iframe').locator('button:has-text("Add to library")').first();
        await addBtn.waitFor({ timeout: 15000 });
        await addBtn.click();

        // Verification loop
        let confirmed = false;
        for (let i = 0; i < 15; i++) {
          await page.waitForTimeout(1000);
          const check = await page.evaluate(async (id) => {
            try {
              const res = await fetch(`https://www.fab.com/i/users/me/listings-states/${id}`);
              const data = await res.json();
              return data?.acquired === true;
            } catch (e) {
              return false;
            }
          }, asset.uid);
          if (check) {
            confirmed = true;
            break;
          }
        }

        if (confirmed) {
          console.log(`    >>> Claimed successfully: "${asset.title}"!`);
          db.data[user][asset.uid].status = 'claimed';
          db.data[user][asset.uid].time = datetime();
          dbFab.data[user][asset.uid].status = 'claimed';
          dbFab.data[user][asset.uid].time = datetime();
          notifyItem.status = 'claimed';
          await page.screenshot({ path: screenshot(`${filenamify(asset.title)}_${filenamify(datetime())}.png`) }).catch(() => {});
        } else {
          throw new Error('Acquisition verification timed out');
        }

      } catch (claimErr) {
        console.error(`    [ERROR] Failed to claim "${asset.title}":`, claimErr.message);
        notifyItem.status = 'failed';
        await page.screenshot({ path: screenshot('failed', `${filenamify(asset.title)}_${filenamify(datetime())}.png`) }).catch(() => {});
      }
    }
  }

} catch (error) {
  process.exitCode ||= 1;
  console.error('--- Exception in Fab claimer:', error);
  if (error.message && process.exitCode != 130) {
    notify(`Fab asset claimer failed: ${error.message.split('\n')[0]}`);
  }
} finally {
  await db.write();
  await dbFab.write();
  if (notify_games.filter(g => g.status != 'existed').length) {
    notify(`Fab / Unreal Engine (${user}):<br>${html_game_list(notify_games)}`);
  }
  await context.close();
}

console.log(datetime(), 'finished checking Fab');
