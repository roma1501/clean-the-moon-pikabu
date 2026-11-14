// GameMobs.js — живые механики секторов Clean the Moon. Всё ставится по маркерам карты (Maps.js):
//   geyser-N  газовые гейзеры: раз в несколько секунд выброс подбрасывает героя и сдувает пыль вокруг;
//   slug-N    слизни: ползают и снова пачкают слизью, пока их не засосёт пылесос;
//   bunny-N   пылевые зайчики: убегают от героя и оставляют пыльный след, их надо догнать и засосать;
//   meteors   зона метеоритных дождей (круг scale[0]·100 px; нет маркера — метеоритов нет);
//   boss      Король Грязи: прыгает, плюётся жижей, бьёт волной; его «высасывают» пылесосом.
// Логика — по своим числам (позиции, таймеры), 3D — только вид (инвариант 4 движка).
//
//   await GameMobs.build(app, level, hooks)   // hooks: fx(name, d), sfx(name), toast(key, kind), knock(vx, vy, vz), caught(kind, x, y), boss(evt)
//   GameMobs.update(dt, hero, tool)           // tool: { on, x, y, radius, power, mul }
//   GameMobs.pending()                        // сколько мобов ещё мешают закончить сектор

/** @satisfies {Record<string, any>} */
const GameMobs = {
    /** @type {LoryApp | null} */ app: null,
    /** @type {any} */ hooks: {},
    /** @type {any} */ level: null,
    /** @type {any[]} */ geysers: [],
    /** @type {any[]} */ slugs: [],
    /** @type {any[]} */ bunnies: [],
    /** @type {any[]} */ falling: [],
    /** @type {any} */ zone: null,
    /** @type {any} */ boss: null,
    slugTotal: 0, bunnyTotal: 0,
    meteorT: 0, meteorSaid: false,
    t: 0,
    SLIME: 1, DUST: 0, SOOT: 2, TOXIC: 3,

    async build(app, level, hooks) {
        this.clear();
        this.app = app; this.level = level; this.hooks = hooks || {};
        const loc = app.location;
        const spawn = async (url, name) => GameWorld.spawn(url, name, 'actor');
        const part = (root, name) => { if (!root) return null; for (const m of root.getChildMeshes(false)) if (m.metadata && m.metadata.part === name) { const p = m.metadata.pivot || [0, 0, 0]; m.setPivotPoint(new BABYLON.Vector3(p[0], p[1], p[2])); return m; } return null; };
        let i = 0;
        for (const m of loc.markers('geyser')) {
            const mesh = await spawn('assets/models/game/geyser.glb', 'geyser');
            const h = GameWorld.ground(m.x, m.y);
            if (mesh) mesh.position.set(m.x, h, m.y);
            this.geysers.push({ x: m.x, y: m.y, h, mesh, t: 2.5 + (i++ % 4) * 1.9, period: 7.5, warned: false });
        }
        for (const m of loc.markers('slug')) {
            const mesh = await spawn('assets/models/mobs/slug.glb', 'slug');
            this.slugs.push({ kind: 'slug', x: m.x, y: m.y, hx: m.x, hy: m.y, tx: m.x, ty: m.y, a: Math.random() * 6.28, mesh, hp: 1, wait: Math.random() * 2, trail: 0, state: 0, t: 0, eyeL: part(mesh, 'EyeL'), eyeR: part(mesh, 'EyeR') });
        }
        for (const m of loc.markers('bunny')) {
            const mesh = await spawn('assets/models/mobs/bunny.glb', 'bunny');
            this.bunnies.push({ kind: 'bunny', x: m.x, y: m.y, a: Math.random() * 6.28, mesh, hp: 1, hop: Math.random(), trail: 0, state: 0, t: 0, flee: 0, earL: part(mesh, 'EarL'), earR: part(mesh, 'EarR'), squeak: 0 });
        }
        this.slugTotal = this.slugs.length; this.bunnyTotal = this.bunnies.length;
        const mz = loc.marker('meteors');
        this.zone = mz ? { x: mz.x, y: mz.y, r: Math.max(400, (mz.scale ? mz.scale[0] : 10) * 100) } : null;
        this.meteorT = 16; this.meteorSaid = false;
        if (this.zone) await Model3D.load('assets/models/mobs/meteor.glb').catch(() => null);
        const bm = loc.marker('boss');
        if (bm) {
            const mesh = await spawn('assets/models/mobs/king.glb', 'king');
            const h = GameWorld.ground(bm.x, bm.y);
            if (mesh) mesh.position.set(bm.x, h, bm.y);
            this.boss = {
                x: bm.x, y: bm.y, h, hx: bm.x, hy: bm.y, a: 0, mesh, hpMax: 240, hp: 240, state: 'sleep', t: 0, n: 0, jump: 0,
                next: 0.75, ring: -1, ringHit: false, awake: false, dead: false, coinsAt: 0.9, shake: 0,
                armL: part(mesh, 'ArmL'), armR: part(mesh, 'ArmR'), crown: part(mesh, 'Crown'), sx: 0, sy: 0, tx: 0, ty: 0,
            };
        }
    },

    clear() {
        this.geysers = []; this.slugs = []; this.bunnies = []; this.falling = []; this.zone = null; this.boss = null;
        this.slugTotal = 0; this.bunnyTotal = 0; this.t = 0;
    },

    pending() { return this.slugs.length + this.bunnies.length + (this.boss && !this.boss.dead ? 1 : 0); },

    /** «Сияние» героя: мелких мобов в радиусе r засасывает сразу, Королю Грязи — урон. */
    blast(x, y, r) {
        for (const list of [this.slugs, this.bunnies]) for (const c of list) {
            if (c.state !== 0 || Math.hypot(c.x - x, c.y - y) > r) continue;
            c.state = 1; c.t = 0;
            if (c.mesh) { c.sx = c.mesh.position.x; c.sy = c.mesh.position.y; c.sz = c.mesh.position.z; }
        }
        const b = this.boss;
        if (b && b.awake && !b.dead && Math.hypot(b.x - x, b.y - y) < r + 170) {
            b.hp -= b.hpMax * 0.08; b.shake = 1;
            if (b.hp <= 0) this.bossDie(b);
        }
    },
    fx(name, d) { if (this.hooks.fx) this.hooks.fx(name, d); },
    sfx(name) { if (this.hooks.sfx) this.hooks.sfx(name); },

    /** Сбить героя из точки (x, y): скорость наружу + вверх. */
    knockFrom(hero, x, y, power) {
        if (hero.down) return;
        const dx = hero.x - x, dy = hero.y - y, d = Math.hypot(dx, dy) || 1;
        if (this.hooks.knock) this.hooks.knock(dx / d * power, 430, dy / d * power);
    },

    inMap(x, y, pad) {
        const loc = this.app.location;
        return x > pad && y > pad && x < loc.width - pad && y < loc.height - pad;
    },

    update(dt, hero, tool) {
        this.t += dt;
        this.updateGeysers(dt, hero);
        this.updateCritters(dt, hero, tool, this.slugs);
        this.updateCritters(dt, hero, tool, this.bunnies);
        this.updateMeteors(dt, hero);
        if (this.boss) this.updateBoss(dt, hero, tool);
    },

    // ---------------------------------------------------------------------------------------------
    // Гейзеры
    // ---------------------------------------------------------------------------------------------

    updateGeysers(dt, hero) {
        for (const g of this.geysers) {
            g.t -= dt;
            if (!g.warned && g.t < 0.9) { g.warned = true; this.fx('geyserWarn', { x: g.x, y: g.y, h: g.h }); }
            if (g.mesh) g.mesh.scaling.y = 1 + (g.warned ? Math.sin(this.t * 40) * 0.05 : 0);
            if (g.t > 0) continue;
            g.t = g.period; g.warned = false;
            const near = Math.hypot(hero.x - g.x, hero.y - g.y);
            if (near < 1500) { this.fx('geyser', { x: g.x, y: g.y, h: g.h }); if (near < 1100) this.sfx('geyser'); }
            GameDirt.clean(g.x, g.y, 150, 99, Infinity, true);          // сдувает грязь вокруг (в бак она не попадает)
            if (near < 105 && hero.h - g.h < 140) hero.launch(940);
        }
    },

    // ---------------------------------------------------------------------------------------------
    // Слизни и пылевые зайчики
    // ---------------------------------------------------------------------------------------------

    updateCritters(dt, hero, tool, list) {
        for (let i = list.length - 1; i >= 0; i--) {
            const c = list[i], bunny = c.kind === 'bunny';
            if (c.state === 1) {                                        // летит в сопло
                c.t += dt / 0.3;
                const n = hero.nozzle(this._nz), k = Math.min(1, c.t), e = k * k;
                if (c.mesh) {
                    c.mesh.position.set(c.sx + (n[0] - c.sx) * e, c.sy + (n[1] - c.sy) * e + Math.sin(k * Math.PI) * 40, c.sz + (n[2] - c.sz) * e);
                    c.mesh.scaling.setAll(Math.max(0.05, 1 - e));
                    c.mesh.rotation.y += dt * 20;
                }
                if (c.t >= 1) {
                    list.splice(i, 1);
                    if (c.mesh) GameWorld.remove(c.mesh);
                    if (this.hooks.caught) this.hooks.caught(c.kind, c.x, c.y);
                }
                continue;
            }
            const dh = Math.hypot(hero.x - c.x, hero.y - c.y);
            let speed = 0;
            if (bunny) {
                // убегает от героя; у края карты — сворачивает к центру
                const scared = dh < 520 && !hero.down;
                c.flee = scared ? 1.2 : Math.max(0, c.flee - dt);
                if (c.flee > 0) {
                    let ax = c.x - hero.x, ay = c.y - hero.y;
                    const l = Math.hypot(ax, ay) || 1; ax /= l; ay /= l;
                    const loc = this.app.location, cx = loc.width / 2 - c.x, cy = loc.height / 2 - c.y, cl = Math.hypot(cx, cy) || 1;
                    const edge = Math.min(c.x, c.y, loc.width - c.x, loc.height - c.y);
                    const pull = edge < 420 ? (420 - edge) / 420 * 1.6 : 0;
                    ax += cx / cl * pull + Math.sin(this.t * 1.7 + i * 2.1) * 0.5; ay += cy / cl * pull + Math.cos(this.t * 1.3 + i) * 0.5;
                    const want = Math.atan2(ay, ax);
                    c.a += Math.atan2(Math.sin(want - c.a), Math.cos(want - c.a)) * Math.min(1, dt * 7);
                    speed = 285;
                    c.squeak -= dt;
                    if (c.squeak <= 0 && dh < 300) { c.squeak = 1.6 + Math.random(); this.sfx('bunny_squeak'); }
                } else {
                    c.hop += dt * 0.5;
                    if (Math.sin(c.hop * 2) > 0.92) c.a += (Math.random() - 0.5) * 2;
                    speed = Math.sin(c.hop * 5) > 0.2 ? 50 : 0;
                }
            } else {
                // слизень: неспешно ползает вокруг своей точки
                c.wait -= dt;
                if (Math.hypot(c.tx - c.x, c.ty - c.y) < 30 || c.wait <= 0) {
                    const a = Math.random() * 6.28, r = 120 + Math.random() * 330;
                    c.tx = c.hx + Math.cos(a) * r; c.ty = c.hy + Math.sin(a) * r; c.wait = 5 + Math.random() * 4;
                }
                const want = Math.atan2(c.ty - c.y, c.tx - c.x);
                c.a += Math.atan2(Math.sin(want - c.a), Math.cos(want - c.a)) * Math.min(1, dt * 2.5);
                speed = 62;
            }
            // пылесос тянет: держит на месте и «высасывает»
            const grab = tool.on && Math.hypot(c.x - tool.x, c.y - tool.y) < tool.radius + 40;
            if (grab) {
                c.hp -= dt * (bunny ? 2.2 : 1.1) * Math.min(3, 0.6 + tool.mul * 0.4);
                speed *= bunny ? 0.45 : 0.1;
                if (c.hp <= 0) {
                    c.state = 1; c.t = 0;
                    if (c.mesh) { c.sx = c.mesh.position.x; c.sy = c.mesh.position.y; c.sz = c.mesh.position.z; }
                    this.sfx(bunny ? 'bunny_caught' : 'suck');
                    continue;
                }
            } else c.hp = Math.min(1, c.hp + dt * 0.35);
            const nx = c.x + Math.cos(c.a) * speed * dt, ny = c.y + Math.sin(c.a) * speed * dt;
            if (this.inMap(nx, ny, 140) && !Nav.blocked(nx, ny, 34)) { c.x = nx; c.y = ny; } else c.a += 1.7 * dt * 6;
            // след грязи
            c.trail -= dt * (speed > 20 ? 1 : 0);
            if (c.trail <= 0 && speed > 20) {
                c.trail = bunny ? 0.22 : 0.5;
                if (bunny) { if (c.flee > 0) GameDirt.spill(c.x, c.y, 46, this.DUST, 0.75); }
                else GameDirt.spill(c.x, c.y, 60, this.SLIME, 0.9);
            }
            if (c.mesh) {
                const gh = GameWorld.ground(c.x, c.y);
                const hopY = bunny ? Math.abs(Math.sin(this.t * (c.flee > 0 ? 13 : 6) + i)) * (c.flee > 0 ? 34 : 12) * (speed > 0 ? 1 : 0.2) : 0;
                const wob = grab ? Math.sin(this.t * 45) * 0.12 : 0;
                c.mesh.position.set(c.x, gh + hopY, c.y);
                c.mesh.rotation.y = -c.a;
                if (bunny) {
                    c.mesh.scaling.set(1 + wob, 1 - wob + hopY * 0.004, 1 + wob);
                    const er = Math.sin(this.t * 9 + i) * 0.18 + (c.flee > 0 ? -0.5 : 0);
                    if (c.earL) c.earL.rotation.z = er; if (c.earR) c.earR.rotation.z = er;
                } else {
                    const sq = Math.sin(this.t * 4 + i) * 0.1;
                    c.mesh.scaling.set(1 + sq + wob, 1 - sq * 0.8 - wob * 0.6, 1 - sq * 0.4 + wob);
                    if (c.eyeL) c.eyeL.rotation.z = Math.sin(this.t * 3 + i) * 0.2; if (c.eyeR) c.eyeR.rotation.z = Math.cos(this.t * 3.4 + i) * 0.2;
                }
            }
        }
    },
    _nz: [0, 0, 0],

    // ---------------------------------------------------------------------------------------------
    // Метеориты
    // ---------------------------------------------------------------------------------------------

    updateMeteors(dt, hero) {
        if (this.zone) {
            this.meteorT -= dt;
            if (this.meteorT <= 0) {
                this.meteorT = 15 + Math.random() * 7;
                if (!this.meteorSaid) { this.meteorSaid = true; if (this.hooks.toast) this.hooks.toast('g.meteors', 'warn'); }
                const n = 3 + ((Math.random() * 3) | 0);
                for (let i = 0; i < n; i++) {
                    let x = 0, y = 0, ok = false;
                    for (let tr = 0; tr < 12 && !ok; tr++) {
                        const a = Math.random() * 6.28, r = i === 0 ? 80 + Math.random() * 160 : 260 + Math.random() * 680;
                        x = hero.x + Math.cos(a) * r; y = hero.y + Math.sin(a) * r;
                        ok = this.inMap(x, y, 200) && Math.hypot(x - this.zone.x, y - this.zone.y) < this.zone.r && !GameWorld.pads.some(p => Math.hypot(p.x - x, p.y - y) < 380);
                    }
                    if (ok) this.meteor(x, y, 1.5 + i * 0.28, 165, this.SOOT, 'ore');
                }
            }
        }
        for (let i = this.falling.length - 1; i >= 0; i--) {
            const m = this.falling[i];
            m.t += dt;
            const left = m.sec - m.t;
            if (!m.sound && left < 1.15) { m.sound = true; if (Math.hypot(hero.x - m.x, hero.y - m.y) < 1300) this.sfx('meteor_warn'); }
            if (m.mesh) {
                const k = Math.max(0, Math.min(1, 1 - left / 0.95));     // последние 0.95 с — полёт
                m.mesh.setEnabled(k > 0);
                m.mesh.position.set(m.x + (1 - k) * m.ox, m.gh + 30 + (1 - k) * 2600, m.y + (1 - k) * m.oy);
                m.mesh.rotation.x += dt * 5; m.mesh.rotation.z += dt * 3;
                if (k > 0) this.fx('meteorTrail', { x: m.mesh.position.x, y: m.mesh.position.z, h: m.mesh.position.y, goo: m.goo });
            }
            if (left > 0) continue;
            this.falling.splice(i, 1);
            if (m.mesh) GameWorld.remove(m.mesh);
            GameDirt.spill(m.x, m.y, m.r * 0.92, m.kind, 0.95);
            const d = Math.hypot(hero.x - m.x, hero.y - m.y);
            this.fx('meteorHit', { x: m.x, y: m.y, h: m.gh, r: m.r, goo: m.goo });
            if (d < 1600) this.sfx(m.goo ? 'slime' : 'meteor_hit');
            if (d < m.r + 22 && hero.h - m.gh < 170) this.knockFrom(hero, m.x, m.y, 430);
            if (m.loot) GameWorld.drop(m.loot, m.x, m.y, 22 * this.level.mult, 1);
        }
    },

    /** Падающий снаряд: круг-предупреждение на sec секунд, затем удар, пятно грязи kind радиуса r. */
    meteor(x, y, sec, r, kind, loot, goo) {
        GameWorld.warn(x, y, r, sec);
        const m = { x, y, r, sec, t: 0, kind, loot, goo: !!goo, gh: GameWorld.ground(x, y), mesh: null, ox: 500 + Math.random() * 300, oy: -300 + Math.random() * 600, sound: !!goo };
        this.falling.push(m);
        GameWorld.spawn('assets/models/mobs/meteor.glb', 'meteor', 'actor').then((mesh) => {
            if (!mesh) return;
            if (this.falling.indexOf(m) < 0) { GameWorld.remove(mesh); return; }
            mesh.setEnabled(false);
            if (goo) mesh.scaling.setAll(0.7);
            m.mesh = mesh;
        });
    },

    // ---------------------------------------------------------------------------------------------
    // Босс «Король Грязи»
    // ---------------------------------------------------------------------------------------------

    updateBoss(dt, hero, tool) {
        const b = this.boss;
        if (b.dead) return;
        const dh = Math.hypot(hero.x - b.x, hero.y - b.y);
        const frac = Math.max(0, b.hp / b.hpMax), size = 0.55 + 0.45 * frac, R = 170 * size;
        b.t += dt;
        if (!b.awake) {
            if (dh < 1250) { b.awake = true; b.state = 'idle'; b.t = 0; this.sfx('boss_roar'); if (this.hooks.boss) this.hooks.boss('wake'); }
        } else {
            // пылесос высасывает грязь из Короля
            const reach = R + tool.radius + 70;
            const grab = tool.on && Math.hypot(b.x - tool.x, b.y - tool.y) < reach && b.jump < 60;
            if (grab) {
                b.hp -= dt * tool.mul;
                b.shake = 1;
                this.fx('bossHit', { x: b.x, y: b.y, h: b.h + 150 * size, r: R });
                if (frac < b.coinsAt) { b.coinsAt -= 0.1; GameWorld.drop('coin', b.x, b.y, 60 * this.level.mult, 3); this.sfx('boss_hit'); }
                if (b.hp <= 0) { this.bossDie(b); return; }
            }
            b.shake = Math.max(0, b.shake - dt * 5);
            // герой не проходит сквозь тушу
            if (dh < R + 30 && !hero.down) { const P = hero.ch.ch, k = 900 * dt / (dh || 1); P.vel[0] += (hero.x - b.x) * k; P.vel[2] += (hero.y - b.y) * k; }
            const face = Math.atan2(hero.y - b.y, hero.x - b.x);
            if (b.state === 'idle') {
                b.a += Math.atan2(Math.sin(face - b.a), Math.cos(face - b.a)) * Math.min(1, dt * 3);
                if (b.t > (frac < 0.4 ? 1.5 : 2.3)) {
                    if (frac <= b.next) { b.next -= 0.25; b.state = 'slamUp'; b.t = 0; if (this.hooks.toast) this.hooks.toast('g.bossSlam', 'warn'); this.sfx('boss_roar'); }
                    else if (dh > 520 || b.n % 2 === 1) { b.state = 'spit'; b.t = 0; b.shots = frac < 0.5 ? 5 : 3; b.shotT = 0.2; }
                    else { b.state = 'hop'; b.t = 0; b.hops = 3; this.hopStart(b, hero); }
                    b.n++;
                }
            } else if (b.state === 'hop') {
                const k = Math.min(1, b.t / 0.8);
                b.x = b.sx + (b.tx - b.sx) * k; b.y = b.sy + (b.ty - b.sy) * k;
                b.jump = Math.sin(k * Math.PI) * 190;
                if (k >= 1) {
                    b.jump = 0;
                    GameDirt.spill(b.x, b.y, 180, frac < 0.5 ? this.TOXIC : this.SOOT, 0.95);
                    this.fx('bossLand', { x: b.x, y: b.y, h: b.h, r: 200 });
                    this.sfx('boss_hit');
                    if (Math.hypot(hero.x - b.x, hero.y - b.y) < R + 90 && hero.h - b.h < 150) this.knockFrom(hero, b.x, b.y, 460);
                    if (--b.hops > 0) { b.t = -0.25; this.hopStart(b, hero); } else { b.state = 'idle'; b.t = 0; }
                }
            } else if (b.state === 'spit') {
                b.a += Math.atan2(Math.sin(face - b.a), Math.cos(face - b.a)) * Math.min(1, dt * 4);
                b.shotT -= dt;
                if (b.shotT <= 0 && b.shots > 0) {
                    b.shots--; b.shotT = 0.42;
                    const a = Math.random() * 6.28, r = Math.random() * 230;
                    const x = hero.x + Math.cos(a) * r + hero.vel[0] * 0.6, y = hero.y + Math.sin(a) * r + hero.vel[2] * 0.6;
                    if (this.inMap(x, y, 160)) this.meteor(x, y, 1.35, 135, this.TOXIC, null, true);
                    this.fx('bossSpit', { x: b.x, y: b.y, h: b.h + 260 * size });
                    this.sfx('slime');
                }
                if (b.shots <= 0 && b.t > 2.4) { b.state = 'idle'; b.t = 0; }
            } else if (b.state === 'slamUp') {
                b.jump = Math.min(1, b.t / 1.0) * 320;
                if (b.t > 1.25) { b.state = 'slam'; b.t = 0; }
            } else if (b.state === 'slam') {
                if (b.jump > 0) {
                    b.jump = Math.max(0, b.jump - dt * 2600);
                    if (b.jump === 0) { b.ring = 0; b.ringHit = false; this.fx('bossSlam', { x: b.x, y: b.y, h: b.h, r: 950 }); this.sfx('meteor_hit'); if (this.app.camera.shake) this.app.camera.shake(14, 0.5); GameDirt.spill(b.x, b.y, 230, this.SOOT, 0.95); }
                } else if (b.ring >= 0) {
                    b.ring += 640 * dt;
                    if (!b.ringHit && Math.abs(dh - b.ring) < 48 && hero.grounded && !hero.down) { b.ringHit = true; this.knockFrom(hero, b.x, b.y, 420); }
                    if (b.ring > 950) { b.ring = -1; b.state = 'idle'; b.t = 0; }
                }
            }
        }
        if (b.mesh) {
            const breath = Math.sin(this.t * 2.2) * 0.03, sh = b.shake * Math.sin(this.t * 55) * 0.05;
            b.mesh.position.set(b.x + sh * 60, b.h + b.jump, b.y);
            b.mesh.rotation.y = -b.a;
            b.mesh.scaling.set(size * (1 + breath + sh), size * (1 - breath * 1.4 + (b.jump > 0 ? 0.08 : 0)), size * (1 + breath - sh));
            const arm = b.state === 'slamUp' || b.state === 'spit' ? -1.1 : Math.sin(this.t * 2.6) * 0.25;
            if (b.armL) b.armL.rotation.z += (arm - b.armL.rotation.z) * Math.min(1, dt * 8);
            if (b.armR) b.armR.rotation.z += (arm - b.armR.rotation.z) * Math.min(1, dt * 8);
            if (b.crown) b.crown.rotation.y = Math.sin(this.t * 1.8) * 0.12;
        }
        if (this.hooks.boss) this.hooks.boss('hp', frac);
    },

    hopStart(b, hero) {
        const a = Math.atan2(hero.y - b.y, hero.x - b.x), d = Math.min(300, Math.max(0, Math.hypot(hero.x - b.x, hero.y - b.y) - 60));
        b.sx = b.x; b.sy = b.y; b.a = a;
        let tx = b.x + Math.cos(a) * d, ty = b.y + Math.sin(a) * d;
        if (!this.inMap(tx, ty, 320) || Math.hypot(tx - b.hx, ty - b.hy) > 1500) { tx = b.x; ty = b.y; }
        b.tx = tx; b.ty = ty;
    },

    bossDie(b) {
        b.dead = true; b.hp = 0;
        this.fx('bossDie', { x: b.x, y: b.y, h: b.h + 120 });
        this.sfx('boss_die');
        GameWorld.drop('coin', b.x, b.y, 400 * this.level.mult, 10);
        if (b.mesh) GameWorld.remove(b.mesh);
        for (const m of this.falling) if (m.goo) m.sec = Math.min(m.sec, m.t + 0.05);
        if (this.hooks.boss) { this.hooks.boss('hp', 0); this.hooks.boss('dead'); }
    },
};
