// GameData.js — данные игры Clean the Moon: секторы (уровни), виды грязи, улучшения, инструменты, мусор и тексты.
// Числа баланса живут здесь таблицами (а не в Constants.js): это данные игры, их не крутит редактор.
//
// ГРЯЗЬ НА КАРТЕ. Зоны грязи — маркеры покраски движка (Maps.js, вкладка Objects редактора):
//   paint-dirt   — лунная пыль            (в редакторе рисуется коричневым)
//   paint-grass2 — инопланетная слизь     (зелёным)
//   paint-dark   — метеоритная сажа       (тёмным)
//   paint-lava   — токсичная жижа         (оранжевым; в игре — фиолетовая)
// Имена — встроенные типы покраски движка: редактор показывает зону контуром и цветом. Игра перекрашивает их
// под свой вид (ниже) и превращает покраску в слой грязи, который стирает пылесос (GameDirt.js).
// Остальные маркеры секторов: spawn, sell, shop, launch, clean (чистый круг), star / star-2 / star-3 (спрятанные
// звёзды), geyser-N, slug-N, bunny-N, meteors (зона метеоритов), boss; block — стены Nav.

// Свои цвета встроенных типов покраски (до первой загрузки карты: скрипт стоит раньше main.js).
Terrain3D.PAINT_COLORS.dirt = 0x6e5f58;     // пыль: серо-бурая
Terrain3D.PAINT_COLORS.grass2 = 0x4fc437;   // слизь: ядовито-зелёная
Terrain3D.PAINT_COLORS.dark = 0x2a2533;     // сажа: почти чёрная
Terrain3D.PAINT_COLORS.lava = 0x9b3fd8;     // токсичная жижа: фиолетовая

