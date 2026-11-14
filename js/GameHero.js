// GameHero.js — герой Clean the Moon: физический блочный человечек движка (HumanoidCharacter: Motion Matching, капсула,
// рэгдолл) в лунной гравитации. Вид — персонаж из «Steal a Dragon Egg» (синяя куртка, тёмные штаны, взъерошенные
// каштановые волосы, улыбка), одетый для Луны: стеклянный шлем, ранец-бак и пылесос в правой руке.
//
//   await GameHero.create(app, { x, y, yaw })       // под экраном загрузки (prepare)
//   GameHero.update(dt, { move, jump, jumpHeld, camYaw, locked })
//   GameHero.setStats({ speed, jet })               // из улучшений
//   await GameHero.setTool(tier)                    // модель пылесоса по уровню мощности
//   GameHero.setTank(frac)                          // заполнение ранца 0..1
//   GameHero.cleanPoint(radius, out)                // центр круга уборки на карте
//   GameHero.nozzle(out)                            // мировая точка сопла [x, y, z] — для эффектов
//   GameHero.knock(vx, vy, vz)                      // сбить с ног (метеорит, босс)

/** @satisfies {Record<string, any>} */
const GameHero = {
    /** @type {any} HumanoidCharacter */ ch: null,
    /** @type {LoryApp | null} */ app: null,
    /** @type {any} */ world: null,
    /** @type {Record<string, Function[]>} */ listeners: {},
    GRAVITY: 560,                     // px/с²: лунная (земная у движка — 1200)
    // Свои числа героя (константы движка MOTION_* / CHAR_* остаются умолчаниями): скорости базы движений и капсулы
    DB: { jog: 360, sprint: 560 },
    PHYSICS: { run: 360, sprint: 560, airControl: 1100, jumpHeight: 170, fallRagdoll: 2400, hitRagdoll: 380 },
    COLORS: { skin: [255, 217, 176], top: [47, 111, 214], bottom: [42, 53, 80] },
    HAIR: 0x7a4a1c,
    speed: 360,
    slow: 1,                          // множитель скорости от грязи под ногами
    jet: { max: 0, fuel: 0, on: false },
    /** @type {{ root: any, tier: number, tip: number[] } | null} */ tool: null,
    /** @type {{ root: any, fill: any } | null} */ tank: null,
    /** @type {any[]} */ extras: [],
    /** @type {any} */ hair: null,        // меш волос (ребёнок головы) — для косметики GameLook
    /** @type {any} */ helmet: null,      // стеклянный шлем (сфера, ребёнок головы)
    /** @type {any} */ collar: null,      // воротник скафандра
    working: 0,                       // 0..1 — пылесос работает (плавно): поза руки и дрожь инструмента
    _toolJob: 0,
    _t: 0,

    // ---------------------------------------------------------------------------------------------

    /** Герой на точке spawn { x, y, yaw } (карта). База движений уже построена (MotionDB.sharedAsync в Game.init). */
    async create(app, spawn) {
        this.dispose();
        this.app = app;
        const loc = app.location, view = loc.view;
        this.world = CharacterPhysics.navWorld(Nav, { ground: (x, z) => loc.terrain.fieldHeight(x, z) });
        this.world.gravity = this.GRAVITY;
        const sp = spawn || { x: loc.width / 2, y: loc.height / 2, yaw: 0 };
        this.ch = HumanoidCharacter.create(view, {
            world: this.world, x: sp.x, y: sp.y, heading: sp.yaw || 0,
            colors: this.COLORS, name: 'hero', kind: 'actor', face: (ctx, w, h) => this.paintFace(ctx, w, h),
            dbOptions: this.DB, physics: this.PHYSICS,
        });
        const fwd = (name) => (e) => this.emit(name, e);
        for (const n of ['step', 'jump', 'land', 'thud', 'ragdoll', 'getup']) this.ch.on(n, fwd(n));
        this.dress(view);
        this.armLayer();
        this.jet.fuel = this.jet.max; this.jet.on = false;
        this.slow = 1; this.working = 0;
        return this.ch;
    },

    dispose() {
        const view = this.app && this.app.location ? this.app.location.view : null;
        for (const m of this.extras) { try { if (view) World3D.removeObject(view, m); m.dispose(false, true); } catch (e) { /* уже */ } }
        this.extras = [];
        this.hair = null; this.helmet = null; this.collar = null;
        this.dropTool(); this.dropTank();
        if (this.ch) { try { this.ch.dispose(); } catch (e) { /* уже */ } }
        this.ch = null;
    },

    on(name, fn) { (this.listeners[name] || (this.listeners[name] = [])).push(fn); },
    emit(name, e) { const l = this.listeners[name]; if (l) for (const fn of l) { try { fn(e || {}); } catch (err) { console.warn('GameHero.' + name, err); } } },

    get x() { return this.ch ? this.ch.x : 0; },
    get y() { return this.ch ? this.ch.y : 0; },
    get h() { return this.ch ? this.ch.h : 0; },
    get heading() { return this.ch ? this.ch.heading : 0; },
    get vel() { return this.ch ? this.ch.ch.vel : [0, 0, 0]; },
    get grounded() { return !!(this.ch && this.ch.ch.grounded); },
    get down() { return !!(this.ch && (this.ch.ragdolled || this.ch.mode === 'getup')); },
    get model() { return this.ch ? this.ch.model : null; },

    // ---------------------------------------------------------------------------------------------
    // Вид
    // ---------------------------------------------------------------------------------------------

    /** Лицо: большие глаза с бликом, улыбка и румянец (холст 256×144 — наклейка 36×20 px на голове). */
    paintFace(ctx, W, H) {
        ctx.clearRect(0, 0, W, H);
        const ink = '#1c1e24';
        ctx.fillStyle = 'rgba(255,110,110,0.30)';
        for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(W * (0.5 + sx * 0.36), H * 0.62, H * 0.13, 0, Math.PI * 2); ctx.fill(); }
        for (const sx of [-1, 1]) {
            const ex = W * (0.5 + sx * 0.2), ey = H * 0.36;
            ctx.fillStyle = ink; ctx.beginPath(); ctx.ellipse(ex, ey, W * 0.048, H * 0.17, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ex + W * 0.014, ey - H * 0.06, W * 0.02, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = ink; ctx.lineWidth = W * 0.03; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(W * 0.5, H * 0.5, W * 0.16, Math.PI * 0.18, Math.PI * 0.82); ctx.stroke();
    },

    /** Рукава куртки, волосы, шлем, воротник, ботинки. */
    dress(view) {
        const m = this.ch.model, scene = view.scene;
        if (!m) return;
        for (const n of ['UpperArmL', 'UpperArmR']) { const p = m.part(n); if (p) p.material = m.mats.top; }
        // перчатки и ботинки скафандра
        const white = new BABYLON.StandardMaterial('hero-white', scene);
        white.diffuseColor = new BABYLON.Color3(0.95, 0.96, 1);
        white.emissiveColor = white.diffuseColor.scale(0.16);
        white.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        m.mats.white = white;
        for (const n of ['HandL', 'HandR', 'FootL', 'FootR']) { const p = m.part(n); if (p) p.material = white; }
        const head = m.part('Head');
        if (!head) return;
        // волосы: «взъерошенная» шапка из блоков (оси головы: x вперёд, y вверх, z вправо; голова 44×44×50)
        const hairMat = new BABYLON.StandardMaterial('hero-hair', scene);
        hairMat.diffuseColor = Humanoid.color3(this.HAIR);
        hairMat.emissiveColor = hairMat.diffuseColor.scale(0.16);
        hairMat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
        const boxes = [];
        const B = (sx, sy, sz, x, y, z, ry, rz) => {
            const b = BABYLON.MeshBuilder.CreateBox('hair', { width: sx, height: sy, depth: sz }, scene);
            b.position.set(x, y, z);
            if (ry) b.rotation.y = ry;
            if (rz) b.rotation.z = rz;
            boxes.push(b);
        };
        B(46, 8, 52, 0, 24, 0);                    // шапка
        B(17, 6, 20, 8, 29, -11, 0.2, 0.1); B(18, 6, 19, -5, 30, 9, -0.25, -0.08);
        B(16, 6, 18, 9, 29, 13, 0.15, 0.1); B(17, 6, 18, -9, 29, -10, -0.2, 0.12);
        B(6, 8, 36, 22.5, 19, 3, 0, 0);            // чёлка
        B(6, 7, 13, 22.5, 18, -15, 0, 0.15);
        B(6, 26, 48, -22.5, 10, 0);                // затылок
        B(34, 18, 5, -4, 13, -25.5); B(34, 18, 5, -4, 13, 25.5);   // виски
        const hair = BABYLON.Mesh.MergeMeshes(boxes, true, true);
        if (hair) {
            hair.name = 'hero-hair';
            hair.material = hairMat;
            hair.parent = head;
            hair.isPickable = false;
            World3D.addObject(view, hair, 'actor');
            this.extras.push(hair);
            this.hair = hair;
        }
        // стеклянный шлем и воротник
        const glassMat = new BABYLON.StandardMaterial('hero-glass', scene);
        glassMat.diffuseColor = new BABYLON.Color3(0.72, 0.9, 1);
        glassMat.emissiveColor = new BABYLON.Color3(0.25, 0.34, 0.42);
        glassMat.specularColor = new BABYLON.Color3(1, 1, 1);
        glassMat.specularPower = 90;
        glassMat.alpha = 0.2;
        glassMat.backFaceCulling = true;
        glassMat.metadata = { toon: false };
        const helmet = BABYLON.MeshBuilder.CreateSphere('hero-helmet', { diameter: 98, segments: 14 }, scene);
        helmet.material = glassMat;
        helmet.parent = head;
        helmet.position.set(0, 3, 0);
        helmet.isPickable = false;
        this.extras.push(helmet);
        this.helmet = helmet;
        const collar = BABYLON.MeshBuilder.CreateTorus('hero-collar', { diameter: 62, thickness: 13, tessellation: 18 }, scene);
        collar.material = white;
        collar.parent = head;
        collar.position.set(0, -25, 0);
        collar.isPickable = false;
        World3D.addObject(view, collar, 'actor');
        this.extras.push(collar);
        this.collar = collar;
    },

    /** Слой позы: правая рука держит пылесос перед собой (поверх бега и стойки). */
    armLayer() {
        const J = Humanoid.J, D = Math.PI / 180;
        const qS = [0, 0, 0, 1], qE = [0, 0, 0, 1], qW = [0, 0, 0, 1], qS2 = [0, 0, 0, 1], qE2 = [0, 0, 0, 1];
        GM.qeuler(qS, 0, 30 * D, 0); GM.qeuler(qE, 0, 42 * D, 0); GM.qeuler(qW, 0, 0, 0);
        GM.qeuler(qS2, 0, 40 * D, 0); GM.qeuler(qE2, 0, 46 * D, 0);
        const q = [0, 0, 0, 1], q2 = [0, 0, 0, 1];
        this.ch.mm.layerHooks.push((mm, dt) => {
            if (!this.tool) return;
            const w = this.working;
            this._t += dt;
            GM.qslerp(q, qS, qS2, w); GM.qslerp(q2, qE, qE2, w);
            mm.blendLocal(J.SHR, q, 0.92);
            mm.blendLocal(J.ELR, q2, 0.92);
            mm.blendLocal(J.WRR, qW, 0.92);
        });
    },

    /** Модель из assets/models -> корень; нет файла — null (вызывающий делает запасной вид). */
    async loadModel(url, name) {
        try {
            const model = await Model3D.load(url);
            const root = Model3D.build(model, this.app.location.view.scene, { name });
            World3D.addObject(this.app.location.view, root, 'actor');
            GameWorld.glow(root);
            return root;
        } catch (e) {
            console.warn('GameHero: нет модели ' + url);
            return null;
        }
    },

    dropTool() {
        if (this.tool && this.tool.root) { try { Model3D.dispose(this.app.location.view, this.tool.root); } catch (e) { /* уже */ } }
        this.tool = null;
    },
    dropTank() {
        if (this.tank && this.tank.root) { try { Model3D.dispose(this.app.location.view, this.tank.root); } catch (e) { /* уже */ } }
        this.tank = null;
    },

    /** Пылесос уровня tier (0..3) в правую руку. */
    async setTool(tier) {
        if (!this.ch || !this.ch.model) return;
        if (this.tool && this.tool.tier === tier) return;
        const job = ++this._toolJob;
        const T = GameData.TOOLS[Math.max(0, Math.min(GameData.TOOLS.length - 1, tier))];
        let root = await this.loadModel(T.model, 'hero-tool');
        if (job !== this._toolJob || !this.ch) { if (root) Model3D.dispose(this.app.location.view, root); return; }
        const scene = this.app.location.view.scene;
        if (!root) {
            // запасной вид: труба с раструбом
            root = new BABYLON.Mesh('hero-tool', scene);
            const mat = new BABYLON.StandardMaterial('hero-tool-mat', scene);
            mat.diffuseColor = new BABYLON.Color3(1, 0.78, 0.12);
            const tube = BABYLON.MeshBuilder.CreateCylinder('tube', { height: 70, diameterTop: 16, diameterBottom: 30, tessellation: 12 }, scene);
            tube.rotation.z = -Math.PI / 2; tube.position.x = 35; tube.material = mat; tube.parent = root;
            World3D.addObject(this.app.location.view, root, 'actor');
        }
        this.dropTool();
        const hand = this.ch.model.part('HandR');
        root.parent = hand;
        // рука висит вдоль −Y сустава: сопло (нос модели +X) — вдоль предплечья, верх модели — вперёд от ладони
        root.rotationQuaternion = null;
        root.rotation.set(0, 0, -Math.PI / 2);
        root.position.set(4, -6, 0);
        const tip = GameHero.TIPS[tier] || GameHero.TIPS[0];
        this.tool = { root, tier, tip: [tip[0], tip[1], 0] };
    },
    TIPS: [[80, 15], [93, 17], [98, 17], [110, 18]],   // срез сопла vac_1..4 в px модели: вперёд и вверх от рукояти (отчёт Blender-скрипта)

    /** Ранец-бак на спину; заполнение — setTank. */
    async setupTank() {
        if (!this.ch || !this.ch.model) return;
        let root = await this.loadModel('assets/models/game/tank.glb', 'hero-tank');
        if (!this.ch) return;
        const scene = this.app.location.view.scene;
        let fill = null;
        if (root) {
            for (const m of root.getChildMeshes(false)) {
                if (m.metadata && m.metadata.part === 'Fill') { fill = m; const p = m.metadata.pivot || [0, 0, 0]; m.setPivotPoint(new BABYLON.Vector3(p[0], p[1], p[2])); }
            }
        } else {
            root = new BABYLON.Mesh('hero-tank', scene);
            const mat = new BABYLON.StandardMaterial('hero-tank-mat', scene);
            mat.diffuseColor = new BABYLON.Color3(0.9, 0.92, 0.98);
            const can = BABYLON.MeshBuilder.CreateCylinder('can', { height: 60, diameter: 34, tessellation: 12 }, scene);
            can.position.set(-20, 0, 0); can.material = mat; can.parent = root;
            World3D.addObject(this.app.location.view, root, 'actor');
        }
        this.dropTank();
        const torso = this.ch.model.part('UpperTorso');
        root.parent = torso;
        root.rotationQuaternion = null;
        root.position.set(-17.5, 2, 0);
        this.tank = { root, fill };
        this.setTank(0);
    },

    setTank(frac) {
        if (!this.tank || !this.tank.fill) return;
        const f = Math.max(0.02, Math.min(1, frac));
        this.tank.fill.scaling.y = f;
        this.tank.fill.setEnabled(frac > 0.01);
    },

    // ---------------------------------------------------------------------------------------------
    // Механика
    // ---------------------------------------------------------------------------------------------

    setStats(s) {
        if (s.speed != null) this.speed = s.speed;
        if (s.jet != null) { this.jet.max = s.jet; this.jet.fuel = Math.min(this.jet.fuel, s.jet) || s.jet; }
    },

    /** Телепорт (старт, возврат на карту). */
    place(x, y, yaw) {
        if (!this.ch) return;
        this.ch.hold = false; this.ch.locked = false;
        this.ch.place(x, y, yaw || 0);
        this.jet.on = false; this.jet.fuel = this.jet.max;
    },

    /** Сбить с ног: рэгдолл со скоростью (vx, vy, vz) px/с. */
    knock(vx, vy, vz) {
        if (!this.ch || this.ch.ragdolled) return false;
        this.jet.on = false;
        return this.ch.knock([vx, vy, vz], 'hit');
    },

    /** Подбросить (гейзер): вертикальная скорость без рэгдолла. */
    launch(vy) {
        if (!this.ch || this.ch.ragdolled) return;
        const P = this.ch.ch;
        P.vel[1] = Math.max(P.vel[1], vy);
        P.grounded = false; P.jumpT = 0; P.coyote = 9;
    },

    /** inp: { move, jump, jumpHeld, camYaw, locked, working } */
    update(dt, inp) {
        const H = this.ch;
        if (!H) return;
        const i = inp || {}, P = H.ch;
        H.locked = !!i.locked;
        P.c.run = this.speed * this.slow;
        P.c.sprint = P.c.run;
        // ранец: держать прыжок в воздухе
        const wantJet = this.jet.max > 0 && !H.locked && !H.ragdolled && i.jumpHeld && this.jet.fuel > 0 && !P.grounded && P.jumpT > 0.22;
        if (wantJet !== this.jet.on) { this.jet.on = wantJet; this.emit(wantJet ? 'jetOn' : 'jetOff', {}); }
        H.control({ move: i.move, jump: i.jump, jumpHeld: i.jumpHeld, camYaw: i.camYaw });
        if (this.jet.on) {
            this.jet.fuel = Math.max(0, this.jet.fuel - dt);
            P.vel[1] = Math.min(430, P.vel[1] + (this.GRAVITY + 1150) * dt);
        } else if (P.grounded && this.jet.fuel < this.jet.max) {
            this.jet.fuel = Math.min(this.jet.max, this.jet.fuel + dt * 1.6);
        }
        const wk = i.working && !this.down ? 1 : 0;
        this.working += (wk - this.working) * Math.min(1, dt * 9);
        H.update(dt);
        // дрожь работающего пылесоса
        if (this.tool && this.tool.root) {
            const a = this.working * 0.035;
            this.tool.root.rotation.x = Math.sin(this._t * 61) * a;
            this.tool.root.rotation.y = Math.cos(this._t * 47) * a;
        }
    },

    /** Центр круга уборки (карта): перед героем, чуть дальше ног. out = { x, y }. */
    cleanPoint(radius, out) {
        const o = out || { x: 0, y: 0 }, a = this.heading, d = 26 + radius * 0.6;
        o.x = this.x + Math.cos(a) * d; o.y = this.y + Math.sin(a) * d;
        return o;
    },

    /** Мировая точка среза сопла [x, y, z] (вид: эффекты всасывания). */
    nozzle(out) {
        const o = out || [0, 0, 0];
        if (this.tool && this.tool.root) {
            const r = this.tool.root;
            r.computeWorldMatrix(true);
            const tv = this._tipV || (this._tipV = new BABYLON.Vector3());
            const v = BABYLON.Vector3.TransformCoordinates(tv.set(this.tool.tip[0], this.tool.tip[1], this.tool.tip[2]), r.getWorldMatrix());
            o[0] = v.x; o[1] = v.y; o[2] = v.z;
        } else {
            const a = this.heading;
            o[0] = this.x + Math.cos(a) * 70; o[1] = this.h + 60; o[2] = this.y + Math.sin(a) * 70;
        }
        return o;
    },
    _tipV: /** @type {any} */ (null),
};
