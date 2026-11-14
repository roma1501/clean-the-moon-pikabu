// GameShopData.js — данные магазина косметики Clean the Moon: вкладки, предметы, награды Daily Gift, секторы колеса.
// Глобалы: SHOP_TABS, SHOP_ITEMS, DAILY_REWARDS, WHEEL_SECTORS. Всё — только внешний вид, игрового преимущества нет.
//
// ФОРМАТ ВИДА. Навесные детали собираются из примитивов (их строит GameLook, рисует превью GameShopUI):
//   фигура  { k: 'box'|'cyl'|'sph'|'tor'|'poly', s: размеры, p: [x,y,z], r: [rx,ry,rz] (рад), sc: [sx,sy,sz], c: 0xRRGGBB, g: true — светится }
//   группа  { on?: часть тела, at: [x,y,z] (опорная точка), shapes: [...], anim?: { t, ax, v, amp, ph } }
//   оси частей тела: x — вперёд, y — вверх, z — вправо; голова 44×44×50 (центр — начало), торс 35×56×70.
//   anim.t: spin (вращение), sway (качание), bob (подпрыгивание), pulse (дыхание), squash (сплющивание),
//           hue (цвет по кругу, для светящихся), blink (мигание).
// Поля по вкладкам: suit { skin, top, bottom, glove, boot, hair, face(ctx,w,h), parts, glow, cycle, aura },
//   helmet { glass, alpha, parts }, pack { tank, parts, glow }, trail { fx: слой частиц | [слои] },
//   pet { float, parts, fx }, stream { color, cycle, rainbow, rim, sparks }.

const SHOP_TABS = [
    { id: 'suit', name: { ru: 'Костюмы', en: 'Suits' } },
    { id: 'helmet', name: { ru: 'Шлемы', en: 'Helmets' } },
    { id: 'pack', name: { ru: 'Ранцы', en: 'Packs' } },
    { id: 'trail', name: { ru: 'Следы', en: 'Trails' } },
    { id: 'pet', name: { ru: 'Спутники', en: 'Pets' } },
    { id: 'stream', name: { ru: 'Поток', en: 'Streams' } },
];

