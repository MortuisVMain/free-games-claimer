# Solution: Epic Games Store DOM Redesign & Localization Fix

## Проблема
При запуске `node epic-games.js` происходил сбой по таймауту:
```text
page.waitForFunction: Timeout 60000ms exceeded.
    at epic-games.js:155:16
```

## Причина (Root Cause)
1. **Удаление `data-testid="purchase-cta-button"`**: Epic Games обновили верстку карточек игр в магазине и убрали атрибут `data-testid="purchase-cta-button"`. Кнопка теперь имеет CSS-класс `_sidebarBuyButton_...` и локализованный текст (`Get` / `Получить`).
2. **Локализация магазина**: Поскольку профиль пользователя в `data/browser` сохранен с русской локалью (`ru_RU`), текст кнопок отображается на русском языке (`Получить`, `В библиотеке`, `Добавить в библиотеку`). Старая проверка `btnText == 'in library'` не определяла наличие игры в библиотеке.
3. **Обновление checkout iframe**: Epic Games изменили URL и DOM фрейма чекаута. Старый селектор `#webPurchaseContainer iframe` устарел; современный фрейм имеет `src*="checkout"`, а кнопка оформления содержит `Добавить в библиотеку` или `Place Order`.

## Решение (Surgical Fix)
В [`epic-games.js`](file:///C:/AI%20Local%20Projects/Scripts/Free%20Games%20Claimer/epic-games.js):
- Расширен `page.waitForFunction` и селектор кнопки:
  `button[data-testid="purchase-cta-button"], button[class*="sidebarBuyButton"], button:has-text("Get"), button:has-text("Получить"), button:has-text("In Library"), button:has-text("В библиотеке")`
- Добавлена поддержка мультиязычности: `/(in library|в библиотеке)/i.test(btnText)`.
- Фрейм чекаута ищется через `iframe[src*="checkout"], #webPurchaseContainer iframe`.
- Кнопка заказа внутри фрейма поддерживает оба языка: `/Add to library|Place Order|Добавить в библиотеку|Оформить заказ/i`.
- Добавлен слушатель на Arkose/Talon challenge с предупреждением для пользователя запустить скрипт с `SHOW=1`.
