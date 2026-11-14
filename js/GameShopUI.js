// GameShopUI.js — окно магазина косметики Clean the Moon: вкладки, сетка карточек с превью, монеты, покупка за валюту и за рекламу,
// примерка на герое. Логика — Shop.js (Shop.cards / act / preview), вид героя — GameLook.js, данные — GameShopData.js.
//
//   GameShopUI.init({ onOpen, onClose, onCoins, onCoinsAd })   один раз; все колбэки необязательны
//   GameShopUI.open(tab?)   показать окно (вкладка по id); зовёт onOpen
//   GameShopUI.close()      скрыть, сбросить примерку (Shop.clearPreview); зовёт onClose
//   GameShopUI.refresh()    перерисовать карточки и монеты (после начисления; по Platform.onRewardedCooldown — сам)
//   GameShopUI.isOpen       окно открыто (GameLook по нему оживляет частицы на паузе игры)
//
// Окно занимает левую часть экрана (≈56%) на широком экране и нижние ≈62% в портрете: герой справа/сверху остаётся виден.
// Стиль — классы окон и кнопок GameHud (gh-win, gh-ribbon, gh-btn, gh-x, gh-pill…), свои — с префиксом gs-.
// Превью карточек рисуются на <canvas> 96×96 из данных предмета: мини-растеризатор примитивов (те же фигуры, что собирает GameLook).

Object.assign(LANG_STRINGS.ru, {
    'gs.title': 'МАГАЗИН', 'gs.coinsAd': 'Монеты за рекламу', 'gs.noAds': 'Реклама недоступна', 'gs.tryOn': 'Примерка',
    'gs.close': 'Закрыть', 'gs.bought': 'Куплено и надето: {name}', 'gs.unlocked': 'Открыто: {name}', 'gs.progress': 'Просмотр засчитан: {a}/{b}',
    'gs.empty': 'Здесь пока пусто', 'gs.count': '{a}/{b}', 'gs.rewardWait': 'Награда за рекламу будет через {n} с',
});
Object.assign(LANG_STRINGS.en, {
    'gs.title': 'SHOP', 'gs.coinsAd': 'Coins for an ad', 'gs.noAds': 'Ads unavailable', 'gs.tryOn': 'Preview',
    'gs.close': 'Close', 'gs.bought': 'Bought and equipped: {name}', 'gs.unlocked': 'Unlocked: {name}', 'gs.progress': 'Ad counted: {a}/{b}',
    'gs.empty': 'Nothing here yet', 'gs.count': '{a}/{b}', 'gs.rewardWait': 'Ad reward available in {n} s',
});

const GS_IC = {
    coin: 'assets/ui/ic_coin.webp', play: 'assets/ui/ic_play.webp', close: 'assets/ui/ic_close.webp',
    check: 'assets/ui/ic_check.webp', lock: 'assets/ui/ic_lock.webp',
};

/** Цвета редкостей: рамка, свечение. */
const GS_RC = /** @type {Record<string, string>} */ ({ common: '#9aa3c4', uncommon: '#4fd35a', rare: '#4aa3ff', epic: '#b45bff', legendary: '#ffc247' });

