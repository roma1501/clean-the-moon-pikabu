// Game.js — Clean the Moon: ход игры. Герой с пылесосом чистит сектор Луны: грязь стирается сама под соплом и
// копится в ранце; полный ранец сдают на станции за монеты; монеты — на улучшения (мощность, размах, бак, скорость,
// ранец, «Сияние»). Когда сектор почти чист, «волна блеска» дочищает остатки — и можно лететь ракетой дальше.
//
// Модули: GameData (таблицы и тексты), GameDirt (слой грязи), GameHero (персонаж), GameWorld (станции, мусор, звёзды,
// небо, ракета), GameMobs (гейзеры, слизни, зайчики, метеориты, босс), GameHud (интерфейс), GameAudio (звук),
// GameFx (эффекты). Последние три могут отсутствовать — игра работает и без них (проверки typeof).
// Уровни — карты Maps.js (sector-1 … sector-5), точки логики — маркеры (см. GameData.js).
//
// Сохранение — один объект (Platform.save): { v, level, unlocked, coins, up: { id: уровень }, levels: { id: { stars,
// best, done, found: [номера звёзд] } }, tutorialDone }.

/** @satisfies {Record<string, any>} */
const Game = {
    /** @type {LoryApp | null} */ app: null,
    /** @type {any} */ save: null,
    levelIdx: 0,
    state: 'boot',                 // boot | menu | run | done | launch
    fresh: true,                   // карта только что подготовлена и не тронута
    tank: 0, worth: 0,             // единиц грязи в ранце и их монетный вес
    blast: 0,                      // заряд «Сияния» 0..1
    time: 0,                       // секунд в секторе
    earned: 0,                     // монет за сектор
    /** @type {any} */ wave: null,
    /** @type {any} */ blastFx: null,
    cam: { x: 0, y: 0, h: 0, frameHeight: 560 },
    lookT: 0,
    tool: { on: false, x: 0, y: 0, radius: 95, power: 0, mul: 1 },
    _cp: { x: 0, y: 0 },
    _f: [0, 0, 0],
    _hud: { coins: -1, progress: -1, tank: -1, cap: -1, blast: -1, jet: -2, objective: '', boss: -2 },
    _mile: 0,
    _fullSaid: 0, _idle: 0, _saveT: 0, _vacT: 0, _nearT: 0,
    /** @type {any} */ _near: null,
    _winPause: false,
    _busy: false,
    shopOn: false, dailyOn: false, wheelOn: false,
    boost: 0,                      // секунд супер-буста (x2 мощность, x3 удача) — за рекламу
    radar: 0,                      // секунд радара спрятанных звёзд — за рекламу
    findAcc: 0,                    // единиц грязи с прошлой находки
    doubled: false,                // награда сектора уже удвоена
    _adBusy: false,
    /** @type {any} */ _result: null,   // отложенное окно результата { t, model }
    _bonus: 0,
    _shop: false,                  // открыт магазин косметики: камера-витрина
    _ads: { supported: -1, wait: -1, boost: -1, drone: -1, radar: '', badges: '' },

    // ---------------------------------------------------------------------------------------------
    // Запуск
    // ---------------------------------------------------------------------------------------------

    /** Сохранение и сектор, с которого начать (main.js зовёт до init). ?level=sector-3 — открыть сектор (проверка карт). */
    async firstMap() {
        let saved = null;
        try { saved = await Platform.load(); } catch (e) { saved = null; }
        this.save = Object.assign({ v: 1, level: 0, unlocked: 1, coins: 0, up: {}, upAds: {}, levels: {}, codex: {}, tutorialDone: false }, saved || {});
        if (!this.save.up || typeof this.save.up !== 'object') this.save.up = {};
        if (!this.save.levels || typeof this.save.levels !== 'object') this.save.levels = {};
        if (!this.save.upAds || typeof this.save.upAds !== 'object') this.save.upAds = {};
        if (!this.save.codex || typeof this.save.codex !== 'object') this.save.codex = {};
        let idx = Math.max(0, Math.min(GameData.LEVELS.length - 1, this.save.level | 0));
        try {
            const q = new URLSearchParams(location.search).get('level');
            if (q) { const i = GameData.LEVELS.findIndex((l, n) => l.id === q || String(n + 1) === q); if (i >= 0) { idx = i; this._forced = true; } }
        } catch (e) { /* без адреса */ }
        this.levelIdx = idx;
        return GameData.level(idx).id;
    },

    async init(app) {
        this.app = app;
        if (!this.save) await this.firstMap();
        const cur = GameData.LEVELS.findIndex(l => l.id === (app.map && app.map.id));
        if (cur >= 0) this.levelIdx = cur;
        // Playgama (требование 1.5.2): клавиша Esc занята браузером под выход из полного экрана — игра её не использует.
        // Обработчик стоит раньше окон интерфейса и гасит Esc для них; пауза — кнопкой на экране.
        if (Platform.name === 'playgama') window.addEventListener('keydown', (e) => { if (e.key === 'Escape') e.stopImmediatePropagation(); }, true);
        Nav.register(GameData.COLLIDERS || {});
        await MotionDB.sharedAsync(GameHero.DB);
        this.initMeta();
        HudLayout.init({ app });
        const playables = Platform.name === 'playables';
        Input.init(playables ? { app, mouse: 'drag', actions: Object.assign({}, Input.DEFAULTS, { jump: { keys: ['Space', 'Mouse2'], pad: [0] } }) } : { app, mouse: 'drag' });
        Input.configure({ dragButton: -1 });
        if (typeof GameHud !== 'undefined') {
            GameHud.init({
                onPlay: () => this.play(), onLevel: (i) => this.chooseLevel(i), onBuy: (id) => this.buy(id),
                onWindow: (name) => this.onWindow(name), onPause: () => {}, onResume: () => {}, onRestart: () => this.leave(() => this.restart()),
                onMenu: () => this.leave(() => this.toMenu()), onNext: () => this.next(), onReplay: () => this.leave(() => this.restart()),
                onSound: (on) => { if (Sound.muted === !!on) Sound.toggleMuted(); GameHud.setSound(!Sound.muted); },
                onMusic: (on) => { this.save.musicOff = !on; this.persist(); this.music(); GameHud.setMusic(!!on); },
                onQuality: (q) => { if (typeof Quality !== 'undefined') Quality.set(q); },
                onHowTo: () => this.howTo(), onBlast: () => this.fireBlast(),
                onUpgrades: () => this.openUpgrades(), onLevels: () => this.openLevels(),
                onBuyAd: (id) => this.buyAd(id), onDouble: () => this.doubleAd(), onBoost: () => this.boostAd(), onDrone: () => this.droneAd(),
                onBlastAd: () => this.blastAd(), onRadar: () => this.radarAd(),
                onShop: () => this.openShop(), onDaily: () => this.openMeta('daily'), onWheel: () => this.openMeta('wheel'), onCodex: () => this.openCodex(),
                onLeaders: () => this.openLeaders(),
            });
            GameHud.setSound(!Sound.muted);
            GameHud.setMusic(!this.save.musicOff);
            if (typeof Quality !== 'undefined' && GameHud.setQuality) GameHud.setQuality(Quality.choice || 'auto');
        }
        if (typeof GameAudio !== 'undefined') GameAudio.init();
        if (typeof GameFx !== 'undefined' && GameFx.init) GameFx.init(app);
        this.heroEvents();
        this.initMetaUi(app);
        // камера от третьего лица: свои числа поверх констант движка (в Constants.js остаются умолчания)
        Object.assign(/** @type {any} */ (app.camera).c, { azimuth: 0, pitch: 28, zoom: 2, zoomMobile: 2, zoomMin: 0.3, followLerp: 0.14,
            pitchMin: 8, pitchMax: 75, edgeGuard: 0, collide: 1, fade: 1, sightLift: 40 });
        app.camera.follow(this.cam);
        try { app.camera.home(); } catch (e) { /* камера без home */ }
        // средняя кнопка мыши камеру не двигает (панорама отрывала бы её от героя); автопрокрутку браузера тоже гасим
        const camAny = /** @type {any} */ (app.camera);
        const prevIgnore = camAny.ignorePointer;
        camAny.ignorePointer = (e) => e.button === 1 || (typeof prevIgnore === 'function' ? prevIgnore.call(camAny, e) : false);
        const canvas = document.getElementById('world3d');
        const eatMiddle = (e) => { if (e.button === 1) { e.preventDefault(); e.stopPropagation(); } };
        if (canvas) for (const t of ['pointerdown', 'mousedown', 'auxclick']) canvas.addEventListener(t, eatMiddle, true);
        app.onFrame((dt) => this.frame(dt));
        await this.prepare(app);
        Tutorial.init({
            app, state: () => this.save, field: 'tutorialDone', persist: () => this.persist(),
            css: typeof GameHud !== 'undefined' && GameHud.tutorialCss ? GameHud.tutorialCss() : undefined,
            steps: [
                Tutorial.preset('move'),
                { id: 'clean', title: 'tut.clean.t', hint: 'tut.clean.h', check: () => Math.min(1, this.tank / (this.cap() * 0.5)) },
                { id: 'sell', title: 'tut.sell.t', hint: 'tut.sell.h', event: 'sell', world: () => this.padPoint('sell') },
                { id: 'shop', title: 'tut.shop.t', hint: 'tut.shop.h', event: 'shop', world: () => this.padPoint('shop') },
                { id: 'goal', title: 'tut.goal.t', hint: 'tut.goal.h', action: 'jump', delay: 0.6 },
            ],
        });
        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyE' || e.code === 'KeyF') this.fireBlast();
        });
        if (this._forced) this.start(); else this.toMenu(true);
    },

    async ready() { Platform.gameplay(false); },

    /** Магазин косметики, подарок дня, колесо и кодекс: их состояние — поля общего сохранения. */
    initMeta() {
        const persist = () => this.persist();
        if (typeof Shop !== 'undefined' && typeof SHOP_ITEMS !== 'undefined' && SHOP_ITEMS.length) {
            Shop.init({ tabs: SHOP_TABS, items: SHOP_ITEMS, state: this.save.shop, persist });
            this.save.shop = Shop.state;
            if ((this.save.coins | 0) > 0) { Shop.addCoins(this.save.coins | 0, { save: false }); this.save.coins = 0; }   // монеты до появления магазина
            Shop.on((e) => {
                if (e.type === 'equip' || e.type === 'unequip' || e.type === 'preview' || e.type === 'grant') this.applyLook();
                if (e.type === 'coins') this._hud.coins = -1;
            });
            this.shopOn = true;
        }
        if (this.shopOn && typeof DailyGift !== 'undefined' && typeof DAILY_REWARDS !== 'undefined' && DAILY_REWARDS.length) {
            DailyGift.init({ rewards: DAILY_REWARDS, rewardsSink: Shop, state: this.save.daily, persist });
            this.save.daily = DailyGift.state; this.dailyOn = true;
        }
        if (this.shopOn && typeof Wheel !== 'undefined' && typeof WHEEL_SECTORS !== 'undefined' && WHEEL_SECTORS.length) {
            Wheel.init({ sectors: WHEEL_SECTORS, rewardsSink: Shop, state: this.save.wheel, persist });
            this.save.wheel = Wheel.state; this.wheelOn = true;
        }
        if (typeof GameCodex !== 'undefined' && GameCodex.init) GameCodex.init({ state: this.save.codex, persist });
    },

    initMetaUi(app) {
        const ui = (name) => this.sfx(name);
        if (typeof GameLook !== 'undefined') GameLook.init(app);
        if (typeof GameShopUI !== 'undefined') GameShopUI.init({
            onOpen: () => { this._shop = true; this.cover(true); this.onWindow('shop'); ui('ui_open'); },
            onClose: () => { this._shop = false; this.cover(false); this.onWindow(''); this.shopCamBack(); ui('ui_close'); },
            onCoins: () => { this._hud.coins = -1; }, onCoinsAd: () => this.coinsAd(),
        });
        if (typeof GameMetaUI !== 'undefined') GameMetaUI.init({
            onOpen: (name) => { this.onWindow(name || 'meta'); ui('ui_open'); }, onClose: () => { this.onWindow(''); ui('ui_close'); },
            onCoins: () => { this._hud.coins = -1; }, onEvent: (name) => ui(name === 'prize' || name === 'claim' ? 'buy' : name === 'spin' ? 'ui_click' : 'ui_click'),
        });
        if (typeof GameCodexUI !== 'undefined') GameCodexUI.init({
            onOpen: () => { this.cover(true); this.onWindow('codex'); ui('ui_open'); }, onClose: () => { this.cover(false); this.onWindow(''); ui('ui_close'); },
            onCoins: (n) => { this.gain(n); this.sfx('buy'); }, onEvent: () => ui('ui_click'),
        });
        try { Platform.onRewardedCooldown(() => this.adsState(true)); } catch (e) { /* старая платформа */ }
        try { Platform.onAd(() => this.adsState(true)); } catch (e) { /* старая платформа */ }
        if (typeof GameLeadersUI !== 'undefined') {
            GameLeadersUI.init({
                onOpen: () => { this.onWindow('leaders'); ui('ui_open'); }, onClose: () => { this.onWindow(''); ui('ui_close'); },
                onLogin: () => { try { location.reload(); } catch (e) { /* без перезагрузки */ } },
            });
            const hud = /** @type {any} */ (typeof GameHud !== 'undefined' ? GameHud : null);
            if (hud && hud.setLeaders) hud.setLeaders(GameLeadersUI.supported());
        }
        this.initUiAds();
    },

    openLeaders() { if (typeof GameLeadersUI !== 'undefined') { if (typeof GameHud !== 'undefined') GameHud.closeWindow(); this.submitScore(); GameLeadersUI.open(); } },
    submitScore() { try { Platform.submitScore(this.score()); } catch (e) { /* площадка без рекордов */ } },

    /** Уход из окна результата («Ещё раз», «В меню») — переход по правилу двух раундов; в остальных случаях — сразу. */
    leave(go) {
        if (this.state !== 'launch') { go(); return; }
        try { Platform.ads.next(go); } catch (e) { go(); }
    },

    /**
     * Межстраничная реклама по нажатию кнопок интерфейса (требование заказчика), только в двух сборках:
     *   YouTube Playables — по каждой кнопке интерфейса вне игрового процесса (кнопки HUD в забеге не считаются);
     *   Playgama — по кнопкам HUD «Пауза», «Улучшения», «Секторы», «Магазин», «Кодекс»: они открывают окно, игра встаёт.
     * Никогда — пока идёт или запускается rewarded. Показывать ли ролик и как часто — решает площадка (в Playgama —
     * минимальный интервал Bridge). Локальная проверка: ?uiads&mockads (Playables) или ?uiads=hud&mockads (Playgama).
     */
    initUiAds() {
        // режим: 'all' — любая кнопка интерфейса вне забега (Playables); 'hud' — кнопки HUD, открывающие окна (Playgama)
        let mode = Platform.name === 'playables' ? 'all' : Platform.name === 'playgama' ? 'hud' : '';
        try { const q = /[?&]uiads(?:=([a-z]+))?(?:&|$)/.exec(location.search); if (q) mode = q[1] === 'hud' ? 'hud' : 'all'; } catch (e) { /* без адреса */ }
        if (!mode) return;
        const HUD = '#gh-pausebtn, #gh-bup, #gh-blv, #gh-bshop, #gh-bcodex';   // пауза, улучшения, секторы, магазин, кодекс
        document.addEventListener('click', (e) => {
            const t = /** @type {any} */ (e.target);
            if (!t || !t.closest) return;
            if (Platform.adActive || this._adBusy) return;
            if (mode === 'hud') {
                // Playgama: нажатие открывает окно и ставит игру на паузу — логическая пауза; в обучении рекламы нет
                if (!t.closest(HUD) || Tutorial.active || !this.inGameplay()) return;
            } else {
                if (!t.closest('button, .gh-btn, [role="button"]')) return;
                // игровой процесс — по состоянию ДО нажатия (кнопка «Играть» нажата ещё в меню)
                if (this.inGameplay()) return;
            }
            // rewarded — по состоянию ПОСЛЕ обработчика кнопки: кнопка «За рекламу» уже запустила свой ролик
            setTimeout(() => {
                if (Platform.adActive || this._adBusy || /** @type {any} */ (Platform)._adBusy) return;
                if (mode === 'hud' && this.inGameplay()) return;          // окно не открылось — забег не прерываем
                let ok = true;
                try { ok = !!Platform.interstitialSupported(); } catch (err) { ok = true; }
                if (!ok) return;                                           // реклама недоступна
                this.uiAds++;
                try { Platform.interstitial(); } catch (err) { /* реклама недоступна */ }
            }, 0);
        }, true);
    },
    uiAds: 0,
    /** Идёт игровой процесс: забег без открытых окон и паузы. */
    inGameplay() { return (this.state === 'run' || this.state === 'done') && !Pause.active && !this._shop; },

    /** Спрятать HUD и меню под своим окном (магазин, кодекс). */
    cover(on) { const hud = /** @type {any} */ (typeof GameHud !== 'undefined' ? GameHud : null); if (hud && hud.cover) hud.cover(!!on); },

    // --- валюта: единая с магазином косметики (Shop.coins); без магазина — поле сохранения ---
    coins() { return this.shopOn ? Shop.coins | 0 : this.save.coins | 0; },
    gain(n) {
        const c = Math.max(0, Math.round(n));
        if (!c) return 0;
        if (this.shopOn) Shop.addCoins(c, { save: false }); else this.save.coins = (this.save.coins | 0) + c;
        this.earned += c;
        this._hud.coins = -1;
        return c;
    },
    spend(n) {
        if (this.coins() < n) return false;
        if (this.shopOn) Shop.spend(n, { save: false }); else this.save.coins -= n;
        this._hud.coins = -1;
        return true;
    },
    applyLook() { if (this.shopOn && typeof GameLook !== 'undefined') { try { GameLook.apply(Shop.look()); } catch (e) { console.warn('GameLook', e); } } },

    persist() { try { Platform.save(this.save); } catch (e) { /* сохранение недоступно */ } },

    level() { return GameData.level(this.levelIdx); },
    lv(id) { return this.save.up[id] | 0; },
    val(id) { return GameData.value(id, this.lv(id)); },
    cap() { return this.val('tank'); },
    stats() { const id = this.level().id; return this.save.levels[id] || (this.save.levels[id] = { stars: 0, best: 0, done: false, found: [] }); },

    // ---------------------------------------------------------------------------------------------
    // Сектор: подготовка под экраном загрузки
    // ---------------------------------------------------------------------------------------------

    async prepare(app) {
        const loc = app.location, L = this.level();
        this.dropActors();
        Nav.build(loc, { ground: (x, y) => loc.terrain.fieldHeight(x, y) });
        GameDirt.build(loc);
        const st = this.stats();
        if (!Array.isArray(st.found)) st.found = [];
        await GameWorld.build(app, L, {
            foundStars: st.found,
            onPad: (kind, inside) => this.onPad(kind, inside),
            onJunk: (j) => this.onJunk(j),
            onHeavy: () => this.toast('g.heavy', 'warn'),
            onStarShow: (s) => { this.sfx('milestone'); this.fx('starShow', { x: s.x, y: s.y, h: s.h }); },
            onStar: (s) => this.onStar(s),
            onDrop: (kind, coins, x, y) => { this.addCoins(coins, x, y, GameHero.h + 100); this.sfx('coin'); this.fx('pickup', { x, y, h: GameHero.h + 90, kind }); },
            onFind: (id, x, y) => this.onFind(id, x, y),
        });
        await GameMobs.build(app, L, {
            fx: (n, d) => this.fx(n, d), sfx: (n) => this.sfx(n), toast: (k, kind) => this.toast(k, kind),
            knock: (vx, vy, vz) => this.knock(vx, vy, vz),
            caught: (kind, x, y) => this.onCaught(kind, x, y),
            boss: (evt, v) => this.onBoss(evt, v),
        });
        const sp = loc.marker('spawn') || { x: loc.width / 2, y: loc.height / 2, rot: [0, 0, 0] };
        const yaw = ((sp.rot ? sp.rot[1] : 0) || 0) * Math.PI / 180;
        await GameHero.create(app, { x: sp.x, y: sp.y, yaw });
        this.applyStats();
        await GameHero.setTool(GameData.tool(this.lv('power')).tier);
        await GameHero.setupTank();
        this.applyLook();
        if (typeof GameNpc !== 'undefined') { try { await GameNpc.build(app, L); } catch (e) { console.warn('GameNpc.build', e); } }
        GameWorld.setLaunch(false);
        this.tank = 0; this.worth = 0; this.blast = 0; this.time = 0; this.earned = 0; this.wave = null; this.blastFx = null;
        this._mile = 0; this._fullSaid = 0; this._idle = 0; this._near = null;
        this.radar = 0; this.findAcc = 0; this.doubled = false; this._result = null;
        this.fresh = true;
        const cam = app.camera;
        cam.bounds = null;
        cam.azimuth = yaw; cam.pitch = 0.42;
        this.syncCam(true);
        try { cam.snap(); } catch (e) { /* камера без sight */ }
        if (typeof GameFx !== 'undefined' && GameFx.level) { try { GameFx.level(app, L); } catch (e) { console.warn('GameFx.level', e); } }
        this.hudAll(true);
    },

    applyStats() {
        const b = this.boost > 0;
        GameHero.setStats({ speed: this.val('speed'), jet: this.val('jet') });
        this.tool.radius = this.val('radius') * (b ? 1.25 : 1); this.tool.mul = this.val('power') * (b ? 2 : 1); this.tool.power = this.lv('power') + (b ? 2 : 0);
    },

    /** Перед сменой сектора: косметика и NPC прошлого героя и карты. */
    dropActors() {
        if (typeof GameLook !== 'undefined') { try { GameLook.dispose(); } catch (e) { /* уже */ } }
        if (typeof GameNpc !== 'undefined') { try { GameNpc.clear(); } catch (e) { /* уже */ } }
    },

    async loadLevel(idx) {
        if (this._busy) return;
        this._busy = true;
        this.levelIdx = Math.max(0, Math.min(GameData.LEVELS.length - 1, idx | 0));
        this.save.level = this.levelIdx;
        this.persist();
        this.stopLoops();
        this.dropActors();
        if (typeof GameHud !== 'undefined') GameHud.screen('hidden');
        try {
            await this.app.loadMap(this.level().id, { label: Lang.t('loading.sector', { name: GameData.levelName(this.levelIdx) }), prepare: (app) => this.prepare(app) });
        } finally { this._busy = false; }
    },

    // ---------------------------------------------------------------------------------------------
    // Состояния: меню, игра, результат
    // ---------------------------------------------------------------------------------------------

    toMenu(first) {
        this.state = 'menu';
        this.stopLoops();
        Pause.set('manual', false);
        Platform.gameplay(false);
        Input.configure({ controls: false });
        document.body.classList.add('ui-menu');
        GameWorld.setBeams(false);
        if (typeof GameHud !== 'undefined') { GameHud.closeWindow(); GameHud.screen('menu'); }
        this.music();
        if (!first) this.persist();
    },

    async play() {
        if (this._busy) return;
        if (!this.fresh) await this.loadLevel(this.levelIdx);
        this.start();
    },

    start() {
        this.state = 'run';
        this.fresh = false;
        document.body.classList.remove('ui-menu');
        GameWorld.setBeams(true);
        Input.configure({ controls: true });
        Input.setContext({ id: 'jump', icon: 'assets/ui/ic_jump.webp', action: 'jump' });
        if (typeof GameHud !== 'undefined') GameHud.screen('game');
        this.hudAll(true);
        Platform.gameplay(true);
        this.music();
        // камера — за спину героя
        const cam = this.app.camera;
        cam.azimuth = GameHero.heading; cam.pitch = 0.5;
        this.cam.frameHeight = innerHeight > innerWidth ? 900 : 760;
        this.syncCam(true);
        try { cam.snap(); } catch (e) { /* без sight */ }
        Tutorial.autoStart();
    },

    async chooseLevel(i) {
        if (i >= (this.save.unlocked | 0) || this._busy) return;
        if (typeof GameHud !== 'undefined') GameHud.closeWindow();
        await this.loadLevel(i);
        this.start();
    },

    async restart() {
        if (typeof GameHud !== 'undefined') GameHud.closeWindow();
        await this.loadLevel(this.levelIdx);
        this.start();
    },

    howTo() {
        if (typeof GameHud !== 'undefined') GameHud.closeWindow();
        const go = () => Tutorial.start({ replay: true });
        if (this.state === 'menu') this.play().then(go); else go();
    },

    /** Окно интерфейса открыто/закрыто: игра на паузе, пока оно открыто. */
    onWindow(name) {
        const open = !!name;
        document.body.classList.toggle('ui-window', open);
        if (this.state === 'menu') return;
        this._winPause = open;
        Pause.set('manual', open);
        if (open) this.stopLoops();
    },

    music() {
        if (typeof GameAudio === 'undefined') return;
        if (this.save.musicOff) { GameAudio.music(null); return; }
        const boss = GameMobs.boss && GameMobs.boss.awake && !GameMobs.boss.dead;
        GameAudio.music(this.state === 'menu' ? 'menu' : boss ? 'boss' : this.level().music);
    },

    stopLoops() { if (typeof GameAudio !== 'undefined') GameAudio.stopLoops(); },
    sfx(name, d) { if (typeof GameAudio !== 'undefined') { try { GameAudio.play(name, d); } catch (e) { /* без звука */ } } },
    fx(name, d) { if (typeof GameFx !== 'undefined' && GameFx.event) { try { GameFx.event(name, d || {}); } catch (e) { console.warn('GameFx', name, e); } } },
    toast(key, kind, params) { if (typeof GameHud !== 'undefined') GameHud.toast(Lang.t(key, params), kind || 'info'); },

    heroEvents() {
        GameHero.on('step', (e) => { this.sfx('step', { volume: Math.min(1, 0.35 + (e.speed || 0) / 900) }); this.fx('step', { x: e.x, y: e.z, h: e.y, dirt: GameDirt.sample(e.x, e.z).amount }); });
        GameHero.on('jump', () => { this.sfx('jump'); this.fx('jump', { x: GameHero.x, y: GameHero.y, h: GameHero.h }); });
        GameHero.on('land', (e) => { this.sfx('land'); this.fx('land', { x: GameHero.x, y: GameHero.y, h: GameHero.h, impact: e.impact }); });
        GameHero.on('thud', () => this.sfx('land'));
        GameHero.on('jetOn', () => { if (typeof GameAudio !== 'undefined') GameAudio.jet(true); });
        GameHero.on('jetOff', () => { if (typeof GameAudio !== 'undefined') GameAudio.jet(false); });
    },

    // ---------------------------------------------------------------------------------------------
    // События мира
    // ---------------------------------------------------------------------------------------------

    padPoint(kind) { const p = GameWorld.pad(kind); return p ? { x: p.x, y: p.y, h: p.h + 60 } : null; },

    onPad(kind, inside) {
        if (!inside || (this.state !== 'run' && this.state !== 'done')) return;
        if (kind === 'sell') this.sell();
        else if (kind === 'shop') { Tutorial.complete('shop'); this.openUpgrades(); }
        else if (kind === 'launch' && this.state === 'done') this.finish();
    },

    /** Сдать содержимое ранца на станции. */
    sell() {
        if (this.tank < 0.5) return;
        const coins = Math.max(1, Math.round(this.worth * this.level().mult));
        const p = GameWorld.pad('sell');
        this.fx('sell', { x: p ? p.x : GameHero.x, y: p ? p.y : GameHero.y, h: GameHero.h, units: this.tank, coins });
        this.sfx('sell');
        this.tank = 0; this.worth = 0; this._fullSaid = 0;
        GameHero.setTank(0);
        this.addCoins(coins, GameHero.x, GameHero.y, GameHero.h + 190);
        Tutorial.complete('sell');
        this.persist();
    },

    addCoins(n, x, y, h) {
        const c = this.gain(n);
        if (!c) return;
        if (typeof GameHud === 'undefined') return;
        if (x != null) {
            const p = this.app.location.view.projectToScreen(x, y, h != null ? h : GameHero.h + 120);
            if (p && !p.behind) GameHud.float('+' + c, p.x, p.y, 'coin');
        }
    },

    onJunk(j) {
        const coins = j.info.coins * this.level().mult;
        this.addCoins(coins, GameHero.x, GameHero.y, GameHero.h + 170);
        this.sfx('suck'); this.sfx('coin');
        this.fx('pickup', { x: GameHero.x, y: GameHero.y, h: GameHero.h + 80, kind: 'junk' });
        this.chargeBlast(2);
    },

    onStar(s) {
        const st = this.stats();
        if (st.found.indexOf(s.i) < 0) st.found.push(s.i);
        this.sfx('star');
        this.fx('star', { x: s.x, y: s.y, h: s.h + 90 });
        this.toast('g.star', 'good', { a: st.found.length, b: GameWorld.stars.length });
        this.addCoins(40 * this.level().mult, s.x, s.y, s.h + 150);
        if (typeof GameHud !== 'undefined') GameHud.setStars(st.found.length, GameWorld.stars.length);
        this.persist();
    },

    onCaught(kind, x, y) {
        const coins = (kind === 'bunny' ? 30 : 22) * this.level().mult;
        this.addCoins(coins, x, y, GameHero.h + 150);
        this.sfx('coin');
        this.fx('caught', { x: GameHero.x, y: GameHero.y, h: GameHero.h + 80, kind });
        this._hud.objective = '~';
    },

    onBoss(evt, v) {
        if (typeof GameHud === 'undefined') return;
        if (evt === 'wake') { this.music(); this.toast('g.bossHint', 'warn'); }
        else if (evt === 'hp') { const q = Math.round(v * 200); if (q !== this._hud.boss) { this._hud.boss = q; GameHud.setBoss(v > 0 ? v : null, Lang.t('g.boss')); } }
        else if (evt === 'dead') { this.music(); this.toast('g.bossDown', 'good'); if (this.app.camera.shake) this.app.camera.shake(12, 0.6); }
    },

    /** Героя сбило: рэгдолл и часть грязи высыпается обратно. */
    knock(vx, vy, vz) {
        if (!GameHero.knock(vx, vy, vz)) return;
        this.sfx('hurt');
        this.fx('knock', { x: GameHero.x, y: GameHero.y, h: GameHero.h + 80 });
        if (this.app.camera.shake) this.app.camera.shake(9, 0.35);
        if (this.tank > 2) {
            const lost = this.tank * GameData.KNOCK_SPILL;
            this.worth *= 1 - GameData.KNOCK_SPILL; this.tank -= lost;
            GameDirt.spill(GameHero.x, GameHero.y, 70 + Math.sqrt(lost) * 16, 0, 0.8);
            this.toast('g.spill', 'warn');
        }
    },

    chargeBlast(units) {
        if (this.blast >= 1) return;
        this.blast = Math.min(1, this.blast + units / GameData.BLAST_COST);
        if (this.blast >= 1) { this.sfx('blast_ready'); this.toast('g.blastReady', 'good'); }
    },

    /** «Сияние»: волна вокруг героя вычищает всё и превращает грязь в монеты; мелких мобов засасывает. */
    fireBlast() {
        if (this.state !== 'run' || this.blast < 1 || GameHero.down || Pause.active) return;
        this.blast = 0;
        const r = this.val('blast');
        this.blastFx = { x: GameHero.x, y: GameHero.y, r: 0, max: r, worth: 0 };
        this.sfx('blast');
        this.fx('blast', { x: GameHero.x, y: GameHero.y, h: GameHero.h, radius: r });
        if (this.app.camera.shake) this.app.camera.shake(7, 0.3);
        GameMobs.blast(GameHero.x, GameHero.y, r);
    },

    // ---------------------------------------------------------------------------------------------
    // Улучшения и секторы
    // ---------------------------------------------------------------------------------------------

    upgradesModel() {
        const items = GameData.UPGRADES.map((u) => {
            const lv = this.lv(u.id), price = GameData.price(u.id, lv);
            const fmt = (l) => {
                const v = GameData.value(u.id, l);
                if (u.id === 'power') return '×' + v.toFixed(v < 10 ? 1 : 0);
                if (u.id === 'jet') return v > 0 ? Lang.t('up.sec', { n: v.toFixed(1) }) : Lang.t('up.locked');
                if (u.id === 'radius' || u.id === 'blast') return Lang.t('up.m', { n: (v / 100).toFixed(1) });
                if (u.id === 'speed') return Lang.t('up.m', { n: (v / 100).toFixed(1) }) + '/' + Lang.t('up.sec', { n: '' }).trim();
                return String(v);
            };
            return { id: u.id, icon: u.icon, name: Lang.t('up.' + u.id), desc: Lang.t('up.' + u.id + '.d'), level: lv, max: u.max, price,
                afford: price != null && this.coins() >= price, now: fmt(lv), next: price != null ? fmt(lv + 1) : '',
                ad: price != null ? { have: this.save.upAds[u.id] | 0, need: this.adNeed(price) } : null };
        });
        const t = GameData.tool(this.lv('power'));
        return { coins: this.coins(), tool: { tier: t.tier, name: GameData.toolName(this.lv('power')), icon: t.icon }, items };
    },

    openUpgrades() { if (typeof GameHud !== 'undefined' && this.state !== 'menu') GameHud.openUpgrades(this.upgradesModel()); },

    buy(id) {
        const u = GameData.upgrade(id), lv = this.lv(id), price = GameData.price(id, lv);
        if (!u || price == null || !this.spend(price)) { this.sfx('deny'); return; }
        this.levelUp(id);
    },

    /** Поднять улучшение на уровень (куплено за монеты или за рекламу). */
    levelUp(id) {
        const lv = this.lv(id);
        this.save.up[id] = lv + 1;
        this.save.upAds[id] = 0;
        this.sfx('buy');
        this.fx('upgrade', { id, x: GameHero.x, y: GameHero.y, h: GameHero.h });
        const before = GameData.tool(lv).tier;
        this.applyStats();
        if (id === 'power') {
            const t = GameData.tool(lv + 1);
            if (t.tier !== before) { GameHero.setTool(t.tier); this.sfx('jingle_tool'); this.toast('g.newTool', 'good', { name: GameData.toolName(lv + 1) }); }
        }
        Tutorial.complete('shop');
        this.persist();
        if (typeof GameHud !== 'undefined') { GameHud.setUpgrades(this.upgradesModel()); this._hud.coins = -1; }
    },

    openLevels() {
        if (typeof GameHud === 'undefined') return;
        const items = GameData.LEVELS.map((l, i) => {
            const s = this.save.levels[l.id] || {};
            return { index: i, name: GameData.levelName(i), unlocked: i < (this.save.unlocked | 0), done: !!s.done, stars: s.stars | 0, best: s.best || null };
        });
        GameHud.openLevels({ current: this.levelIdx, items });
    },

    /** Сектор убран, герой на площадке взлёта: итог. */
    finish() {
        if (this.state !== 'done') return;
        const L = this.level(), st = this.stats();
        this.state = 'launch';
        Platform.gameplay(false);
        this.stopLoops();
        const total = GameWorld.stars.length, found = st.found.length;
        const stars = 1 + (this.time <= L.par ? 1 : 0) + (total > 0 && found >= total ? 1 : 0);
        const first = !st.done;
        const bonus = first ? L.bonus : Math.round(L.bonus * 0.25);
        st.done = true;
        st.stars = Math.max(st.stars | 0, stars);
        st.best = st.best ? Math.min(st.best, Math.round(this.time)) : Math.round(this.time);
        const hasNext = this.levelIdx + 1 < GameData.LEVELS.length;
        if (hasNext) this.save.unlocked = Math.max(this.save.unlocked | 0, this.levelIdx + 2);
        this.addCoins(bonus);
        this.persist();
        try { Platform.ads.roundEnded(true); } catch (e) { /* площадка без рекламы */ }
        this.submitScore();
        this.sfx('jingle_win');
        this.fx('levelDone', { x: GameHero.x, y: GameHero.y, h: GameHero.h });
        if (!hasNext) this.toast('g.finale', 'good');
        // окно результата — чуть позже: пусть салют и конфетти отыграют (окно ставит игру на паузу)
        this._result = { t: 2.4, model: { name: GameData.levelName(this.levelIdx), stars, time: Math.round(this.time), best: st.best, coins: this.earned - bonus, bonus,
            starsFound: found, starsTotal: total, hasNext, tool: null, canDouble: this.adsOk() && this.earned > 0 } };
        this._bonus = bonus;
    },

    /** Счёт для рекордов: звёзды за секторы и монеты улучшений. */
    score() {
        let s = 0;
        for (const l of GameData.LEVELS) { const v = this.save.levels[l.id]; if (v && v.done) s += 1000 + (v.stars | 0) * 250; }
        for (const u of GameData.UPGRADES) s += this.lv(u.id) * 40;
        try { if (typeof GameCodex !== 'undefined' && /** @type {any} */ (GameCodex).foundTotal) s += /** @type {any} */ (GameCodex).foundTotal() * 25; } catch (e) { /* кодекс не подключён */ }
        return s;
    },

    /** «Дальше» в окне результата: взлёт ракеты и следующий сектор. */
    next() {
        if (this.state !== 'launch' || this._busy) return;
        const go = async () => {
            if (typeof GameHud !== 'undefined') GameHud.closeWindow();
            Pause.set('manual', false);
            const nextIdx = Math.min(GameData.LEVELS.length - 1, this.levelIdx + 1);
            if (GameHero.model) GameHero.model.setVisible(false);
            this.sfx('rocket');
            this.fx('rocket', { x: GameWorld.rocket ? GameWorld.rocket.def.x : GameHero.x, y: GameWorld.rocket ? GameWorld.rocket.def.y : GameHero.y, h: GameHero.h });
            GameWorld.launchRocket(async () => { await this.loadLevel(nextIdx); this.start(); });
        };
        try { Platform.ads.next(go); } catch (e) { go(); }
    },

    // ---------------------------------------------------------------------------------------------
    // Реклама за награду (rewarded): всё добровольно, награда — только после подтверждённого просмотра
    // ---------------------------------------------------------------------------------------------

    adsOk() { try { return !!Platform.rewardedSupported(); } catch (e) { return false; } },
    adWait() { try { return Math.ceil(Platform.rewardedCooldownLeft() || 0); } catch (e) { return 0; } },

    /** Показать ролик. true — награду можно выдать. Один запрос за раз; во время общей паузы — false. */
    async ad(id) {
        if (this._adBusy || !this.adsOk() || this.adWait() > 0) return false;
        this._adBusy = true;
        let ok = false;
        try { ok = (await Platform.rewarded(id)) === true; } catch (e) { ok = false; }
        this._adBusy = false;
        this.adsState(true);
        return ok;
    },

    /** Просмотров на уровень улучшения: чем дороже, тем больше (1..5). */
    adNeed(price) { return price < 150 ? 1 : price < 450 ? 2 : price < 1500 ? 3 : price < 5000 ? 4 : 5; },

    /** Улучшение за рекламу: просмотр засчитывается, на последнем — уровень. */
    async buyAd(id) {
        const u = GameData.upgrade(id), lv = this.lv(id), price = GameData.price(id, lv);
        if (!u || price == null) return;
        if (!(await this.ad('upgrade'))) { this.refreshUpgrades(); return; }
        const have = (this.save.upAds[id] | 0) + 1;
        if (have >= this.adNeed(price)) this.levelUp(id);
        else { this.save.upAds[id] = have; this.sfx('milestone'); this.persist(); this.refreshUpgrades(); }
    },
    refreshUpgrades() { if (typeof GameHud !== 'undefined' && GameHud.isOpen === 'upgrades') GameHud.setUpgrades(this.upgradesModel()); },

    /** x2 монет сектора в окне результата. */
    async doubleAd() {
        if (this.state !== 'launch' || this.doubled || !(await this.ad('result-x2'))) return;
        this.doubled = true;
        const extra = this.earned;
        this.gain(extra);
        this.sfx('buy');
        this.persist();
        const hud = /** @type {any} */ (typeof GameHud !== 'undefined' ? GameHud : null);
        if (hud && hud.setResultDoubled) hud.setResultDoubled(this.earned - this._bonus);   // строка «Награда»: собранное за сектор, удвоенное
    },

    /** Супер-буст на 90 с: x2 мощность, шире размах, x3 удача находок. */
    async boostAd() {
        if (this.state !== 'run' || this.boost > 0 || !(await this.ad('boost'))) return;
        this.boost = 90;
        this.applyStats();
        this.sfx('jingle_tool');
        this.toast('g.boostOn', 'good');
        this.fx('upgrade', { id: 'boost', x: GameHero.x, y: GameHero.y, h: GameHero.h });
    },

    /** Дрон забирает грязь прямо из ранца: сдача на месте с надбавкой 50%. */
    async droneAd() {
        if (this.state !== 'run' || this.tank < 1 || !(await this.ad('drone-sell'))) return;
        const coins = Math.max(1, Math.round(this.worth * this.level().mult * 1.5));
        this.fx('sell', { x: GameHero.x, y: GameHero.y, h: GameHero.h, units: this.tank, coins });
        this.sfx('sell');
        this.tank = 0; this.worth = 0; this._fullSaid = 0;
        GameHero.setTank(0);
        this.addCoins(coins, GameHero.x, GameHero.y, GameHero.h + 190);
        this.persist();
    },

    /** Мгновенный заряд «Сияния». */
    async blastAd() {
        if (this.state !== 'run' || this.blast >= 1 || !(await this.ad('blast-charge'))) return;
        this.blast = 1;
        this.sfx('blast_ready');
        this.toast('g.blastReady', 'good');
    },

    /** Радар: 60 с стрелка ведёт к спрятанным звёздам. */
    async radarAd() {
        if (this.state !== 'run' || this.radar > 0 || !this.radarStar() || !(await this.ad('star-radar'))) return;
        this.radar = 60;
        this.sfx('star');
        this.toast('g.radarOn', 'good');
    },
    radarStar() {
        let best = null, bd = Infinity;
        for (const s of GameWorld.stars) { if (s.state === 3) continue; const d = Math.hypot(s.x - GameHero.x, s.y - GameHero.y); if (d < bd) { bd = d; best = s; } }
        return best;
    },

    /** Монеты за рекламу (кнопка в магазине): чем дальше открытый сектор, тем больше. */
    async coinsAd() {
        if (!(await this.ad('coins'))) return;
        const top = GameData.level(Math.max(0, (this.save.unlocked | 0) - 1));
        this.gain(Math.round(250 * top.mult));
        this.sfx('buy');
        this.persist();
        if (typeof GameShopUI !== 'undefined' && GameShopUI.isOpen) GameShopUI.refresh();
    },

    /** Состояние рекламных кнопок в HUD и окнах: только при изменении (force — после ролика и тика паузы). */
    adsState(force) {
        if (typeof GameHud === 'undefined') return;
        const hud = /** @type {any} */ (GameHud);                   // новые методы HUD необязательны: проверка на месте
        const a = this._ads, sup = this.adsOk() ? 1 : 0, wait = sup ? this.adWait() : 0;
        if (sup !== a.supported || wait !== a.wait) {
            a.supported = sup; a.wait = wait;
            if (hud.setAds) hud.setAds({ supported: !!sup, wait });
            {
                this.refreshUpgrades();
                if (typeof GameShopUI !== 'undefined' && GameShopUI.isOpen) GameShopUI.refresh();
                if (typeof GameMetaUI !== 'undefined' && GameMetaUI.isOpen) GameMetaUI.refresh();
            }
        }
        const run = this.state === 'run';
        const boost = Math.ceil(this.boost);
        if (boost !== a.boost) { a.boost = boost; if (hud.setBoost) hud.setBoost(boost); }
        const drone = run && sup && this.tank >= this.cap() * 0.6 ? 1 : 0;
        if (drone !== a.drone) { a.drone = drone; if (hud.setDrone) hud.setDrone(!!drone); }
        const radar = !run || !sup || !this.radarStar() ? 'hidden' : this.radar > 0 ? String(Math.ceil(this.radar)) : 'offer';
        if (radar !== a.radar) { a.radar = radar; if (hud.setRadar) hud.setRadar(radar === 'hidden' || radar === 'offer' ? radar : Number(radar)); }
        let daily = false, wheel = false, codex = false;
        try { daily = this.dailyOn && !!DailyGift.view().canClaim; } catch (e) { daily = false; }
        try { wheel = this.wheelOn && !!Wheel.status().canSpinFree; } catch (e) { wheel = false; }
        try { codex = typeof GameCodex !== 'undefined' && !!GameCodex.hasNew && (GameCodex.hasNew() || GameCodex.claimable().length > 0); } catch (e) { codex = false; }
        const badges = (daily ? 'd' : '') + (wheel ? 'w' : '') + (codex ? 'c' : '');
        if (badges !== a.badges) { a.badges = badges; if (hud.setBadges) hud.setBadges({ daily, wheel, codex }); }
    },

    // ---------------------------------------------------------------------------------------------
    // Находки (кодекс), магазин косметики, подарок и колесо
    // ---------------------------------------------------------------------------------------------

    /** За собранную грязь изредка выпадает находка для кодекса: предмет вылетает из земли и летит к герою. */
    findRoll(units, x, y) {
        if (typeof GameCodex === 'undefined' || !GameCodex.roll) return;
        this.findAcc += units;
        if (this.findAcc < 16) return;
        this.findAcc = 0;
        let item = null;
        try { item = GameCodex.roll(this.levelIdx, this.boost > 0 ? 3 : 1); } catch (e) { item = null; }
        if (!item) return;
        const r = (GameCodex.RARITIES || []).find(q => q.id === item.rarity);
        GameWorld.dropFind(item.id, r ? r.color : '#b8c0cc', (GameCodex.RARITIES || []).indexOf(r), x, y);
    },

    onFind(id, x, y) {
        let res = null;
        try { res = GameCodex.grant(id); } catch (e) { res = null; }
        if (!res) return;
        const tier = (GameCodex.RARITIES || []).findIndex(q => q.id === (res.item && res.item.rarity));
        this.addCoins((res.coins | 0) * this.level().mult, x, y, GameHero.h + 150);
        this.sfx(tier >= 3 ? 'star' : res.isNew ? 'milestone' : 'coin');
        this.fx(tier >= 3 ? 'star' : 'pickup', { x: GameHero.x, y: GameHero.y, h: GameHero.h + 90, kind: 'ore' });
        if (typeof GameCodexUI !== 'undefined' && GameCodexUI.popup) GameCodexUI.popup(res);
    },

    openCodex() { if (typeof GameCodexUI !== 'undefined' && GameCodexUI.open) { if (typeof GameHud !== 'undefined') GameHud.closeWindow(); GameCodexUI.open(); } },
    openShop() { if (this.shopOn && typeof GameShopUI !== 'undefined') { if (typeof GameHud !== 'undefined') GameHud.closeWindow(); GameShopUI.open(); } },
    openMeta(name) {
        if (typeof GameMetaUI === 'undefined') return;
        if (typeof GameHud !== 'undefined') GameHud.closeWindow();
        if (name === 'daily' && this.dailyOn) GameMetaUI.openDaily();
        else if (name === 'wheel' && this.wheelOn) GameMetaUI.openWheel();
    },

    /** Камера-витрина магазина: герой лицом к игроку, в свободной от окна части кадра (работает и на паузе). */
    shopCam(dt) {
        const cam = /** @type {any} */ (this.app.camera), H = GameHero;
        if (!H.ch) return;
        const W = innerWidth, Hh = innerHeight, wide = W > Hh * 1.1;
        const want = H.heading + Math.PI + (wide ? 0.3 : 0);
        let da = want - cam.azimuth; da = Math.atan2(Math.sin(da), Math.cos(da));
        cam.azimuth += da * Math.min(1, dt * 6);
        cam.pitch += (0.14 - cam.pitch) * Math.min(1, dt * 6);
        // герой крупно: в альбоме — во всю высоту правой части, в портрете — в верхней трети над окном
        cam.zoomTarget = 3;
        this.cam.frameHeight += ((wide ? 370 : 700) - this.cam.frameHeight) * Math.min(1, dt * 6);
        const zoom = Math.max(0.2, typeof cam.displayZoom === 'function' ? cam.displayZoom() : 2);
        const f = H.ch.focus(this._f), az = cam.azimuth;
        // окно занимает левые ~56% ширины (в портрете — нижние ~62%): цель камеры сдвигается так, чтобы герой
        // встал в центр свободной части. Вправо на экране — (−sin az, cos az).
        const off = wide ? 0.27 * W / zoom : 0;
        this.cam.x = f[0] + Math.sin(az) * off; this.cam.y = f[2] - Math.cos(az) * off;
        this.cam.h = H.h + 100 - (wide ? 0 : 0.29 * Hh / zoom);
    },
    shopCamBack() {
        const cam = /** @type {any} */ (this.app.camera);
        cam.zoomTarget = cam.c && cam.c.zoom ? cam.c.zoom : 2;
        if (this.state === 'menu') return;
        cam.azimuth = GameHero.heading; cam.pitch = 0.5;
        this.cam.frameHeight = innerHeight > innerWidth ? 900 : 760;
        this.syncCam(true);
        try { cam.snap(); } catch (e) { /* без sight */ }
    },

    // ---------------------------------------------------------------------------------------------
    // Кадр
    // ---------------------------------------------------------------------------------------------

    update(dt) {
        if (this.state === 'boot' || !GameHero.ch) return;
        const run = this.state === 'run' || this.state === 'done';
        const H = GameHero;
        this.updateCamera(dt);
        const locked = !run;
        // грязь под ногами замедляет (слизь)
        const under = GameDirt.sample(H.x, H.y);
        const want = under.amount > 0.35 ? (GameData.DIRT[under.type] || GameData.DIRT[0]).slow : 1;
        H.slow += (want - H.slow) * Math.min(1, dt * 6);
        const T = this.tool;
        T.on = run && !H.down && this.state === 'run';
        let working = false;
        if (run) {
            const cp = H.cleanPoint(T.radius, this._cp);
            T.x = cp.x; T.y = cp.y;
            if (T.on) working = this.clean(dt, cp);
        }
        if (this.boost > 0) { this.boost = Math.max(0, this.boost - dt); if (this.boost === 0) this.applyStats(); }
        if (this.radar > 0) this.radar = Math.max(0, this.radar - dt);
        H.update(dt, { move: locked ? null : Input.move(), jump: !locked && Input.pressed('jump'), jumpHeld: !locked && Input.down('jump'), camYaw: this.app.camera.azimuth, locked, working });
        if (run) {
            this.time += this.state === 'run' && Tutorial.roundCounts() ? dt : 0;
            GameWorld.update(dt, H, T);
            GameMobs.update(dt, H, T);
            this.updateWaves(dt);
            this.progressLogic(dt);
        }
        GameDirt.flush();
        if (typeof GameLook !== 'undefined') { try { GameLook.update(dt, { hero: H, state: this.state }); } catch (e) { /* косметика не роняет игру */ } }
        if (typeof GameNpc !== 'undefined' && this.state !== 'launch') { try { GameNpc.update(dt, H); } catch (e) { /* NPC не роняют игру */ } }
        if (typeof GameAudio !== 'undefined') {
            this._vacT += ((working ? 1 : 0) - this._vacT) * Math.min(1, dt * 8);
            GameAudio.vacuum(T.on && this._vacT > 0.05, Math.min(1, 0.45 + this._vacT * 0.55));
        }
        if (typeof GameFx !== 'undefined' && GameFx.update) GameFx.update(dt, { hero: H, tool: T, working, jet: H.jet.on, state: this.state });
        this.syncCam(false);
        this.hudAll(false);
        this._saveT += dt;
        if (this._saveT > 20) { this._saveT = 0; this.persist(); }
    },

    /** Пылесос: стереть грязь под соплом и у ног, сложить в ранец. true — что-то всасывается. */
    clean(dt, cp) {
        const T = this.tool, cap = this.cap();
        let room = cap - this.tank;
        if (room <= 0.01) {
            if (this._fullSaid <= 0) { this._fullSaid = 7; this.toast('g.tankFull', 'warn'); this.sfx('tank_full'); this.fx('tankFull', { x: GameHero.x, y: GameHero.y, h: GameHero.h }); }
            this._fullSaid -= dt;
            return false;
        }
        const k = T.mul * GameData.CLEAN_RATE * dt;
        let units = 0, worth = 0, type = 0, area = 0, cx = cp.x, cy = cp.y;
        const a = GameDirt.clean(cp.x, cp.y, T.radius, k, room);
        units += a.units; worth += a.worth; type = a.type; area = a.area; cx = a.cx; cy = a.cy;
        room -= a.units;
        if (room > 0) {
            const b = GameDirt.clean(GameHero.x, GameHero.y, T.radius * 0.6, k, room);
            units += b.units; worth += b.worth;
            if (b.units > a.units) { type = b.type; cx = b.cx; cy = b.cy; }
        }
        if (units <= 0) { this._idle += dt; return false; }
        this._idle = 0;
        this.tank = Math.min(cap, this.tank + units);
        this.worth += worth;
        this.chargeBlast(units);
        this.findRoll(units, cx, cy);
        GameHero.setTank(this.tank / cap);
        this.fx('clean', { x: cx, y: cy, h: GameWorld.ground(cx, cy), type, units, radius: T.radius, area });
        return true;
    },

    /** Волны: «Сияние» героя и финальная «волна блеска». */
    updateWaves(dt) {
        const mult = this.level().mult;
        const b = this.blastFx;
        if (b) {
            b.r = Math.min(b.max, b.r + 1500 * dt);
            b.worth += GameDirt.clean(b.x, b.y, b.r, 99, Infinity, true).worth;
            if (b.r >= b.max) { this.blastFx = null; this.addCoins(b.worth * mult * 0.7, GameHero.x, GameHero.y, GameHero.h + 200); }
        }
        const w = this.wave;
        if (w) {
            w.r += 1700 * dt;
            w.worth += GameDirt.clean(w.x, w.y, w.r, 99, Infinity, true).worth;
            if (w.r >= w.max) {
                this.wave = null;
                this.addCoins(w.worth * mult, GameHero.x, GameHero.y, GameHero.h + 200);
                this.state = 'done';
                GameWorld.setLaunch(true);
                this.toast('g.goRocket', 'good');
                this.sfx('unlock');
                this.persist();
            }
        }
    },

    /** Прогресс сектора: вехи, финальная волна, цель и указатель. */
    progressLogic(dt) {
        const p = GameDirt.progress;
        if (this.state === 'run' && !this.wave) {
            const marks = [0.25, 0.5, 0.75];
            if (this._mile < marks.length && p >= marks[this._mile]) {
                this.toast(['g.m25', 'g.m50', 'g.m75'][this._mile], 'good'); this.sfx('milestone');
                this.fx('milestone', { x: GameHero.x, y: GameHero.y, h: GameHero.h, n: this._mile }); this._mile++;
            }
            if (p >= GameData.FINISH_AT && GameMobs.pending() === 0) {
                const loc = this.app.location;
                this.wave = { x: GameHero.x, y: GameHero.y, r: 0, worth: 0, max: Math.hypot(loc.width, loc.height) };
                this.toast('g.wave', 'good'); this.sfx('wave_clean');
                this.fx('wave', { x: GameHero.x, y: GameHero.y, h: GameHero.h, max: this.wave.max });
            }
        }
        // ближайшее пятно — не каждый кадр
        this._nearT -= dt;
        if (this._nearT <= 0) { this._nearT = 0.4; this._near = (p > 0.8 || this._idle > 5) && this.state === 'run' ? GameDirt.nearest(GameHero.x, GameHero.y) : null; }
    },

    objective() {
        if (this.state === 'done') return Lang.t('g.goRocket');
        if (this.state !== 'run' || Tutorial.active) return '';
        if (this.tank >= this.cap() - 0.01) return Lang.t('g.goSell');
        if (GameMobs.bunnyTotal && GameMobs.bunnies.length) return Lang.t('g.bunnies', { a: GameMobs.bunnyTotal - GameMobs.bunnies.length, b: GameMobs.bunnyTotal });
        if (GameMobs.slugTotal && GameMobs.slugs.length) return Lang.t('g.slugs', { a: GameMobs.slugTotal - GameMobs.slugs.length, b: GameMobs.slugTotal });
        if (GameMobs.boss && GameMobs.boss.awake && !GameMobs.boss.dead) return Lang.t('g.bossHint');
        if (GameDirt.progress > 0.9) return Lang.t('g.almost');
        return Lang.t('g.clean');
    },

    /** Указатель HUD: куда идти (станция при полном баке, ракета, остатки грязи). */
    pointer() {
        let t = null, kind = '', label = '';
        if (this.state === 'done') { t = this.padPoint('launch'); kind = 'rocket'; label = Lang.t('lbl.launch'); }
        else if (this.state === 'run' && this.tank >= this.cap() - 0.01) { t = this.padPoint('sell'); kind = 'sell'; label = Lang.t('lbl.sell'); }
        else if (this.state === 'run' && this.radar > 0 && this.radarStar()) { const st = this.radarStar(); t = { x: st.x, y: st.y, h: st.h + 60 }; kind = 'star'; }
        else if (this.state === 'run' && this._near) { t = { x: this._near.x, y: this._near.y, h: GameWorld.ground(this._near.x, this._near.y) + 40 }; kind = 'dirt'; }
        if (!t || Tutorial.active) return null;
        const view = this.app.location.view, p = view.projectToScreen(t.x, t.y, t.h);
        const W = typeof ViewCap !== 'undefined' && ViewCap.width ? ViewCap.width() : innerWidth, Hh = innerHeight;
        if (!p) return null;
        const m = 70, px = typeof ViewCap !== 'undefined' && ViewCap.x ? ViewCap.x(p.x) : p.x;
        const on = !p.behind && px > m && px < W - m && p.y > m + 40 && p.y < Hh - m - 60;
        if (on) return { x: px, y: p.y, angle: Math.PI / 2, onScreen: true, kind, label };
        let dx = px - W / 2, dy = p.y - Hh / 2;
        if (p.behind) { dx = -dx; dy = Math.abs(dy) + Hh; }
        const ang = Math.atan2(dy, dx);
        const kx = (W / 2 - m) / Math.max(1e-3, Math.abs(Math.cos(ang))), ky = (Hh / 2 - m - 30) / Math.max(1e-3, Math.abs(Math.sin(ang)));
        const k = Math.min(kx, ky);
        return { x: W / 2 + Math.cos(ang) * k, y: Hh / 2 + Math.sin(ang) * k, angle: ang, onScreen: false, kind, label };
    },

    /** HUD: числа обновляются только при изменении. */
    hudAll(force) {
        if (typeof GameHud === 'undefined') return;
        const h = this._hud, cap = this.cap();
        if (force) { h.coins = -1; h.progress = -1; h.tank = -1; h.cap = -1; h.blast = -1; h.jet = -2; h.objective = '~'; h.boss = -2;
            GameHud.setSector({ index: this.levelIdx, total: GameData.LEVELS.length, name: GameData.levelName(this.levelIdx) });
            GameHud.setStars(this.stats().found.length, GameWorld.stars.length);
            GameHud.setBoss(null, '');
        }
        const coins = this.coins();
        if (coins !== h.coins) { h.coins = coins; GameHud.setCoins(coins); }
        const pr = Math.round(GameDirt.progress * 1000);
        if (pr !== h.progress) { h.progress = pr; GameHud.setProgress(this.state === 'done' ? 1 : GameDirt.progress); }
        const tk = Math.round(this.tank * 4);
        if (tk !== h.tank || cap !== h.cap) { h.tank = tk; h.cap = cap; GameHud.setTank(Math.floor(this.tank + 0.001), cap); }
        const bl = Math.round(this.blast * 100);
        if (bl !== h.blast) { h.blast = bl; GameHud.setBlast(this.blast); }
        const jet = GameHero.jet.max > 0 ? Math.round(GameHero.jet.fuel / GameHero.jet.max * 50) : -1;
        if (jet !== h.jet) { h.jet = jet; GameHud.setJet(jet < 0 ? null : jet / 50); }
        const ob = this.objective();
        if (ob !== h.objective) { h.objective = ob; GameHud.setObjective(ob || null); }
    },

    /** Каждый кадр, и на паузе: подписи мира, указатель, ролик взлёта, витрина меню. */
    frame(dt) {
        if (this.state === 'boot') return;
        if (this._result && !Pause.active) {
            this._result.t -= dt;
            if (this._result.t <= 0) { const m = this._result.model; this._result = null; if (this.state === 'launch' && typeof GameHud !== 'undefined') GameHud.openResult(m); }
        }
        GameWorld.frame();
        if (typeof GameHud !== 'undefined') GameHud.setPointer(this.state === 'run' || this.state === 'done' ? this.pointer() : null);
        if (this.state === 'launch') {
            const r = GameWorld.rocketFrame(dt);
            if (r) { this.cam.x = r.x; this.cam.y = r.y; this.cam.h = r.h + 200; this.cam.frameHeight = 900 + r.t * 500; this.fx('rocketFrame', r); }
        }
        if (typeof GameFx !== 'undefined' && GameFx.frame) GameFx.frame(dt);
        if (typeof GameLook !== 'undefined') { try { GameLook.frame(dt); } catch (e) { /* косметика не роняет игру */ } }
        if (typeof GameNpc !== 'undefined') { try { GameNpc.frame(dt); } catch (e) { /* NPC не роняют игру */ } }
        if (this._shop) this.shopCam(dt);
        this.adsState(false);
    },

    // ---------------------------------------------------------------------------------------------
    // Камера
    // ---------------------------------------------------------------------------------------------

    updateCamera(dt) {
        const cam = this.app.camera;
        if (cam.followObj !== this.cam) cam.follow(this.cam);
        const look = Input.consumeLook();
        if (this._shop) return;                                     // магазин: камера-витрина в shopCam
        if (this.state === 'menu') {
            // витрина: герой лицом к игроку, камера медленно покачивается
            const t = performance.now() / 1000;
            const want = GameHero.heading + Math.PI + 0.5 + Math.sin(t * 0.3) * 0.12;
            let da = want - cam.azimuth; da = Math.atan2(Math.sin(da), Math.cos(da));
            cam.azimuth += da * Math.min(1, dt * 3);
            cam.pitch += (0.2 - cam.pitch) * Math.min(1, dt * 2);
            this.cam.frameHeight += (400 - this.cam.frameHeight) * Math.min(1, dt * 3);
            return;
        }
        if (this.state === 'launch') return;
        const tall = innerHeight > innerWidth;
        this.cam.frameHeight += ((tall ? 900 : 760) - this.cam.frameHeight) * Math.min(1, dt * 3);
        if (look.dx || look.dy) { this.lookT = 1.8; cam.azimuth += look.dx * 0.0048; cam.pitch = Math.max(0.08, Math.min(1.2, cam.pitch + look.dy * 0.0036)); }
        this.lookT = Math.max(0, this.lookT - dt);
        // мягкий автодоворот за спину, когда игрок бежит вперёд и сам камеру не крутит
        const H = GameHero, v = H.vel, sp = Math.hypot(v[0], v[2]);
        const m = Input.move();
        const fwd = m.y > 0.35 ? m.y * (1 - Math.min(1, Math.abs(m.x) * 1.4)) : 0;
        if (this.lookT <= 0 && fwd > 0 && sp > 160 && H.grounded) {
            let da = H.heading - cam.azimuth; da = Math.atan2(Math.sin(da), Math.cos(da));
            if (Math.abs(da) < 2.2) cam.azimuth += da * Math.min(1, dt * 1.1 * fwd) * Math.min(1, sp / 420);
            cam.pitch += (0.5 - cam.pitch) * Math.min(1, dt * 0.5);
        }
        cam.azimuth = Math.atan2(Math.sin(cam.azimuth), Math.cos(cam.azimuth));
    },

    syncCam(snap) {
        const H = GameHero;
        if (!H.ch || this.state === 'launch') return;
        const f = H.ch.focus(this._f);
        const k = H.ch.ragdolled && !snap ? 0.25 : 1;
        this.cam.x += (f[0] - this.cam.x) * k; this.cam.y += (f[2] - this.cam.y) * k;
        this.cam.h = H.h + 105;
        if (this._shop) return;
        if (this.state === 'menu') {
            // цель левее героя: он встаёт в правую часть кадра, меню слева его не закрывает
            const az = this.app.camera.azimuth, wide = innerWidth > innerHeight * 1.1;
            const off = wide ? 130 : 0;
            this.cam.x += Math.sin(az) * off; this.cam.y -= Math.cos(az) * off;
            this.cam.h = H.h + (wide ? 100 : 70);
        }
    },
};