/** @type {any[]} */
const SHOP_ITEMS = (() => {
    const PI = Math.PI, H = PI / 2;
    // --- конструкторы фигур ---
    const bx = (w, h, d, x, y, z, c, o) => ({ k: 'box', s: [w, h, d], p: [x, y, z], c, ...o });
    const cy = (dt, db, h, x, y, z, c, o) => ({ k: 'cyl', s: [dt, db, h], p: [x, y, z], c, ...o });
    const co = (d, h, x, y, z, c, o) => ({ k: 'cyl', s: [0, d, h], p: [x, y, z], c, ...o });
    const sp = (d, x, y, z, c, o) => ({ k: 'sph', s: [d], p: [x, y, z], c, ...o });
    const to = (d, t, x, y, z, c, o) => ({ k: 'tor', s: [d, t], p: [x, y, z], c, ...o });
    const gm = (d, x, y, z, c, o) => ({ k: 'poly', s: [d], p: [x, y, z], c, t: 1, ...o });
    const G = { g: true };
    /** Группа деталей. */
    const grp = (on, at, shapes, anim) => ({ on, at, shapes, anim });
    /** Зеркало фигур по z (левая сторона из правой). */
    const mirror = (shapes) => shapes.map((s) => ({ ...s, p: [s.p[0], s.p[1], -s.p[2]], r: s.r ? [-s.r[0], -s.r[1], s.r[2]] : undefined }));
    /** Пара групп: правая (z > 0) и зеркальная левая; качание вокруг оси x в противофазе зеркала. */
    const pair = (on, at, shapes, anim) => [
        grp(on, at, shapes, anim),
        grp(on, [at[0], at[1], -at[2]], mirror(shapes), anim ? { ...anim, amp: -(anim.amp || 0) } : undefined),
    ];
    /** Звезда из конусов в плоскости yz, смотрит вперёд (+x). */
    const starShapes = (r, len, c, x, o) => {
        const out = [];
        for (let i = 0; i < 5; i++) {
            const a = i * (PI * 2 / 5);
            const dy = Math.cos(a), dz = Math.sin(a);
            out.push(co(r, len, x, dy * (len / 2 + r * 0.35), dz * (len / 2 + r * 0.35), c, { r: [a, 0, 0], ...o }));
        }
        return out;
    };
    const price = (kind, n) => ({ [kind]: n });
    const mk = (tab) => (id, ru, en, rarity, pr, rest) => ({ id: tab + '_' + id, tab, name: { ru, en }, rarity, price: pr, ...rest });
    const C = (n) => price('coins', n), A = (n) => price('ads', n);

    // --- лица (холст 256×144: наклейка 36×20 на голове) ---
    const FACE = (o = {}) => (ctx, W, H) => {
        ctx.clearRect(0, 0, W, H);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const ink = o.ink || '#1c1e24';
        const disc = (x, y, rx, ry, col, rot = 0) => { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, 6.2832); ctx.fill(); };
        const ex = [W * 0.3, W * 0.7], ey = H * 0.38;
        if (o.blush) for (const sx of [-1, 1]) disc(W * (0.5 + sx * 0.36), H * 0.64, W * 0.07, H * 0.1, o.blush);
        if (o.mask) {                                  // тёмная повязка (ниндзя): глаза остаются в прорези
            ctx.fillStyle = o.mask; ctx.fillRect(0, H * 0.02, W, H * 0.98);
            ctx.fillStyle = o.slit || '#f2d6b8'; ctx.fillRect(W * 0.08, H * 0.18, W * 0.84, H * 0.34);
        }
        const star = (x, y, r, col) => {
            ctx.fillStyle = col; ctx.beginPath();
            for (let i = 0; i < 10; i++) { const a = -H / 144 * 1.5708 + i * 0.6283, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
            ctx.closePath(); ctx.fill();
        };
        const eyes = o.eyes || 'oval';
        if (eyes === 'oval') {
            for (const sx of [-1, 1]) { const x = W * (0.5 + sx * 0.2); disc(x, ey, W * 0.048, H * 0.17, ink); disc(x + W * 0.014, ey - H * 0.06, W * 0.02, W * 0.02, '#fff'); }
        } else if (eyes === 'round') {
            for (const x of ex) { disc(x, ey, W * 0.085, H * 0.22, '#fff'); disc(x + W * 0.01, ey + H * 0.02, W * 0.045, H * 0.13, o.iris || ink); disc(x + W * 0.025, ey - H * 0.04, W * 0.018, W * 0.018, '#fff'); }
        } else if (eyes === 'screen') {
            ctx.fillStyle = '#0b1220'; ctx.beginPath(); ctx.roundRect(W * 0.12, H * 0.12, W * 0.76, H * 0.46, 14); ctx.fill();
            ctx.shadowColor = o.glow || '#6af'; ctx.shadowBlur = 14; ctx.fillStyle = o.glow || '#6cf';
            for (const x of ex) ctx.fillRect(x - W * 0.07, ey - H * 0.12, W * 0.14, H * 0.24);
            ctx.shadowBlur = 0;
        } else if (eyes === 'visor') {
            ctx.fillStyle = '#0b1220'; ctx.beginPath(); ctx.roundRect(W * 0.1, H * 0.2, W * 0.8, H * 0.3, 18); ctx.fill();
            ctx.shadowColor = o.glow || '#f33'; ctx.shadowBlur = 14; ctx.fillStyle = o.glow || '#f33'; ctx.fillRect(W * 0.2, ey - H * 0.04, W * 0.6, H * 0.08); ctx.shadowBlur = 0;
        } else if (eyes === 'x') {
            ctx.strokeStyle = ink; ctx.lineWidth = W * 0.03;
            for (const x of ex) { const r = W * 0.05; ctx.beginPath(); ctx.moveTo(x - r, ey - r); ctx.lineTo(x + r, ey + r); ctx.moveTo(x + r, ey - r); ctx.lineTo(x - r, ey + r); ctx.stroke(); }
        } else if (eyes === 'three') {
            for (const [x, y, r] of [[W * 0.22, H * 0.42, 0.06], [W * 0.78, H * 0.42, 0.06], [W * 0.5, H * 0.24, 0.07]]) { disc(x, y, W * r, W * r * 1.15, ink); disc(x + W * 0.015, y - H * 0.04, W * 0.016, W * 0.016, '#fff'); }
        } else if (eyes === 'cat') {
            for (const x of ex) { disc(x, ey, W * 0.07, H * 0.19, o.iris || '#b6ff4a'); disc(x, ey, W * 0.016, H * 0.17, ink); }
        } else if (eyes === 'bee') {
            for (const x of ex) { disc(x, ey, W * 0.075, H * 0.22, ink); disc(x + W * 0.02, ey - H * 0.07, W * 0.026, W * 0.026, '#fff'); }
        } else if (eyes === 'patch') {
            disc(ex[1], ey, W * 0.048, H * 0.17, ink); disc(ex[1] + W * 0.014, ey - H * 0.06, W * 0.02, W * 0.02, '#fff');
            ctx.strokeStyle = ink; ctx.lineWidth = W * 0.02; ctx.beginPath(); ctx.moveTo(W * 0.04, H * 0.12); ctx.lineTo(W * 0.62, H * 0.52); ctx.stroke();
            disc(ex[0], ey + H * 0.02, W * 0.095, H * 0.2, ink);
        } else if (eyes === 'star') {
            for (const x of ex) star(x, ey, W * 0.085, o.glow || '#ffd84a');
        } else if (eyes === 'slit') {
            ctx.strokeStyle = ink; ctx.lineWidth = W * 0.032;
            ctx.beginPath(); ctx.moveTo(W * 0.18, ey - H * 0.06); ctx.lineTo(W * 0.4, ey + H * 0.04); ctx.moveTo(W * 0.82, ey - H * 0.06); ctx.lineTo(W * 0.6, ey + H * 0.04); ctx.stroke();
        } else if (eyes === 'glow') {
            ctx.shadowColor = o.glow || '#fff'; ctx.shadowBlur = 18;
            for (const x of ex) disc(x, ey, W * 0.055, H * 0.17, o.glow || '#fff');
            ctx.shadowBlur = 0;
        } else if (eyes === 'happy') {
            ctx.strokeStyle = ink; ctx.lineWidth = W * 0.032;
            for (const x of ex) { ctx.beginPath(); ctx.arc(x, ey + H * 0.08, W * 0.055, PI * 1.1, PI * 1.9); ctx.stroke(); }
        }
        if (o.brow) { ctx.strokeStyle = o.brow; ctx.lineWidth = W * 0.03; ctx.beginPath(); ctx.moveTo(W * 0.14, H * 0.16); ctx.lineTo(W * 0.4, H * 0.24); ctx.moveTo(W * 0.86, H * 0.16); ctx.lineTo(W * 0.6, H * 0.24); ctx.stroke(); }
        const mouth = o.mouth || 'smile';
        ctx.strokeStyle = o.mink || ink; ctx.fillStyle = o.mink || ink; ctx.lineWidth = W * 0.03;
        const mx = W * 0.5, my = H * 0.5;
        if (mouth === 'smile') { ctx.beginPath(); ctx.arc(mx, my, W * 0.16, PI * 0.18, PI * 0.82); ctx.stroke(); }
        else if (mouth === 'grin') { ctx.beginPath(); ctx.arc(mx, my - H * 0.04, W * 0.2, PI * 0.08, PI * 0.92); ctx.closePath(); ctx.fillStyle = '#3a1020'; ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillRect(mx - W * 0.15, my + H * 0.01, W * 0.3, H * 0.055); }
        else if (mouth === 'flat') { ctx.beginPath(); ctx.moveTo(mx - W * 0.1, my + H * 0.12); ctx.lineTo(mx + W * 0.1, my + H * 0.12); ctx.stroke(); }
        else if (mouth === 'smirk') { ctx.beginPath(); ctx.moveTo(mx - W * 0.1, my + H * 0.1); ctx.quadraticCurveTo(mx + W * 0.05, my + H * 0.2, mx + W * 0.16, my + H * 0.04); ctx.stroke(); }
        else if (mouth === 'fangs') { ctx.beginPath(); ctx.arc(mx, my, W * 0.14, PI * 0.18, PI * 0.82); ctx.stroke(); ctx.fillStyle = '#fff'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(mx + sx * W * 0.1, my + H * 0.14); ctx.lineTo(mx + sx * W * 0.05, my + H * 0.14); ctx.lineTo(mx + sx * W * 0.075, my + H * 0.26); ctx.fill(); } }
        else if (mouth === 'zig') { ctx.beginPath(); ctx.moveTo(mx - W * 0.16, my + H * 0.12); for (let i = 1; i <= 8; i++) ctx.lineTo(mx - W * 0.16 + i * W * 0.04, my + H * (i % 2 ? 0.2 : 0.1)); ctx.stroke(); }
        else if (mouth === 'cat') { ctx.beginPath(); ctx.moveTo(mx, my - H * 0.02); ctx.lineTo(mx, my + H * 0.08); ctx.arc(mx - W * 0.05, my + H * 0.08, W * 0.05, 0, PI * 0.9); ctx.moveTo(mx, my + H * 0.08); ctx.arc(mx + W * 0.05, my + H * 0.08, W * 0.05, PI, PI * 0.1, true); ctx.stroke(); disc(mx, my - H * 0.06, W * 0.03, H * 0.05, '#ff8aa8'); }
        else if (mouth === 'tongue') { ctx.beginPath(); ctx.arc(mx, my, W * 0.14, PI * 0.18, PI * 0.82); ctx.stroke(); disc(mx, my + H * 0.2, W * 0.045, H * 0.07, '#ff7a96'); }
        else if (mouth === 'o') { disc(mx, my + H * 0.14, W * 0.04, H * 0.09, ink); }
        if (o.mustache) { ctx.fillStyle = o.mustache; ctx.beginPath(); ctx.ellipse(mx - W * 0.07, my + H * 0.02, W * 0.08, H * 0.06, 0.3, 0, 6.3); ctx.ellipse(mx + W * 0.07, my + H * 0.02, W * 0.08, H * 0.06, -0.3, 0, 6.3); ctx.fill(); }
        if (o.scar) { ctx.strokeStyle = o.scar; ctx.lineWidth = W * 0.015; ctx.beginPath(); ctx.moveTo(W * 0.72, H * 0.1); ctx.lineTo(W * 0.62, H * 0.6); ctx.stroke(); for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(W * 0.69 - i * W * 0.025, H * 0.2 + i * H * 0.14); ctx.lineTo(W * 0.74 - i * W * 0.025, H * 0.24 + i * H * 0.14); ctx.stroke(); } }
        if (o.whisk) { ctx.strokeStyle = o.whisk; ctx.lineWidth = W * 0.012; for (const sx of [-1, 1]) for (const dy of [-0.04, 0.04]) { ctx.beginPath(); ctx.moveTo(W * (0.5 + sx * 0.2), H * (0.58 + dy)); ctx.lineTo(W * (0.5 + sx * 0.46), H * (0.55 + dy * 3)); ctx.stroke(); } }
        if (o.freckles) { ctx.fillStyle = o.freckles; for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) disc(W * (0.5 + sx * (0.28 + i * 0.03)), H * (0.58 + (i % 2) * 0.05), W * 0.01, W * 0.01, o.freckles); }
    };

    const Hm0 = mk('helmet');
    /** Шлемы: детали сидят на голове (верх головы y = 22), а не на стекле (y = 52): сдвиг групп вниз. */
    const Hm = (...a) => { const it = Hm0(...a); if (it.parts) it.parts = it.parts.map((g) => ({ ...g, at: [g.at[0], g.at[1] - 20, g.at[2]] })); return it; };
    const S = mk('suit'), P = mk('pack'), T = mk('trail'), Pt = mk('pet'), St = mk('stream');
    /** @type {any[]} */
    const items = [];
    const add = (...a) => { for (const x of a) items.push(x); };

    // =============================================================================================
    // 1. КОСТЮМЫ (24: 1 по умолчанию, 3 эксклюзива Daily Gift, 7 за монеты, 13 за рекламу)
    // =============================================================================================
    const epaulet = (c) => [grp('UpperArmL', [0, 10, 0], [bx(36, 5, 36, 0, 0, 0, c)]), grp('UpperArmR', [0, 10, 0], [bx(36, 5, 36, 0, 0, 0, c)])];
    const belt = (c, buckle) => grp('LowerTorso', [0, 0, 0], [bx(37, 8, 72, 0, 0, 0, c), bx(3, 6, 12, 19, 0, 0, buckle || 0xf2c14e)]);
    add(
        S('default', 'Уборщик', 'Cleaner', 'common', undefined, {
            default: true, skin: 0xffd9b0, top: 0x2f6fd6, bottom: 0x2a3550, glove: 0xf2f5ff, boot: 0xf2f5ff, hair: 0x7a4a1c,
        }),
        // ---- за монеты
        S('mechanic', 'Механик', 'Mechanic', 'common', C(150), {
            skin: 0xf2c9a0, top: 0xe8862a, bottom: 0x35507a, glove: 0x8a5a2b, boot: 0x4a3a2a, hair: 0x3a2a1c,
            face: FACE({ eyes: 'oval', mouth: 'smirk', mustache: '#3a2a1c' }),
            parts: [belt(0x6b4423), grp('LowerTorso', [0, 0, 0], [bx(4, 22, 5, 0, -10, 39, 0x9aa3b2, { r: [0, 0, 0.1] }), bx(7, 7, 6, 0, -22, 39, 0x6b7384)]),
                grp('UpperTorso', [0, 0, 0], [bx(1.5, 11, 15, 18, 10, -14, 0x9c5a16), bx(1.7, 3, 11, 18, 14, -14, 0xf2c14e)])],
        }),
        S('cosmo', 'Космонавт', 'Cosmonaut', 'common', C(300), {
            skin: 0xffd9b0, top: 0xf2f4fa, bottom: 0xd8dcea, glove: 0xe33b3b, boot: 0xe33b3b, hair: 0x5a3a1a,
            face: FACE({ eyes: 'round', mouth: 'smile', blush: 'rgba(255,110,110,0.3)' }),
            parts: [...epaulet(0xe33b3b), grp('UpperTorso', [0, 0, 0], [bx(1.5, 5, 18, 18, 12, -14, 0xffffff), bx(1.5, 5, 18, 18, 7, -14, 0x2f5fd6), bx(1.5, 5, 18, 18, 2, -14, 0xe33b3b), bx(1.5, 12, 12, 18, 12, 14, 0xe8edf8)])],
        }),
        S('bee', 'Пчёлка', 'Busy Bee', 'uncommon', C(700), {
            skin: 0xffe2a0, top: 0xffd23a, bottom: 0x2a2a30, glove: 0x2a2a30, boot: 0x2a2a30, hair: null,
            face: FACE({ eyes: 'bee', mouth: 'smile', blush: 'rgba(255,120,90,0.35)' }),
            parts: [grp('UpperTorso', [0, 0, 0], [bx(36.5, 7, 71, 0, 12, 0, 0x1c1c22), bx(36.5, 7, 71, 0, -4, 0, 0x1c1c22), bx(36.5, 7, 71, 0, -20, 0, 0x1c1c22)]),
                grp('LowerTorso', [0, 0, 0], [co(10, 18, -24, -2, 0, 0x1c1c22, { r: [0, 0, H] })]),
                ...pair('UpperTorso', [-30, 26, 30], [sp(1, -2, 16, 18, 0xd8f2ff, { sc: [2, 30, 46], r: [-0.7, 0, 0] }), sp(1, -2, 2, 26, 0xbfe6ff, { sc: [2, 18, 32], r: [-0.9, 0, 0] })], { t: 'sway', ax: 'x', amp: 0.5, v: 20 })],
        }),
        S('pirate', 'Пират', 'Pirate', 'uncommon', C(1400), {
            skin: 0xe8b890, top: 0x8e2a3a, bottom: 0x23232b, glove: 0x3b2b20, boot: 0x2b1b12, hair: null,
            face: FACE({ eyes: 'patch', mouth: 'grin', scar: '#a05a4a' }),
            parts: [grp('Head', [0, 0, 0], [bx(46, 10, 52, 0, 21, 0, 0xd22b2b), bx(8, 6, 7, -26, 20, 0, 0xd22b2b), bx(11, 4, 4, -31, 17, 4, 0xb01f1f, { r: [0, 0, -0.5] })], { t: 'sway', ax: 'z', amp: 0.08, v: 3 }),
                belt(0x3b2b20),
                grp('UpperTorso', [0, 0, 0], [bx(1.5, 14, 14, 18, 8, 0, 0xf5f0dc), bx(1.8, 3, 3, 18.1, 11, -3, 0x1c1c22), bx(1.8, 3, 3, 18.1, 11, 3, 0x1c1c22), bx(1.8, 4, 7, 18.1, 4, 0, 0x1c1c22), bx(1.5, 4, 4, 18, -4, -10, 0xf2c14e), bx(1.5, 4, 4, 18, -4, 10, 0xf2c14e)])],
        }),
        S('cat', 'Кот-уборщик', 'Space Cat', 'rare', C(3000), {
            skin: 0xf0a860, top: 0xf5b878, bottom: 0xd98a45, glove: 0xfff0d8, boot: 0xfff0d8, hair: null,
            face: FACE({ eyes: 'cat', mouth: 'cat', whisk: '#fff6e8' }),
            parts: [grp('Head', [0, 0, 0], [co(15, 17, 0, 29, -15, 0xf0a860), co(15, 17, 0, 29, 15, 0xf0a860), co(8, 10, 1.5, 28, -15, 0xff9ab4), co(8, 10, 1.5, 28, 15, 0xff9ab4)]),
                grp('LowerTorso', [-14, -2, 0], [cy(9, 10, 18, -9, 1, 0, 0xf0a860, { r: [0, 0, 1.25] }), cy(8, 9, 18, -21, 9, 0, 0xf0a860, { r: [0, 0, 0.7] }), cy(7, 8, 18, -29, 22, 0, 0xf0a860, { r: [0, 0, 0.2] }), sp(10, -30, 32, 0, 0xfff0d8)], { t: 'sway', ax: 'x', amp: 0.28, v: 3 })],
        }),
        S('ice', 'Ледяной', 'Frostbite', 'epic', C(9000), {
            skin: 0xdff6ff, top: 0x6fc7ff, bottom: 0x3b7fd8, glove: 0xffffff, boot: 0xcfeeff, hair: 0xcfefff, glow: 0.38,
            face: FACE({ eyes: 'glow', glow: '#9fe8ff', mouth: 'flat', ink: '#2b5f9a' }),
            parts: [grp('UpperArmL', [0, 12, 0], [gm(14, 0, 4, 0, 0xbdf0ff, { ...G, sc: [0.7, 1.9, 0.7] }), gm(9, 4, 2, 6, 0xd8f8ff, { ...G, sc: [0.7, 1.5, 0.7], r: [0.4, 0, 0.3] })]),
                grp('UpperArmR', [0, 12, 0], [gm(14, 0, 4, 0, 0xbdf0ff, { ...G, sc: [0.7, 1.9, 0.7] }), gm(9, 4, 2, -6, 0xd8f8ff, { ...G, sc: [0.7, 1.5, 0.7], r: [-0.4, 0, -0.3] })]),
                grp('UpperTorso', [0, 0, 0], [gm(16, 19, 10, 0, 0xd8f8ff, { ...G, sc: [0.5, 1.6, 1] })])],
            aura: { tex: 'flake', color: '#cfefff', color2: '#7fd0ff', rate: 14, life: [1.2, 2.2], size: [4, 9], speed: [2, 10], gravity: [0, -14, 0], box: [[-30, 0, -30], [30, 150, 30]], spin: [-2, 2] },
        }),
        S('gold', 'Золотой', 'Golden', 'legendary', C(25000), {
            skin: 0xffe27a, top: 0xf2b620, bottom: 0xd69a10, glove: 0xfff0a0, boot: 0xffe27a, hair: 0xffd23a, glow: 0.45, pulse: 0.12,
            face: FACE({ eyes: 'round', iris: '#a56a00', mouth: 'grin' }),
            parts: [grp('UpperTorso', [0, 0, 0], [cy(22, 22, 3, 18, 10, 0, 0xfff2a8, { r: [0, 0, H] }), cy(14, 14, 3.4, 18.5, 10, 0, 0xf2b620, { r: [0, 0, H] })]),
                grp('UpperArmL', [0, 10, 0], [co(11, 20, 0, 12, 0, 0xffe45c), bx(36, 5, 36, 0, 0, 0, 0xf2b620)]),
                grp('UpperArmR', [0, 10, 0], [co(11, 20, 0, 12, 0, 0xffe45c), bx(36, 5, 36, 0, 0, 0, 0xf2b620)]),
                belt(0xb87b0a, 0xfff2a8)],
            aura: { tex: 'spark', color: '#ffe27a', color2: '#fff6c8', rate: 22, life: [0.8, 1.6], size: [3, 7], speed: [4, 16], gravity: [0, 10, 0], box: [[-34, 0, -34], [34, 170, 34]] },
        }),
        // ---- за рекламу
        S('ninja', 'Ниндзя', 'Ninja', 'common', A(1), {
            skin: 0x2a2a34, top: 0x24242e, bottom: 0x1b1b24, glove: 0x24242e, boot: 0x14141b, hair: null,
            face: FACE({ mask: '#20202a', slit: '#f2d6b8', eyes: 'slit', mouth: 'none', ink: '#14141b' }),
            parts: [belt(0xd23030, 0xd23030), grp('Head', [-24, 14, 0], [bx(4, 4, 15, -2, 0, 8, 0xd23030, { r: [0, 0.3, 0.4] }), bx(4, 4, 12, -4, -3, 14, 0xd23030, { r: [0, 0.6, 0.9] })], { t: 'sway', ax: 'z', amp: 0.25, v: 7 }),
                grp('Head', [0, 0, 0], [bx(45.5, 5, 51.5, 0, 15, 0, 0xd23030)])],
        }),
        S('miner', 'Шахтёр', 'Miner', 'common', A(1), {
            skin: 0xd9a77a, top: 0xf2c230, bottom: 0x5a4a3a, glove: 0x8a6a3a, boot: 0x3a2a1c, hair: 0x2a1a10,
            face: FACE({ eyes: 'oval', mouth: 'grin', mustache: '#2a1a10' }),
            parts: [grp('UpperTorso', [0, 0, 0], [bx(35.8, 4, 71, 0, 8, 0, 0xeeeeee), bx(35.8, 4, 71, 0, -6, 0, 0xeeeeee), cy(3, 3, 44, -20, 6, -22, 0x8a5a2b, { r: [0, 0, 0.35] }), bx(3, 5, 26, -27, 24, -22, 0x9aa3b2, { r: [0, 0, 0.35] })]),
                grp('Head', [0, 0, 0], [sp(52, 0, 16, 0, 0xf2a21f, { sc: [1, 0.5, 1] }), bx(8, 3, 54, 18, 9, 0, 0xf2a21f), bx(5, 5, 8, 24, 16, 0, 0xfff7c8, G)])],
        }),
        S('sailor', 'Матрос', 'Sailor', 'common', A(1), {
            skin: 0xffd9b0, top: 0xf4f6fb, bottom: 0x24407a, glove: 0xf4f6fb, boot: 0x24407a, hair: 0x2a1a10,
            face: FACE({ eyes: 'oval', mouth: 'smile', freckles: '#c9784a' }),
            parts: [grp('UpperTorso', [0, 0, 0], [bx(36, 6, 72, 0, 25, 0, 0x24407a), bx(20, 2.6, 4, 18.2, 15, 0, 0xd23030), bx(36, 3, 71, 0, 18, 0, 0xffffff)]),
                grp('Head', [0, 0, 0], [bx(47, 7, 53, 0, 22, 0, 0xf4f6fb), bx(8, 4, 54, 0, 26, 0, 0x24407a), sp(8, 0, 30, 0, 0xe33b3b)])],
        }),
        S('robot', 'Робот', 'Robot', 'uncommon', A(2), {
            skin: 0xaab4c4, top: 0x7d8799, bottom: 0x4a5468, glove: 0x39414f, boot: 0x39414f, hair: null,
            face: FACE({ eyes: 'screen', glow: '#58e6ff', mouth: 'none' }),
            parts: [grp('UpperTorso', [0, 0, 0], [bx(1.6, 22, 30, 18, 6, 0, 0x39414f), bx(1.9, 3, 5, 18.2, 12, -8, 0x58e6ff, G), bx(1.9, 3, 5, 18.2, 12, 0, 0xffd23a, G), bx(1.9, 3, 5, 18.2, 12, 8, 0xff5a7a, G), bx(1.9, 3, 26, 18.2, 4, 0, 0x2a303c)]),
                grp('Head', [0, 0, 0], [cy(7, 7, 6, 0, 0, 29, 0x39414f, { r: [H, 0, 0] }), cy(7, 7, 6, 0, 0, -29, 0x39414f, { r: [H, 0, 0] }), cy(2, 2, 10, -4, 27, 0, 0x39414f), sp(5, -4, 33, 0, 0xff5a7a, G)])],
        }),
        S('alien', 'Пришелец', 'Little Green', 'uncommon', A(2), {
            skin: 0x7ddc4a, top: 0x6a5acd, bottom: 0x453b8a, glove: 0x7ddc4a, boot: 0x2f2a63, hair: null,
            face: FACE({ eyes: 'three', mouth: 'smile', ink: '#16301a' }),
            parts: [grp('Head', [0, 0, 0], [cy(1.6, 1.6, 12, 4, 28, -10, 0x7ddc4a, { r: [0.3, 0, 0.2] }), cy(1.6, 1.6, 12, 4, 28, 10, 0x7ddc4a, { r: [-0.3, 0, 0.2] }), sp(6, 6, 35, -12, 0xc6ff7a, G), sp(6, 6, 35, 12, 0xc6ff7a, G)]),
                grp('UpperTorso', [0, 0, 0], [bx(1.6, 4, 36, 18, 8, 0, 0x9d8cff)])],
        }),
        S('zombie', 'Зомби-уборщик', 'Zombie Janitor', 'uncommon', A(2), {
            skin: 0x9bbf7a, top: 0x5e6a4a, bottom: 0x3b3f4a, glove: 0x7a9a5e, boot: 0x2b2e36, hair: 0x4a5236,
            face: FACE({ eyes: 'x', mouth: 'zig', ink: '#26301e' }),
            parts: [grp('UpperTorso', [0, 0, 0], [bx(36, 5, 12, 0, 8, -26, 0x40493a, { r: [0, 0, 0.15] }), bx(1.6, 3, 12, 18, -6, 12, 0xc9d6a8, { r: [0, 0, 0.4] }), bx(1.6, 3, 12, 18, -12, 14, 0xc9d6a8, { r: [0, 0, -0.4] })]),
                grp('UpperArmL', [0, -10, 0], [bx(35, 8, 35, 0, 0, 0, 0xe8e0c8)])],
        }),
        S('knight', 'Звёздный рыцарь', 'Star Knight', 'rare', A(3), {
            skin: 0xffd9b0, top: 0xb8c4d8, bottom: 0x7a869e, glove: 0x8a96ae, boot: 0x8a96ae, hair: 0x6a4a2a,
            face: FACE({ eyes: 'oval', mouth: 'smirk', brow: '#4a3a2a' }),
            parts: [grp('UpperTorso', [0, 0, 0], [bx(2, 38, 56, 18, 6, 0, 0xdde4f0), gm(14, 20, 8, 0, 0xffd23a, { sc: [0.3, 1, 1] }), bx(2, 4, 58, 18.5, -12, 0, 0x7a869e)]),
                grp('UpperArmL', [0, 10, 0], [sp(34, 0, 3, 0, 0xdde4f0, { sc: [1, 0.55, 1] }), co(8, 12, 0, 12, 0, 0xffd23a)]),
                grp('UpperArmR', [0, 10, 0], [sp(34, 0, 3, 0, 0xdde4f0, { sc: [1, 0.55, 1] }), co(8, 12, 0, 12, 0, 0xffd23a)]),
                grp('Head', [0, 0, 0], [bx(47, 4, 53, 0, 20, 0, 0xdde4f0), bx(30, 16, 4, -4, 28, 0, 0xe33b3b, { r: [0, 0, -0.2] })], { t: 'sway', ax: 'z', amp: 0.05, v: 3 })],
        }),
        S('wizard', 'Лунный маг', 'Moon Mage', 'rare', A(3), {
            skin: 0xf2d0b0, top: 0x5b3fc4, bottom: 0x3a2a8a, glove: 0xf4e8ff, boot: 0x2a1f66, hair: 0xe8e8f4,
            face: FACE({ eyes: 'happy', mouth: 'smile', mustache: '#e8e8f4' }),
            parts: [grp('LowerTorso', [0, -4, 0], [cy(44, 70, 36, 0, -16, 0, 0x5b3fc4), to(66, 4, 0, -33, 0, 0xffd23a), gm(8, 22, -12, 0, 0xffe27a, { ...G }), gm(6, 20, -22, 14, 0xffe27a, G), gm(6, 20, -22, -14, 0xffe27a, G)]),
                grp('UpperTorso', [0, 0, 0], [bx(37, 5, 72, 0, 25, 0, 0x7b5fe0), sp(8, 19, 14, 0, 0xffe27a, G)])],
        }),
        S('dragon', 'Дракончик', 'Dragonling', 'rare', A(3), {
            skin: 0x62d27a, top: 0x3fa65a, bottom: 0x2a7a42, glove: 0xf2e6a8, boot: 0xf2e6a8, hair: null,
            face: FACE({ eyes: 'cat', iris: '#ffd23a', mouth: 'fangs' }),
            parts: [grp('UpperTorso', [0, 0, 0], [co(10, 14, -18, 24, 0, 0xf2e6a8), co(10, 14, -18, 8, 0, 0xf2e6a8), co(10, 14, -18, -8, 0, 0xf2e6a8), co(10, 14, -18, -24, 0, 0xf2e6a8)].map((s) => ({ ...s, r: [0, 0, 0.5] }))),
                grp('Head', [0, 0, 0], [co(8, 14, 0, 28, -12, 0xf2e6a8, { r: [0, 0, 0.2] }), co(8, 14, 0, 28, 12, 0xf2e6a8, { r: [0, 0, 0.2] })]),
                grp('LowerTorso', [-16, -2, 0], [cy(9, 11, 20, -10, 0, 0, 0x3fa65a, { r: [0, 0, 1.2] }), cy(5, 9, 20, -22, 8, 0, 0x3fa65a, { r: [0, 0, 0.7] }), co(10, 12, -30, 17, 0, 0xf2e6a8)], { t: 'sway', ax: 'x', amp: 0.25, v: 3 })],
        }),
        S('lava', 'Лавовый', 'Magma', 'epic', A(4), {
            skin: 0x4a3a3a, top: 0x3a2a2e, bottom: 0x2a1f22, glove: 0xff6a1a, boot: 0xff6a1a, hair: null, glow: 0.3, pulse: 0.28,
            face: FACE({ eyes: 'glow', glow: '#ffb02a', mouth: 'zig', mink: '#ff8a1a' }),
            parts: [grp('UpperTorso', [0, 0, 0], [bx(1.6, 4, 40, 18, 14, 0, 0xff7a1a, { ...G, r: [0, 0, 0.6] }), bx(1.6, 32, 4, 18, 0, -12, 0xff7a1a, { ...G, r: [0, 0, 0.2] }), bx(1.6, 4, 28, 18, -10, 8, 0xffa21f, { ...G, r: [0, 0, -0.5] }), bx(1.6, 4, 24, -18, 12, 0, 0xff7a1a, G)]),
                grp('UpperArmL', [0, 10, 0], [co(12, 18, 0, 8, 0, 0xff6a1a, G)]), grp('UpperArmR', [0, 10, 0], [co(12, 18, 0, 8, 0, 0xff6a1a, G)]),
                grp('Head', [0, 0, 0], [co(8, 14, 0, 28, -12, 0xff6a1a, G), co(8, 14, 0, 28, 12, 0xff6a1a, G)])],
            aura: { tex: 'dot', color: '#ff8a1a', color2: '#ffd23a', rate: 26, life: [0.7, 1.4], size: [3, 7], speed: [6, 22], gravity: [0, 40, 0], box: [[-30, 0, -30], [30, 130, 30]] },
        }),
        S('rainbow', 'Радужный', 'Rainbow', 'epic', A(4), {
            skin: 0xfff0f6, top: 0xff6a9a, bottom: 0x6a9aff, glove: 0xffffff, boot: 0xffe27a, hair: 0xff8ad8, glow: 0.4, cycle: 'rainbow',
            face: FACE({ eyes: 'star', glow: '#ffd23a', mouth: 'grin' }),
            parts: [grp('UpperTorso', [0, 0, 0], [bx(1.6, 5, 40, 18, 14, 0, 0xff4d4d, G), bx(1.6, 5, 40, 18, 9, 0, 0xffd23a, G), bx(1.6, 5, 40, 18, 4, 0, 0x4dff6a, G), bx(1.6, 5, 40, 18, -1, 0, 0x4dc8ff, G)]),
                grp('Head', [0, 0, 0], [sp(7, 0, 31, 0, 0xffe27a, G)], { t: 'bob', amp: 2, v: 5 })],
            aura: { tex: 'star', color: '#ff8ad8', color2: '#8affb8', rate: 18, life: [0.8, 1.5], size: [4, 8], speed: [4, 16], gravity: [0, 12, 0], box: [[-32, 0, -32], [32, 160, 32]], spin: [-3, 3] },
        }),
        S('galaxy', 'Галактический', 'Galactic', 'legendary', A(5), {
            skin: 0xb8a4ff, top: 0x2a1f6a, bottom: 0x15103a, glove: 0x7a5bff, boot: 0x7a5bff, hair: 0x7a5bff, glow: 0.45, cycle: [0x2a1f6a, 0x4a2a9a, 0x1f3a8a, 0x5a2a9a],
            face: FACE({ eyes: 'glow', glow: '#c9b8ff', mouth: 'smile', mink: '#c9b8ff' }),
            parts: [grp('UpperTorso', [0, 0, 0], [sp(6, 18, 18, -18, 0xffffff, G), sp(4, 18, 6, 12, 0xffe27a, G), sp(5, 18, -6, -8, 0x8ad8ff, G), sp(3, 18, 20, 20, 0xffffff, G), sp(4, 18, -16, 20, 0xff9ae6, G), sp(3.5, -18, 10, -10, 0xffffff, G)]),
                grp('Head', [0, 0, 0], [to(60, 2.6, 0, 26, 0, 0xc9b8ff, { ...G, r: [0.2, 0, 0] }), sp(6, 30, 26, 0, 0xffe27a, G)], { t: 'spin', ax: 'y', v: 1.6 })],
            aura: { tex: 'star', color: '#c9b8ff', color2: '#8ad8ff', rate: 26, life: [1, 1.9], size: [4, 9], speed: [3, 12], gravity: [0, 6, 0], box: [[-36, 0, -36], [36, 170, 36]], spin: [-2, 2] },
        }),
        S('nova', 'Сверхновая', 'Supernova', 'legendary', A(5), {
            skin: 0xfff4d8, top: 0xfff0b8, bottom: 0xffc24a, glove: 0xffffff, boot: 0xffe27a, hair: 0xffffff, glow: 0.46, pulse: 0.14,
            face: FACE({ eyes: 'happy', mouth: 'grin', ink: '#8a5a10' }),
            parts: [grp('UpperTorso', [0, 0, 0], [...starShapes(14, 28, 0xfff2a8, 18.5, G).map((s) => ({ ...s, p: [s.p[0], s.p[1] + 6, s.p[2]], sc: [0.3, 1, 1] }))]),
                grp('Head', [0, 0, 0], [to(64, 3, 0, 8, 0, 0xfff2a8, { ...G, r: [H, 0, 0] })], { t: 'pulse', amp: 0.08, v: 4 })],
            aura: { tex: 'spark', color: '#fff2a8', color2: '#ffb02a', rate: 34, life: [0.5, 1.1], size: [5, 11], speed: [20, 60], gravity: [0, 0, 0], box: [[-14, 20, -14], [14, 130, 14]], direction: [[-1, -0.6, -1], [1, 0.8, 1]] },
        }),
        // ---- эксклюзивы Daily Gift (в продаже нет)
        S('royal', 'Лунный король', 'Moon King', 'legendary', undefined, {
            exclusive: 'daily', skin: 0xffd9b0, top: 0x7a2fd6, bottom: 0x3a1f7a, glove: 0xfff2c8, boot: 0xffd23a, hair: 0xe8e8f4, glow: 0.3, pulse: 0.1,
            face: FACE({ eyes: 'round', mouth: 'smile', mustache: '#e8e8f4', blush: 'rgba(255,120,120,0.25)' }),
            parts: [grp('UpperTorso', [0, 0, 0], [bx(37, 7, 72, 0, 24, 0, 0xf4f4ff), bx(37, 5, 72, 0, 18, 0, 0xffd23a), bx(1.6, 5, 5, 18.2, 8, -9, 0xffd23a), bx(1.6, 5, 5, 18.2, 8, 0, 0xffd23a), bx(1.6, 5, 5, 18.2, 8, 9, 0xffd23a), gm(12, 19, 18, 0, 0xff5a7a)]),
                grp('Head', [0, 0, 0], [cy(40, 34, 12, 0, 28, 0, 0xffd23a), co(8, 12, 0, 40, 0, 0xffd23a), co(8, 12, 12, 38, 0, 0xffd23a), co(8, 12, -12, 38, 0, 0xffd23a), sp(5, 0, 46, 0, 0x6af0ff)]),
                ...epaulet(0xffd23a)],
        }),
        S('keeper', 'Хранитель звёзд', 'Star Keeper', 'legendary', undefined, {
            exclusive: 'daily', skin: 0xe8f0ff, top: 0x1f3a8a, bottom: 0x14245a, glove: 0xffe27a, boot: 0xffe27a, hair: 0xffe27a, glow: 0.4, pulse: 0.15,
            face: FACE({ eyes: 'star', glow: '#ffe27a', mouth: 'smile' }),
            parts: [grp('Head', [0, 0, 0], [to(60, 2.6, 0, 40, 0, 0xffe27a, { ...G, r: [0.12, 0, 0] }), ...starShapes(4, 10, 0xffe27a, 0, G).map((s) => ({ ...s, p: [s.p[0] - 16, s.p[1] + 30, s.p[2]], sc: [0.35, 1, 1] }))], { t: 'spin', ax: 'y', v: 1.2 }),
                grp('UpperTorso', [0, 0, 0], [...starShapes(8, 15, 0xffe27a, 18.5, G).map((s) => ({ ...s, p: [s.p[0], s.p[1] + 8, s.p[2]], sc: [0.3, 1, 1] }))])],
            aura: { tex: 'star', color: '#ffe27a', color2: '#9fd4ff', rate: 20, life: [1, 2], size: [4, 9], speed: [3, 12], gravity: [0, 8, 0], box: [[-34, 0, -34], [34, 170, 34]], spin: [-2, 2] },
        }),
        S('comet', 'Повелитель комет', 'Comet Lord', 'legendary', undefined, {
            exclusive: 'daily', skin: 0xdff0ff, top: 0x2a5bd6, bottom: 0x14245a, glove: 0x9fe8ff, boot: 0x9fe8ff, hair: 0x9fe8ff, glow: 0.4, pulse: 0.12,
            face: FACE({ eyes: 'glow', glow: '#9fe8ff', mouth: 'smirk' }),
            parts: [grp('UpperTorso', [-14, 4, 0], [co(34, 90, -44, 0, 0, 0x7fc8ff, { ...G, r: [0, 0, H] }), co(20, 60, -34, 0, 0, 0xffffff, { ...G, r: [0, 0, H] }), sp(18, -6, 0, 0, 0xffffff, G)], { t: 'pulse', amp: 0.06, v: 5 }),
                grp('Head', [0, 0, 0], [co(10, 22, -8, 32, 0, 0x9fe8ff, { ...G, r: [0, 0, 0.5] })])],
            aura: { tex: 'dot', color: '#9fe8ff', color2: '#ffffff', rate: 30, life: [0.6, 1.2], size: [4, 9], speed: [4, 18], gravity: [0, 6, 0], box: [[-34, 10, -34], [34, 160, 34]] },
        }),
    );

    // =============================================================================================
    // 2. ШЛЕМЫ (22: 1 + 7 за монеты + 14 за рекламу)
    // =============================================================================================
    add(
        Hm('default', 'Обычный шлем', 'Plain Helmet', 'common', undefined, { default: true }),
        Hm('antenna', 'Антенна', 'Antenna', 'common', C(150), {
            glass: 0xb8e8ff, parts: [grp('Head', [0, 50, 0], [cy(2, 2, 24, 0, 12, 0, 0x8a96ae), sp(8, 0, 26, 0, 0xff4d5a, G)], { t: 'sway', ax: 'z', amp: 0.12, v: 3 })],
        }),
        Hm('ears', 'Кошачьи ушки', 'Cat Ears', 'common', C(450), {
            glass: 0xffd9ec, parts: [grp('Head', [0, 0, 0], [co(17, 20, -2, 46, -26, 0xffb3d1, { r: [0.25, 0, 0.15] }), co(17, 20, -2, 46, 26, 0xffb3d1, { r: [-0.25, 0, 0.15] }), co(9, 12, -0.5, 44, -26, 0xff6fa0, { r: [0.25, 0, 0.15] }), co(9, 12, -0.5, 44, 26, 0xff6fa0, { r: [-0.25, 0, 0.15] })])],
        }),
        Hm('pompom', 'Шапка с помпоном', 'Pompom Beanie', 'uncommon', C(900), {
            glass: 0xcfe8ff, parts: [grp('Head', [0, 0, 0], [sp(56, 0, 34, 0, 0xe33b3b, { sc: [1, 0.62, 1] }), to(52, 8, 0, 24, 0, 0xffffff, { sc: [1, 1, 1] }), sp(14, 0, 56, 0, 0xffffff)], { t: 'bob', amp: 0.8, v: 5 })],
        }),
        Hm('phones', 'Наушники', 'Headphones', 'uncommon', C(1800), {
            glass: 0xd8e8ff, parts: [grp('Head', [0, 0, 0], [to(60, 4, 0, 8, 0, 0x2a303c, { sc: [0.9, 1, 1.05], r: [H, 0, 0] }), cy(20, 20, 9, 0, 6, -30, 0x39414f, { r: [H, 0, 0] }), cy(20, 20, 9, 0, 6, 30, 0x39414f, { r: [H, 0, 0] }), cy(13, 13, 10, 0, 6, -30, 0x58e6ff, { ...G, r: [H, 0, 0] }), cy(13, 13, 10, 0, 6, 30, 0x58e6ff, { ...G, r: [H, 0, 0] })])],
        }),
        Hm('propeller', 'Пропеллер', 'Propeller Cap', 'rare', C(3500), {
            glass: 0xc8f0ff, parts: [grp('Head', [0, 0, 0], [sp(54, 0, 34, 0, 0x3fa0ff, { sc: [1, 0.55, 1] }), bx(30, 3, 22, 24, 32, 0, 0xffd23a), cy(2, 2, 8, 0, 54, 0, 0xcfd6e6)]), grp('Head', [0, 60, 0], [bx(40, 1.6, 7, 0, 0, 0, 0xff4d5a), bx(7, 1.6, 40, 0, 0, 0, 0xffd23a)], { t: 'spin', ax: 'y', v: 16 })],
        }),
        Hm('viking', 'Викинг', 'Viking', 'epic', C(8000), {
            glass: 0xffe9b8, parts: [grp('Head', [0, 0, 0], [sp(54, 0, 34, 0, 0x9aa3b2, { sc: [1, 0.6, 1] }), to(52, 6, 0, 26, 0, 0x6b7384), bx(4, 18, 5, 26, 36, 0, 0x6b7384), cy(5, 11, 26, 0, 40, -30, 0xf4ecd8, { r: [0.9, 0, 0] }), cy(5, 11, 26, 0, 40, 30, 0xf4ecd8, { r: [-0.9, 0, 0] }), co(8, 16, 0, 56, -41, 0xf4ecd8, { r: [0.5, 0, 0] }), co(8, 16, 0, 56, 41, 0xf4ecd8, { r: [-0.5, 0, 0] }), sp(7, 2, 54, 0, 0xffd23a, G)])],
        }),
        Hm('crown', 'Корона', 'Crown', 'legendary', C(25000), {
            glass: 0xfff0b8, alpha: 0.24, parts: [grp('Head', [0, 0, 0], [cy(46, 40, 14, 0, 48, 0, 0xffd23a, { sc: [1, 1, 1] }), ...[0, 1, 2, 3, 4].map((i) => co(10, 16, Math.cos(i * 1.2566) * 21, 62, Math.sin(i * 1.2566) * 21, 0xffe45c)), ...[0, 1, 2, 3, 4].map((i) => sp(6, Math.cos(i * 1.2566) * 21, 72, Math.sin(i * 1.2566) * 21, [0xff4d5a, 0x4dc8ff, 0x7dff5a, 0xff9ae6, 0xb04dff][i], G)), sp(8, 22, 48, 0, 0xff4d5a, G)], { t: 'bob', amp: 1.2, v: 3 })],
        }),
        Hm('flower', 'Цветок', 'Flower', 'common', A(1), {
            glass: 0xd8ffd8, parts: [grp('Head', [0, 50, 0], [cy(2, 2, 14, 0, 7, 0, 0x4fbf4f), ...[0, 1, 2, 3, 4, 5].map((i) => sp(10, Math.cos(i * 1.047) * 9, 18, Math.sin(i * 1.047) * 9, 0xff7fb0)), sp(9, 0, 18, 0, 0xffe45c)], { t: 'sway', ax: 'x', amp: 0.1, v: 2.5 })],
        }),
        Hm('visor', 'Козырёк', 'Sun Visor', 'common', A(1), {
            glass: 0xffe9b8, parts: [grp('Head', [0, 0, 0], [to(54, 5, 0, 38, 0, 0xffffff), bx(26, 3, 34, 27, 36, 0, 0x2fa6ff, { r: [0, 0, -0.18] })])],
        }),
        Hm('lamp', 'Лампа шахтёра', 'Miner Lamp', 'common', A(1), {
            glass: 0xfff7d0, parts: [grp('Head', [0, 0, 0], [cy(10, 12, 10, 40, 36, 0, 0x6b7384, { r: [0, 0, H] }), cy(8, 8, 3, 46, 36, 0, 0xfff7c8, { ...G, r: [0, 0, H] }), bx(8, 8, 4, 38, 36, 0, 0x6b7384), to(54, 4, 0, 33, 0, 0x6b7384)])],
        }),
        Hm('horns', 'Рожки', 'Little Horns', 'uncommon', A(2), {
            glass: 0xffc0c0, parts: [grp('Head', [0, 0, 0], [co(10, 22, 0, 52, -16, 0xe33b3b, { r: [0.35, 0, 0.1] }), co(10, 22, 0, 52, 16, 0xe33b3b, { r: [-0.35, 0, 0.1] }), co(6, 8, 0, 63, -21, 0xffd23a, { r: [0.55, 0, 0.1] }), co(6, 8, 0, 63, 21, 0xffd23a, { r: [-0.55, 0, 0.1] })])],
        }),
        Hm('tophat', 'Цилиндр', 'Top Hat', 'uncommon', A(2), {
            glass: 0xe0e4f0, parts: [grp('Head', [0, 0, 0], [cy(50, 50, 3, 0, 50, 0, 0x1c1e28), cy(34, 34, 26, 0, 63, 0, 0x1c1e28), cy(35, 35, 5, 0, 55, 0, 0xe33b3b), cy(24, 24, 1, 0, 76.6, 0, 0x2f3446)], { t: 'sway', ax: 'z', amp: 0.04, v: 2 })],
        }),
        Hm('siren', 'Мигалка', 'Siren Light', 'uncommon', A(2), {
            glass: 0xc8d8ff, parts: [grp('Head', [0, 50, 0], [cy(26, 30, 5, 0, 2.5, 0, 0x39414f)]), grp('Head', [0, 58, 0], [cy(18, 20, 12, 0, 0, 0, 0xff3a3a, { ...G })], { t: 'blink', v: 7 }), grp('Head', [0, 58, 0], [cy(18, 20, 12, 0, 0, 0, 0x3a7aff, G)], { t: 'blink', v: 7, ph: 3.1416 })],
        }),
        Hm('periscope', 'Перископ', 'Periscope', 'uncommon', A(2), {
            glass: 0xd0f0e0, parts: [grp('Head', [0, 0, 0], [cy(6, 6, 34, 0, 62, 0, 0x6b8f7a), cy(8, 8, 10, 6, 78, 0, 0x6b8f7a, { r: [0, 0, H] }), cy(6, 6, 2, 12, 78, 0, 0x9ff0ff, { ...G, r: [0, 0, H] }), bx(12, 4, 12, 0, 46, 0, 0x4f6f5c)], { t: 'sway', ax: 'y', amp: 0.5, v: 1.2 })],
        }),
        Hm('dish', 'Спутниковая тарелка', 'Satellite Dish', 'rare', A(3), {
            glass: 0xd8f0ff, parts: [grp('Head', [0, 0, 0], [cy(6, 6, 14, 0, 52, 0, 0x8a96ae), bx(10, 4, 10, 0, 47, 0, 0x6b7384)]), grp('Head', [0, 64, 0], [cy(34, 6, 8, 0, 4, 0, 0xe8edf5, { r: [0.5, 0, 0] }), cy(2, 2, 14, 0, 11, 8, 0x8a96ae, { r: [0.5, 0, 0] }), sp(5, 0, 16, 14, 0xff4d5a, G)], { t: 'spin', ax: 'y', v: 1.4 })],
        }),
        Hm('wizard', 'Колпак мага', 'Wizard Hat', 'rare', A(3), {
            glass: 0xd8c8ff, parts: [grp('Head', [0, 0, 0], [cy(60, 60, 3, 0, 50, 0, 0x4a2fb0), co(38, 52, 0, 76, 0, 0x5b3fc4, { r: [0, 0, -0.12] }), to(38, 4, 0, 52, 0, 0xffd23a), gm(8, 4, 76, 0, 0xffe27a, G), gm(6, 10, 62, 12, 0xffe27a, G), gm(6, -10, 66, -8, 0xffe27a, G)], { t: 'sway', ax: 'z', amp: 0.05, v: 2 })],
        }),
        Hm('spikes', 'Шипы дракона', 'Dragon Spikes', 'rare', A(3), {
            glass: 0xb8ffd0, parts: [grp('Head', [0, 0, 0], [...[0, 1, 2, 3, 4].map((i) => co(12 - i * 1.2, 24 - i * 3, 18 - i * 9, 54 + (i === 2 ? 3 : 0), 0, [0x3fa65a, 0x4fbf6a, 0x6fd88a, 0x4fbf6a, 0x3fa65a][i])), co(8, 16, 10, 50, -22, 0xf2e6a8, { r: [0.5, 0, 0] }), co(8, 16, 10, 50, 22, 0xf2e6a8, { r: [-0.5, 0, 0] })])],
        }),
        Hm('halo', 'Нимб', 'Halo', 'epic', A(4), {
            glass: 0xfff8d8, parts: [grp('Head', [0, 62, 0], [to(46, 5, 0, 0, 0, 0xfff2a8, G), to(46, 9, 0, 0, 0, 0xffe27a, { g: true, sc: [1, 0.3, 1] })], { t: 'bob', amp: 2, v: 2.4 })],
            fx: { tex: 'spark', color: '#fff2a8', color2: '#ffe27a', rate: 14, life: [0.8, 1.5], size: [3, 6], speed: [2, 8], gravity: [0, -8, 0], box: [[-22, 0, -22], [22, 4, 22]], at: [0, 205, 0] },
        }),
        Hm('flame', 'Огненная шапка', 'Flame Cap', 'epic', A(4), {
            glass: 0xffd0a0, alpha: 0.28, parts: [grp('Head', [0, 50, 0], [co(26, 30, 0, 14, 0, 0xff7a1a, G), co(18, 26, 6, 12, 0, 0xffa21f, G), co(12, 22, -6, 10, 6, 0xffd23a, G), co(12, 20, -6, 10, -6, 0xff4d1a, G)], { t: 'pulse', amp: 0.12, v: 11 })],
            fx: { tex: 'flame', color: '#ff7a1a', color2: '#ffd23a', rate: 26, life: [0.4, 0.8], size: [6, 12], speed: [8, 24], gravity: [0, 50, 0], box: [[-10, 0, -10], [10, 6, 10]], at: [0, 205, 0] },
        }),
        Hm('orbit', 'Орбита', 'Orbit', 'legendary', A(5), {
            glass: 0xc8d4ff, alpha: 0.26, parts: [grp('Head', [0, 28, 0], [to(74, 2.4, 0, 0, 0, 0x9fb4ff, { ...G, r: [0.3, 0, 0.15] })]),
                grp('Head', [0, 28, 0], [sp(10, 37, 0, 0, 0xffd23a, G), sp(6, -37, 0, 0, 0x7fe8ff, G), sp(8, 0, 6, 37, 0xff9ae6, G)], { t: 'spin', ax: 'y', v: 2.4 }),
                grp('Head', [0, 28, 0], [sp(14, 0, 0, 0, 0xfff2a8, G)], { t: 'pulse', amp: 0.15, v: 3 })],
        }),
        Hm('aura', 'Радужный ореол', 'Rainbow Halo', 'legendary', A(5), {
            glass: 0xffd0f0, alpha: 0.25, parts: [grp('Head', [0, 54, 0], [to(52, 6, 0, 0, 0, 0xffffff, { ...G })], { t: 'hue', v: 0.45 }),
                grp('Head', [0, 54, 0], [to(40, 4, 0, 6, 0, 0xffffff, { ...G, sc: [1, 1, 1] }), gm(8, 0, 14, 0, 0xffffff, G)], { t: 'hue', v: 0.45, ph: 0.4 })],
            fx: { tex: 'star', color: '#ff8ad8', color2: '#8affb8', rate: 14, life: [0.8, 1.4], size: [4, 8], speed: [4, 14], gravity: [0, 8, 0], box: [[-24, 0, -24], [24, 6, 24]], at: [0, 205, 0], spin: [-3, 3] },
        }),
    );

    // =============================================================================================
    // 3. РАНЦЫ (22)
    // =============================================================================================
    /** Перо: эллипсоид длиной L вдоль z от шарнира, наклонён вверх на угол a. */
    const feather = (L, w, a, c, o) => sp(1, -2, Math.sin(a) * L / 2, Math.cos(a) * L / 2, c, { sc: [3, w, L], r: [-a, 0, 0], ...o });
    const wing = (c1, c2, o) => [feather(74, 16, 0.95, c1, o), feather(62, 16, 0.5, c2, o), feather(50, 14, 0.08, c1, o), feather(36, 12, -0.35, c2, o)];
    add(
        P('default', 'Обычный ранец', 'Plain Pack', 'common', undefined, { default: true }),
        P('flag', 'Флажок', 'Little Flag', 'common', C(150), {
            parts: [grp('UpperTorso', [-56, 46, 0], [cy(1.6, 1.6, 40, 0, 20, 0, 0xcfd6e6), sp(4, 0, 41, 0, 0xffd23a), bx(1.5, 14, 22, 0, 32, 11, 0xe33b3b), bx(1.7, 5, 22, 0, 30, 11, 0xffffff)], { t: 'sway', ax: 'x', amp: 0.08, v: 3 })],
        }),
        P('balloons', 'Шарики', 'Balloons', 'common', C(500), {
            parts: [grp('UpperTorso', [-56, 40, 0], [cy(0.6, 0.6, 46, 0, 24, 0, 0xffffff), sp(22, 2, 58, -14, 0xff4d5a, { sc: [1, 1.15, 1] }), sp(22, 2, 62, 10, 0x4dc8ff, { sc: [1, 1.15, 1] }), sp(22, 6, 52, 2, 0xffd23a, { sc: [1, 1.15, 1] })], { t: 'sway', ax: 'z', amp: 0.1, v: 2.4 })],
        }),
        P('rocket', 'Ракетные сопла', 'Rocket Nozzles', 'uncommon', C(1200), {
            tank: 0xd8dde8, parts: [grp('UpperTorso', [0, 0, 0], [cy(14, 20, 20, -62, -20, -16, 0x7d8799), cy(14, 20, 20, -62, -20, 16, 0x7d8799), cy(10, 10, 6, -62, -32, -16, 0x39414f), cy(10, 10, 6, -62, -32, 16, 0x39414f)]),
                grp('UpperTorso', [0, -36, 0], [co(10, 24, -62, -6, -16, 0xffa21f, { ...G, r: [PI, 0, 0] }), co(10, 24, -62, -6, 16, 0xffa21f, { ...G, r: [PI, 0, 0] })], { t: 'pulse', amp: 0.18, v: 14 })],
        }),
        P('cape', 'Плащ', 'Cape', 'uncommon', C(2500), {
            tank: 0xe33b3b, parts: [grp('UpperTorso', [-30, 28, 0], [bx(3, 60, 76, -26, -28, 0, 0xd2263a, { r: [0, 0, 0.1] }), bx(3, 4, 78, -25, 1, 0, 0xffd23a)], { t: 'sway', ax: 'z', amp: 0.1, v: 3 })],
        }),
        P('bat', 'Крылья летучей мыши', 'Bat Wings', 'rare', C(5000), {
            tank: 0x3a2a4a, parts: pair('UpperTorso', [-56, 20, 8], [sp(1, -1, 20, 36, 0x4a3a66, { sc: [1.5, 46, 66], r: [-0.45, 0, 0] }), bx(2.5, 3, 74, -1, 30, 38, 0x2a1f36, { r: [-0.45, 0, 0] }), co(7, 18, -1, 66, 68, 0x2a1f36, { r: [-1.3, 0, 0] })], { t: 'sway', ax: 'x', amp: 0.4, v: 5 }),
        }),
        P('angel', 'Крылья ангела', 'Angel Wings', 'epic', C(10000), {
            tank: 0xf4f8ff, parts: pair('UpperTorso', [-56, 20, 8], [...wing(0xffffff, 0xe8f0ff)], { t: 'sway', ax: 'x', amp: 0.3, v: 3 }),
            fx: { tex: 'spark', color: '#fff2c8', color2: '#ffffff', rate: 12, life: [0.9, 1.6], size: [3, 6], speed: [2, 8], gravity: [0, -10, 0], box: [[-6, 0, -50], [6, 70, 50]], at: 'back' },
        }),
        P('comet', 'Хвост кометы', 'Comet Tail', 'legendary', C(25000), {
            tank: 0x2a5bd6, parts: [grp('UpperTorso', [-56, 8, 0], [co(36, 110, -56, 0, 0, 0x7fc8ff, { ...G, r: [0, 0, H] }), co(20, 70, -38, 0, 0, 0xffffff, { ...G, r: [0, 0, H] }), sp(14, 0, 0, 0, 0xffffff, G)], { t: 'pulse', amp: 0.07, v: 6 })],
            fx: { tex: 'dot', color: '#9fe8ff', color2: '#ffffff', rate: 50, life: [0.6, 1.3], size: [5, 11], speed: [4, 14], gravity: [0, 0, 0], box: [[-6, -16, -16], [6, 16, 16]], at: 'back', dirBack: 40 },
        }),
        P('orange', 'Оранжевый бак', 'Orange Tank', 'common', A(1), {
            tank: 0xff8a2a, parts: [grp('UpperTorso', [0, 0, 0], [bx(2, 78, 8, -55, 6, 0, 0xffe2b0), cy(10, 10, 4, -56, 30, 0, 0x6b7384, { r: [0, 0, H] })])],
        }),
        P('green', 'Зелёный бак', 'Green Tank', 'common', A(1), {
            tank: 0x5ad26a, parts: [grp('UpperTorso', [0, 0, 0], [cy(12, 12, 6, -58, 36, -18, 0x2f8a3f, { r: [0, 0, H] }), cy(3, 3, 14, -58, 36, -18, 0xcfd6e6, { r: [0, 0, H] }), bx(2, 70, 8, -55, 6, 14, 0xd8ffd8)])],
        }),
        P('lamp', 'Фонарь', 'Lantern', 'common', A(1), {
            tank: 0xffd23a, parts: [grp('UpperTorso', [-56, 20, 0], [cy(16, 20, 16, 0, 0, 0, 0xfff2a8, G), cy(22, 22, 3, 0, 9, 0, 0x6b7384), cy(22, 22, 3, 0, -9, 0, 0x6b7384), cy(3, 3, 10, 0, 16, 0, 0x6b7384)], { t: 'sway', ax: 'x', amp: 0.08, v: 3 })],
        }),
        P('butterfly', 'Крылья бабочки', 'Butterfly Wings', 'uncommon', A(2), {
            tank: 0xff9ae6, parts: pair('UpperTorso', [-56, 22, 8], [sp(1, -2, 26, 28, 0xff6fd0, { sc: [2, 56, 58], r: [-0.55, 0, 0] }), sp(1, -3, -8, 26, 0xffb84d, { sc: [2, 38, 42], r: [-0.12, 0, 0] }), sp(1, -4, 30, 36, 0xfff2a8, { sc: [2, 16, 18], r: [-0.55, 0, 0] })], { t: 'sway', ax: 'x', amp: 0.4, v: 4 }),
        }),
        P('foxtail', 'Лисий хвост', 'Fox Tail', 'uncommon', A(2), {
            tank: 0xe8863a, parts: [grp('UpperTorso', [-56, -14, 0], [sp(14, -4, 4, 0, 0xe8863a, { sc: [1.5, 1, 1] }), sp(20, -22, 10, 0, 0xf2994a, { sc: [1.7, 1, 1], r: [0, 0, 0.5] }), sp(14, -40, 22, 0, 0xffffff, { sc: [1.3, 1, 1], r: [0, 0, 0.8] })], { t: 'sway', ax: 'x', amp: 0.3, v: 3.2 })],
        }),
        P('gears', 'Шестерёнки', 'Gears', 'uncommon', A(2), {
            tank: 0x9aa3b2, parts: [grp('UpperTorso', [-58, 16, -10], [cy(30, 30, 5, 0, 0, 0, 0xd4af37, { r: [0, 0, H] }), ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => bx(4, 8, 8, 0, Math.cos(i * 0.7854) * 17, Math.sin(i * 0.7854) * 17, 0xd4af37, { r: [i * 0.7854, 0, 0] }))], { t: 'spin', ax: 'x', v: 1.5 }),
                grp('UpperTorso', [-58, -8, 16], [cy(20, 20, 5, 0, 0, 0, 0xb8c4d8, { r: [0, 0, H] }), ...[0, 1, 2, 3, 4, 5].map((i) => bx(4, 6, 6, 0, Math.cos(i * 1.047) * 11.5, Math.sin(i * 1.047) * 11.5, 0xb8c4d8, { r: [i * 1.047, 0, 0] }))], { t: 'spin', ax: 'x', v: -2.2 })],
        }),
        P('plates', 'Пластины-плащ', 'Plate Cloak', 'uncommon', A(2), {
            tank: 0x5b6a86, parts: [grp('UpperTorso', [-56, 34, 0], [bx(3, 26, 64, 0, 0, 0, 0x7d8dac, { r: [0, 0, 0.05] }), bx(3, 26, 56, -3, -24, 0, 0x6a7a98, { r: [0, 0, 0.1] }), bx(3, 22, 46, -7, -46, 0, 0x5b6a86, { r: [0, 0, 0.16] })], { t: 'sway', ax: 'z', amp: 0.05, v: 2.6 })],
        }),
        P('dragon', 'Крылья дракона', 'Dragon Wings', 'rare', A(3), {
            tank: 0x2a7a42, parts: pair('UpperTorso', [-56, 20, 8], [sp(1, -1, 24, 38, 0x3fa65a, { sc: [1.5, 52, 72], r: [-0.5, 0, 0] }), bx(2.5, 3, 80, -1, 34, 40, 0x2a5a34, { r: [-0.5, 0, 0] }), co(7, 22, -1, 68, 74, 0xf2e6a8, { r: [-1.3, 0, 0] }), co(6, 16, -1, 36, 78, 0xf2e6a8, { r: [-1.7, 0, 0] })], { t: 'sway', ax: 'x', amp: 0.4, v: 3.4 }),
        }),
        P('jet', 'Реактивный ранец', 'Jet Pack', 'rare', A(3), {
            tank: 0x39414f, parts: [grp('UpperTorso', [0, 0, 0], [cy(18, 24, 36, -62, -4, -20, 0xe8edf5), cy(18, 24, 36, -62, -4, 20, 0xe8edf5), cy(18, 18, 8, -62, -26, -20, 0x6b7384), cy(18, 18, 8, -62, -26, 20, 0x6b7384), cy(14, 20, 6, -62, 16, -20, 0xe33b3b), cy(14, 20, 6, -62, 16, 20, 0xe33b3b)]),
                grp('UpperTorso', [0, -30, 0], [co(14, 30, -62, -14, -20, 0x62e8ff, { ...G, r: [PI, 0, 0] }), co(14, 30, -62, -14, 20, 0x62e8ff, { ...G, r: [PI, 0, 0] })], { t: 'pulse', amp: 0.2, v: 16 })],
        }),
        P('prop', 'Пропеллер', 'Back Propeller', 'rare', A(3), {
            tank: 0xffd23a, parts: [grp('UpperTorso', [0, 0, 0], [cy(5, 5, 14, -58, 40, 0, 0x6b7384, { r: [0, 0, H] })]), grp('UpperTorso', [-66, 40, 0], [bx(2, 6, 56, 0, 0, 0, 0xff4d5a), bx(2, 56, 6, 0, 0, 0, 0x4dc8ff)], { t: 'spin', ax: 'x', v: 14 })],
        }),
        P('ice', 'Ледяные кристаллы', 'Ice Crystals', 'epic', A(4), {
            tank: 0x7fd0ff, parts: [grp('UpperTorso', [-56, 8, 0], [gm(20, -4, 28, 0, 0xbdf0ff, { ...G, sc: [0.7, 2.3, 0.7], r: [0, 0, 0.2] }), gm(16, -6, 10, -22, 0xd8f8ff, { ...G, sc: [0.7, 2, 0.7], r: [0.5, 0, 0.1] }), gm(16, -6, 10, 22, 0xd8f8ff, { ...G, sc: [0.7, 2, 0.7], r: [-0.5, 0, 0.1] }), gm(12, -4, -14, 0, 0xffffff, { ...G, sc: [0.7, 1.8, 0.7], r: [0, 0, -0.2] })], { t: 'bob', amp: 1.6, v: 2.2 })],
            fx: { tex: 'flake', color: '#d8f8ff', color2: '#7fd0ff', rate: 14, life: [1, 1.8], size: [4, 8], speed: [2, 8], gravity: [0, -12, 0], box: [[-6, -10, -22], [6, 40, 22]], at: 'back', spin: [-2, 2] },
        }),
        P('plasma', 'Плазма-ядро', 'Plasma Core', 'epic', A(4), {
            tank: 0x3a2a6a, parts: [grp('UpperTorso', [-58, 14, 0], [sp(22, -4, 0, 0, 0xc77bff, G)], { t: 'pulse', amp: 0.16, v: 5 }), grp('UpperTorso', [-58, 14, 0], [to(40, 2.6, -4, 0, 0, 0x7fe8ff, { ...G, r: [0, 0, H] })], { t: 'spin', ax: 'x', v: 4 }), grp('UpperTorso', [-58, 14, 0], [to(34, 2.2, -4, 0, 0, 0xff9ae6, { ...G, r: [0.6, 0, 0] })], { t: 'spin', ax: 'y', v: -3 })],
        }),
        P('phoenix', 'Крылья феникса', 'Phoenix Wings', 'legendary', A(5), {
            tank: 0xe8431a, parts: pair('UpperTorso', [-52, 24, 10], [...wing(0xff7a1a, 0xffc83a, G), co(8, 24, -4, 36, 8, 0xff4d1a, { ...G, r: [-0.4, 0, 0] })], { t: 'sway', ax: 'x', amp: 0.4, v: 4 }),
            fx: { tex: 'flame', color: '#ff7a1a', color2: '#ffd23a', rate: 36, life: [0.5, 1], size: [6, 12], speed: [6, 22], gravity: [0, 40, 0], box: [[-6, 0, -50], [6, 40, 50]], at: 'back' },
        }),
        P('galaxy', 'Галактический плащ', 'Galaxy Cloak', 'legendary', A(5), {
            tank: 0x2a1f6a, parts: [grp('UpperTorso', [-56, 36, 0], [bx(3, 30, 70, 0, 0, 0, 0x2a1f6a, { r: [0, 0, 0.04] }), bx(3, 30, 62, -3, -28, 0, 0x3a2a8a, { r: [0, 0, 0.1] }), bx(3, 26, 52, -7, -52, 0, 0x4a2a9a, { r: [0, 0, 0.16] }), sp(5, -2.5, 8, -16, 0xffffff, G), sp(4, -3, -20, 14, 0xffe27a, G), sp(6, -6, -44, -8, 0x8ad8ff, G), sp(4, -3, 4, 24, 0xff9ae6, G)], { t: 'sway', ax: 'z', amp: 0.06, v: 2.4 })],
            fx: { tex: 'star', color: '#c9b8ff', color2: '#8ad8ff', rate: 18, life: [1, 1.8], size: [4, 8], speed: [3, 10], gravity: [0, 4, 0], box: [[-10, -30, -30], [4, 50, 30]], at: 'back', spin: [-2, 2] },
        }),
    );

    // =============================================================================================
    // 4. СЛЕДЫ (22) — частицы за героем при движении (слой: tex, color, color2, rate, life, size, speed, gravity, box, spin, blend, grad)
    // =============================================================================================
    const tr = (o) => ({ fx: o });
    add(
        T('none', 'Без следа', 'No Trail', 'common', undefined, { default: true }),
        T('sparks', 'Искры', 'Sparks', 'common', C(150), tr({ tex: 'spark', color: '#ffd36a', color2: '#fff3b0', rate: 40, life: [0.25, 0.6], size: [3, 6], speed: [20, 60], gravity: [0, -60, 0], box: [[-8, 0, -8], [8, 4, 8]] })),
        T('bubbles', 'Пузыри', 'Bubbles', 'common', C(400), tr({ tex: 'bubble', color: '#bfe9ff', color2: '#e8f8ff', rate: 18, life: [0.8, 1.6], size: [5, 11], speed: [6, 18], gravity: [0, 25, 0], blend: 'standard', alpha: 0.85, box: [[-10, 0, -10], [10, 6, 10]] })),
        T('stars', 'Звёздочки', 'Stars', 'uncommon', C(900), tr({ tex: 'star', color: '#ffe27a', color2: '#ffffff', rate: 22, life: [0.6, 1.2], size: [5, 10], speed: [8, 24], gravity: [0, 12, 0], spin: [-3, 3], box: [[-10, 0, -10], [10, 8, 10]] })),
        T('hearts', 'Сердечки', 'Hearts', 'uncommon', C(1800), tr({ tex: 'heart', color: '#ff6b9c', color2: '#ff9ac0', rate: 14, life: [0.9, 1.6], size: [7, 13], speed: [6, 20], gravity: [0, 30, 0], blend: 'standard', spin: [-1, 1], box: [[-10, 0, -10], [10, 8, 10]] })),
        T('snow', 'Снежинки', 'Snowflakes', 'rare', C(3500), tr({ tex: 'flake', color: '#ffffff', color2: '#bfe3ff', rate: 26, life: [1, 1.8], size: [5, 10], speed: [4, 14], gravity: [0, -12, 0], spin: [-2, 2], blend: 'standard', box: [[-16, 0, -16], [16, 14, 16]] })),
        T('fire', 'Огонь', 'Fire', 'epic', C(8000), tr({ tex: 'flame', color: '#ff7a1a', color2: '#ffd23a', rate: 60, life: [0.4, 0.9], size: [8, 16], speed: [6, 20], gravity: [0, 60, 0], box: [[-8, 0, -8], [8, 4, 8]], grad: [[0, '#ffe27a'], [0.45, '#ff7a1a'], [1, '#6a1a0a']] })),
        T('rainbow', 'Радуга', 'Rainbow', 'legendary', C(25000), {
            fx: [{ tex: 'dot', color: '#ff4d4d', color2: '#4d4dff', rate: 90, life: [0.7, 1.1], size: [8, 13], speed: [1, 5], gravity: [0, 6, 0], box: [[-6, 0, -6], [6, 4, 6]], grad: [[0, '#ff4d4d'], [0.17, '#ff9a3a'], [0.34, '#ffe23a'], [0.5, '#4dff6a'], [0.67, '#3ad4ff'], [0.84, '#6a5aff'], [1, '#c04dff']] },
                { tex: 'star', color: '#ffffff', color2: '#ffe27a', rate: 14, life: [0.6, 1.2], size: [4, 8], speed: [8, 24], gravity: [0, 10, 0], spin: [-3, 3], box: [[-12, 0, -12], [12, 10, 12]] }],
        }),
        T('leaves', 'Листья', 'Leaves', 'common', A(1), tr({ tex: 'leaf', color: '#7bd24a', color2: '#e8a63a', rate: 16, life: [1, 1.8], size: [7, 12], speed: [4, 14], gravity: [0, -20, 0], spin: [-3, 3], blend: 'standard', box: [[-14, 0, -14], [14, 14, 14]] })),
        T('pixels', 'Пиксели', 'Pixels', 'common', A(1), tr({ tex: 'square', color: '#5be07a', color2: '#5bc8ff', rate: 30, life: [0.5, 1], size: [4, 7], speed: [10, 30], gravity: [0, -10, 0], blend: 'standard', box: [[-10, 0, -10], [10, 10, 10]] })),
        T('dust', 'Лунная пыль', 'Moon Dust', 'common', A(1), tr({ tex: 'dot', color: '#d8d2c4', color2: '#ffffff', rate: 40, life: [0.5, 1.2], size: [4, 10], speed: [4, 16], gravity: [0, 8, 0], alpha: 0.5, blend: 'standard', box: [[-14, 0, -14], [14, 4, 14]] })),
        T('notes', 'Ноты', 'Music Notes', 'uncommon', A(2), tr({ tex: 'note', color: '#8be3ff', color2: '#ffb3f0', rate: 10, life: [1, 1.8], size: [9, 15], speed: [8, 24], gravity: [0, 24, 0], blend: 'standard', spin: [-1, 1], box: [[-10, 0, -10], [10, 8, 10]] })),
        T('confetti', 'Конфетти', 'Confetti', 'uncommon', A(2), {
            fx: [{ tex: 'square', color: '#ff4d6d', color2: '#4dd0ff', rate: 24, life: [0.8, 1.5], size: [4, 8], speed: [20, 50], gravity: [0, -40, 0], spin: [-8, 8], blend: 'standard', box: [[-10, 4, -10], [10, 14, 10]] },
                { tex: 'square', color: '#ffd23a', color2: '#7dff5a', rate: 20, life: [0.8, 1.5], size: [4, 8], speed: [20, 50], gravity: [0, -40, 0], spin: [-8, 8], blend: 'standard', box: [[-10, 4, -10], [10, 14, 10]] }],
        }),
        T('clouds', 'Облачка', 'Puffs', 'uncommon', A(2), tr({ tex: 'cloud', color: '#ffffff', color2: '#dfe9ff', rate: 12, life: [0.8, 1.4], size: [12, 22], speed: [2, 8], gravity: [0, 4, 0], alpha: 0.75, blend: 'standard', box: [[-8, 0, -8], [8, 2, 8]], grow: true })),
        T('petals', 'Лепестки', 'Petals', 'uncommon', A(2), tr({ tex: 'petal', color: '#ffb3d1', color2: '#ff7fb0', rate: 18, life: [1.2, 2], size: [6, 11], speed: [4, 12], gravity: [0, -10, 0], spin: [-3, 3], blend: 'standard', box: [[-16, 2, -16], [16, 18, 16]] })),
        T('bolts', 'Молнии', 'Lightning', 'rare', A(3), {
            fx: [{ tex: 'bolt', color: '#fff27a', color2: '#9fd4ff', rate: 10, life: [0.15, 0.4], size: [10, 18], speed: [0, 6], gravity: [0, 0, 0], box: [[-16, 0, -16], [16, 16, 16]] },
                { tex: 'spark', color: '#ffffff', color2: '#9fd4ff', rate: 24, life: [0.2, 0.5], size: [3, 6], speed: [30, 80], gravity: [0, -20, 0], box: [[-8, 0, -8], [8, 6, 8]] }],
        }),
        T('coins', 'Монетки', 'Coins', 'rare', A(3), tr({ tex: 'coin', color: '#ffd23a', color2: '#ffeb85', rate: 12, life: [0.8, 1.4], size: [7, 11], speed: [20, 50], gravity: [0, -90, 0], spin: [-6, 6], blend: 'standard', box: [[-8, 4, -8], [8, 12, 8]] })),
        T('ink', 'Космические чернила', 'Cosmic Ink', 'rare', A(3), tr({ tex: 'dot', color: '#7a3dff', color2: '#ff3dd6', rate: 40, life: [0.8, 1.4], size: [10, 18], speed: [2, 10], gravity: [0, 6, 0], box: [[-8, 0, -8], [8, 6, 8]], grad: [[0, '#ff3dd6'], [0.5, '#7a3dff'], [1, '#1a0a4a']] })),
        T('comets', 'Кометы', 'Comets', 'epic', A(4), {
            fx: [{ tex: 'comet', color: '#9fe3ff', color2: '#ffffff', rate: 14, life: [0.4, 0.8], size: [12, 22], speed: [60, 120], gravity: [0, -30, 0], box: [[-12, 6, -12], [12, 30, 12]], direction: [[-1, -0.2, -1], [1, 0.4, 1]] },
                { tex: 'dot', color: '#7fc8ff', color2: '#ffffff', rate: 30, life: [0.4, 0.9], size: [4, 8], speed: [4, 16], gravity: [0, 0, 0], box: [[-10, 4, -10], [10, 16, 10]] }],
        }),
        T('toxic', 'Токсик', 'Toxic', 'epic', A(4), {
            fx: [{ tex: 'bubble', color: '#8dff3a', color2: '#d4ff7a', rate: 30, life: [0.8, 1.6], size: [6, 14], speed: [4, 14], gravity: [0, 30, 0], box: [[-12, 0, -12], [12, 8, 12]] },
                { tex: 'dot', color: '#b8ff3a', color2: '#3aff8d', rate: 20, life: [0.8, 1.4], size: [4, 8], speed: [6, 18], gravity: [0, 40, 0], box: [[-12, 0, -12], [12, 8, 12]] }],
        }),
        T('galaxy', 'Млечный путь', 'Milky Way', 'legendary', A(5), {
            fx: [{ tex: 'star', color: '#c9b8ff', color2: '#8ad8ff', rate: 40, life: [0.8, 1.6], size: [4, 10], speed: [6, 24], gravity: [0, 8, 0], spin: [-3, 3], box: [[-14, 0, -14], [14, 14, 14]] },
                { tex: 'star', color: '#ffe27a', color2: '#ff9ae6', rate: 24, life: [0.8, 1.6], size: [4, 8], speed: [6, 24], gravity: [0, 8, 0], spin: [-3, 3], box: [[-14, 0, -14], [14, 14, 14]] },
                { tex: 'cloud', color: '#5a3dff', color2: '#ff3dd6', rate: 12, life: [1, 1.8], size: [20, 34], speed: [2, 8], gravity: [0, 3, 0], alpha: 0.3, box: [[-12, 0, -12], [12, 6, 12]] }],
        }),
        T('aurora', 'Северное сияние', 'Aurora', 'legendary', A(5), {
            fx: [{ tex: 'dot', color: '#3affb0', color2: '#9a5bff', rate: 80, life: [1.2, 1.8], size: [10, 16], speed: [2, 8], gravity: [0, 16, 0], box: [[-12, 0, -12], [12, 6, 12]], grad: [[0, '#3affb0'], [0.5, '#3ac8ff'], [1, '#9a5bff']] },
                { tex: 'star', color: '#ffffff', color2: '#9fffd8', rate: 16, life: [1, 1.8], size: [4, 8], speed: [4, 14], gravity: [0, 14, 0], spin: [-2, 2], box: [[-14, 0, -14], [14, 14, 14]] }],
        }),
    );

    // =============================================================================================
    // 5. СПУТНИКИ (22) — мини-компаньон из примитивов: float — высота над землёй, parts — группы
    // =============================================================================================
    const eyes2 = (x, y, z, r, c) => [sp(r, x, y, -z, 0xffffff), sp(r, x, y, z, 0xffffff), sp(r * 0.5, x + r * 0.35, y, -z, c || 0x14161c), sp(r * 0.5, x + r * 0.35, y, z, c || 0x14161c)];
    add(
        Pt('none', 'Без спутника', 'No Pet', 'common', undefined, { default: true }),
        Pt('drone', 'Мини-дрон', 'Mini Drone', 'common', C(150), {
            float: 62, parts: [grp(null, [0, 0, 0], [bx(22, 8, 22, 0, 0, 0, 0x4a5568), sp(14, 0, 4, 0, 0x7a8aa0), bx(2, 4, 8, 11, 0, 0, 0x62f2ff, G), cy(2, 2, 6, 0, 8, 0, 0x8a96ae)], { t: 'bob', amp: 3, v: 3 }),
                grp(null, [0, 11, 0], [bx(34, 1.2, 4, 0, 0, 0, 0xd8e4f2), bx(4, 1.2, 34, 0, 0, 0, 0xd8e4f2)], { t: 'spin', ax: 'y', v: 22 })],
        }),
        Pt('ufo', 'Тарелочка', 'Little UFO', 'common', C(500), {
            float: 66, parts: [grp(null, [0, 0, 0], [sp(32, 0, 0, 0, 0xaab4c8, { sc: [1, 0.3, 1] }), sp(16, 0, 5, 0, 0x8fe8ff, G), to(24, 3, 0, -2, 0, 0xffe45c, G)], { t: 'sway', ax: 'x', amp: 0.12, v: 2.2 })],
        }),
        Pt('cube', 'Кубик-робот', 'Cube Bot', 'uncommon', C(1100), {
            float: 60, parts: [grp(null, [0, 0, 0], [bx(20, 20, 20, 0, 0, 0, 0xe9eef7), bx(1, 12, 16, 10.3, 1, 0, 0x1c2433), bx(10, 3, 10, 0, -11, 0, 0x7a8aa0), cy(1.5, 1.5, 7, 0, 13, 0, 0x8a96ae), bx(1.4, 4, 3, 10.9, 2, -4, 0x62f2ff, G), bx(1.4, 4, 3, 10.9, 2, 4, 0x62f2ff, G), sp(4, 0, 17.5, 0, 0xff5a7a, G)], { t: 'bob', amp: 3, v: 3.4 })],
        }),
        Pt('dust', 'Пылинка-малыш', 'Dust Bunny', 'uncommon', C(2200), {
            float: 44, parts: [grp(null, [0, 0, 0], [sp(24, 0, 0, 0, 0xb8b2a8), ...[[8, 8, 6], [-8, 9, -5], [4, -6, 10], [-6, -5, -9], [10, -3, -8], [-10, 2, 9]].map(([x, y, z]) => sp(12, x, y, z, 0xc8c2b8)), ...eyes2(10.5, 3, 5, 7), sp(4, 10, -4, 0, 0xff9aa8)], { t: 'squash', amp: 0.1, v: 6 })],
        }),
        Pt('sat', 'Спутник', 'Satellite', 'rare', C(4500), {
            float: 70, parts: [grp(null, [0, 0, 0], [bx(14, 14, 14, 0, 0, 0, 0xd4af37), bx(16, 1.5, 22, 0, 0, 18, 0x2a4a9c), bx(16, 1.5, 22, 0, 0, -18, 0x2a4a9c), bx(2, 1.5, 6, 0, 0, 7.5, 0x8a96ae), bx(2, 1.5, 6, 0, 0, -7.5, 0x8a96ae), sp(4, 0, 9, 4, 0xff4d5a, G)], { t: 'bob', amp: 2.5, v: 2.6 }),
                grp(null, [8, 10, 0], [cy(20, 4, 6, 0, 3, 0, 0xe8edf5, { r: [0, 0, -0.5] })], { t: 'spin', ax: 'y', v: 1.5 })],
        }),
        Pt('star', 'Звезда с глазами', 'Starling', 'epic', C(10000), {
            float: 70, parts: [grp(null, [0, 0, 0], [sp(20, 0, 0, 0, 0xffd54a, { ...G, sc: [0.5, 1, 1] }), ...starShapes(11, 15, 0xffd54a, 0, G).map((s) => ({ ...s, sc: [0.55, 1, 1] }))], { t: 'sway', ax: 'x', amp: 0.2, v: 2.6 }), grp(null, [0, 0, 0], [...eyes2(7.5, 2, 4.2, 6, 0x14161c)])],
            fx: { tex: 'star', color: '#ffe27a', color2: '#ffffff', rate: 12, life: [0.8, 1.4], size: [3, 6], speed: [2, 8], gravity: [0, -4, 0], box: [[-14, -14, -14], [14, 14, 14]], spin: [-3, 3] },
        }),
        Pt('whale', 'Космокит', 'Cosmo Whale', 'legendary', C(25000), {
            float: 74, scale: 1.1, parts: [grp(null, [0, 0, 0], [sp(30, 0, 0, 0, 0x3d7bff, { sc: [1.7, 0.9, 0.8] }), sp(26, 3, -4, 0, 0xbfe3ff, { sc: [1.4, 0.5, 0.65] }), ...eyes2(18, 5, 10, 5, 0x14161c), gm(3, 4, 11, -8, 0xffe27a, G), gm(3, -6, 12, 8, 0xffe27a, G), gm(2.5, -14, 10, -6, 0xffffff, G), co(14, 18, -26, 2, 0, 0x3d7bff, { r: [0, 0, H] })], { t: 'bob', amp: 4, v: 2 }),
                grp(null, [-30, 3, 0], [sp(1, -6, 4, 0, 0x3d7bff, { sc: [8, 2.4, 24] })], { t: 'sway', ax: 'z', amp: 0.45, v: 3.2 })],
            fx: { tex: 'bubble', color: '#bfe9ff', color2: '#ffffff', rate: 8, life: [1, 1.8], size: [4, 9], speed: [4, 12], gravity: [0, 12, 0], box: [[-10, -6, -10], [10, 6, 10]], alpha: 0.8 },
        }),
        Pt('ball', 'Шарик', 'Balloon', 'common', A(1), {
            float: 78, parts: [grp(null, [0, -14, 0], [sp(22, 0, 14, 0, 0xff4d5a, { sc: [1, 1.15, 1] }), co(5, 5, 0, 0, 0, 0xcc2a3a, { r: [PI, 0, 0] }), cy(0.6, 0.6, 24, 0, -14, 0, 0xffffff), sp(5, 3, 20, -6, 0xffb3b8, { ...G })], { t: 'sway', ax: 'z', amp: 0.14, v: 2.4 })],
        }),
        Pt('chick', 'Цыплёнок', 'Chick', 'common', A(1), {
            float: 50, parts: [grp(null, [0, 0, 0], [sp(20, 0, 0, 0, 0xffd84a), sp(13, 7, 10, 0, 0xffd84a), co(4, 6, 14.5, 9, 0, 0xff8a1f, { r: [0, 0, -H] }), sp(2.6, 12, 12, -4, 0x14161c), sp(2.6, 12, 12, 4, 0x14161c), sp(1, 0, 0, -10, 0xffc22a, { sc: [10, 7, 3] }), sp(1, 0, 0, 10, 0xffc22a, { sc: [10, 7, 3] }), co(3, 6, 6, 18, 0, 0xff8a1f)], { t: 'bob', amp: 3.5, v: 5 })],
        }),
        Pt('slime', 'Слизняшка', 'Slimey', 'common', A(1), {
            float: 34, parts: [grp(null, [0, -10, 0], [sp(22, 0, 10, 0, 0x6be46a, { sc: [1, 0.8, 1] }), sp(7, 3, 14, 5, 0xc8ffc8, G), ...eyes2(9, 12, 4, 6, 0x14161c)], { t: 'squash', amp: 0.16, v: 4.4 })],
        }),
        Pt('moocat', 'Лунный котик', 'Moon Kitty', 'uncommon', A(2), {
            float: 54, parts: [grp(null, [0, 0, 0], [sp(18, 0, 0, 0, 0xcfd8ea, { sc: [1.3, 1, 1] }), sp(14, 10, 6, 0, 0xcfd8ea), co(6, 8, 10, 14, -5, 0xcfd8ea), co(6, 8, 10, 14, 5, 0xcfd8ea), sp(2.6, 15, 7, -3.6, 0x14161c), sp(2.6, 15, 7, 3.6, 0x14161c), sp(3, 16.5, 4, 0, 0xff8aa8), sp(5, 15, 11.5, 0, 0xffe27a, G), sp(5, 14.2, 11.5, 0, 0xcfd8ea), co(4, 14, -11, 3, 0, 0xcfd8ea, { r: [0, 0, 1.2] })], { t: 'bob', amp: 3, v: 3.6 })],
        }),
        Pt('jelly', 'Медуза', 'Jelly', 'uncommon', A(2), {
            float: 70, parts: [grp(null, [0, 0, 0], [sp(24, 0, 6, 0, 0xff9ae6, { ...G, sc: [1, 0.7, 1] }), sp(4, 8, 8, -5, 0x14161c), sp(4, 8, 8, 5, 0x14161c)], { t: 'squash', amp: 0.12, v: 3.4 }),
                grp(null, [0, 0, 0], [cy(1.8, 0.8, 18, 6, -10, 0, 0xffc4f2, G), cy(1.8, 0.8, 22, -6, -12, 6, 0xffc4f2, G), cy(1.8, 0.8, 20, -2, -11, -7, 0xffc4f2, G), cy(1.8, 0.8, 16, 2, -9, 8, 0xffc4f2, G)], { t: 'sway', ax: 'z', amp: 0.2, v: 3.4 })],
        }),
        Pt('owl', 'Сова', 'Owl', 'uncommon', A(2), {
            float: 56, parts: [grp(null, [0, 0, 0], [sp(20, 0, 0, 0, 0x9a7352, { sc: [0.9, 1.2, 0.9] }), sp(14, 7, 5, 0, 0xe8d8b8, { sc: [0.4, 1, 1.2] }), sp(7, 10, 6, -5, 0xffe27a), sp(7, 10, 6, 5, 0xffe27a), sp(3.4, 13, 6, -5, 0x14161c), sp(3.4, 13, 6, 5, 0x14161c), co(3.6, 5, 13.4, 3, 0, 0xff9a2a, { r: [0, 0, -H] }), co(4, 7, 0, 13, -6, 0x7a5a3c), co(4, 7, 0, 13, 6, 0x7a5a3c)], { t: 'bob', amp: 3, v: 3 }),
                ...pair(null, [0, 2, 9], [sp(1, 0, -2, 4, 0x7a5a3c, { sc: [10, 14, 3] })], { t: 'sway', ax: 'x', amp: 0.5, v: 8 })],
        }),
        Pt('rocket', 'Мини-ракета', 'Mini Rocket', 'uncommon', A(2), {
            float: 58, parts: [grp(null, [0, 0, 0], [cy(10, 14, 26, 0, 0, 0, 0xf2f4fa, { r: [0, 0, -H] }), co(14, 12, 18, 0, 0, 0xe33b3b, { r: [0, 0, -H] }), bx(8, 2, 22, -10, 0, 0, 0xe33b3b), bx(8, 20, 2, -10, 0, 0, 0xe33b3b), sp(6, 6, 3, 0, 0x7fd8ff, G)], { t: 'bob', amp: 2.4, v: 3.6 }),
                grp(null, [-14, 0, 0], [co(8, 14, -7, 0, 0, 0xffa21f, { ...G, r: [0, 0, H] })], { t: 'pulse', amp: 0.2, v: 16 })],
            fx: { tex: 'flame', color: '#ffa21f', color2: '#ffd23a', rate: 18, life: [0.3, 0.6], size: [4, 8], speed: [10, 30], gravity: [0, 0, 0], box: [[-2, -2, -2], [2, 2, 2]], at: [-18, 0, 0] },
        }),
        Pt('ghost', 'Привидение', 'Ghost', 'rare', A(3), {
            float: 62, parts: [grp(null, [0, 0, 0], [sp(24, 0, 2, 0, 0xf4f7ff, { ...G, sc: [1, 1.15, 1] }), cy(24, 28, 10, 0, -10, 0, 0xf4f7ff, G), sp(4, 10, 6, -5, 0x2a2f44), sp(4, 10, 6, 5, 0x2a2f44), sp(4, 10, -2, 0, 0x2a2f44), sp(5, 8, 0, -12, 0xdfe8ff, G)], { t: 'bob', amp: 4, v: 2.2 })],
        }),
        Pt('robodog', 'Робо-пёс', 'Robo Pup', 'rare', A(3), {
            float: 40, parts: [grp(null, [0, 0, 0], [bx(26, 12, 14, 0, 0, 0, 0xcdd5e2), bx(14, 12, 14, 18, 6, 0, 0xe6ebf5), bx(8, 6, 10, 26, 3, 0, 0x9aa5b8), bx(4, 8, 3, 16, 14, -5, 0x4a5568), bx(4, 8, 3, 16, 14, 5, 0x4a5568), bx(5, 8, 5, 9, -9, -5, 0x7a8aa0), bx(5, 8, 5, 9, -9, 5, 0x7a8aa0), bx(5, 8, 5, -9, -9, -5, 0x7a8aa0), bx(5, 8, 5, -9, -9, 5, 0x7a8aa0), bx(1.4, 3, 3, 25.5, 8, -4, 0x62f2ff, G), bx(1.4, 3, 3, 25.5, 8, 4, 0x62f2ff, G), bx(14, 1, 8, 0, -14, 0, 0x62f2ff, G)], { t: 'bob', amp: 2.4, v: 4 }),
                grp(null, [-14, 5, 0], [bx(12, 3, 3, -5, 4, 0, 0x4a5568)], { t: 'sway', ax: 'y', amp: 0.6, v: 9 })],
        }),
        Pt('crab', 'Лунный краб', 'Moon Crab', 'rare', A(3), {
            float: 36, parts: [grp(null, [0, 0, 0], [sp(24, 0, 0, 0, 0xe8774a, { sc: [1, 0.55, 1.3] }), sp(10, 14, 1, -16, 0xe8774a), sp(10, 14, 1, 16, 0xe8774a), co(5, 8, 20, 1, -17, 0xc2562a, { r: [0, 0, -H] }), co(5, 8, 20, 1, 17, 0xc2562a, { r: [0, 0, -H] }), cy(1.6, 1.6, 7, 8, 8, -5, 0xe8774a), cy(1.6, 1.6, 7, 8, 8, 5, 0xe8774a), sp(4.6, 8, 12, -5, 0xffffff), sp(4.6, 8, 12, 5, 0xffffff), sp(2.4, 10, 12, -5, 0x14161c), sp(2.4, 10, 12, 5, 0x14161c), ...[-6, 0, 6].flatMap((x) => [cy(1.4, 1.4, 12, x, -4, -17, 0xc2562a, { r: [0.5, 0, 1.1] }), cy(1.4, 1.4, 12, x, -4, 17, 0xc2562a, { r: [-0.5, 0, 1.1] })])], { t: 'sway', ax: 'x', amp: 0.08, v: 7 })],
        }),
        Pt('phoenix', 'Птенец феникса', 'Phoenix Chick', 'epic', A(4), {
            float: 62, parts: [grp(null, [0, 0, 0], [sp(16, 0, 0, 0, 0xff7a1a), sp(11, 7, 9, 0, 0xff9a2a), co(4, 6, 13, 9, 0, 0xffd23a, { r: [0, 0, -H] }), sp(2.4, 11, 11, -3.6, 0x14161c), sp(2.4, 11, 11, 3.6, 0x14161c), co(5, 12, -12, 2, 0, 0xffd23a, { r: [0, 0, H] }), co(4, 10, -10, 6, 0, 0xff4d1a, { r: [0, 0, 1.2] }), co(5, 8, 4, 16, 0, 0xffd23a)], { t: 'bob', amp: 3.5, v: 4 }),
                ...pair(null, [0, 3, 7], [sp(1, 0, 3, 7, 0xff9a2a, { ...G, sc: [8, 4, 16], r: [-0.3, 0, 0] })], { t: 'sway', ax: 'x', amp: 0.7, v: 11 })],
            fx: { tex: 'flame', color: '#ff7a1a', color2: '#ffd23a', rate: 18, life: [0.4, 0.8], size: [4, 8], speed: [4, 14], gravity: [0, 30, 0], box: [[-8, -4, -8], [8, 6, 8]] },
        }),
        Pt('dragon', 'Дракончик', 'Baby Dragon', 'epic', A(4), {
            float: 58, parts: [grp(null, [0, 0, 0], [sp(18, 0, 0, 0, 0x3fbf6a, { sc: [1.5, 1, 1] }), sp(11, 4, -3, 0, 0xf2e6a8, { sc: [1.3, 0.6, 0.8] }), sp(13, 13, 5, 0, 0x4fd27a), sp(8, 19, 3, 0, 0x4fd27a), co(4, 8, 12, 11, -4, 0xf2e6a8, { r: [0.3, 0, 0.1] }), co(4, 8, 12, 11, 4, 0xf2e6a8, { r: [-0.3, 0, 0.1] }), sp(3, 15, 8, -4.4, 0xffd23a), sp(3, 15, 8, 4.4, 0xffd23a), ...[6, 0, -6].map((x) => co(5, 7, x, 9, 0, 0xf2e6a8)), cy(7, 9, 14, -14, 1, 0, 0x3fbf6a, { r: [0, 0, 1.3] }), co(7, 12, -24, 4, 0, 0xf2e6a8, { r: [0, 0, H] })], { t: 'bob', amp: 3, v: 3.2 }),
                ...pair(null, [-2, 6, 6], [sp(1, 0, 8, 10, 0x8a5ae0, { sc: [2, 18, 22], r: [-0.4, 0, 0] })], { t: 'sway', ax: 'x', amp: 0.5, v: 7 })],
        }),
        Pt('comet', 'Живая комета', 'Living Comet', 'legendary', A(5), {
            float: 74, parts: [grp(null, [0, 0, 0], [sp(16, 0, 0, 0, 0xbfe8ff, G), co(16, 40, -24, 0, 0, 0x7fc8ff, { ...G, r: [0, 0, H] }), sp(3, 7.5, 2, -4, 0x112244), sp(3, 7.5, 2, 4, 0x112244)], { t: 'bob', amp: 3, v: 2.6 }),
                grp(null, [0, 0, 0], [to(28, 2, 0, 0, 0, 0xffffff, { ...G, r: [0.8, 0, 0.4] })], { t: 'spin', ax: 'y', v: 3 })],
            fx: { tex: 'dot', color: '#9fe8ff', color2: '#ffffff', rate: 40, life: [0.6, 1.2], size: [4, 9], speed: [2, 10], gravity: [0, 0, 0], box: [[-4, -4, -4], [4, 4, 4]], at: [-18, 0, 0] },
        }),
        Pt('planet', 'Мини-планета', 'Tiny Planet', 'legendary', A(5), {
            float: 78, parts: [grp(null, [0, 0, 0], [sp(22, 0, 0, 0, 0x4a8cff), sp(9, 4, 6, 6, 0x6fd27a, { sc: [1, 1, 1] }), sp(7, 4, -6, -6, 0x6fd27a), ...eyes2(10, 2, 4.4, 6, 0x14161c)], { t: 'sway', ax: 'y', amp: 0.4, v: 1.4 }),
                grp(null, [0, 0, 0], [to(40, 2.6, 0, 0, 0, 0xffe7a8, { ...G, r: [0.5, 0, 0.25] })], { t: 'bob', amp: 1.5, v: 2 }),
                grp(null, [0, 0, 0], [sp(5, 22, 0, 0, 0xe8e8f0), sp(3.4, -22, 3, 0, 0xffd23a)], { t: 'spin', ax: 'y', v: 2.2 })],
            fx: { tex: 'star', color: '#ffe7a8', color2: '#9fd4ff', rate: 8, life: [1, 1.8], size: [3, 6], speed: [2, 8], gravity: [0, 0, 0], box: [[-18, -18, -18], [18, 18, 18]], spin: [-2, 2] },
        }),
    );

    // =============================================================================================
    // 6. ПОТОК (22) — цвет потока и сопла. color — 0xRRGGBB, cycle — палитра по кругу, rainbow — цикл оттенка,
    //    rim — подсветка сопла, sparks — искры у сопла, pulse — пульсация яркости
    // =============================================================================================
    const sk = (tex, color, color2, rate) => ({ tex, color, color2, rate, life: [0.3, 0.7], size: [3, 6], speed: [10, 40], gravity: [0, 0, 0], box: [[-3, -3, -3], [3, 3, 3]] });
    add(
        St('default', 'Обычный', 'Classic', 'common', undefined, { default: true, color: null, rim: 0xd8e4f2 }),
        St('blue', 'Синий', 'Blue', 'common', C(150), { color: 0x3a9bff, rim: 0x7fc4ff }),
        St('lime', 'Лайм', 'Lime', 'common', C(400), { color: 0x8cff3a, rim: 0xc8ff8a }),
        St('tang', 'Мандарин', 'Tangerine', 'uncommon', C(900), { color: 0xff9a2a, rim: 0xffc870 }),
        St('neon', 'Неон', 'Neon', 'uncommon', C(1800), { color: 0xff2bd6, rim: 0x39f5ff, sparks: sk('spark', '#ff2bd6', '#39f5ff', 22) }),
        St('ice', 'Лёд', 'Ice', 'rare', C(3500), { color: 0x9fe8ff, rim: 0xffffff, pulse: 0.1, sparks: sk('flake', '#ffffff', '#9fe8ff', 14) }),
        St('fire', 'Огонь', 'Fire', 'epic', C(8000), { cycle: [0xff4d1a, 0xff8a1a, 0xffc83a], speed: 2.4, rim: 0xffc83a, pulse: 0.15, sparks: sk('flame', '#ff7a1a', '#ffd23a', 28) }),
        St('gold', 'Золото', 'Gold', 'legendary', C(25000), { color: 0xffd23a, rim: 0xfff0a0, pulse: 0.15, sparks: sk('spark', '#ffe27a', '#fff6c8', 40) }),
        St('grape', 'Виноград', 'Grape', 'common', A(1), { color: 0xa45bff, rim: 0xd0a8ff }),
        St('cherry', 'Вишня', 'Cherry', 'common', A(1), { color: 0xe8335a, rim: 0xff8aa0 }),
        St('mint', 'Мята', 'Mint', 'common', A(1), { color: 0x5bffc2, rim: 0xb8ffe4 }),
        St('toxic', 'Токсик', 'Toxic', 'uncommon', A(2), { color: 0x9dff2a, rim: 0xe0ff8a, pulse: 0.12, sparks: sk('bubble', '#9dff2a', '#e0ff8a', 16) }),
        St('candy', 'Конфетти', 'Candy', 'uncommon', A(2), { cycle: [0xff5fa8, 0x5fd4ff, 0xffe15f, 0x8dff6a], speed: 0.7, rim: 0xffffff }),
        St('ocean', 'Океан', 'Ocean', 'uncommon', A(2), { cycle: [0x2b7fff, 0x2bffd0], speed: 0.6, rim: 0xb8f0ff }),
        St('sunset', 'Закат', 'Sunset', 'uncommon', A(2), { cycle: [0xff7a3a, 0xff4f8a, 0xb04fff], speed: 0.5, rim: 0xffd0a8 }),
        St('plasma', 'Плазма', 'Plasma', 'rare', A(3), { color: 0xb84dff, rim: 0xffffff, pulse: 0.22, sparks: sk('spark', '#ffffff', '#b84dff', 24) }),
        St('electro', 'Электро', 'Electric', 'rare', A(3), { cycle: [0xfff27a, 0xffffff, 0x9fd4ff], speed: 7, rim: 0xfff27a, sparks: sk('bolt', '#fff27a', '#9fd4ff', 10) }),
        St('void', 'Пустота', 'Void', 'rare', A(3), { color: 0x5a1fb0, rim: 0xff3dd6, pulse: 0.2, sparks: sk('dot', '#ff3dd6', '#5a1fb0', 20) }),
        St('rainbow', 'Радуга', 'Rainbow', 'epic', A(4), { rainbow: 0.45, rim: 0xffffff, sparks: sk('star', '#ffffff', '#ffe27a', 16) }),
        St('aurora', 'Аврора', 'Aurora', 'epic', A(4), { cycle: [0x3affb0, 0x3ac8ff, 0x9a5bff], speed: 0.55, rim: 0xcfffe8, sparks: sk('dot', '#3affb0', '#9a5bff', 20) }),
        St('galaxy', 'Галактика', 'Galaxy', 'legendary', A(5), { cycle: [0x4a5bff, 0xb04fff, 0x3ad4ff], speed: 0.8, rim: 0xc9b8ff, pulse: 0.1, sparks: sk('star', '#c9b8ff', '#8ad8ff', 30) }),
        St('nova', 'Сверхновая', 'Supernova', 'legendary', A(5), { cycle: [0xffffff, 0xffe27a, 0xff9a3a], speed: 2.6, rim: 0xfff6c8, pulse: 0.2, sparks: sk('spark', '#fff2a8', '#ffb02a', 46) }),
    );
    return items;
})();

