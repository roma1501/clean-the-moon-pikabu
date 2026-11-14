// GameDirt.js — слой грязи на лунной поверхности. Грязь задают маркеры покраски карты (paint-dirt, paint-grass2,
// paint-dark, paint-lava — см. GameData.js); здесь покраска движка превращается в «живую» карту: у каждого текселя
// есть количество грязи 0..1 и её вид. Пылесос стирает грязь (clean), метеориты и мобы добавляют (spill).
// Картинка — та же карта красок Terrain3D (плагин LoryPaint): модуль подменяет её своей текстурой и обновляет.
// Логика чистая: решения (сколько собрано, сколько осталось) считаются по массивам, а не по картинке.
//
//   GameDirt.build(location)                       // в prepare после загрузки карты
//   const r = GameDirt.clean(x, y, radius, k, maxUnits, hardScale)   // -> { units, area, type, coins-вес }
//   GameDirt.spill(x, y, radius, typeIndex, amount) // добавить грязь
//   GameDirt.progress                              // 0..1 — доля очищенного
//   GameDirt.sample(x, y)                          // { amount, type } под точкой
//   GameDirt.nearest(x, y)                         // { x, y, amount } ближайшее заметное пятно | null
//   GameDirt.flush()                               // раз в кадр: отправить изменения в текстуру

