// GameAudio.js — звук игры «Clean the Moon»: обёртка над Sound (js/Sound.js) с событиями игры.
// Музыка и часть эффектов синтезированы скриптами tools/audio (см. SOURCES.md в папке звуков).
//
//   GameAudio.init()               один раз: предзагрузка частых звуков
//   GameAudio.music(name)          'menu' | 'game-a' | 'game-b' | 'boss' | null (стоп); тот же name — ничего не перезапускает
//   GameAudio.play(name, opts)     событие игры (coin, buy, jump…); opts: { volume, rate }; неизвестное имя игнорируется
//   GameAudio.vacuum(on, power)    цикл пылесоса; power 0..1 — громкость и высота (плавно)
//   GameAudio.jet(on)              цикл реактивного ранца
//   GameAudio.stopLoops()          погасить все циклы (пауза меню, смена уровня)
//
// События: ui_click ui_open ui_close buy deny unlock coin sell suck star tank_full milestone
//          step jump land geyser meteor_warn meteor_hit slime bunny_squeak bunny_caught hurt
//          boss_roar boss_hit boss_die blast blast_ready rocket wave_clean jingle_win jingle_tool
// Пути — литералами (сборщик ищет ассеты только так); частые звуки — списки вариантов (по 2–4 файла).

const GA_MUSIC = {
    'menu': 'assets/sounds/music_menu.ogg',
    'game-a': 'assets/sounds/music_game_a.ogg',
    'game-b': 'assets/sounds/music_game_b.ogg',
    'boss': 'assets/sounds/music_boss.ogg',
};

const GA_LOOPS = {
    vac: 'assets/sounds/vac_loop.wav',
    jet: 'assets/sounds/jet_loop.wav',
};

// f — файл или список вариантов; v — громкость (до SOUND_VOLUME); gap — минимум мс между повторами.
/** @type {Record<string, { f: string | string[], v: number, gap?: number }>} */
const GA_EVENTS = {
    // интерфейс
    ui_click: { f: 'assets/sounds/ui_click.ogg', v: 0.6 },
    ui_open: { f: 'assets/sounds/ui_open.ogg', v: 0.5 },
    ui_close: { f: 'assets/sounds/ui_close.ogg', v: 0.5 },
    buy: { f: 'assets/sounds/buy.ogg', v: 0.75 },
    deny: { f: 'assets/sounds/deny.ogg', v: 0.5, gap: 120 },
    unlock: { f: 'assets/sounds/unlock.ogg', v: 0.8 },
    // подбор и сдача
    coin: { f: ['assets/sounds/coin-1.ogg', 'assets/sounds/coin-2.ogg', 'assets/sounds/coin-3.ogg'], v: 0.7, gap: 35 },
    sell: { f: 'assets/sounds/sell.ogg', v: 0.8 },
    suck: { f: ['assets/sounds/suck-1.ogg', 'assets/sounds/suck-2.ogg', 'assets/sounds/suck-3.ogg'], v: 0.55, gap: 40 },
    star: { f: 'assets/sounds/star.ogg', v: 0.8 },
    tank_full: { f: 'assets/sounds/tank_full.ogg', v: 0.6, gap: 400 },
    milestone: { f: 'assets/sounds/milestone.ogg', v: 0.8 },
    // движение
    step: { f: ['assets/sounds/step-1.ogg', 'assets/sounds/step-2.ogg', 'assets/sounds/step-3.ogg', 'assets/sounds/step-4.ogg'], v: 0.3 },
    jump: { f: ['assets/sounds/jump-1.ogg', 'assets/sounds/jump-2.ogg'], v: 0.45 },
    land: { f: ['assets/sounds/land-1.ogg', 'assets/sounds/land-2.ogg'], v: 0.5 },
    // опасности и существа
    geyser: { f: 'assets/sounds/geyser.ogg', v: 0.7 },
    meteor_warn: { f: 'assets/sounds/meteor_warn.ogg', v: 0.7 },
    meteor_hit: { f: 'assets/sounds/meteor_hit.ogg', v: 0.9 },
    slime: { f: ['assets/sounds/slime-1.ogg', 'assets/sounds/slime-2.ogg'], v: 0.6, gap: 60 },
    bunny_squeak: { f: ['assets/sounds/bunny_squeak-1.ogg', 'assets/sounds/bunny_squeak-2.ogg', 'assets/sounds/bunny_squeak-3.ogg'], v: 0.5, gap: 80 },
    bunny_caught: { f: 'assets/sounds/bunny_caught.ogg', v: 0.65 },
    hurt: { f: 'assets/sounds/hurt.ogg', v: 0.8, gap: 150 },
    // босс
    boss_roar: { f: 'assets/sounds/boss_roar.ogg', v: 0.8 },
    boss_hit: { f: 'assets/sounds/boss_hit.ogg', v: 0.7, gap: 80 },
    boss_die: { f: 'assets/sounds/boss_die.ogg', v: 0.9 },
    // способности и события уровня
    blast: { f: 'assets/sounds/blast.ogg', v: 1.0 },
    blast_ready: { f: 'assets/sounds/blast_ready.ogg', v: 0.7 },
    rocket: { f: 'assets/sounds/rocket.ogg', v: 0.6 },
    wave_clean: { f: 'assets/sounds/wave_clean.ogg', v: 0.9 },
    // джинглы (приглушают музыку)
    jingle_win: { f: 'assets/sounds/jingle_win.ogg', v: 0.8 },
    jingle_tool: { f: 'assets/sounds/jingle_tool.ogg', v: 0.8 },
};

