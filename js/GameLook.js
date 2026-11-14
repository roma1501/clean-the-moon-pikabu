// GameLook.js — косметика на герое Clean the Moon: костюм (цвета, лицо, волосы, детали), шлем (стекло, детали), ранец (оттенок,
// детали), след (частицы), спутник (летит за героем) и поток пылесоса (цвет струи + подсветка сопла). Данные — GameShopData.js.
//
//   GameLook.init(app)               один раз
//   GameLook.apply(Shop.look())      после создания героя на каждом секторе и при каждом equip / unequip / preview; идемпотентно
//   GameLook.update(dt, { hero, state })   каждый кадр вне паузы (след, спутник, искры сопла)
//   GameLook.frame(dt)               каждый кадр всегда (и на паузе — примерка в магазине): анимации деталей, цвет потока
//   GameLook.dispose()               перед сменой сектора / удалением героя
//   GameLook.streamColor             0xRRGGBB | null — цвет потока для эффектов всасывания (обновляется каждый кадр)
//   GameLook.sprite(name)            белый спрайт 64×64 (canvas) для частиц и превью магазина
//
// Навесные детали — примитивы Babylon, слитые в 1–2 меша на группу (цвета в вершинах; светящиеся — отдельным мешем с emissive),
// родитель — часть тела, регистрация World3D.addObject. Спутник и частицы — мировые объекты. Ранец и пылесос грузятся асинхронно:
// их корни проверяются каждый кадр, детали на них переустанавливаются.

/** @type {any} */
const GL = {
    app: null, scene: null, view: null, items: /** @type {Map<string, any>} */ (new Map()),
    want: null, model: null, cur: /** @type {Record<string, string>} */ ({}),
    t: 0, ticked: false, ctx: null,
    att: /** @type {Record<string, any[]>} */ ({}),     // слот -> группы деталей на теле
    fx: /** @type {Record<string, any[]>} */ ({}),      // слот -> частицы { h, l, at }
    pet: /** @type {any} */ (null),
    mats: /** @type {any} */ (null),                    // свои материалы костюма: glove, boot
    tankRoot: null, tankBody: null, tankOrig: null, tankMat: null,
    toolRoot: null, rim: /** @type {any} */ (null), jet: /** @type {any} */ (null),
    sprites: /** @type {Record<string, any>} */ ({}), urls: /** @type {Record<string, string>} */ ({}),
    obs: /** @type {any} */ (null), suitItem: /** @type {any} */ (null), streamItem: /** @type {any} */ (null), packItem: /** @type {any} */ (null),
};

const GL_SLOTS = ['suit', 'helmet', 'pack', 'trail', 'pet', 'stream'];
const GL_AXIS = /** @type {Record<string, string>} */ ({ x: 'x', y: 'y', z: 'z' });

