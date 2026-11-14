// GameWorld.js — мир сектора Clean the Moon поверх карты движка: небо со звёздами и Землёй, площадки станций
// (сдать грязь, мастерская, взлёт), подписи над ними, космический мусор, спрятанные звёзды, выпадающие монеты и
// руда, предупреждающие круги на земле и ракета. Всё читается из карты (маркеры и объекты Maps.js): правка карты
// в редакторе меняет игру.
//
//   await GameWorld.build(app, level, hooks)   // в prepare; hooks: onPad(kind, entered), onJunk(item), onStar(i), onDrop(kind, coins)
//   GameWorld.update(dt, hero, tool)           // tool: { on, x, y, radius, power }
//   GameWorld.frame()                          // каждый кадр (и на паузе): подписи над станциями
//   GameWorld.drop('coin' | 'ore', x, y, coins, n)
//   GameWorld.warn(x, y, r, sec)               // красный круг-предупреждение на земле
//   GameWorld.launchRocket(done)               // ролик взлёта

/** @satisfies {Record<string, any>} */
const GameWorld = {
    /** @type {LoryApp | null} */ app: null,
    /** @type {any} */ hooks: {},
    /** @type {any[]} */ pads: [],
    /** @type {any[]} */ junk: [],
    /** @type {any[]} */ stars: [],
    /** @type {any[]} */ drops: [],
    /** @type {any[]} */ warns: [],
    /** @type {any[]} */ labels: [],
    /** @type {any[]} */ owned: [],          // меши, созданные здесь (умирают со сценой; список — для снятия при пересборке)
    /** @type {any} */ sky: null,
    /** @type {any} */ earth: null,
    /** @type {any} */ planet: null,
    /** @type {any} */ stars3d: null,
    /** @type {any} */ rocket: null,
    /** @type {HTMLElement | null} */ layer: null,
    t: 0,
    heavyT: 0,
    beamsOn: true,

    PAD: {
        sell: { color: [0.25, 0.95, 0.42], label: 'lbl.sell', icon: 'assets/ui/ic_sell.webp' },
        shop: { color: [1, 0.62, 0.14], label: 'lbl.shop', icon: 'assets/ui/ic_upgrades.webp' },
        launch: { color: [0.3, 0.72, 1], label: 'lbl.launch', icon: 'assets/ui/ic_rocket.webp' },
    },

    // ---------------------------------------------------------------------------------------------
    // Сборка
    // ---------------------------------------------------------------------------------------------

    async build(app, level, hooks) {
        this.clear();
        this.app = app;
        this.hooks = hooks || {};
        const loc = app.location;
        this.makeLayer();
        this.buildSky(level);
        for (const rec of loc.objects) if (rec.mesh) this.glow(rec.mesh);
        this.buildPads();
        this.buildJunk();
        await this.buildStars(hooks.foundStars || []);
        this.rocket = loc.objects.find(r => r.mesh && /rocket\.glb$/i.test(String(r.def.model))) || null;
        if (this.rocket) {
            this.rocket.baseY = this.rocket.mesh.position.y;
            for (const m of this.rocket.mesh.getChildMeshes(false)) if (m.metadata && /^Flame/i.test(m.metadata.part || '')) { this.rocket.flame = m; m.setEnabled(false); }
        }
        // предзагрузка выпадающих предметов (кэш Model3D)
        await Promise.all(['assets/models/game/coin.glb', 'assets/models/game/ore.glb'].map(u => Model3D.load(u).catch(() => null)));
    },

    clear() {
        const view = this.app && this.app.location ? this.app.location.view : null;
        for (const m of this.owned) { try { if (view) World3D.removeObject(view, m); m.dispose(false, true); } catch (e) { /* сцена уже сменилась */ } }
        this.owned = []; this.pads = []; this.junk = []; this.stars = []; this.drops = []; this.warns = [];
        for (const l of this.labels) if (l.el && l.el.parentNode) l.el.parentNode.removeChild(l.el);
        this.labels = [];
        this.sky = null; this.earth = null; this.planet = null; this.stars3d = null; this.rocket = null;
    },

    /** Части модели с именем *_glow светятся сами (лампы, кристаллы, огни). */
    glow(root) {
        for (const m of root.getChildMeshes(false)) {
            if (!m.metadata || !/_glow$/i.test(String(m.metadata.part || '')) || m.metadata.glowDone) continue;
            m.metadata.glowDone = true;
            const lit = (mat) => {
                if (!mat) return mat;
                const c = mat.clone(mat.name + '-glow');
                c.disableLighting = true;
                c.emissiveColor = new BABYLON.Color3(1, 1, 1);
                c.metadata = Object.assign({}, mat.metadata, { toon: false });
                return c;
            };
            const mat = m.material;
            if (mat && mat.subMaterials) {
                const multi = new BABYLON.MultiMaterial(mat.name + '-glow', m.getScene());
                multi.subMaterials = mat.subMaterials.map(lit);
                m.material = multi;
            } else m.material = lit(mat);
        }
    },

    /** Модель -> корень в сцене ('prop' | 'actor'); нет файла — null. */
    async spawn(url, name, kind) {
        try {
            const model = await Model3D.load(url);
            return this.spawnNow(model, name, kind);
        } catch (e) { console.warn('GameWorld: нет модели ' + url); return null; }
    },
    spawnNow(model, name, kind) {
        const view = this.app.location.view;
        const root = Model3D.build(model, view.scene, { name });
        World3D.addObject(view, root, kind === 'actor' ? 'actor' : 'prop');
        this.glow(root);
        this.owned.push(root);
        return root;
    },
    remove(root) {
        const i = this.owned.indexOf(root);
        if (i >= 0) this.owned.splice(i, 1);
        try { Model3D.dispose(this.app.location.view, root); } catch (e) { /* уже */ }
    },

    ground(x, y) { return this.app.location.terrain.heightAt(x, y); },

    // ---------------------------------------------------------------------------------------------
    // Небо: купол со звёздами и туманностями, Земля над горизонтом
    // ---------------------------------------------------------------------------------------------

    buildSky(level) {
        const scene = this.app.location.view.scene;
        const L = level || {}, dark = !!L.dark;
        const pal = L.sky || ['#050a26', '#101a52', '#3a4bb4'];       // зенит, середина, горизонт
        let seed = 1234567 + Math.round((L.mult || 1) * 977);
        const rnd = () => { seed = (seed * 1664525 + 1013904223) | 0; return ((seed >>> 8) & 0xffff) / 65536; };
        const unlit = (name) => {
            const m = new BABYLON.StandardMaterial(name, scene);
            m.disableLighting = true;
            m.diffuseColor = new BABYLON.Color3(0, 0, 0);
            m.specularColor = new BABYLON.Color3(0, 0, 0);
            m.emissiveColor = new BABYLON.Color3(1, 1, 1);
            m.backFaceCulling = false;
            m.fogEnabled = false;
            m.disableDepthWrite = true;
            m.metadata = { toon: false };
            return m;
        };
        const far = (mesh) => { mesh.infiniteDistance = true; mesh.isPickable = false; mesh.applyFog = false; mesh.alwaysSelectAsActiveMesh = true; this.owned.push(mesh); return mesh; };

        // --- купол: градиент неба, Млечный Путь, туманности (верхняя половина сферы — вся текстура на видимое небо) ---
        const W = IS_MOBILE ? 1024 : 2048, H = W / 2;
        const tex = new BABYLON.DynamicTexture('sky-tex', { width: W, height: H }, scene, false);
        const g = /** @type {CanvasRenderingContext2D} */ (/** @type {any} */ (tex.getContext()));
        // у холста y = 0 — зенит, y = H·0.9 — горизонт, ниже — под горизонтом (его закрывает земля)
        const hz = H * 0.9;
        const grad = g.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, pal[0]); grad.addColorStop(0.5, pal[1]); grad.addColorStop(0.82, pal[2]); grad.addColorStop(0.9, pal[2]); grad.addColorStop(1, pal[1]);
        g.fillStyle = grad; g.fillRect(0, 0, W, H);
        // светлая дымка у горизонта
        const haze = g.createLinearGradient(0, hz - H * 0.16, 0, hz + 4);
        haze.addColorStop(0, 'rgba(255,255,255,0)'); haze.addColorStop(1, dark ? 'rgba(150,140,255,0.16)' : 'rgba(210,225,255,0.30)');
        g.fillStyle = haze; g.fillRect(0, hz - H * 0.16, W, H * 0.16 + 4);
        // Млечный Путь: полоса из мягких облаков и звёздной пыли, идущая волной через всё небо
        const band = (x) => H * (0.36 + 0.2 * Math.sin(x / W * Math.PI * 2 + 0.8));
        g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 70; i++) {
            const x = rnd() * W, y = band(x) + (rnd() - 0.5) * H * 0.14, r = W * (0.03 + rnd() * 0.07);
            const c = ['160,150,255', '110,190,255', '255,150,220', '255,220,170'][(rnd() * 4) | 0];
            const rg = g.createRadialGradient(x, y, 0, x, y, r);
            rg.addColorStop(0, 'rgba(' + c + ',' + (dark ? 0.085 : 0.07) + ')'); rg.addColorStop(1, 'rgba(' + c + ',0)');
            g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
        }
        for (let i = 0; i < (IS_MOBILE ? 1400 : 4200); i++) {
            const x = rnd() * W, y = band(x) + (rnd() + rnd() + rnd() - 1.5) * H * 0.11;
            if (y > hz - 6) continue;
            g.fillStyle = 'rgba(255,255,255,' + (0.1 + rnd() * 0.34) + ')';
            g.fillRect(x, y, 1, 1);
        }
        // крупные цветные туманности
        for (let i = 0; i < 7; i++) {
            const x = rnd() * W, y = H * (0.08 + rnd() * 0.5), r = W * (0.05 + rnd() * 0.08);
            const c = ['120,90,255', '60,190,255', '255,110,200', '90,255,200'][i % 4];
            const rg = g.createRadialGradient(x, y, 0, x, y, r);
            rg.addColorStop(0, 'rgba(' + c + ',0.17)'); rg.addColorStop(0.5, 'rgba(' + c + ',0.06)'); rg.addColorStop(1, 'rgba(' + c + ',0)');
            g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
        }
        g.globalCompositeOperation = 'source-over';
        tex.update(false);
        tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
        const domeMat = unlit('sky-mat');
        domeMat.emissiveTexture = tex;
        domeMat.emissiveColor = new BABYLON.Color3(0, 0, 0);
        const R = 7800;
        const dome = BABYLON.MeshBuilder.CreateSphere('sky-dome', { diameter: R * 2, segments: 24, slice: 0.56 }, scene);
        dome.material = domeMat;
        far(dome);
        dome.rotation.y = (L.mult || 1) * 0.7;
        this.sky = dome;

        // --- звёзды геометрией (чёткие на любом экране): один меш из квадратиков на куполе ---
        const st = new BABYLON.DynamicTexture('sky-star', { width: 128, height: 64 }, scene, false);
        const sg = /** @type {CanvasRenderingContext2D} */ (/** @type {any} */ (st.getContext()));
        sg.clearRect(0, 0, 128, 64);
        let rg = sg.createRadialGradient(32, 32, 0, 32, 32, 30);                 // слева — мягкая точка
        rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.22, 'rgba(255,255,255,0.9)'); rg.addColorStop(0.5, 'rgba(255,255,255,0.22)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
        sg.fillStyle = rg; sg.fillRect(0, 0, 64, 64);
        rg = sg.createRadialGradient(96, 32, 0, 96, 32, 16);                      // справа — искра с лучами
        rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.4, 'rgba(255,255,255,0.5)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
        sg.fillStyle = rg; sg.fillRect(64, 0, 64, 64);
        sg.fillStyle = 'rgba(255,255,255,0.95)';
        sg.beginPath(); sg.moveTo(96, 1); sg.quadraticCurveTo(98, 30, 127, 32); sg.quadraticCurveTo(98, 34, 96, 63); sg.quadraticCurveTo(94, 34, 65, 32); sg.quadraticCurveTo(94, 30, 96, 1); sg.fill();
        st.hasAlpha = true;
        st.update(false);
        const pos = [], uv = [], col = [], idx = [];
        const count = IS_MOBILE ? 520 : 1300, RS = R * 0.96;
        const tints = [[1, 1, 1], [0.8, 0.9, 1], [1, 0.95, 0.8], [1, 0.84, 0.95], [0.75, 1, 0.95]];
        for (let i = 0; i < count; i++) {
            // равномерно по верхней полусфере, чуть гуще к зениту
            const el = Math.asin(Math.pow(rnd(), 0.8)) * 0.985 + 0.03, az = rnd() * Math.PI * 2;
            const dx = Math.cos(el) * Math.cos(az), dy = Math.sin(el), dz = Math.cos(el) * Math.sin(az);
            const big = rnd() > 0.9;
            const size = (big ? 70 + rnd() * 90 : 24 + rnd() * 30) * (dark ? 1.15 : 1);
            // касательные к куполу оси квадратика
            let tx = -dz, tz = dx; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
            const ux = dy * tz, uy = dz * tx - dx * tz, uz = -dy * tx;
            const cx = dx * RS, cy = dy * RS, cz = dz * RS, b = pos.length / 3;
            const rot = big ? rnd() * 0.6 : 0, cr = Math.cos(rot) * size, sr = Math.sin(rot) * size;
            for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
                const ax = sx * cr - sy * sr, ay = sx * sr + sy * cr;
                pos.push(cx + tx * ax + ux * ay, cy + uy * ay, cz + tz * ax + uz * ay);
            }
            const u0 = big ? 0.5 : 0, u1 = big ? 1 : 0.5;
            uv.push(u0, 0, u1, 0, u1, 1, u0, 1);
            const t = tints[(rnd() * tints.length) | 0], a = big ? 0.75 + rnd() * 0.25 : 0.4 + rnd() * 0.6;
            for (let k = 0; k < 4; k++) col.push(t[0] * a, t[1] * a, t[2] * a, 1);
            idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
        }
        const stars = new BABYLON.Mesh('sky-stars', scene);
        const vd = new BABYLON.VertexData();
        vd.positions = pos; vd.uvs = uv; vd.colors = col; vd.indices = idx;
        vd.applyToMesh(stars);
        const starMat = unlit('sky-star-mat');
        starMat.diffuseTexture = st;
        starMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
        starMat.useAlphaFromDiffuseTexture = true;
        starMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
        stars.material = starMat;
        stars.hasVertexAlpha = false;
        far(stars);
        this.stars3d = stars;

        // --- свечение: мягкий диск-ореол (солнце, атмосфера Земли) ---
        const glowTex = (name, stops) => {
            const t = new BABYLON.DynamicTexture(name, { width: 256, height: 256 }, scene, false);
            const c = /** @type {CanvasRenderingContext2D} */ (/** @type {any} */ (t.getContext()));
            c.clearRect(0, 0, 256, 256);
            const q = c.createRadialGradient(128, 128, 0, 128, 128, 128);
            for (const s of stops) q.addColorStop(s[0], s[1]);
            c.fillStyle = q; c.fillRect(0, 0, 256, 256);
            t.hasAlpha = true; t.update(false);
            return t;
        };
        const glow = (name, texture, size, x, y, z) => {
            const m = unlit(name + '-mat');
            m.diffuseTexture = texture; m.diffuseColor = new BABYLON.Color3(1, 1, 1);
            m.useAlphaFromDiffuseTexture = true; m.alphaMode = BABYLON.Engine.ALPHA_ADD;
            const p = BABYLON.MeshBuilder.CreatePlane(name, { size }, scene);
            p.material = m; p.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
            p.position.set(x, y, z);
            return far(p);
        };
        // солнце — там, откуда светит свет сцены
        const sd = World3D.sunDirection();
        if (!dark) {
            const sunT = glowTex('sky-sun', [[0, 'rgba(255,255,255,1)'], [0.1, 'rgba(255,250,225,1)'], [0.16, 'rgba(255,236,170,0.55)'], [0.45, 'rgba(255,214,140,0.14)'], [1, 'rgba(255,200,120,0)']]);
            glow('sky-sun', sunT, 2600, -sd.x * 7000, -sd.y * 7000, -sd.z * 7000);
        }

        // --- Земля с атмосферой и далёкая планета с кольцом (модели; нет файла — небо без них) ---
        const eaz = dark ? 2.4 : 0.9, eh = dark ? 1300 : 1650, ed = 6300, es = dark ? 7 : 10.5;
        const ex = Math.cos(eaz) * ed, ez = Math.sin(eaz) * ed;
        const atmT = glowTex('sky-atm', [[0, 'rgba(120,200,255,0)'], [0.36, 'rgba(120,200,255,0)'], [0.4, 'rgba(140,215,255,0.75)'], [0.47, 'rgba(110,190,255,0.28)'], [0.7, 'rgba(90,160,255,0.07)'], [1, 'rgba(90,160,255,0)']]);
        Model3D.load('assets/models/decor/earth.glb').then((model) => {
            if (this.sky !== dome) return;
            glow('sky-atm', atmT, es * 100 * 5, ex * 1.02, eh * 1.02, ez * 1.02);
            const root = Model3D.build(model, scene, { name: 'earth' });
            for (const m of root.getChildMeshes(false)) {
                m.applyFog = false; m.isPickable = false; m.alwaysSelectAsActiveMesh = true;
                const fix = (mm) => { if (mm) { mm.fogEnabled = false; mm.emissiveColor = new BABYLON.Color3(0.3, 0.3, 0.36); mm.specularColor = new BABYLON.Color3(0, 0, 0); } };
                const em = /** @type {any} */ (m.material);
                if (em && em.subMaterials) em.subMaterials.forEach(fix); else fix(em);
            }
            root.infiniteDistance = true;
            root.position.set(ex, eh, ez);
            root.scaling.setAll(es);
            root.rotation.set(0.4, 1.1, 0.25);
            this.earth = root;
            this.owned.push(root);
        }).catch(() => { /* Земля не обязательна */ });
        Model3D.load('assets/models/decor/planet_ring.glb').then((model) => {
            if (this.sky !== dome) return;
            const root = Model3D.build(model, scene, { name: 'planet' });
            for (const m of root.getChildMeshes(false)) {
                m.applyFog = false; m.isPickable = false; m.alwaysSelectAsActiveMesh = true;
                const fix = (mm) => { if (mm) { mm.fogEnabled = false; mm.emissiveColor = new BABYLON.Color3(0.26, 0.24, 0.3); mm.specularColor = new BABYLON.Color3(0, 0, 0); } };
                const em = /** @type {any} */ (m.material);
                if (em && em.subMaterials) em.subMaterials.forEach(fix); else fix(em);
            }
            const paz = eaz + 2.6;
            root.infiniteDistance = true;
            root.position.set(Math.cos(paz) * 6600, 3300, Math.sin(paz) * 6600);
            root.scaling.setAll(3.4);
            root.rotation.set(0.5, 0.3, -0.35);
            this.planet = root;
            this.owned.push(root);
        }).catch(() => { /* планета не обязательна */ });

        // --- свет и дымка сектора: туман в цвет горизонта, чтобы дальние горы мягко уходили в небо ---
        const fogC = BABYLON.Color3.FromHexString(pal[2]).scale(dark ? 0.5 : 0.62).toHexString();
        const fogN = parseInt(fogC.slice(1), 16);
        World3D.setLighting(dark
            ? { sunIntensity: 0.36, skyIntensity: 0.46, sunColor: 0x9db4ff, skyLight: 0x8a96ff, groundLight: 0x3a3a70, sky: fogN, fog: 0.00013, shadowStrength: 0.62 }
            : { sunIntensity: null, skyIntensity: null, sunColor: null, skyLight: null, groundLight: null, sky: fogN, fog: 0.00011, shadowStrength: null });
    },

    // ---------------------------------------------------------------------------------------------
    // Площадки станций и подписи
    // ---------------------------------------------------------------------------------------------

    makeLayer() {
        if (this.layer) return;
        const st = document.createElement('style');
        st.textContent = `
#world-labels{position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:4}
.wl{position:absolute;left:0;top:0;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;gap:2px;
 font:900 20px/1 'Rubik',system-ui,sans-serif;color:#fff;letter-spacing:.5px;white-space:nowrap;will-change:transform,opacity;
 -webkit-text-stroke:5px #10142e;paint-order:stroke fill;text-shadow:0 3px 0 #10142e}
.wl img{width:46px;height:46px;object-fit:contain;filter:drop-shadow(0 3px 0 rgba(16,20,46,.9))}
.wl b{font-weight:900}
.wl.sell{color:#8dff9c}.wl.shop{color:#ffc965}.wl.launch{color:#8fd4ff}.wl.locked{color:#c9cede}
body.ui-window #world-labels,body.ui-menu #world-labels{display:none}`;
        document.head.appendChild(st);
        const el = document.createElement('div');
        el.id = 'world-labels';
        document.body.appendChild(el);
        this.layer = el;
    },

    label(kind, text, icon, x, y, h) {
        const el = document.createElement('div');
        el.className = 'wl ' + kind;
        if (icon) { const im = document.createElement('img'); im.src = icon; im.alt = ''; el.appendChild(im); }
        const b = document.createElement('b'); b.textContent = text; el.appendChild(b);
        /** @type {HTMLElement} */ (this.layer).appendChild(el);
        const l = { el, text: b, x, y, h, kind, shown: true, pad: /** @type {any} */ (null) };
        this.labels.push(l);
        return l;
    },

    buildPads() {
        const loc = this.app.location, scene = loc.view.scene;
        for (const kind of ['sell', 'shop', 'launch']) {
            for (const m of loc.markers(kind)) {
                const cfg = this.PAD[kind], r = Math.max(90, (m.scale ? m.scale[0] : 1) * 130);
                const gh = this.ground(m.x, m.y);
                const mat = new BABYLON.StandardMaterial('pad-' + kind, scene);
                mat.diffuseColor = new BABYLON.Color3(cfg.color[0], cfg.color[1], cfg.color[2]);
                mat.emissiveColor = mat.diffuseColor.scale(0.55);
                mat.specularColor = new BABYLON.Color3(0, 0, 0);
                mat.alpha = 0.62;
                mat.metadata = { toon: false };
                const disc = BABYLON.MeshBuilder.CreateCylinder('pad-disc', { height: 5, diameter: r * 2, tessellation: 40 }, scene);
                disc.material = mat; disc.position.set(m.x, gh + 5, m.y); disc.isPickable = false;
                const rimMat = new BABYLON.StandardMaterial('pad-rim-' + kind, scene);
                rimMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
                rimMat.emissiveColor = new BABYLON.Color3(cfg.color[0] * 0.6 + 0.4, cfg.color[1] * 0.6 + 0.4, cfg.color[2] * 0.6 + 0.4);
                rimMat.disableLighting = true;
                rimMat.metadata = { toon: false };
                const rim = BABYLON.MeshBuilder.CreateTorus('pad-rim', { diameter: r * 2, thickness: 12, tessellation: 40 }, scene);
                rim.material = rimMat; rim.position.set(m.x, gh + 8, m.y); rim.isPickable = false;
                // столб света над площадкой
                const beamMat = mat.clone('pad-beam-' + kind);
                beamMat.alpha = 0.1; beamMat.backFaceCulling = false; beamMat.disableLighting = true;
                beamMat.emissiveColor = new BABYLON.Color3(cfg.color[0], cfg.color[1], cfg.color[2]);
                const beam = BABYLON.MeshBuilder.CreateCylinder('pad-beam', { height: 260, diameterTop: r * 1.7, diameterBottom: r * 1.96, tessellation: 28, cap: BABYLON.Mesh.NO_CAP }, scene);
                beam.material = beamMat; beam.position.set(m.x, gh + 136, m.y); beam.isPickable = false;
                this.owned.push(disc, rim, beam);
                const lab = this.label(kind, Lang.t(cfg.label), cfg.icon, m.x, m.y, gh + 300);
                const pad = { kind, x: m.x, y: m.y, h: gh, r, disc, rim, beam, mat, lab, inside: false, enabled: true, pulse: 0 };
                lab.pad = pad;
                this.pads.push(pad);
            }
        }
    },

    pad(kind) { return this.pads.find(p => p.kind === kind) || null; },

    /** Столбы света над площадками: в меню выключены (не закрывают витрину героя). */
    setBeams(on) {
        this.beamsOn = !!on;
        for (const p of this.pads) p.beam.setEnabled(this.beamsOn && p.enabled);
    },

    /** Площадка взлёта: закрыта, пока сектор не убран. */
    setLaunch(open) {
        const p = this.pad('launch');
        if (!p) return;
        p.enabled = !!open;
        p.lab.text.textContent = Lang.t(open ? 'lbl.launch' : 'lbl.launchLocked');
        p.lab.el.classList.toggle('locked', !open);
        p.mat.alpha = open ? 0.62 : 0.22;
        p.beam.setEnabled(!!open && this.beamsOn);
    },

    // ---------------------------------------------------------------------------------------------
    // Мусор, звёзды, выпадающие монеты
    // ---------------------------------------------------------------------------------------------

    buildJunk() {
        const loc = this.app.location;
        for (const rec of loc.objects) {
            const info = rec.mesh ? GameData.junk(rec.def.model) : null;
            if (!info) continue;
            const m = rec.mesh;
            this.junk.push({ rec, mesh: m, info, x: rec.def.x, y: rec.def.y, y0: m.position.y, state: 0, t: 0, s0: m.scaling.x, phase: (rec.def.x * 0.013 + rec.def.y * 0.007) % 6.28 });
        }
    },

    async buildStars(found) {
        const loc = this.app.location;
        const marks = loc.markers('star');
        let model = null;
        try { model = await Model3D.load('assets/models/game/star.glb'); } catch (e) { model = null; }
        for (let i = 0; i < marks.length; i++) {
            const m = marks[i];
            const st = { i, x: m.x, y: m.y, h: this.ground(m.x, m.y), mesh: null, state: found.indexOf(i) >= 0 ? 3 : 0, t: 0 };
            if (st.state === 0) {
                let mesh = model ? this.spawnNow(model, 'star-' + i, 'actor') : null;
                if (!mesh) {
                    mesh = BABYLON.MeshBuilder.CreatePolyhedron('star-' + i, { type: 1, size: 28 }, loc.view.scene);
                    const mat = new BABYLON.StandardMaterial('star-mat', loc.view.scene);
                    mat.diffuseColor = new BABYLON.Color3(1, 0.82, 0.12); mat.emissiveColor = new BABYLON.Color3(0.5, 0.38, 0.02);
                    mesh.material = mat;
                    World3D.addObject(loc.view, mesh, 'actor');
                    this.owned.push(mesh);
                }
                mesh.position.set(st.x, st.h - 60, st.y);
                mesh.setEnabled(false);
                st.mesh = mesh;
            }
            this.stars.push(st);
        }
    },

    /** Выбросить n предметов (монеты или руда) из точки: полетят дугой, потом притянутся к герою. */
    drop(kind, x, y, coins, n) {
        const count = Math.max(1, Math.min(10, n || 1));
        const url = kind === 'ore' ? 'assets/models/game/ore.glb' : 'assets/models/game/coin.glb';
        Model3D.load(url).then((model) => {
            for (let i = 0; i < count; i++) {
                if (this.drops.length > 36) break;
                const mesh = this.spawnNow(model, 'drop', 'actor');
                const a = Math.random() * 6.28, sp = 120 + Math.random() * 190;
                const d = { kind, mesh, x, y, h: this.ground(x, y) + 40, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vh: 330 + Math.random() * 160, t: 0, coins: coins / count, state: 0 };
                mesh.position.set(x, d.h, y);
                this.drops.push(d);
            }
        }).catch(() => { if (this.hooks.onDrop) this.hooks.onDrop(kind, coins, x, y); });
    },

    /** Находка кодекса: светящийся самоцвет цвета редкости вылетает из земли (tier 0..5 — чем выше, тем крупнее и с лучом). */
    dropFind(id, color, tier, x, y) {
        if (this.drops.length > 40) { if (this.hooks.onFind) this.hooks.onFind(id, x, y); return; }
        const scene = this.app.location.view.scene, t = Math.max(0, tier | 0);
        const c = BABYLON.Color3.FromHexString(/^#[0-9a-f]{6}$/i.test(String(color)) ? color : '#b8c0cc');
        const mat = new BABYLON.StandardMaterial('find-mat', scene);
        mat.diffuseColor = c; mat.emissiveColor = c.scale(0.75); mat.specularColor = new BABYLON.Color3(1, 1, 1); mat.specularPower = 40;
        mat.metadata = { toon: false };
        const mesh = BABYLON.MeshBuilder.CreatePolyhedron('find', { type: t >= 4 ? 3 : t >= 2 ? 1 : 2, size: 15 + t * 3.5 }, scene);
        mesh.material = mat; mesh.isPickable = false;
        World3D.addObject(this.app.location.view, mesh, 'actor');
        this.owned.push(mesh);
        if (t >= 2) {
            // луч света над редкой находкой
            const bm = new BABYLON.StandardMaterial('find-beam', scene);
            bm.diffuseColor = c; bm.emissiveColor = c; bm.disableLighting = true; bm.alpha = 0.3; bm.backFaceCulling = false; bm.metadata = { toon: false };
            const beam = BABYLON.MeshBuilder.CreateCylinder('find-beam', { height: 380 + t * 60, diameterTop: 4, diameterBottom: 30 + t * 6, tessellation: 10, cap: BABYLON.Mesh.NO_CAP }, scene);
            beam.material = bm; beam.parent = mesh; beam.position.y = 190 + t * 30; beam.isPickable = false;
        }
        const a = Math.random() * 6.28, sp = 90 + Math.random() * 120;
        const d = { kind: 'find', find: id, mesh, x, y, h: this.ground(x, y) + 30, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vh: 380 + t * 30, t: 0, coins: 0, state: 0, own: true };
        mesh.position.set(x, d.h, y);
        this.drops.push(d);
    },

    /** Красный круг на земле на sec секунд (метеорит, удар босса): заполняется к моменту удара. */
    warn(x, y, r, sec) {
        const scene = this.app.location.view.scene;
        const mat = new BABYLON.StandardMaterial('warn-mat', scene);
        mat.diffuseColor = new BABYLON.Color3(1, 0.16, 0.12);
        mat.emissiveColor = new BABYLON.Color3(1, 0.16, 0.12);
        mat.disableLighting = true; mat.alpha = 0.34; mat.metadata = { toon: false };
        mat.zOffset = -4;
        const gh = this.ground(x, y);
        const ring = BABYLON.MeshBuilder.CreateTorus('warn-ring', { diameter: r * 2, thickness: 10, tessellation: 36 }, scene);
        ring.material = mat; ring.position.set(x, gh + 8, y); ring.isPickable = false; ring.scaling.y = 0.3;
        const fillMat = mat.clone('warn-fill'); fillMat.alpha = 0.26;
        const fill = BABYLON.MeshBuilder.CreateDisc('warn-fill', { radius: r, tessellation: 36 }, scene);
        fill.material = fillMat; fill.rotation.x = Math.PI / 2; fill.position.set(x, gh + 7, y); fill.isPickable = false;
        fill.scaling.setAll(0.05);
        const w = { ring, fill, mat, fillMat, t: 0, sec: Math.max(0.2, sec) };
        this.warns.push(w);
        return w;
    },

    // ---------------------------------------------------------------------------------------------
    // Кадр
    // ---------------------------------------------------------------------------------------------

    /** tool: { on, x, y, radius, power } — круг уборки героя и уровень мощности. */
    update(dt, hero, tool) {
        this.t += dt;
        if (this.earth) this.earth.rotation.y += dt * 0.012;
        if (this.stars3d) this.stars3d.rotation.y += dt * 0.0012;
        const hx = hero.x, hy = hero.y, hh = hero.h;
        // площадки
        for (const p of this.pads) {
            const d = Math.hypot(hx - p.x, hy - p.y);
            const inside = p.enabled && d < p.r && hh - p.h < 90 && !hero.down;
            if (inside !== p.inside) { p.inside = inside; if (this.hooks.onPad) this.hooks.onPad(p.kind, inside); if (inside) p.pulse = 1; }
            p.pulse = Math.max(0, p.pulse - dt * 2.5);
            const s = 1 + 0.04 * Math.sin(this.t * 3 + p.x) + p.pulse * 0.12;
            p.rim.scaling.set(s, 1, s);
            p.beam.rotation.y += dt * 0.4;
        }
        // мусор
        this.heavyT = Math.max(0, this.heavyT - dt);
        const reach = tool.radius + 46;
        for (let i = this.junk.length - 1; i >= 0; i--) {
            const j = this.junk[i];
            if (j.state === 0) {
                j.mesh.rotation.y += dt * 0.35;
                j.mesh.position.y = j.y0 + 5 + Math.sin(this.t * 1.7 + j.phase) * 4;
                if (!tool.on) continue;
                if (Math.hypot(j.x - tool.x, j.y - tool.y) > reach) continue;
                if (tool.power < j.info.power) {
                    if (this.heavyT <= 0 && this.hooks.onHeavy) { this.heavyT = 3.5; this.hooks.onHeavy(j); }
                    j.mesh.rotation.z = Math.sin(this.t * 30) * 0.07;     // дрожит, но не поддаётся
                    continue;
                }
                j.state = 1; j.t = 0;
                j.sx = j.mesh.position.x; j.sy = j.mesh.position.y; j.sz = j.mesh.position.z;
            } else {
                j.t += dt / 0.34;
                const n = hero.nozzle(this._nz), k = Math.min(1, j.t), e = k * k;
                j.mesh.position.set(j.sx + (n[0] - j.sx) * e, j.sy + (n[1] - j.sy) * e + Math.sin(k * Math.PI) * 46, j.sz + (n[2] - j.sz) * e);
                j.mesh.scaling.setAll(j.s0 * (1 - 0.88 * e));
                j.mesh.rotation.y += dt * 16; j.mesh.rotation.x += dt * 11;
                if (j.t >= 1) {
                    this.junk.splice(i, 1);
                    try { this.app.location.removeObject(j.rec); } catch (err) { j.mesh.setEnabled(false); }
                    if (this.hooks.onJunk) this.hooks.onJunk(j);
                }
            }
        }
        // спрятанные звёзды
        for (const s of this.stars) {
            if (s.state === 3 || !s.mesh) continue;
            if (s.state === 0) {
                s.t -= dt;
                if (s.t <= 0) { s.t = 0.25; if (Math.hypot(hx - s.x, hy - s.y) < 900 && GameDirt.clearAt(s.x, s.y, 90) > 0.8) { s.state = 1; s.t = 0; s.mesh.setEnabled(true); if (this.hooks.onStarShow) this.hooks.onStarShow(s); } }
            } else {
                s.t += dt;
                const k = Math.min(1, s.t / 0.55), up = 1 - Math.pow(1 - k, 3);
                const sc = k < 1 ? 0.3 + up * 0.9 + Math.sin(k * Math.PI) * 0.35 : 1.2 + Math.sin(this.t * 4) * 0.06;
                s.mesh.scaling.setAll(sc);
                s.mesh.position.y = s.h - 60 + up * 150 + (k >= 1 ? Math.sin(this.t * 2.2) * 9 : 0);
                s.mesh.rotation.y += dt * 2.4;
                if (s.state === 1 && k >= 1) s.state = 2;
                if (s.state === 2 && Math.hypot(hx - s.x, hy - s.y) < 125 && Math.abs(hh - s.h) < 260) {
                    s.state = 3; s.mesh.setEnabled(false);
                    if (this.hooks.onStar) this.hooks.onStar(s);
                }
            }
        }
        // выпавшие монеты и руда
        for (let i = this.drops.length - 1; i >= 0; i--) {
            const d = this.drops[i];
            d.t += dt;
            if (d.state === 0) {
                d.vh -= 900 * dt;
                d.x += d.vx * dt; d.y += d.vy * dt; d.h += d.vh * dt;
                const gh = this.ground(d.x, d.y) + 26;
                if (d.h <= gh) { d.h = gh; if (d.vh < -120) { d.vh = -d.vh * 0.42; d.vx *= 0.55; d.vy *= 0.55; } else { d.vh = 0; d.vx = 0; d.vy = 0; if (d.t > 0.45) d.state = 1; } }
            }
            const dist = Math.hypot(hx - d.x, hy - d.y);
            if (d.state >= 1 && (dist < 330 || d.t > 9)) d.state = 2;
            if (d.state === 2) {
                const k = Math.min(1, dt * 9);
                d.x += (hx - d.x) * k; d.y += (hy - d.y) * k; d.h += (hh + 90 - d.h) * k;
                if (dist < 46) {
                    this.drops.splice(i, 1);
                    if (d.own) {
                        const k = this.owned.indexOf(d.mesh);
                        if (k >= 0) this.owned.splice(k, 1);
                        try { World3D.removeObject(this.app.location.view, d.mesh); d.mesh.dispose(false, true); } catch (e) { /* уже */ }
                    } else this.remove(d.mesh);
                    if (d.kind === 'find') { if (this.hooks.onFind) this.hooks.onFind(d.find, d.x, d.y); }
                    else if (this.hooks.onDrop) this.hooks.onDrop(d.kind, d.coins, d.x, d.y);
                    continue;
                }
            }
            d.mesh.position.set(d.x, d.h, d.y);
            d.mesh.rotation.y += dt * 5;
        }
        // предупреждающие круги
        for (let i = this.warns.length - 1; i >= 0; i--) {
            const w = this.warns[i];
            w.t += dt;
            const k = Math.min(1, w.t / w.sec);
            w.fill.scaling.setAll(Math.max(0.05, k));
            w.mat.alpha = 0.3 + 0.3 * Math.abs(Math.sin(w.t * (6 + k * 10)));
            if (w.t >= w.sec + 0.05) {
                this.warns.splice(i, 1);
                w.ring.dispose(); w.fill.dispose(); w.mat.dispose(); w.fillMat.dispose();
            }
        }
    },
    _nz: [0, 0, 0],

    /** Подписи над станциями — каждый кадр, в том числе на паузе (камера могла сдвинуться). */
    frame() {
        if (!this.app || !this.labels.length) return;
        const view = this.app.location.view, cam = view.camera.position;
        for (const l of this.labels) {
            const p = view.projectToScreen(l.x, l.y, l.h);
            const dist = Math.hypot(cam.x - l.x, cam.z - l.y);
            // закрытая площадка взлёта подписана только вблизи: издалека надпись «сначала уборка» лишь мешает
            const near = !l.pad || l.pad.enabled || Math.hypot(GameHero.x - l.x, GameHero.y - l.y) < 520;
            const on = p && !p.behind && p.visible && dist < 3600 && near;
            if (!on) { if (l.shown) { l.shown = false; l.el.style.opacity = '0'; } continue; }
            if (!l.shown) { l.shown = true; l.el.style.opacity = '1'; }
            const sc = Math.max(0.55, Math.min(1.25, 900 / Math.max(300, dist)));
            l.el.style.transform = 'translate(' + (typeof ViewCap !== 'undefined' && ViewCap.x ? ViewCap.x(p.x) : p.x).toFixed(1) + 'px,' + p.y.toFixed(1) + 'px) translate(-50%,-100%) scale(' + sc.toFixed(3) + ')';
        }
    },

    // ---------------------------------------------------------------------------------------------
    // Ракета
    // ---------------------------------------------------------------------------------------------

    /** Взлёт ракеты (~2.6 с): done() — в конце. Нет ракеты на карте — сразу done. */
    launchRocket(done) {
        const r = this.rocket;
        if (!r || !r.mesh) { done(); return; }
        if (r.flame) r.flame.setEnabled(true);
        r.fly = { t: 0, done };
    },

    /** Кадр ролика взлёта: зовётся из app.onFrame (игра на «паузе ролика»). Возвращает точку ракеты для камеры. */
    rocketFrame(dt) {
        const r = this.rocket;
        if (!r || !r.fly) return null;
        const f = r.fly;
        f.t += dt;
        const k = Math.max(0, f.t - 0.7);
        const lift = k * k * 950;
        const shake = Math.min(1, f.t / 0.7) * 3;
        r.mesh.position.y = r.baseY + lift;
        r.mesh.position.x = r.def.x + (Math.random() - 0.5) * shake;
        r.mesh.position.z = r.def.y + (Math.random() - 0.5) * shake;
        if (r.flame) r.flame.scaling.y = 0.8 + Math.random() * 0.7 + Math.min(1.5, k * 2);
        if (f.t >= 2.6) { const cb = f.done; r.fly = null; cb(); }
        return { x: r.def.x, y: r.def.y, h: r.mesh.position.y, t: f.t };
    },
};
