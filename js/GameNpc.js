// GameNpc.js — жители лунной базы: продавец улучшений, оператор станции, коллеги-уборщики и мелкая «жизнь»
// (робот-пылесос, грузовой дрон). Точки берутся из маркеров карты (npc-shop, npc-sell, npc, npc-2 …); нет маркеров —
// запасные точки от площадок GameWorld.pads и маркера spawn.
//
//   await GameNpc.build(app, level)   // prepare, после героя и Nav.build
//   GameNpc.update(dt, GameHero)      // каждый кадр вне паузы (и в меню — база живёт за спиной)
//   GameNpc.frame(dt)                 // каждый кадр: ники и пузыри (DOM поверх холста)
//   GameNpc.clear()                   // перед сменой сектора
//
// Человечки — HumanoidCharacter (один общий мир с лунной гравитацией); решения — по числам и Nav, не по Babylon.
// Вся логика на dt (без таймеров): на паузе всё стоит.

/** @satisfies {Record<string, any>} */
const GameNpc = {
    /** @type {any} */ app: null,
    /** @type {any} */ view: null,
    /** @type {any} */ world: null,
    /** @type {any[]} */ actors: [],
    /** @type {any[]} */ points: [],        // точки «жизни»: { x, y, taken }
    /** @type {any} */ spots: null,         // места сдачи у станции
    /** @type {any} */ micro: { robot: null, drone: null },
    /** @type {any} */ box: null,           // DOM-слой ников
    /** @type {Map<string, any>} */ mats: new Map(),
    /** @type {Record<string, any>} */ models: {},
    /** @type {any} */ base: { x: 0, y: 0 },
    /** @type {any} */ cfg: null,
    gen: 0,
    t: 0,
    ready: false,
    warned: false,
    heroDown: false,
    heroChatCd: 0,
    _frameN: 0,
    _sellEdge: false,
    _shopEdge: false,

    // ---------------------------------------------------------------------------------------------
    // Данные: ники, должности, реплики (внутри файла, это данные, не ключи Lang)
    // ---------------------------------------------------------------------------------------------

    NAMES: {
        ru: ['Мойдодыр3000', 'ЧистоЛуна', 'хХ_Пылюка_Хх', 'ПылесосКот', 'ЛунныйЁжик', 'Пыльная_Булка', 'Космо_Макс', 'ТапокНаЛуне',
            'ЗвёздныйБублик', 'Мусорок_Лун', 'ЧистюляАрт', 'Кратер_Вася', 'Метеор_Тоша', 'НеПылитеТут', 'ЛуноХод_07', 'Сияй_Серёга'],
        en: ['Cosmo_Max', 'LunaFox', 'xX_Dusty_Xx', 'CraterKing', 'MoonSweeper9', 'DustBunny', 'SpaceMop_Joe', 'Clean_Comet',
            'VacuumViking', 'StarScrubber', 'NoDustZone', 'LunarLarry', 'Meteor_Mia', 'ZeroG_Zed', 'TidyTitan', 'PixelPlume'],
    },
    SHOP_NAME: { ru: 'Мастер_Гаечка', en: 'WrenchWizard' },
    OP_NAME: { ru: 'СтанцияЗина', en: 'RecycleRex' },
    ROLES: {
        shop: { ru: 'Мастер', en: 'Mechanic', color: '#ffb347' },
        op: { ru: 'Оператор', en: 'Operator', color: '#7dffb0' },
        clean: { ru: 'Уборщик', en: 'Cleaner', color: '#9fd8ff' },
    },

    SAY: {
        shopGreet: {
            ru: ['Улучшения! Лучшие на Луне!', 'Эй, пилот! Загляни, апгрейды!', 'Пылесос слабоват? Починим!', 'Ранец побольше? Есть такой!',
                'Подходи, не кусаюсь!', 'Свежие детали! Почти без пыли!', 'Монеты есть? Гайки найдутся!', 'Привет! Хочешь мощнее?',
                'Скидок нет, зато качество!', 'Лучший сервис в радиусе ста кратеров!'],
            en: ['Upgrades! The best on the Moon!', 'Hey pilot! Check my upgrades!', 'Weak vacuum? We will fix it!', 'Bigger tank? Got one!',
                'Come closer, I do not bite!', 'Fresh parts! Barely dusty!', 'Got coins? I got bolts!', 'Hi! Want more power?',
                'No discounts, but top quality!', 'Best service within a hundred craters!'],
        },
        shopIdle: {
            ru: ['Гаечка к гаечке...', 'Пыль в ключе, опять!', 'Где мой молоток?..', 'Сегодня тихо на базе.', 'Почти закончил новый бак.',
                'Лунные дни длинные...', 'Ключ на 17, где ты?', 'Кто опять трогал мои болты?'],
            en: ['Nut to nut...', 'Dust in my wrench, again!', 'Where is my hammer?..', 'Quiet day at the base.', 'Almost done with a new tank.',
                'Moon days are long...', 'Wrench size 17, where are you?', 'Who touched my bolts again?'],
        },
        shopBuy: {
            ru: ['Отличный выбор!', 'Бери, не пожалеешь!', 'Золотые руки у тебя!', 'Мощность — это сила!', 'Приходи ещё!', 'Сам бы купил!'],
            en: ['Great choice!', 'Take it, you will not regret!', 'You have golden hands!', 'Power is strength!', 'Come again!', 'I would buy it myself!'],
        },
        opGreet: {
            ru: ['Грязь сдавай сюда!', 'Станция работает!', 'Бак полон? Давай на переработку!', 'Привет, герой уборки!', 'Сдача — на зелёный круг!',
                'Перерабатываем всё!', 'Монетки за пыль, как обычно!', 'Тут сдают пыль!'],
            en: ['Drop your dirt here!', 'The station is running!', 'Full tank? Bring it in!', 'Hello, cleaning hero!', 'Drop-off is on the green circle!',
                'We recycle everything!', 'Coins for dust, as usual!', 'Dust drop-off here!'],
        },
        opSell: {
            ru: ['Ура, переработка!', 'Вот это улов!', 'Монеты твои!', 'Станция довольна!', 'Чистая работа!', 'Так держать!',
                'Пыль в деньги, красота!', 'Ещё один бак чистоты!'],
            en: ['Yay, recycling!', 'What a haul!', 'Coins are yours!', 'The station is happy!', 'Clean work!', 'Keep it up!',
                'Dust into cash, beautiful!', 'Another tank of clean!'],
        },
        opIdle: {
            ru: ['Планшет говорит: пыли много.', 'Шестерёнки гудят, всё в норме.', 'Давление в норме, пыль тоже.', 'Кто сегодня сдаёт?',
                'Пыль — тоже ресурс!', 'Станция не простаивает.', 'Проверяю отчёты...', 'Сорок баков за смену!'],
            en: ['Tablet says: lots of dust.', 'Gears humming, all good.', 'Pressure fine, dust too.', 'Who drops off today?',
                'Dust is a resource too!', 'The station never idles.', 'Checking reports...', 'Forty tanks per shift!'],
        },
        opSeeSold: {
            ru: ['Принято! Молодец!', 'Записал в журнал!', 'Хороший бак!', 'Отлично, коллега!', 'Чисто работаешь!', 'В переработку!'],
            en: ['Accepted! Nice job!', 'Logged it!', 'Good tank!', 'Great, colleague!', 'Clean work!', 'Off to recycling!'],
        },
        cleanWork: {
            ru: ['Вжжжж!', 'Пыль, держись!', 'Сейчас всё уберу!', 'Ещё кусочек...', 'Ух, много пыли!', 'Чистота — моя работа!',
                'Всасываем!', 'Пылесос, не подведи!', 'Тут грязнее, чем думал.', 'Шик и блеск!'],
            en: ['Vroom!', 'Hold on, dust!', 'Cleaning it all up!', 'One more patch...', 'Wow, so much dust!', 'Clean is my job!',
                'Sucking it up!', 'Do not fail me, vacuum!', 'Dirtier than I thought.', 'Shine and sparkle!'],
        },
        cleanSold: {
            ru: ['Сдал! Монетки мои!', 'Бак пустой, душа лёгкая.', 'Ну вот, переработали.', 'Станция, принимай!', 'Ещё один рейс!',
                'Пыль превращается в деньги!', 'Сдано чисто!', 'Теперь можно и отдохнуть.'],
            en: ['Delivered! Coins are mine!', 'Empty tank, light heart.', 'Well, recycled.', 'Station, take it!', 'One more trip!',
                'Dust turns into cash!', 'Delivered clean!', 'Time for a little rest.'],
        },
        cleanJoke: {
            ru: ['Пыль повсюду, даже в мыслях.', 'Я не пылесос, я профессионал!', 'Луна без пыли — это не Луна.', 'Кто разбросал эти камни?',
                'Скучаю по ветру... а, его нет.', 'Мой пылесос круче твоего!', 'Метеориты — вот кто главный грязнуля.', 'Ещё немного, и я блестну.',
                'А на Земле хоть дождь есть...', 'Левой, правой, пыль долой!'],
            en: ['Dust everywhere, even in my thoughts.', 'I am no vacuum, I am a pro!', 'A Moon without dust is not a Moon.', 'Who scattered these rocks?',
                'I miss the wind... oh wait, none here.', 'My vacuum beats yours!', 'Meteors are the real messy ones.', 'A little more and I will shine.',
                'At least Earth has rain...', 'Left, right, dust is gone!'],
        },
        cleanHello: {
            ru: ['Привет, коллега!', 'О, ты тоже тут!', 'Как пыль, как дела?', 'Классный пылесос!', 'Давай вместе уберём!', 'Хей! Не засоряй базу!',
                'Видел, сколько пыли у кромки?', 'Здорово, чистюля!'],
            en: ['Hi, colleague!', 'Oh, you are here too!', 'How is the dust, how are you?', 'Cool vacuum!', 'Let us clean together!', 'Hey! Keep the base tidy!',
                'Saw how much dust is at the edge?', 'Yo, clean freak!'],
        },
        cleanTalk: {
            ru: ['Слышал, где грязнее всего?', 'Мой бак сегодня полный!', 'Видел метеорит? Страшно!', 'Как тебе новая станция?', 'Пойдём вместе на кромку?',
                'Устал, а пыли не убывает.', 'Хочу апгрейд у Мастера!', 'Шутка: чем пылесос лучше? Он не болтает!'],
            en: ['Heard where it is dirtiest?', 'My tank is full today!', 'Seen a meteor? Scary!', 'How do you like the new station?', 'Want to hit the edge together?',
                'Tired, and the dust never ends.', 'I want an upgrade from the Mechanic!', 'Joke: why is a vacuum better? It does not chatter!'],
        },
        cleanReply: {
            ru: ['Ха, точно!', 'И не говори!', 'Согласен на сто пудов!', 'Ну да, ну да.', 'Ага, пойду проверю.', 'Ха-ха, ну ты даёшь!',
                'Вот это новости!', 'Да ладно?!'],
            en: ['Ha, exactly!', 'Tell me about it!', 'Totally agree!', 'Yeah, yeah.', 'Yep, will go check.', 'Haha, good one!',
                'Now that is news!', 'No way?!'],
        },
        sympathy: {
            ru: ['Ты как? Метеориты — зло!', 'Ох! Держись, герой!', 'Вставай, мы с тобой!', 'Больно? Пыль смягчит падение!', 'Не расстраивайся, бывает!',
                'Цел? Ничего, отряхнись!', 'Метеорит снова хулиганит!'],
            en: ['You OK? Meteors are evil!', 'Ouch! Hang in there, hero!', 'Get up, we are with you!', 'Hurt? Dust softens the fall!', 'Do not be sad, it happens!',
                'In one piece? Dust yourself off!', 'That meteor is misbehaving again!'],
        },
    },

    COLORS: {
        skin: [[255, 217, 176], [240, 190, 150], [214, 160, 118], [168, 118, 84], [120, 82, 56], [255, 226, 196]],
        suit: [0xe84a5f, 0x3fa7ff, 0xb06cff, 0xffd23f, 0x2ec4b6, 0xff7ab8],
        pants: [0x3a2f55, 0x23405e, 0x4a2c4a, 0x5a4a22, 0x1f4d48, 0x5a2f45],
        hair: [0x2b1a10, 0x7a4a1c, 0xd9b04a, 0xc4452e, 0x1c1c26, 0xe6e6f0],
        styles: ['spiky', 'mohawk', 'bun', 'short', 'long', 'spiky'],
    },

    // ---------------------------------------------------------------------------------------------
    // Сборка и уборка
    // ---------------------------------------------------------------------------------------------

    async build(app, level) {
        this.clear();
        const gen = ++this.gen;
        this.app = app;
        try {
            this.view = app.location.view;
            this.world = CharacterPhysics.navWorld(Nav, { ground: (x, z) => app.location.terrain.fieldHeight(x, z) });
            this.world.gravity = 560;
            this.cfg = { level };
            await this.loadModels();
            if (gen !== this.gen) return;
            this.layout();
            this.mkLayer();
            this.mkShop();
            this.mkOperator();
            const low = typeof Quality !== 'undefined' && (Quality.level === 0 || /** @type {any} */ (Quality.level) === 'low');
            const mob = typeof IS_MOBILE !== 'undefined' && IS_MOBILE;
            const n = low ? 1 : mob ? 2 : 3;
            for (let i = 0; i < n; i++) this.mkCleaner(i);
            this.mkRobot();
            this.mkDrone();
            this.t = 0; this.warned = false; this.heroDown = false; this.heroChatCd = 0;
            this.ready = true;
        } catch (e) {
            console.warn('GameNpc.build', e);
        }
    },

    async loadModels() {
        this.models = {};
        for (const [k, url] of [['tank', 'assets/models/game/tank.glb'], ['vac1', 'assets/models/game/vac_1.glb'], ['vac2', 'assets/models/game/vac_2.glb']]) {
            try { this.models[k] = await Model3D.load(url); } catch (e) { this.models[k] = null; }
        }
    },

    clear() {
        this.gen++;
        this.ready = false;
        const view = this.view;
        for (const a of this.actors) this.disposeActor(a);
        this.actors = [];
        for (const k of ['robot', 'drone']) {
            const m = this.micro[k];
            if (m && m.root) { try { if (view) World3D.removeObject(view, m.root); m.root.dispose(false, false); } catch (e) { /* уже */ } }
            this.micro[k] = null;
        }
        for (const m of this.mats.values()) { try { m.dispose(); } catch (e) { /* уже */ } }
        this.mats.clear();
        this.points = []; this.spots = null;
        if (this.box) { try { this.box.remove(); } catch (e) { /* уже */ } this.box = null; }
        this.models = {};
    },

    disposeActor(a) {
        const view = this.view;
        for (const r of a.roots) { try { Model3D.dispose(view, r); } catch (e) { /* уже */ } }
        for (const m of a.extras) { try { World3D.removeObject(view, m); } catch (e) { /* не регистрировался */ } try { m.dispose(false, false); } catch (e) { /* уже */ } }
        try { if (a.ch) a.ch.dispose(); } catch (e) { /* уже */ }
        a.ch = null; a.roots = []; a.extras = [];
    },

    // ---------------------------------------------------------------------------------------------
    // Точки: маркеры карты или запасные от площадок
    // ---------------------------------------------------------------------------------------------

    padOf(kind) { return (typeof GameWorld !== 'undefined' && GameWorld.pads ? GameWorld.pads : []).find((/** @type {any} */ p) => p.kind === kind) || null; },

    /** Точка запрещена: заблокирована Nav или внутри площадки shop/launch (с запасом). */
    badSpot(x, y, margin) {
        if (Nav.blocked(x, y, 40)) return true;
        for (const p of GameWorld.pads) if ((p.kind === 'shop' || p.kind === 'launch') && Math.hypot(x - p.x, y - p.y) < p.r + (margin == null ? 70 : margin)) return true;
        return false;
    },

    layout() {
        const loc = this.app.location;
        const sp = loc.marker('spawn') || { x: loc.width / 2, y: loc.height / 2, rot: [0, 0, 0] };
        this.base = { x: sp.x, y: sp.y, yaw: ((sp.rot ? sp.rot[1] : 0) || 0) * Math.PI / 180 };
        const mk = (/** @type {any} */ m) => m ? { x: m.x, y: m.y, heading: ((m.rot ? m.rot[1] : 0) || 0) * Math.PI / 180 } : null;
        const side = (/** @type {string} */ kind) => {
            const p = this.padOf(kind);
            if (!p) return null;
            let dx = p.x - sp.x, dy = p.y - sp.y;
            const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
            let best = null;
            for (const da of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.4, -2.4, 3.14]) {
                const c = Math.cos(da), s = Math.sin(da), ux = dx * c - dy * s, uy = dx * s + dy * c;
                const x = p.x + ux * 260, y = p.y + uy * 260;
                if (!this.badSpot(x, y, 40)) { best = { x, y }; break; }
            }
            if (!best) return null;
            return { x: best.x, y: best.y, heading: Math.atan2(sp.y - best.y, sp.x - best.x) };
        };
        const fb = (/** @type {number} */ k) => ({ x: sp.x + (k ? -1 : 1) * 500, y: sp.y, heading: k ? 0 : Math.PI });
        this.shopPt = mk(loc.marker('npc-shop')) || side('shop') || fb(0);
        this.opPt = mk(loc.marker('npc-sell')) || side('sell') || fb(1);
        // точки «жизни»
        const pts = [];
        const names = ['npc'];
        for (let i = 2; i <= 24; i++) names.push('npc-' + i);
        for (const n of names) for (const m of loc.markers(n)) pts.push({ x: m.x, y: m.y, taken: null });
        if (!pts.length) {
            const n = 14;
            for (let i = 0; i < n; i++) {
                const a = (i / n) * Math.PI * 2 + Math.random() * 0.3, r = 450 + Math.random() * 250;
                const x = sp.x + Math.cos(a) * r, y = sp.y + Math.sin(a) * r;
                if (x < 80 || y < 80 || x > loc.width - 80 || y > loc.height - 80 || this.badSpot(x, y)) continue;
                if (pts.some(q => Math.hypot(q.x - x, q.y - y) < 150)) continue;
                pts.push({ x, y, taken: null });
            }
        }
        this.points = pts.filter(p => !this.badSpot(p.x, p.y, 40));
        // места сдачи вокруг площадки sell (или у оператора)
        const sp2 = this.padOf('sell');
        const c = sp2 ? { x: sp2.x, y: sp2.y } : { x: this.opPt.x, y: this.opPt.y };
        this.station = { x: c.x, y: c.y, r: sp2 ? sp2.r : 130 };
        this.spots = [0, 1, 2, 3, 4].map(i => {
            const a = i * 1.26 + 0.4, r = i ? Math.min(75, this.station.r * 0.55) : 0;
            return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r, taken: null };
        });
    },

    // ---------------------------------------------------------------------------------------------
    // Материалы и вид
    // ---------------------------------------------------------------------------------------------

    mat(hex, emis) {
        const key = hex + ':' + (emis == null ? 0.16 : emis);
        let m = this.mats.get(key);
        if (m) return m;
        const scene = this.view.scene;
        m = new BABYLON.StandardMaterial('npc-' + key, scene);
        m.diffuseColor = Humanoid.color3(hex);
        const e = emis == null ? 0.16 : emis;
        m.emissiveColor = m.diffuseColor.scale(e);
        m.specularColor = new BABYLON.Color3(0.08, 0.08, 0.08);
        if (e > 0.9) { m.disableLighting = true; m.metadata = { toon: false }; }
        this.mats.set(key, m);
        return m;
    },

    glassMat() {
        let m = this.mats.get('glass');
        if (m) return m;
        m = new BABYLON.StandardMaterial('npc-glass', this.view.scene);
        m.diffuseColor = new BABYLON.Color3(0.72, 0.9, 1);
        m.emissiveColor = new BABYLON.Color3(0.25, 0.34, 0.42);
        m.specularColor = new BABYLON.Color3(1, 1, 1);
        m.specularPower = 90;
        m.alpha = 0.2;
        m.backFaceCulling = true;
        m.metadata = { toon: false };
        this.mats.set('glass', m);
        return m;
    },

    /** Меш-коробка в списке (для слияния): размеры, позиция, поворот. */
    box1(list, w, h, d, x, y, z, ry, rz) {
        const b = BABYLON.MeshBuilder.CreateBox('npc-b', { width: w, height: h, depth: d }, this.view.scene);
        b.position.set(x, y, z);
        if (ry) b.rotation.y = ry;
        if (rz) b.rotation.z = rz;
        list.push(b);
        return b;
    },

    boxer(list) { return (/** @type {number[]} */ ...p) => this.box1(list, p[0], p[1], p[2], p[3], p[4], p[5], p[6] || 0, p[7] || 0); },

    /** Сливает список коробок в один меш и вешает на родителя. */
    merged(list, name, material, parent, actor) {
        const m = BABYLON.Mesh.MergeMeshes(list, true, true);
        if (!m) return null;
        m.name = name; m.material = material; m.parent = parent; m.isPickable = false;
        World3D.addObject(this.view, m, 'actor');
        actor.extras.push(m);
        return m;
    },

    /** Волосы: оси головы x вперёд, y вверх, z вправо (голова 44×44×50). */
    hair(a, head, style, hex) {
        const L = [], B = this.boxer(L);
        if (style === 'spiky') {
            B(46, 8, 52, 0, 24, 0); B(17, 6, 20, 8, 29, -11, 0.2, 0.1); B(18, 6, 19, -5, 30, 9, -0.25, -0.08); B(16, 6, 18, 9, 29, 13, 0.15, 0.1);
            B(6, 8, 36, 22.5, 19, 3); B(6, 26, 48, -22.5, 10, 0); B(34, 18, 5, -4, 13, -25.5); B(34, 18, 5, -4, 13, 25.5);
        } else if (style === 'mohawk') {
            B(46, 5, 52, 0, 23, 0); B(40, 15, 9, -2, 30, 0); B(14, 9, 9, 16, 28, 0); B(8, 24, 48, -22.5, 4, 0, 0, 0);
        } else if (style === 'bun') {
            B(46, 8, 52, 0, 24, 0); B(6, 26, 48, -22.5, 10, 0); B(6, 8, 50, 22.5, 19, 0); B(16, 16, 16, -26, 34, 0); B(34, 18, 5, -4, 13, -25.5); B(34, 18, 5, -4, 13, 25.5);
        } else if (style === 'long') {
            B(46, 8, 52, 0, 24, 0); B(6, 8, 50, 22.5, 19, 0); B(7, 56, 54, -23, -4, 0); B(30, 40, 5, -6, 4, -26); B(30, 40, 5, -6, 4, 26);
        } else {
            B(46, 8, 52, 0, 24, 0); B(6, 8, 50, 22.5, 19, 0); B(6, 26, 48, -22.5, 10, 0); B(34, 14, 5, -4, 15, -25.5); B(34, 14, 5, -4, 15, 25.5);
        }
        return this.merged(L, 'npc-hair', this.mat(hex, 0.16), head, a);
    },

    /** Тело одетого человечка. spec: { role, name, x, y, heading, skin, top, bottom, hair, hairHex, helmet, wear }. */
    dress(a, spec) {
        const m = a.ch.model, view = this.view;
        if (!m) return;
        const white = this.mat(0xf2f4ff, 0.16);
        for (const n of ['UpperArmL', 'UpperArmR']) { const p = m.part(n); if (p) p.material = m.mats.top; }
        for (const n of ['HandL', 'HandR', 'FootL', 'FootR']) { const p = m.part(n); if (p) p.material = white; }
        const head = m.part('Head');
        if (!head) return;
        if (spec.hair) this.hair(a, head, spec.hair, spec.hairHex);
        if (spec.helmet) {
            const helmet = BABYLON.MeshBuilder.CreateSphere('npc-helmet', { diameter: 98, segments: 12 }, view.scene);
            helmet.material = this.glassMat(); helmet.parent = head; helmet.position.set(0, 3, 0); helmet.isPickable = false;
            a.extras.push(helmet);
            const collar = BABYLON.MeshBuilder.CreateTorus('npc-collar', { diameter: 62, thickness: 13, tessellation: 14 }, view.scene);
            collar.material = white; collar.parent = head; collar.position.set(0, -25, 0); collar.isPickable = false;
            World3D.addObject(view, collar, 'actor');
            a.extras.push(collar);
        }
        if (spec.wear === 'hardhat') {
            const L = [], B = this.boxer(L);
            B(49, 13, 54, 0, 29, 0); B(30, 5, 9, 0, 37, 0); B(14, 4, 48, 29, 23, 0);
            this.merged(L, 'npc-hat', this.mat(0xffc21a, 0.2), head, a);
        } else if (spec.wear === 'headset') {
            const L = [], B = this.boxer(L);
            B(8, 6, 58, -2, 22, 0); B(10, 16, 6, -2, 12, -29); B(10, 16, 6, -2, 12, 29); B(22, 3, 3, 10, -3, 30, 0.3);
            this.merged(L, 'npc-headset', this.mat(0x2f3440, 0.2), head, a);
        }
    },

    /** Модель из загруженного файла: корень в сцене; нет файла — null. */
    mkModel(key, name) {
        const model = this.models[key];
        if (!model) return null;
        try {
            const root = Model3D.build(model, this.view.scene, { name });
            World3D.addObject(this.view, root, 'actor');
            try { GameWorld.glow(root); } catch (e) { /* без подсветки */ }
            return root;
        } catch (e) { return null; }
    },

    /** Запасной вид предмета — набор коробок на корне-меше. */
    fallbackRoot(name, parts) {
        const root = new BABYLON.Mesh(name, this.view.scene);
        for (const p of parts) {
            const b = BABYLON.MeshBuilder.CreateBox(name + '-p', { width: p[0], height: p[1], depth: p[2] }, this.view.scene);
            b.position.set(p[3], p[4], p[5]); b.material = this.mat(p[6], p[7]); b.parent = root; b.isPickable = false;
        }
        World3D.addObject(this.view, root, 'actor');
        return root;
    },

    // ---------------------------------------------------------------------------------------------
    // Актёры
    // ---------------------------------------------------------------------------------------------

    face(ctx, w, h) {
        ctx.clearRect(0, 0, w, h);
        const ink = '#1c1e24';
        ctx.fillStyle = 'rgba(255,110,110,0.30)';
        for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(w * (0.5 + sx * 0.36), h * 0.62, h * 0.13, 0, Math.PI * 2); ctx.fill(); }
        for (const sx of [-1, 1]) {
            const ex = w * (0.5 + sx * 0.2), ey = h * 0.36;
            ctx.fillStyle = ink; ctx.beginPath(); ctx.ellipse(ex, ey, w * 0.048, h * 0.17, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ex + w * 0.014, ey - h * 0.06, w * 0.02, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = ink; ctx.lineWidth = w * 0.03; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(w * 0.5, h * 0.5, w * 0.16, Math.PI * 0.18, Math.PI * 0.82); ctx.stroke();
    },

    /** Общий каркас актёра: физический человечек + поза руки + ник. */
    mkActor(spec) {
        const a = {
            role: spec.role, id: this.actors.length, ch: null, extras: [], roots: [], tool: null,
            names: spec.names, state: 'idle', t: 0, clock: Math.random() * 6, vis: true, far: false, skip: 0, stepN: 0, acc: 0, glanceT: 0, hopN: 0, lookA: 0, chatStep: 0, chatR: 160, spotWant: null, workBase: null, prevNear: false, partnerOf: null,
            home: { x: spec.x, y: spec.y, heading: spec.heading }, hold: spec.hold || null, work: 0, wave: 0, waveT: 0, waveOn: false,
            say: { text: '', left: 0 }, lastLine: '', sayCd: 2 + Math.random() * 3, glance: 0, glanceX: 0, glanceY: 0,
            dest: null, path: null, pi: 0, repath: 0, stuckT: 0, stuckN: 0, lastX: spec.x, lastY: spec.y, walk: true,
            spot: null, point: null, partner: null, tag: null, lang: '', cd: {}, hop: 0, workDir: 0, workT: 0,
        };
        const ch = HumanoidCharacter.create(this.view, {
            world: this.world, x: spec.x, y: spec.y, heading: spec.heading,
            colors: { skin: spec.skin, top: spec.top, bottom: spec.bottom },
            name: 'npc-' + spec.role, kind: 'actor', face: (/** @type {any} */ c, /** @type {number} */ w, /** @type {number} */ h) => this.face(c, w, h),
            motion: { searchInterval: 0.2 },
            dbOptions: typeof GameHero !== 'undefined' ? GameHero.DB : undefined,   // общая с героем база движений (вторая не строится)
        });
        a.ch = ch;
        this.actors.push(a);
        this.dress(a, spec);
        ch.mm.layerHooks.push(this.armHook(a));
        ch.on('step', (/** @type {any} */ e) => {
            if (a.far || !a.vis || (e.speed || 0) < 50) return;
            if ((a.stepN = (a.stepN + 1) | 0) % 2) return;
            try { if (typeof Game !== 'undefined') Game.fx('step', { x: e.x, y: e.z, h: e.y, dirt: GameDirt.sample(e.x, e.z).amount }); } catch (err) { /* без пыли */ }
        });
        this.mkTag(a);
        return a;
    },

    /** Слой позы: правая рука держит предмет, левая машет. Углы — градусы (тангаж плеча и локтя). */
    armHook(a) {
        const J = Humanoid.J, D = Math.PI / 180;
        const qs = [0, 0, 0, 1], qe = [0, 0, 0, 1], qw = [0, 0, 0, 1], ls = [0, 0, 0, 1], le = [0, 0, 0, 1], lw = [0, 0, 0, 1];
        return (/** @type {any} */ mm, /** @type {number} */ dt) => {
            a.clock += dt;
            const R = a.hold;
            if (R && a.tool) {
                const w = a.work;
                GM.qeuler(qs, 0, (R.s + (R.s2 - R.s) * w) * D, 0);
                GM.qeuler(qe, 0, (R.e + (R.e2 - R.e) * w) * D, 0);
                GM.qeuler(qw, 0, (R.w || 0) * D, 0);
                mm.blendLocal(J.SHR, qs, 0.92); mm.blendLocal(J.ELR, qe, 0.92); mm.blendLocal(J.WRR, qw, 0.92);
            }
            if (a.wave > 0.02) {
                const k = a.wave * 0.94;
                GM.qeuler(ls, 0, 158 * D, 24 * D);
                GM.qeuler(le, 0, (30 + Math.sin(a.clock * 11) * 26) * D, 0);
                GM.qeuler(lw, 0, Math.sin(a.clock * 11 + 1) * 12 * D, 0);
                mm.blendLocal(J.SHL, ls, k); mm.blendLocal(J.ELL, le, k); mm.blendLocal(J.WRL, lw, k);
            }
        };
    },

    mkShop() {
        const p = this.shopPt;
        const a = this.mkActor({
            role: 'shop', names: this.SHOP_NAME, x: p.x, y: p.y, heading: p.heading,
            skin: [236, 186, 142], top: [255, 140, 30], bottom: [214, 100, 20],
            hair: 'short', hairHex: 0x4a2c14, wear: 'hardhat', helmet: false,
            hold: { s: 22, e: 62, s2: 22, e2: 62, w: 0 },
        });
        // гаечный ключ: рукоять вдоль предплечья, головка на конце
        const root = this.fallbackRoot('npc-wrench', [[52, 6, 6, 26, 0, 0, 0xb9c2cc, 0.2], [14, 20, 7, 56, 0, 0, 0xb9c2cc, 0.2], [8, 8, 8, 60, 0, 0, 0x30343c, 0.2]]);
        root.parent = a.ch.model.part('HandR');
        root.rotationQuaternion = null;
        root.rotation.set(0, 0, -Math.PI / 2);
        root.position.set(4, -6, 0);
        a.tool = root; a.roots.push(root);
        a.baseRot = [0, 0, -Math.PI / 2];
        a.sayCd = 6;
    },

    mkOperator() {
        const p = this.opPt;
        const a = this.mkActor({
            role: 'op', names: this.OP_NAME, x: p.x, y: p.y, heading: p.heading,
            skin: [214, 160, 118], top: [38, 160, 96], bottom: [232, 238, 242],
            hair: 'bun', hairHex: 0x1c1c26, wear: 'headset', helmet: false,
            hold: { s: 52, e: 98, s2: 52, e2: 98, w: -8 },
        });
        // планшет в правой руке
        const root = this.fallbackRoot('npc-tablet', [[4, 22, 30, 0, 0, 0, 0x2c3140, 0.2], [4.6, 18, 26, 0.3, 0, 0, 0x4fd6ff, 0.9]]);
        root.parent = a.ch.model.part('HandR');
        root.rotationQuaternion = null;
        root.rotation.set(0, 0, -Math.PI / 2);
        root.position.set(2, -14, 6);
        a.tool = root; a.roots.push(root);
        a.sayCd = 8; a.cd.cheer = -1;
    },

    mkCleaner(i) {
        const C = this.COLORS;
        // старт — у своей точки жизни или рядом с оператором
        let sx, sy, pt = null;
        const free = this.points.filter(p => !p.taken);
        if (free.length) { pt = free[(i * 2 + 1) % free.length]; sx = pt.x; sy = pt.y; }
        else { const ang = i * 2.1; sx = this.base.x + Math.cos(ang) * 260; sy = this.base.y + Math.sin(ang) * 260; }
        if (this.badSpot(sx, sy, 40)) { const f = Nav.nearestFree(sx, sy, 40); if (f) { sx = f.x; sy = f.y; } }
        const names = this.NAMES;
        const idx = (i * 5 + Math.floor(Math.random() * 3)) % names.ru.length;
        const a = this.mkActor({
            role: 'clean', names: { ru: names.ru[idx], en: names.en[idx] }, x: sx, y: sy, heading: Math.random() * 6.28 - 3.14,
            skin: C.skin[(i * 2 + 1) % C.skin.length], top: this.rgb(C.suit[i % C.suit.length]), bottom: this.rgb(C.pants[i % C.pants.length]),
            hair: C.styles[i % C.styles.length], hairHex: C.hair[(i * 3 + 1) % C.hair.length], helmet: true,
            hold: { s: 30, e: 42, s2: 40, e2: 46, w: 0 },
        });
        a.point = pt; if (pt) pt.taken = a;
        // пылесос и ранец
        const vac = this.mkModel(i % 2 ? 'vac2' : 'vac1', 'npc-vac') || this.fallbackRoot('npc-vac', [[60, 14, 14, 35, 0, 0, 0xffc21a, 0.2], [20, 26, 26, 66, 0, 0, 0xffc21a, 0.2]]);
        vac.parent = a.ch.model.part('HandR');
        vac.rotationQuaternion = null;
        vac.rotation.set(0, 0, -Math.PI / 2);
        vac.position.set(4, -6, 0);
        a.tool = vac; a.roots.push(vac);
        const tank = this.mkModel('tank', 'npc-tank') || this.fallbackRoot('npc-tank', [[34, 60, 34, -20, 0, 0, 0xe6eaf5, 0.2]]);
        tank.parent = a.ch.model.part('UpperTorso');
        tank.rotationQuaternion = null;
        tank.position.set(-17.5, 2, 0);
        a.roots.push(tank);
        for (const m of tank.getChildMeshes(false)) {
            if (m.metadata && m.metadata.part === 'Fill') { const p = m.metadata.pivot || [0, 0, 0]; m.setPivotPoint(new BABYLON.Vector3(p[0], p[1], p[2])); m.scaling.y = 0.15 + Math.random() * 0.55; }
        }
        a.state = 'idle'; a.t = 1 + i * 2.2 + Math.random() * 3;
    },

    rgb(hex) { return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]; },

    // ---------------------------------------------------------------------------------------------
    // Ники и пузыри (DOM поверх холста)
    // ---------------------------------------------------------------------------------------------

    CSS: `
#npc-tags { position: fixed; inset: 0; pointer-events: none; z-index: 14; overflow: hidden; font-family: 'Rubik', system-ui, sans-serif; }
#npc-tags .nt { position: absolute; left: 0; top: 0; display: flex; flex-direction: column; align-items: center; gap: 0; white-space: nowrap; will-change: transform; pointer-events: none; }
#npc-tags .nt.off { display: none; }
#npc-tags .nb { max-width: 210px; white-space: normal; text-align: center; font-weight: 800; font-size: 14px; line-height: 1.15; color: #1b1d2a; background: #fff; border: 2px solid #1b1d2a; border-radius: 12px; padding: 3px 9px; margin-bottom: 4px; box-shadow: 0 2px 0 rgba(0,0,0,.35); }
#npc-tags .nb:empty { display: none; }
#npc-tags .nn { font-weight: 900; font-size: 15px; line-height: 1.1; color: #fff; -webkit-text-stroke: 4px #12141e; paint-order: stroke fill; text-shadow: 0 2px 0 #12141e; }
#npc-tags .nr { font-weight: 800; font-size: 10px; line-height: 1.1; letter-spacing: .05em; text-transform: uppercase; -webkit-text-stroke: 3px #12141e; paint-order: stroke fill; }
body.ui-window #npc-tags, body.ui-menu #npc-tags { display: none; }
`,

    mkLayer() {
        if (typeof document === 'undefined') return;
        if (!document.getElementById('npc-tags-css')) {
            const st = document.createElement('style');
            st.id = 'npc-tags-css'; st.textContent = this.CSS;
            document.head.appendChild(st);
        }
        const old = document.getElementById('npc-tags');
        if (old) old.remove();
        this.box = document.createElement('div');
        this.box.id = 'npc-tags';
        document.body.appendChild(this.box);
    },

    mkTag(a) {
        if (!this.box) return;
        const el = document.createElement('div'); el.className = 'nt off';
        const bub = document.createElement('div'); bub.className = 'nb';
        const nm = document.createElement('div'); nm.className = 'nn';
        const rl = document.createElement('div'); rl.className = 'nr'; rl.style.color = this.ROLES[a.role].color;
        el.appendChild(bub); el.appendChild(nm); el.appendChild(rl);
        this.box.appendChild(el);
        a.tag = { el, bub, nm, rl, x: -1e5, y: -1e5, on: false };
    },

    code() { return typeof Lang !== 'undefined' && Lang.code === 'en' ? 'en' : 'ru'; },

    /** Реплика: короткий пузырь на 2.5–3.5 с. */
    speak(a, text, sec) {
        if (!a.tag) return;
        a.say.text = text; a.say.left = sec || (2.5 + Math.random());
        a.tag.bub.textContent = text;
    },

    /** Случайная строка из таблицы (не повторять прошлую). */
    line(a, key) {
        const t = this.SAY[key][this.code()];
        let s = t[Math.floor(Math.random() * t.length)];
        if (s === a.lastLine && t.length > 1) s = t[(t.indexOf(s) + 1) % t.length];
        a.lastLine = s;
        return s;
    },

    say(a, key, sec) { if (a.say.left > 0.6) return false; this.speak(a, this.line(a, key), sec); return true; },

    frame(dt) {
        if (!this.ready || !this.box || !this.view) return;
        try {
            const view = this.view, cam = view.camera, hx = GameHero.x, hy = GameHero.y;
            const code = this.code();
            const capX = typeof ViewCap !== 'undefined' && ViewCap.on && ViewCap.x ? ViewCap.x.bind(ViewCap) : null;
            for (const a of this.actors) {
                const tg = a.tag;
                if (!tg) continue;
                if (tg.lang !== code) {
                    tg.lang = code; tg.nm.textContent = a.names[code]; tg.rl.textContent = this.ROLES[a.role][code];
                }
                const d = Math.hypot(a.ch.x - hx, a.ch.y - hy);
                let show = d < 2500 && a.vis;
                let px = 0, py = 0;
                if (show) {
                    const p = view.projectToScreen(a.ch.x, a.ch.y, a.ch.h + 238);
                    if (!p || p.behind || !p.visible) show = false;
                    else {
                        const dist = cam ? Math.hypot(cam.position.x - a.ch.x, cam.position.y - a.ch.h, cam.position.z - a.ch.y) : 1200;
                        const k = Math.max(0.6, Math.min(1.15, 1100 / Math.max(400, dist)));
                        px = capX ? capX(p.x) : p.x; py = p.y;
                        if (Math.abs(px - tg.x) > 0.4 || Math.abs(py - tg.y) > 0.4 || tg.k !== k) {
                            tg.x = px; tg.y = py; tg.k = k;
                            tg.el.style.transform = 'translate(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px) translate(-50%,-100%) scale(' + k.toFixed(3) + ')';
                        }
                    }
                }
                if (show !== tg.on) { tg.on = show; tg.el.classList.toggle('off', !show); }
            }
        } catch (e) { this.fail('frame', e); }
    },

    fail(where, e) {
        if (this.warned) return;
        this.warned = true;
        console.warn('GameNpc.' + where + ' (дальше молча):', e);
    },

    // ---------------------------------------------------------------------------------------------
    // Мелкая «жизнь»: робот-пылесос и грузовой дрон (примитивы, без HumanoidCharacter)
    // ---------------------------------------------------------------------------------------------

    mkRobot() {
        try {
            const scene = this.view.scene;
            const root = new BABYLON.Mesh('npc-robot', scene);
            const add = (/** @type {any} */ mesh, /** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ z, /** @type {any} */ mat) => { mesh.parent = root; mesh.position.set(x, y, z); mesh.material = mat; mesh.isPickable = false; return mesh; };
            const body = BABYLON.MeshBuilder.CreateCylinder('npc-robot-body', { height: 18, diameter: 66, tessellation: 20 }, scene);
            add(body, 0, 12, 0, this.mat(0xe9edf5, 0.2));
            const rim = BABYLON.MeshBuilder.CreateTorus('npc-robot-rim', { diameter: 66, thickness: 6, tessellation: 20 }, scene);
            add(rim, 0, 6, 0, this.mat(0x30343c, 0.2));
            const top = BABYLON.MeshBuilder.CreateCylinder('npc-robot-top', { height: 5, diameter: 38, tessellation: 16 }, scene);
            add(top, 0, 23, 0, this.mat(0x3fa7ff, 0.3));
            const eyeMat = this.mat(0x7ff6ff, 1);
            for (const z of [-9, 9]) add(BABYLON.MeshBuilder.CreateSphere('npc-robot-eye', { diameter: 8, segments: 6 }, scene), 31, 15, z, eyeMat);
            World3D.addObject(this.view, root, 'actor');
            const sx = this.base.x - 140, sy = this.base.y + 40;
            this.micro.robot = { root, x: sx, y: sy, heading: 0, goal: 0, t: 2, speed: 105, vis: true, bump: 0, clock: 0 };
            const r = this.micro.robot;
            for (const p of [[0, 0], [-160, 0], [160, 0], [0, 140], [0, -140]]) { const x = this.base.x + p[0], y = this.base.y + p[1]; if (!Nav.blocked(x, y, 40) && GameDirt.sample(x, y).amount < 0.05) { r.x = x; r.y = y; break; } }
            root.position.set(r.x, Nav.height(r.x, r.y), r.y);
        } catch (e) { console.warn('GameNpc: робот-пылесос не создан', e); this.micro.robot = null; }
    },

    robotOk(x, y) {
        if (Nav.blocked(x, y, 44)) return false;
        if (Math.hypot(x - this.base.x, y - this.base.y) > 620) return false;
        if (GameDirt.sample(x, y).amount > 0.08) return false;
        for (const p of GameWorld.pads) if ((p.kind === 'shop' || p.kind === 'launch') && Math.hypot(x - p.x, y - p.y) < p.r + 30) return false;
        return true;
    },

    updateRobot(dt, hero) {
        const r = this.micro.robot;
        if (!r) return;
        const far = Math.hypot(r.x - hero.x, r.y - hero.y) > 3200;
        if (far !== !r.vis) { r.vis = !far; r.root.setEnabled(r.vis); }
        if (far) return;
        r.clock += dt;
        r.t -= dt;
        if (r.t <= 0) { r.goal = r.heading + (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.9); r.t = 1.6 + Math.random() * 2.4; }
        // зигзаг: курс плавно ведёт к цели
        let da = r.goal - r.heading; da = Math.atan2(Math.sin(da), Math.cos(da));
        r.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, da));
        const sp = r.speed * (r.bump > 0 ? 0.3 : 1);
        const nx = r.x + Math.cos(r.heading) * sp * dt, ny = r.y + Math.sin(r.heading) * sp * dt;
        // препятствие впереди: проверка чуть дальше шага
        const fx = r.x + Math.cos(r.heading) * 70, fy = r.y + Math.sin(r.heading) * 70;
        if (!this.robotOk(nx, ny) || !this.robotOk(fx, fy)) {
            r.goal = r.heading + Math.PI * (0.65 + Math.random() * 0.7) * (Math.random() < 0.5 ? -1 : 1);
            r.bump = 0.5; r.t = 2;
            if (!this.robotOk(nx, ny)) { const cx = this.base.x - r.x, cy = this.base.y - r.y; r.goal = Math.atan2(cy, cx) + (Math.random() - 0.5); }
        } else { r.x = nx; r.y = ny; }
        if (r.bump > 0) r.bump -= dt;
        const h = Nav.height(r.x, r.y);
        r.root.position.set(r.x, h + Math.sin(r.clock * 14) * 0.8, r.y);
        r.root.rotation.y = -r.heading;
    },

    mkDrone() {
        try {
            const scene = this.view.scene;
            const root = new BABYLON.Mesh('npc-drone', scene);
            const add = (/** @type {any} */ mesh, /** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ z, /** @type {any} */ mat, /** @type {any} */ par = null) => { mesh.parent = par || root; mesh.position.set(x, y, z); mesh.material = mat; mesh.isPickable = false; return mesh; };
            add(BABYLON.MeshBuilder.CreateBox('npc-drone-body', { width: 56, height: 16, depth: 38 }, scene), 0, 0, 0, this.mat(0xdfe5ee, 0.2));
            add(BABYLON.MeshBuilder.CreateBox('npc-drone-stripe', { width: 58, height: 5, depth: 40 }, scene), 0, 0, 0, this.mat(0xff8a1f, 0.3));
            const rotors = [];
            for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
                add(BABYLON.MeshBuilder.CreateCylinder('npc-drone-arm', { height: 4, diameter: 8, tessellation: 6 }, scene), sx * 30, 9, sz * 24, this.mat(0x30343c, 0.2));
                const rot = add(BABYLON.MeshBuilder.CreateCylinder('npc-drone-rotor', { height: 2, diameter: 34, tessellation: 12 }, scene), sx * 30, 13, sz * 24, this.mat(0x9fd8ff, 0.4));
                rotors.push(rot);
            }
            const light = add(BABYLON.MeshBuilder.CreateSphere('npc-drone-light', { diameter: 8, segments: 6 }, scene), 0, 11, 0, this.mat(0xff4a4a, 1));
            const crate = add(BABYLON.MeshBuilder.CreateBox('npc-drone-crate', { size: 30 }, scene), 0, -26, 0, this.mat(0xb98245, 0.2));
            add(BABYLON.MeshBuilder.CreateBox('npc-drone-tape', { width: 31, height: 6, depth: 31 }, scene), 0, -26, 0, this.mat(0xf0d8a0, 0.2));
            World3D.addObject(this.view, root, 'actor');
            root.setEnabled(false);
            const A = this.padOf('shop') || { x: this.shopPt.x, y: this.shopPt.y }, B = this.padOf('sell') || { x: this.opPt.x, y: this.opPt.y };
            this.micro.drone = { root, rotors, light, crate, A: { x: A.x, y: A.y }, B: { x: B.x, y: B.y }, t: 0, wait: 8 + Math.random() * 8, flying: false, leg: 0, clock: 0, blink: 0 };
        } catch (e) { console.warn('GameNpc: дрон не создан', e); this.micro.drone = null; }
    },

    updateDrone(dt, hero) {
        const d = this.micro.drone;
        if (!d) return;
        d.clock += dt;
        if (!d.flying) {
            d.wait -= dt;
            if (d.wait > 0) return;
            d.flying = true; d.t = 0; d.leg = (d.leg + 1) % 2;
            d.root.setEnabled(true);
        }
        d.t += dt;
        const DUR = 9, k = Math.min(1, d.t / DUR);
        const from = d.leg ? d.A : d.B, to = d.leg ? d.B : d.A;
        const e = k * k * (3 - 2 * k);
        const x = from.x + (to.x - from.x) * e, y = from.y + (to.y - from.y) * e;
        const gh = Nav.height(x, y);
        const lift = Math.sin(Math.min(1, k * 1.05) * Math.PI);        // подъём — пролёт — посадка
        const alt = 90 + 230 * Math.pow(Math.max(0, lift), 0.7) + Math.sin(d.clock * 2.3) * 9;
        d.root.position.set(x, gh + alt, y);
        const heading = Math.atan2(to.y - from.y, to.x - from.x);
        d.root.rotation.y = -heading;
        d.root.rotation.z = Math.sin(d.clock * 1.7) * 0.05 + 0.1 * Math.sin(k * Math.PI);
        d.root.rotation.x = Math.sin(d.clock * 1.3) * 0.04;
        d.root.scaling.setAll(Math.min(1, d.t / 0.8, (DUR - d.t) / 0.8 + 0.001));
        for (const r of d.rotors) r.rotation.y += dt * 40;
        d.blink += dt;
        d.light.setEnabled(Math.floor(d.blink * 3) % 2 === 0);
        if (d.t >= DUR) { d.flying = false; d.wait = 17 + Math.random() * 6; d.root.setEnabled(false); }
    },

    // ---------------------------------------------------------------------------------------------
    // Кадр логики
    // ---------------------------------------------------------------------------------------------

    update(dt, hero) {
        if (!this.ready || !hero || !hero.ch) return;
        try {
            dt = Math.min(dt, 0.1);
            this.t += dt;
            this.heroChatCd = Math.max(0, this.heroChatCd - dt);
            const down = !!hero.down;
            const fall = down && !this.heroDown;
            this.heroDown = down;
            const sell = this.padOf('sell'), shop = this.padOf('shop');
            const sellIn = !!(sell && sell.inside), shopIn = !!(shop && shop.inside);
            const sellEdge = sellIn && !this._sellEdge, shopEdge = shopIn && !this._shopEdge;
            this._sellEdge = sellIn; this._shopEdge = shopIn;
            const ev = { fall, sellEdge, shopEdge, sellIn, shopIn };
            for (const a of this.actors) {
                if (!a.ch) continue;
                // пузырь
                if (a.say.left > 0) { a.say.left -= dt; if (a.say.left <= 0 && a.tag) a.tag.bub.textContent = ''; }
                a.sayCd -= dt;
                for (const k in a.cd) a.cd[k] -= dt;
                const dh = Math.hypot(a.ch.x - hero.x, a.ch.y - hero.y);
                const far = dh > 2200, vis = dh < 3200;
                if (vis !== a.vis) { a.vis = vis; a.ch.model.setVisible(vis); }
                a.far = far;
                if (far) { a.acc += dt; if ((a.skip = (a.skip + 1) | 0) % 4) continue; dt = a.acc; a.acc = 0; }
                else if (a.acc) { dt += a.acc; a.acc = 0; }
                this.tick(a, dt, hero, dh, ev);
            }
            this.updateRobot(dt, hero);
            this.updateDrone(dt, hero);
        } catch (e) { this.fail('update', e); }
    },

    /** Один актёр: общее (взмах, подъём тела) и роль. */
    tick(a, dt, hero, dh, ev) {
        // взмах левой рукой (плавно)
        a.waveT = Math.max(0, a.waveT - dt);
        a.wave += ((a.waveT > 0 ? 1 : 0) - a.wave) * Math.min(1, dt * 8);
        a.glanceT = Math.max(0, a.glanceT - dt);
        // дрожь инструмента при работе
        if (a.role === 'clean' && a.tool) {
            const w = a.work * 0.035;
            a.tool.rotation.x = Math.sin(a.clock * 61) * w; a.tool.rotation.y = Math.cos(a.clock * 47) * w;
        }
        // герой сбит рядом — сочувствие
        if (ev.fall && dh < 760 && !(a.cd.sym > 0)) { a.cd.sym = 14; a.sayCd = 4; a.say.left = 0; this.say(a, 'sympathy', 3.3); }
        if (a.role === 'shop') this.brainShop(a, dt, hero, dh, ev);
        else if (a.role === 'op') this.brainOp(a, dt, hero, dh, ev);
        else this.brainClean(a, dt, hero, dh, ev);
    },

    /** Остановиться (и повернуться к курсу face — по возможности). */
    stand(a, face) {
        if (a.glanceT > 0 && a.state !== 'chat') face = this.toward(a, a.glanceX, a.glanceY);
        if (face != null) a.ch.ch.facingGoal = face;
        a.ch.control({ move: { x: 0, y: 0 }, walk: true, camYaw: a.ch.heading });
        a.ch.update(a.dtNow || 1 / 60);
    },

    toward(a, x, y) { return Math.atan2(y - a.ch.y, x - a.ch.x); },

    brainShop(a, dt, hero, dh, ev) {
        a.dtNow = dt;
        const near = dh < 600 && !hero.down;
        const face = dh < 600 ? this.toward(a, hero.x, hero.y) : a.home.heading;
        // подошёл: взмах и зазывалка (не чаще ~12 с)
        if (near && !a.prevNear && !(a.cd.greet > 0)) { a.cd.greet = 12; a.waveT = 2.4; a.say.left = 0; this.say(a, 'shopGreet', 3.2); }
        if (ev.shopEdge && !(a.cd.buy > 0) && !(a.say.left > 0)) { a.cd.buy = 10; this.say(a, 'shopBuy', 2.8); }
        a.prevNear = near;
        if (a.sayCd <= 0 && dh < 900) { a.sayCd = 22 + Math.random() * 20; this.say(a, 'shopIdle', 3); }
        this.stand(a, face);
    },

    brainOp(a, dt, hero, dh, ev) {
        a.dtNow = dt;
        const near = dh < 600 && !hero.down;
        const face = dh < 600 ? this.toward(a, hero.x, hero.y) : a.home.heading;
        if (ev.sellEdge) { a.cd.cheer = 3; a.waveT = 3; a.hopN = 2; a.say.left = 0; this.say(a, 'opSell', 3.2); a.cd.greet = 12; }
        else if (ev.sellIn && !(a.cd.sellMore > 0) && a.cd.cheer < 0) { a.cd.sellMore = 7; a.waveT = 1.6; this.say(a, 'opSell', 2.8); }
        // подпрыгивает от радости (два прыжка)
        if (a.hopN > 0 && a.cd.cheer < 3 - (2 - a.hopN) * 0.9 - 0.15 && a.ch.ch.grounded) { a.hopN--; a.ch.control({ jump: true, move: { x: 0, y: 0 }, camYaw: a.ch.heading }); }
        if (near && !a.prevNear && !(a.cd.greet > 0)) { a.cd.greet = 14; a.waveT = 2; a.say.left = 0; this.say(a, 'opGreet', 3.2); }
        a.prevNear = near;
        if (a.sayCd <= 0 && dh < 900) { a.sayCd = 20 + Math.random() * 20; this.say(a, 'opIdle', 3); }
        // коллега сдал грязь у станции: реакция
        if (!(a.cd.see > 0)) for (const o of this.actors) if (o.state === 'sell' && o.role === 'clean' && o.t < 1.2 && Math.hypot(o.ch.x - a.ch.x, o.ch.y - a.ch.y) < 400) { a.cd.see = 6; a.waveT = 1.4; this.say(a, 'opSeeSold', 2.8); break; }
        this.stand(a, face);
    },

    // ----- коллеги-уборщики: цикл жизни ---------------------------------------------------------

    setState(a, st, t) {
        // освободить занятые места
        if (a.state === 'sell' && a.spot) { a.spot.taken = null; a.spot = null; }
        a.state = st; a.t = t || 0; a.path = null; a.dest = null; a.stuckN = 0; a.stuckT = 0; a.workT = 0;
        if (st !== 'work') a.work = 0;
    },

    dirtScan(x, y, R) {
        let sum = 0, best = 0, dir = 0;
        for (let k = 0; k < 8; k++) {
            const ang = k * Math.PI / 4;
            const s1 = GameDirt.sample(x + Math.cos(ang) * R, y + Math.sin(ang) * R).amount, s2 = GameDirt.sample(x + Math.cos(ang) * R * 0.5, y + Math.sin(ang) * R * 0.5).amount;
            const v = s1 + s2;
            sum += v;
            if (v > best) { best = v; dir = ang; }
        }
        return { sum, dir, best };
    },

    /** Место для уборки: точка жизни у кромки грязи или ближайшее пятно (не дальше 900 px от базы). */
    pickWork(a) {
        const cands = [];
        for (const p of this.points) {
            if (p.taken && p.taken !== a) continue;
            const s = this.dirtScan(p.x, p.y, 110);
            if (s.sum > 0.25) cands.push({ p, s, d: Math.hypot(p.x - a.ch.x, p.y - a.ch.y) + Math.random() * 400 });
        }
        if (cands.length) {
            cands.sort((u, v) => u.d - v.d);
            const c = cands[0];
            this.freePoint(a); c.p.taken = a; a.point = c.p;
            a.workDir = c.s.dir;
            return { x: c.p.x, y: c.p.y };
        }
        const n = GameDirt.nearest(this.base.x, this.base.y);
        if (!n) return null;
        const bd = Math.hypot(n.x - this.base.x, n.y - this.base.y);
        if (bd > 900) return null;
        // встать на чистом краю, лицом к пятну; чужие точки обходим
        for (let k = 0; k < 8; k++) {
            const off = [0, 0.7, -0.7, 1.4, -1.4, 2.1, -2.1, 3][k];
            const toBase = Math.atan2(this.base.y - n.y, this.base.x - n.x) + off;
            const x = n.x + Math.cos(toBase) * 100, y = n.y + Math.sin(toBase) * 100;
            if (this.badSpot(x, y, 40) || Math.hypot(x - this.base.x, y - this.base.y) > 900) continue;
            if (this.actors.some(o => o !== a && o.role === 'clean' && o.dest && Math.hypot(o.dest.x - x, o.dest.y - y) < 170)) continue;
            this.freePoint(a);
            a.workDir = toBase + Math.PI;
            return { x, y };
        }
        return null;
    },

    freePoint(a) { if (a.point && a.point.taken === a) a.point.taken = null; },

    nearPoint(a) {
        const free = this.points.filter(p => !p.taken || p.taken === a);
        if (!free.length) return { x: this.base.x + (Math.random() - 0.5) * 500, y: this.base.y + (Math.random() - 0.5) * 500 };
        return free[Math.floor(Math.random() * free.length)];
    },

    /** Ход к цели по Nav.path с обходом площадок shop/launch. Возвращает 'arrive' | 'go' | 'fail'. */
    drive(a, dt, hero, arrive) {
        const d = a.dest;
        if (!d) return 'fail';
        const x = a.ch.x, y = a.ch.y;
        if (Math.hypot(d.x - x, d.y - y) < arrive) return 'arrive';
        a.repath -= dt;
        if (!a.path || a.repath <= 0) {
            let p = null;
            try { p = Nav.path(x, y, d.x, d.y, 36, { partial: true }); } catch (e) { p = null; }
            if (!p) p = Nav.clear(x, y, d.x, d.y, 36) ? [{ x: d.x, y: d.y }] : null;
            if (!p) return 'fail';
            a.path = this.detour(x, y, p); a.pi = 0; a.repath = 3 + Math.random();
        }
        const path = a.path;
        while (a.pi < path.length - 1 && Math.hypot(path[a.pi].x - x, path[a.pi].y - y) < 55) a.pi++;
        const w = path[a.pi];
        if (!w) return 'arrive';
        if (a.pi >= path.length - 1 && Math.hypot(w.x - x, w.y - y) < arrive) return 'arrive';
        const ang = Math.atan2(w.y - y, w.x - x);
        a.ch.control({ move: { x: 0, y: 1 }, walk: a.walk, camYaw: ang });
        a.ch.update(dt);
        // застревание: за ~0.8 с сдвинулся меньше, чем должен
        a.stuckT += dt;
        if (a.stuckT > 0.9) {
            const mv = Math.hypot(x - a.lastX, y - a.lastY);
            a.lastX = x; a.lastY = y; a.stuckT = 0;
            if (mv < 30) { a.stuckN++; a.repath = 0; if (a.stuckN >= 4) return 'fail'; } else a.stuckN = 0;
        }
        return 'go';
    },

    /** Обход площадок shop/launch: к пути добавить точки по касательной. */
    detour(x0, y0, path) {
        const out = [];
        let px = x0, py = y0;
        for (const q of path) {
            for (const p of GameWorld.pads) {
                if (p.kind !== 'shop' && p.kind !== 'launch') continue;
                const R = p.r + 45;
                const vx = q.x - px, vy = q.y - py, l2 = vx * vx + vy * vy || 1;
                const t = Math.max(0, Math.min(1, ((p.x - px) * vx + (p.y - py) * vy) / l2));
                const cx = px + vx * t, cy = py + vy * t;
                const dx = cx - p.x, dy = cy - p.y, dd = Math.hypot(dx, dy);
                if (dd < R) {
                    let ux = dd > 1 ? dx / dd : -vy / Math.sqrt(l2), uy = dd > 1 ? dy / dd : vx / Math.sqrt(l2);
                    out.push({ x: p.x + ux * (R + 35), y: p.y + uy * (R + 35) });
                }
            }
            out.push(q);
            px = q.x; py = q.y;
        }
        return out;
    },

    /** Уступить дорогу герою: шаг в сторону, если ближе 90 px. true — уступаем в этот кадр. */
    yieldTo(a, dt, hero, dh) {
        if (dh >= 90 || hero.down) return false;
        const ang = Math.atan2(a.ch.y - hero.y, a.ch.x - hero.x) + 0.6;
        a.ch.control({ move: { x: 0, y: 1 }, walk: true, camYaw: ang });
        a.ch.update(dt);
        return true;
    },

    pickPartner(a, hero, dh) {
        const list = [];
        for (const o of this.actors) if (o !== a && o.ch && !(o.partnerOf && o.partnerOf !== a)) list.push(o);
        if (this.heroChatCd <= 0 && !hero.down && dh < 1800) { list.push({ hero: true }); list.push({ hero: true }); }
        if (!list.length) return null;
        return list[Math.floor(Math.random() * list.length)];
    },

    partnerPos(p, hero) { return p.hero ? { x: hero.x, y: hero.y } : { x: p.ch.x, y: p.ch.y }; },

    brainClean(a, dt, hero, dh, ev) {
        a.dtNow = dt;
        // герой рядом — уступить дорогу
        if (this.yieldTo(a, dt, hero, dh)) return;
        a.t -= dt;
        // слово в дороге
        if (a.sayCd <= 0 && dh < 1200 && a.state !== 'chat') {
            a.sayCd = 9 + Math.random() * 10;
            const key = a.state === 'work' ? 'cleanWork' : a.state === 'sell' ? 'cleanSold' : 'cleanJoke';
            this.say(a, key, 3);
        }
        switch (a.state) {
            case 'idle': {
                a.walk = true;
                if (dh < 380 && !hero.down) {
                    this.stand(a, this.toward(a, hero.x, hero.y));
                    if (!(a.cd.hello > 0)) { a.cd.hello = 22; a.say.left = 0; this.say(a, 'cleanHello', 3); a.waveT = 1.4; }
                } else {
                    // оглядеться
                    a.glance -= dt;
                    if (a.glance <= 0) { a.glance = 1.2 + Math.random() * 1.4; a.lookA = a.ch.heading + (Math.random() - 0.5) * 2.4; }
                    this.stand(a, a.lookA);
                }
                if (a.t <= 0) {
                    const dirty = Math.random() < 0.82;
                    const spot = dirty ? this.pickWork(a) : null;
                    if (spot) { a.target = spot; this.setState(a, 'toWork', 25); a.dest = spot; a.walk = Math.random() < 0.7 || Math.hypot(spot.x - a.ch.x, spot.y - a.ch.y) < 250; }
                    else this.startChat(a, hero, dh);
                }
                break;
            }
            case 'toWork': {
                const r = this.drive(a, dt, hero, 40);
                if (r === 'arrive') { this.setState(a, 'work', 3 + Math.random() * 2); a.workBase = a.workDir; }
                else if (r === 'fail' || a.t <= 0) { this.freePoint(a); this.setState(a, 'idle', 2 + Math.random() * 2); }
                break;
            }
            case 'work': {
                // качаем «веер» перед собой: курс плавно ходит ±0.55 рад
                a.workT += dt;
                a.work += (1 - a.work) * Math.min(1, dt * 6);
                const sway = Math.sin(a.workT * 1.7) * 0.55;
                this.stand(a, (a.workBase != null ? a.workBase : a.ch.heading) + sway);
                const hd = a.ch.heading, cx = a.ch.x + Math.cos(hd) * 85, cy = a.ch.y + Math.sin(hd) * 85;
                if (!a.far) GameDirt.clean(cx, cy, 60, 0.2 * dt, Infinity);   // уборщики чистят понемногу: сектор остаётся игроку
                if (a.t <= 0) { this.freePoint(a); this.goStation(a); }
                break;
            }
            case 'toStation': {
                const r = this.drive(a, dt, hero, 32);
                if (r === 'arrive') { this.setState(a, 'sell', 1.5); a.spot = a.spotWant; this.say(a, 'cleanSold', 3); a.waveT = 0.9; }
                else if (r === 'fail' || a.t <= 0) { if (a.spotWant) a.spotWant.taken = null; this.setState(a, 'idle', 2); }
                break;
            }
            case 'sell': {
                a.work = 0;
                const op = this.actors.find(o => o.role === 'op');
                this.stand(a, op ? this.toward(a, op.ch.x, op.ch.y) : a.ch.heading);
                if (a.t <= 0) { this.startChat(a, hero, dh); }
                break;
            }
            case 'toChat': {
                const p = a.partner;
                if (!p) { this.setState(a, 'idle', 2); break; }
                // цель — точка у собеседника на 150–200 px; для героя пересчитываем
                const pp = this.partnerPos(p, hero);
                if (p.hero && hero.down) { this.setState(a, 'idle', 2); a.partner = null; break; }
                a.chatR = a.chatR || 150 + Math.random() * 50;
                const ang = Math.atan2(a.ch.y - pp.y, a.ch.x - pp.x);
                const tx = pp.x + Math.cos(ang) * a.chatR, ty = pp.y + Math.sin(ang) * a.chatR;
                if (!a.dest || Math.hypot(a.dest.x - tx, a.dest.y - ty) > 70) { a.dest = { x: tx, y: ty }; a.path = null; }
                const dp = Math.hypot(a.ch.x - pp.x, a.ch.y - pp.y);
                const r = dp < a.chatR + 25 && dp > 138 ? 'arrive' : this.drive(a, dt, hero, 30);
                if (r === 'arrive') { this.setState(a, 'chat', 4.5); a.chatStep = 0; a.work = 0; }
                else if (r === 'fail' || a.t <= 0) { this.endChat(a); this.setState(a, 'idle', 2 + Math.random() * 2); }
                break;
            }
            case 'chat': {
                const p = a.partner;
                if (!p || (p.hero && hero.down)) { this.endChat(a); this.setState(a, 'idle', 2); break; }
                const pp = this.partnerPos(p, hero);
                this.stand(a, Math.atan2(pp.y - a.ch.y, pp.x - a.ch.x));
                const el = 4.5 - a.t;
                if (a.chatStep === 0 && el > 0.3) {
                    a.chatStep = 1; a.say.left = 0;
                    this.say(a, p.hero ? 'cleanHello' : 'cleanTalk', 3.2);
                    if (p.hero) { a.waveT = 1.6; this.heroChatCd = 25; }
                }
                if (a.chatStep === 1 && el > 2.1 && !p.hero) {
                    a.chatStep = 2;
                    // собеседник отвечает и поворачивается
                    p.glanceX = a.ch.x; p.glanceY = a.ch.y; p.glanceT = 3;
                    if (p.ch) { p.ch.ch.facingGoal = this.toward(p, a.ch.x, a.ch.y); p.say.left = 0; this.say(p, p.role === 'clean' ? 'cleanReply' : p.role === 'shop' ? 'shopIdle' : 'opIdle', 2.8); p.sayCd = Math.max(p.sayCd, 5); }
                }
                if (a.t <= 0) { this.endChat(a); this.setState(a, 'idle', 3 + Math.random() * 3); }
                break;
            }
            default: this.setState(a, 'idle', 2);
        }
    },

    goStation(a) {
        const free = this.spots.filter(s => !s.taken);
        const s = free.length ? free[Math.floor(Math.random() * free.length)] : this.spots[0];
        s.taken = a;
        a.spotWant = s;
        this.setState(a, 'toStation', 30);
        a.dest = { x: s.x, y: s.y };
        a.walk = Math.random() < 0.6;
    },

    startChat(a, hero, dh) {
        const p = this.pickPartner(a, hero, dh);
        if (!p) { this.setState(a, 'idle', 2 + Math.random() * 3); return; }
        a.partner = p; a.chatR = 150 + Math.random() * 50;
        if (!p.hero) p.partnerOf = a;
        this.setState(a, 'toChat', 20);
        a.walk = Math.random() < 0.7;
    },

    endChat(a) {
        if (a.partner && !a.partner.hero && a.partner.partnerOf === a) a.partner.partnerOf = null;
        a.partner = null;
    },
};
