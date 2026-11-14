// GameCodexUI.js — окно «Кодекс Луны» и всплывающая карточка находки. Данные и правила — в GameCodex.js.
// Окно оформлено как остальные окна игры и переиспользует классы GameHud.js (gh-ov, gh-win, gh-ribbon, gh-x, gh-btn,
// gh-t, gh-n, gh-wb): GameHud.init должен быть вызван РАНЬШЕ (он вставляет их CSS). Свои классы — с префиксом gc-.
// Игра: GameCodexUI.init({ onOpen, onClose, onCoins(n), onEvent(name) }); open() — окно (на время окна игра ставит паузу
// через onOpen/onClose); popup(GameCodex.grant(id)) — карточка находки во время игры.
// onEvent: 'open' | 'close' | 'detail' | 'claim'. Монеты в карточке — res.coins как есть (множитель сектора игра может
// подставить в копию res сама). Из файлов использует только иконки находок и ic_close.webp (крестик, как у всех окон).

Object.assign(LANG_STRINGS.ru, {
    'gc.title': 'КОДЕКС ЛУНЫ', 'gc.open': 'Кодекс', 'gc.claim': 'Забрать награду {n}', 'gc.claimed': 'Получено',
    'gc.new': 'НОВОЕ', 'gc.newFind': 'НОВАЯ НАХОДКА!', 'gc.unknown': '???', 'gc.hintSector': 'Сектор {n}: {name}',
    'gc.hintSectors': 'Секторы {list}', 'gc.hintAny': 'Любой сектор', 'gc.coins': '+{n} монет', 'gc.times': '×{n}',
    'gc.foundTimes': 'Найдено раз: {n}', 'gc.where': 'Где искать: {hint}', 'gc.notFound': 'Ещё не найдено. Пылесось грязь — и что-нибудь да выпадет!',
    'gc.ok': 'Понятно', 'gc.close': 'Закрыть', 'gc.reward': 'Награда',
});
Object.assign(LANG_STRINGS.en, {
    'gc.title': 'MOON CODEX', 'gc.open': 'Codex', 'gc.claim': 'Claim reward {n}', 'gc.claimed': 'Claimed',
    'gc.new': 'NEW', 'gc.newFind': 'NEW FIND!', 'gc.unknown': '???', 'gc.hintSector': 'Sector {n}: {name}',
    'gc.hintSectors': 'Sectors {list}', 'gc.hintAny': 'Any sector', 'gc.coins': '+{n} coins', 'gc.times': '×{n}',
    'gc.foundTimes': 'Times found: {n}', 'gc.where': 'Where to look: {hint}', 'gc.notFound': 'Not found yet. Vacuum up the dirt and something will turn up!',
    'gc.ok': 'Got it', 'gc.close': 'Close', 'gc.reward': 'Reward',
});