const GS_CSS = `
.gs-root{position:fixed;inset:0;z-index:91;pointer-events:none;font-size:var(--wf);--wf:clamp(10px,min(3.4vh,4.2vw),17px)}
.gs-root[hidden]{display:none}
.gs-root .gs-win{position:absolute;left:max(.6em,env(safe-area-inset-left,0px));top:2.6em;bottom:.8em;width:56%;max-height:none;padding:1.5em .7em .7em;container-type:inline-size;pointer-events:auto;min-height:0}
@media (max-aspect-ratio:1/1){.gs-root .gs-win{left:.5em;right:.5em;top:auto;bottom:.6em;width:auto;height:62%}}
.gs-coins{position:absolute;left:.7em;top:-1.35em;z-index:3;height:2.7em;padding:0 1em 0 .5em}
.gs-coins img{width:2em;height:2em}
.gs-coins .gh-t{font-size:1.2em}
.gs-tabs{display:flex;gap:.4em;flex:none;margin:.3em 0 .5em}
.gs-tab{flex:1 1 44px;min-width:44px;min-height:44px;padding:.2em .3em;gap:.35em;font-size:.95em}
.gs-tab.on{flex:2 1 auto}
.gs-tab svg{width:1.7em;height:1.7em;flex:none;fill:#fff;stroke:var(--ink);stroke-width:1.7;stroke-linejoin:round;paint-order:stroke fill}
.gs-tab span{white-space:nowrap}
.gs-tab.on{--c1:#ffc247;--c2:#ff8a1f;--sh:#c25a08}
.gs-tab:not(.on){--c1:#5fd0ff;--c2:#2f7bff;--sh:#1a49b8}
@container (max-width:56em){.gs-tab span{display:none}.gs-tab.on span{display:inline}}
@container (max-width:30em){.gs-tab.on span{display:none}.gs-tab.on{flex:1 1 44px}}
.gs-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch;scrollbar-width:thin;padding:.3em .3em .5em;margin:0 -.3em}
.gs-scroll.drag{cursor:grabbing}
.gs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,8.8em),1fr));gap:.7em}
.gs-card{--rc:#9aa3c4;position:relative;display:flex;flex-direction:column;gap:.35em;padding:.4em .4em .5em;min-width:0;cursor:pointer;border-color:var(--rc);transition:transform .08s;overflow:hidden}
.gs-card:active{transform:scale(.98)}
.gs-card[data-r=uncommon]{--rc:#4fd35a}.gs-card[data-r=rare]{--rc:#4aa3ff}.gs-card[data-r=epic]{--rc:#b45bff}.gs-card[data-r=legendary]{--rc:#ffc247}
.gs-card.sel{box-shadow:inset 0 .15em 0 #fff,0 .25em 0 var(--ink),0 0 0 .25em #fff,0 0 1.1em .3em var(--rc)}
.gs-card[data-r=legendary]::after{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,transparent 35%,rgba(255,255,255,.65) 50%,transparent 65%);transform:translateX(-120%);animation:gs-shine 3.4s ease-in-out infinite}
.gs-card[data-r=epic]{box-shadow:inset 0 .15em 0 #fff,0 .25em 0 var(--ink),0 0 .8em rgba(180,91,255,.5)}
.gs-card[data-r=legendary]{box-shadow:inset 0 .15em 0 #fff,0 .25em 0 var(--ink),0 0 .9em rgba(255,194,71,.65)}
.gs-card.sel[data-r]{box-shadow:inset 0 .15em 0 #fff,0 .25em 0 var(--ink),0 0 0 .25em #fff,0 0 1.1em .3em var(--rc)}
@keyframes gs-shine{0%,55%{transform:translateX(-120%)}100%{transform:translateX(120%)}}
.gs-pv{position:relative;aspect-ratio:1/1;border-radius:.7em;border:.15em solid var(--ink);overflow:hidden;background:#141a3e;flex:none}
.gs-pv canvas{display:block;width:100%;height:100%}
.gs-rar{position:absolute;left:0;top:0;padding:.1em .6em .15em;border-radius:0 0 .7em 0;background:var(--rc);color:#fff;font-size:.62em;-webkit-text-stroke:.18em var(--ink);paint-order:stroke fill;font-weight:900;white-space:nowrap}
.gs-tag{position:absolute;right:.25em;top:.25em;width:1.7em;height:1.7em;border-radius:50%;border:.14em solid var(--ink);background:linear-gradient(180deg,#7dff5a,#23c552);display:flex;align-items:center;justify-content:center}
.gs-tag img{width:70%;height:70%}
.gs-tag.lock{background:linear-gradient(180deg,#b9bfd6,#8c93b0)}
.gs-try{position:absolute;left:0;right:0;bottom:0;text-align:center;font-size:.6em;padding:.15em 0;background:rgba(16,20,46,.72);color:#fff;font-weight:800}
.gs-info{min-width:0;display:flex;flex-direction:column;gap:.1em}
.gs-info .gh-n{font-size:.98em;line-height:1.1;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;min-height:2.2em}
.gs-sub{font-size:.74em;color:#4a5384;font-weight:700;min-height:1.25em;line-height:1.2;display:flex;align-items:center;gap:.35em;flex-wrap:wrap}
.gs-sub b{color:#1b8a3c;font-weight:900}
.gs-pips{display:flex;gap:.2em}
.gs-pips i{width:.9em;height:.6em;border:.12em solid var(--ink);border-radius:99px;background:#b8c0e6}
.gs-pips i.on{background:linear-gradient(180deg,#c58bff,#8a3df0)}
.gs-act{margin-top:auto}
.gs-act .gh-btn{width:100%;min-height:max(44px,2.7em);padding:.25em .4em;font-size:.92em;gap:.3em}
.gs-act .gh-btn .gh-t{font-size:1em;white-space:nowrap}
.gs-act .gh-btn img{width:1.4em;height:1.4em}
.gs-act .gh-btn[disabled]{cursor:default;filter:grayscale(.25);opacity:.92}
.gs-act .gh-btn.on{--c1:#9ff08a;--c2:#4fcf5a;--sh:#2b8a36}
.gs-note{display:flex;align-items:center;justify-content:center;gap:.3em;min-height:max(44px,2.7em);border:.17em dashed #9aa3d0;border-radius:.9em;color:#6a73a8;font-size:.78em;font-weight:900;text-align:center;padding:.2em .4em;line-height:1.15}
.gs-note img{width:1.4em;height:1.4em}
.gs-foot{flex:none;display:flex;gap:.6em;justify-content:center;padding-top:.55em}
.gs-foot .gh-btn{min-height:max(44px,2.7em);padding:.2em 1.2em;font-size:.95em}
.gs-foot .gh-btn .gh-t{white-space:nowrap}
.gs-toast{position:absolute;left:50%;bottom:4.2em;transform:translateX(-50%);max-width:92%;padding:.35em 1em .45em;border:.17em solid var(--ink);border-radius:999px;background:linear-gradient(180deg,#5fd0ff,#2f7bff);box-shadow:inset 0 .13em 0 rgba(255,255,255,.4),0 .25em 0 var(--ink);font-size:.95em;text-align:center;z-index:6;pointer-events:none;animation:gs-toast 2.2s both}
.gs-toast.good{background:linear-gradient(180deg,#7dff5a,#23c552)}
.gs-toast.warn{background:linear-gradient(180deg,#ffc247,#ff8a1f)}
@keyframes gs-toast{0%{opacity:0;transform:translate(-50%,.8em) scale(.85)}10%{opacity:1;transform:translate(-50%,0) scale(1.05)}16%{transform:translate(-50%,0) scale(1)}85%{opacity:1}100%{opacity:0}}
.gs-empty{padding:2em 1em;text-align:center;color:#aeb7ee}
@media (max-height:480px) and (min-aspect-ratio:1/1){
  .gs-root .gs-win{top:2.2em;bottom:.5em;padding-top:1.3em}
  .gs-grid{grid-template-columns:repeat(auto-fill,minmax(min(100%,17.5em),1fr));gap:.5em}
  .gs-card{display:grid;grid-template-columns:3.9em minmax(0,1fr) minmax(5.8em,42%);grid-template-areas:"pv info act";gap:.4em;align-items:center;padding:.35em}
  .gs-pv{grid-area:pv;width:3.9em}.gs-info{grid-area:info}.gs-act{grid-area:act;margin-top:0}
  .gs-rar,.gs-try{display:none}
  .gs-info .gh-n{min-height:0;-webkit-line-clamp:1;display:block;white-space:nowrap;text-overflow:ellipsis}
  .gs-act .gh-btn{font-size:.84em}.gs-note{font-size:.7em}
  .gs-foot{padding-top:.4em}
}
.gs-root .gs-win .gh-x{width:max(2.6em,44px);height:max(2.6em,44px);right:-.6em;top:-.9em}
`;

/** @type {any} */
const GS = {
    h: {}, inited: false, root: null, el: {}, tab: '', sel: '', open: false, busy: false, cards: /** @type {Map<string, any>} */ (new Map()),
    unsub: /** @type {Array<() => void>} */ ([]), drag: null, toastT: 0, prevs: /** @type {Record<string, any>} */ ({}),
};

