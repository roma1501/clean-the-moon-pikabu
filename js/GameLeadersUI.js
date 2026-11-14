// GameLeadersUI.js — окно «Рекорды»: таблица лидеров площадки (Platform.leaderboard — Яндекс Игры, Playgama) в стиле
// остального интерфейса (классы окон GameHud). Площадка без таблицы — кнопку «Рекорды» игра не показывает.
// Неавторизованному игроку — кнопка «Войдите в аккаунт» (Platform.canLogin / login); ника в игре не спрашивают.
//
//   GameLeadersUI.init({ onOpen(), onClose(), onLogin() })   // после GameHud.init
//   GameLeadersUI.open() / close();  GameLeadersUI.isOpen

Object.assign(LANG_STRINGS.ru, {
    'lb.title': 'РЕКОРДЫ', 'lb.empty': 'Пока нет лучших игроков', 'lb.loading': 'Загрузка…', 'lb.login': 'Войдите в аккаунт',
    'lb.error': 'Не удалось загрузить рекорды', 'lb.retry': 'Повторить', 'lb.player': 'Игрок',
    'lb.hint': 'Очки дают за очищенные секторы, звёзды, находки и улучшения', 'lb.close': 'Закрыть',
});
Object.assign(LANG_STRINGS.en, {
    'lb.title': 'LEADERBOARD', 'lb.empty': 'No top players yet', 'lb.loading': 'Loading…', 'lb.login': 'Sign in',
    'lb.error': 'Could not load the leaderboard', 'lb.retry': 'Retry', 'lb.player': 'Player',
    'lb.hint': 'Points come from cleaned sectors, stars, finds and upgrades', 'lb.close': 'Close',
});

const GL_CSS = `
.gl-win{width:min(30em,100%)}
.gl-list{display:flex;flex-direction:column;gap:.45em;max-height:min(54vh,24em);overflow-y:auto;padding:.2em .3em .2em .1em;scrollbar-width:thin}
.gl-row{display:flex;align-items:center;gap:.6em;padding:.4em .7em;border:3px solid #10142e;border-radius:.9em;background:linear-gradient(#ffffff,#dfe6ff);
 color:#10142e;font-weight:800;box-shadow:0 3px 0 #10142e}
.gl-row.me{background:linear-gradient(#fff3a8,#ffd21f)}
.gl-rank{flex:0 0 2.1em;text-align:center;font-weight:900;font-size:1.05em}
.gl-row:nth-child(1) .gl-rank{color:#c98a00}.gl-row:nth-child(2) .gl-rank{color:#6f7a90}.gl-row:nth-child(3) .gl-rank{color:#a85a2a}
.gl-ava{flex:0 0 2.2em;width:2.2em;height:2.2em;border-radius:50%;border:3px solid #10142e;background:#9fb4ff center/cover no-repeat;overflow:hidden}
.gl-ava img{width:100%;height:100%;object-fit:cover;display:block}
.gl-name{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gl-score{flex:0 0 auto;font-weight:900}
.gl-msg{padding:1.4em .6em;text-align:center;color:#fff;font-weight:800;font-size:1.05em}
.gl-foot{display:flex;flex-direction:column;align-items:center;gap:.6em;margin-top:.7em}
.gl-hint{color:#c9d2ff;font-weight:700;font-size:.82em;text-align:center}
.gl-foot .gh-btn{min-height:2.8em;padding:.4em 1.2em}
`;

const GLU = { /** @type {any} */ h: {}, inited: false, /** @type {any} */ wl: null, /** @type {any} */ ov: null, /** @type {any} */ body: null, /** @type {any} */ foot: null, job: 0, busy: false };

