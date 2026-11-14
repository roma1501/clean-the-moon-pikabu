// GameFx.js — визуальные эффекты Clean the Moon: частицы (ParticleFX), кольца-волны по земле, столбы света.
// Контракт (его зовёт Game.js):
//   GameFx.init(app)                 один раз
//   GameFx.level(app, level)         после загрузки сектора (под экраном загрузки): заводит пулы заново
//   GameFx.event(name, data)         событие игры (clean, pickup, sell, star, blast, wave, …)
//   GameFx.update(dt, ctx)           каждый кадр вне паузы; ctx: { hero, tool, working, jet, state }
//   GameFx.frame(dt)                 каждый кадр всегда: сброс очередей частиц в системы (пауза их сама замораживает)
//
// Устройство. Частицы — «пулы»: по одной постоянной системе ParticleFX на роль (искра, блёстка, вспышка, дым,
// комок, конфетти, пламя, пылинка). Событие кладёт в очередь пула «всплеск» (точка, число, режим разлёта, цвет,
// масштаб, жизнь); система при вылете каждой частицы берёт параметры из очереди (startPositionFunction).
// Так бюджет систем постоянен (8 пулов), а любой всплеск — один вызов. Режим aim — полёт по дуге из точки в цель
// за заданное время (поток всасывания, сдача грязи, высасывание босса).
// Кольца и столбы — свои меши в слое OVERLAY, из пула; кольцо прилегает к рельефу (высота земли в каждой вершине).