const gsT = (/** @type {string} */ k, /** @type {any} */ p = undefined) => Lang.t(k, p);
const gsEsc = (/** @type {any} */ s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
const gsImg = (/** @type {string} */ src) => '<img src="' + src + '" alt="" draggable="false">';

/** Иконки вкладок: простые силуэты (белая заливка, тёмная обводка). */
const GS_TAB_SVG = /** @type {Record<string, string>} */ ({
    suit: '<svg viewBox="0 0 24 24"><path d="M8.5 3 3 6l2 4.5 2.5-1V21h9V9.5l2.5 1L21 6l-5.5-3c-.4 1.6-1.8 2.6-3.5 2.6S8.9 4.6 8.5 3z"/></svg>',
    helmet: '<svg viewBox="0 0 24 24"><path d="M12 2.5a9 9 0 0 0-9 9V16a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-4.5a9 9 0 0 0-9-9z"/><path d="M6.5 9.5h11a2 2 0 0 1 2 2v1.5a2.5 2.5 0 0 1-2.5 2.5H7a2.5 2.5 0 0 1-2.5-2.5v-1.5a2 2 0 0 1 2-2z" fill="#9fd8ff"/></svg>',
    pack: '<svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="4"/><rect x="8" y="10" width="8" height="6" rx="1.5" fill="#ffc247"/><path d="M9 4V2.5h6V4" fill="none"/></svg>',
    trail: '<svg viewBox="0 0 24 24"><path d="M10 2l2.2 6.3L18.5 10l-6.3 1.7L10 18l-2.2-6.3L1.5 10l6.3-1.7z"/><path d="M19 13l1.1 2.9 2.9 1.1-2.9 1.1L19 21l-1.1-2.9-2.9-1.1 2.9-1.1z"/></svg>',
    pet: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="14.5" rx="10" ry="4"/><path d="M6.5 13.5a5.5 5.5 0 0 1 11 0z" fill="#9fd8ff"/><circle cx="6.5" cy="15" r="1" fill="#ffc247"/><circle cx="12" cy="16" r="1" fill="#ffc247"/><circle cx="17.5" cy="15" r="1" fill="#ffc247"/></svg>',
    stream: '<svg viewBox="0 0 24 24"><path d="M2 8c4-3 6 3 10 0s6 3 10 0v3c-4 3-6-3-10 0s-6-3-10 0z"/><path d="M2 15c4-3 6 3 10 0s6 3 10 0v3c-4 3-6-3-10 0s-6-3-10 0z" fill="#9fd8ff"/></svg>',
});

/** @satisfies {Record<string, any>} */
const GameShopUI = {
    isOpen: false,

    init(h) {
        GS.h = h || {};
        if (GS.inited) return;
        GS.inited = true;
        const st = document.createElement('style');
        st.id = 'gs-css';
        st.textContent = GS_CSS;
        document.head.appendChild(st);
        const root = GS.root = document.createElement('div');
        root.className = 'gh-wl gs-root';
        root.hidden = true;
        root.innerHTML =
            '<div class="gh-win gs-win" role="dialog" aria-modal="true">' +
            '<div class="gh-ribbon"><span class="gh-t" id="gs-title"></span></div>' +
            '<div class="gh-pill gs-coins">' + gsImg(GS_IC.coin) + '<span class="gh-t" id="gs-coins">0</span></div>' +
            '<button type="button" class="gh-btn r gh-x" id="gs-x" aria-label="">' + gsImg(GS_IC.close) + '</button>' +
            '<div class="gs-tabs" id="gs-tabs"></div>' +
            '<div class="gs-scroll" id="gs-scroll"><div class="gs-grid" id="gs-grid"></div></div>' +
            '<div class="gs-foot" id="gs-foot" hidden><button type="button" class="gh-btn o" id="gs-coinsad">' + gsImg(GS_IC.play) + '<span class="gh-t" id="gs-coinsadt"></span></button></div>' +
            '</div>';
        document.body.appendChild(root);
        const q = (/** @type {string} */ id) => /** @type {HTMLElement} */ (root.querySelector('#' + id));
        GS.el = { win: root.querySelector('.gs-win'), title: q('gs-title'), coins: q('gs-coins'), x: q('gs-x'), tabs: q('gs-tabs'), scroll: q('gs-scroll'), grid: q('gs-grid'), foot: q('gs-foot'), coinsad: q('gs-coinsad'), coinsadt: q('gs-coinsadt') };
        GS.el.x.addEventListener('click', () => GameShopUI.close());
        GS.el.coinsad.addEventListener('click', () => { if (GS.h.onCoinsAd) { try { GS.h.onCoinsAd(); } catch (e) { console.warn('GameShopUI.onCoinsAd', e); } } });
        // нажатия по окну не уходят в игровой ввод (стик, взгляд)
        root.addEventListener('pointerdown', (e) => { if (e.target !== root) e.stopPropagation(); });
        root.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
        GS.el.grid.addEventListener('click', gsOnClick);
        gsDragScroll(GS.el.scroll);
        // Esc закрывает окно: перехват раньше паузы GameHud
        window.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape' || !GS.open) return;
            e.preventDefault(); e.stopImmediatePropagation();
            GameShopUI.close();
        }, true);
    },

    open(tab) {
        if (!GS.inited) this.init({});
        if (!GS.open) {
            GS.open = true; this.isOpen = true;
            GS.root.hidden = false;
            const win = GS.el.win;
            win.style.animation = 'none'; void win.offsetWidth; win.style.animation = '';
            GS.unsub.push(Shop.on((/** @type {any} */ e) => {
                if (!GS.open) return;
                if (e.type === 'coins' && GS.h.onCoins) { try { GS.h.onCoins(Shop.coins); } catch (err) { console.warn('GameShopUI.onCoins', err); } }
                if (e.type === 'coins' || e.type === 'grant' || e.type === 'ad' || e.type === 'equip' || e.type === 'unequip') GameShopUI.refresh();
            }));
            GS.unsub.push(Platform.onRewardedCooldown(() => GameShopUI.refresh()));
            if (GS.h.onOpen) { try { GS.h.onOpen(); } catch (e) { console.warn('GameShopUI.onOpen', e); } }
        }
        GS.el.title.textContent = gsT('gs.title');
        GS.el.x.setAttribute('aria-label', gsT('gs.close'));
        GS.el.coinsadt.textContent = gsT('gs.coinsAd');
        const tabs = Shop.tabs();
        const id = tabs.find((t) => t.id === tab) ? tab : (GS.tab && tabs.find((t) => t.id === GS.tab) ? GS.tab : (tabs[0] && tabs[0].id));
        gsTabs();
        gsSelectTab(id, true);
        this.refresh();
    },

    close() {
        if (!GS.open) return;
        GS.open = false; this.isOpen = false;
        for (const u of GS.unsub.splice(0)) { try { u(); } catch (e) { /* уже */ } }
        GS.root.hidden = true;
        GS.sel = '';
        try { Shop.clearPreview(); } catch (e) { /* без магазина */ }
        if (GS.h.onClose) { try { GS.h.onClose(); } catch (e) { console.warn('GameShopUI.onClose', e); } }
    },

    refresh() {
        if (!GS.open) return;
        GS.el.coins.textContent = gsFmt(Shop.coins);
        const adsOk = Platform.rewardedSupported();
        const cards = Shop.cards(GS.tab);
        for (const card of cards) {
            const rec = GS.cards.get(card.id);
            if (rec) gsUpdateCard(rec, card, adsOk);
        }
        gsTabsBadge();
        const showCoinsAd = adsOk && !!GS.h.onCoinsAd;
        GS.el.foot.hidden = !showCoinsAd;
        if (showCoinsAd) {
            const wait = Platform.rewardedCooldownLeft();
            GS.el.coinsad.disabled = wait > 0;
            GS.el.coinsadt.textContent = wait > 0 ? Lang.t('shop.adIn', { n: wait }) : gsT('gs.coinsAd');
            GS.el.coinsad.classList.toggle('x', wait > 0);
            GS.el.coinsad.classList.toggle('o', wait <= 0);
        }
    },
};

const gsFmt = (/** @type {number} */ n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

// =================================================================================================
// Вкладки, карточки, действия
// =================================================================================================

function gsTabs() {
    const box = GS.el.tabs;
    box.innerHTML = '';
    for (const t of Shop.tabs()) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'gh-btn gs-tab'; b.dataset.tab = t.id;
        b.setAttribute('aria-label', t.name);
        b.innerHTML = (GS_TAB_SVG[t.id] || GS_TAB_SVG.suit) + '<span class="gh-t">' + gsEsc(t.name) + '</span>';
        b.addEventListener('click', () => gsSelectTab(t.id, false));
        box.appendChild(b);
    }
}

function gsTabsBadge() {
    for (const b of /** @type {HTMLElement[]} */ ([...GS.el.tabs.children])) b.classList.toggle('on', b.dataset.tab === GS.tab);
}

