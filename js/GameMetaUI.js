// GameMetaUI.js — окна «Подарок дня» и «Колесо фортуны» в стиле интерфейса GameHud (его классы окна, ленты-заголовка,
// кнопок и красного крестика; свои классы — с префиксом gm-). Логика — модули движка DailyGift и Wheel (их init зовёт игра):
// пока модуль не инициализирован, окно не открывается. Подарок: 7 плиток дней, «Забрать» и «x2 за рекламу», анимация награды.
// Колесо: диск на <canvas>, результат выбирается ДО анимации (Wheel.spinFree / spinAd), диск докручивается до Wheel.angleFrom
// ~5 с с замедлением, затем Wheel.finish() и карточка приза. Во время вращения кнопки, крестик, клик по фону и Esc заблокированы.
// GameMetaUI.init(h): h = { onOpen(name), onClose(), onCoins(), onEvent(name) } — все необязательны; onEvent для звуков:
// 'open' | 'close' | 'claim' | 'spin' | 'prize'. Загружается после GameHud.js (берёт его стили и помощники).

Object.assign(LANG_STRINGS.ru, {
    'gm.daily': 'Подарок дня', 'gm.wheel': 'Колесо фортуны', 'gm.got': 'Ты получил!', 'gm.ok': 'Отлично!',
    'gm.random': 'Косметика', 'gm.randomN': 'Косметика x{n}', 'gm.spinAd': 'Крутить за рекламу ({n})', 'gm.spinFree': 'Крутить бесплатно',
    'gm.adFailed': 'Реклама не засчитана — награда не потеряна.', 'gm.busy': 'Крутится…', 'gm.nextGift': 'Следующий подарок через {t}',
    'gm.skin': 'Эксклюзивный скин', 'gm.closeWin': 'Закрыть',
});
Object.assign(LANG_STRINGS.en, {
    'gm.daily': 'Daily gift', 'gm.wheel': 'Wheel of fortune', 'gm.got': 'You got!', 'gm.ok': 'Great!',
    'gm.random': 'Cosmetic', 'gm.randomN': 'Cosmetics x{n}', 'gm.spinAd': 'Spin: watch ad ({n})', 'gm.spinFree': 'Spin for free',
    'gm.adFailed': 'Ad not completed — your reward is safe.', 'gm.busy': 'Spinning…', 'gm.nextGift': 'Next gift in {t}',
    'gm.skin': 'Exclusive skin', 'gm.closeWin': 'Close',
});