/** @satisfies {Record<string, any>} */
const GameLook = {
    streamColor: /** @type {number | null} */ (null),

    init(app) {
        GL.app = app;
        GL.items = new Map();
        if (typeof SHOP_ITEMS !== 'undefined') for (const it of SHOP_ITEMS) GL.items.set(it.id, it);
    },

    /** look = { слот: id } (Shop.look()). Герой может не существовать — тогда запомнить и применить позже. */
    apply(look) {
        GL.want = look || {};
        const H = GameHero;
        if (!GL.app || !H.ch || !H.model || !H.app || !H.app.location) return;
        if (GL.model !== H.model) { this._forget(); GL.model = H.model; GL.view = H.app.location.view; GL.scene = GL.view.scene; GL.cur = {}; }
        this._hookParticles();
        for (const slot of GL_SLOTS) {
            const id = GL.want[slot] || '';
            if (GL.cur[slot] === id) continue;
            GL.cur[slot] = id;
            try { this._set(slot, GL.items.get(id) || null); } catch (e) { console.warn('GameLook ' + slot + ':', e); }
        }
    },

    update(dt, ctx) {
        GL.ctx = ctx || null;
        GL.ticked = true;
        this._motion(Math.min(dt, 0.1));
    },

    frame(dt) {
        dt = Math.min(dt || 0, 0.1);
        const H = GameHero;
        if (GL.model && GL.model !== H.model) { this.dispose(); }
        if (!GL.model && GL.want && H.ch && H.model) this.apply(GL.want);
        if (!GL.model) { GL.ticked = false; return; }
        GL.t += dt;
        this._syncRoots();
        this._animate();
        this._suitCycle();
        this._streamTick();
        if (!GL.ticked) this._motion(dt);
        GL.ticked = false;
    },

    dispose() {
        this._forget();
        if (GL.obs && GL.scene) { try { GL.scene.onBeforeRenderObservable.remove(GL.obs); } catch (e) { /* уже */ } }
        GL.obs = null;
        GL.model = null; GL.cur = {}; GL.view = null; GL.scene = null;
        this.streamColor = null;
        for (const k of Object.keys(GL.mats || {})) { try { GL.mats[k].dispose(); } catch (e) { /* уже */ } }
        GL.mats = null;
    },

    /** Белый спрайт частицы 64×64 (canvas) по имени: dot spark star heart note flake flame leaf bolt square bubble petal coin cloud comet. */
    sprite(name) {
        if (GL.sprites[name]) return GL.sprites[name];
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        glDrawSprite(c.getContext('2d'), name);
        GL.sprites[name] = c;
        return c;
    },

    /** Данные URL спрайта (для текстуры частиц). */
    spriteUrl(name) {
        return GL.urls[name] || (GL.urls[name] = this.sprite(name).toDataURL('image/png'));
    },

    /** HSV -> 0xRRGGBB (h 0..1). Общий помощник: превью и поток. */
    hsv(h, s, v) {
        const c = BABYLON.Color3.FromHSV(((h % 1) + 1) % 1 * 360, s, v);
        return (Math.round(c.r * 255) << 16) | (Math.round(c.g * 255) << 8) | Math.round(c.b * 255);
    },

    // ---------------------------------------------------------------------------------------------
    // Установка по слотам
    // ---------------------------------------------------------------------------------------------

    /**
     * Примерка в магазине идёт на паузе игры, а ParticleFX на паузе обнуляет скорость систем в конце кадра (fx.update, после frame):
     * свою скорость возвращаем перед отрисовкой, пока окно магазина открыто.
     */
    _hookParticles() {
        if (GL.obs || !GL.scene) return;
        GL.obs = GL.scene.onBeforeRenderObservable.add(() => {
            if (!shopOpen()) return;
            const v = 1 / 60;
            for (const slot of Object.keys(GL.fx)) for (const f of GL.fx[slot]) if (f.h && f.h.system) f.h.system.updateSpeed = v;
            if (GL.pet) for (const f of GL.pet.fx) if (f.h && f.h.system) f.h.system.updateSpeed = v;
            if (GL.rim && GL.rim.spark && GL.rim.spark.system) GL.rim.spark.system.updateSpeed = v;
        });
    },

    /** Снять всё, что навесили (без возврата цветов: герой уничтожается или вид переставится заново). */
    _forget() {
        for (const slot of Object.keys(GL.att)) this._dropAtt(slot);
        for (const slot of Object.keys(GL.fx)) this._dropFx(slot);
        this._dropPet();
        this._dropStream();
        GL.att = {}; GL.fx = {};
        GL.tankRoot = null; GL.toolRoot = null; GL.suitItem = null; GL.streamItem = null; GL.packItem = null;
        if (GL.tankMat) { try { GL.tankMat.dispose(); } catch (e) { /* уже */ } GL.tankMat = null; }
    },

    _set(slot, item) {
        if (slot === 'suit') this._setSuit(item);
        else if (slot === 'helmet') this._setHelmet(item);
        else if (slot === 'pack') this._setPack(item);
        else if (slot === 'trail') this._setTrail(item);
        else if (slot === 'pet') this._setPet(item);
        else if (slot === 'stream') this._setStream(item);
    },

    _setSuit(item) {
        const m = GameHero.model;
        if (!m) return;
        this._dropAtt('suit'); this._dropFx('suit');
        const it = item || GL.items.get('suit_default') || {};
        GL.suitItem = it;
        const mats = glMats(m);
        glPaint(m.mats.skin, it.skin != null ? it.skin : 0xffd9b0, 0.16);
        glPaint(m.mats.top, it.top != null ? it.top : 0x2f6fd6, 0.16);
        glPaint(m.mats.bottom, it.bottom != null ? it.bottom : 0x2a3550, 0.16);
        glPaint(mats.glove, it.glove != null ? it.glove : 0xf2f5ff, 0.16);
        glPaint(mats.boot, it.boot != null ? it.boot : (it.glove != null ? it.glove : 0xf2f5ff), 0.16);
        if (m.mats.white) glPaint(m.mats.white, it.collar != null ? it.collar : (it.glove != null ? it.glove : 0xf2f5ff), 0.16);
        for (const n of ['HandL', 'HandR']) { const p = m.part(n); if (p) p.material = mats.glove; }
        for (const n of ['FootL', 'FootR']) { const p = m.part(n); if (p) p.material = mats.boot; }
        // волосы: цвет или скрыты (null)
        const hair = GameHero.hair;
        if (hair) {
            if (it.hair === null) hair.setEnabled(false);
            else { hair.setEnabled(true); if (hair.material) glPaint(hair.material, it.hair != null ? it.hair : GameHero.HAIR, 0.16); }
        }
        // лицо: перерисовка наклейки
        const fm = m.face && m.face.material;
        const tex = fm && fm.diffuseTexture;
        if (tex && tex.getContext) {
            const ctx = tex.getContext();
            const paint = it.face || ((c, w, h) => GameHero.paintFace(c, w, h));
            try { paint(ctx, 256, 144); } catch (e) { console.warn('GameLook face:', e); }
            tex.update(true);
        }
        if (it.parts) GL.att.suit = glBuild(it.parts, (on) => m.part(on || 'UpperTorso'), 'suit');
        if (it.aura) this._addFx('suit', [it.aura]);
        this._suitCycle(true);
    },

    _setHelmet(item) {
        const m = GameHero.model;
        if (!m) return;
        this._dropAtt('helmet'); this._dropFx('helmet');
        const gl = GameHero.helmet && GameHero.helmet.material;
        const it = item || {};
        if (gl) {
            if (it.glass != null) { gl.diffuseColor = Humanoid.color3(it.glass); gl.emissiveColor = gl.diffuseColor.scale(0.32); }
            else { gl.diffuseColor = new BABYLON.Color3(0.72, 0.9, 1); gl.emissiveColor = new BABYLON.Color3(0.25, 0.34, 0.42); }
            gl.alpha = it.alpha != null ? it.alpha : 0.2;
        }
        if (it.parts) GL.att.helmet = glBuild(it.parts, (on) => m.part(on || 'Head'), 'helmet');
        if (it.fx) this._addFx('helmet', [it.fx]);
    },

    _setPack(item) {
        const m = GameHero.model;
        if (!m) return;
        this._dropAtt('pack'); this._dropFx('pack');
        const it = item || {};
        GL.packItem = it;
        this._tint();
        if (it.parts) GL.att.pack = glBuild(it.parts, (on) => m.part(on || 'UpperTorso'), 'pack');
        if (it.fx) this._addFx('pack', [it.fx]);
    },

    /** Оттенок бака ранца: копия материала с diffuseColor (множитель к цветам вершин модели). */
    _tint() {
        const root = GameHero.tank && GameHero.tank.root;
        GL.tankRoot = root || null;
        if (!root) return;
        const body = root.getChildMeshes(false).find((/** @type {any} */ k) => /Body$/.test(k.name));
        if (!body) return;
        if (GL.tankBody !== body) { GL.tankBody = body; GL.tankOrig = body.material; if (GL.tankMat) { try { GL.tankMat.dispose(); } catch (e) { /* уже */ } GL.tankMat = null; } }
        const it = GL.packItem || {};
        if (it.tank == null) { if (GL.tankOrig) body.material = GL.tankOrig; return; }
        if (!GL.tankMat && GL.tankOrig) GL.tankMat = GL.tankOrig.clone('gs-tank');
        if (GL.tankMat) {
            GL.tankMat.diffuseColor = Humanoid.color3(it.tank);
            GL.tankMat.emissiveColor = GL.tankMat.diffuseColor.scale(0.12);
            body.material = GL.tankMat;
        }
    },

    _setTrail(item) {
        this._dropFx('trail');
        if (item && item.fx) this._addFx('trail', Array.isArray(item.fx) ? item.fx : [item.fx]);
    },

    _setPet(item) {
        this._dropPet();
        if (!item || !item.parts || !GL.view) return;
        const root = new BABYLON.Mesh('gs-pet', GL.scene);
        const groups = glBuild(item.parts, () => root, 'pet', true);
        root.scaling.setAll(item.scale || 1);
        World3D.addObject(GL.view, root, 'actor');
        // стеклянные/светящиеся меши регистрировать не нужно: в glBuild они вне слоя обводки, но дети root уже учтены
        GL.pet = { item, root, groups, x: 0, z: 0, y: 0, yaw: 0, init: false, fx: [], vx: 0, vz: 0 };
        if (item.fx) for (const l of [item.fx]) { const h = glFx(l); if (h) GL.pet.fx.push({ h, l }); }
    },

    _setStream(item) {
        this._dropStream();
        GL.streamItem = item || null;
        this._streamRoots(true);
    },

    // ---------------------------------------------------------------------------------------------
    // Снятие
    // ---------------------------------------------------------------------------------------------

    _dropAtt(slot) {
        const list = GL.att[slot];
        if (!list) return;
        for (const g of list) glDropGroup(g);
        delete GL.att[slot];
    },

    _dropFx(slot) {
        const list = GL.fx[slot];
        if (!list) return;
        for (const f of list) { try { f.h.dispose(); } catch (e) { /* уже */ } }
        delete GL.fx[slot];
    },

    _dropPet() {
        const p = GL.pet;
        if (!p) return;
        try { if (GL.view) World3D.removeObject(GL.view, p.root); else p.root.dispose(); } catch (e) { /* уже */ }
        for (const g of p.groups) glDropGroup(g);
        for (const f of p.fx) { try { f.h.dispose(); } catch (e) { /* уже */ } }
        GL.pet = null;
    },

    _dropStream() {
        const r = GL.rim;
        if (r) {
            for (const k of ['ring', 'cone']) if (r[k]) { try { r[k].dispose(); } catch (e) { /* уже */ } }
            for (const k of ['ringMat', 'coneMat']) if (r[k]) { try { r[k].dispose(); } catch (e) { /* уже */ } }
            if (r.spark) { try { r.spark.dispose(); } catch (e) { /* уже */ } }
        }
        GL.rim = null; GL.toolRoot = null;
        this.streamColor = null;
    },

    _addFx(slot, layers) {
        const list = GL.fx[slot] || (GL.fx[slot] = []);
        for (const l of layers) { const h = glFx(l); if (h) list.push({ h, l }); }
    },

    // ---------------------------------------------------------------------------------------------
    // Каждый кадр
    // ---------------------------------------------------------------------------------------------

    /** Ранец и пылесос грузятся асинхронно и меняются при апгрейде: перевесить оттенок бака и кольцо сопла. */
    _syncRoots() {
        const H = GameHero;
        const tr = H.tank && H.tank.root || null;
        if (tr !== GL.tankRoot) this._tint();
        const tl = H.tool && H.tool.root || null;
        if (tl !== GL.toolRoot) { this._dropRim(); this._streamRoots(false); }
    },

    _dropRim() {
        const r = GL.rim;
        if (!r) return;
        for (const k of ['ring', 'cone']) if (r[k]) { try { r[k].dispose(); } catch (e) { /* уже */ } r[k] = null; }
    },

    _streamRoots(fresh) {
        const H = GameHero, it = GL.streamItem;
        GL.toolRoot = H.tool && H.tool.root || null;
        if (!it || !GL.scene) return;
        const has = it.color != null || it.cycle || it.rainbow;
        if (!has) { this.streamColor = null; return; }
        if (!GL.rim || fresh) GL.rim = { ring: null, cone: null, ringMat: null, coneMat: null, spark: null };
        const r = GL.rim;
        if (!GL.toolRoot) return;
        const scene = GL.scene, tip = H.tool.tip || [80, 15, 0];
        if (!r.ringMat) { r.ringMat = glGlowMat('gs-rim'); r.coneMat = glGlowMat('gs-jet'); r.coneMat.alpha = 0.34; }
        const ring = BABYLON.MeshBuilder.CreateTorus('gs-rim', { diameter: 30, thickness: 5, tessellation: 20 }, scene);
        ring.material = r.ringMat; ring.parent = GL.toolRoot; ring.position.set(tip[0], tip[1], 0); ring.rotation.z = Math.PI / 2;
        ring.isPickable = false; ring.metadata = {};
        const cone = BABYLON.MeshBuilder.CreateCylinder('gs-jet', { diameterTop: 70, diameterBottom: 18, height: 120, tessellation: 14, cap: BABYLON.Mesh.NO_CAP }, scene);
        cone.material = r.coneMat; cone.parent = GL.toolRoot; cone.position.set(tip[0] + 60, tip[1], 0); cone.rotation.z = -Math.PI / 2;
        cone.isPickable = false; cone.metadata = {}; cone.setEnabled(false);
        r.ring = ring; r.cone = cone;
        if (it.sparks && !r.spark) r.spark = glFx({ ...it.sparks, rate: it.sparks.rate }, true);
    },

    _animate() {
        const t = GL.t;
        for (const slot of Object.keys(GL.att)) for (const g of GL.att[slot]) glAnim(g, t);
        if (GL.pet) for (const g of GL.pet.groups) glAnim(g, t);
    },

    /** Радужные/циклические костюмы и пульс свечения. */
    _suitCycle(force) {
        const it = GL.suitItem, m = GameHero.model;
        if (!it || !m || !GL.mats) return;
        const t = GL.t;
        if (!force && !it.cycle && !it.pulse) return;
        const glow = (it.glow != null ? it.glow : 0.16) + (it.pulse ? Math.sin(t * 3) * it.pulse : 0);
        if (it.cycle === 'rainbow') {
            const h = t * 0.18;
            glPaint(m.mats.top, this.hsv(h, 0.55, 1), glow);
            glPaint(m.mats.bottom, this.hsv(h + 0.5, 0.55, 0.95), glow);
            glPaint(GL.mats.glove, this.hsv(h + 0.25, 0.4, 1), glow);
            glPaint(m.mats.skin, this.hsv(h + 0.08, 0.12, 1), glow);
            if (GameHero.hair && GameHero.hair.material) glPaint(GameHero.hair.material, this.hsv(h + 0.75, 0.6, 1), glow);
        } else if (Array.isArray(it.cycle)) {
            glPaint(m.mats.top, glLerpPalette(it.cycle, t * 0.35), glow);
            glPaint(m.mats.bottom, it.bottom, glow);
        } else {
            glPaint(m.mats.top, it.top, glow); glPaint(m.mats.bottom, it.bottom, glow); glPaint(m.mats.skin, it.skin, glow);
            glPaint(GL.mats.glove, it.glove, glow); glPaint(GL.mats.boot, it.boot != null ? it.boot : it.glove, glow);
        }
    },

    /** Цвет потока (читают эффекты), кольцо и конус сопла. */
    _streamTick() {
        const it = GL.streamItem, r = GL.rim;
        if (!it || !(it.color != null || it.cycle || it.rainbow)) { this.streamColor = null; return; }
        const t = GL.t;
        let col;
        if (it.rainbow) col = this.hsv(t * it.rainbow, 0.85, 1);
        else if (it.cycle) col = glLerpPalette(it.cycle, t * (it.speed || 0.6));
        else col = it.color;
        this.streamColor = col;
        if (!r) return;
        const k = 1 + (it.pulse ? Math.sin(t * 6) * it.pulse : 0);
        const rimCol = it.rim != null && !(it.cycle || it.rainbow) ? it.rim : col;
        if (r.ringMat) r.ringMat.emissiveColor = Humanoid.color3(rimCol).scale(Math.min(1, k));
        if (r.coneMat) r.coneMat.emissiveColor = Humanoid.color3(col).scale(Math.min(1, k));
        if (r.cone) r.cone.setEnabled(shopOpen());
    },

    /** Движение: след за героем, частицы-ауры, искры сопла, спутник. */
    _motion(dt) {
        const H = GameHero;
        if (!H.ch) return;
        const shop = shopOpen();
        const a = H.heading, c = Math.cos(a), s = Math.sin(a);
        const v = H.vel, sp = Math.hypot(v[0], v[2]);
        const hx = H.x, hz = H.y, hy = H.h;
        const at = (/** @type {any} */ off, /** @type {number} */ ox, /** @type {number} */ oy, /** @type {number} */ oz, /** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ z, /** @type {number} */ yaw) => {
            const cc = Math.cos(yaw), ss = Math.sin(yaw);
            off[0] = x + cc * ox - ss * oz; off[1] = y + oy; off[2] = z + ss * ox + cc * oz;
            return off;
        };
        const p = [0, 0, 0];
        // след
        for (const f of GL.fx.trail || []) {
            const moving = sp > 50 && H.grounded;
            const k = shop ? 0.7 : moving ? Math.max(0.35, Math.min(1.3, sp / 380)) : 0;
            f.h.setRate(f.l.rate * k);
            f.h.setPosition(at(p, -10, 8, 0, hx, hy, hz, a));
        }
        // ауры костюма, шлема и ранца
        for (const slot of ['suit', 'helmet', 'pack']) for (const f of GL.fx[slot] || []) {
            const o = f.l.at;
            if (o === 'back') f.h.setPosition(at(p, -44, 95, 0, hx, hy, hz, a));
            else if (Array.isArray(o)) f.h.setPosition(at(p, o[0], o[1], o[2], hx, hy, hz, a));
            else f.h.setPosition([hx, hy, hz]);
        }
        // искры сопла
        const r = GL.rim;
        if (r && r.spark) {
            const w = shop ? 1 : (H.working || 0);
            r.spark.setRate((GL.streamItem && GL.streamItem.sparks ? GL.streamItem.sparks.rate : 0) * (w > 0.5 ? 1 : 0));
            const n = H.nozzle(this._n || (this._n = [0, 0, 0]));
            r.spark.setPosition(n);
        }
        if (GL.pet) this._petTick(dt, shop, a, hx, hz, hy);
    },

    _n: /** @type {any} */ (null),

    _petTick(dt, shop, heading, hx, hz, hy) {
        const p = GL.pet, H = GameHero;
        let tx, tz;
        if (shop && GL.scene && GL.scene.activeCamera) {
            const cam = GL.scene.activeCamera;
            const right = cam.getDirection(BABYLON.Axis.X);
            const rl = Math.hypot(right.x, right.z) || 1;
            const dx = cam.position.x - hx, dz = cam.position.z - hz, dl = Math.hypot(dx, dz) || 1;
            tx = hx + right.x / rl * 105 + dx / dl * 40; tz = hz + right.z / rl * 105 + dz / dl * 40;
        } else {
            const c = Math.cos(heading), s = Math.sin(heading);
            tx = hx - c * 62 - s * 52; tz = hz - s * 62 + c * 52;
        }
        const ty = hy + (p.item.float || 56);
        if (!p.init || Math.hypot(tx - p.x, tz - p.z) > 720) { p.x = tx; p.z = tz; p.y = ty; p.init = true; }
        const k = 1 - Math.exp(-dt * 3.2);
        const ox = p.x, oz = p.z;
        p.x += (tx - p.x) * k; p.z += (tz - p.z) * k; p.y += (ty - p.y) * Math.min(1, dt * 5);
        const vx = dt > 0 ? (p.x - ox) / dt : 0, vz = dt > 0 ? (p.z - oz) / dt : 0;
        const sp = Math.hypot(vx, vz);
        const want = sp > 40 ? Math.atan2(vz, vx) : heading;
        let da = want - p.yaw; da = Math.atan2(Math.sin(da), Math.cos(da));
        p.yaw += da * Math.min(1, dt * 5);
        const bob = Math.sin(GL.t * 2.4) * 4;
        p.root.position.set(p.x, p.y + bob, p.z);
        p.root.rotation.y = -p.yaw;
        p.root.rotation.z = -Math.min(0.28, sp / 900);
        const pp = [0, 0, 0];
        for (const f of p.fx) {
            const o = f.l.at;
            const cc = Math.cos(p.yaw), ss = Math.sin(p.yaw);
            const ox2 = Array.isArray(o) ? o[0] : 0, oy2 = Array.isArray(o) ? o[1] : 0;
            pp[0] = p.x + cc * ox2; pp[1] = p.y + bob + oy2; pp[2] = p.z + ss * ox2;
            f.h.setPosition(pp);
        }
        void H;
    },
};

