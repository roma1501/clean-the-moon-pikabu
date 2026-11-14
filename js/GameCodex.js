// GameCodex.js — «Кодекс Луны»: каталог редких находок (от обычных до мифических) и логика коллекции.
// Игрок пылесосит грязь, из-под неё изредка выпадают находки; они копятся в кодексе. Здесь только данные и правила,
// окно и всплывающая карточка — в GameCodexUI.js. Игра зовёт: init({ state: save.codex, persist }), roll(сектор, удача)
// -> предмет в мире, а когда герой его подобрал — grant(id) (монеты умножает на множитель сектора сама игра).
//
// Сохранение (state, правится на месте): found { id: сколько раз }, claimed { редкость: true }, seen { id: true }.
// Иконки assets/ui/finds/f_<id>.webp — пути литералами (сборщик находит ассеты по ним); временные заглушки делает
// tools/ui/make_finds.py, позже их заменяют рисунки с теми же именами (список для художника: tools/ui/finds_list.json).
// Секторы (индексы GameData.LEVELS): 0 Пыльная бухта, 1 Липкий кратер, 2 Метеоритное поле, 3 Тёмная сторона, 4 Кратер Короля.

/** @satisfies {Record<string, any>} */
const GameCodex = {
    // Редкости по порядку. weight — шанс за один бросок без удачи (сумма 100), coins — монеты за находку (до множителя
    // сектора), reward — награда за полностью собранную редкость.
    RARITIES: [
        { id: 'common', name: { ru: 'Обычная', en: 'Common' }, color: '#b8c0cc', weight: 60, coins: 10, reward: 300 },
        { id: 'uncommon', name: { ru: 'Необычная', en: 'Uncommon' }, color: '#5ddc5a', weight: 24, coins: 25, reward: 800 },
        { id: 'rare', name: { ru: 'Редкая', en: 'Rare' }, color: '#4aa8ff', weight: 10, coins: 60, reward: 2500 },
        { id: 'epic', name: { ru: 'Эпическая', en: 'Epic' }, color: '#b05cff', weight: 4.2, coins: 180, reward: 8000 },
        { id: 'legendary', name: { ru: 'Легендарная', en: 'Legendary' }, color: '#ffc21a', weight: 1.5, coins: 600, reward: 25000 },
        { id: 'mythic', name: { ru: 'Мифическая', en: 'Mythic' }, color: '#ff3d8b', weight: 0.3, coins: 2500, reward: 100000 },
    ],

    // Находки. sectors — индексы секторов, где выпадает (null — везде). Порядок внутри редкости = порядок в кодексе.
    ITEMS: [
        // --- обычные (12) ---
        { id: 'moon_pebble', rarity: 'common', name: { ru: 'Лунный камешек', en: 'Moon Pebble' }, desc: { ru: 'Обычный. Зато лунный. Можно хвастаться.', en: 'Plain. But lunar. Brag away.' }, icon: 'assets/ui/finds/f_moon_pebble.webp', sectors: null },
        { id: 'old_bolt', rarity: 'common', name: { ru: 'Старый болт', en: 'Old Bolt' }, desc: { ru: 'Гайку от него ищут до сих пор.', en: 'Its nut is still missing.' }, icon: 'assets/ui/finds/f_old_bolt.webp', sectors: null },
        { id: 'boot_print', rarity: 'common', name: { ru: 'Отпечаток ботинка', en: 'Boot Print' }, desc: { ru: 'Здесь кто-то был. И не вытер ноги.', en: "Someone was here. Didn't wipe their feet." }, icon: 'assets/ui/finds/f_boot_print.webp', sectors: [0, 1, 2] },
        { id: 'dust_clump', rarity: 'common', name: { ru: 'Пыльный комок', en: 'Dust Bunny' }, desc: { ru: 'Живёт под диваном Луны. Смотрит.', en: "Lives under the Moon's couch. Staring." }, icon: 'assets/ui/finds/f_dust_clump.webp', sectors: [0] },
        { id: 'bottle_cap', rarity: 'common', name: { ru: 'Крышка от банки', en: 'Bottle Cap' }, desc: { ru: 'Банка где-то рядом. Наверное, пустая.', en: 'The bottle is nearby. Probably empty.' }, icon: 'assets/ui/finds/f_bottle_cap.webp', sectors: null },
        { id: 'glove', rarity: 'common', name: { ru: 'Потерянная перчатка', en: 'Lost Glove' }, desc: { ru: 'Левая. Правая, видимо, улетела на Марс.', en: 'The left one. The right one probably flew to Mars.' }, icon: 'assets/ui/finds/f_glove.webp', sectors: [0, 2] },
        { id: 'sock', rarity: 'common', name: { ru: 'Космический носок', en: 'Space Sock' }, desc: { ru: 'Невесомый. Но всё равно пахнет.', en: 'Weightless. Still smells.' }, icon: 'assets/ui/finds/f_sock.webp', sectors: null },
        { id: 'spoon', rarity: 'common', name: { ru: 'Лунная ложка', en: 'Moon Spoon' }, desc: { ru: 'Ею удобно ковырять кратеры.', en: 'Great for poking craters.' }, icon: 'assets/ui/finds/f_spoon.webp', sectors: [0, 1] },
        { id: 'slime_drop', rarity: 'common', name: { ru: 'Капля слизи', en: 'Slime Drop' }, desc: { ru: 'Тёплая, липкая и немного довольная.', en: 'Warm, sticky and a bit smug.' }, icon: 'assets/ui/finds/f_slime_drop.webp', sectors: [1] },
        { id: 'meteor_chip', rarity: 'common', name: { ru: 'Метеоритная крошка', en: 'Meteor Crumb' }, desc: { ru: 'Упала с неба. Извинилась и осталась.', en: 'Fell from the sky. Apologised and stayed.' }, icon: 'assets/ui/finds/f_meteor_chip.webp', sectors: [2] },
        { id: 'glow_moss', rarity: 'common', name: { ru: 'Светящийся мох', en: 'Glow Moss' }, desc: { ru: 'Ночник, который не нужно включать.', en: 'A night light with no switch.' }, icon: 'assets/ui/finds/f_glow_moss.webp', sectors: [3] },
        { id: 'royal_button', rarity: 'common', name: { ru: 'Королевская пуговица', en: 'Royal Button' }, desc: { ru: 'Оторвалась от мантии. Король не заметил.', en: 'Popped off a royal robe. The King never noticed.' }, icon: 'assets/ui/finds/f_royal_button.webp', sectors: [4] },
        // --- необычные (9) ---
        { id: 'crystal_shard', rarity: 'uncommon', name: { ru: 'Осколок кристалла', en: 'Crystal Shard' }, desc: { ru: 'Красиво поёт, если дунуть.', en: 'Sings nicely if you blow on it.' }, icon: 'assets/ui/finds/f_crystal_shard.webp', sectors: null },
        { id: 'rusty_gear', rarity: 'uncommon', name: { ru: 'Ржавая шестерёнка', en: 'Rusty Gear' }, desc: { ru: 'Когда-то она крутила мир. Теперь скрипит.', en: 'Once turned the world. Now just squeaks.' }, icon: 'assets/ui/finds/f_rusty_gear.webp', sectors: [0, 2, 4] },
        { id: 'antenna', rarity: 'uncommon', name: { ru: 'Обломок антенны', en: 'Antenna Piece' }, desc: { ru: 'Ловит только тишину и сплетни.', en: 'Picks up only silence and gossip.' }, icon: 'assets/ui/finds/f_antenna.webp', sectors: [0, 1, 2] },
        { id: 'jelly_cube', rarity: 'uncommon', name: { ru: 'Желейный кубик', en: 'Jelly Cube' }, desc: { ru: 'Дрожит от любого шага. Нервный.', en: 'Wobbles at every step. Nervous type.' }, icon: 'assets/ui/finds/f_jelly_cube.webp', sectors: [1] },
        { id: 'space_marble', rarity: 'uncommon', name: { ru: 'Космический шарик', en: 'Space Marble' }, desc: { ru: 'Внутри целая галактика. Или просто пузырь.', en: 'A whole galaxy inside. Or just a bubble.' }, icon: 'assets/ui/finds/f_space_marble.webp', sectors: null },
        { id: 'iron_nugget', rarity: 'uncommon', name: { ru: 'Железный самородок', en: 'Iron Nugget' }, desc: { ru: 'Тяжёлый. Даже на Луне.', en: 'Heavy. Even on the Moon.' }, icon: 'assets/ui/finds/f_iron_nugget.webp', sectors: [2] },
        { id: 'glow_mushroom', rarity: 'uncommon', name: { ru: 'Светящийся гриб', en: 'Glow Mushroom' }, desc: { ru: 'Есть не советуем. Он и сам не советует.', en: "We don't advise eating it. Neither does it." }, icon: 'assets/ui/finds/f_glow_mushroom.webp', sectors: [3] },
        { id: 'toy_crown', rarity: 'uncommon', name: { ru: 'Игрушечная корона', en: 'Toy Crown' }, desc: { ru: 'Картонная, но сидит как влитая.', en: 'Cardboard, but fits like a dream.' }, icon: 'assets/ui/finds/f_toy_crown.webp', sectors: [4] },
        { id: 'faded_flag', rarity: 'uncommon', name: { ru: 'Выцветший флажок', en: 'Faded Flag' }, desc: { ru: 'Был ярким. Потом пришло лунное солнце.', en: 'Used to be bright. Then came the Moon sun.' }, icon: 'assets/ui/finds/f_faded_flag.webp', sectors: [0, 1] },
        // --- редкие (8) ---
        { id: 'moon_cheese', rarity: 'rare', name: { ru: 'Лунный сыр', en: 'Moon Cheese' }, desc: { ru: 'Легенда не врала. Дырок — как в легенде.', en: 'The legend was right. Plenty of holes.' }, icon: 'assets/ui/finds/f_moon_cheese.webp', sectors: null },
        { id: 'alien_tooth', rarity: 'rare', name: { ru: 'Зуб пришельца', en: 'Alien Tooth' }, desc: { ru: 'Улыбался он, судя по всему, широко.', en: 'He must have had a wide smile.' }, icon: 'assets/ui/finds/f_alien_tooth.webp', sectors: [1] },
        { id: 'meteor_core', rarity: 'rare', name: { ru: 'Ядро метеорита', en: 'Meteor Core' }, desc: { ru: 'Ещё тёплое. На ощупь как свежий тост.', en: 'Still warm. Feels like fresh toast.' }, icon: 'assets/ui/finds/f_meteor_core.webp', sectors: [2] },
        { id: 'star_map', rarity: 'rare', name: { ru: 'Звёздная карта', en: 'Star Map' }, desc: { ru: 'Отмечено «Вы здесь». Дальше — «Вы там».', en: 'Marked "You are here". Further on: "You are there".' }, icon: 'assets/ui/finds/f_star_map.webp', sectors: null },
        { id: 'lamp_crystal', rarity: 'rare', name: { ru: 'Кристалл-светильник', en: 'Lamp Crystal' }, desc: { ru: 'Электричество не нужно. Только хорошее настроение.', en: 'No power needed. Just good vibes.' }, icon: 'assets/ui/finds/f_lamp_crystal.webp', sectors: [3] },
        { id: 'royal_signet', rarity: 'rare', name: { ru: 'Королевская печатка', en: 'Royal Signet' }, desc: { ru: 'Оставляет оттиск «Здесь был Король».', en: 'Leaves a stamp: "The King was here".' }, icon: 'assets/ui/finds/f_royal_signet.webp', sectors: [4] },
        { id: 'old_radio', rarity: 'rare', name: { ru: 'Радио с Земли', en: 'Radio from Earth' }, desc: { ru: 'Играет только одну песню. Про Луну.', en: 'Plays one song only. About the Moon.' }, icon: 'assets/ui/finds/f_old_radio.webp', sectors: [0, 1, 2] },
        { id: 'moon_pearl', rarity: 'rare', name: { ru: 'Лунная жемчужина', en: 'Moon Pearl' }, desc: { ru: 'Какая-то устрица очень старалась.', en: 'Some oyster tried really hard.' }, icon: 'assets/ui/finds/f_moon_pearl.webp', sectors: null },
        // --- эпические (5) ---
        { id: 'ancient_helmet', rarity: 'epic', name: { ru: 'Шлем древнего астронавта', en: 'Ancient Astronaut Helmet' }, desc: { ru: 'Внутри всё ещё эхо: «Ну и пылища!»', en: 'Inside, an echo still says: "What a dust!"' }, icon: 'assets/ui/finds/f_ancient_helmet.webp', sectors: null },
        { id: 'alien_battery', rarity: 'epic', name: { ru: 'Батарейка пришельцев', en: 'Alien Battery' }, desc: { ru: 'Заряжена на сто лет. Или на сто минут.', en: 'Charged for a hundred years. Or a hundred minutes.' }, icon: 'assets/ui/finds/f_alien_battery.webp', sectors: [1, 3] },
        { id: 'fire_gem', rarity: 'epic', name: { ru: 'Огненный самоцвет', en: 'Fire Gem' }, desc: { ru: 'Греет ладони. И самолюбие.', en: 'Warms your hands. And your ego.' }, icon: 'assets/ui/finds/f_fire_gem.webp', sectors: [2, 4] },
        { id: 'moon_orchid', rarity: 'epic', name: { ru: 'Лунная орхидея', en: 'Moon Orchid' }, desc: { ru: 'Цветёт раз в тысячу лет. Сегодня тот самый день.', en: 'Blooms once in a thousand years. Today is the day.' }, icon: 'assets/ui/finds/f_moon_orchid.webp', sectors: [3] },
        { id: 'royal_scepter', rarity: 'epic', name: { ru: 'Скипетр Короля', en: "King's Scepter" }, desc: { ru: 'Им так удобно указывать на грязь.', en: 'So handy for pointing at dirt.' }, icon: 'assets/ui/finds/f_royal_scepter.webp', sectors: [4] },
        // --- легендарные (4) ---
        { id: 'golden_record', rarity: 'legendary', name: { ru: 'Золотая пластинка с посланием', en: 'Golden Message Record' }, desc: { ru: 'На ней: «Привет! Приберитесь тут, пожалуйста».', en: 'It says: "Hello! Please tidy up here."' }, icon: 'assets/ui/finds/f_golden_record.webp', sectors: null },
        { id: 'alien_egg', rarity: 'legendary', name: { ru: 'Яйцо пришельца', en: 'Alien Egg' }, desc: { ru: 'Тихо постукивает. Лучше не греть.', en: 'Taps softly. Better not to warm it.' }, icon: 'assets/ui/finds/f_alien_egg.webp', sectors: [1, 3] },
        { id: 'king_crown', rarity: 'legendary', name: { ru: 'Корона Короля Пыли', en: "Dust King's Crown" }, desc: { ru: 'Тяжела, как всякая власть. И пыльна.', en: 'Heavy, like all power. And dusty.' }, icon: 'assets/ui/finds/f_king_crown.webp', sectors: [4] },
        { id: 'star_compass', rarity: 'legendary', name: { ru: 'Звёздный компас', en: 'Star Compass' }, desc: { ru: 'Стрелка всегда указывает на ужин.', en: 'The needle always points to dinner.' }, icon: 'assets/ui/finds/f_star_compass.webp', sectors: [2, 3, 4] },
        // --- мифические (2) ---
        { id: 'moon_heart', rarity: 'mythic', name: { ru: 'Сердце Луны', en: 'Heart of the Moon' }, desc: { ru: 'Бьётся раз в месяц. Ровно в полнолуние.', en: 'Beats once a month. Right on full moon.' }, icon: 'assets/ui/finds/f_moon_heart.webp', sectors: [3, 4] },
        { id: 'black_hole_jar', rarity: 'mythic', name: { ru: 'Кусочек чёрной дыры в банке', en: 'Black Hole in a Jar' }, desc: { ru: 'Не открывать. Не трясти. Не кормить.', en: 'Do not open. Do not shake. Do not feed.' }, icon: 'assets/ui/finds/f_black_hole_jar.webp', sectors: [3, 4] },
    ],

    /** Данные сохранения (объект игры, правится на месте). */
    _s: /** @type {any} */ (null),
    _persist: /** @type {any} */ (null),
    _rng: /** @type {() => number} */ (Math.random),
    _byId: /** @type {Record<string, any>} */ ({}),
    _byRar: /** @type {Record<string, any[]>} */ ({}),

    /** cfg: { state, persist, rng }. state — save.codex игры; недостающие поля создаются. */
    init(cfg) {
        cfg = cfg || {};
        const s = cfg.state && typeof cfg.state === 'object' ? cfg.state : {};
        for (const k of ['found', 'claimed', 'seen']) if (!s[k] || typeof s[k] !== 'object') s[k] = {};
        GameCodex._s = s;
        GameCodex._persist = typeof cfg.persist === 'function' ? cfg.persist : null;
        GameCodex._rng = typeof cfg.rng === 'function' ? cfg.rng : Math.random;
        GameCodex._byId = {}; GameCodex._byRar = {};
        for (const r of GameCodex.RARITIES) GameCodex._byRar[r.id] = [];
        for (const it of GameCodex.ITEMS) { GameCodex._byId[it.id] = it; GameCodex._byRar[it.rarity].push(it); }
        // выкинуть из сохранения id, которых нет в каталоге (после переименований)
        for (const id of Object.keys(s.found)) if (!GameCodex._byId[id] || !(s.found[id] > 0)) delete s.found[id];
        for (const id of Object.keys(s.seen)) if (!GameCodex._byId[id]) delete s.seen[id];
    },

    _st() {
        if (!GameCodex._s) GameCodex.init({});
        return GameCodex._s;
    },

    _save() {
        if (GameCodex._persist) { try { GameCodex._persist(); } catch (e) { console.error('GameCodex.persist', e); } }
    },

    /** Запись каталога по id. */
    item(id) {
        GameCodex._st();
        return GameCodex._byId[id] || null;
    },

    /** Запись редкости по id. */
    rarity(id) {
        return GameCodex.RARITIES.find(r => r.id === id) || GameCodex.RARITIES[0];
    },

    /** Находки одной редкости (в порядке каталога). */
    list(rarityId) {
        GameCodex._st();
        return GameCodex._byRar[rarityId] || [];
    },

    /** Выпадает ли находка в секторе (индекс 0..4). Не число — без ограничений. */
    inSector(item, sector) {
        if (!item.sectors || typeof sector !== 'number' || !isFinite(sector)) return true;
        return item.sectors.indexOf(sector) >= 0;
    },

    /**
     * Выбрать находку для сектора (индекс 0..4) -> запись ITEMS | null. Сначала редкость по весам (у rare и выше
     * вес × luck, luck ≥ 1), среди редкостей, где в секторе есть хоть одна находка; затем равновероятно находка.
     */
    roll(sector, luck) {
        GameCodex._st();
        const k = Math.max(1, +luck || 1), rng = GameCodex._rng;
        const pools = [], ws = [];
        let sum = 0;
        GameCodex.RARITIES.forEach((r, i) => {
            const pool = GameCodex._byRar[r.id].filter(it => GameCodex.inSector(it, sector));
            const w = pool.length ? r.weight * (i >= 2 ? k : 1) : 0;
            pools.push(pool); ws.push(w); sum += w;
        });
        if (sum <= 0) return null;
        let x = rng() * sum, ri = 0;
        for (let i = 0; i < ws.length; i++) {
            if (ws[i] <= 0) continue;
            ri = i;
            if (x < ws[i]) break;
            x -= ws[i];
        }
        const pool = pools[ri];
        return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))] || null;
    },

    /** Засчитать находку -> { item, rarity, isNew, count, coins } (rarity — запись редкости) или null. */
    grant(id) {
        const s = GameCodex._st(), item = GameCodex._byId[id];
        if (!item) return null;
        const rarity = GameCodex.rarity(item.rarity);
        const isNew = !(s.found[id] > 0);
        s.found[id] = (s.found[id] || 0) + 1;
        const coins = Math.round(rarity.coins * (isNew ? 1.5 : 1));
        GameCodex._save();
        return { item, rarity, isNew, count: s.found[id], coins };
    },

    count(id) { return GameCodex._st().found[id] || 0; },
    /** Всего находок (с повторами). */
    total() {
        const f = GameCodex._st().found;
        let n = 0;
        for (const id of Object.keys(f)) n += f[id] || 0;
        return n;
    },
    /** Сколько РАЗНЫХ находок открыто (из ITEMS.length). */
    foundTotal() {
        const f = GameCodex._st().found;
        return GameCodex.ITEMS.reduce((n, it) => n + (f[it.id] > 0 ? 1 : 0), 0);
    },
    /** { found, total } по редкости. */
    progress(rarityId) {
        const f = GameCodex._st().found, list = GameCodex.list(rarityId);
        return { found: list.reduce((n, it) => n + (f[it.id] > 0 ? 1 : 0), 0), total: list.length };
    },

    /** Id редкостей, собранных целиком, награда за которые ещё не забрана. */
    claimable() {
        const s = GameCodex._st();
        return GameCodex.RARITIES.filter(r => {
            const p = GameCodex.progress(r.id);
            return p.total > 0 && p.found >= p.total && !s.claimed[r.id];
        }).map(r => r.id);
    },
    isClaimed(rarityId) { return !!GameCodex._st().claimed[rarityId]; },

    /** Забрать награду за собранную редкость (один раз) -> { ok, coins }. Монеты начисляет вызывающий. */
    claim(rarityId) {
        const s = GameCodex._st();
        if (GameCodex.claimable().indexOf(rarityId) < 0) return { ok: false, coins: 0 };
        s.claimed[rarityId] = true;
        GameCodex._save();
        return { ok: true, coins: GameCodex.rarity(rarityId).reward };
    },

    /** Есть находки, которых игрок ещё не видел в кодексе (красная точка на кнопке). */
    hasNew() {
        const s = GameCodex._st();
        return GameCodex.ITEMS.some(it => s.found[it.id] > 0 && !s.seen[it.id]);
    },
    isNew(id) {
        const s = GameCodex._st();
        return s.found[id] > 0 && !s.seen[id];
    },
    /** Все найденные считаются увиденными (при открытии окна). */
    markSeen() {
        const s = GameCodex._st();
        let ch = false;
        for (const it of GameCodex.ITEMS) if (s.found[it.id] > 0 && !s.seen[it.id]) { s.seen[it.id] = true; ch = true; }
        if (ch) GameCodex._save();
    },

    _lang() {
        return typeof Lang !== 'undefined' && Lang && Lang.code ? Lang.code : 'ru';
    },
    name(item) { return item.name[GameCodex._lang()] || item.name.en; },
    desc(item) { return item.desc[GameCodex._lang()] || item.desc.en; },
    rarityName(r) {
        const rr = typeof r === 'string' ? GameCodex.rarity(r) : r;
        return rr.name[GameCodex._lang()] || rr.name.en;
    },
};