const GM_CSS = `
.gm-win{width:min(40em,100%)}
.gm-win .gh-wb{padding-top:.5em}
.gm-days{display:grid;grid-template-columns:repeat(3,1fr);gap:.9em .7em;padding:.4em .2em .5em}
.gm-day{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.2em;padding:.5em .3em .55em;text-align:center;min-height:6.8em;min-width:0}
.gm-dn{font-size:.82em;font-weight:900;color:#4a5384;line-height:1.1}
.gm-ic{display:flex;align-items:center;justify-content:center;gap:.1em;height:2.7em}
.gm-ic img{width:2.6em;height:2.6em;object-fit:contain}
.gm-dl{font-size:.86em;font-weight:900;color:#1b2250;line-height:1.1;overflow-wrap:anywhere;max-width:100%}
.gm-st{font-size:.68em;font-weight:900;color:#fff;padding:.05em .7em .15em;border:.15em solid var(--ink);border-radius:99px;background:linear-gradient(180deg,#ffc247,#ff8a1f);line-height:1.2}
.gm-day.today{background:linear-gradient(180deg,#fff6cf,#ffe28a);box-shadow:inset 0 .15em 0 #fff,0 .25em 0 var(--ink),0 0 0 .22em #ffc247,0 0 1.1em .3em rgba(255,194,71,.7);animation:gh-pulse 1.3s ease-in-out infinite}
.gm-day.claimed{background:linear-gradient(180deg,#e8ffe0,#b8f59a)}
.gm-day.claimed .gm-ic,.gm-day.claimed .gm-dl{opacity:.55}
.gm-day.tomorrow .gm-st{background:linear-gradient(180deg,#5fd0ff,#2f7bff)}
.gm-day.locked{background:linear-gradient(180deg,#f1f3ff,#d6dcf6)}
.gm-chk{position:absolute;right:-.45em;top:-.55em;width:1.9em;height:1.9em;display:flex;align-items:center;justify-content:center;border:.17em solid var(--ink);border-radius:50%;background:linear-gradient(180deg,#7dff5a,#23c552);box-shadow:0 .15em 0 var(--ink)}
.gm-chk img{width:68%;height:68%}
.gm-day.fresh .gm-chk{animation:gh-boom .6s cubic-bezier(.3,1.4,.5,1) both}
.gm-day7{grid-column:1/-1;flex-direction:row;gap:1em;min-height:7.4em;padding:.6em 1em;background:linear-gradient(180deg,#f6e8ff,#d9bcff)}
.gm-day7.today{background:linear-gradient(180deg,#fff0b8,#ffc96a)}
.gm-day7.claimed{background:linear-gradient(180deg,#e8ffe0,#b8f59a)}
.gm-day7 .gm-ic{height:5em;flex:none;position:relative}
.gm-day7 .gm-ic img{width:4.8em;height:4.8em;animation:gh-glow 1.4s ease-in-out infinite}
.gm-day7 .gm-tx{display:flex;flex-direction:column;align-items:flex-start;gap:.2em;text-align:left;min-width:0}
.gm-day7 .gm-dl{font-size:1.05em}
.gm-day7 .gm-sub{font-size:.75em;font-weight:800;color:#6a3fb0}
.gm-foot{flex:none;display:flex;flex-direction:column;align-items:center;gap:.5em;padding:.6em .3em .1em}
.gm-btns{display:flex;flex-wrap:wrap;gap:.7em;justify-content:center;width:100%}
.gm-btns .gh-btn{flex:1 1 9em;min-height:3em}
.gm-btns .gh-btn .gh-t{font-size:1.05em;white-space:nowrap}
.gm-note{font-size:.85em;font-weight:800;color:#aeb7ee;text-align:center;min-height:1.2em;line-height:1.25}
.gm-wheel{display:flex;flex-direction:column;align-items:center;gap:.7em;padding:.2em .1em .3em}
.gm-disc{position:relative;width:min(100%,21em);aspect-ratio:1;margin-top:1.2em;flex:none}
.gm-disc canvas{position:absolute;inset:0;width:100%;height:100%;display:block;will-change:transform;filter:drop-shadow(0 .3em 0 rgba(0,0,0,.35))}
.gm-ptr{position:absolute;left:50%;top:-1.2em;width:2.6em;height:3em;margin-left:-1.3em;z-index:2;transform-origin:50% 20%;filter:drop-shadow(0 .15em 0 rgba(16,20,46,.7))}
.gm-ptr svg{width:100%;height:100%;display:block}
.gm-ptr.tick{animation:gm-tick .14s ease-out}
@keyframes gm-tick{0%{transform:rotate(-22deg)}100%{transform:rotate(0)}}
.gm-ctl{display:flex;flex-direction:column;align-items:stretch;gap:.6em;width:min(100%,24em)}
.gm-ctl .gh-btn{min-height:3.1em}
.gm-ctl .gh-btn .gh-t{font-size:1.05em;white-space:normal;text-align:center}
.gm-ctl .gm-note{min-height:1.2em}
.gm-pop{position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;padding:2.6em 1em 1em;overflow:auto;background:rgba(6,8,28,.72);animation:gh-fade .2s both;pointer-events:auto}
.gm-popc{position:relative;display:flex;flex-direction:column;align-items:center;gap:.6em;width:min(22em,100%);margin:auto;padding:1.5em 1em 1em;animation:gh-pop .45s cubic-bezier(.2,1.5,.4,1) both;background:linear-gradient(180deg,#252f78,#141a3a);color:#fff;border:.25em solid var(--ink);border-radius:1.3em;box-shadow:inset 0 .2em 0 rgba(255,255,255,.2),0 .5em 0 rgba(0,0,0,.35)}
.gm-popt{font-size:1.4em}
.gm-got{display:flex;flex-wrap:wrap;justify-content:center;gap:.8em;width:100%}
.gm-gi{position:relative;display:flex;flex-direction:column;align-items:center;gap:.2em;min-width:6em;padding:.4em .6em}
.gm-gi .gm-gic{position:relative;width:4.6em;height:4.6em;display:flex;align-items:center;justify-content:center}
.gm-gi img{position:relative;width:100%;height:100%;object-fit:contain;animation:gh-boom .6s cubic-bezier(.3,1.4,.5,1) both}
.gm-gi.coin img{width:78%;height:78%;animation:gh-bump .5s .2s cubic-bezier(.3,1.8,.5,1) both}
.gm-gi .gm-rays{position:absolute;inset:-70%;border-radius:50%;background:repeating-conic-gradient(rgba(255,226,90,.7) 0 9deg,transparent 9deg 18deg);-webkit-mask:radial-gradient(circle,#000 20%,transparent 68%);mask:radial-gradient(circle,#000 20%,transparent 68%);animation:gm-spin 7s linear infinite}
@keyframes gm-spin{to{transform:rotate(360deg)}}
.gm-gi .gh-t{font-size:1.2em;white-space:nowrap}
.gm-gi .gm-gs{font-size:.8em;font-weight:800;color:#aeb7ee;text-align:center;max-width:12em;line-height:1.2}
.gm-x[disabled]{opacity:.45;pointer-events:none}
@media (max-height:640px) and (min-aspect-ratio:3/2){
  .gm-win{width:min(50em,100%)}
  .gm-days{grid-template-columns:repeat(3,1fr) 1.3fr;gap:.8em .6em}
  .gm-day{min-height:5.4em}
  .gm-day7{grid-column:4;grid-row:1/3;flex-direction:column;gap:.3em;padding:.5em .6em}
  .gm-day7 .gm-tx{align-items:center;text-align:center}
  .gm-wheel{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:1.2em;padding-top:.8em}
  .gm-disc{width:14.5em;margin-top:0}
  .gm-ctl{width:100%}
  .gm-popc{padding-top:1.1em}
}
`;

