// @ts-nocheck
// PikabuPacks.js — наборы за рубли в сборке Пикабу Игр (js/PikabuShop.js). Цены и названия товаров — в Студии
// (каталог CSV: coins_s 19 ₽, coins_m 49 ₽, coins_l 99 ₽, starter 29 ₽, no_ads 59 ₽), здесь — что игрок получает.
// Валюта — монеты движкового Shop (Shop.addCoins), предметы набора — лучшие «за рекламу» из каталога Shop.
PikabuShop.setup({
    colors: ['#ffb020', '#7c4dff'],
    ready: () => !!(typeof Shop !== 'undefined' && Shop.state && Shop.items().length && typeof Game !== 'undefined'),
    visible: () => Game.state === 'menu',
    persist: () => Shop._save('pikabu'),
    button: { corner: 'tr', x: 16, y: 24 },
    packs: [
        { id: 'coins_s', type: 'consumable', icon: '🪙', name: 'Горсть монет', desc: '3 000 монет на скафандры, шлемы и ранцы', grant: () => Shop.addCoins(3000) },
        { id: 'coins_m', type: 'consumable', icon: '💰', name: 'Мешок монет', desc: '10 000 монет', grant: () => Shop.addCoins(10000) },
        { id: 'coins_l', type: 'consumable', icon: '🏆', name: 'Сундук монет', desc: '30 000 монет — хватит на самые дорогие предметы', best: true, grant: () => Shop.addCoins(30000) },
        {
            id: 'starter', type: 'non_consumable', icon: '🚀', name: 'Галактический набор', best: 'Один раз',
            desc: '5 000 монет, скафандр «Галактический», шлем «Орбита» и крылья феникса',
            grant: () => Shop.addCoins(5000),
            apply: () => PikabuShop.shopGrant(['suit_galaxy', 'helmet_orbit', 'pack_phoenix']),
        },
        { id: 'no_ads', type: 'non_consumable', icon: '🚫', name: 'Без рекламы', desc: 'Убирает рекламу между вылетами навсегда. Награды за рекламу остаются', noAds: true },
    ],
});