// =================================================================================================
// Помощники
// =================================================================================================

function shopOpen() { return typeof GameShopUI !== 'undefined' && !!GameShopUI.isOpen; }

/** Покрасить материал: цвет и самосвечение (доля цвета). */
function glPaint(/** @type {any} */ mat, /** @type {any} */ color, /** @type {number} */ glow) {
    if (!mat || color == null) return;
    mat.diffuseColor = Humanoid.color3(color);
    mat.emissiveColor = mat.diffuseColor.scale(glow);
}

/** Свои материалы перчаток и ботинок (герой делит один белый материал на перчатки, ботинки и воротник). */
function glMats(/** @type {any} */ m) {
    if (GL.mats) return GL.mats;
    const scene = m.view.scene;
    const mk = (/** @type {string} */ name) => {
        const mat = new BABYLON.StandardMaterial(name, scene);
        mat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        mat.diffuseColor = new BABYLON.Color3(0.95, 0.96, 1);
        mat.emissiveColor = mat.diffuseColor.scale(0.16);
        return mat;
    };
    GL.mats = { glove: mk('gs-glove'), boot: mk('gs-boot') };
    return GL.mats;
}

/** Палитра по кругу: t — позиция (целая часть — номер цвета), плавный переход. */
function glLerpPalette(/** @type {number[]} */ pal, /** @type {number} */ t) {
    const n = pal.length, p = ((t % n) + n) % n, i = Math.floor(p), f = p - i, j = (i + 1) % n;
    const a = pal[i], b = pal[j], sm = f * f * (3 - 2 * f);
    const ch = (/** @type {number} */ s) => Math.round(((a >> s) & 255) * (1 - sm) + ((b >> s) & 255) * sm);
    return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

function glGlowMat(/** @type {string} */ name) {
    const m = new BABYLON.StandardMaterial(name, GL.scene);
    m.diffuseColor = new BABYLON.Color3(0, 0, 0);
    m.emissiveColor = new BABYLON.Color3(1, 1, 1);
    m.specularColor = new BABYLON.Color3(0, 0, 0);
    m.disableLighting = true;
    m.metadata = { toon: false };
    return m;
}

function glSolidMat(/** @type {string} */ name) {
    const m = new BABYLON.StandardMaterial(name, GL.scene);
    m.diffuseColor = new BABYLON.Color3(1, 1, 1);
    m.emissiveColor = new BABYLON.Color3(0.16, 0.16, 0.16);
    m.specularColor = new BABYLON.Color3(0.08, 0.08, 0.08);
    return m;
}

/** Один примитив в временный меш с цветом вершин. */
function glShape(/** @type {any} */ s, /** @type {boolean} */ white) {
    const scene = GL.scene, MB = BABYLON.MeshBuilder;
    let m;
    if (s.k === 'box') m = MB.CreateBox('gs', { width: s.s[0], height: s.s[1], depth: s.s[2] }, scene);
    else if (s.k === 'cyl') m = MB.CreateCylinder('gs', { diameterTop: s.s[0], diameterBottom: s.s[1], height: s.s[2], tessellation: s.n || (Math.max(s.s[0], s.s[1]) < 12 ? 7 : 10) }, scene);
    else if (s.k === 'sph') m = MB.CreateSphere('gs', { diameter: s.s[0], segments: s.n || (s.s[0] < 16 ? 6 : 8) }, scene);
    else if (s.k === 'tor') m = MB.CreateTorus('gs', { diameter: s.s[0], thickness: s.s[1], tessellation: s.n || 16 }, scene);
    else m = MB.CreatePolyhedron('gs', { type: s.t != null ? s.t : 1, size: s.s[0] / 2 }, scene);
    m.position.set(s.p[0], s.p[1], s.p[2]);
    if (s.r) m.rotation.set(s.r[0], s.r[1], s.r[2]);
    if (s.sc) m.scaling.set(s.sc[0], s.sc[1], s.sc[2]);
    const pos = m.getVerticesData(BABYLON.VertexBuffer.PositionKind) || [];
    const n = pos.length / 3, col = white ? new BABYLON.Color3(1, 1, 1) : Humanoid.color3(s.c);
    const arr = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { arr[i * 4] = col.r; arr[i * 4 + 1] = col.g; arr[i * 4 + 2] = col.b; arr[i * 4 + 3] = 1; }
    m.setVerticesData(BABYLON.VertexBuffer.ColorKind, arr, false, 4);
    m.isPickable = false;
    return m;
}

function glMerge(/** @type {any[]} */ shapes, /** @type {string} */ name, /** @type {boolean} */ white) {
    if (!shapes.length) return null;
    const meshes = shapes.map((s) => glShape(s, white));
    const merged = BABYLON.Mesh.MergeMeshes(meshes, true, true);
    if (merged) { merged.name = name; merged.isPickable = false; }
    return merged;
}

/**
 * Группы деталей -> узлы на частях тела (parentOf(on) -> меш). Одинаковые (часть, точка, анимация) сливаются в одну группу.
 * Светящиеся фигуры — отдельным мешем с emissive и без освещения.
 */
function glBuild(/** @type {any[]} */ specs, /** @type {(on: string) => any} */ parentOf, /** @type {string} */ tag, inRoot = false) {
    const merged = new Map();
    for (const g of specs) {
        const key = JSON.stringify([g.on, g.at, g.anim]);
        const e = merged.get(key);
        if (e) e.shapes = e.shapes.concat(g.shapes); else merged.set(key, { ...g, shapes: g.shapes.slice() });
    }
    const out = [];
    for (const g of merged.values()) {
        const parent = parentOf(g.on);
        if (!parent) continue;
        const node = new BABYLON.TransformNode('gs-' + tag, GL.scene);
        node.parent = parent;
        const at = g.at || [0, 0, 0];
        node.position.set(at[0], at[1], at[2]);
        const rec = { node, anim: g.anim || null, base: { x: at[0], y: at[1], z: at[2] }, mats: /** @type {any[]} */ ([]), meshes: /** @type {any[]} */ ([]), glowMat: /** @type {any} */ (null), registered: !inRoot };
        const hue = g.anim && g.anim.t === 'hue';
        const solid = glMerge(g.shapes.filter((/** @type {any} */ s) => !s.g), 'gs-' + tag, false);
        const glow = glMerge(g.shapes.filter((/** @type {any} */ s) => s.g), 'gs-' + tag + '-glow', hue);
        if (solid) {
            const mat = glSolidMat('gs-' + tag + '-mat'); solid.material = mat; solid.parent = node;
            rec.mats.push(mat); rec.meshes.push(solid);
            if (!inRoot) World3D.addObject(GL.view, solid, 'actor');
        }
        if (glow) {
            const mat = glGlowMat('gs-' + tag + '-glowmat'); glow.material = mat; glow.parent = node;
            glow.metadata = {};
            rec.mats.push(mat); rec.meshes.push(glow); rec.glowMat = mat;
        }
        out.push(rec);
    }
    return out;
}

function glDropGroup(/** @type {any} */ g) {
    for (const m of g.meshes) {
        try { if (g.registered && !m.isDisposed()) World3D.removeObject(GL.view, m); else m.dispose(false, false); } catch (e) { /* уже */ }
    }
    try { g.node.dispose(); } catch (e) { /* уже */ }
    for (const mat of g.mats) { try { mat.dispose(); } catch (e) { /* уже */ } }
}

/** Анимация группы (время t, с). */
function glAnim(/** @type {any} */ g, /** @type {number} */ t) {
    const a = g.anim;
    if (!a) return;
    const v = a.v != null ? a.v : 1, s = Math.sin(t * v + (a.ph || 0)), n = g.node;
    const ax = GL_AXIS[a.ax || 'y'];
    if (a.t === 'spin') n.rotation[ax] = t * v;
    else if (a.t === 'sway') n.rotation[ax] = s * (a.amp != null ? a.amp : 0.2);
    else if (a.t === 'bob') n.position.y = g.base.y + s * (a.amp != null ? a.amp : 2);
    else if (a.t === 'pulse') n.scaling.setAll(1 + s * (a.amp != null ? a.amp : 0.1));
    else if (a.t === 'squash') { const k = a.amp != null ? a.amp : 0.12; n.scaling.set(1 - s * k * 0.6, 1 + s * k, 1 - s * k * 0.6); }
    else if (a.t === 'hue' && g.glowMat) g.glowMat.emissiveColor = BABYLON.Color3.FromHSV((((t * v + (a.ph || 0)) % 1) + 1) % 1 * 360, 0.75, 1);
    else if (a.t === 'blink') n.setEnabled(s > 0);
}

/** Слой частиц через app.fx: { h } (ParticleFX handle) или null. */
function glFx(/** @type {any} */ l, _spark = false) {
    const fx = GL.app && GL.app.fx;
    if (!fx || !l) return null;
    const grad = l.grad ? l.grad.map((/** @type {any} */ g, /** @type {number} */ i, /** @type {any[]} */ arr) => [g[0], g[1], i === arr.length - 1 ? 0 : 1]) : undefined;
    const h = fx.create({
        name: 'gs-fx', texture: GameLook.spriteUrl(l.tex || 'dot'), position: [0, -9999, 0],
        rate: l.rate, life: l.life, size: l.size, speed: l.speed, gravity: l.gravity, box: l.box,
        direction: l.direction || [[-0.4, 0.2, -0.4], [0.4, 1, 0.4]], spin: l.spin,
        color: l.color, color2: l.color2, alpha: l.alpha, blend: l.blend,
        colorGradient: grad, sizeGradient: l.grow ? [[0, 0.5], [1, 1.7]] : [[0, 0.4], [0.25, 1], [1, 0.1]],
    });
    if (!h) return null;
    try { h.system.start(); } catch (e) { /* уже запущена */ }
    void _spark;
    return h;
}

// =================================================================================================
// Спрайты частиц (белые на прозрачном, 64×64)
// =================================================================================================

function glDrawSprite(/** @type {CanvasRenderingContext2D} */ c, /** @type {string} */ name) {
    c.clearRect(0, 0, 64, 64);
    c.fillStyle = '#fff'; c.strokeStyle = '#fff'; c.lineCap = 'round'; c.lineJoin = 'round';
    const radial = (/** @type {number} */ r, /** @type {number[]} */ stops) => {
        const g = c.createRadialGradient(32, 32, 0, 32, 32, r);
        stops.forEach((a, i) => g.addColorStop(i / (stops.length - 1), 'rgba(255,255,255,' + a + ')'));
        c.fillStyle = g; c.fillRect(0, 0, 64, 64);
        c.fillStyle = '#fff';
    };
    if (name === 'dot') radial(30, [1, 0.7, 0.25, 0]);
    else if (name === 'spark') {
        radial(14, [1, 0.5, 0]);
        c.beginPath(); c.moveTo(32, 3); c.quadraticCurveTo(34, 30, 61, 32); c.quadraticCurveTo(34, 34, 32, 61); c.quadraticCurveTo(30, 34, 3, 32); c.quadraticCurveTo(30, 30, 32, 3); c.fill();
    } else if (name === 'star') {
        radial(26, [0.5, 0.2, 0]);
        c.beginPath();
        for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 11 : 27; c.lineTo(32 + Math.cos(a) * r, 33 + Math.sin(a) * r); }
        c.closePath(); c.fill();
    } else if (name === 'heart') {
        c.beginPath(); c.moveTo(32, 56); c.bezierCurveTo(6, 38, 4, 12, 22, 12); c.bezierCurveTo(28, 12, 32, 17, 32, 22); c.bezierCurveTo(32, 17, 36, 12, 42, 12); c.bezierCurveTo(60, 12, 58, 38, 32, 56); c.fill();
    } else if (name === 'note') {
        c.beginPath(); c.ellipse(22, 48, 11, 8, -0.4, 0, 6.3); c.fill();
        c.lineWidth = 5; c.beginPath(); c.moveTo(31, 46); c.lineTo(31, 10); c.quadraticCurveTo(46, 14, 48, 30); c.stroke();
    } else if (name === 'flake') {
        c.lineWidth = 4;
        for (let i = 0; i < 6; i++) {
            c.save(); c.translate(32, 32); c.rotate(i * Math.PI / 3);
            c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -27); c.moveTo(0, -15); c.lineTo(-8, -23); c.moveTo(0, -15); c.lineTo(8, -23); c.stroke(); c.restore();
        }
    } else if (name === 'flame') {
        const g = c.createRadialGradient(32, 40, 2, 32, 38, 28);
        g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g;
        c.beginPath(); c.moveTo(32, 2); c.bezierCurveTo(40, 20, 58, 28, 52, 46); c.bezierCurveTo(48, 60, 16, 60, 12, 46); c.bezierCurveTo(8, 30, 26, 24, 32, 2); c.fill();
    } else if (name === 'leaf') {
        c.beginPath(); c.moveTo(8, 56); c.bezierCurveTo(4, 22, 30, 6, 58, 6); c.bezierCurveTo(60, 36, 40, 60, 8, 56); c.fill();
        c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 3; c.beginPath(); c.moveTo(10, 54); c.lineTo(46, 20); c.stroke();
    } else if (name === 'bolt') {
        c.beginPath(); c.moveTo(38, 2); c.lineTo(14, 36); c.lineTo(28, 36); c.lineTo(22, 62); c.lineTo(52, 24); c.lineTo(36, 24); c.closePath(); c.fill();
    } else if (name === 'square') {
        c.beginPath(); c.roundRect(10, 16, 44, 32, 4); c.fill();
    } else if (name === 'bubble') {
        c.lineWidth = 4; c.beginPath(); c.arc(32, 32, 26, 0, 6.3); c.stroke();
        const g = c.createRadialGradient(32, 32, 4, 32, 32, 26); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.35)');
        c.fillStyle = g; c.fill();
        c.fillStyle = '#fff'; c.beginPath(); c.ellipse(22, 20, 6, 4, -0.7, 0, 6.3); c.fill();
    } else if (name === 'petal') {
        c.beginPath(); c.moveTo(32, 4); c.bezierCurveTo(60, 20, 56, 52, 32, 60); c.bezierCurveTo(8, 52, 4, 20, 32, 4); c.fill();
        c.strokeStyle = 'rgba(0,0,0,0.2)'; c.lineWidth = 3; c.beginPath(); c.moveTo(32, 10); c.lineTo(32, 54); c.stroke();
    } else if (name === 'coin') {
        c.beginPath(); c.arc(32, 32, 27, 0, 6.3); c.fill();
        c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 4; c.beginPath(); c.arc(32, 32, 19, 0, 6.3); c.stroke();
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(29, 20, 6, 24);
    } else if (name === 'cloud') {
        const g = c.createRadialGradient(32, 34, 2, 32, 34, 30); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.6, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g; for (const [x, y, r] of [[22, 38, 17], [42, 38, 17], [32, 26, 18]]) { c.beginPath(); c.arc(x, y, r, 0, 6.3); c.fill(); }
    } else if (name === 'comet') {
        const g = c.createLinearGradient(2, 32, 60, 32); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,1)');
        c.fillStyle = g; c.beginPath(); c.moveTo(2, 32); c.lineTo(52, 24); c.lineTo(52, 40); c.closePath(); c.fill();
        c.beginPath(); c.arc(52, 32, 9, 0, 6.3); c.fill();
    } else radial(30, [1, 0.5, 0]);
}