/** @satisfies {Record<string, any>} */
const GameLeadersUI = {
    isOpen: false,

    init(h) {
        GLU.h = h || {};
        if (GLU.inited) return;
        GLU.inited = true;
        const st = document.createElement('style');
        st.id = 'gl-css';
        st.textContent = GL_CSS;
        document.head.appendChild(st);
        const wl = GLU.wl = document.createElement('div');
        wl.className = 'gh-wl gl-wl';
        wl.style.zIndex = '95';
        document.body.appendChild(wl);
        wl.addEventListener('pointerdown', (/** @type {any} */ e) => { if (e.target && e.target.closest && e.target.closest('.gh-btn,.gh-ov')) e.stopPropagation(); });
        window.addEventListener('keydown', (/** @type {any} */ e) => {
            if (e.key !== 'Escape' || !GameLeadersUI.isOpen) return;
            e.preventDefault(); e.stopImmediatePropagation();
            if (!e.repeat) GameLeadersUI.close();
        }, true);
    },

    /** Есть ли у площадки таблица рекордов (иначе кнопку не показывать). */
    supported() {
        const a = /** @type {any} */ (Platform).adapter;
        return !!(a && typeof a.leaderboard === 'function');
    },

    open() {
        if (!GLU.inited || GameLeadersUI.isOpen) return;
        const t = (/** @type {string} */ k) => Lang.t(k);
        const esc = (/** @type {any} */ s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
        const ov = document.createElement('div');
        ov.className = 'gh-ov';
        const win = document.createElement('div');
        win.className = 'gh-win gl-win';
        win.style.setProperty('--c1', '#ffd84a'); win.style.setProperty('--c2', '#ff9a1f');
        win.innerHTML = '<div class="gh-ribbon"><span class="gh-t">' + esc(t('lb.title')) + '</span></div>' +
            '<button type="button" class="gh-btn r gh-x gl-x" aria-label="' + esc(t('lb.close')) + '"><img src="assets/ui/ic_close.webp" alt="" draggable="false"></button>' +
            '<div class="gh-wb"><div class="gl-list"></div><div class="gl-foot"></div></div>';
        ov.appendChild(win);
        GLU.wl.appendChild(ov);
        GLU.ov = ov; GLU.body = win.querySelector('.gl-list'); GLU.foot = win.querySelector('.gl-foot');
        ov.addEventListener('click', (/** @type {any} */ e) => { if (e.target === ov) GameLeadersUI.close(); });
        /** @type {HTMLElement} */ (win.querySelector('.gl-x')).addEventListener('click', () => GameLeadersUI.close());
        GameLeadersUI.isOpen = true;
        if (typeof GameHud !== 'undefined' && /** @type {any} */ (GameHud).cover) /** @type {any} */ (GameHud).cover(true);
        if (GLU.h.onOpen) GLU.h.onOpen();
        GameLeadersUI.load();
    },

    close() {
        if (!GameLeadersUI.isOpen) return;
        GLU.job++;
        if (GLU.ov && GLU.ov.parentNode) GLU.ov.parentNode.removeChild(GLU.ov);
        GLU.ov = GLU.body = GLU.foot = null;
        GameLeadersUI.isOpen = false;
        if (typeof GameHud !== 'undefined' && /** @type {any} */ (GameHud).cover) /** @type {any} */ (GameHud).cover(false);
        if (GLU.h.onClose) GLU.h.onClose();
    },

    /** Запросить таблицу и нарисовать её (повтор — по кнопке). */
    async load() {
        const job = ++GLU.job, t = (/** @type {string} */ k) => Lang.t(k);
        const esc = (/** @type {any} */ s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
        const fmt = (/** @type {number} */ n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        if (!GLU.body) return;
        GLU.body.innerHTML = '<div class="gl-msg">' + esc(t('lb.loading')) + '</div>';
        GameLeadersUI.footer();
        let list = null, failed = false;
        try { list = await Platform.leaderboard({ avatarSize: 'medium' }); } catch (e) { failed = true; }
        if (job !== GLU.job || !GLU.body) return;
        if (failed) {
            GLU.body.innerHTML = '<div class="gl-msg">' + esc(t('lb.error')) + '</div>';
            GameLeadersUI.footer(true);
            return;
        }
        if (!Array.isArray(list) || !list.length) {
            GLU.body.innerHTML = '<div class="gl-msg">' + esc(t('lb.empty')) + '</div>';
            GameLeadersUI.footer();
            return;
        }
        let html = '';
        for (const r of list) {
            const name = String(r.name || '').trim() || t('lb.player');
            html += '<div class="gl-row' + (r.me ? ' me' : '') + '"><span class="gl-rank">' + esc(r.rank) + '</span><span class="gl-ava">' +
                (r.avatar ? '<img src="' + esc(r.avatar) + '" alt="" draggable="false" loading="lazy">' : '') + '</span>' +
                '<span class="gl-name">' + esc(name) + '</span><span class="gl-score">' + fmt(r.score) + '</span></div>';
        }
        GLU.body.innerHTML = html;
        const me = GLU.body.querySelector('.gl-row.me');
        if (me && me.scrollIntoView) { try { me.scrollIntoView({ block: 'nearest' }); } catch (e) { /* старый браузер */ } }
        GameLeadersUI.footer();
    },

    /** Низ окна: подсказка, «Войдите в аккаунт» для гостя, «Повторить» после ошибки. */
    footer(retry) {
        if (!GLU.foot) return;
        const t = (/** @type {string} */ k) => Lang.t(k);
        GLU.foot.innerHTML = '';
        const btn = (/** @type {string} */ cls, /** @type {string} */ text, /** @type {() => void} */ fn) => {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'gh-btn ' + cls;
            const s = document.createElement('span'); s.className = 'gh-t'; s.textContent = text; b.appendChild(s);
            b.addEventListener('click', fn);
            GLU.foot.appendChild(b);
        };
        if (retry) btn('o', t('lb.retry'), () => GameLeadersUI.load());
        let guest = false;
        try { guest = !!Platform.canLogin() && !Platform.authorized(); } catch (e) { guest = false; }
        if (guest) btn('b', t('lb.login'), async () => {
            if (GLU.busy) return;
            GLU.busy = true;
            let ok = false;
            try { ok = (await Platform.login()) === true; } catch (e) { ok = false; }
            GLU.busy = false;
            if (ok) { if (GLU.h.onLogin) GLU.h.onLogin(); else GameLeadersUI.load(); }
        });
        const hint = document.createElement('div');
        hint.className = 'gl-hint'; hint.textContent = t('lb.hint');
        GLU.foot.appendChild(hint);
    },
};