/** @satisfies {Record<string, any>} */
const GameFx = {
    /** @type {LoryApp | null} */ app: null,
    /** @type {any} */ scene: null,
    ok: false,
    Q: 1,                        // множитель количества (телефон — меньше)
    /** @type {any} */ pools: {},
    /** @type {any[]} */ rings: [],      // активные кольца
    /** @type {any[]} */ ringPool: [],   // меши колец (переиспользуются)
    /** @type {any[]} */ cols: [],       // активные столбы света
    /** @type {any[]} */ colPool: [],
    /** @type {any} */ tex: {},
    /** @type {any[]} */ jobs: [],       // отложенные и растянутые во времени эффекты
    /** @type {any[]} */ waves: [],      // волны с логикой (blast, wave, slam)
    /** @type {any[]} */ comets: [],
    /** @type {any} */ accum: {},
    /** @type {any} */ cleanState: null,
    cleanT: 0,
    dt: 1 / 60,
    t: 0,
    cometT: 4,
    padT: 0,
    dark: false,
    mobile: false,
    nz: [0, 0, 0],
    N: 160,                      // сегментов в кольце

    PAL: {
        spark: [[0xffffff, 0xbff4ff], [0xfff6c0, 0xffffff]],
        gold: [0xffc83a, 0xfff0a0],
        cyan: [0x6fe8ff, 0xffffff],
        teal: [0x35ffd0, 0xa8fff0],
        red: [0xff3a4a, 0xff9a8a],
        fire: [0xffd27a, 0xff5a1f],
        goo: [0xd88cff, 0x7a2cd8],
        slime: [0x6fe84e, 0x3fb82a],
        dustLight: [0xcfc8bf, 0xe8e2d8],
        dustDark: [0x7a7580, 0x9a949c],
        fw: [[0xffd54a, 0xfff1a8], [0x6fe8ff, 0xffffff], [0xff7ad9, 0xffd0f0], [0x9dff7a, 0xf0ffd0], [0xb08cff, 0xe8d8ff]],
    },

    // ------------------------------------------------------------------------------------- жизненный цикл
    init(app) {
        this.app = app;
        this.mobile = typeof IS_MOBILE !== 'undefined' && !!IS_MOBILE;
        this.Q = this.mobile ? 0.5 : 1;
    },

    level(app, level) {
        this.app = app;
        try {
            this.scene = app.location && app.location.view ? app.location.view.scene : null;
            this.disposeMeshes();
            this.pools = {}; this.rings = []; this.cols = []; this.jobs = []; this.waves = []; this.comets = [];
            this.accum = {}; this.cleanT = 0; this.cleanState = null; this.t = 0; this.cometT = 3 + Math.random() * 5; this.padT = 0;
            this.dark = !!(level && level.dark);
            this.ok = !!(app.fx && this.scene);
            if (!this.ok) return;
            this.makePools();
            this.makeTextures();
        } catch (e) { console.warn('GameFx.level', e); this.ok = false; }
    },

    disposeMeshes() {
        for (const r of this.ringPool) { try { r.mesh.dispose(); r.mat.dispose(); } catch (e) { /* уже убрано сценой */ } }
        for (const c of this.colPool) { try { c.mesh.dispose(); c.mat.dispose(); } catch (e) { /* уже убрано сценой */ } }
        for (const k in this.tex) { try { this.tex[k].dispose(); } catch (e) { /* уже убрано */ } }
        this.ringPool = []; this.colPool = []; this.tex = {};
    },

    // ------------------------------------------------------------------------------------- пулы частиц
    makePools() {
        const add = (name, o) => this.pool(name, o);
        add('spark', { tex: 'assets/fx/spark.webp', cap: 420, size: [26, 36], g: -420, spin: [-3, 3], sg: [[0, .25], [.15, 1], [1, .2]] });
        add('glint', { tex: 'assets/fx/spark.webp', cap: 360, size: [24, 34], g: 25, spin: [-2, 2], sg: [[0, .1], [.2, 1], [.7, .7], [1, 0]] });
        add('glow', { tex: 'assets/fx/soft.webp', cap: 120, size: [70, 95], g: 0, sg: [[0, .5], [1, 1.4]] });
        add('puff', { tex: 'assets/fx/smoke.webp', cap: 320, size: [44, 60], g: 14, blend: 'standard', spin: [-1, 1], sg: [[0, .35], [1, 1.6]] });
        add('chunk', { tex: 'assets/fx/drop.webp', cap: 520, size: [15, 22], g: -900, blend: 'standard', da: .6, sg: [[0, .9], [.6, 1], [1, .45]] });
        add('confetti', { tex: 'assets/fx/confetti.webp', cap: 320, size: [10, 14], g: -260, blend: 'standard', spin: [-7, 7], da: .5 });
        add('flame', { tex: 'assets/fx/soft.webp', cap: 260, size: [28, 38], g: 0, sg: [[0, 1], [1, .25]] });
        add('mote', { tex: 'assets/fx/soft.webp', cap: 160, size: [16, 24], g: 0, sg: [[0, 0], [.25, 1], [.75, 1], [1, 0]] });
    },

    pool(name, o) {
        const app = this.app;
        const h = app.fx.create({
            name: 'gfx-' + name, texture: o.tex, rate: 0, capacity: o.cap, life: [.5, .5], size: o.size, speed: [1, 1],
            gravity: [0, o.g, 0], blend: o.blend, color: '#ffffff', spin: o.spin, sizeGradient: o.sg,
        });
        if (!h) return null;
        const ps = /** @type {any} */ (h.system);
        const P = { name, h, ps, q: /** @type {any[]} */ ([]), g: -o.g, da: o.da || 0, dir: new BABYLON.Vector3() };
        ps.startPositionFunction = (wm, pos, p) => this.pStart(P, pos, p);
        ps.startDirectionFunction = (wm, dir) => { dir.copyFrom(P.dir); };
        this.pools[name] = P;
        return P;
    },

    /** Положить всплеск в очередь пула. spec: см. pStart. */
    em(name, spec) {
        const P = this.pools[name];
        if (!P || !this.ok) return;
        let n = spec.raw ? spec.n : Math.round((spec.n || 1) * this.Q);
        if (n < 1) return;
        const maxQ = 48;
        if (P.q.length > maxQ) P.q.shift();
        P.q.push({ ...spec, n, i: 0, tried: false });
    },

    /** Всплеск в точке события: map (x, y, h) -> позиция Babylon. */
    at(d, spec) { return { x: d.x, y: d.h, z: d.y, ...spec }; },

    rnd(a, b) { return a + Math.random() * (b - a); },
    pick(arr) { return arr[(Math.random() * arr.length) | 0]; },
    gh(x, z) {
        try { return this.app.location.terrain.heightAt(x, z); } catch (e) { return 0; }
    },
    rgb(n) { return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; },
    mix(a, b, t) {
        const A = this.rgb(a), B = this.rgb(b);
        return (Math.round((A[0] + (B[0] - A[0]) * t) * 255) << 16) | (Math.round((A[1] + (B[1] - A[1]) * t) * 255) << 8) | Math.round((A[2] + (B[2] - A[2]) * t) * 255);
    },

    /** Вылет одной частицы пула: позиция, направление, цвет, масштаб, жизнь — из первого всплеска очереди. */
    pStart(P, pos, p) {
        const b = P.q[0];
        if (!b) { pos.set(0, -1e5, 0); P.dir.set(0, 0, 0); p.lifeTime = 0.01; return; }
        if (++b.i >= b.n) P.q.shift();
        const R = Math.random;
        let px = b.x, py = b.y, pz = b.z, a = R() * 6.2832;
        if (b.circle != null) {
            if (b.arc != null) a = b.a0 + (R() - .5) * b.arc;
            px += Math.cos(a) * b.circle; pz += Math.sin(a) * b.circle;
        }
        if (b.r) { const rr = b.r * Math.sqrt(R()), aa = R() * 6.2832; px += Math.cos(aa) * rr; pz += Math.sin(aa) * rr; }
        if (b.ground) py = this.gh(px, pz) + (b.gy || 0);
        if (b.rv) py += R() * b.rv;
        pos.set(px, py, pz);
        const spd = b.spd || [50, 100], s = spd[0] + R() * (spd[1] - spd[0]);
        let dx = 0, dy = 0, dz = 0;
        const life = b.life || [.5, .9];
        let L = life[0] + R() * (life[1] - life[0]);
        switch (b.mode) {
            case 'ring': dx = Math.cos(a) * s; dz = Math.sin(a) * s; dy = (b.lift || 0) + R() * (b.liftR || 0); break;
            case 'cone': { const k = b.cone == null ? .3 : b.cone; dx = (R() * 2 - 1) * k * s; dz = (R() * 2 - 1) * k * s; dy = s; break; }
            case 'vec': { const sp = b.sp || 0; dx = b.vx + (R() * 2 - 1) * sp; dy = b.vy + (R() * 2 - 1) * sp; dz = b.vz + (R() * 2 - 1) * sp; break; }
            case 'aim': {
                const j = b.tj || 0;
                const ex = b.tx + (R() * 2 - 1) * j - px, ey = b.ty + (R() * 2 - 1) * j - py, ez = b.tz + (R() * 2 - 1) * j - pz;
                dx = ex / L; dz = ez / L; dy = ey / L - P.g * L / 2;
                break;
            }
            default: { // sphere
                const u = R() * 2 - 1, th = R() * 6.2832, q = Math.sqrt(1 - u * u);
                dx = q * Math.cos(th) * s; dz = q * Math.sin(th) * s; dy = u * s * (b.flat == null ? 1 : b.flat) + (b.lift || 0);
            }
        }
        P.dir.set(dx, dy, dz);
        p.lifeTime = L;
        const ps = P.ps;
        const col = b.pal ? this.pick(b.pal) : (b.col || [0xffffff, 0xffffff]);
        const c1 = this.rgb(col[0]), c2 = this.rgb(col[1]), al = b.a == null ? 1 : b.a;
        ps.color1.copyFromFloats(c1[0], c1[1], c1[2], al); ps.color2.copyFromFloats(c2[0], c2[1], c2[2], al);
        ps.colorDead.copyFromFloats(c2[0], c2[1], c2[2], P.da * al);
        const sc = b.sc || [1, 1];
        ps.minScaleX = ps.minScaleY = sc[0]; ps.maxScaleX = ps.maxScaleY = sc[1];
    },

    /** Сброс очередей в системы: раз за кадр (в frame). */
    flush() {
        for (const k in this.pools) {
            const P = this.pools[k];
            if (!P.q.length) continue;
            P.q = P.q.filter(b => !b.tried);
            let total = 0;
            for (const b of P.q) { b.tried = true; total += b.n - b.i; }
            if (total > 0) P.ps.manualEmitCount = total;
        }
    },

    acc(key, rate, dt) {
        const v = (this.accum[key] || 0) + rate * dt;
        const n = Math.floor(v);
        this.accum[key] = v - n;
        return n;
    },

    // ------------------------------------------------------------------------------------- кольца и столбы
    makeTextures() {
        const mk = (name, w, h, horizontal, stops) => {
            const t = new BABYLON.DynamicTexture('gfx-' + name, { width: w, height: h }, this.scene, false);
            const c = t.getContext();
            const g = horizontal ? c.createLinearGradient(0, 0, w, 0) : c.createLinearGradient(0, 0, 0, h);
            for (const [o, a] of stops) g.addColorStop(o, 'rgba(255,255,255,' + a + ')');
            c.clearRect(0, 0, w, h); c.fillStyle = g; c.fillRect(0, 0, w, h);
            t.update(); t.hasAlpha = true; t.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE; t.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
            this.tex[name] = t;
        };
        mk('edge', 256, 4, true, [[0, 0], [.5, .04], [.75, .22], [.9, .72], [.955, 1], [.985, .35], [1, 0]]);
        mk('soft', 256, 4, true, [[0, 0], [.5, .1], [.85, .45], [.97, .8], [1, 0]]);
        mk('beam', 4, 128, false, [[0, 0], [.35, .25], [1, 1]]);
    },

    mat(name, tex) {
        const m = new BABYLON.StandardMaterial(name, this.scene);
        m.disableLighting = true; m.diffuseColor = new BABYLON.Color3(0, 0, 0); m.specularColor = new BABYLON.Color3(0, 0, 0);
        m.emissiveColor = new BABYLON.Color3(1, 1, 1); m.diffuseTexture = tex; m.useAlphaFromDiffuseTexture = true;
        m.backFaceCulling = false; m.alphaMode = BABYLON.Engine.ALPHA_ADD; m.disableDepthWrite = true; m.alpha = 0;
        m.metadata = { toon: false };
        return m;
    },

    ringMesh() {
        const free = this.ringPool.find(r => !r.busy);
        if (free) return free;
        if (this.ringPool.length >= 12) return null;
        const N = this.N, pos = new Float32Array((N + 1) * 6), uv = [], idx = [], nor = [];
        for (let i = 0; i <= N; i++) { uv.push(0, i / N, 1, i / N); nor.push(0, 1, 0, 0, 1, 0); }
        for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        const mesh = new BABYLON.Mesh('gfx-ring', this.scene);
        const vd = new BABYLON.VertexData();
        vd.positions = pos; vd.indices = idx; vd.normals = nor; vd.uvs = uv;
        vd.applyToMesh(mesh, true);
        const mat = this.mat('gfx-ring-mat', this.tex.edge);
        mesh.material = mat; mesh.renderingGroupId = World3D.LAYER.OVERLAY; mesh.isPickable = false;
        mesh.alwaysSelectAsActiveMesh = true; mesh.metadata = { toon: false }; mesh.setEnabled(false);
        const rec = { mesh, mat, pos, busy: false };
        this.ringPool.push(rec);
        return rec;
    },

    /**
     * Кольцо на земле. o: x, y (карта), delay, color [r,g,b], alpha, width (px), prof 'edge'|'soft', full (диск до центра),
     * либо speed + max (растёт со скоростью логики до max), либо r0, r1, dur (расширение с замедлением).
     */
    ring(o) {
        if (!this.ok) return null;
        const m = this.ringMesh();
        if (!m) return null;
        m.busy = true;
        m.mat.diffuseTexture = this.tex[o.prof || 'edge'];
        const c = o.color || [1, 1, 1];
        m.mat.emissiveColor.set(c[0], c[1], c[2]);
        const r = { m, t: 0, delay: o.delay || 0, speed: o.speed, max: o.max, r0: o.r0 || 0, r1: o.r1 || 0, dur: o.dur || 1,
            w: o.width || 80, full: !!o.full, a: o.alpha == null ? 1 : o.alpha, x: o.x, y: o.y, lift: o.lift == null ? 9 : o.lift };
        this.rings.push(r);
        return r;
    },

    updateRings(dt) {
        const N = this.N;
        for (let k = this.rings.length - 1; k >= 0; k--) {
            const r = this.rings[k], m = r.m;
            r.t += dt;
            const tt = r.t - r.delay;
            if (tt < 0) { m.mesh.setEnabled(false); continue; }
            let R, al, done = false;
            if (r.speed) {
                R = r.speed * tt;
                const tEnd = r.max / r.speed;
                al = Math.min(1, tt / 0.05);
                if (R >= r.max) { R = r.max; const f = (tt - tEnd) / 0.3; al *= 1 - f; if (f >= 1) done = true; }
                al *= 1 - 0.3 * Math.pow(R / r.max, 3);
            } else {
                const u = Math.min(1, tt / r.dur);
                R = r.r0 + (r.r1 - r.r0) * (1 - Math.pow(1 - u, 2.2));
                al = Math.min(1, tt / 0.04) * (1 - u) * (1 - u * .3);
                if (u >= 1) done = true;
            }
            if (done) { m.busy = false; m.mesh.setEnabled(false); this.rings.splice(k, 1); continue; }
            const w = r.full ? R : Math.min(R, r.w);
            const inner = Math.max(0, R - w), mid = (R + inner) * 0.5;
            const pos = m.pos, cx = r.x, cz = r.y;
            for (let i = 0; i <= N; i++) {
                const a = (i % N) / N * 6.2832, ca = Math.cos(a), sa = Math.sin(a);
                const y = this.gh(cx + ca * mid, cz + sa * mid) + r.lift;
                const j = i * 6;
                pos[j] = cx + ca * inner; pos[j + 1] = y; pos[j + 2] = cz + sa * inner;
                pos[j + 3] = cx + ca * R; pos[j + 4] = y; pos[j + 5] = cz + sa * R;
            }
            m.mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, pos);
            m.mesh.setEnabled(true);
            m.mat.alpha = Math.max(0, Math.min(1, al * r.a));
        }
    },

    /** Столб света. o: x, y, h (основание), radius, height, dur, color [r,g,b], alpha. */
    column(o) {
        if (!this.ok) return;
        let rec = this.colPool.find(c => !c.busy);
        if (!rec) {
            if (this.colPool.length >= 5) return;
            const mesh = BABYLON.MeshBuilder.CreateCylinder('gfx-col', { height: 1, diameterTop: 1.2, diameterBottom: 2, tessellation: 20, cap: BABYLON.Mesh.NO_CAP }, this.scene);
            const mat = this.mat('gfx-col-mat', this.tex.beam);
            mesh.material = mat; mesh.renderingGroupId = World3D.LAYER.OVERLAY; mesh.isPickable = false;
            mesh.metadata = { toon: false }; mesh.alwaysSelectAsActiveMesh = true; mesh.setEnabled(false);
            rec = { mesh, mat, busy: false };
            this.colPool.push(rec);
        }
        rec.busy = true;
        const c = o.color || [1, 1, 1];
        rec.mat.emissiveColor.set(c[0], c[1], c[2]);
        this.cols.push({ rec, t: 0, o });
    },

    updateCols(dt) {
        for (let k = this.cols.length - 1; k >= 0; k--) {
            const c = this.cols[k], o = c.o, rec = c.rec;
            c.t += dt;
            const u = c.t / o.dur;
            if (u >= 1) { rec.busy = false; rec.mesh.setEnabled(false); this.cols.splice(k, 1); continue; }
            const rise = 1 - Math.pow(1 - Math.min(1, u * 3), 2);
            const hh = o.height * (0.25 + 0.75 * rise);
            const rad = o.radius * (1 - u * 0.55);
            rec.mesh.scaling.set(rad, hh, rad);
            rec.mesh.position.set(o.x, o.h + hh / 2, o.y);
            rec.mat.alpha = (o.alpha == null ? 0.5 : o.alpha) * Math.min(1, c.t / 0.05) * (1 - u) * (1 - u);
            rec.mesh.setEnabled(true);
        }
    },

    // ------------------------------------------------------------------------------------- задания во времени
    /** Растянутый во времени эффект: tick(dt, t, dur) каждый кадр, end() в конце. */
    job(dur, tick, end) { this.jobs.push({ t: 0, dur, tick, end }); },
    later(delay, fn) { this.jobs.push({ t: 0, dur: delay, end: fn }); },

    updateJobs(dt) {
        for (let i = this.jobs.length - 1; i >= 0; i--) {
            const j = this.jobs[i];
            j.t += dt;
            try {
                if (j.tick) j.tick(dt, Math.min(j.t, j.dur), j.dur);
                if (j.t >= j.dur) { this.jobs.splice(i, 1); if (j.end) j.end(); }
            } catch (e) { this.jobs.splice(i, 1); console.warn('GameFx job', e); }
        }
    },

    // ------------------------------------------------------------------------------------- события
    event(name, data) {
        if (!this.ok) return;
        const fn = this.on[name];
        if (!fn) return;
        try { fn.call(this, data || {}); } catch (e) { console.warn('GameFx event', name, e); }
    },

    /** Вспышка: светящееся пятно + искры. */
    flash(d, o) {
        this.em('glow', this.at(d, { n: o.glow || 2, mode: 'sphere', spd: [0, 8], life: [.18, .3], col: o.col || [0xffffff, 0xbff4ff], a: o.a || .7, sc: o.sc || [1.4, 2] }));
    },

    // Один обработчик на событие.
    /** @type {Record<string, (this: any, d: any) => void>} */
    on: {
        // --- пылесос: поток всасывания, блёстки на чистой земле, клуб у сопла
        clean(d) {
            const c = this.cleanState || (this.cleanState = {});
            c.x = d.x; c.y = d.y; c.h = d.h; c.type = d.type | 0; c.radius = d.radius || 80; c.units = d.units || 0;
            this.cleanT = 0.12;
        },
        step(d) {
            const dirty = d.dirt > 0.3;
            this.em('puff', this.at(d, { n: dirty ? 5 : 3, r: 10, mode: 'sphere', flat: .35, lift: 12, spd: [15, 50], life: [.45, .8], col: dirty ? this.PAL.dustDark : this.PAL.dustLight, a: .5, sc: dirty ? [.5, .9] : [.35, .6] }));
        },
        jump(d) {
            this.em('puff', this.at(d, { n: 12, r: 14, mode: 'ring', lift: 6, spd: [70, 140], life: [.5, .8], col: this.PAL.dustLight, a: .55, sc: [.5, .9] }));
            this.ring({ x: d.x, y: d.y, r0: 20, r1: 130, dur: .35, width: 36, alpha: .35, color: [.9, .95, 1] });
        },
        land(d) {
            const k = Math.max(0, Math.min(1.6, (d.impact || 0) / 500));
            if (k < 0.12) return;
            this.em('puff', this.at(d, { n: 5 + 10 * k, r: 12, mode: 'ring', lift: 8, spd: [50 + 40 * k, 110 + 110 * k], life: [.5, .9], col: this.PAL.dustLight, a: .6, sc: [.5 + .2 * k, .9 + .3 * k] }));
            if (k > 0.45) this.ring({ x: d.x, y: d.y, r0: 20, r1: 90 + 90 * k, dur: .4, width: 40, alpha: .35 + .2 * k, color: [.9, .95, 1] });
        },
        pickup(d) {
            const kind = d.kind;
            const col = kind === 'coin' ? this.PAL.gold : kind === 'ore' ? this.PAL.teal : this.PAL.cyan;
            this.flash(d, { glow: 1, col, a: .75, sc: [.7, 1.1] });
            this.em('spark', this.at(d, { n: kind === 'junk' ? 9 : 13, mode: 'sphere', spd: [100, 240], life: [.35, .7], col, sc: [.5, 1] }));
            if (kind !== 'junk') this.em('glint', this.at(d, { n: 4, r: 18, mode: 'sphere', spd: [10, 50], life: [.5, .9], col: [0xffffff, col[1]], sc: [.5, .9] }));
        },
        caught(d) {
            if (d.kind === 'slug') {
                this.flash(d, { glow: 1, col: this.PAL.slime, a: .6, sc: [1, 1.5] });
                this.em('chunk', this.at(d, { n: 18, r: 10, mode: 'sphere', spd: [90, 230], lift: 80, life: [.4, .7], col: this.PAL.slime, sc: [.8, 1.5] }));
                this.em('puff', this.at(d, { n: 4, r: 14, mode: 'sphere', spd: [20, 60], life: [.5, .8], col: [0x9cff7a, 0x6fe84e], a: .5, sc: [.5, .9] }));
            } else {
                this.em('puff', this.at(d, { n: 11, r: 12, mode: 'sphere', spd: [40, 120], life: [.5, .9], col: [0xe8e8ee, 0xbdbdc8], a: .85, sc: [.7, 1.3] }));
                this.em('spark', this.at(d, { n: 7, mode: 'sphere', spd: [80, 190], life: [.35, .65], col: [0xffffff, 0xffe0f0], sc: [.5, .9] }));
            }
        },
        sell(d) {
            const P = typeof GameWorld !== 'undefined' && GameWorld.pad ? GameWorld.pad('sell') : null;
            const pr = P ? P.r : 160, hero = typeof GameHero !== 'undefined' ? GameHero : null;
            const gy = this.gh(d.x, d.y) + 30;
            const n = Math.min(1, 0.4 + (d.units || 0) / 20);
            this.job(0.8, (dt) => {
                const src = this.nz; if (hero) hero.nozzle(src);
                const cnt = this.acc('sell', 150 * n, dt);
                if (cnt > 0) {
                    const t = this.rnd(0, 3) | 0, dc = GameData.DIRT[t].color;
                    this.em('chunk', { raw: true, n: cnt, x: src[0], y: src[1], z: src[2], r: 6, mode: 'aim', tx: d.x, ty: gy, tz: d.y, tj: pr * 0.3, life: [.45, .7], col: [dc, this.mix(dc, 0xffffff, .3)], sc: [.8, 1.6] });
                }
            });
            this.later(0.55, () => {
                this.em('spark', { x: d.x, y: gy, z: d.y, n: 26, mode: 'cone', cone: .35, spd: [260, 470], life: [.6, 1], col: this.PAL.gold, sc: [.6, 1.1] });
                this.em('glint', { x: d.x, y: gy, z: d.y, n: 10, r: pr * 0.5, mode: 'sphere', spd: [20, 70], life: [.6, 1.1], col: [0xffffff, 0xfff0a0], sc: [.6, 1.1] });
                this.ring({ x: d.x, y: d.y, r0: 10, r1: pr * 1.15, dur: .6, width: 60, alpha: .8, color: [1, .85, .35] });
                this.flash({ x: d.x, y: d.y, h: gy }, { col: this.PAL.gold, a: .6, sc: [1.6, 2.2] });
            });
        },
        tankFull(d) {
            const a = typeof GameHero !== 'undefined' ? GameHero.heading : 0;
            const p = { x: d.x - Math.cos(a) * 30, y: d.y - Math.sin(a) * 30, h: d.h + 100 };
            for (let i = 0; i < 3; i++) {
                this.later(i * 0.3, () => {
                    this.flash(p, { glow: 1, col: [0xff3a3a, 0xff9a8a], a: .85, sc: [1.6, 2.2] });
                    this.em('spark', this.at(p, { n: 8, mode: 'sphere', spd: [60, 150], life: [.3, .55], col: this.PAL.red, sc: [.5, .9] }));
                    this.ring({ x: d.x, y: d.y, r0: 30, r1: 120, dur: .4, width: 30, alpha: .55, color: [1, .25, .25] });
                });
            }
        },
        upgrade(d) {
            this.job(1.0, (dt, t, dur) => {
                const k = t / dur, cnt = this.acc('upg', 70, dt);
                for (let i = 0; i < cnt; i++) {
                    const a = t * 10 + i * 3.1;
                    this.em('glint', { raw: true, n: 1, x: d.x + Math.cos(a) * 75, y: d.h + k * 240, z: d.y + Math.sin(a) * 75, mode: 'sphere', spd: [5, 25], life: [.5, .8], col: [0xfff1a8, 0xffffff], sc: [.7, 1.2] });
                }
            });
            this.ring({ x: d.x, y: d.y, r0: 30, r1: 200, dur: .6, width: 80, alpha: 1, color: [1, .85, .35] });
            this.ring({ x: d.x, y: d.y, r0: 30, r1: 270, dur: .75, delay: .12, width: 60, alpha: .8, color: [.6, .95, 1] });
            this.flash({ x: d.x, y: d.y, h: d.h + 30 }, { col: this.PAL.gold, a: .55, sc: [1.6, 2.2] });
        },
        starShow(d) {
            this.column({ x: d.x, y: d.y, h: d.h, radius: 38, height: 700, dur: 1.2, color: [1, .85, .35], alpha: .45 });
            this.em('glint', this.at(d, { n: 20, r: 24, mode: 'cone', cone: .3, spd: [120, 260], life: [.6, 1.1], col: this.PAL.gold, sc: [.7, 1.2] }));
            this.ring({ x: d.x, y: d.y, r0: 20, r1: 150, dur: .6, width: 40, alpha: .6, color: [1, .85, .35] });
        },
        star(d) {
            this.flash(d, { glow: 2, col: [0xfff1a8, 0xffffff], a: .8, sc: [2.4, 3.2] });
            this.em('spark', this.at(d, { n: 55, mode: 'sphere', spd: [200, 520], life: [.7, 1.2], pal: [this.PAL.gold, [0xffffff, 0xfff1a8]], sc: [.8, 1.5] }));
            this.em('confetti', this.at(d, { n: 18, mode: 'sphere', spd: [120, 320], life: [1, 1.6], col: this.PAL.gold, sc: [.8, 1.3] }));
            this.column({ x: d.x, y: d.y, h: d.h - 90, radius: 50, height: 800, dur: .5, color: [1, .9, .5], alpha: .55 });
            this.ring({ x: d.x, y: d.y, r0: 20, r1: 280, dur: .65, width: 60, alpha: .85, color: [1, .85, .35] });
            this.later(0.18, () => {
                this.em('spark', this.at(d, { n: 28, mode: 'sphere', spd: [100, 300], life: [.6, 1], col: [0xfff1a8, 0xffffff], sc: [.6, 1.1] }));
            });
        },
        blast(d) { this.startWave(d, 'blast'); },
        wave(d) { this.startWave({ ...d, radius: d.max }, 'wave'); },
        milestone(d) {
            const h = d.h + 260, n = d.n | 0;
            this.flash({ x: d.x, y: d.y, h }, { col: [0xfff1a8, 0xffffff], a: .7, sc: [2, 2.8] });
            this.em('spark', { x: d.x, y: h, z: d.y, n: 26 + 10 * n, mode: 'sphere', spd: [120, 300], life: [.7, 1.2], pal: this.PAL.fw, sc: [.8, 1.3] });
            this.later(0.2, () => this.em('spark', { x: d.x + 70, y: h + 40, z: d.y - 50, n: 18, mode: 'sphere', spd: [100, 240], life: [.6, 1], pal: this.PAL.fw, sc: [.7, 1.1] }));
        },
        levelDone(d) {
            this.job(3.2, (dt, t) => {
                const hero = typeof GameHero !== 'undefined' ? GameHero : d;
                const cx = hero.x, cy = hero.y, ch = hero.h;
                const cnt = this.acc('conf', 45, dt);
                if (cnt > 0) this.em('confetti', { raw: true, n: cnt, x: cx, y: ch + 650, z: cy, r: 700, mode: 'sphere', flat: .2, spd: [20, 90], life: [2, 3], pal: [[0xffd54a, 0xffd54a], [0x6fe8ff, 0x6fe8ff], [0xff7ad9, 0xff7ad9], [0x9dff7a, 0x9dff7a], [0xffffff, 0xffffff]], sc: [.8, 1.4] });
                if (this.acc('fw', 2.6, dt) > 0) {
                    const a = Math.random() * 6.28, rr = this.rnd(150, 520), fx = cx + Math.cos(a) * rr, fz = cy + Math.sin(a) * rr, fy = ch + this.rnd(300, 620);
                    this.flash({ x: fx, y: fz, h: fy }, { col: [0xffffff, 0xfff1a8], a: .6, sc: [1.8, 2.6] });
                    this.em('spark', { x: fx, y: fy, z: fz, n: 34, mode: 'sphere', spd: [130, 330], life: [.8, 1.3], col: this.pick(this.PAL.fw), sc: [.8, 1.4] });
                }
            });
            this.em('confetti', this.at(d, { n: 30, mode: 'sphere', spd: [150, 380], life: [1.2, 2], pal: [[0xffd54a, 0xffd54a], [0x6fe8ff, 0x6fe8ff], [0xff7ad9, 0xff7ad9]], sc: [.8, 1.4] }));
        },
        rocket(d) {
            this.ring({ x: d.x, y: d.y, r0: 40, r1: 420, dur: 1.2, width: 120, alpha: .5, color: [1, .8, .5] });
        },
        rocketFrame(d) {
            const dt = Math.min(0.05, this.dt), t = d.t || 0, k = Math.min(1, t / 0.7);
            const flame = this.acc('rf', 140, dt);
            if (flame > 0) this.em('flame', { raw: true, n: flame, x: d.x, y: d.h + 10, z: d.y, r: 22, mode: 'vec', vx: 0, vy: -420 - 220 * k, vz: 0, sp: 90, life: [.25, .5], col: this.PAL.fire, a: .9, sc: [2.4, 3.6] });
            const core = this.acc('rc', 70, dt);
            if (core > 0) this.em('flame', { raw: true, n: core, x: d.x, y: d.h + 20, z: d.y, r: 10, mode: 'vec', vx: 0, vy: -350, vz: 0, sp: 50, life: [.2, .38], col: [0xffffff, 0xfff2b0], a: 1, sc: [1.6, 2.4] });
            const sm = this.acc('rs', 40 + 40 * k, dt);
            if (sm > 0) {
                const gy = this.gh(d.x, d.y);
                this.em('puff', { raw: true, n: sm, x: d.x, y: Math.max(gy, d.h - 120) + 20, z: d.y, r: 40, mode: 'ring', lift: 25, liftR: 40, spd: [90, 230 + 100 * k], life: [.9, 1.6], col: this.PAL.dustLight, a: .55, sc: [1.6, 2.8] });
            }
            if (d.h - this.gh(d.x, d.y) < 260 && this.acc('rg', 10, dt) > 0) {
                this.em('glint', { raw: true, n: 1, x: d.x, y: d.h, z: d.y, r: 120, mode: 'sphere', spd: [30, 100], life: [.5, 1], col: this.PAL.gold, sc: [.7, 1.2] });
            }
        },
        knock(d) {
            this.em('spark', this.at(d, { n: 11, r: 12, mode: 'cone', cone: .9, spd: [90, 210], life: [.45, .8], pal: [[0xffe35a, 0xffffff], [0xff9a3a, 0xffe0a0]], sc: [.7, 1.2] }));
            this.em('puff', this.at({ x: d.x, y: d.y, h: d.h - 70 }, { n: 8, r: 14, mode: 'ring', lift: 10, spd: [60, 140], life: [.5, .9], col: this.PAL.dustLight, a: .6, sc: [.6, 1.1] }));
            this.flash(d, { glow: 1, col: [0xffe9a0, 0xffffff], a: .5, sc: [1.1, 1.6] });
        },
        geyserWarn(d) {
            this.job(0.9, (dt) => {
                const cnt = this.acc('gw', 28, dt);
                if (cnt > 0) this.em('puff', { raw: true, n: cnt, x: d.x, y: d.h + 6, z: d.y, r: 26, mode: 'cone', cone: .25, spd: [70, 150], life: [.6, 1.0], col: [0xeafff0, 0xcfffe0], a: .4, sc: [.5, .9] });
            });
            this.ring({ x: d.x, y: d.y, r0: 70, r1: 60, dur: .9, width: 30, alpha: .35, color: [.6, 1, .75] });
        },
        geyser(d) {
            this.job(0.9, (dt, t) => {
                const cnt = this.acc('gy', 90, dt);
                if (cnt > 0) this.em('puff', { raw: true, n: cnt, x: d.x, y: d.h + 10, z: d.y, r: 30, mode: 'cone', cone: .12, spd: [520, 900], life: [.8, 1.3], col: [0xd8ffe8, 0xffffff], a: .55, sc: [.9, 1.8] });
            });
            this.column({ x: d.x, y: d.y, h: d.h, radius: 70, height: 900, dur: .8, color: [.7, 1, .8], alpha: .22 });
            this.em('puff', this.at(d, { n: 14, r: 20, mode: 'ring', lift: 10, spd: [100, 240], life: [.6, 1], col: this.PAL.dustLight, a: .6, sc: [.9, 1.5] }));
            this.ring({ x: d.x, y: d.y, r0: 30, r1: 280, dur: .55, width: 70, alpha: .6, color: [.75, 1, .85] });
        },
        meteorTrail(d) {
            const col = d.goo ? this.PAL.goo : this.PAL.fire;
            this.em('flame', this.at(d, { n: 3, r: 10, mode: 'sphere', spd: [10, 40], life: [.3, .6], col, a: .9, sc: [1.2, 2] }));
            this.em('puff', this.at(d, { n: 1, r: 12, mode: 'sphere', spd: [5, 25], life: [.6, 1], col: d.goo ? [0x5a2a8a, 0x7a4aa8] : [0x6a6670, 0x8a8690], a: .5, sc: [.7, 1.2] }));
        },
        meteorHit(d) {
            const goo = !!d.goo, r = d.r || 120, col = goo ? this.PAL.goo : this.PAL.fire;
            this.flash({ x: d.x, y: d.y, h: d.h + 20 }, { glow: 2, col: goo ? [0xe6b0ff, 0xffffff] : [0xfff0c0, 0xffffff], a: .9, sc: [2.2, 3.2] });
            this.em('spark', this.at(d, { n: goo ? 20 : 42, r: 10, mode: 'sphere', flat: .8, lift: 60, spd: [200, 600], life: [.4, .9], col, sc: [.7, 1.3] }));
            this.em('chunk', this.at(d, { n: goo ? 30 : 16, r: 14, mode: 'sphere', lift: 120, spd: [150, 400], life: [.5, .9], col: goo ? [0x7a2cd8, 0xb04cf0] : [0x6a625a, 0x8a8078], sc: [1, 2] }));
            this.em('puff', this.at(d, { n: 12, r: r * .3, mode: 'ring', lift: 20, spd: [60, 180], life: [.9, 1.6], col: goo ? [0x5a2a8a, 0x7a4aa8] : [0x6a6670, 0x8a8690], a: .6, sc: [1.2, 2.2] }));
            this.ring({ x: d.x, y: d.y, r0: 20, r1: r * 1.2, dur: .45, width: Math.max(40, r * .35), alpha: .8, color: goo ? [.8, .4, 1] : [1, .65, .3] });
            this.ring({ x: d.x, y: d.y, r0: 10, r1: r * .9, dur: .6, width: r, full: true, prof: 'soft', alpha: .35, color: goo ? [.7, .3, 1] : [1, .5, .2] });
        },
        bossHit(d) {
            const dt = Math.min(0.05, this.dt), cnt = this.acc('bh', 170, dt);
            if (cnt <= 0) return;
            const src = this.nz;
            if (typeof GameHero !== 'undefined') GameHero.nozzle(src);
            this.em('chunk', { raw: true, n: Math.max(1, Math.round(cnt * this.Q)), x: d.x, y: d.h, z: d.y, r: (d.r || 100) * 0.5, rv: 60, mode: 'aim', tx: src[0], ty: src[1], tz: src[2], tj: 4, life: [.4, .7], col: [0x3b1d5c, 0x7a3cc0], sc: [1, 2.1] });
            if (this.acc('bh2', 40, dt) > 0) this.em('glint', { x: d.x, y: d.h, z: d.y, n: 1, r: (d.r || 100) * 0.5, mode: 'aim', tx: src[0], ty: src[1], tz: src[2], tj: 6, life: [.4, .6], col: [0xe6b0ff, 0xffffff], sc: [.5, .9] });
        },
        bossLand(d) {
            this.em('puff', this.at(d, { n: 26, r: 40, mode: 'ring', lift: 20, spd: [120, 320], life: [.8, 1.4], col: [0x6a625a, 0x8a8078], a: .7, sc: [1.2, 2.2] }));
            this.em('chunk', this.at(d, { n: 18, r: 30, mode: 'sphere', lift: 140, spd: [150, 360], life: [.5, .9], col: [0x3b1d5c, 0x7a3cc0], sc: [1.2, 2.2] }));
            this.ring({ x: d.x, y: d.y, r0: 30, r1: (d.r || 200) * 1.6, dur: .5, width: 90, alpha: .7, color: [.8, .55, .9] });
        },
        bossSpit(d) {
            this.flash(d, { glow: 2, col: [0xe6b0ff, 0xffffff], a: .8, sc: [1.6, 2.4] });
            this.em('spark', this.at(d, { n: 12, r: 8, mode: 'sphere', spd: [100, 260], life: [.3, .6], col: this.PAL.goo, sc: [.6, 1.1] }));
        },
        bossSlam(d) { this.startSlam(d); },
        bossDie(d) {
            this.flash(d, { glow: 2, col: [0xd8a0ff, 0xffffff], a: .8, sc: [3, 4.2] });
            this.em('chunk', this.at(d, { n: 70, r: 40, mode: 'sphere', lift: 120, spd: [200, 700], life: [.7, 1.3], col: [0x3b1d5c, 0x7a3cc0], sc: [1.2, 2.6] }));
            this.em('puff', this.at(d, { n: 24, r: 60, mode: 'sphere', flat: .6, spd: [80, 240], life: [1, 1.8], col: [0x4a2a6a, 0x7a5a98], a: .7, sc: [1.6, 3] }));
            this.ring({ x: d.x, y: d.y, r0: 30, r1: 520, dur: .8, width: 140, alpha: .8, color: [.7, .35, 1] });
            this.later(0.5, () => {
                this.flash(d, { glow: 2, col: [0xfff1a8, 0xffffff], a: .8, sc: [2.6, 3.6] });
                this.em('spark', this.at(d, { n: 60, mode: 'sphere', spd: [200, 520], life: [.8, 1.3], pal: [this.PAL.gold, [0xffffff, 0xfff1a8]], sc: [.8, 1.5] }));
                this.em('confetti', this.at(d, { n: 24, mode: 'sphere', spd: [150, 380], life: [1.2, 2], col: this.PAL.gold, sc: [.8, 1.3] }));
                this.ring({ x: d.x, y: d.y, r0: 30, r1: 360, dur: .7, width: 70, alpha: .8, color: [1, .85, .35] });
            });
        },
    },

    // ------------------------------------------------------------------------------------- волны с логикой
    startWave(d, kind) {
        const big = kind === 'wave';
        const speed = big ? 1700 : 1500, max = d.radius || (big ? 5000 : 500);
        const w = { kind, x: d.x, y: d.y, h: d.h, speed, max, R: 0, t: 0 };
        this.waves.push(w);
        const x = d.x, y = d.y;
        if (big) {
            this.ring({ x, y, speed, max, width: 170, alpha: .9, color: [1, .96, .82] });
            this.ring({ x, y, speed, max, delay: .3, width: 280, alpha: .6, color: [.5, .95, 1] });
            this.ring({ x, y, speed, max, width: 1, full: true, prof: 'soft', alpha: .16, color: [1, .9, .5], lift: 5 });
            this.column({ x, y, h: d.h - 10, radius: 90, height: 1100, dur: .7, color: [1, .95, .8], alpha: .6 });
            this.flash({ x, y, h: d.h + 90 }, { glow: 3, col: [0xfff6d0, 0xffffff], a: .75, sc: [3, 4.2] });
        } else {
            this.ring({ x, y, speed, max, width: 90, alpha: .95, color: [.78, .98, 1] });
            this.ring({ x, y, speed, max, delay: .15, width: 150, alpha: .7, color: [1, .86, .4] });
            this.ring({ x, y, speed, max, width: 1, full: true, prof: 'soft', alpha: .13, color: [.4, .9, 1], lift: 5 });
            this.column({ x, y, h: d.h - 10, radius: 62, height: 820, dur: .4, color: [.85, 1, 1], alpha: .55 });
            this.flash({ x, y, h: d.h + 90 }, { glow: 2, col: [0xffffff, 0xbff4ff], a: .7, sc: [2.2, 3] });
        }
        this.ring({ x, y, r0: 30, r1: big ? 320 : 220, dur: .4, width: 60, alpha: .8, color: [1, 1, 1] });
        this.em('spark', { x, y: d.h + 90, z: y, n: big ? 60 : 38, mode: 'sphere', spd: [250, 560], life: [.5, .95], pal: this.PAL.spark, sc: [.8, 1.4] });
    },

    updateWaves(dt) {
        const hero = typeof GameHero !== 'undefined' ? GameHero : null;
        for (let i = this.waves.length - 1; i >= 0; i--) {
            const w = this.waves[i];
            w.t += dt; w.R = Math.min(w.max, w.speed * w.t);
            const big = w.kind === 'wave', slam = w.kind === 'slam';
            if (hero) {
                const hx = hero.x, hy = hero.y;
                const dh = Math.hypot(hx - w.x, hy - w.y);
                // искры по фронту: только там, где фронт рядом с героем (экран)
                if (w.R < w.max && Math.abs(w.R - dh) < 1500) {
                    const a0 = Math.atan2(hy - w.y, hx - w.x), arc = Math.min(6.28, 1700 / Math.max(w.R, 1));
                    const rate = slam ? 180 : big ? 330 : 280;
                    const cnt = this.acc('wf' + i, rate * Math.min(1, arc / 1.5 + .25), dt);
                    if (cnt > 0) {
                        if (slam) {
                            this.em('puff', { n: Math.max(1, Math.round(cnt * 0.4)), x: w.x, y: 0, z: w.y, circle: w.R, a0, arc, ground: true, gy: 12, mode: 'ring', lift: 25, liftR: 30, spd: [20, 70], life: [.5, .9], col: [0x6a4a78, 0x9a7ab0], a: .55, sc: [.8, 1.4] });
                            this.em('spark', { n: cnt, x: w.x, y: 0, z: w.y, circle: w.R, a0, arc, ground: true, gy: 14, mode: 'ring', lift: 60, liftR: 90, spd: [20, 110], life: [.35, .7], col: [0xff4a6a, 0xffa0c0], sc: [.6, 1.1] });
                        } else {
                            this.em('spark', { n: cnt, x: w.x, y: 0, z: w.y, circle: w.R, a0, arc, ground: true, gy: 14, mode: 'ring', lift: 40, liftR: 120, spd: [30, 150], life: [.4, .85], pal: big ? [[0xfff6c0, 0xffffff], [0xbff4ff, 0xffffff]] : this.PAL.spark, sc: [.7, 1.4] });
                        }
                    }
                }
                // блёстки на очищенной земле за фронтом
                if (!slam) {
                    const cnt = this.acc('wg' + i, (big ? 420 : 170) * this.Q, dt);
                    for (let k = 0; k < cnt; k++) {
                        const aa = Math.random() * 6.2832, rr = 950 * Math.sqrt(Math.random());
                        const px = hx + Math.cos(aa) * rr, pz = hy + Math.sin(aa) * rr, dd = Math.hypot(px - w.x, pz - w.y);
                        if (dd > w.R - 30 || (!big && dd < w.R - 700)) continue;
                        this.em('glint', { raw: true, n: 1, x: px, y: 0, z: pz, ground: true, gy: 6, rv: 40, mode: 'sphere', flat: .3, lift: 25, spd: [5, 30], life: [.5, 1.1], pal: [[0xffffff, 0xbff4ff], [0xfff6c0, 0xffffff]], sc: [.5, 1.1] });
                    }
                }
            }
            if (w.t > w.max / w.speed + 0.4) this.waves.splice(i, 1);
        }
    },

    startSlam(d) {
        const w = { kind: 'slam', x: d.x, y: d.y, h: d.h, speed: 640, max: d.r || 950, R: 0, t: 0 };
        this.waves.push(w);
        this.ring({ x: d.x, y: d.y, speed: 640, max: w.max, width: 80, alpha: .95, color: [1, .25, .45], lift: 12 });
        this.ring({ x: d.x, y: d.y, speed: 640, max: w.max, delay: .08, width: 160, alpha: .5, color: [.6, .2, 1], lift: 10 });
        this.ring({ x: d.x, y: d.y, speed: 640, max: w.max, width: 1, full: true, prof: 'soft', alpha: .14, color: [.9, .2, .6], lift: 6 });
        this.flash({ x: d.x, y: d.y, h: d.h + 40 }, { glow: 2, col: [0xff90b0, 0xffffff], a: .7, sc: [2.2, 3] });
        this.em('puff', { x: d.x, y: d.h + 10, z: d.y, n: 14, r: 40, mode: 'ring', lift: 15, spd: [100, 260], life: [.7, 1.2], col: [0x6a4a78, 0x9a7ab0], a: .6, sc: [1, 1.8] });
    },

    // ------------------------------------------------------------------------------------- кадры
    update(dt, ctx) {
        if (!this.ok) return;
        try {
            this.dt = dt; this.t += dt;
            const hero = ctx && ctx.hero;
            if (hero) this.persistent(dt, ctx, hero);
            this.updateJobs(dt);
            this.updateWaves(dt);
            this.updateRings(dt);
            this.updateCols(dt);
            this.updateAtmos(dt, hero);
        } catch (e) { console.warn('GameFx.update', e); }
    },

    frame(dt) {
        if (!this.ok) return;
        try {
            this.dt = dt;
            this.flush();
        } catch (e) { console.warn('GameFx.frame', e); }
    },

    /** Постоянные эффекты героя: поток всасывания, блёстки, клуб и ореол у сопла, пламя ранца. */
    persistent(dt, ctx, hero) {
        const Q = this.Q, nz = this.nz;
        hero.nozzle(nz);
        if (this.cleanT > 0) {
            this.cleanT -= dt;
            const c = this.cleanState;
            if (c && this.cleanT > 0) {
                let col = GameData.DIRT[c.type] ? GameData.DIRT[c.type].color : 0x9a8a80;
                if (c.type === 0) col = this.mix(col, 0xd8c8b8, .25);
                if (typeof GameLook !== 'undefined' && typeof GameLook.streamColor === 'number') col = this.mix(col, GameLook.streamColor, .4);
                const R = Math.max(30, c.radius * 0.85);
                const cnt = this.acc('stream', 230 * Q, dt);
                if (cnt > 0) this.em('chunk', { raw: true, n: cnt, x: c.x, y: 0, z: c.y, r: R, ground: true, gy: 8, rv: 10, mode: 'aim', tx: nz[0], ty: nz[1], tz: nz[2], tj: 3, life: [.32, .55], col: [col, this.mix(col, 0xffffff, .3)], sc: [.7, 1.5] });
                const gl = this.acc('streamg', 75 * Q, dt);
                if (gl > 0) this.em('glint', { raw: true, n: gl, x: c.x, y: 0, z: c.y, r: R, ground: true, gy: 14, rv: 12, mode: 'aim', tx: nz[0], ty: nz[1], tz: nz[2], tj: 4, life: [.3, .5], col: [0xffffff, 0xbff4ff], a: .8, sc: [.35, .7] });
                const sp = this.acc('sparkle', 38 * Q, dt);
                if (sp > 0) this.em('glint', { raw: true, n: sp, x: c.x, y: 0, z: c.y, r: c.radius, ground: true, gy: 8, rv: 24, mode: 'sphere', flat: .3, lift: 28, spd: [5, 22], life: [.45, .95], pal: [[0xffffff, 0xbff4ff], [0xffffff, 0xffffff]], sc: [.4, .85] });
                const pf = this.acc('npuff', 20 * Q, dt);
                if (pf > 0) this.em('puff', { raw: true, n: pf, x: nz[0], y: nz[1], z: nz[2], r: 4, mode: 'sphere', flat: .5, lift: 15, spd: [10, 40], life: [.5, .9], col: [this.mix(col, 0xcfc8bf, .5), this.mix(col, 0xe8e2d8, .5)], a: .4, sc: [.4, .8] });
            }
        }
        if (ctx.working) {
            const hl = this.acc('halo', 55 * Q, dt);
            if (hl > 0) this.em('glow', { raw: true, n: hl, x: nz[0], y: nz[1], z: nz[2], r: 5, rv: 5, mode: 'sphere', spd: [0, 10], life: [.12, .22], col: [0x7fe9ff, 0xffffff], a: .38, sc: [.35, .6] });
        }
        if (ctx.jet) {
            const a = hero.heading, bx = hero.x - Math.cos(a) * 28, bz = hero.y - Math.sin(a) * 28, by = hero.h + 72;
            const fl = this.acc('jf', 130 * Q, dt);
            if (fl > 0) this.em('flame', { raw: true, n: fl, x: bx, y: by, z: bz, r: 7, mode: 'vec', vx: 0, vy: -300, vz: 0, sp: 70, life: [.2, .38], col: this.PAL.fire, a: .9, sc: [.9, 1.3] });
            const co = this.acc('jc', 60 * Q, dt);
            if (co > 0) this.em('flame', { raw: true, n: co, x: bx, y: by - 4, z: bz, r: 3, mode: 'vec', vx: 0, vy: -240, vz: 0, sp: 40, life: [.14, .26], col: [0xffffff, 0xfff2b0], a: 1, sc: [.55, .85] });
            const sm = this.acc('js', 22 * Q, dt);
            if (sm > 0) this.em('puff', { raw: true, n: sm, x: bx, y: by - 16, z: bz, r: 6, mode: 'vec', vx: 0, vy: -70, vz: 0, sp: 40, life: [.6, 1.0], col: [0xcfc8bf, 0xe8e2d8], a: .3, sc: [.3, .55] });
        }
    },

    /** Атмосфера: пылинки, светлячки, падающие звёзды, мерцание над площадками. */
    updateAtmos(dt, hero) {
        if (!hero) return;
        const Q = this.Q;
        const cnt = this.acc('mote', 12 * Q, dt);
        if (cnt > 0) {
            for (let i = 0; i < cnt; i++) {
                const a = Math.random() * 6.2832, rr = 900 * Math.sqrt(Math.random()), px = hero.x + Math.cos(a) * rr, pz = hero.y + Math.sin(a) * rr;
                this.em('mote', { raw: true, n: 1, x: px, y: this.gh(px, pz) + this.rnd(20, 320), z: pz, mode: 'sphere', spd: [2, 9], life: [3.5, 6], col: [0xffffff, 0xbff4ff], a: .4, sc: [.2, .4] });
            }
        }
        if (this.dark) {
            const f = this.acc('fly', 5 * Q, dt);
            for (let i = 0; i < f; i++) {
                const a = Math.random() * 6.2832, rr = 1000 * Math.sqrt(Math.random()), px = hero.x + Math.cos(a) * rr, pz = hero.y + Math.sin(a) * rr;
                this.em('mote', { raw: true, n: 1, x: px, y: this.gh(px, pz) + this.rnd(40, 240), z: pz, mode: 'sphere', spd: [6, 20], life: [3, 5.5], col: [0x7dffb0, 0xb0ffe8], a: .85, sc: [.5, .9] });
            }
        }
        // падающие звёзды
        this.cometT -= dt;
        if (this.cometT <= 0) {
            this.cometT = this.rnd(7, 16);
            const cam = this.app && this.app.camera, az = cam && typeof cam.azimuth === 'number' ? cam.azimuth : 0;
            const fx = Math.cos(az), fz = Math.sin(az), lx = -fz, lz = fx, side = Math.random() < .5 ? -1 : 1;
            const dist = this.rnd(2600, 3800), lat = this.rnd(-1500, 1500);
            this.comets.push({ x: hero.x + fx * dist + lx * lat, y: hero.h + this.rnd(900, 1500), z: hero.y + fz * dist + lz * lat, vx: lx * side * 2200 + fx * 200, vy: -520, vz: lz * side * 2200 + fz * 200, t: 0 });
        }
        for (let i = this.comets.length - 1; i >= 0; i--) {
            const c = this.comets[i];
            c.t += dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
            if (c.t > 0.9) { this.comets.splice(i, 1); continue; }
            this.em('spark', { raw: true, n: 1, x: c.x, y: c.y, z: c.z, mode: 'sphere', spd: [0, 5], life: [.12, .18], col: [0xffffff, 0xbff4ff], sc: [1.6, 2] });
            const tr = this.acc('ct', 120 * Q, dt);
            for (let k = 0; k < tr; k++) {
                const b = Math.random() * 0.06;
                this.em('glint', { raw: true, n: 1, x: c.x - c.vx * b, y: c.y - c.vy * b, z: c.z - c.vz * b, mode: 'sphere', spd: [0, 6], life: [.35, .7], col: [0xbff4ff, 0xffffff], a: .8, sc: [.45, .9] });
            }
        }
        // мерцание над площадками станций
        this.padT -= dt;
        const pads = typeof GameWorld !== 'undefined' ? GameWorld.pads : null;
        if (this.padT <= 0 && pads && pads.length) {
            this.padT = 0.22 / Math.max(0.5, Q * 1.6);
            const p = pads[(Math.random() * pads.length) | 0];
            if (p && p.enabled !== false && Math.hypot(p.x - hero.x, p.y - hero.y) < 2600) {
                this.em('glint', { x: p.x, y: p.h + 12, z: p.y, n: 2, circle: p.r * 0.92, rv: 20, mode: 'vec', vx: 0, vy: 45, vz: 0, sp: 18, life: [.8, 1.4], col: [0xffffff, 0xbff4ff], a: .8, sc: [.5, 1] });
            }
        }
    },
};