function gsSelectTab(/** @type {string} */ id, /** @type {boolean} */ force) {
    if (!force && id === GS.tab) return;
    GS.tab = id;
    try { Shop.clearPreview(); } catch (e) { /* без магазина */ }
    GS.sel = '';
    GS.el.scroll.scrollTop = 0;
    const grid = GS.el.grid;
    grid.innerHTML = '';
    GS.cards.clear();
    const cards = Shop.cards(id);
    if (!cards.length) grid.innerHTML = '<div class="gs-empty">' + gsEsc(gsT('gs.empty')) + '</div>';
    for (const card of cards) {
        const el = document.createElement('div');
        el.className = 'gh-card gs-card'; el.dataset.id = card.id; el.dataset.r = card.rarity || 'common';
        el.innerHTML =
            '<div class="gs-pv"><canvas></canvas><span class="gs-rar"></span><span class="gs-tag" hidden></span><span class="gs-try" hidden></span></div>' +
            '<div class="gs-info"><div class="gh-n"></div><div class="gs-sub"></div></div><div class="gs-act"></div>';
        grid.appendChild(el);
        const rec = { el, id: card.id, sig: '', pv: /** @type {HTMLElement} */ (el.querySelector('.gs-pv')), name: /** @type {HTMLElement} */ (el.querySelector('.gh-n')), sub: /** @type {HTMLElement} */ (el.querySelector('.gs-sub')), act: /** @type {HTMLElement} */ (el.querySelector('.gs-act')), tag: /** @type {HTMLElement} */ (el.querySelector('.gs-tag')), rar: /** @type {HTMLElement} */ (el.querySelector('.gs-rar')), tryEl: /** @type {HTMLElement} */ (el.querySelector('.gs-try')) };
        rec.name.textContent = card.name; rec.name.title = card.name;
        rec.rar.textContent = card.rarityLabel;
        try { gsDrawPreview(/** @type {HTMLCanvasElement} */ (el.querySelector('canvas')), card.item); } catch (e) { console.warn('GameShopUI preview ' + card.id, e); }
        GS.cards.set(card.id, rec);
    }
    GameShopUI.refresh();
}

/** Обновить динамическую часть карточки (подпись, кнопка, состояние); перерисовка только при изменении. */
function gsUpdateCard(/** @type {any} */ rec, /** @type {any} */ card, /** @type {boolean} */ adsOk) {
    const sel = GS.sel === card.id;
    const sig = [card.state, card.action, card.actionLabel, card.enabled, card.hint, card.progress, card.priceLabel, card.busy, GS.busy, adsOk, sel, Lang.code].join('|');
    if (sig === rec.sig) return;
    rec.sig = sig;
    rec.el.classList.toggle('sel', sel);
    rec.tryEl.hidden = !sel;
    rec.tryEl.textContent = gsT('gs.tryOn');
    rec.tag.hidden = !(card.owned || card.kind === 'exclusive');
    rec.tag.className = 'gs-tag' + (card.owned ? '' : ' lock');
    rec.tag.innerHTML = gsImg(card.owned ? GS_IC.check : GS_IC.lock);
    // подпись под названием
    let sub = '';
    if (card.owned) sub = '<b>' + gsEsc(card.equipped ? Shop.t('shop.equipped') : Shop.t('shop.owned')) + '</b>';
    else if (card.kind === 'ads') {
        let pips = '<span class="gs-pips">';
        for (let i = 0; i < card.need; i++) pips += '<i' + (i < card.progress ? ' class="on"' : '') + '></i>';
        sub = pips + '</span>';
    } else if (card.kind === 'coins') sub = card.enabled || card.owned ? '' : gsEsc(card.hint);
    else if (card.kind === 'exclusive') sub = gsEsc(card.hint);
    rec.sub.innerHTML = sub;
    // действие
    const act = rec.act;
    act.innerHTML = '';
    const mkBtn = (/** @type {string} */ cls, /** @type {string} */ html, /** @type {boolean} */ enabled) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'gh-btn gs-btn ' + cls; b.dataset.act = card.action; b.disabled = !enabled;
        b.innerHTML = html;
        act.appendChild(b);
        return b;
    };
    const busy = GS.busy || card.busy;
    if (card.action === 'buy') {
        mkBtn(card.affordable ? '' : 'x', '<span class="gh-t">' + gsEsc(Shop.t('shop.buy')) + ' ' + gsFmt(card.price) + '</span>' + gsImg(GS_IC.coin), card.enabled && !busy);
    } else if (card.action === 'watch') {
        if (!adsOk) act.innerHTML = '<div class="gs-note">' + gsEsc(gsT('gs.noAds')) + '</div>';
        else mkBtn('p', gsImg(GS_IC.play) + '<span class="gh-t">' + gsEsc(card.adWait > 0 && card.actionLabel ? card.actionLabel : card.priceLabel) + '</span>', card.enabled && !busy);
    } else if (card.action === 'equip') {
        mkBtn('b', '<span class="gh-t">' + gsEsc(card.actionLabel) + '</span>', !busy);
    } else if (card.action === 'unequip') {
        mkBtn('o', '<span class="gh-t">' + gsEsc(card.actionLabel) + '</span>', !busy);
    } else if (card.equipped) {
        mkBtn('on', gsImg(GS_IC.check) + '<span class="gh-t">' + gsEsc(Shop.t('shop.equipped')) + '</span>', false);
    } else {
        act.innerHTML = '<div class="gs-note">' + gsImg(GS_IC.lock) + '<span>' + gsEsc(card.hint || card.priceLabel || Shop.t('shop.locked')) + '</span></div>';
    }
}

function gsOnClick(/** @type {Event} */ e) {
    if (GS.dragMoved) { GS.dragMoved = false; return; }
    const t = /** @type {HTMLElement} */ (e.target);
    const card = t.closest && /** @type {HTMLElement | null} */ (t.closest('.gs-card'));
    if (!card) return;
    const id = card.dataset.id || '';
    if (t.closest('.gs-btn')) { gsAct(id); return; }
    gsSelect(id);
}

/** Примерка: карточка выделяется, вещь видна на герое; повторный нажим снимает примерку слота. */
function gsSelect(/** @type {string} */ id) {
    const prev = GS.sel;
    const slot = (Shop.card(id) || {}).slot;
    if (prev === id) { GS.sel = ''; if (slot) Shop.clearPreview(slot); }
    else { GS.sel = id; Shop.preview(id); }
    for (const rid of [prev, id]) { const rec = GS.cards.get(rid); if (rec) rec.sig = ''; }
    GameShopUI.refresh();
}