/** Состояние окон. */
/** @type {any} */
const GMU = {
    inited: false, h: {}, wl: null, ov: null, win: null, body: null, foot: null, x: null, popup: null,
    open: '', msg: '', busy: false, spinning: false, angle: 0, timer: 0, sig: '', fresh: -1, imgs: {}, ctl: null, disc: null,
};

const gmT = (/** @type {string} */ k, /** @type {any} */ p = undefined) => Lang.t(k, p);
const gmCall = (/** @type {string} */ name, /** @type {any[]} */ ...args) => {
    const f = GMU.h && GMU.h[name];
    if (typeof f === 'function') { try { f(...args); } catch (e) { console.error('GameMetaUI.' + name, e); } }
};
const gmAdsOk = () => {
    try { return typeof Platform === 'undefined' || typeof Platform.rewardedSupported !== 'function' || !!Platform.rewardedSupported(); } catch (e) { return true; }
};
const gmImg = (/** @type {string} */ src, /** @type {() => void} */ cb) => {
    let im = GMU.imgs[src];
    if (!im) { im = GMU.imgs[src] = new Image(); im.onload = () => { im.ok = true; if (cb) cb(); }; im.src = src; }
    else if (!im.ok && cb) im.addEventListener('load', cb);
    return im;
};
/** Иконка предмета каталога: поле icon/img предмета (путь) или общая иконка косметики. */
const gmItemIcon = (/** @type {string} */ id) => {
    const it = typeof Shop !== 'undefined' && typeof Shop.item === 'function' ? Shop.item(id) : null;
    const v = it && (it.icon || it.img || it.image);
    return typeof v === 'string' && /[\/.]/.test(v) ? v : GH_IC.cosmetics;
};
const gmDailyReady = () => typeof DailyGift !== 'undefined' && DailyGift._rewards && DailyGift._rewards.length > 0;
const gmWheelReady = () => typeof Wheel !== 'undefined' && Wheel._sectors && Wheel._sectors.length >= 2;

/** Картинки и подпись награды дня (плитка). */
const gmDayVisual = (/** @type {any} */ r) => {
    const imgs = [], txt = [];
    if (r.exclusive) { imgs.push(gmItemIcon(r.exclusive)); txt.push(DailyGift.itemName(r.exclusive)); }
    if (r.coins > 0) { imgs.push(GH_IC.coin); txt.push(ghFmt(r.coins)); }
    if (r.item) { imgs.push(gmItemIcon(r.item)); txt.push(DailyGift.itemName(r.item)); }
    if (r.randomItems > 0) { imgs.push(GH_IC.cosmetics); txt.push(r.randomItems > 1 ? gmT('gm.randomN', { n: r.randomItems }) : gmT('gm.random')); }
    return { imgs, text: txt.join(' + ') };
};