/** @satisfies {Record<string, any>} */
const GameDirt = {
    ready: false,
    w: 0, h: 0,                  // размер карты, px
    tw: 0, th: 0,                // размер сетки, текселей
    sx: 1, sy: 1,                // px на тексель
    /** @type {Float32Array | null} */ amount: null,   // 0..1
    /** @type {Uint8Array | null} */ kind: null,       // индекс GameData.DIRT
    /** @type {Uint8Array | null} */ base: null,       // цвет грязи текселя (RGB, не умноженный на альфу)
    /** @type {Uint8Array | null} */ data: null,       // RGBA premultiplied — в текстуру
    /** @type {any} */ texture: null,
    /** @type {any} */ terrain: null,
    total0: 1,                   // сумма грязи на старте
    total: 0,                    // сумма грязи сейчас
    progress: 0,
    dirty: false,
    /** @type {Float32Array | null} */ blocks: null,   // сумма грязи по крупным клеткам (поиск остатков)
    bw: 0, bh: 0, BS: 6,
    _res: { units: 0, area: 0, type: 0, worth: 0, cx: 0, cy: 0 },
    _smp: { amount: 0, type: 0 },

    /** Собрать слой по зонам покраски текущей карты. */
    build(location) {
        this.dispose();
        const terrain = location.terrain;
        this.terrain = terrain;
        this.w = location.width; this.h = location.height;
        const texel = IS_MOBILE ? 22 : 13;
        const cap = IS_MOBILE ? 256 : 448;
        this.tw = Math.max(16, Math.min(cap, Math.ceil(this.w / texel)));
        this.th = Math.max(16, Math.min(cap, Math.ceil(this.h / texel)));
        this.sx = this.w / this.tw; this.sy = this.h / this.th;
        const n = this.tw * this.th;
        this.amount = new Float32Array(n);
        this.kind = new Uint8Array(n);
        this.base = new Uint8Array(n * 3);
        const zones = terrain.paints || [];
        const raw = Terrain3D.paintRaster(zones, this.w, this.h, this.tw, this.th, terrain.noiseSeed | 0);
        this.data = raw;
        // вид грязи текселя — верхняя зона, которая его накрывает
        for (let zi = 0; zi < zones.length; zi++) {
            const z = zones[zi], k = GameData.dirtByPaint(z.type);
            if (k < 0) continue;
            const i0 = Math.max(0, Math.floor((z.x - z.reach) / this.sx)), i1 = Math.min(this.tw - 1, Math.ceil((z.x + z.reach) / this.sx));
            const j0 = Math.max(0, Math.floor((z.y - z.reach) / this.sy)), j1 = Math.min(this.th - 1, Math.ceil((z.y + z.reach) / this.sy));
            for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
                if (Terrain3D.paintCover(z, (i + 0.5) * this.sx, (j + 0.5) * this.sy, 0.5) > 0.3) this.kind[j * this.tw + i] = k;
            }
        }
        let sum = 0;
        for (let t = 0; t < n; t++) {
            const o = t * 4, a = raw[o + 3] / 255;
            const am = a < 0.08 ? 0 : a;
            this.amount[t] = am;
            if (am > 0) {
                this.base[t * 3] = Math.min(255, raw[o] / a); this.base[t * 3 + 1] = Math.min(255, raw[o + 1] / a); this.base[t * 3 + 2] = Math.min(255, raw[o + 2] / a);
            } else { raw[o] = raw[o + 1] = raw[o + 2] = raw[o + 3] = 0; }
            sum += am;
        }
        // чистые круги (маркеры clean): стартовая площадка и станции без грязи
        for (const m of location.markers('clean')) {
            const r = Math.max(40, (m.scale ? m.scale[0] : 1) * 100);
            sum -= this._erase(m.x, m.y, r);
        }
        this.total0 = Math.max(1e-6, sum);
        this.total = sum;
        this.progress = 0;
        this.bw = Math.ceil(this.tw / this.BS); this.bh = Math.ceil(this.th / this.BS);
        this.blocks = new Float32Array(this.bw * this.bh);
        for (let j = 0; j < this.th; j++) for (let i = 0; i < this.tw; i++) {
            this.blocks[((j / this.BS) | 0) * this.bw + ((i / this.BS) | 0)] += this.amount[j * this.tw + i];
        }
        this._texture(terrain, location.view.scene);
        this.ready = true;
        this.dirty = true;
        this.flush();
    },

    /** Своя текстура вместо карты красок движка (та строится один раз и не обновляется). */
    _texture(terrain, scene) {
        if (typeof BABYLON === 'undefined' || !BABYLON.RawTexture) return;
        const plugins = terrain._paintPlugins || [];
        if (!plugins.length) {
            // на карте нет ни одной зоны покраски: плагинов нет — заводим их так же, как Terrain3D._buildPaint
            const Plugin = Terrain3D.paintPlugin();
            if (!Plugin) return;
            for (const m of [terrain.material, terrain.outerMaterial]) {
                plugins.push(new Plugin(m));
                m.diffuseColor = new BABYLON.Color3(1, 1, 1);
            }
            terrain._paintPlugins = plugins;
        }
        if (terrain.paintTexture) { try { terrain.paintTexture.dispose(); } catch (e) { /* уже */ } }
        const tex = BABYLON.RawTexture.CreateRGBATexture(this.data, this.tw, this.th, scene, false, false, BABYLON.Texture.BILINEAR_SAMPLINGMODE);
        tex.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
        tex.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
        terrain.paintTexture = tex;      // Terrain3D освободит её вместе с собой
        this.texture = tex;
        const detail = typeof TERRAIN_PAINT_DETAIL !== 'undefined' ? TERRAIN_PAINT_DETAIL : 0.5;
        for (const p of plugins) p.setPaint(tex, this.w, this.h, terrain.tileLum, detail);
    },

    dispose() {
        this.ready = false;
        this.texture = null; this.terrain = null;
        this.amount = null; this.kind = null; this.base = null; this.data = null; this.blocks = null;
    },

    /** Раз в кадр: изменённые данные — в видеопамять. */
    flush() {
        if (!this.dirty || !this.texture || !this.data) return;
        this.dirty = false;
        try { this.texture.update(this.data); } catch (e) { /* текстура ушла вместе с картой */ }
    },

    _write(t) {
        const a = this.amount[t], o = t * 4, d = this.data, b = this.base;
        // видимая плотность: тонкий остаток заметен слабее, плотная грязь закрывает землю почти целиком
        const va = a <= 0 ? 0 : Math.min(1, 0.18 + a * 0.8);
        d[o] = b[t * 3] * va; d[o + 1] = b[t * 3 + 1] * va; d[o + 2] = b[t * 3 + 2] * va; d[o + 3] = va * 255;
    },

    /** Стереть круг целиком (без сбора): возвращает убранную сумму. */
    _erase(x, y, r) {
        let removed = 0;
        const i0 = Math.max(0, Math.floor((x - r) / this.sx)), i1 = Math.min(this.tw - 1, Math.ceil((x + r) / this.sx));
        const j0 = Math.max(0, Math.floor((y - r) / this.sy)), j1 = Math.min(this.th - 1, Math.ceil((y + r) / this.sy));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
            const dx = (i + 0.5) * this.sx - x, dy = (j + 0.5) * this.sy - y;
            const d = Math.hypot(dx, dy);
            if (d > r) continue;
            const t = j * this.tw + i, a = this.amount[t];
            if (a <= 0) continue;
            const keep = d > r * 0.75 ? a * (d - r * 0.75) / (r * 0.25) : 0;
            removed += a - keep;
            this.amount[t] = keep < 0.08 ? 0 : keep;
            if (this.amount[t] === 0) removed += keep;
            if (this.blocks) this.blocks[((j / this.BS) | 0) * this.bw + ((i / this.BS) | 0)] -= a - this.amount[t];
            this._write(t);
        }
        return removed;
    },

    /**
     * Пылесос: круг радиуса r в точке (x, y). k — сколько слоя снять в центре за этот кадр на грязи твёрдости 1
     * (мощность × dt × CLEAN_RATE); maxUnits — места в баке (Infinity — не ограничивать); force — снять всё независимо
     * от твёрдости (волна блеска). Возвращает общий объект: units — единиц в бак, worth — монетный вес
     * (units × ценность вида), area — доля круга, где была грязь, type — преобладающий вид, cx/cy — центр собранного.
     */
    clean(x, y, r, k, maxUnits, force) {
        const res = this._res;
        res.units = 0; res.area = 0; res.type = 0; res.worth = 0; res.cx = x; res.cy = y;
        if (!this.ready || r <= 0 || k <= 0) return res;
        const D = GameData.DIRT, cellArea = this.sx * this.sy, unit = GameData.UNIT_AREA;
        let room = maxUnits == null ? Infinity : maxUnits;
        if (room <= 0) return res;
        const i0 = Math.max(0, Math.floor((x - r) / this.sx)), i1 = Math.min(this.tw - 1, Math.ceil((x + r) / this.sx));
        const j0 = Math.max(0, Math.floor((y - r) / this.sy)), j1 = Math.min(this.th - 1, Math.ceil((y + r) / this.sy));
        let cells = 0, hit = 0, wx = 0, wy = 0, wsum = 0, removedSum = 0;
        const byType = this._byType || (this._byType = new Float32Array(8));
        byType.fill(0);
        for (let j = j0; j <= j1 && room > 0; j++) for (let i = i0; i <= i1; i++) {
            const px = (i + 0.5) * this.sx, py = (j + 0.5) * this.sy;
            const d = Math.hypot(px - x, py - y);
            if (d > r) continue;
            cells++;
            const t = j * this.tw + i, a = this.amount[t];
            if (a <= 0) continue;
            hit++;
            const kd = this.kind[t], dirt = D[kd] || D[0];
            const fall = 1 - (d / r) * (d / r) * 0.55;                 // к краю слабее
            let take = force ? a : Math.min(a, k * fall / dirt.hard);
            let left = a - take;
            if (left < 0.08) { take = a; left = 0; }                   // тонкий остаток не оставляем
            let units = take * cellArea / unit;
            if (units > room) { const f = room / units; take *= f; left = a - take; units = room; }
            room -= units;
            this.amount[t] = left;
            removedSum += take;
            res.units += units;
            res.worth += units * dirt.value;
            byType[kd] += take;
            wx += px * take; wy += py * take; wsum += take;
            this.blocks[((j / this.BS) | 0) * this.bw + ((i / this.BS) | 0)] -= take;
            this._write(t);
            if (room <= 0) break;
        }
        if (removedSum > 0) {
            this.total = Math.max(0, this.total - removedSum);
            this.progress = Math.max(0, Math.min(1, 1 - this.total / this.total0));
            this.dirty = true;
            let best = 0;
            for (let q = 1; q < D.length; q++) if (byType[q] > byType[best]) best = q;
            res.type = best;
            res.cx = wx / wsum; res.cy = wy / wsum;
        }
        res.area = cells ? hit / cells : 0;
        return res;
    },

    /** Добавить грязь: круг радиуса r, вид kind (индекс DIRT), плотность amount в центре. */
    spill(x, y, r, kind, amount) {
        if (!this.ready) return;
        const dirt = GameData.DIRT[kind] || GameData.DIRT[0];
        const hex = Terrain3D.PAINT_COLORS[dirt.paint] || 0x6e5f58;
        const cr = (hex >> 16) & 255, cg = (hex >> 8) & 255, cb = hex & 255;
        const i0 = Math.max(0, Math.floor((x - r) / this.sx)), i1 = Math.min(this.tw - 1, Math.ceil((x + r) / this.sx));
        const j0 = Math.max(0, Math.floor((y - r) / this.sy)), j1 = Math.min(this.th - 1, Math.ceil((y + r) / this.sy));
        let added = 0;
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
            const px = (i + 0.5) * this.sx, py = (j + 0.5) * this.sy;
            const d = Math.hypot(px - x, py - y);
            // неровная кромка пятна
            const edge = r * (0.82 + 0.3 * Terrain3D.vnoise(px / 60, py / 60, 77));
            if (d > edge) continue;
            const t = j * this.tw + i, a = this.amount[t];
            const want = Math.min(1, amount * (1 - Math.pow(d / edge, 3) * 0.6));
            if (want <= a) continue;
            const shade = 0.9 + 0.2 * Terrain3D.hash2(i, j, 31);
            this.base[t * 3] = Math.min(255, cr * shade); this.base[t * 3 + 1] = Math.min(255, cg * shade); this.base[t * 3 + 2] = Math.min(255, cb * shade);
            this.kind[t] = kind;
            this.amount[t] = want;
            added += want - a;
            this.blocks[((j / this.BS) | 0) * this.bw + ((i / this.BS) | 0)] += want - a;
            this._write(t);
        }
        if (added > 0) {
            this.total += added;
            this.progress = Math.max(0, Math.min(1, 1 - this.total / this.total0));
            this.dirty = true;
        }
    },

    /** Грязь под точкой: общий объект { amount, type }. */
    sample(x, y) {
        const s = this._smp;
        s.amount = 0; s.type = 0;
        if (!this.ready) return s;
        const i = Math.floor(x / this.sx), j = Math.floor(y / this.sy);
        if (i < 0 || j < 0 || i >= this.tw || j >= this.th) return s;
        const t = j * this.tw + i;
        s.amount = this.amount[t]; s.type = this.kind[t];
        return s;
    },

    /** Доля чистоты в круге (спрятанные звёзды): 1 — грязи нет. */
    clearAt(x, y, r) {
        if (!this.ready) return 1;
        const i0 = Math.max(0, Math.floor((x - r) / this.sx)), i1 = Math.min(this.tw - 1, Math.ceil((x + r) / this.sx));
        const j0 = Math.max(0, Math.floor((y - r) / this.sy)), j1 = Math.min(this.th - 1, Math.ceil((y + r) / this.sy));
        let n = 0, sum = 0;
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
            if (Math.hypot((i + 0.5) * this.sx - x, (j + 0.5) * this.sy - y) > r) continue;
            n++; sum += this.amount[j * this.tw + i];
        }
        return n ? 1 - sum / n : 1;
    },

    /** Ближайшее к точке заметное пятно (по крупным клеткам): { x, y, amount } | null. */
    nearest(x, y) {
        if (!this.ready) return null;
        const bsx = this.sx * this.BS, bsy = this.sy * this.BS;
        let best = -1, bd = Infinity;
        for (let j = 0; j < this.bh; j++) for (let i = 0; i < this.bw; i++) {
            const v = this.blocks[j * this.bw + i];
            if (v < 0.35) continue;
            const d = Math.hypot((i + 0.5) * bsx - x, (j + 0.5) * bsy - y);
            if (d < bd) { bd = d; best = j * this.bw + i; }
        }
        if (best < 0) return null;
        const bi = best % this.bw, bj = (best / this.bw) | 0;
        // точка внутри клетки — самый грязный тексель
        let tx = (bi + 0.5) * bsx, ty = (bj + 0.5) * bsy, top = 0;
        for (let j = bj * this.BS; j < Math.min(this.th, (bj + 1) * this.BS); j++) for (let i = bi * this.BS; i < Math.min(this.tw, (bi + 1) * this.BS); i++) {
            const a = this.amount[j * this.tw + i];
            if (a > top) { top = a; tx = (i + 0.5) * this.sx; ty = (j + 0.5) * this.sy; }
        }
        return { x: tx, y: ty, amount: this.blocks[best] };
    },
};