async function gsAct(/** @type {string} */ id) {
    if (GS.busy) return;
    const before = Shop.card(id);
    if (!before || before.action === 'none' || !before.enabled) return;
    GS.busy = true;
    for (const rec of GS.cards.values()) rec.sig = '';
    GameShopUI.refresh();
    let res = null;
    try { res = await Shop.act(id); } catch (e) { console.warn('GameShopUI act', e); }
    GS.busy = false;
    for (const rec of GS.cards.values()) rec.sig = '';
    if (!GS.open) return;
    if (res && res.ok) {
        if (before.action === 'buy') { gsToast(gsT('gs.bought', { name: before.name }), 'good'); if (GS.sel === id) { GS.sel = ''; Shop.clearPreview(before.slot); } }
        else if (before.action === 'watch') {
            const c = Shop.card(id);
            if (c && c.owned) { gsToast(gsT('gs.unlocked', { name: before.name }), 'good'); if (GS.sel === id) { GS.sel = ''; Shop.clearPreview(before.slot); } }
            else if (c) gsToast(gsT('gs.progress', { a: c.progress, b: c.need }), 'good');
        } else if (before.action === 'equip' && GS.sel === id) { GS.sel = ''; Shop.clearPreview(before.slot); }
    } else if (res) {
        if (res.reason === 'adFailed' || res.reason === 'adUnavailable') gsToast(Shop.t('shop.adUnavailable'), 'warn');
        else if (res.reason === 'cooldown') gsToast(Shop.adWaitLabel(), 'warn');
        else if (res.reason === 'noCoins' || res.reason === 'funds') gsToast(before.hint || '', 'warn');
        const rec = GS.cards.get(id);
        if (rec) { rec.el.classList.remove('gh-shake'); void rec.el.offsetWidth; rec.el.classList.add('gh-shake'); }
    }
    GameShopUI.refresh();
}

function gsToast(/** @type {string} */ text, /** @type {string} */ kind) {
    if (!text) return;
    const old = GS.el.win.querySelector('.gs-toast');
    if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'gs-toast ' + (kind || '');
    el.textContent = text;
    GS.el.win.appendChild(el);
    setTimeout(() => el.remove(), 2300);
}

/** Прокрутка перетаскиванием мышью (пальцем — штатная). */
function gsDragScroll(/** @type {HTMLElement} */ box) {
    let sy = 0, st = 0, down = false;
    box.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        down = true; sy = e.clientY; st = box.scrollTop; GS.dragMoved = false;
    });
    window.addEventListener('pointermove', (e) => {
        if (!down) return;
        const d = e.clientY - sy;
        if (Math.abs(d) > 6) { GS.dragMoved = true; box.classList.add('drag'); }
        if (GS.dragMoved) box.scrollTop = st - d;
    });
    const up = () => { down = false; box.classList.remove('drag'); setTimeout(() => { GS.dragMoved = false; }, 0); };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
}

// =================================================================================================
// Превью 96×96 из данных предмета: мини-растеризатор примитивов (box, cyl, sph, tor, poly)
// =================================================================================================

/** Центры частей тела героя в покое (px, подошва y = 0): имя -> [размер, центр, ключ цвета]. */
const GS_BODY = /** @type {Record<string, any>} */ ({
    LowerTorso: [[35, 14, 70], [0, 77, 0], 'top'], UpperTorso: [[35, 56, 70], [0, 112, 0], 'top'], Head: [[44, 44, 50], [0, 164, 0], 'skin'],
    UpperArmL: [[33, 38, 33], [0, 121, -52], 'top'], LowerArmL: [[31, 28, 31], [0, 88, -52], 'skin'], HandL: [[29, 12, 29], [0, 68, -52], 'glove'],
    UpperArmR: [[33, 38, 33], [0, 121, 52], 'top'], LowerArmR: [[31, 28, 31], [0, 88, 52], 'skin'], HandR: [[29, 12, 29], [0, 68, 52], 'glove'],
    UpperLegL: [[35, 31, 35], [0, 54.5, -17.5], 'bottom'], LowerLegL: [[33, 29, 33], [0, 24.5, -17.5], 'bottom'], FootL: [[38, 10, 33], [4, 5, -17.5], 'boot'],
    UpperLegR: [[35, 31, 35], [0, 54.5, 17.5], 'bottom'], LowerLegR: [[33, 29, 33], [0, 24.5, 17.5], 'bottom'], FootR: [[38, 10, 33], [4, 5, 17.5], 'boot'],
});

/** Грани примитива в его локальных осях (масштаб sc применён): [{ p: [[x,y,z]...], r: центр для «наружу» }]. */
function gsPrim(/** @type {any} */ s) {
    const sc = s.sc || [1, 1, 1];
    /** @type {any[]} */
    const faces = [];
    const f = (/** @type {number[][]} */ p, /** @type {number[]} */ r = [0, 0, 0]) => faces.push({ p, r });
    if (s.k === 'box') {
        const x = s.s[0] / 2, y = s.s[1] / 2, z = s.s[2] / 2;
        const V = [[-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z], [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]];
        for (const q of [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]]) f(q.map((i) => V[i]));
    } else if (s.k === 'cyl') {
        const n = 10, rt = s.s[0] / 2, rb = s.s[1] / 2, h = s.s[2] / 2;
        const top = [], bot = [];
        for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; top.push([Math.cos(a) * rt, h, Math.sin(a) * rt]); bot.push([Math.cos(a) * rb, -h, Math.sin(a) * rb]); }
        for (let i = 0; i < n; i++) { const j = (i + 1) % n; f(rt > 0 ? [top[i], top[j], bot[j], bot[i]] : [top[i], bot[j], bot[i]]); }
        if (rt > 0) f(top.slice().reverse()); if (rb > 0) f(bot);
    } else if (s.k === 'sph') {
        const R = s.s[0] / 2, nl = 6, nm = 8;
        const P = (/** @type {number} */ i, /** @type {number} */ j) => { const a = i / nl * Math.PI, b = j / nm * Math.PI * 2; return [Math.sin(a) * Math.cos(b) * R, Math.cos(a) * R, Math.sin(a) * Math.sin(b) * R]; };
        for (let i = 0; i < nl; i++) for (let j = 0; j < nm; j++) f(i === 0 ? [P(0, 0), P(1, j + 1), P(1, j)] : i === nl - 1 ? [P(i, j), P(i, j + 1), P(nl, 0)] : [P(i, j), P(i, j + 1), P(i + 1, j + 1), P(i + 1, j)]);
    } else if (s.k === 'tor') {
        const R = s.s[0] / 2, r = s.s[1] / 2, n = 14, m = 6;
        const P = (/** @type {number} */ i, /** @type {number} */ j) => { const a = i / n * Math.PI * 2, b = j / m * Math.PI * 2, rr = R + Math.cos(b) * r; return [Math.cos(a) * rr, Math.sin(b) * r, Math.sin(a) * rr]; };
        for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const a = (i + 0.5) / n * Math.PI * 2; f([P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)], [Math.cos(a) * R, 0, Math.sin(a) * R]); }
    } else {
        const R = s.s[0] / 2, V = [[R, 0, 0], [-R, 0, 0], [0, R, 0], [0, -R, 0], [0, 0, R], [0, 0, -R]];
        for (const t of [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [4, 3, 0], [1, 3, 4], [5, 3, 1], [0, 3, 5]]) f(t.map((i) => V[i]));
    }
    if (sc[0] !== 1 || sc[1] !== 1 || sc[2] !== 1) for (const q of faces) { q.p = q.p.map((/** @type {number[]} */ v) => [v[0] * sc[0], v[1] * sc[1], v[2] * sc[2]]); q.r = [q.r[0] * sc[0], q.r[1] * sc[1], q.r[2] * sc[2]]; }
    return faces;
}

