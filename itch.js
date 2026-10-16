// Itch.io 100% off game claimer
// Automatically discovers and claims limited-time 100% discount promotional games to user's Itch.io library.

import { resolve, jsonDb, datetime, filenamify, notify, html_game_list, handleSIGINT, recordClaimStat, getStatsSummary } from './src/util.js';
import { cfg } from './src/config.js';
import { launchContext } from './src/browser.js';

const screenshot = (...a) => resolve(cfg.dir.screenshots, 'itch', ...a);

async function main() {
  console.log(datetime(), 'started checking Itch.io');

  const db = await jsonDb('itch.json', {});
  const dbEpic = await jsonDb('epic-games.json', {});
  const user = Object.keys(dbEpic.data)[0] || 'default';
  db.data[user] ||= {};

  const URL_SALE = 'https://itch.io/games/on-sale';

  // Pre-flight HTTP discovery check: check if any 100% off sales exist before starting Chromium
  let candidateGames = [];
  try {
    const saleRes = await fetch(URL_SALE, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (saleRes.ok) {
      const html = await saleRes.text();
      const regex = /<a class="title game_link"[^>]*href="([^"]+)"[^>]*data-label="game:(\d+):title">([^<]+)<\/a>[\s\S]*?<div class="sale_tag">\s*-100%\s*<\/div>/g;
      let match;
      while ((match = regex.exec(html))) {
        const [, href, id, title] = match;
        candidateGames.push({ id, url: href, title: title.trim() });
      }
    }
  } catch {
    // Fall through
  }

  // Check if all candidates are already claimed
  if (!cfg.show && !process.env.FGC_FORCE) {
    if (candidateGames.length === 0) {
      console.log('[Pre-Flight] Currently no active 100% off sales on Itch.io frontpage.');
      console.log('[Pre-Flight] Skipping browser launch (fast exit in <500ms).');
      return;
    }

    const allClaimed = candidateGames.every(g => {
      const record = db.data[user][g.id] || db.data[user][g.url];
      return record && (record.status === 'claimed' || record.status === 'existed');
    });

    if (allClaimed) {
      console.log(`[Pre-Flight] All ${candidateGames.length} active 100% off Itch.io games already in library: ${candidateGames.map(g => `"${g.title}"`).join(', ')}.`);
      console.log('[Pre-Flight] Skipping browser launch (fast exit in <500ms).');
      return;
    }
  }

  const context = await launchContext(cfg, {
    channel: 'chrome',
    headless: false,
    viewport: null,
    locale: 'en-US',
    recordVideo: cfg.record ? { dir: 'data/record/', size: { width: cfg.width, height: cfg.height } } : undefined,
    recordHar: cfg.record ? { path: `data/record/itch-${filenamify(datetime())}.har` } : undefined,
    handleSIGINT: false,
  });

  handleSIGINT(context);

  if (!cfg.debug) context.setDefaultTimeout(cfg.timeout);

  const page = context.pages().length ? context.pages()[0] : await context.newPage();
  await page.setViewportSize({ width: cfg.width, height: cfg.height });

  const notify_games = [];

  try {
    // Check login state
    console.log('Checking Itch.io login status...');
    await page.goto('https://itch.io/my-collections', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(3000);

    const isLoggedOut = page.url().includes('/login') || (await page.locator('a[href*="/login"], button:has-text("Log in")').count()) > 0;

    if (isLoggedOut) {
      const loginPrompt = 'Not signed in to Itch.io. Run with --show to login: ClaimGames.cmd --show --claim itch';
      console.warn(`[WARN] ${loginPrompt}`);
      if (!cfg.show || process.env.FGC_MINIMIZE == '1') {
        console.log('Skipping Itch.io (requires interactive login once via --show).');
        await notify('Itch.io: Not signed in. Run "ClaimGames.cmd --show --claim itch" to log in.');
        await context.close();
        return;
      } else {
        console.log('Waiting for manual login in the browser window (up to 3 minutes)...');
        await page.waitForURL(url => url.href.includes('itch.io') && !url.href.includes('/login'), { timeout: cfg.login_timeout || 180000 });
        console.log('Login detected! Continuing to game discovery...');
      }
    }

    // Claim candidates
    console.log(`Discovered ${candidateGames.length} 100% discount candidate games on Itch.io.`);

    for (const game of candidateGames) {
      const existed = db.data[user][game.id] || db.data[user][game.url];
      if (existed && (existed.status === 'claimed' || existed.status === 'existed')) {
        console.log(`  [Owned] "${game.title}" is already in your library.`);
        continue;
      }

      console.log(`Navigating to game: "${game.title}" (${game.url}) ...`);
      await page.goto(game.url, { waitUntil: 'domcontentloaded', timeout: 35000 });
      await page.waitForTimeout(3000);

      const bodyText = await page.evaluate(() => document.body.innerText);
      const notifyItem = { title: game.title, url: game.url, status: 'failed' };
      notify_games.push(notifyItem);

      if (bodyText.includes('You own this game') || (await page.locator('text=You own this game').count()) > 0) {
        console.log(`  [Owned] "${game.title}" is already owned.`);
        db.data[user][game.id] = { title: game.title, url: game.url, time: datetime(), status: 'existed' };
        notifyItem.status = 'existed';
        continue;
      }

      // Look for claim buttons
      const claimBtn = page.locator('button:has-text("Claim game"), a:has-text("Claim game"), button:has-text("Download or claim"), a:has-text("Download or claim")').first();

      if (await claimBtn.isVisible().catch(() => false)) {
        console.log(`  [Claiming] "${game.title}" ...`);
        await claimBtn.click();
        await page.waitForTimeout(2000);

        // Handle claim modal if prompted: "Claim [Game Title]"
        const confirmModalBtn = page.locator('.lightbox button:has-text("Claim game"), .lightbox a:has-text("Claim game"), button.claim_btn, button:has-text("Claim")').first();
        if (await confirmModalBtn.isVisible().catch(() => false)) {
          await confirmModalBtn.click();
          await page.waitForTimeout(3000);
        }

        // Check confirmation URL or text
        const isConfirmed = page.url().includes('/download/') || (await page.locator('text=You own this game, text=Download').count()) > 0;
        if (isConfirmed) {
          console.log(`    >>> Claimed successfully: "${game.title}"!`);
          db.data[user][game.id] = { title: game.title, url: game.url, time: datetime(), status: 'claimed' };
          notifyItem.status = 'claimed';
          await recordClaimStat('itch', { title: game.title, url: game.url }).catch(() => {});
          const p = screenshot(`${filenamify(game.title)}_${filenamify(datetime())}.png`);
          await page.screenshot({ path: p }).catch(() => {});
        } else {
          console.warn(`    [WARN] Claim confirmation not detected for "${game.title}".`);
          db.data[user][game.id] = { title: game.title, url: game.url, time: datetime(), status: 'failed' };
        }
      } else {
        console.log(`  [Skip] No permanent claim button on "${game.title}" (may be free download only without account binding).`);
        db.data[user][game.id] = { title: game.title, url: game.url, time: datetime(), status: 'skipped' };
        notifyItem.status = 'skipped';
      }
    }

  } catch (error) {
    process.exitCode = 1;
    console.error('--- Exception in Itch claimer:', error);
    if (error.message && process.exitCode != 130) {
      notify(`Itch claimer failed: ${error.message.split('\n')[0]}`);
    }
  } finally {
    await db.write();
    if (notify_games.filter(g => g.status === 'claimed' || g.status === 'failed').length) {
      const statsSummary = await getStatsSummary().catch(() => null);
      notify(`Itch.io (${user}):<br>${html_game_list(notify_games, statsSummary)}`);
    }
    await context.close();
  }

  console.log(datetime(), 'finished checking Itch.io');
}

await main();