// Что предзагрузить сразу: частые и «горячие» звуки, чтобы не было задержки на первом подборе/шаге.
const GA_PRELOAD = ['ui_click', 'coin', 'suck', 'step', 'jump', 'land', 'sell', 'buy', 'hurt', 'slime', 'bunny_squeak'];

/** @satisfies {Record<string, any>} */
const GameAudio = {
    _inited: false,
    /** @type {string | null} */
    _music: null,
    /** @type {any} */
    _vac: null,
    /** @type {any} */
    _jet: null,
    /** @type {Record<string, number>} */
    _last: {},

    init() {
        if (this._inited) return;
        this._inited = true;
        if (typeof Sound === 'undefined' || !Sound.preload) return;
        /** @type {any[]} */
        const urls = [];
        for (const name of GA_PRELOAD) urls.push(GA_EVENTS[name].f);
        urls.push(GA_LOOPS.vac);
        Sound.preload(urls);
    },

    music(name) {
        if (typeof Sound === 'undefined') return;
        if (!name) {
            this._music = null;
            Sound.stopMusic();
            return;
        }
        const url = GA_MUSIC[name];
        if (!url || name === this._music) return;   // неизвестное имя игнорируется; то же имя не перезапускаем
        this._music = name;
        Sound.music(url, { fade: 0.8 });
    },

    play(name, opts) {
        const e = GA_EVENTS[name];
        if (!e || typeof Sound === 'undefined') return null;
        if (e.gap) {
            const now = performance.now();
            if (now - (this._last[name] || -1e9) < e.gap) return null;
            this._last[name] = now;
        }
        const o = opts || {};
        /** @type {{ volume: number, rate?: number }} */
        const po = { volume: e.v * (o.volume == null ? 1 : o.volume) };
        if (o.rate != null) po.rate = o.rate;
        const h = Sound.play(e.f, po);
        if (name === 'jingle_win') Sound.duck(0.2, 0.12, 3.2, 0.8);
        else if (name === 'jingle_tool') Sound.duck(0.3, 0.1, 1.7, 0.6);
        return h;
    },

    vacuum(on, power) {
        if (typeof Sound === 'undefined') return;
        if (!on) {
            if (this._vac) { this._vac.fade(0.15); this._vac = null; }
            return;
        }
        const p = Math.max(0, Math.min(1, power == null ? 1 : power));
        const vol = 0.12 + 0.23 * p;        // не громче 0.35
        const rate = 0.88 + 0.3 * p;        // мощнее — выше тон
        if (!this._vac) this._vac = Sound.loop(GA_LOOPS.vac, { volume: vol, rate });
        else this._vac.set(vol, rate);
    },

    jet(on) {
        if (typeof Sound === 'undefined') return;
        if (!on) {
            if (this._jet) { this._jet.fade(0.15); this._jet = null; }
            return;
        }
        if (!this._jet) this._jet = Sound.loop(GA_LOOPS.jet, { volume: 0.28 });
    },

    stopLoops() {
        if (this._vac) { this._vac.fade(0.1); this._vac = null; }
        if (this._jet) { this._jet.fade(0.1); this._jet = null; }
    },
};