/** Поворот Эйлера как у Babylon: сначала Z, затем X, затем Y. */
function gsRot(/** @type {number[]} */ v, /** @type {number[]} */ r) {
    let [x, y, z] = v;
    if (r[2]) { const c = Math.cos(r[2]), s = Math.sin(r[2]); [x, y] = [x * c - y * s, x * s + y * c]; }
    if (r[0]) { const c = Math.cos(r[0]), s = Math.sin(r[0]); [y, z] = [y * c - z * s, y * s + z * c]; }
    if (r[1]) { const c = Math.cos(r[1]), s = Math.sin(r[1]); [x, z] = [x * c + z * s, -x * s + z * c]; }
    return [x, y, z];
}

/** Сцена превью: грани в мировых px, проекция, заливка с простым светом. */
class GsScene {
    constructor(/** @type {number} */ yaw, /** @type {number} */ pitch = 0.16) {
        this.yaw = yaw; this.pitch = pitch;
        /** @type {any[]} */ this.faces = [];
        /** @type {any[]} */ this.extra = [];
    }
    /** Добавить фигуру: s — фигура, off — смещение (центр части + опорная точка группы). */
    shape(/** @type {any} */ s, /** @type {number[]} */ off, /** @type {number | null} */ color, /** @type {number} */ alpha = 1) {
        const p = s.p || [0, 0, 0], r = s.r || [0, 0, 0];
        for (const q of gsPrim(s)) {
            const tf = (/** @type {number[]} */ v) => { const w = gsRot(v, r); return [w[0] + p[0] + off[0], w[1] + p[1] + off[1], w[2] + p[2] + off[2]]; };
            this.faces.push({ p: q.p.map(tf), ref: tf(q.r), c: color != null ? color : s.c, g: !!s.g, a: alpha });
        }
    }
    box(/** @type {number[]} */ size, /** @type {number[]} */ c, /** @type {number} */ color) { this.shape({ k: 'box', s: size, p: [0, 0, 0] }, c, color); }
    /** Проекция точки: [экранный x, экранный y (вверх +), глубина к камере]. */
    proj(/** @type {number[]} */ v) {
        const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
        const sx = v[0] * sy - v[2] * cy, d = v[0] * cy + v[2] * sy;
        return [sx, v[1] * cp - d * sp, d * cp + v[1] * sp];
    }
    /** Нарисовать: подгон под холст 96 с полем m; fitBox — [x0,y0,x1,y1] в проекции, чтобы подгонять по нему. */
    draw(/** @type {CanvasRenderingContext2D} */ c, /** @type {number} */ m, /** @type {number[] | null} */ fitBox, /** @type {number} */ lift = 0) {
        const P = this.faces.map((q) => ({ q, v: q.p.map((/** @type {number[]} */ v) => this.proj(v)), r: this.proj(q.ref) }));
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const f of P) for (const v of f.v) { x0 = Math.min(x0, v[0]); x1 = Math.max(x1, v[0]); y0 = Math.min(y0, v[1]); y1 = Math.max(y1, v[1]); }
        for (const e of this.extra) { x0 = Math.min(x0, e[0]); x1 = Math.max(x1, e[0]); y0 = Math.min(y0, e[1]); y1 = Math.max(y1, e[1]); }
        if (fitBox) { x0 = fitBox[0]; y0 = fitBox[1]; x1 = fitBox[2]; y1 = fitBox[3]; }
        const k = Math.min((96 - m * 2) / Math.max(1, x1 - x0), (96 - m * 2) / Math.max(1, y1 - y0));
        const ox = 48 - (x0 + x1) / 2 * k, oy = 48 + (y0 + y1) / 2 * k + lift;
        const T = (/** @type {number[]} */ v) => [ox + v[0] * k, oy - v[1] * k];
        // грани к камере (по нормали), дальние раньше
        const vis = [];
        for (const f of P) {
            const a = f.v[0], b = f.v[1], d = f.v[2];
            let nz = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
            // «наружу» — по вектору от опорной точки грани к её центру
            const cx = f.v.reduce((s2, v) => s2 + v[0], 0) / f.v.length, cyy = f.v.reduce((s2, v) => s2 + v[1], 0) / f.v.length, cz = f.v.reduce((s2, v) => s2 + v[2], 0) / f.v.length;
            const ex = cx - f.r[0], ey = cyy - f.r[1], ez = cz - f.r[2];
            // нормаль в видовом пространстве через векторное произведение трёх вершин
            const u = [f.v[1][0] - a[0], f.v[1][1] - a[1], f.v[1][2] - a[2]], w = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
            const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
            if (n[0] * ex + n[1] * ey + n[2] * ez < 0) { n[0] = -n[0]; n[1] = -n[1]; n[2] = -n[2]; nz = -nz; }
            const nl = Math.hypot(n[0], n[1], n[2]) || 1;
            if (n[2] / nl < -0.02 && !f.q.g) continue;
            if (f.q.g && n[2] / nl < -0.4) continue;
            vis.push({ f, n: [n[0] / nl, n[1] / nl, n[2] / nl], z: cz });
        }
        vis.sort((p, q) => p.z - q.z);
        for (const { f, n } of vis) {
            const col = f.q.c;
            const l = Math.max(0, n[0] * -0.35 + n[1] * 0.75 + n[2] * 0.55);
            const sh = f.q.g ? 1.08 : 0.62 + 0.5 * l;
            const R = Math.min(255, Math.round(((col >> 16) & 255) * sh)), Gc = Math.min(255, Math.round(((col >> 8) & 255) * sh)), B = Math.min(255, Math.round((col & 255) * sh));
            c.globalAlpha = f.q.a;
            c.fillStyle = 'rgb(' + R + ',' + Gc + ',' + B + ')';
            if (f.q.g) { c.shadowColor = 'rgb(' + R + ',' + Gc + ',' + B + ')'; c.shadowBlur = 5; } else c.shadowBlur = 0;
            c.beginPath();
            f.v.forEach((v, i) => { const t = T(v); if (i) c.lineTo(t[0], t[1]); else c.moveTo(t[0], t[1]); });
            c.closePath(); c.fill();
            c.shadowBlur = 0;
            if (!f.q.g) { c.strokeStyle = 'rgba(10,14,46,.5)'; c.lineWidth = 0.55; c.stroke(); }
        }
        c.globalAlpha = 1;
        return { T, k };
    }
}

const GS_HAIR = [[46, 8, 52, 0, 24, 0], [6, 26, 48, -22.5, 10, 0], [6, 8, 36, 22.5, 19, 3], [34, 18, 5, -4, 13, -25.5], [34, 18, 5, -4, 13, 25.5], [17, 6, 20, 8, 29, -11], [18, 6, 19, -5, 30, 9]];

