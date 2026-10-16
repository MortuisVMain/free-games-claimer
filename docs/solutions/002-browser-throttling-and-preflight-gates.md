# Решение 002: Устранение троттлинга браузера в фоне, pre-flight шлюзы и дренаж libuv в Node.js 24

**Дата:** 2026-10-16  
**Область:** Playwright / Patchright, Node.js v24 (Windows), Chromium Automation, Unity Asset Store, Itch.io  
**Статус:** Решено и проверено в продакшене

---

## 1. Проблема №1: Зависание скриптов в фоне при `windowState: 'minimized'`

### Симптом
При запуске в планировщике или с флагом фонового режима (`FGC_MINIMIZE=1`) скрипты магазинов (особенно Unity Asset Store и Fab) периодически зависали по таймауту на этапе оплаты или переходов между страницами.

### Причина
Использование CDP-команды `Browser.setWindowBounds` с параметром `windowState: 'minimized'` переводит окно Chromium в свернутое состояние Windows. Chromium оптимизирует производительность:
- Ограничивает таймеры (`setTimeout`, `setInterval`) до 1 вызова в секунду (1 Hz);
- Полностью останавливает `requestAnimationFrame` (RAF);
- Выставляет `document.visibilityState = 'hidden'`, из-за чего современные SPA (React / Angular в платежных формах) не рендерят интерактивные элементы и модальные окна подтверждения.

### Решение (`src/browser.js`)
Вместо сворачивания через `minimized`:
1. Запускать Chromium с флагами подавления троттлинга:
   ```javascript
   '--window-position=-32000,-32000',
   '--window-size=1280,900',
   '--disable-background-timer-throttling',
   '--disable-backgrounding-occluded-windows',
   '--disable-renderer-backgrounding'
   ```
2. В `minimizeWindow(context)` перемещать окно за пределы рабочего стола (`left: -32000, top: -32000`) в состоянии `windowState: 'normal'`. Для Windows окно остается активным и отрисовывается на полной скорости, но абсолютно невидимо для пользователя и не перехватывает фокус ввода.

---

## 2. Проблема №2: Краш Node.js 24 на Windows (`UV_HANDLE_CLOSING`)

### Симптом
При реализации быстрых Pre-Flight проверок через нативный `fetch()`, вызов `process.exit(0)` сразу после ответа приводил к мгновенному падению процесса с ошибкой libuv:
```text
Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 94
```

### Причина
В среде Windows Node.js 24 движок `fetch` (undici) оставляет сокеты в состоянии keep-alive/закрытия. Асинхронный резкий вызов `process.exit(0)` прерывает внутренний цикл событий libuv в момент обработки флага `UV_HANDLE_CLOSING`.

### Решение
1. Оборачивать логику скрипта в `async function main() { ... } await main();`.
2. При раннем выходе во время Pre-Flight вместо жесткого `process.exit(0)` выполнять обычный `return;`.
3. Node.js естественным образом дожидается завершения открытых дескрипторов и завершает процесс с `exit code 0` без конфликтов деструкторов libuv.

---

## 3. Проблема №3: Опасность случайных списаний в Unity Asset Store

### Решение: Iron Circuit Breaker
Перед нажатием на кнопку оплаты и принятием условий оферты в `unity.js` внедрен жесткий регулярный парсинг текста страницы:
```javascript
const isZeroPrice = await page.waitForFunction(() => {
  const text = document.body.innerText;
  return /(?:Total|Итого|Сумма)[\s\S]{0,40}?(?:[$€£¥₽]\s*0(?:[.,]00)?|0(?:[.,]00)?\s*[$€£¥₽])/i.test(text);
}, { timeout: 15000 }).catch(() => false);

if (!isZeroPrice) {
  throw new Error('Safety guard tripped: Cart total is not $0.00. Aborting checkout to prevent accidental charges.');
}
```
Если по какой-либо причине купон не применился или в корзине оказался платный ассет, транзакция немедленно абортируется с понятной ошибкой в лог.
