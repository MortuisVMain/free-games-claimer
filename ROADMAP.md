# 🗺️ Roadmap: Free Games Claimer (Studio Edition)

Future enhancements and platform expansions for the studio freebie automation engine.

---

## ✅ Phase 1: Core Modernization & Windows Native (Completed)
- [x] **Fab.com Engine (`fab.js`):** Reverse-engineered Fab.com limited-time free rotation and promotional search API, replacing the discontinued Unreal Engine Marketplace GraphQL endpoint.
- [x] **Stealth Browser Automation:** Automated minimization of forced-visible Chromium windows via Chrome DevTools Protocol (`Browser.setWindowBounds: minimized`), eliminating desktop focus disruption on Windows.
- [x] **Windows Native Launchers:**
  - `ClaimGames.cmd`: CLI with platform flags (`--claim epic fab gog steam`), `--headless`, `--show`, and `--log`.
  - `StudioClaimLauncher.bat`: Silent launcher for Windows Task Scheduler.
  - `FirstTimeLogin.bat`: Interactive setup helper for first-time account logins.
- [x] **Custom Cyberpunk Brand Icon:** Multi-resolution `.ico` (16x16 to 256x256) and desktop shortcut integration.
- [x] **Configurable Platform Set:** Excluded Amazon Prime Gaming (subscription-dependent) and defaulted active platforms to `epic gog steam fab`.

---

## 🚀 Phase 2: Unity Asset Store & Expansion (Active Development)

### 1. Unity Asset Store Claimer (`unity.js`) - ✅ Completed
* **Status:** Implemented in `unity.js`. Automatically scrapes "Publisher of the Week" banner, extracts asset URL and weekly coupon code (e.g. `MAGICPIGGAMES`), checks library ownership, applies coupon in cart to $0.00, and claims to Unity ID.
* **Architecture:**
  1. **Discovery:** Scrape `https://assetstore.unity.com/` hero banner and active campaign cards to dynamically extract:
     - Target Asset PDP URL.
     - Weekly promotional voucher/coupon code (e.g. `ASSETSTORE` or campaign keyword).
  2. **Cart & Voucher Flow:**
     - Navigate to asset page and click "Add to Cart".
     - Open checkout drawer, enter voucher code, and trigger price update to $0.00.
     - Complete order without payment method requirements.
  3. **Session:** Store persistent Unity ID cookies in `data/browser`.
  4. **CLI Integration:** Add `unity` flag to `ClaimGames.cmd --claim ... unity`.

### 2. Rich Discord / Telegram Webhook Notifications
* Rich embed cards with game banners, original prices, store badges, and direct launch links.
* Daily/weekly summary reports of total claimed value in USD/TRY/RUB.

---

## 🔮 Phase 3: Long-term Ideas
- [ ] **Itch.io 100% Off Scraper:** Curated high-rated indie game discovery.
- [ ] **Multi-account rotation:** Batch claiming across multiple family or developer accounts.