/** @satisfies {Record<string, any>} */
const GameData = {
    // Виды грязи: paint — тип покраски движка, hard — во сколько раз дольше стирается, value — монет за единицу
    // (до множителя сектора), slow — доля скорости героя на этой грязи, color — цвет частиц и подписей.
    DIRT: [
        { id: 'dust', paint: 'dirt', hard: 1, value: 1, slow: 1, color: 0x9a8a80 },
        { id: 'slime', paint: 'grass2', hard: 2.3, value: 1.6, slow: 0.55, color: 0x5fe043 },
        { id: 'soot', paint: 'dark', hard: 3.6, value: 2.2, slow: 1, color: 0x3a3442 },
        { id: 'toxic', paint: 'lava', hard: 5.6, value: 3, slow: 0.8, color: 0xb04cf0 },
    ],
    UNIT_AREA: 15000,          // px² сплошной грязи на одну единицу в баке (1.5 м²)
    CLEAN_RATE: 3.1,           // доля слоя в секунду в центре сопла при мощности 1 на пыли
    FINISH_AT: 0.965,          // доля чистоты, после которой сектор дочищает «волна блеска»
    BLAST_COST: 55,            // единиц собранной грязи на полный заряд «Сияния»
    KNOCK_SPILL: 0.3,          // доля бака, которая высыпается при ударе

    // Секторы по порядку. id = id карты в Maps.js. mult — множитель монет, par — секунд на 2-ю звезду,
    // bonus — монет за завершение, music — трек GameAudio, dark — тёмный сектор, sky — цвета неба: зенит, середина, горизонт.
    LEVELS: [
        { id: 'sector-1', name: { ru: 'Пыльная бухта', en: 'Dust Bay' }, mult: 1, par: 240, bonus: 150, music: 'game-a', dark: 0, sky: ['#050a26', '#101a52', '#3a4bb4'] },
        { id: 'sector-2', name: { ru: 'Липкий кратер', en: 'Sticky Crater' }, mult: 2, par: 330, bonus: 400, music: 'game-a', dark: 0, sky: ['#04121c', '#0d2f3c', '#2f8f7a'] },
        { id: 'sector-3', name: { ru: 'Метеоритное поле', en: 'Meteor Field' }, mult: 3.5, par: 390, bonus: 900, music: 'game-a', dark: 0, sky: ['#140a1e', '#3a1638', '#b4503a'] },
        { id: 'sector-4', name: { ru: 'Тёмная сторона', en: 'The Dark Side' }, mult: 5.5, par: 450, bonus: 1800, music: 'game-b', dark: 1, sky: ['#020208', '#080a24', '#231a52'] },
        { id: 'sector-5', name: { ru: 'Кратер Короля', en: "King's Crater" }, mult: 8, par: 540, bonus: 4000, music: 'game-b', dark: 0, sky: ['#0c0420', '#2a0f4c', '#8a3fb0'] },
    ],

    // Улучшения. value(level) — действующее число; price(level) — цена СЛЕДУЮЩЕГО уровня. icon — литерал пути.
    UPGRADES: [
        { id: 'power', icon: 'assets/ui/ic_power.webp', max: 9, base: 60, grow: 1.62, values: [1, 1.35, 1.8, 2.4, 3.1, 4, 5.2, 6.7, 8.6, 11] },
        { id: 'radius', icon: 'assets/ui/ic_radius.webp', max: 8, base: 60, grow: 1.6, values: [95, 108, 121, 135, 149, 164, 180, 196, 214] },
        { id: 'tank', icon: 'assets/ui/ic_tank.webp', max: 9, base: 50, grow: 1.58, values: [50, 70, 100, 140, 190, 260, 350, 470, 630, 850] },
        { id: 'speed', icon: 'assets/ui/ic_speed.webp', max: 6, base: 80, grow: 1.7, values: [360, 392, 424, 456, 490, 525, 560] },
        { id: 'jet', icon: 'assets/ui/ic_jet.webp', max: 4, base: 350, grow: 1.9, values: [0, 1.3, 1.9, 2.6, 3.5] },
        { id: 'blast', icon: 'assets/ui/ic_blast.webp', max: 5, base: 120, grow: 1.75, values: [380, 450, 520, 600, 690, 790] },
    ],

    // Инструменты: вид меняется с уровнем мощности (from — с какого уровня power).
    TOOLS: [
        { from: 0, model: 'assets/models/game/vac_1.glb', icon: 'assets/ui/ic_vac1.webp', name: { ru: 'Пылесборник', en: 'Dust Buster' } },
        { from: 3, model: 'assets/models/game/vac_2.glb', icon: 'assets/ui/ic_vac2.webp', name: { ru: 'Турбо-пылесос', en: 'Turbo Vac' } },
        { from: 6, model: 'assets/models/game/vac_3.glb', icon: 'assets/ui/ic_vac3.webp', name: { ru: 'Гидробластер', en: 'Hydro Blaster' } },
        { from: 8, model: 'assets/models/game/vac_4.glb', icon: 'assets/ui/ic_vac4.webp', name: { ru: 'Мега-полировщик', en: 'Mega Polisher' } },
    ],

    // Космический мусор: имя файла модели (в папке junk) -> монеты (до множителя сектора) и нужный уровень мощности.
    JUNK: {
        can: { coins: 3, power: 0 }, bolt: { coins: 3, power: 0 }, bottle: { coins: 4, power: 0 }, boot: { coins: 5, power: 0 },
        gear: { coins: 5, power: 0 }, crate: { coins: 7, power: 1 }, tire: { coins: 9, power: 2 }, barrel: { coins: 12, power: 3 },
        panel: { coins: 14, power: 4 }, dish: { coins: 18, power: 5 },
    },

    // Коллизии моделей для Nav (px модели: x вперёд, y = −Y Blender). Фигуры — из отчётов Blender-скриптов
    // (assets/models/src/env/env_report.json и assets/models/src/game). Мелкий декор (папка nature) не мешает.
    COLLIDERS: {
        'assets/models/game/recycler.glb': [{ t: 'box', x: -25, y: 0, w: 240, d: 310 }],
        'assets/models/game/shop.glb': [{ t: 'box', x: 0, y: 0, w: 220, d: 320 }],
        'assets/models/game/rocket.glb': [{ t: 'circle', x: 0, y: 0, r: 88 }],
        'assets/models/decor/rock_l1.glb': [{ t: 'circle', x: 0, y: 0, r: 157 }, { t: 'circle', x: 150, y: 130, r: 63 }],
        'assets/models/decor/rock_l2.glb': [{ t: 'circle', x: 0, y: 0, r: 128 }, { t: 'circle', x: -100, y: 120, r: 73 }],
        'assets/models/decor/boulder_xl.glb': [{ t: 'circle', x: 0, y: 0, r: 260 }, { t: 'circle', x: 40, y: -290, r: 160 }, { t: 'circle', x: -30, y: 300, r: 147 }, { t: 'circle', x: 240, y: 100, r: 65 }],
        'assets/models/decor/ridge_1.glb': [{ t: 'box', x: 0, y: 0, w: 320, d: 1200 }],
        'assets/models/decor/ridge_2.glb': [{ t: 'box', x: 0, y: 0, w: 320, d: 1200 }],
        'assets/models/decor/lander.glb': [{ t: 'circle', x: 0, y: 0, r: 125 }, { t: 'circle', x: 190, y: 0, r: 35 }, { t: 'circle', x: -190, y: 0, r: 35 }, { t: 'circle', x: 0, y: 190, r: 35 }, { t: 'circle', x: 0, y: -190, r: 35 }],
        'assets/models/decor/rover.glb': [{ t: 'box', x: 0, y: 0, w: 290, d: 210 }, { t: 'circle', x: 185, y: -160, r: 42 }],
        'assets/models/decor/flag.glb': [{ t: 'circle', x: 0, y: 0, r: 20 }],
        'assets/models/decor/antenna.glb': [{ t: 'box', x: 0, y: 0, w: 190, d: 190 }],
        'assets/models/decor/solar.glb': [{ t: 'box', x: 0, y: 0, w: 190, d: 300 }],
        'assets/models/decor/dome.glb': [{ t: 'circle', x: 0, y: 0, r: 460 }, { t: 'box', x: 475, y: 0, w: 130, d: 250 }],
        'assets/models/decor/tube.glb': [{ t: 'box', x: 0, y: 0, w: 600, d: 250 }],
        'assets/models/decor/lamp.glb': [{ t: 'circle', x: 0, y: 0, r: 60 }],
        'assets/models/decor/fence.glb': [{ t: 'box', x: 0, y: 0, w: 30, d: 240, los: false }],
        'assets/models/decor/crates.glb': [{ t: 'box', x: 0, y: 0, w: 95, d: 175 }],
        'assets/models/decor/fueltank.glb': [{ t: 'box', x: 0, y: 0, w: 250, d: 125 }],
        'assets/models/decor/crystal_l.glb': [{ t: 'circle', x: 0, y: 0, r: 125 }],
        'assets/models/decor/shroom_l.glb': [{ t: 'circle', x: 5, y: -3, r: 55 }],
        'assets/models/decor/ufo.glb': [{ t: 'circle', x: 10, y: 0, r: 290 }],
        'assets/models/decor/satellite.glb': [{ t: 'box', x: 0, y: 0, w: 180, d: 120 }, { t: 'box', x: 5, y: -130, w: 90, d: 100 }],
        'assets/models/decor/bones.glb': [{ t: 'box', x: 0, y: -210, w: 290, d: 75 }, { t: 'box', x: 0, y: 210, w: 290, d: 75 }],
        'assets/models/decor/pipe.glb': [{ t: 'box', x: 0, y: 0, w: 400, d: 100 }],
    },

    level(i) { return this.LEVELS[Math.max(0, Math.min(this.LEVELS.length - 1, i | 0))]; },
    levelName(i) { const n = this.level(i).name; return n[Lang.code] || n.en; },
    upgrade(id) { return this.UPGRADES.find(u => u.id === id) || null; },
    /** Действующее значение улучшения на уровне lv. */
    value(id, lv) { const u = this.upgrade(id); return u ? u.values[Math.max(0, Math.min(u.max, lv | 0))] : 0; },
    /** Цена следующего уровня (null — максимум). */
    price(id, lv) {
        const u = this.upgrade(id);
        if (!u || lv >= u.max) return null;
        return Math.max(5, Math.round(u.base * Math.pow(u.grow, lv) / 5) * 5);
    },
    /** Инструмент для уровня мощности: { tier, ...запись TOOLS }. */
    tool(powerLevel) {
        let tier = 0;
        for (let i = 0; i < this.TOOLS.length; i++) if (powerLevel >= this.TOOLS[i].from) tier = i;
        return Object.assign({ tier }, this.TOOLS[tier]);
    },
    toolName(powerLevel) { const n = this.tool(powerLevel).name; return n[Lang.code] || n.en; },
    /** Запись мусора по пути модели (…/junk/can.glb -> can). */
    junk(model) {
        const m = /\/junk\/([a-z0-9_]+)\.glb$/i.exec(String(model || ''));
        return m ? Object.assign({ id: m[1] }, this.JUNK[m[1]] || { coins: 4, power: 0 }) : null;
    },
    dirtByPaint(type) { return this.DIRT.findIndex(d => d.paint === type); },
};