/** Фигура героя (части тела по цветам костюма) в сцену; opts: { head: false } — без тела под головой, ... */
function gsFigure(/** @type {GsScene} */ sc, /** @type {any} */ suit, /** @type {any} */ o) {
    const col = (/** @type {string} */ key) => {
        const v = key === 'glove' ? suit.glove : key === 'boot' ? (suit.boot != null ? suit.boot : suit.glove) : suit[key];
        return v != null ? v : 0xcccccc;
    };
    const only = o && o.only;
    for (const name of Object.keys(GS_BODY)) {
        if (only && !only.includes(name)) continue;
        const [size, c, key] = GS_BODY[name];
        sc.box(size, c, col(key));
    }
    if (suit.hair !== null && (!only || only.includes('Head'))) for (const h of GS_HAIR) sc.shape({ k: 'box', s: [h[0], h[1], h[2]], p: [h[3], h[4], h[5]] }, GS_BODY.Head[1], suit.hair != null ? suit.hair : 0x7a4a1c);
}

/** Группы деталей предмета -> фигуры в сцену. partOf(on) -> центр части в мире. */
function gsParts(/** @type {GsScene} */ sc, /** @type {any[]} */ parts, /** @type {(on: string) => number[]} */ partOf) {
    for (const g of parts || []) {
        const base = partOf(g.on);
        const at = g.at || [0, 0, 0];
        const off = [base[0] + at[0], base[1] + at[1], base[2] + at[2]];
        for (const s of g.shapes) sc.shape(s, off, g.anim && g.anim.t === 'hue' ? GameLook.hsv(0.12, 0.75, 1) : null);
    }
}

function gsFaceCanvas(/** @type {any} */ suit) {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 144;
    const c = cv.getContext('2d');
    try { (suit.face || ((/** @type {any} */ cc, /** @type {number} */ w, /** @type {number} */ h) => GameHero.paintFace(cc, w, h)))(c, 256, 144); } catch (e) { /* без лица */ }
    return cv;
}

function gsDrawPreview(/** @type {HTMLCanvasElement} */ cv, /** @type {any} */ it) {
    const k = Math.min(2, Math.max(1, Math.round(window.devicePixelRatio || 1)));
    cv.width = cv.height = 96 * k;
    const c = /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d'));
    c.scale(k, k);
    const rc = GS_RC[it.rarity] || GS_RC.common;
    const bg = c.createRadialGradient(48, 42, 4, 48, 52, 72);
    bg.addColorStop(0, '#39428f'); bg.addColorStop(0.6, '#1d2556'); bg.addColorStop(1, '#10143a');
    c.fillStyle = bg; c.fillRect(0, 0, 96, 96);
    // цвет редкости — свечение у нижнего края
    const gl = c.createRadialGradient(48, 96, 2, 48, 96, 60);
    gl.addColorStop(0, rc + 'aa'); gl.addColorStop(1, rc + '00');
    c.fillStyle = gl; c.fillRect(0, 0, 96, 96);
    const def = SHOP_ITEMS.find((i) => i.id === 'suit_default') || {};
    const tab = it.tab;
    if (tab === 'suit') gsPrevSuit(c, it);
    else if (tab === 'helmet') gsPrevHelmet(c, it, def);
    else if (tab === 'pack') gsPrevPack(c, it, def);
    else if (tab === 'pet') gsPrevPet(c, it);
    else if (tab === 'trail') gsPrevTrail(c, it);
    else if (tab === 'stream') gsPrevStream(c, it);
}

function gsShadow(/** @type {CanvasRenderingContext2D} */ c, /** @type {number} */ y, /** @type {number} */ w) {
    c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(48, y, w, w * 0.22, 0, 0, 6.3); c.fill();
}

function gsPrevSuit(/** @type {CanvasRenderingContext2D} */ c, /** @type {any} */ it) {
    const sc = new GsScene(0.6);
    gsFigure(sc, it, null);
    gsParts(sc, it.parts, (on) => (GS_BODY[on || 'UpperTorso'] || GS_BODY.UpperTorso)[1]);
    sc.extra.push(sc.proj([0, -2, 0]), sc.proj([0, 194, 0]));
    gsShadow(c, 91, 24);
    const r = sc.draw(c, 4, null, 0);
    gsFaceOn(c, r, sc, it);
}

/** Лицо: плоская наклейка 36×20 на передней грани головы (аффинное отображение холста 256×144). */
function gsFaceOn(/** @type {CanvasRenderingContext2D} */ c, /** @type {any} */ r, /** @type {GsScene} */ sc, /** @type {any} */ suit) {
    if (Math.cos(sc.yaw) < 0.2) return;
    const head = GS_BODY.Head[1];
    const F = (/** @type {number} */ z, /** @type {number} */ y) => r.T(sc.proj([head[0] + 22.4, head[1] + y, head[2] + z]));
    const p0 = F(18, 9.25), p1 = F(-18, 9.25), p2 = F(18, -11);
    const kk = Math.min(2, Math.max(1, Math.round(window.devicePixelRatio || 1)));
    c.save();
    c.setTransform(((p1[0] - p0[0]) / 256) * kk, ((p1[1] - p0[1]) / 256) * kk, ((p2[0] - p0[0]) / 144) * kk, ((p2[1] - p0[1]) / 144) * kk, p0[0] * kk, p0[1] * kk);
    c.drawImage(gsFaceCanvas(suit), 0, 0);
    c.restore();
}

function gsPrevHelmet(/** @type {CanvasRenderingContext2D} */ c, /** @type {any} */ it, /** @type {any} */ def) {
    const sc = new GsScene(0.55);
    const head = GS_BODY.Head[1];
    gsFigure(sc, def, { only: ['Head'] });
    // стекло шлема — прозрачная сфера
    const glass = it.glass != null ? it.glass : 0xb8e0ff;
    sc.shape({ k: 'sph', s: [98], p: [0, 3, 0] }, head, glass, it.alpha != null ? Math.min(0.5, it.alpha + 0.06) : 0.2);
    gsParts(sc, it.parts, () => head);
    const r = sc.draw(c, 3, null, 0);
    gsFaceOn(c, r, sc, def);
}

function gsPrevPack(/** @type {CanvasRenderingContext2D} */ c, /** @type {any} */ it, /** @type {any} */ def) {
    const sc = new GsScene(Math.PI - 0.55);
    gsFigure(sc, def, { only: ['Head', 'UpperTorso', 'LowerTorso', 'UpperArmL', 'UpperArmR', 'LowerArmL', 'LowerArmR', 'UpperLegL', 'UpperLegR'] });
    const tor = GS_BODY.UpperTorso[1];
    const tank = it.tank != null ? it.tank : 0xe6eaf4;
    sc.shape({ k: 'box', s: [46, 79, 58], p: [-31, 6.5, 0] }, tor, tank);
    sc.shape({ k: 'box', s: [3, 60, 40], p: [-54.5, 8, 0] }, tor, 0x8fd8ff, 0.8);
    gsParts(sc, it.parts, (on) => (GS_BODY[on || 'UpperTorso'] || GS_BODY.UpperTorso)[1]);
    sc.extra.push(sc.proj([0, 190, 0]), sc.proj([0, 60, 0]));
    sc.draw(c, 3, null, 0);
}