const GC_CSS = `
.gc-wl,.gc-pl{--rb:linear-gradient(90deg,#ff3d8b,#ffb36b,#ffe36a,#6bffd5,#6bb6ff,#c46bff,#ff3d8b,#ffb36b,#ffe36a,#6bffd5,#6bb6ff,#c46bff,#ff3d8b)}
.gc-pl{z-index:60}
.gc-ov{font-size:clamp(11px,min(3.4vh,4.2vw),17px)}
.gc-win{width:min(58em,100%);height:100%;max-height:min(100%,50em)}
.gc-win .gh-wb{touch-action:pan-y}
.gc-win .gh-x{width:max(2.4em,44px);height:max(2.4em,44px)}
.gc-head{flex:none;display:flex;align-items:center;gap:.8em;padding:.1em .3em .6em}
.gc-pt{font-size:1.5em;white-space:nowrap}
.gc-bar{flex:1;height:1.5em;border:.18em solid var(--ink);border-radius:999px;background:#0d1230;overflow:hidden;box-shadow:inset 0 .15em 0 rgba(0,0,0,.4),0 .18em 0 var(--ink)}
.gc-bar i{display:block;height:100%;min-width:0;border-radius:999px;background:linear-gradient(180deg,#ffe36a,#ffb02e 55%,#e68a10);transition:width .4s}
.gc-sec{margin:0 0 1.2em}
.gc-sh{display:flex;align-items:center;flex-wrap:wrap;gap:.4em .7em;margin:.2em .1em .7em}
.gc-sn.gh-t{font-size:1.35em;color:var(--rc)}
.gc-sn.gc-hue{animation:gc-hue 4s linear infinite}
.gc-sc.gh-t{font-size:1.05em}
.gc-sp{flex:1 1 .5em}
.gc-claim{min-height:max(2.6em,44px);padding:.3em .9em;font-size:.95em}
.gc-claim .gh-t{font-size:1em}
.gc-claim:disabled{cursor:default;filter:saturate(.55);opacity:.7;transform:none}
.gc-done{display:inline-flex;align-items:center;min-height:max(2.2em,44px);padding:0 1em;border:.17em solid var(--ink);border-radius:999px;background:linear-gradient(180deg,#46c25a,#23813a);box-shadow:inset 0 .13em 0 rgba(255,255,255,.3),0 .2em 0 var(--ink);font-size:.95em}
.gc-coin{display:inline-block;flex:none;width:1.05em;height:1.05em;margin-right:.3em;vertical-align:-.15em;border:.14em solid var(--ink);border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff3a0,#ffc21a 55%,#e68a10)}
.gc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,8.6em),1fr));gap:.9em .8em;padding:.2em .25em .5em}
/* рамка: плитка, карточка находки, всплывающая карточка */
.gc-fr{--bg:linear-gradient(180deg,#fff,#e4e9ff);--gl:rgba(0,0,0,0);position:relative;border:.2em solid var(--rc);border-radius:1em;background:var(--bg);box-shadow:inset 0 .15em 0 rgba(255,255,255,.7),0 0 0 .13em var(--ink),0 .3em 0 .13em var(--ink),0 0 0 .1em var(--gl)}
.gc-fr.gc-r-legendary{--gl:rgba(255,194,26,.85);animation:gc-glow 2.2s ease-in-out infinite}
.gc-fr.gc-r-mythic{--gl:rgba(255,61,139,.85);border-color:transparent;background:var(--bg) padding-box,var(--rb) border-box;background-size:auto,200% 100%;animation:gc-rb 3s linear infinite,gc-glow 2s ease-in-out infinite}
.gc-fr.gc-r-legendary::after,.gc-fr.gc-r-mythic::after{content:'';position:absolute;top:-20%;bottom:-20%;left:-60%;width:36%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.7),transparent);transform:skewX(-20deg);animation:gc-sweep 2.8s ease-in-out infinite;pointer-events:none}
.gc-clip{overflow:hidden}
@keyframes gc-rb{from{background-position:0 0,0% 0}to{background-position:0 0,100% 0}}
@keyframes gc-glow{0%,100%{box-shadow:inset 0 .15em 0 rgba(255,255,255,.7),0 0 0 .13em var(--ink),0 .3em 0 .13em var(--ink),0 0 0 rgba(0,0,0,0)}50%{box-shadow:inset 0 .15em 0 rgba(255,255,255,.7),0 0 0 .13em var(--ink),0 .3em 0 .13em var(--ink),0 0 1.1em .25em var(--gl)}}
@keyframes gc-sweep{0%,55%{left:-60%}100%{left:130%}}
@keyframes gc-hue{0%,100%{color:#ff3d8b}20%{color:#ffb36b}40%{color:#ffe36a}60%{color:#6bffd5}80%{color:#c46bff}}
@keyframes gc-spin{to{transform:rotate(1turn)}}
@keyframes gc-twinkle{0%,100%{filter:drop-shadow(0 0 .1em rgba(255,61,139,.4)) brightness(1)}50%{filter:drop-shadow(0 0 .5em rgba(255,140,200,1)) brightness(1.18)}}
.gc-tile{display:flex;flex-direction:column;align-items:center;gap:.2em;width:100%;min-height:max(44px,9.8em);padding:.5em .35em .6em;margin:0;font:inherit;color:#1b2250;cursor:pointer;text-align:center;overflow:hidden;touch-action:manipulation;transition:transform .08s;outline:none}
.gc-tile:active{transform:translateY(.2em)}
.gc-tile:focus-visible{outline:.2em solid #fff;outline-offset:.25em}
.gc-ic{position:relative;width:76%;aspect-ratio:1}
.gc-ic img,.gc-dic img,.gc-pic img{position:relative;width:100%;height:100%;object-fit:contain}
.gc-nm{font-size:.9em;line-height:1.12;display:flex;align-items:center;justify-content:center;min-height:2.24em;word-break:break-word}
.gc-hint{font-size:.7em;line-height:1.2;font-weight:700;color:#3a4274}
.gc-cnt{position:absolute;right:.35em;top:.25em;font-size:.8em;color:#fff}
.gc-newb{position:absolute;left:-1.7em;top:.55em;width:6em;padding:.1em 0 .2em;transform:rotate(-38deg);background:linear-gradient(180deg,#ff7a7a,#e23636);border-top:.13em solid var(--ink);border-bottom:.13em solid var(--ink);font-size:.62em;text-align:center;z-index:2;animation:gh-pulse .9s ease-in-out infinite}
.gc-fr.gc-lock{--bg:linear-gradient(180deg,#b3badf,#8f98c8);--rc:#5b6498}
.gc-lock .gc-ic img,.gc-lock.gc-dcard .gc-dic img{filter:url(#gc-sil) brightness(0) opacity(.45)}
.gc-lock .gc-nm{color:#3a4274}
.gc-r-mythic .gc-ic img,.gc-r-mythic .gc-dic img,.gc-r-mythic .gc-pic img{animation:gc-twinkle 1.8s ease-in-out infinite}
.gc-rays{position:absolute;inset:-38%;border-radius:50%;background:repeating-conic-gradient(var(--rc) 0 7deg,transparent 7deg 22deg);opacity:.5;-webkit-mask-image:radial-gradient(circle,#000 22%,transparent 66%);mask-image:radial-gradient(circle,#000 22%,transparent 66%);animation:gc-spin 14s linear infinite;pointer-events:none}
.gc-r-mythic .gc-rays{animation:gc-spin 14s linear infinite,gc-hue2 5s linear infinite}
@keyframes gc-hue2{to{filter:hue-rotate(360deg)}}
/* карточка находки */
.gc-det{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;padding:.8em;background:rgba(6,8,28,.72);animation:gh-fade .15s both}
.gc-dcard{--bg:linear-gradient(180deg,#252d6e,#141a3a);width:min(23em,100%);max-height:100%;overflow:hidden;display:flex;flex-direction:column;align-items:center;gap:.8em;padding:1em 1em 1.1em;text-align:center;color:#fff;animation:gh-pop .3s cubic-bezier(.2,1.5,.4,1) both}
.gc-dcard.gc-lock{--bg:linear-gradient(180deg,#2c3470,#1b2250)}
.gc-dic{position:relative;flex:none;width:9em;height:9em}
.gc-dtx{display:flex;flex-direction:column;align-items:center;gap:.35em;min-width:0}
.gc-dr.gh-t{font-size:.95em;color:var(--rc)}
.gc-dn.gh-t{font-size:1.45em}
.gc-dd{font-size:.95em;line-height:1.3;font-weight:700;color:#d9defa}
.gc-df{font-size:.85em;line-height:1.25;font-weight:800;color:#ffe36a}
.gc-dok{min-height:max(2.6em,44px);min-width:8em;margin-top:.3em}
@media (max-height:480px) and (min-aspect-ratio:1/1){
  .gc-dcard{width:min(34em,100%);flex-direction:row;text-align:left;padding:.8em 1em}
  .gc-dtx{align-items:flex-start}
  .gc-dic{width:7.5em;height:7.5em}
}
/* всплывающая карточка */
.gc-pw{position:absolute;font-size:clamp(11px,min(2.6vh,3.6vw),17px);width:min(19em,calc(100vw - 16px));pointer-events:none}
.gc-pw.big{width:min(22em,calc(100vw - 16px))}
.gc-pw{animation:gc-in .45s cubic-bezier(.2,1.2,.4,1) both}
.gc-pw.port{left:0;right:0;margin:0 auto;animation-name:gc-inp}
.gc-pw.out{animation:gc-out .3s ease-in both}
.gc-pw.port.out{animation-name:gc-outp}
.gc-pop{--bg:linear-gradient(180deg,#252d6e,#141a3a);display:flex;align-items:center;gap:.7em;padding:.6em .9em .6em .6em;pointer-events:none}
.gc-pop.new{padding:1.2em 1em .8em .8em;gap:.9em}
.gc-pop.new .gc-pic{width:5.2em;height:5.2em}
.gc-pop.new .gc-pn{font-size:1.25em}
.gc-pic{position:relative;flex:none;width:3.8em;height:3.8em}
.gc-pic img{animation:none}
.gc-pop.new .gc-pic img{animation:gh-boom .6s .1s both}
.gc-pt2{position:relative;min-width:0;display:flex;flex-direction:column;gap:.15em}
.gc-pn.gh-t{font-size:1.1em;line-height:1.15}
.gc-pr.gh-t{font-size:.85em;color:var(--rc)}
.gc-pc.gh-t{font-size:1em;color:#ffe35a}
.gc-prb{position:absolute;left:50%;top:-1.1em;transform:translateX(-50%);padding:.15em 1em .3em;border:.17em solid var(--ink);border-radius:.75em;background:linear-gradient(180deg,#ffd75a,#ff9a1f);box-shadow:inset 0 .12em 0 rgba(255,255,255,.4),0 .2em 0 var(--ink);font-size:.95em;white-space:nowrap;z-index:2}
.gc-flash{position:absolute;inset:-.3em;border-radius:1.1em;background:#fff;opacity:0;pointer-events:none;animation:gc-flash .7s ease-out}
@keyframes gc-flash{0%{opacity:.95}100%{opacity:0}}
@keyframes gc-in{0%{opacity:0;transform:translateX(70%) scale(.85)}60%{opacity:1;transform:translateX(-4%) scale(1.04)}100%{opacity:1;transform:none}}
@keyframes gc-inp{0%{opacity:0;transform:translateY(-70%) scale(.85)}60%{opacity:1;transform:translateY(4%) scale(1.04)}100%{opacity:1;transform:none}}
@keyframes gc-out{to{opacity:0;transform:translateX(40%) scale(.9)}}
@keyframes gc-outp{to{opacity:0;transform:translateY(-40%) scale(.9)}}
.gc-fl{position:fixed;z-index:95;pointer-events:none;font-size:clamp(18px,3.2vh,28px);white-space:nowrap;animation:gh-float 1.1s ease-out forwards}
.gc-fl .gh-t{color:#ffe35a}
`;