/** @satisfies {Record<string, any>} */
const GameMetaUI = {
    /** '' | 'daily' | 'wheel'. */
    isOpen: '',

    init(h) {
        GMU.h = h || {};
        if (GMU.inited) return;
        GMU.inited = true;
        const st = document.createElement('style');
        st.id = 'gm-css';
        st.textContent = GM_CSS;
        document.head.appendChild(st);
        const wl = GMU.wl = document.createElement('div');
        wl.className = 'gh-wl gm-wl';
        wl.style.zIndex = '95';
        document.body.appendChild(wl);
        // нажатия по окну не уходят к игровому вводу (стик, свайп-взгляд)
        wl.addEventListener('pointerdown', (/** @type {any} */ e) => { if (e.target && e.target.closest && e.target.closest('.gh-btn,.gh-ov')) e.stopPropagation(); });
        // Esc: сначала карточка приза, потом окно; во время вращения — ничего. Перехватываем раньше паузы GameHud.
        window.addEventListener('keydown', (/** @type {any} */ e) => {
            if (e.key !== 'Escape' || !GMU.open) return;
            e.preventDefault(); e.stopImmediatePropagation();
            if (e.repeat) return;
            if (GMU.popup) GameMetaUI._closePopup();
            else if (!GMU.spinning && !GMU.busy) GameMetaUI.close();
        }, true);
        if (typeof Platform !== 'undefined' && typeof Platform.onRewardedCooldown === 'function') Platform.onRewardedCooldown(() => GameMetaUI.refresh());
    },

    openDaily() {
        if (!gmDailyReady() || !GMU.inited) return;
        GameMetaUI._shell('daily', gmT('gm.daily'), '#ff9ad5', '#d43fa6', 'gm-daily');
        GMU.sig = ''; GMU.fresh = -1;
        GMU.foot = document.createElement('div');
        GMU.foot.className = 'gm-foot';
        GMU.foot.innerHTML = '<div class="gm-btns"><button type="button" class="gh-btn gm-claim"><span class="gh-t"></span></button>' +
            '<button type="button" class="gh-btn p gm-x2">' + ghImg(GH_IC.ad) + '<span class="gh-t"></span></button></div><div class="gm-note"></div>';
        GMU.win.appendChild(GMU.foot);
        GMU.foot.querySelector('.gm-claim').addEventListener('click', () => GameMetaUI._claim(false));
        GMU.foot.querySelector('.gm-x2').addEventListener('click', () => GameMetaUI._claim(true));
        GameMetaUI._renderDaily();
    },

    openWheel() {
        if (!gmWheelReady() || !GMU.inited) return;
        GameMetaUI._shell('wheel', gmT('gm.wheel'), '#c58bff', '#8a3df0', 'gm-wheelwin');
        const star = '<svg viewBox="0 0 40 48"><path d="M20 46 L4 14 Q20 -6 36 14 Z" fill="#ff4d4d" stroke="#10142e" stroke-width="4.5" stroke-linejoin="round"/><circle cx="20" cy="17" r="5.5" fill="#fff" stroke="#10142e" stroke-width="3"/></svg>';
        GMU.body.innerHTML = '<div class="gm-wheel"><div class="gm-disc"><canvas width="512" height="512"></canvas><div class="gm-ptr">' + star + '</div></div>' +
            '<div class="gm-ctl"><button type="button" class="gh-btn gm-free">' + ghImg(GH_IC.wheel) + '<span class="gh-t"></span></button>' +
            '<button type="button" class="gh-btn p gm-ad">' + ghImg(GH_IC.ad) + '<span class="gh-t"></span></button><div class="gm-note"></div></div></div>';
        GMU.disc = GMU.body.querySelector('canvas');
        GMU.ctl = GMU.body.querySelector('.gm-ctl');
        GMU.body.querySelector('.gm-free').addEventListener('click', () => GameMetaUI._spin('free'));
        GMU.body.querySelector('.gm-ad').addEventListener('click', () => GameMetaUI._spin('ad'));
        GMU.sig = '';
        GameMetaUI._drawWheel();
        GameMetaUI._syncWheel();
        // вращение, не закрытое прошлым запуском (модуль без приёмника или recover: false): доигрываем и выдаём приз один раз
        const pend = typeof Wheel.pendingSpin === 'function' ? Wheel.pendingSpin() : null;
        if (pend) GameMetaUI._animate(pend, true);
    },

    close() {
        if (!GMU.open || GMU.spinning || GMU.busy) return;
        GameMetaUI._closeNow();
    },

    /** Перерисовать открытое окно: подписи пауз, таймеры, состояние кнопок. Пока крутится колесо — не трогает диск. */
    refresh() {
        if (!GMU.open) return;
        if (GMU.open === 'daily') GameMetaUI._renderDaily();
        else GameMetaUI._syncWheel();
    },

    // =====================================================================================
    // Каркас окна
    // =====================================================================================
    _shell(name, title, c1, c2, cls) {
        if (GMU.open) GameMetaUI._closeNow(true);
        const ov = document.createElement('div');
        ov.className = 'gh-ov';
        const win = document.createElement('div');
        win.className = 'gh-win gm-win ' + cls;
        win.style.setProperty('--c1', c1); win.style.setProperty('--c2', c2);
        win.innerHTML = '<div class="gh-ribbon"><span class="gh-t">' + ghEsc(title) + '</span></div>' +
            '<button type="button" class="gh-btn r gh-x gm-x" aria-label="' + ghEsc(gmT('gm.closeWin')) + '">' + ghImg(GH_IC.close) + '</button><div class="gh-wb"></div>';
        ov.appendChild(win);
        GMU.wl.appendChild(ov);
        GMU.ov = ov; GMU.win = win; GMU.body = win.querySelector('.gh-wb'); GMU.x = win.querySelector('.gm-x');
        GMU.open = name; GameMetaUI.isOpen = name; GMU.busy = false; GMU.spinning = false; GMU.popup = null;
        ov.addEventListener('click', (/** @type {any} */ e) => { if (e.target === ov) GameMetaUI.close(); });
        GMU.x.addEventListener('click', () => GameMetaUI.close());
        if (typeof GameHud !== 'undefined' && GameHud.cover) GameHud.cover(true);
        clearInterval(GMU.timer);
        GMU.timer = setInterval(() => GameMetaUI.refresh(), 1000);
        gmCall('onOpen', name);
        gmCall('onEvent', 'open');
    },

    _closeNow(silent) {
        clearInterval(GMU.timer); GMU.timer = 0;
        if (GMU.ov && GMU.ov.parentNode) GMU.ov.parentNode.removeChild(GMU.ov);
        GMU.ov = GMU.win = GMU.body = GMU.foot = GMU.x = GMU.popup = GMU.disc = GMU.ctl = null;
        GMU.open = ''; GameMetaUI.isOpen = '';
        if (silent) return;
        if (typeof GameHud !== 'undefined' && GameHud.cover) GameHud.cover(false);
        gmCall('onClose');
        gmCall('onEvent', 'close');
    },

    _lock(on) {
        if (GMU.x) GMU.x.disabled = !!on;
    },

    /** Карточка награды: got — список из DailyGift/Wheel ({ type: 'coins' | 'item' | 'exclusive', amount, id, converted }). */
    _popup(title, got) {
        GameMetaUI._closePopup();
        if (!GMU.ov) return;
        let items = '';
        for (const g of got || []) {
            if (g.type === 'coins') {
                items += '<div class="gm-gi coin">' + '<div class="gm-gic">' + ghImg(GH_IC.coin) + '</div><span class="gh-t" data-n="' + (g.amount | 0) + '">+0</span>' +
                    (g.converted ? '<span class="gm-gs">' + ghEsc(gmDupNote(g)) + '</span>' : '') + '</div>';
            } else {
                items += '<div class="gm-gi item"><div class="gm-gic"><i class="gm-rays"></i>' + ghImg(gmItemIcon(g.id)) + '</div><span class="gh-t">' + ghEsc(gmItemName(g.id)) + '</span>' +
                    (g.type === 'exclusive' ? '<span class="gm-gs">' + ghEsc(gmT('gm.skin')) + '</span>' : '') + '</div>';
            }
        }
        const pop = document.createElement('div');
        pop.className = 'gm-pop';
        pop.innerHTML = '<div class="gm-popc"><div class="gh-ribbon" style="--c1:#ffc247;--c2:#ff8a1f"><span class="gh-t">' + ghEsc(title) + '</span></div>' +
            '<div class="gm-got">' + items + '</div><button type="button" class="gh-btn big" style="width:100%"><span class="gh-t">' + ghEsc(gmT('gm.ok')) + '</span></button></div>';
        GMU.ov.appendChild(pop);
        GMU.popup = pop;
        for (const n of /** @type {any} */ (pop.querySelectorAll('[data-n]'))) ghCount(n, 0, +n.dataset.n, 800, '+');
        pop.querySelector('.gh-btn').addEventListener('click', () => GameMetaUI._closePopup());
    },

    _closePopup() {
        if (GMU.popup && GMU.popup.parentNode) GMU.popup.parentNode.removeChild(GMU.popup);
        GMU.popup = null;
    },

    // =====================================================================================
    // Подарок дня
    // =====================================================================================
    _renderDaily() {
        if (GMU.open !== 'daily' || !GMU.body) return;
        const v = DailyGift.view();
        const sig = v.days.map((/** @type {any} */ d) => d.state + ':' + d.label).join('|') + '#' + (v.goal || '');
        if (sig !== GMU.sig) {
            GMU.sig = sig;
            let html = '<div class="gm-days">';
            for (const d of v.days) {
                const vis = gmDayVisual(d.reward || {});
                const imgs = vis.imgs.map((/** @type {string} */ s) => ghImg(s)).join('');
                const fresh = d.day === GMU.fresh ? ' fresh' : '';
                const chk = d.state === 'claimed' ? '<span class="gm-chk">' + ghImg(GH_IC.check) + '</span>' : '';
                const tag = d.state === 'today' || d.state === 'tomorrow' ? '<span class="gm-st">' + ghEsc(d.stateLabel) + '</span>' : '';
                if (d.exclusive) {
                    html += '<div class="gh-card gm-day gm-day7 ' + d.state + fresh + '"><div class="gm-ic">' + imgs + '</div><div class="gm-tx"><span class="gm-dn">' + ghEsc(d.dayLabel) + '</span>' +
                        '<span class="gm-dl">' + ghEsc(vis.text) + '</span><span class="gm-sub">' + ghEsc(d.skin ? DailyGift.t('daily.exclusive') + ' · ' + DailyGift.t('daily.exclusiveHint') : '') + '</span>' + tag + '</div>' + chk + '</div>';
                } else {
                    html += '<div class="gh-card gm-day ' + d.state + fresh + '"><span class="gm-dn">' + ghEsc(d.dayLabel) + '</span><div class="gm-ic">' + imgs + '</div><span class="gm-dl">' + ghEsc(vis.text) + '</span>' + tag + chk + '</div>';
                }
            }
            GMU.body.innerHTML = html + '</div>';
        }
        GameMetaUI._syncDailyFoot(v);
    },

    _syncDailyFoot(v) {
        const f = GMU.foot;
        if (!f) return;
        const claim = f.querySelector('.gm-claim'), x2 = f.querySelector('.gm-x2'), note = f.querySelector('.gm-note'), btns = f.querySelector('.gm-btns');
        const can = v.canClaim;
        btns.hidden = !can;
        if (!can) { note.textContent = gmT('gm.nextGift', { t: DailyGift.formatTime(v.msToNext) }); return; }
        const busy = GMU.busy;
        claim.querySelector('.gh-t').textContent = v.claim.label;
        claim.classList.toggle('x', busy);
        const showX2 = v.x2.available && gmAdsOk();
        x2.hidden = !showX2;
        x2.classList.toggle('x', !v.x2.enabled || busy);
        x2.querySelector('.gh-t').textContent = v.x2.label;
        const hint = v.x2.hint && v.x2.hint !== v.x2.label && (showX2 || v.x2.hint === DailyGift.t('daily.noX2')) ? v.x2.hint : '';
        note.textContent = GMU.msg || hint || (showX2 && v.x2.enabled ? v.x2.rewardLabel : '');
    },

    async _claim(x2) {
        if (GMU.busy || !GMU.open || GMU.open !== 'daily') return;
        const v = DailyGift.view();
        if (!v.canClaim) return;
        if (x2 && !v.x2.enabled) {
            const b = GMU.foot.querySelector('.gm-x2'); b.classList.remove('gh-shake'); void b.offsetWidth; b.classList.add('gh-shake');
            return;
        }
        GMU.busy = true; GMU.msg = '';
        GameMetaUI._lock(true);
        GameMetaUI._syncDailyFoot(v);
        let r;
        try { r = x2 ? await DailyGift.claimX2() : DailyGift.claim(); } catch (e) { console.error('GameMetaUI: подарок', e); r = { ok: false, reason: 'error' }; }
        GMU.busy = false;
        GameMetaUI._lock(false);
        if (!GMU.open) { gmCall('onCoins'); return; }   // окно закрыли за время рекламы: награда уже выдана модулем
        if (r && r.ok) {
            GMU.fresh = r.day; GMU.sig = '';
            gmCall('onCoins');
            gmCall('onEvent', 'claim');
            GameMetaUI._renderDaily();
            GameMetaUI._popup(gmT('gm.got'), r.got);
        } else {
            if (r && r.reason === 'adFailed') GMU.msg = gmT('gm.adFailed');
            GameMetaUI._renderDaily();
        }
    },

    // =====================================================================================
    // Колесо фортуны
    // =====================================================================================
    _drawWheel() {
        const cv = GMU.disc;
        if (!cv) return;
        const g = cv.getContext('2d'), S = 512, c = S / 2, R = 212;
        const secs = Wheel.sectors(), n = secs.length, step = Math.PI * 2 / n;
        const pal = ['#ff6b6b', '#ffc247', '#5fd0ff', '#7dff5a', '#ff9a3d', '#4f8dff'];
        const colors = secs.map((/** @type {any} */ s, /** @type {number} */ i) => (s.kind === 'item' ? '#b06bff' : pal[i % pal.length]));
        if (n > 2 && colors[n - 1] === colors[0]) colors[n - 1] = colors[n - 1] === pal[1] ? pal[2] : pal[1];
        g.clearRect(0, 0, S, S);
        // обод
        g.fillStyle = '#10142e'; g.beginPath(); g.arc(c, c, 254, 0, 7); g.fill();
        const rim = g.createLinearGradient(0, 0, 0, S); rim.addColorStop(0, '#ffe36a'); rim.addColorStop(1, '#e98a1f');
        g.fillStyle = rim; g.beginPath(); g.arc(c, c, 246, 0, 7); g.fill();
        g.fillStyle = '#10142e'; g.beginPath(); g.arc(c, c, R + 8, 0, 7); g.fill();
        for (let i = 0; i < 24; i++) {
            const a = i * Math.PI / 12;
            g.fillStyle = i % 2 ? '#fff' : '#ff5a5a';
            g.beginPath(); g.arc(c + Math.cos(a) * 230, c + Math.sin(a) * 230, 6.5, 0, 7); g.fill();
        }
        const fs = n <= 8 ? 50 : n <= 12 ? 38 : 30;
        const coinIm = gmImg(GH_IC.coin, () => { if (GMU.disc === cv) GameMetaUI._drawWheel(); });
        const cosIm = gmImg(GH_IC.cosmetics, () => { if (GMU.disc === cv) GameMetaUI._drawWheel(); });
        for (let i = 0; i < n; i++) {
            const a0 = -Math.PI / 2 + (i - 0.5) * step, a1 = a0 + step;
            g.beginPath(); g.moveTo(c, c); g.arc(c, c, R, a0, a1); g.closePath();
            g.fillStyle = colors[i]; g.fill();
            const hi = g.createRadialGradient(c, c, 20, c, c, R); hi.addColorStop(0, 'rgba(255,255,255,.0)'); hi.addColorStop(1, 'rgba(255,255,255,.28)');
            g.fillStyle = hi; g.fill();
            g.lineWidth = 5; g.strokeStyle = '#10142e'; g.stroke();
        }
        for (let i = 0; i < n; i++) {
            const s = secs[i];
            g.save(); g.translate(c, c); g.rotate(i * step);
            g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
            // подписи вдоль радиуса: длинные числа (2500) не налезают на соседние сектора
            if (s.kind === 'item') {
                const sz = fs * 1.7;
                if (cosIm.ok) g.drawImage(cosIm, -sz / 2, -R * 0.6 - sz / 2, sz, sz);
            } else {
                g.save(); g.translate(0, -R * 0.5); g.rotate(-Math.PI / 2);
                g.font = '900 ' + fs + "px Rubik,'Segoe UI',sans-serif";
                g.lineWidth = 9; g.strokeStyle = '#10142e'; g.fillStyle = '#fff';
                g.strokeText(String(s.coins), 0, 0); g.fillText(String(s.coins), 0, 0);
                g.restore();
                const sz = fs * 0.85;
                if (coinIm.ok) g.drawImage(coinIm, -sz / 2, -R * 0.87 - sz / 2, sz, sz);
            }
            g.restore();
        }
        g.fillStyle = '#10142e'; g.beginPath(); g.arc(c, c, 42, 0, 7); g.fill();
        const hub = g.createLinearGradient(0, c - 36, 0, c + 36); hub.addColorStop(0, '#ffe36a'); hub.addColorStop(1, '#e98a1f');
        g.fillStyle = hub; g.beginPath(); g.arc(c, c, 35, 0, 7); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(c, c, 14, 0, 7); g.fill();
        cv.style.transform = 'rotate(' + GMU.angle + 'deg)';
    },

    _syncWheel() {
        const ctl = GMU.ctl;
        if (GMU.open !== 'wheel' || !ctl) return;
        const st = Wheel.status();
        const free = ctl.querySelector('.gm-free'), ad = ctl.querySelector('.gm-ad'), note = ctl.querySelector('.gm-note');
        const locked = GMU.spinning || GMU.busy;
        free.classList.toggle('x', locked || !st.canSpinFree);
        free.querySelector('.gh-t').textContent = locked ? gmT('gm.busy') : st.freeLabel;
        const left = st.adLeft + st.banked;
        const showAd = gmAdsOk() || st.banked > 0;
        ad.hidden = !showAd;
        let adLabel;
        if (st.adWait > 0 && st.banked === 0) adLabel = Wheel.t('wheel.adIn', { n: st.adWait });
        else if (left > 0) adLabel = gmT('gm.spinAd', { n: left });
        else adLabel = Wheel.t('wheel.noSpins');
        ad.classList.toggle('x', locked || !st.canSpinAd);
        ad.classList.toggle('gh-pulse', !locked && st.canSpinAd && !st.canSpinFree);
        ad.querySelector('.gh-t').textContent = adLabel;
        const hint = st.hint && st.hint !== adLabel && !st.pending ? st.hint : '';
        note.textContent = GMU.msg || (locked ? '' : hint);
    },

    async _spin(kind) {
        if (GMU.spinning || GMU.busy || GMU.open !== 'wheel') return;
        const st = Wheel.status();
        const can = kind === 'free' ? st.canSpinFree : st.canSpinAd;
        if (!can) {
            const b = GMU.ctl.querySelector(kind === 'free' ? '.gm-free' : '.gm-ad'); b.classList.remove('gh-shake'); void b.offsetWidth; b.classList.add('gh-shake');
            return;
        }
        GMU.busy = true; GMU.msg = '';
        GameMetaUI._lock(true);
        GameMetaUI._syncWheel();
        let res;
        try { res = kind === 'free' ? Wheel.spinFree() : await Wheel.spinAd(); } catch (e) { console.error('GameMetaUI: вращение', e); res = { ok: false, reason: 'error' }; }
        GMU.busy = false;
        if (!res || !res.ok) {
            GameMetaUI._lock(false);
            if (res && res.reason === 'adFailed') GMU.msg = gmT('gm.adFailed');
            if (GMU.open === 'wheel') GameMetaUI._syncWheel();
            return;
        }
        if (GMU.open !== 'wheel') { try { Wheel.finish(); } catch (e) { /* приз выдаст следующий init */ } gmCall('onCoins'); return; }
        GameMetaUI._animate(res, false);
    },

    /** Диск плавно докручивается до Wheel.angleFrom(текущий, res) и встаёт точно на выпавший сектор. */
    _animate(res, resumed) {
        GMU.spinning = true;
        GameMetaUI._lock(true);
        GameMetaUI._syncWheel();
        gmCall('onEvent', 'spin');
        const cv = GMU.disc, ptr = GMU.body && GMU.body.querySelector('.gm-ptr');
        const from = GMU.angle, to = Wheel.angleFrom(from, res);
        const total = Math.max(1500, res.durationMs || 5500);
        const left = resumed ? Math.max(0, total - (res.elapsedMs || 0)) : total;
        const t0 = performance.now(), step = 360 / Wheel.sectors().length;
        let lastIdx = Math.floor((from + step / 2) / step), done = false;
        const finish = () => {
            if (done) return;
            done = true;
            GMU.angle = ((to % 360) + 360) % 360;
            if (cv && GMU.disc === cv) cv.style.transform = 'rotate(' + GMU.angle + 'deg)';
            let r = null;
            try { r = Wheel.finish(); } catch (e) { console.error('GameMetaUI: Wheel.finish', e); }
            GMU.spinning = false;
            gmCall('onCoins');
            gmCall('onEvent', 'prize');
            if (GMU.open === 'wheel') {
                GameMetaUI._lock(false);
                GameMetaUI._syncWheel();
                if (r && r.ok) GameMetaUI._popup(Wheel.t('wheel.win'), r.got);
            }
        };
        const frame = () => {
            if (done) return;
            const p = left <= 0 ? 1 : Math.min(1, (performance.now() - t0) / left);
            const e = 1 - Math.pow(1 - p, 3.4);
            const a = from + (to - from) * e;
            if (cv && GMU.disc === cv) {
                cv.style.transform = 'rotate(' + a.toFixed(2) + 'deg)';
                const idx = Math.floor((a + step / 2) / step);
                if (idx !== lastIdx && ptr) { lastIdx = idx; ptr.classList.remove('tick'); void ptr.offsetWidth; ptr.classList.add('tick'); }
            }
            if (p < 1) requestAnimationFrame(frame); else finish();
        };
        requestAnimationFrame(frame);
        // вкладка в фоне: rAF стоит — приз всё равно выдаём по таймеру
        setTimeout(finish, left + 400);
    },
};

/** Название предмета для карточки награды. */
const gmItemName = (/** @type {string} */ id) => (typeof DailyGift !== 'undefined' ? DailyGift.itemName(id) : String(id));
/** Пояснение «предмет уже есть, вместо него монеты». */
const gmDupNote = (/** @type {any} */ g) => (typeof DailyGift !== 'undefined' ? DailyGift.t('reward.dup', { n: g.amount }) : '');
