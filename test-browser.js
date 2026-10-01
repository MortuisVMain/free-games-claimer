import { launchContext } from './src/browser.js';

console.log('Testing browser initialization...');

const cfg = {
  automation: 'patchright',
  dir: { browser: 'data/browser' },
  width: 900,
  height: 600,
  headless: false,
};

try {
  const context = await launchContext(cfg, {
    channel: 'chrome',
    headless: false,
  });

  const page = context.pages().length ? context.pages()[0] : await context.newPage();
  await page.goto('https://store.epicgames.com', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});

  console.log('\n[SUCCESS] Browser engine initialized and opened successfully!');
  console.log('Window will close automatically in 4 seconds...');
  await new Promise(r => setTimeout(r, 4000));
  await context.close();
  process.exit(0);
} catch (error) {
  console.error('\n[ERROR] Failed to launch browser:');
  console.error(error.message);
  process.exit(1);
}