/** @type {any} */
const GCU = {
    inited: false, h: {}, wl: null, pl: null, ov: null, win: null, body: null, det: null,
    newSet: {}, queue: [], showing: false, timers: [],
};

const gcEsc = (/** @type {any} */ s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const gcFmt = (/** @type {number} */ n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const gcT = (/** @type {string} */ k, /** @type {any} */ p = undefined) => Lang.t(k, p);
const gcEl = (/** @type {string} */ tag, /** @type {string} */ cls, /** @type {string} */ html = undefined) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return /** @type {any} */ (e);
};
const gcCall = (/** @type {string} */ name, /** @type {any[]} */ ...args) => {
    const f = GCU.h && GCU.h[name];
    if (typeof f === 'function') { try { f(...args); } catch (e) { console.error('GameCodexUI.' + name, e); } }
};
/** Редкость из результата grant (запись или id). */
const gcRar = (/** @type {any} */ r, /** @type {any} */ item) => (r && typeof r === 'object' ? r : GameCodex.rarity(typeof r === 'string' ? r : item.rarity));
const gcRarIdx = (/** @type {any} */ r) => GameCodex.RARITIES.findIndex(x => x.id === r.id);
/** Подсказка, где искать находку. */
const gcHint = (/** @type {any} */ item) => {
    const s = item.sectors;
    if (!s || s.length >= 5) return gcT('gc.hintAny');
    if (s.length === 1) {
        const lv = typeof GameData !== 'undefined' && GameData.LEVELS ? GameData.LEVELS[s[0]] : null;
        const name = lv ? (lv.name[Lang.code] || lv.name.en) : '';
        return gcT('gc.hintSector', { n: s[0] + 1, name });
    }
    return gcT('gc.hintSectors', { list: s.map((/** @type {number} */ x) => x + 1).join(', ') });
};

/** @satisfies {Record<string, any>} */
const GameCodexUI = {
    isOpen: false,

    /** h: { onOpen(), onClose(), onCoins(n), onEvent(name) } — все необязательны. */
    init(h) {
        GCU.h = h || {};
        if (GCU.inited) return;
        GCU.inited = true;
        const st = document.createElement('style');
        st.id = 'gc-css';
        st.textContent = GC_CSS;
        document.head.appendChild(st);
        // порог по альфе для силуэта ненайденной находки (убирает свечение, оставляет форму предмета)
        const svg = gcEl('div', '', '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="gc-sil" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncA type="discrete" tableValues="0 0 0 0 0 0 0 1 1 1"/></feComponentTransfer></filter></svg>');
        document.body.appendChild(svg);
        GCU.wl = gcEl('div', 'gh-wl gc-wl');
        GCU.pl = gcEl('div', 'gh-wl gc-pl');
        document.body.appendChild(GCU.wl);
        document.body.appendChild(GCU.pl);
        GCU.wl.addEventListener('pointerdown', e => e.stopPropagation());
        // Esc: сначала карточка находки, потом окно; GameHud не должен открыть паузу под кодексом
        window.addEventListener('keydown', e => {
            if (e.key !== 'Escape' || !GameCodexUI.isOpen) return;
            e.preventDefault(); e.stopPropagation();
            if (e.repeat) return;
            if (GCU.det) GameCodexUI._closeDetail(); else GameCodexUI.close();
        }, true);
    },

    open() {
        if (!GCU.inited) GameCodexUI.init({});
        if (GameCodexUI.isOpen) return;
        GameCodexUI.isOpen = true;
        gcCall('onOpen');
        gcCall('onEvent', 'open');
        const ov = GCU.ov = gcEl('div', 'gh-ov gc-ov');
        const win = GCU.win = gcEl('div', 'gh-win gc-win');
        win.style.setProperty('--c1', '#c58bff'); win.style.setProperty('--c2', '#8a3df0');
        win.innerHTML = '<div class="gh-ribbon"><span class="gh-t">' + gcEsc(gcT('gc.title')) + '</span></div>' +
            '<button type="button" class="gh-btn r gh-x" aria-label="' + gcEsc(gcT('gc.close')) + '"><img src="assets/ui/ic_close.webp" alt="" draggable="false"></button>' +
            '<div class="gc-head"></div><div class="gh-wb"></div>';
        ov.appendChild(win);
        GCU.wl.appendChild(ov);
        GCU.body = win.querySelector('.gh-wb');
        ov.addEventListener('click', e => { if (e.target === ov) GameCodexUI.close(); });
        /** @type {any} */ (win.querySelector('.gh-x')).addEventListener('click', () => GameCodexUI.close());
        GCU.newSet = {};
        for (const it of GameCodex.ITEMS) if (GameCodex.isNew(it.id)) GCU.newSet[it.id] = true;
        GameCodexUI._render(0);
        GameCodex.markSeen();
    },

    close() {
        if (!GameCodexUI.isOpen) return;
        GameCodexUI.isOpen = false;
        GameCodexUI._closeDetail();
        if (GCU.ov && GCU.ov.parentNode) GCU.ov.parentNode.removeChild(GCU.ov);
        GCU.ov = GCU.win = GCU.body = null;
        gcCall('onEvent', 'close');
        gcCall('onClose');
    },

    /** Перерисовать открытое окно (после смены языка, новой находки, награды); прокрутка сохраняется. */
    refresh() {
        if (!GameCodexUI.isOpen || !GCU.body) return;
        for (const it of GameCodex.ITEMS) if (GameCodex.isNew(it.id)) GCU.newSet[it.id] = true;
        GameCodexUI._render(GCU.body.scrollTop);
        GameCodex.markSeen();
    },

    _render(scroll) {
        const body = GCU.body, win = GCU.win;
        const found = GameCodex.foundTotal(), total = GameCodex.ITEMS.length;
        win.querySelector('.gc-head').innerHTML = '<span class="gc-pt gh-t">' + found + ' / ' + total + '</span>' +
            '<div class="gc-bar"><i style="width:' + (total ? Math.round(found / total * 100) : 0) + '%"></i></div>';
        const claimable = GameCodex.claimable();
        let html = '';
        for (const r of GameCodex.RARITIES) {
            const p = GameCodex.progress(r.id);
            let act;
            if (GameCodex.isClaimed(r.id)) act = '<span class="gc-done gh-t">' + gcEsc(gcT('gc.claimed')) + '</span>';
            else if (claimable.indexOf(r.id) >= 0) act = '<button type="button" class="gh-btn o gc-claim gh-pulse" data-claim="' + r.id + '"><span class="gc-coin"></span><span class="gh-t">' + gcEsc(gcT('gc.claim', { n: gcFmt(r.reward) })) + '</span></button>';
            else act = '<button type="button" class="gh-btn x gc-claim" disabled><span class="gc-coin"></span><span class="gh-t">' + gcEsc(gcT('gc.claim', { n: gcFmt(r.reward) })) + '</span></button>';
            html += '<section class="gc-sec" style="--rc:' + r.color + '"><div class="gc-sh"><span class="gc-sn gh-t' + (r.id === 'mythic' ? ' gc-hue' : '') + '">' + gcEsc(GameCodex.rarityName(r)) +
                '</span><span class="gc-sc gh-t">' + p.found + '/' + p.total + '</span><span class="gc-sp"></span>' + act + '</div><div class="gc-grid">';
            for (const it of GameCodex.list(r.id)) html += GameCodexUI._tile(it, r);
            html += '</div></section>';
        }
        body.innerHTML = html;
        body.scrollTop = scroll || 0;
        body.onclick = (/** @type {any} */ e) => {
            const cl = e.target.closest('[data-claim]');
            if (cl) { GameCodexUI._claim(cl.dataset.claim, cl); return; }
            const t = e.target.closest('[data-id]');
            if (t) GameCodexUI._detail(t.dataset.id);
        };
    },

    _tile(it, r) {
        const n = GameCodex.count(it.id), isNew = !!GCU.newSet[it.id];
        if (n > 0) {
            return '<button type="button" class="gc-tile gc-fr gc-r-' + r.id + '" data-id="' + it.id + '" style="--rc:' + r.color + '" aria-label="' + gcEsc(GameCodex.name(it)) + '">' +
                '<span class="gc-ic"><img src="' + gcEsc(it.icon) + '" alt="" draggable="false"></span>' +
                '<span class="gc-nm gh-n">' + gcEsc(GameCodex.name(it)) + '</span>' +
                '<span class="gc-cnt gh-t" style="color:' + r.color + '">' + gcEsc(gcT('gc.times', { n })) + '</span>' +
                (isNew ? '<span class="gc-newb gh-t">' + gcEsc(gcT('gc.new')) + '</span>' : '') + '</button>';
        }
        return '<button type="button" class="gc-tile gc-fr gc-lock" data-id="' + it.id + '" style="--rc:#5b6498" aria-label="' + gcEsc(gcT('gc.unknown')) + '">' +
            '<span class="gc-ic"><img src="' + gcEsc(it.icon) + '" alt="" draggable="false"></span>' +
            '<span class="gc-nm gh-n">' + gcEsc(gcT('gc.unknown')) + '</span>' +
            '<span class="gc-hint">' + gcEsc(gcHint(it)) + '</span></button>';
    },

    _claim(rid, btn) {
        const res = GameCodex.claim(rid);
        if (!res.ok) return;
        const rc = btn.getBoundingClientRect();
        const fl = gcEl('div', 'gc-fl', '<span class="gh-t">+' + gcFmt(res.coins) + '</span>');
        fl.style.left = (rc.left + rc.width / 2) + 'px';
        fl.style.top = (rc.top + rc.height / 2) + 'px';
        document.body.appendChild(fl);
        setTimeout(() => { if (fl.parentNode) fl.parentNode.removeChild(fl); }, 1200);
        gcCall('onCoins', res.coins);
        gcCall('onEvent', 'claim');
        GameCodexUI.refresh();
    },

    _detail(id) {
        const it = GameCodex.item(id);
        if (!it || !GCU.ov) return;
        GameCodexUI._closeDetail();
        const r = GameCodex.rarity(it.rarity), n = GameCodex.count(id), got = n > 0, idx = gcRarIdx(r);
        const det = GCU.det = gcEl('div', 'gc-det');
        det.innerHTML = '<div class="gc-dcard gc-fr ' + (got ? 'gc-clip gc-r-' + r.id : 'gc-lock') + '" style="--rc:' + r.color + '">' +
            '<div class="gc-dic">' + (got && idx >= 3 ? '<div class="gc-rays"></div>' : '') + '<img src="' + gcEsc(it.icon) + '" alt="" draggable="false"></div>' +
            '<div class="gc-dtx"><div class="gc-dr gh-t">' + gcEsc(GameCodex.rarityName(r)) + '</div>' +
            '<div class="gc-dn gh-t">' + gcEsc(got ? GameCodex.name(it) : gcT('gc.unknown')) + '</div>' +
            '<div class="gc-dd">' + gcEsc(got ? GameCodex.desc(it) : gcT('gc.notFound')) + '</div>' +
            '<div class="gc-df">' + gcEsc(got ? gcT('gc.foundTimes', { n }) : gcT('gc.where', { hint: gcHint(it) })) + '</div>' +
            '<button type="button" class="gh-btn b gc-dok"><span class="gh-t">' + gcEsc(gcT('gc.ok')) + '</span></button></div></div>';
        det.addEventListener('click', e => { if (e.target === det || /** @type {any} */ (e.target).closest('.gc-dok')) GameCodexUI._closeDetail(); });
        GCU.ov.appendChild(det);
        gcCall('onEvent', 'detail');
    },

    _closeDetail() {
        if (GCU.det && GCU.det.parentNode) GCU.det.parentNode.removeChild(GCU.det);
        GCU.det = null;
    },

    // =====================================================================================
    // Всплывающая карточка находки
    // =====================================================================================
    /** res — результат GameCodex.grant: { item, rarity, isNew, count, coins }. Карточки идут по очереди. */
    popup(res) {
        if (!res || !res.item) return;
        if (!GCU.inited) GameCodexUI.init({});
        GCU.queue.push(res);
        if (!GCU.showing) GameCodexUI._next();
    },

    _next() {
        const res = GCU.queue.shift();
        if (!res) { GCU.showing = false; return; }
        GCU.showing = true;
        const item = res.item, r = gcRar(res.rarity, item), idx = gcRarIdx(r), isNew = !!res.isNew, rare = idx >= 2;
        const big = isNew || rare;
        const w = gcEl('div', 'gc-pw' + (big ? ' big' : ''));
        const pop = gcEl('div', 'gc-pop gc-fr gc-r-' + r.id + (isNew ? ' new' : '') + (idx >= 3 ? ' rays' : ''));
        pop.style.setProperty('--rc', r.color);
        pop.innerHTML = (isNew ? '<div class="gc-prb gh-t">' + gcEsc(gcT('gc.newFind')) + '</div>' : '') +
            '<div class="gc-pic">' + (idx >= 3 ? '<div class="gc-rays"></div>' : '') + '<img src="' + gcEsc(item.icon) + '" alt="" draggable="false"></div>' +
            '<div class="gc-pt2"><div class="gc-pn gh-t">' + gcEsc(GameCodex.name(item)) + '</div>' +
            '<div class="gc-pr gh-t">' + gcEsc(GameCodex.rarityName(r)) + '</div>' +
            '<div class="gc-pc gh-t"><span class="gc-coin"></span>' + gcEsc(gcT('gc.coins', { n: gcFmt(res.coins || 0) })) + '</div></div>' +
            (isNew ? '<div class="gc-flash"></div>' : '');
        w.appendChild(pop);
        GCU.pl.appendChild(w);
        GameCodexUI._place(w);
        let dur = big ? 3500 : 2200;
        if (GCU.queue.length >= 3) dur = Math.max(1400, dur * 0.6);
        setTimeout(() => w.classList.add('out'), dur - 320);
        setTimeout(() => { if (w.parentNode) w.parentNode.removeChild(w); GameCodexUI._next(); }, dur);
    },

    /** У правого края под монетами и звёздами; в портрете — по центру под полосой чистоты. */
    _place(w) {
        const rect = (/** @type {string} */ id) => {
            const e = document.getElementById(id);
            const r = e ? e.getBoundingClientRect() : null;
            return r && r.width > 0 ? r : null;
        };
        const port = window.innerHeight > window.innerWidth;
        w.classList.toggle('port', port);
        if (port) {
            // под полосой чистоты, монетами и звёздами; левее — колонка кнопок HUD (если она ниже края карточки, не мешает)
            const t = rect('gh-top'), c = rect('gh-coins'), s = rect('gh-stars'), sd = rect('gh-side');
            const top = Math.max(t ? t.bottom : 0, c ? c.bottom : 0, s ? s.bottom : 0, 76) + 8;
            w.style.top = top + 'px';
            const ml = sd && sd.right < window.innerWidth * 0.4 && sd.bottom > top ? sd.right + 6 : 8;
            w.style.left = ml + 'px'; w.style.right = '8px'; w.style.width = 'auto'; w.style.maxWidth = '22em';
        } else {
            const c = rect('gh-coins'), s = rect('gh-stars');
            const bottom = Math.max(c ? c.bottom : 0, s ? s.bottom : 0) || 100;
            w.style.top = (bottom + 8) + 'px';
            w.style.right = Math.max(8, c ? window.innerWidth - c.right : 12) + 'px';
        }
    },
};
