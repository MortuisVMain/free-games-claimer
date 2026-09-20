// Browser automation engines that can be used to run the storefront scripts.
// Each entry maps the value of the AUTOMATION option to the npm package to load
// and the browser type to launch. Adding another Playwright-compatible library
// only requires a new entry here - the storefront scripts stay the same.
const ENGINES = {
  patchright: {
    package: 'patchright',
    browser: 'chromium',
    install: 'npm install && npx patchright install chrome',
  },
  playwright: {
    package: 'playwright',
    browser: 'chromium',
    install: 'npm install playwright && npx playwright install chrome',
  },
};

/**
 * Minimizes the browser window via CDP, best-effort. Some stores cannot run
 * headless without risking captchas and always launch a visible browser; a
 * minimized window keeps working and is as little intrusive as possible.
 * Only Chromium-based engines support `newCDPSession`, so other engines are skipped.
 * @param {object} context the launched browser context
 */
const minimizeWindow = async context => {
  if (typeof context.newCDPSession != 'function') return;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const page = context.pages()[0] || await context.newPage();
      const session = await context.newCDPSession(page);
      const { windowId } = await session.send('Browser.getWindowForTarget');
      await session.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'minimized' } });
      await session.detach(); // don't leave a CDP connection around
      return;
    } catch (error) {
      if (attempt == 5) console.warn(`could not minimize the browser window: ${error.message}`);
      else await new Promise(resolve => setTimeout(resolve, 200)); // window may not be ready yet, retry
    }
  }
};

/**
 * Launches a persistent browser context with the automation engine selected via
 * the AUTOMATION option (default: patchright). Options are passed through as-is,
 * so the storefront scripts don't need to know which library is used.
 * `cfg` is passed in by the caller (instead of importing src/config.js here) to
 * avoid a circular import while config.js and util.js are still initializing.
 * @param {object} cfg the loaded configuration (src/config.js)
 * @param {object} options options for `launchPersistentContext` (without the user data dir)
 * @returns {Promise<object>} the launched browser context
 */
export const launchContext = async (cfg, options) => {
  const engine = ENGINES[cfg.automation];
  if (!engine) {
    throw new Error(`Unknown AUTOMATION "${cfg.automation}". Supported values: ${Object.keys(ENGINES).join(', ')}.`);
  }
  let module;
  try {
    module = await import(engine.package);
  } catch (error) {
    // Give a clear error instead of the obscure "Cannot find package" module error
    if (error?.code == 'ERR_MODULE_NOT_FOUND') {
      throw new Error(`Browser automation "${cfg.automation}" is not installed. Install it with: ${engine.install}`);
    }
    throw error;
  }
  const browser = module[engine.browser];
  if (!browser) {
    throw new Error(`Package "${engine.package}" does not export "${engine.browser}".`);
  }
  // The storefront scripts request a GL backend for rendering; on Windows that
  // EGL backend is unavailable and Chrome silently falls back to software rendering,
  // so drop those flags to let Chrome pick the native (D3D11) backend instead.
  if (process.platform == 'win32') {
    const linuxGlArgs = ['--use-gl', '--use-angle'];
    options.args = (options.args ?? []).filter(a => !linuxGlArgs.some(p => a.startsWith(p)));
  }
  // On Windows, Chrome resolves the system proxy configuration (WinINET, including WPAD
  // auto-detection) on its first request, which can block the first navigation for 30s+
  // before the store is even contacted. The storefront scripts use no proxy, so force
  // direct access. An explicitly configured proxy in `args` is left untouched.
  const proxyArgs = ['--proxy-server', '--proxy-pac-url', '--proxy-auto-detect'];
  const args = options.args ?? [];
  const hasProxyArg = args.some(a => proxyArgs.some(p => a.startsWith(p)));
  if (!hasProxyArg) options.args = [...args, '--no-proxy-server'];
  const context = await browser.launchPersistentContext(cfg.dir.browser, options);
  // minimize only when a store forces a visible browser although headless was requested;
  // ClaimGames.cmd sets FGC_MINIMIZE for that case, so an explicit SHOW=1 stays visible
  if (options.headless === false && process.env.FGC_MINIMIZE == '1') await minimizeWindow(context);
  return context;
};