// --- Тексты игры (оба языка). Интерфейсные строки HUD лежат в GameHud.js. ---
Object.assign(LANG_STRINGS.ru, {
    'title': 'Clean the Moon',
    'up.power': 'Мощность', 'up.power.d': 'Грязь стирается быстрее, а пылесос поднимает тяжёлый мусор',
    'up.radius': 'Размах', 'up.radius.d': 'Шире полоса уборки за один проход',
    'up.tank': 'Бак', 'up.tank.d': 'Больше грязи за один рейс до станции',
    'up.speed': 'Скорость', 'up.speed.d': 'Быстрее бегаешь по Луне',
    'up.jet': 'Ранец', 'up.jet.d': 'Держи прыжок в воздухе, чтобы лететь',
    'up.blast': 'Сияние', 'up.blast.d': 'Больше радиус очищающей волны',
    'up.locked': 'Нет', 'up.sec': '{n} с', 'up.m': '{n} м',
    'g.tankFull': 'Бак полон! Сдай грязь на станции',
    'g.goSell': 'Отнеси грязь на станцию переработки',
    'g.clean': 'Очисти сектор от грязи',
    'g.almost': 'Осталось совсем чуть-чуть!',
    'g.goRocket': 'Сектор сияет! Беги к ракете',
    'g.heavy': 'Слишком тяжело — улучши мощность',
    'g.sold': 'Сдано: +{n}',
    'g.star': 'Найдена звезда {a}/{b}!',
    'g.blastReady': 'Сияние готово!',
    'g.newTool': 'Новый инструмент: {name}',
    'g.spill': 'Часть грязи высыпалась!',
    'g.meteors': 'Метеоритный дождь! Смотри на красные круги',
    'g.bunnies': 'Поймай пылевых зайчиков: {a}/{b}',
    'g.slugs': 'Слизни снова пачкают! Засоси их: {a}/{b}',
    'g.boss': 'Король Грязи',
    'g.bossHint': 'Подойди ближе и высоси Короля Грязи!',
    'g.bossSlam': 'Прыгай через волну!',
    'g.bossDown': 'Король Грязи побеждён!',
    'g.wave': 'Волна блеска!',
    'g.m25': 'Четверть сектора чистая!', 'g.m50': 'Половина готова!', 'g.m75': 'Почти всё блестит!',
    'g.finale': 'Луна сияет! Ты очистил все секторы',
    'g.boostOn': 'Супер-буст: x2 мощность и x3 удача на 90 секунд!',
    'g.radarOn': 'Радар включён: стрелка ведёт к спрятанной звезде',
    'tut.look.drag': 'Зажми кнопку мыши и води, чтобы осмотреться',
    'lbl.sell': 'СДАТЬ', 'lbl.shop': 'УЛУЧШЕНИЯ', 'lbl.launch': 'ВЗЛЁТ', 'lbl.launchLocked': 'СНАЧАЛА УБОРКА',
    'loading.sector': 'Летим в сектор «{name}»…',
    'tut.move.t': 'Иди чистить!', 'tut.clean.t': 'Пылесос работает сам', 'tut.clean.h': 'Пройдись по грязи — она исчезнет. Заполни бак наполовину',
    'tut.sell.t': 'Сдай грязь', 'tut.sell.h': 'Встань на зелёный круг у станции переработки — получишь монеты',
    'tut.shop.t': 'Улучши пылесос', 'tut.shop.h': 'Встань на оранжевый круг у мастерской и купи улучшение',
    'tut.goal.t': 'Очисти весь сектор', 'tut.goal.h': 'Доведи чистоту до 100% и лети дальше на ракете. Прыжок на Луне — высокий!',
});
Object.assign(LANG_STRINGS.en, {
    'title': 'Clean the Moon',
    'up.power': 'Power', 'up.power.d': 'Dirt wipes off faster and the vacuum lifts heavier junk',
    'up.radius': 'Reach', 'up.radius.d': 'A wider cleaning stripe in one pass',
    'up.tank': 'Tank', 'up.tank.d': 'Carry more dirt per trip to the station',
    'up.speed': 'Speed', 'up.speed.d': 'Run across the Moon faster',
    'up.jet': 'Jetpack', 'up.jet.d': 'Hold jump in the air to fly',
    'up.blast': 'Shine', 'up.blast.d': 'A bigger cleaning shockwave',
    'up.locked': 'None', 'up.sec': '{n} s', 'up.m': '{n} m',
    'g.tankFull': 'Tank is full! Drop the dirt at the station',
    'g.goSell': 'Carry the dirt to the recycling station',
    'g.clean': 'Clean the sector',
    'g.almost': 'Just a little bit left!',
    'g.goRocket': 'The sector shines! Run to the rocket',
    'g.heavy': 'Too heavy — upgrade Power',
    'g.sold': 'Sold: +{n}',
    'g.star': 'Star found {a}/{b}!',
    'g.blastReady': 'Shine is ready!',
    'g.newTool': 'New tool: {name}',
    'g.spill': 'Some dirt spilled out!',
    'g.meteors': 'Meteor shower! Watch the red circles',
    'g.bunnies': 'Catch the dust bunnies: {a}/{b}',
    'g.slugs': 'Slugs keep making a mess! Vacuum them: {a}/{b}',
    'g.boss': 'Grime King',
    'g.bossHint': 'Get close and vacuum the Grime King!',
    'g.bossSlam': 'Jump over the wave!',
    'g.bossDown': 'The Grime King is defeated!',
    'g.wave': 'Shine wave!',
    'g.m25': 'A quarter of the sector is clean!', 'g.m50': 'Halfway there!', 'g.m75': 'Almost everything shines!',
    'g.finale': 'The Moon shines! You cleaned every sector',
    'g.boostOn': 'Super boost: x2 power and x3 luck for 90 seconds!',
    'g.radarOn': 'Radar on: the arrow leads to a hidden star',
    'tut.look.drag': 'Hold a mouse button and drag to look around',
    'lbl.sell': 'SELL', 'lbl.shop': 'UPGRADES', 'lbl.launch': 'LAUNCH', 'lbl.launchLocked': 'CLEAN FIRST',
    'loading.sector': 'Flying to sector “{name}”…',
    'tut.move.t': 'Go clean!', 'tut.clean.t': 'The vacuum works by itself', 'tut.clean.h': 'Walk over the dirt and it disappears. Fill the tank halfway',
    'tut.sell.t': 'Drop the dirt', 'tut.sell.h': 'Step on the green circle at the recycling station to get coins',
    'tut.shop.t': 'Upgrade your vacuum', 'tut.shop.h': 'Step on the orange circle at the workshop and buy an upgrade',
    'tut.goal.t': 'Clean the whole sector', 'tut.goal.h': 'Reach 100% and fly on with the rocket. Jumps are high on the Moon!',
});

// Название площадки (GAME_TITLES в Constants.js) важнее строки 'title' игры: Lang.js ставит его раньше этого файла.
(() => {
    const t = typeof GAME_TITLES !== 'undefined' && GAME_TITLES ? /** @type {Record<string, any>} */ (GAME_TITLES)[String(GAME_PLATFORM)] : null;
    if (typeof t === 'string' && t) for (const c of Object.keys(LANG_STRINGS)) /** @type {Record<string, Record<string, string>>} */ (LANG_STRINGS)[c].title = t;
})();