function gsPrevPet(/** @type {CanvasRenderingContext2D} */ c, /** @type {any} */ it) {
    const sc = new GsScene(0.6);
    const scl = it.scale || 1;
    for (const g of it.parts || []) {
        const at = g.at || [0, 0, 0];
        for (const s of g.shapes) {
            const s2 = { ...s, p: [s.p[0] * scl, s.p[1] * scl, s.p[2] * scl], s: s.s.map((/** @type {number} */ v) => v * scl) };
            sc.shape(s2, [at[0] * scl, at[1] * scl, at[2] * scl], g.anim && g.anim.t === 'hue' ? GameLook.hsv(0.12, 0.75, 1) : null);
        }
    }
    const r = sc.draw(c, 11, null, -2);
    void r;
    if (it.fx) { c.fillStyle = (Array.isArray(it.fx) ? it.fx[0] : it.fx).color || '#fff'; }
}

/** Тонированный спрайт частицы (белый спрайт × цвет). */
const GS_TINT = /** @type {Record<string, HTMLCanvasElement>} */ ({});
function gsTint(/** @type {string} */ tex, /** @type {string} */ color) {
    const key = tex + color;
    if (GS_TINT[key]) return GS_TINT[key];
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d'));
    g.drawImage(GameLook.sprite(tex), 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color; g.fillRect(0, 0, 64, 64);
    GS_TINT[key] = cv;
    return cv;
}

function gsMixHex(/** @type {string} */ a, /** @type {string} */ b, /** @type {number} */ t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = (/** @type {number} */ s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
    return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}

function gsGradAt(/** @type {any[]} */ grad, /** @type {number} */ t) {
    for (let i = 1; i < grad.length; i++) if (t <= grad[i][0]) { const a = grad[i - 1], b = grad[i]; return gsMixHex(a[1], b[1], (t - a[0]) / Math.max(1e-6, b[0] - a[0])); }
    return grad[grad.length - 1][1];
}

function gsPrevTrail(/** @type {CanvasRenderingContext2D} */ c, /** @type {any} */ it) {
    const layers = it.fx ? (Array.isArray(it.fx) ? it.fx : [it.fx]) : [];
    // «ботинок» героя у начала следа
    c.fillStyle = '#f2f5ff'; c.strokeStyle = '#10142e'; c.lineWidth = 1.4;
    c.beginPath(); c.roundRect(10, 70, 18, 9, 3); c.fill(); c.stroke();
    c.fillStyle = '#2a3550'; c.beginPath(); c.roundRect(12, 58, 13, 13, 2); c.fill(); c.stroke();
    if (!layers.length) {
        c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2.5; c.setLineDash([4, 5]);
        c.beginPath(); c.moveTo(30, 76); c.lineTo(84, 76); c.stroke(); c.setLineDash([]);
        return;
    }
    let seed = 1;
    for (let i = 0; i < it.id.length; i++) seed = (seed * 31 + it.id.charCodeAt(i)) >>> 0;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (const l of layers) {
        const n = Math.min(26, 8 + Math.round(l.rate / 5));
        for (let i = 0; i < n; i++) {
            const t = (i + rnd() * 0.9) / n;                       // 0 — у ботинка, 1 — далеко
            const x = 30 + t * 58 + (rnd() - 0.5) * 6;
            const lift = (l.gravity && l.gravity[1] > 0 ? 1 : l.gravity && l.gravity[1] < -25 ? -0.4 : 0.3);
            const y = 72 - Math.sin(t * 2.4) * 14 * lift * (1 + rnd() * 0.5) + (rnd() - 0.5) * 12 - (lift > 0 ? t * 14 : t * 6);
            const sz = (l.size[0] + rnd() * (l.size[1] - l.size[0])) * (0.5 + 0.9 * (1 - t) * 0.6 + 0.35) * 1.55;
            let col = l.grad ? gsGradAt(l.grad, t) : gsMixHex(l.color, l.color2 || l.color, rnd());
            if (l.blend === 'standard' && l.tex !== 'bubble' && l.tex !== 'cloud') c.globalCompositeOperation = 'source-over'; else c.globalCompositeOperation = 'lighter';
            c.globalAlpha = (l.alpha != null ? l.alpha : 1) * (1 - t * 0.55);
            c.save();
            c.translate(x, y); c.rotate(l.spin ? (rnd() - 0.5) * 3 : 0);
            c.drawImage(gsTint(l.tex, col), -sz / 2, -sz / 2, sz, sz);
            c.restore();
        }
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
}

function gsPrevStream(/** @type {CanvasRenderingContext2D} */ c, /** @type {any} */ it) {
    // носик пылесоса слева, струя втягивается в него
    const t = 0;
    const base = it.color != null ? it.color : 0x9fd8ff;
    const hex = (/** @type {number} */ v) => '#' + (v & 0xffffff).toString(16).padStart(6, '0');
    const stops = it.rainbow ? [0, 0.17, 0.34, 0.5, 0.67, 0.84, 1].map((p) => hex(GameLook.hsv(p, 0.85, 1)))
        : it.cycle ? it.cycle.map(hex).concat([hex(it.cycle[0])]) : [hex(base), hex(base)];
    const g = c.createLinearGradient(72, 0, 22, 0);
    stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s));
    c.globalCompositeOperation = 'lighter';
    for (let layer = 0; layer < 3; layer++) {
        c.globalAlpha = 0.28 - layer * 0.06;
        c.fillStyle = g;
        const spread = 15 + layer * 7;
        c.beginPath(); c.moveTo(24, 48 - 4); c.quadraticCurveTo(52, 48 - spread * 0.5, 92, 48 - spread); c.lineTo(92, 48 + spread); c.quadraticCurveTo(52, 48 + spread * 0.5, 24, 48 + 4); c.closePath(); c.fill();
    }
    // полосы потока
    c.globalAlpha = 0.55; c.lineWidth = 1.6; c.lineCap = 'round';
    for (let i = -3; i <= 3; i++) {
        c.strokeStyle = stops[Math.abs(i) % stops.length];
        c.beginPath(); c.moveTo(26, 48 + i * 1.2); c.bezierCurveTo(48, 48 + i * 3, 66, 48 + i * 6 + (i % 2 ? 3 : -3), 90, 48 + i * 7); c.stroke();
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    // сопло
    c.fillStyle = '#6b7384'; c.strokeStyle = '#10142e'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(4, 41); c.lineTo(20, 36); c.lineTo(20, 60); c.lineTo(4, 55); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#4a5368'; c.fillRect(0, 42, 6, 12);
    // кольцо подсветки сопла
    const rim = it.rim != null ? hex(it.rim) : '#d8e4f2';
    c.shadowColor = it.color != null || it.cycle || it.rainbow ? rim : 'rgba(0,0,0,0)'; c.shadowBlur = 8;
    c.strokeStyle = rim; c.lineWidth = 3; c.beginPath(); c.ellipse(21, 48, 4, 13, 0, 0, 6.3); c.stroke(); c.shadowBlur = 0;
    if (it.sparks) {
        const sp = it.sparks;
        let seed = 7;
        const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
        c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 9; i++) { const x = 26 + rnd() * 50, y = 48 + (rnd() - 0.5) * 34, sz = 7 + rnd() * 7; c.drawImage(gsTint(sp.tex, gsMixHex(sp.color, sp.color2 || sp.color, rnd())), x - sz / 2, y - sz / 2, sz, sz); }
        c.globalCompositeOperation = 'source-over';
    }
    void t;
}