// Награды Daily Gift за дни 1–6 по нарастающей; день 7 — эксклюзивный скин из очереди (exclusive: 'daily' у предметов
// suit_royal → suit_keeper → suit_comet), DailyGift выбирает его сам: в этом массиве его нет.
/** @type {any[]} */
const DAILY_REWARDS = [
    { coins: 150 },
    { coins: 300, item: 'trail_sparks' },
    { coins: 500 },
    { coins: 800, randomItems: 1, maxRarity: 'uncommon' },
    { coins: 1200, item: 'pack_flag' },
    { coins: 2000, randomItems: 1, maxRarity: 'rare' },
];

// Колесо фортуны: 10 секторов (8 сумм монет и 2 случайные косметики), color — цвет сектора для интерфейса.
/** @type {any[]} */
const WHEEL_SECTORS = [
    { coins: 100, weight: 22, color: '#5fd0ff' },
    { coins: 250, weight: 16, color: '#ffc247' },
    { randomItem: true, maxRarity: 'uncommon', weight: 8, color: '#c58bff' },
    { coins: 150, weight: 20, color: '#7dff5a' },
    { coins: 500, weight: 10, color: '#ff7a7a' },
    { coins: 400, weight: 12, color: '#5fd0ff' },
    { coins: 1000, weight: 5, color: '#ffc247' },
    { randomItem: true, maxRarity: 'epic', weight: 5, color: '#c58bff' },
    { coins: 750, weight: 7, color: '#7dff5a' },
    { coins: 2500, weight: 2, color: '#ff7a7a' },
];

// СВОДКА ПО ВКЛАДКАМ (проверяется Shop.validate(), 6 вкладок, 22–24 предмета, ≈35% за монеты / ≈65% за рекламу):
//   suit   24 = 1 по умолчанию + 3 эксклюзива Daily Gift + 7 за монеты (150…25 000) + 13 за рекламу (1–5 просмотров)
//   helmet 22 = 1 + 7 за монеты (150…25 000) + 14 за рекламу
//   pack   22 = 1 + 7 за монеты (150…25 000) + 14 за рекламу
//   trail  22 = 1 + 7 за монеты (150…25 000) + 14 за рекламу
//   pet    22 = 1 + 7 за монеты (150…25 000) + 14 за рекламу
//   stream 22 = 1 + 7 за монеты (150…25 000) + 14 за рекламу
//   Просмотров рекламы: common 1, uncommon 2, rare 3, epic 4, legendary 5.
