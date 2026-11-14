// GameHud.js — весь интерфейс «Clean the Moon»: главное меню, HUD, окна (улучшения, секторы, результат, пауза, настройки),
// тосты, всплывающие числа и указатель целей. Стиль — яркий «игрушечный космос» в духе симуляторов: толстая тёмная
// обводка, сочные градиенты, нижняя «толщина» кнопок, надписи с контуром, пружинящие окна.
// Модуль сам вставляет <style>, строит DOM и регистрирует блоки HUD в HudLayout (HudLayout.init зовёт игра ДО GameHud.init).
// Игра общается с интерфейсом методами GameHud и колбэками h из GameHud.init(h) (см. шапку контракта в задаче игры).
// Иконки — картинки assets/ui/*.webp (временные заглушки tools/ui/make_placeholders.py; потом заменяются рисунками с теми же именами).
// Шрифт Rubik подключается в index.html (@font-face 'Rubik').

Object.assign(LANG_STRINGS.ru, {
    'hud.leaders': 'Рекорды',
    'hud.play': 'ИГРАТЬ', 'hud.levels': 'Секторы', 'hud.settings': 'Настройки', 'hud.howto': 'Как играть',
    'hud.upgrades': 'Улучшения', 'hud.pause': 'Пауза', 'hud.sector': 'Сектор {n}/{m}', 'hud.tankFull': 'Бак полон!',
    'hud.blast': 'Сияние', 'hud.fuel': 'Топливо', 'hud.resume': 'Продолжить', 'hud.restart': 'Заново', 'hud.toMenu': 'В меню',
    'hud.sound': 'Звук', 'hud.music': 'Музыка', 'hud.quality': 'Графика', 'hud.q.auto': 'Авто', 'hud.q.low': 'Низкая',
    'hud.q.medium': 'Средняя', 'hud.q.high': 'Высокая', 'hud.on': 'ВКЛ', 'hud.off': 'ВЫКЛ', 'hud.close': 'Закрыть',
    'hud.buy': 'Купить', 'hud.max': 'МАКС', 'hud.lvl': 'Ур. {n}/{m}', 'hud.locked': 'Закрыто', 'hud.sectorN': 'Сектор {n}',
    'hud.best': 'Лучшее: {t}', 'hud.here': 'Сейчас', 'hud.tool': 'Инструмент', 'hud.res.title': 'Сектор очищен!',
    'hud.res.time': 'Время', 'hud.res.best': 'Рекорд', 'hud.res.reward': 'Награда', 'hud.res.bonus': 'Бонус',
    'hud.res.stars': 'Найдено звёзд', 'hud.res.newTool': 'Новый инструмент!', 'hud.res.record': 'Новый рекорд!',
    'hud.next': 'Дальше', 'hud.again': 'Ещё раз', 'hud.notEnough': 'Не хватает монет', 'hud.coins': 'Монеты',
    'hud.shop': 'Магазин', 'hud.daily': 'Подарок', 'hud.wheel': 'Колесо', 'hud.codex': 'Кодекс',
    'hud.adBuy': 'За рекламу', 'hud.adIn': 'Через {n} с', 'hud.double': 'x2 МОНЕТ ЗА РЕКЛАМУ', 'hud.doubled': 'Удвоено! +{n}',
    'hud.boost': 'Буст x2', 'hud.boostFull': 'Супер-буст: x2 мощность и x3 удача, 90 с', 'hud.boostSec': '{n} с', 'hud.boostOn': 'x2 · {t}',
    'hud.radar': 'Радар звёзд', 'hud.radarFull': 'Радар звёзд: подсветит звёзды сектора за рекламу', 'hud.radarOn': 'Радар · {t}',
    'hud.drone': 'Сдать дроном +50%', 'hud.droneFull': 'Дрон заберёт грязь из бака: +50% монет за рекламу',
    'hud.blastAd': 'Зарядить «Сияние» за рекламу',
});
Object.assign(LANG_STRINGS.en, {
    'hud.leaders': 'Leaders',
    'hud.play': 'PLAY', 'hud.levels': 'Sectors', 'hud.settings': 'Settings', 'hud.howto': 'How to play',
    'hud.upgrades': 'Upgrades', 'hud.pause': 'Paused', 'hud.sector': 'Sector {n}/{m}', 'hud.tankFull': 'Tank full!',
    'hud.blast': 'Glow', 'hud.fuel': 'Fuel', 'hud.resume': 'Resume', 'hud.restart': 'Restart', 'hud.toMenu': 'Menu',
    'hud.sound': 'Sound', 'hud.music': 'Music', 'hud.quality': 'Graphics', 'hud.q.auto': 'Auto', 'hud.q.low': 'Low',
    'hud.q.medium': 'Medium', 'hud.q.high': 'High', 'hud.on': 'ON', 'hud.off': 'OFF', 'hud.close': 'Close',
    'hud.buy': 'Buy', 'hud.max': 'MAX', 'hud.lvl': 'Lv. {n}/{m}', 'hud.locked': 'Locked', 'hud.sectorN': 'Sector {n}',
    'hud.best': 'Best: {t}', 'hud.here': 'Now', 'hud.tool': 'Tool', 'hud.res.title': 'Sector cleaned!',
    'hud.res.time': 'Time', 'hud.res.best': 'Best', 'hud.res.reward': 'Reward', 'hud.res.bonus': 'Bonus',
    'hud.res.stars': 'Stars found', 'hud.res.newTool': 'New tool!', 'hud.res.record': 'New record!',
    'hud.next': 'Next', 'hud.again': 'Again', 'hud.notEnough': 'Not enough coins', 'hud.coins': 'Coins',
    'hud.shop': 'Shop', 'hud.daily': 'Gift', 'hud.wheel': 'Wheel', 'hud.codex': 'Codex',
    'hud.adBuy': 'Watch ad', 'hud.adIn': 'In {n} s', 'hud.double': 'x2 COINS: WATCH AD', 'hud.doubled': 'Doubled! +{n}',
    'hud.boost': 'Boost x2', 'hud.boostFull': 'Super boost: x2 power and x3 luck, 90 s', 'hud.boostSec': '{n} s', 'hud.boostOn': 'x2 · {t}',
    'hud.radar': 'Star radar', 'hud.radarFull': 'Star radar: highlights the sector stars (watch ad)', 'hud.radarOn': 'Radar · {t}',
    'hud.drone': 'Drone drop +50%', 'hud.droneFull': 'A drone takes your tank load: +50% coins (watch ad)',
    'hud.blastAd': 'Charge Glow: watch ad',
});

// Иконки: пути только строковыми литералами (сборщик находит ассеты по ним).
const GH_IC = {
    coin: 'assets/ui/ic_coin.webp', star: 'assets/ui/ic_star.webp', star_off: 'assets/ui/ic_star_off.webp',
    tank: 'assets/ui/ic_tank.webp', vac1: 'assets/ui/ic_vac1.webp', vac2: 'assets/ui/ic_vac2.webp',
    vac3: 'assets/ui/ic_vac3.webp', vac4: 'assets/ui/ic_vac4.webp', rocket: 'assets/ui/ic_rocket.webp',
    sell: 'assets/ui/ic_sell.webp', shop: 'assets/ui/ic_shop.webp', ore: 'assets/ui/ic_ore.webp',
    bunny: 'assets/ui/ic_bunny.webp', king: 'assets/ui/ic_king.webp', junk: 'assets/ui/ic_junk.webp',
    power: 'assets/ui/ic_power.webp', radius: 'assets/ui/ic_radius.webp', speed: 'assets/ui/ic_speed.webp',
    jet: 'assets/ui/ic_jet.webp', blast: 'assets/ui/ic_blast.webp', lock: 'assets/ui/ic_lock.webp',
    settings: 'assets/ui/ic_settings.webp', levels: 'assets/ui/ic_levels.webp', upgrades: 'assets/ui/ic_upgrades.webp',
    pause: 'assets/ui/ic_pause.webp', home: 'assets/ui/ic_home.webp', restart: 'assets/ui/ic_restart.webp',
    play: 'assets/ui/ic_play.webp', next: 'assets/ui/ic_next.webp', close: 'assets/ui/ic_close.webp',
    sound_on: 'assets/ui/ic_sound_on.webp', sound_off: 'assets/ui/ic_sound_off.webp',
    music_on: 'assets/ui/ic_music_on.webp', music_off: 'assets/ui/ic_music_off.webp',
    sparkle: 'assets/ui/ic_sparkle.webp', time: 'assets/ui/ic_time.webp', check: 'assets/ui/ic_check.webp',
    jump: 'assets/ui/ic_jump.webp', hand: 'assets/ui/ic_hand.webp', logo: (String(GAME_PLATFORM) === 'pikabu' ? 'assets/ui/logo-pikabu.webp' : 'assets/ui/logo.webp'),
    ad: 'assets/ui/ic_ad.webp', boost: 'assets/ui/ic_boost.webp', drone: 'assets/ui/ic_drone.webp', radar: 'assets/ui/ic_radar.webp',
    leaders: 'assets/ui/ic_leaders.webp',
    cosmetics: 'assets/ui/ic_cosmetics.webp', gift: 'assets/ui/ic_gift.webp', wheel: 'assets/ui/ic_wheel.webp', codex: 'assets/ui/ic_codex.webp',
};

const GH_CSS = `
.gh-root,.gh-wl{--ink:#10142e;font-family:'Rubik','Segoe UI',system-ui,sans-serif;font-weight:800;color:#fff;text-align:left;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none}
.gh-root *,.gh-wl *{box-sizing:border-box}
.gh-root img,.gh-wl img{display:block;pointer-events:none;-webkit-user-drag:none;user-select:none}
.gh-root [hidden],.gh-wl [hidden]{display:none!important}
.gh-root{position:fixed;inset:0;z-index:29;pointer-events:none}
.gh-wl{position:fixed;inset:0;z-index:90;pointer-events:none;--wf:clamp(10px,min(3.4vh,4.2vw),17px)}
.gh-root.gh-hasWin .gh-hud,.gh-root.gh-hasWin .gh-menu,.gh-root.gh-hasWin .gh-fx{visibility:hidden}
/* текст с контуром */
.gh-t{font-weight:900;color:#fff;-webkit-text-stroke:.2em var(--ink);paint-order:stroke fill;text-shadow:0 .1em 0 var(--ink);letter-spacing:.01em;line-height:1.1}
.gh-s{font-weight:700;-webkit-text-stroke:0;text-shadow:none}
/* кнопки */
.gh-btn{--c1:#7dff5a;--c2:#23c552;--sh:#0f8a38;position:relative;display:inline-flex;align-items:center;justify-content:center;gap:.45em;margin:0;padding:.4em 1em;min-height:2.7em;cursor:pointer;pointer-events:auto;font:inherit;color:#fff;border:.2em solid var(--ink);border-radius:.95em;background:linear-gradient(180deg,var(--c1) 0%,var(--c2) 100%);box-shadow:inset 0 .16em 0 rgba(255,255,255,.4),inset 0 -.26em 0 var(--sh),0 .3em 0 var(--ink);transition:transform .06s,box-shadow .06s,filter .15s;touch-action:manipulation;outline:none}
.gh-btn:hover{filter:brightness(1.08)}
.gh-btn:focus-visible{outline:.18em solid #fff;outline-offset:.1em}
.gh-btn:active,.gh-btn.dn{transform:translateY(.22em);box-shadow:inset 0 .16em 0 rgba(255,255,255,.4),inset 0 -.14em 0 var(--sh),0 .08em 0 var(--ink)}
.gh-btn.o{--c1:#ffc247;--c2:#ff8a1f;--sh:#c25a08}
.gh-btn.b{--c1:#5fd0ff;--c2:#2f7bff;--sh:#1a49b8}
.gh-btn.r{--c1:#ff7a7a;--c2:#e23636;--sh:#a31620}
.gh-btn.p{--c1:#c58bff;--c2:#8a3df0;--sh:#5a1fb0}
.gh-btn.t{--c1:#6ff0e6;--c2:#16b5b0;--sh:#0b7d7a}
.gh-btn.y{--c1:#ffe873;--c2:#ffbf1a;--sh:#b07d08}
.gh-btn.x{--c1:#b9bfd6;--c2:#8c93b0;--sh:#5d6483}
.gh-dot{position:absolute;right:-.4em;top:-.4em;width:1.15em;height:1.15em;border:.16em solid var(--ink);border-radius:50%;background:radial-gradient(circle at 35% 30%,#ff9a9a,#e22 70%);box-shadow:0 .1em 0 var(--ink);animation:gh-pulse 1s ease-in-out infinite;pointer-events:none;z-index:3}
.gh-adbadge{position:absolute;right:-.45em;top:-.5em;min-width:1.6em;height:1.6em;display:flex;align-items:center;justify-content:center;border:.16em solid var(--ink);border-radius:50%;background:linear-gradient(180deg,#c58bff,#8a3df0);box-shadow:0 .12em 0 var(--ink);pointer-events:none;z-index:3;font-size:.8em}
.gh-adbadge img{width:78%;height:78%}
.gh-adbadge.dim{background:linear-gradient(180deg,#b9bfd6,#8c93b0)}
.gh-adbadge .gh-t{font-size:.8em;-webkit-text-stroke:.16em var(--ink)}
.gh-btn img{width:1.5em;height:1.5em;flex:none}
.gh-pulse{animation:gh-pulse .9s ease-in-out infinite}
.gh-shake{animation:gh-shake .35s}
@keyframes gh-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
@keyframes gh-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-.35em)}45%{transform:translateX(.35em)}70%{transform:translateX(-.2em)}}
@keyframes gh-bump{0%{transform:scale(1)}40%{transform:scale(1.16) rotate(-2deg)}100%{transform:scale(1)}}
@keyframes gh-fade{from{opacity:0}to{opacity:1}}
@keyframes gh-pop{0%{transform:scale(.8);opacity:0}60%{transform:scale(1.06);opacity:1}100%{transform:scale(1)}}
@keyframes gh-boom{0%{transform:scale(0) rotate(-40deg);opacity:0}55%{transform:scale(1.5) rotate(12deg);opacity:1}100%{transform:scale(1) rotate(0);opacity:1}}
@keyframes gh-alarm{0%,100%{box-shadow:inset 0 .18em 0 rgba(0,0,0,.4),0 .2em 0 var(--ink),0 0 0 rgba(255,60,60,0)}50%{box-shadow:inset 0 .18em 0 rgba(0,0,0,.4),0 .2em 0 var(--ink),0 0 1.1em .3em rgba(255,60,60,.85)}}
@keyframes gh-bob{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(-.55em)}}
@keyframes gh-bobi{0%,100%{transform:translateY(-50%)}50%{transform:translateY(calc(-50% - .35em))}}
@keyframes gh-glow{0%,100%{filter:drop-shadow(0 0 .2em rgba(255,214,70,.6))}50%{filter:drop-shadow(0 0 .8em rgba(255,214,70,1))}}
/* блоки HUD */
.gh-b{font-size:calc(var(--hl-k,1)*16px);pointer-events:none}
.gh-bar{position:relative;width:100%;height:2.1em;--f1:#9bffe9;--f2:#2fd6a0;--f3:#16b57d}
.gh-bar-t{position:absolute;left:1.2em;right:0;top:.1em;bottom:.1em;border:.2em solid var(--ink);border-radius:999px;background:#0d1230;overflow:hidden;box-shadow:inset 0 .18em 0 rgba(0,0,0,.4),0 .2em 0 var(--ink)}
.gh-bar-f{position:relative;height:100%;width:0;min-width:0;border-radius:999px;background:linear-gradient(180deg,var(--f1),var(--f2) 55%,var(--f3));transition:width .35s ease}
.gh-bar-f::after{content:'';position:absolute;left:.4em;right:.4em;top:.15em;height:.28em;border-radius:99px;background:rgba(255,255,255,.5)}
.gh-bar-i{position:absolute;left:0;top:50%;width:2.7em;height:2.7em;transform:translateY(-50%);z-index:2}
.gh-bar-x{position:absolute;left:1.2em;right:0;top:0;bottom:0;display:flex;align-items:center;justify-content:center;z-index:1;font-size:.95em;white-space:nowrap}
.gh-top{display:flex;flex-direction:column;align-items:center;gap:.3em}
/* низкое и альбомное окно: сектор и цель скрыты, остаётся одна строка с полосой чистоты (в обучении тоже) */
.hl-low .gh-sector,.hl-land .gh-sector,.hl-low #gh-obj,.hl-land #gh-obj{display:none}
.gh-sector{max-width:100%;padding:.2em 1em .3em;border:.17em solid var(--ink);border-radius:999px;background:linear-gradient(180deg,#4a5bd0,#2a3590);box-shadow:inset 0 .13em 0 rgba(255,255,255,.35),0 .2em 0 var(--ink);font-size:.9em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gh-boss{--f1:#ff9d9d;--f2:#ee3d3d;--f3:#b01524}
.gh-boss .gh-bar-x{justify-content:flex-start;padding-left:1.9em}
.gh-obj{padding:.3em 1em .4em;border:.17em solid var(--ink);border-radius:.8em;background:linear-gradient(180deg,#fff6cf,#ffe28a);box-shadow:inset 0 .12em 0 rgba(255,255,255,.7),0 .2em 0 var(--ink);color:#4a3200;font-size:.85em;text-align:center;font-weight:800;width:fit-content;max-width:100%;margin:0 auto;line-height:1.2}
.gh-toast{width:fit-content;max-width:100%;margin:0 auto;padding:.35em 1.1em .45em;border:.17em solid var(--ink);border-radius:999px;font-size:.95em;text-align:center;animation:gh-toast 2.2s both;background:linear-gradient(180deg,#5fd0ff,#2f7bff);box-shadow:inset 0 .13em 0 rgba(255,255,255,.4),0 .25em 0 var(--ink)}
.gh-toast.good{background:linear-gradient(180deg,#7dff5a,#23c552)}
.gh-toast.warn{background:linear-gradient(180deg,#ffc247,#ff8a1f)}
@keyframes gh-toast{0%{transform:translateY(-.8em) scale(.8);opacity:0}9%{transform:translateY(0) scale(1.07);opacity:1}15%{transform:scale(1)}86%{opacity:1}100%{opacity:0;transform:translateY(-.4em)}}
.gh-coins{position:relative;height:100%;display:flex;align-items:center;justify-content:flex-end;padding:0 .8em 0 2.3em;border:.2em solid var(--ink);border-radius:999px;background:linear-gradient(180deg,#2d3a8c,#171d52);box-shadow:inset 0 .15em 0 rgba(255,255,255,.25),0 .25em 0 var(--ink)}
.gh-coins>img{position:absolute;left:-.3em;top:50%;width:3.4em;height:3.4em;transform:translateY(-50%)}
.gh-coins .gh-t{font-size:1.5em}
.gh-bump{animation:gh-bump .35s cubic-bezier(.3,1.8,.5,1)}
.gh-stars{height:100%;display:flex;align-items:center;justify-content:center;gap:.1em;padding:0 .5em;border:.18em solid var(--ink);border-radius:999px;background:linear-gradient(180deg,#2d3a8c,#171d52);box-shadow:inset 0 .13em 0 rgba(255,255,255,.25),0 .22em 0 var(--ink)}
.gh-stars img{width:2em;height:2em}
.gh-stars img.pop{animation:gh-boom .6s both}
.gh-pausebtn{width:100%;height:100%;padding:0;pointer-events:auto}
.gh-pausebtn img{width:56%;height:56%}
.gh-side{display:flex;flex-direction:column;gap:.45em}
.gh-sq{position:relative;flex:none;width:4.4em;height:3.8em;min-height:0;flex-direction:column;gap:.05em;padding:.2em .1em .3em}
.gh-sq img{width:2em;height:2em}
.gh-sq .gh-t{font-size:.62em}
.hl-low .gh-side{display:grid;grid-template-columns:repeat(2,max(2.9em,44px));gap:.4em}
.hl-low .gh-sq{width:max(2.9em,44px);height:max(2.9em,44px);padding:.2em}
.hl-low .gh-sq .gh-t{display:none}
.hl-low .gh-sq img{width:68%;height:auto;max-height:80%}
/* HUD: буст, радар, дрон */
.gh-hb{display:flex;flex-direction:column;align-items:stretch;gap:.25em}
.gh-hb .gh-btn{width:100%;height:100%;min-width:0;min-height:0;padding:.2em .6em .3em .4em;gap:.35em;pointer-events:auto;justify-content:flex-start}
.gh-hb .gh-chip{width:100%;height:100%;min-width:0}
.gh-hb .gh-bt{min-width:0;overflow:hidden}
.gh-hb .gh-t{overflow:hidden;text-overflow:ellipsis;max-width:100%;padding:.1em 0}
.gh-hb .gh-btn img{width:1.7em;height:1.7em}
.gh-hb .gh-btn .gh-t{font-size:.8em;white-space:nowrap}
.gh-hb .gh-btn .gh-sub{display:block;font-size:.6em;margin-top:.1em;white-space:nowrap;line-height:1}
.gh-hb .gh-bt{display:flex;flex-direction:column;align-items:flex-start;min-width:0}
.gh-chip{display:flex;flex-direction:column;justify-content:center;gap:.2em;padding:.2em .8em .25em .4em;border:.2em solid var(--ink);border-radius:999px;background:linear-gradient(180deg,#ffe36a,#ff9d1f);box-shadow:inset 0 .13em 0 rgba(255,255,255,.5),0 .22em 0 var(--ink);animation:gh-glowbox 1s ease-in-out infinite}
.gh-chip.cy{background:linear-gradient(180deg,#8affc7,#1fc58a)}
.gh-chiprow{display:flex;align-items:center;gap:.4em}
.gh-chiprow img{width:1.7em;height:1.7em}
.gh-chiprow .gh-t{font-size:.95em;white-space:nowrap;font-variant-numeric:tabular-nums}
.gh-chipbar{height:.45em;border-radius:99px;background:rgba(16,20,46,.55);overflow:hidden;margin:0 .2em}
.gh-chipbar i{display:block;height:100%;width:100%;background:#fff;border-radius:99px;transition:width 1s linear}
@keyframes gh-glowbox{0%,100%{filter:drop-shadow(0 0 .1em rgba(255,214,70,.4))}50%{filter:drop-shadow(0 0 .6em rgba(255,214,70,1))}}
.hl-low .gh-hb .gh-btn{padding:.2em;justify-content:center}
.hl-low .gh-hb .gh-btn .gh-bt{display:none}
.hl-low .gh-hb .gh-btn img{width:1.9em;height:1.9em}
.hl-low .gh-chip{padding:.15em .5em .2em .3em}
.hl-low .gh-hb.gh-drone .gh-btn{justify-content:flex-start;padding:.2em .6em .3em .4em}
.hl-low .gh-hb.gh-drone .gh-btn .gh-bt{display:flex}
.hl-low .gh-hb.gh-drone .gh-btn img{width:1.7em;height:1.7em}
.gh-tankb{--f1:#ffc77a;--f2:#e98a3a;--f3:#b8561c}
.gh-tankb.full{--f1:#ff9d9d;--f2:#ee3d3d;--f3:#b01524}
.gh-tankb.full .gh-bar-t{animation:gh-alarm .55s infinite}
.gh-tankb.full .gh-bar-i{animation:gh-bobi .55s infinite}
.gh-blastb{display:flex;align-items:flex-end;justify-content:flex-end;gap:.6em}
.gh-fuelw{display:flex;flex-direction:column;align-items:center;gap:.15em;margin-bottom:.2em}
.gh-fuelw img{width:1.7em;height:1.7em}
.gh-fuel{position:relative;width:1.4em;height:3.2em;border:.18em solid var(--ink);border-radius:999px;background:#0d1230;overflow:hidden;box-shadow:0 .2em 0 var(--ink)}
.gh-fuel i{position:absolute;left:0;right:0;bottom:0;height:var(--f,100%);background:linear-gradient(90deg,#9ae6ff,#2f9bff);transition:height .2s}
.gh-fuelw.low .gh-fuel i{background:linear-gradient(90deg,#ff9d9d,#e23636);animation:gh-pulse .5s infinite}
.gh-blast{position:relative;width:5.2em;height:5.2em;padding:0;margin:0;border:.2em solid var(--ink);border-radius:50%;cursor:pointer;pointer-events:auto;background:conic-gradient(#ffd23f calc(var(--p,0)*1turn),#0d1230 0);box-shadow:0 .3em 0 var(--ink);touch-action:manipulation;outline:none;transition:transform .06s}
.gh-blast:active{transform:translateY(.2em)}
.gh-blast-in{position:absolute;inset:.45em;border:.17em solid var(--ink);border-radius:50%;background:linear-gradient(180deg,#8a93b8,#565d84);box-shadow:inset 0 .14em 0 rgba(255,255,255,.35),inset 0 -.2em 0 rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center}
.gh-blast-in img{width:68%;height:68%;filter:grayscale(.6) brightness(.85)}
.gh-blast.rdy{animation:gh-pulse .8s ease-in-out infinite;box-shadow:0 .3em 0 var(--ink),0 0 1em .2em rgba(255,214,70,.8)}
.gh-blast.rdy .gh-blast-in{background:linear-gradient(180deg,#ffc247,#ff8a1f)}
.gh-blast.rdy .gh-blast-in img{filter:none}
.gh-blast .gh-adbadge{right:-.7em;top:-.55em;font-size:1em}
.gh-blast .gh-t{position:absolute;left:50%;bottom:-.7em;transform:translateX(-50%);font-size:.6em;white-space:nowrap}
.gh-key{position:absolute;left:-.5em;top:-.4em;width:1.7em;height:1.7em;display:flex;align-items:center;justify-content:center;border:.15em solid var(--ink);border-radius:.4em;background:#fff;color:var(--ink);box-shadow:0 .15em 0 var(--ink);font-size:.9em;font-weight:900;z-index:2}
.hl-touch .gh-key{display:none}
/* плавающие числа и указатель */
.gh-fx{position:absolute;inset:0;pointer-events:none}
.gh-fl{position:absolute;display:flex;align-items:center;gap:.25em;font-size:clamp(16px,2.8vh,26px);white-space:nowrap;animation:gh-float 1.1s ease-out forwards}
.gh-fl img{width:1.1em;height:1.1em}
.gh-fl.dirt{font-size:clamp(13px,2.2vh,20px)}
.gh-fl.coin .gh-t{color:#ffe35a}
.gh-fl.star .gh-t{color:#fff27a;font-size:1.3em}
.gh-fl.bad .gh-t{color:#ff6b6b}
.gh-fl.dirt .gh-t{color:#f0d9b5}
@keyframes gh-float{0%{transform:translate(-50%,-50%) scale(.5);opacity:0}14%{transform:translate(-50%,-70%) scale(1.25);opacity:1}30%{transform:translate(-50%,-90%) scale(1)}100%{transform:translate(-50%,calc(-50% - 80px)) scale(1);opacity:0}}
.gh-pon{position:absolute;left:0;top:0;width:0;height:0;font-size:clamp(13px,2.4vh,18px)}
.gh-pon-in{position:absolute;left:0;bottom:.5em;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;animation:gh-bob .7s ease-in-out infinite}
.gh-pon-in svg{width:2.4em;height:2.4em;filter:drop-shadow(0 .15em 0 rgba(16,20,46,.6))}
.gh-pon-in .gh-t{font-size:.8em;white-space:nowrap;margin-bottom:.1em}
.gh-pe{position:absolute;left:0;top:0;width:0;height:0;font-size:clamp(13px,2.4vh,18px)}
.gh-pe-arrow{position:absolute;left:0;top:0;width:0;height:0}
.gh-pe-arrow svg{position:absolute;left:1.55em;top:-.85em;width:1.1em;height:1.7em;overflow:visible;filter:drop-shadow(0 .12em 0 rgba(16,20,46,.6))}
.gh-pe-bubble{position:absolute;left:-1.5em;top:-1.5em;width:3em;height:3em;display:flex;align-items:center;justify-content:center;border:.2em solid var(--ink);border-radius:50%;background:linear-gradient(180deg,var(--c1,#5fd0ff),var(--c2,#2f7bff));box-shadow:inset 0 .13em 0 rgba(255,255,255,.4),0 .22em 0 var(--ink);animation:gh-pulse .9s ease-in-out infinite}
.gh-pe-bubble img{width:68%;height:68%}
.gh-pe-label{position:absolute;left:0;top:1.9em;white-space:nowrap;font-size:.8em}
.gh-pe.up .gh-pe-label{top:-3.1em}
/* окна */
.gh-ov{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:2.2em .6em .8em;font-size:var(--wf);pointer-events:auto;background:radial-gradient(ellipse at center,rgba(12,16,52,.5),rgba(6,8,28,.82));animation:gh-fade .2s both}
.gh-win{--c1:#5fd0ff;--c2:#2f7bff;position:relative;pointer-events:auto;display:flex;flex-direction:column;width:min(40em,100%);max-height:100%;padding:2.1em .9em .9em;border:.25em solid var(--ink);border-radius:1.4em;background:linear-gradient(180deg,#1b2250,#141a3a);box-shadow:inset 0 .2em 0 rgba(255,255,255,.16),0 .5em 0 rgba(0,0,0,.35),0 1.4em 3em rgba(0,0,0,.5);animation:gh-pop .4s cubic-bezier(.2,1.5,.4,1) both}
.gh-ribbon{position:absolute;left:50%;top:-1.4em;transform:translateX(-50%);max-width:84%;padding:.3em 1.6em .4em;border:.2em solid var(--ink);border-radius:.95em;background:linear-gradient(180deg,var(--c1),var(--c2));box-shadow:inset 0 .15em 0 rgba(255,255,255,.4),0 .28em 0 var(--ink);font-size:1.45em;white-space:nowrap;text-align:center;z-index:3}
.gh-x{position:absolute;right:-.7em;top:-.7em;width:max(2.4em,40px);height:max(2.4em,40px);padding:0;min-height:0;border-radius:50%;z-index:4}
.gh-x img{width:56%;height:56%}
.gh-wb{overflow:auto;overscroll-behavior:contain;flex:1 1 auto;min-height:0;padding:.35em .25em .5em;margin:0 -.25em;-webkit-overflow-scrolling:touch;scrollbar-width:thin}
.gh-card{background:linear-gradient(180deg,#fff,#e4e9ff);color:#1b2250;border:.2em solid var(--ink);border-radius:1em;box-shadow:inset 0 .15em 0 #fff,0 .25em 0 var(--ink)}
.gh-n{font-weight:900;color:#1b2250;font-size:1.05em;line-height:1.1}
.gh-card .gh-s{color:#4a5384}
.gh-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,17em),1fr));gap:.9em .8em;padding:.2em .1em .4em}
.gh-pill{display:inline-flex;align-items:center;gap:.4em;height:2.4em;padding:0 .9em 0 .5em;border:.18em solid var(--ink);border-radius:999px;background:linear-gradient(180deg,#2d3a8c,#171d52);box-shadow:inset 0 .13em 0 rgba(255,255,255,.25),0 .2em 0 var(--ink)}
.gh-pill img{width:1.8em;height:1.8em}
.gh-pill .gh-t{font-size:1.1em}
.gh-uphead{display:flex;align-items:center;justify-content:space-between;gap:.8em;flex-wrap:wrap;padding:.2em .1em .8em}
.gh-tool{display:flex;align-items:center;gap:.6em;padding:.3em 1em .3em .4em;flex:1 1 12em;min-width:0}
.gh-tool img{width:2.8em;height:2.8em;flex:none}
.gh-tool .gh-s{font-size:.8em;display:block}
.gh-up{display:flex;flex-direction:column;gap:.45em;padding:.7em .7em .8em}
.gh-up-top{display:flex;gap:.7em;align-items:flex-start}
.gh-up-ic{flex:none;width:3.6em;height:3.6em;display:flex;align-items:center;justify-content:center;border:.17em solid var(--ink);border-radius:.8em;background:linear-gradient(180deg,#ffe9a8,#ffc247)}
.gh-up-ic img{width:78%;height:78%}
.gh-up-info{min-width:0;flex:1}
.gh-up-info .gh-s{font-size:.82em;line-height:1.25;margin-top:.15em}
.gh-pips{display:flex;align-items:center;gap:.25em;flex-wrap:wrap}
.gh-pips i{width:1.1em;height:.7em;border:.13em solid var(--ink);border-radius:99px;background:#b8c0e6}
.gh-pips i.on{background:linear-gradient(180deg,#7dff5a,#23c552)}
.gh-pips b{margin-left:auto;font-size:.8em;color:#4a5384;font-weight:800}
.gh-st{display:flex;align-items:center;gap:.5em;font-size:.85em;color:#4a5384;min-height:1.2em}
.gh-st b{color:#1b8a3c;font-weight:900}
.gh-upb{display:flex;flex-wrap:wrap;gap:.5em}
.gh-upb .gh-btn{min-height:2.6em}
.gh-buy{flex:1 1 6em;min-width:0}
.gh-buy .gh-t{font-size:1.05em}
.gh-adbtn{flex:2 1 9em;min-width:0;padding:.3em .6em}
.gh-adbtn .gh-t{font-size:.95em;white-space:nowrap}
.gh-dblw{flex:none;display:flex;justify-content:center;padding:.6em .3em 0}
.gh-dbl{width:100%;min-height:3.2em}
.gh-dbl .gh-t{font-size:1.1em}
.gh-dbldone{width:100%;display:flex;align-items:center;justify-content:center;gap:.5em;min-height:3.2em;border:.2em solid var(--ink);border-radius:.95em;background:linear-gradient(180deg,#2d3a8c,#171d52);box-shadow:inset 0 .12em 0 rgba(255,255,255,.25),0 .25em 0 var(--ink);animation:gh-boom .55s cubic-bezier(.3,1.4,.5,1) both}
.gh-dbldone img{width:1.8em;height:1.8em}
.gh-dbldone .gh-t{font-size:1.15em;color:#ffe35a}
.gh-max{display:flex;align-items:center;justify-content:center;min-height:2.6em;border:.17em dashed #9aa3d0;border-radius:.9em;color:#6a73a8;font-weight:900}
.gh-lvgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,9.6em),1fr));gap:.9em .8em;padding:.3em .2em .5em}
.gh-lv{position:relative;display:flex;flex-direction:column;align-items:center;gap:.3em;padding:1.5em .5em .6em;font:inherit;cursor:pointer;text-align:center;touch-action:manipulation;transition:transform .06s}
.gh-lv:active{transform:translateY(.2em)}
.gh-lv-n{position:absolute;left:50%;top:-.9em;transform:translateX(-50%);min-width:2.1em;height:2.1em;display:flex;align-items:center;justify-content:center;border:.17em solid var(--ink);border-radius:50%;background:linear-gradient(180deg,#5fd0ff,#2f7bff);box-shadow:0 .18em 0 var(--ink)}
.gh-lv-n .gh-t{font-size:1.1em}
.gh-lv-st{display:flex;gap:.1em}
.gh-lv-st img{width:1.7em;height:1.7em}
.gh-lv .gh-n{min-height:2.2em;display:flex;align-items:center}
.gh-lv.cur{box-shadow:inset 0 .15em 0 #fff,0 .25em 0 var(--ink),0 0 0 .2em #ffc247}
.gh-lv.done .gh-lv-n{background:linear-gradient(180deg,#7dff5a,#23c552)}
.gh-lv.lock{cursor:default;filter:grayscale(.85);opacity:.85}
.gh-lv.lock .gh-lv-n{background:linear-gradient(180deg,#b9bfd6,#8c93b0)}
.gh-lv-lock{position:absolute;right:.4em;top:.7em;width:1.8em;height:1.8em}
.gh-lv-tag{position:absolute;right:-.4em;bottom:-.5em;padding:.1em .6em .2em;border:.15em solid var(--ink);border-radius:99px;background:linear-gradient(180deg,#ffc247,#ff8a1f);font-size:.7em}
.gh-set{display:flex;flex-direction:column;gap:.8em;padding:.4em .2em .4em}
.gh-row{display:flex;align-items:center;gap:.7em;padding:.5em .7em;min-height:3.4em}
.gh-row>img{width:2.2em;height:2.2em;flex:none}
.gh-row .gh-n{flex:1}
.gh-sw{min-width:5.2em}
.gh-sw.off{--c1:#b9bfd6;--c2:#8c93b0;--sh:#5d6483}
.gh-seg{display:grid;grid-template-columns:1fr 1fr;gap:.5em;flex:1 1 100%}
.gh-seg .gh-btn{flex:1 1 4em;padding:.3em .4em;min-height:2.4em}
.gh-seg .gh-btn .gh-t{font-size:.9em}
.gh-menuwin{width:min(26em,100%)}
.gh-pause{display:grid;gap:.8em;padding:.5em .6em .5em}
.gh-pause .gh-btn{width:100%;min-height:3em}
.gh-pause .gh-btn .gh-t{font-size:1.15em}
.gh-res{width:min(32em,100%)}
.gh-res-sub{text-align:center;margin:0 0 .3em;font-size:.95em;color:#aeb7ee;font-weight:800}
.gh-res-cols{display:flex;flex-direction:column;gap:.8em}
.gh-res-l,.gh-res-r{display:flex;flex-direction:column;gap:.7em;min-width:0}
.gh-rstars{display:flex;justify-content:center;align-items:flex-end;gap:.2em;padding:.2em 0}
.gh-rs{width:5.2em;height:5.2em;opacity:0}
.gh-rs:nth-child(2){width:6.4em;height:6.4em;margin-bottom:.5em}
.gh-rs.on{animation:gh-boom .65s cubic-bezier(.3,1.4,.5,1) both;animation-delay:calc(.35s + var(--i)*.5s)}
.gh-rs.off{opacity:1}
.gh-rrow{display:flex;align-items:center;gap:.6em;padding:.35em .8em .35em .5em}
.gh-rrow>img{width:2em;height:2em;flex:none}
.gh-rrow .gh-n{flex:1}
.gh-rrow .gh-v{font-weight:900;font-size:1.2em;color:#1b2250}
.gh-rrow .gh-v.c{color:#d9700a}
.gh-rrow .gh-v.bn{color:#1b8a3c}
.gh-rec{align-self:center;padding:.1em .9em .25em;border:.15em solid var(--ink);border-radius:99px;background:linear-gradient(180deg,#ffc247,#ff8a1f);animation:gh-pulse .8s infinite;font-size:.9em}
.gh-newtool{display:flex;align-items:center;gap:.7em;padding:.4em .8em .4em .5em;background:linear-gradient(180deg,#e8ffe0,#b8f59a)}
.gh-newtool img{width:3.2em;height:3.2em;flex:none;animation:gh-glow 1.2s infinite}
.gh-newtool .gh-s{font-size:.8em;display:block;color:#2c6a1a}
.gh-resbtns{flex:none;display:flex;flex-wrap:wrap;gap:.7em;justify-content:center;padding:.7em .3em .2em}
.gh-resbtns .gh-btn{flex:1 1 7em}
.gh-resbtns .gh-btn.big{flex:1 1 100%;min-height:3.2em}
.gh-resbtns .gh-t{font-size:1.05em}
@media (max-height:640px) and (min-aspect-ratio:3/2){
  .gh-res{width:min(46em,100%)}
  .gh-res-cols{flex-direction:row;align-items:center;gap:1em}
  .gh-res-l,.gh-res-r{flex:1 1 0}
  .gh-rs{width:3.8em;height:3.8em}.gh-rs:nth-child(2){width:4.6em;height:4.6em}
  .gh-res-r{gap:.45em}.gh-rrow{padding:.1em .7em .1em .4em}.gh-rrow>img{width:1.6em;height:1.6em}.gh-rrow .gh-v{font-size:1.05em}
  .gh-dblw{padding-top:.4em}.gh-dbl,.gh-dbldone{min-height:2.6em}
  .gh-resbtns{flex-wrap:nowrap;padding-top:.5em}.gh-resbtns .gh-btn,.gh-resbtns .gh-btn.big{flex:1 1 0;min-height:2.8em}
  .gh-res-sub{margin:-.2em 0 .1em}
  .gh-pause{grid-template-columns:1fr 1fr}.gh-pause .gh-btn:first-child{grid-column:1/-1}
  .gh-menuwin{width:min(30em,100%)}
  .gh-grid{grid-template-columns:repeat(auto-fill,minmax(min(100%,15em),1fr))}
}
/* главное меню */
.gh-menu{position:absolute;inset:0;pointer-events:none;font-size:clamp(11px,calc(6px + 1.4vh),17px)}
.gh-menu::before{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(8,10,38,.62) 0%,rgba(8,10,38,.3) 38%,rgba(8,10,38,0) 62%)}
.gh-menu-box{position:absolute;left:max(4vw,env(safe-area-inset-left,0px) + 14px);top:50%;transform:translateY(-50%);width:min(46vw,540px);display:flex;flex-direction:column;align-items:center;gap:min(2.2vh,1.1em)}
.gh-logo{width:100%;max-height:34vh;object-fit:contain;filter:drop-shadow(0 .4em .5em rgba(0,0,0,.45));animation:gh-pop .6s cubic-bezier(.2,1.5,.4,1) both}
.gh-play{width:100%;min-height:4.2em;font-size:1.5em;animation:gh-pulse 1.1s ease-in-out infinite}
.gh-play .gh-t{font-size:1.2em;letter-spacing:.06em}
.gh-play img{width:1.3em;height:1.3em}
.gh-menu-row{display:flex;gap:.7em;width:100%}
.gh-menu-row .gh-btn{flex:1 1 0;flex-direction:column;gap:.15em;padding:.35em .3em .45em;min-height:4.2em;min-width:0}
.gh-menu-row .gh-btn img{width:1.9em;height:1.9em}
.gh-menu-row .gh-t{font-size:.85em;white-space:nowrap}
.gh-menu-row .gh-btn{position:relative}
.gh-menu .gh-btn{pointer-events:auto}
@media (max-aspect-ratio:1/1){
  .gh-menu{font-size:clamp(12px,min(4.2vw,2.4vh),22px)}
  .gh-menu::before{background:linear-gradient(180deg,rgba(8,10,38,.6) 0%,rgba(8,10,38,0) 34%,rgba(8,10,38,0) 58%,rgba(8,10,38,.65) 100%)}
  .gh-menu-box{left:0;right:0;top:0;bottom:0;width:auto;transform:none;justify-content:space-between;padding:max(3vh,env(safe-area-inset-top,0px) + 10px) 6vw max(4vh,env(safe-area-inset-bottom,0px) + 14px)}
  .gh-logo{width:min(88vw,470px);max-height:26vh}
  .gh-menu-bot{width:min(92vw,430px);display:flex;flex-direction:column;gap:1em}
}
@media (min-aspect-ratio:1/1){.gh-menu-bot{display:contents}}
@media (max-height:440px) and (min-aspect-ratio:1/1){
  .gh-menu-box{gap:.5em;width:min(44vw,420px)}
  .gh-logo{max-height:36vh}
  .gh-play{min-height:3.4em}
  .gh-menu-row{gap:.5em}
  .gh-menu-row .gh-btn{min-height:2.9em;padding:.2em .2em .3em;gap:.05em}
  .gh-menu-row .gh-btn img{width:1.5em;height:1.5em}
  .gh-menu-row .gh-t{font-size:.75em}
}
@media (max-aspect-ratio:1/1){
  .gh-menu-row{gap:.5em}
  .gh-menu-row .gh-t{font-size:.8em}
}
`;

/** Состояние интерфейса. */
/** @type {any} */
const GH = {
    inited: false, h: /** @type {any} */ ({}), screen: 'hidden', win: '', back: '', lastAct: 0,
    sound: true, music: true, quality: 'auto',
    coinsShown: 0, coinsFrom: 0, coinsTo: 0, coinsT0: 0, coinsDur: 400, coinsRaf: 0, coinsInit: false,
    toasts: /** @type {any[]} */ ([]), toastBusy: false, toastTimer: 0,
    upModel: null, lvModel: null, ptrKey: '', ptrMode: 0,
    // реклама (GameHud.setAds), буст, радар, дрон, заряд «Сияния», окно результата, затемнение окнами GameMetaUI
    ads: { supported: false, wait: 0 }, adBusy: false, adBusyTimer: 0,
    boost: 0, boostMax: 0, boostLen: 90, radar: /** @type {any} */ ('hidden'), radarMax: 0, drone: false, blastCharge: 0, coverOn: false,
    res: /** @type {any} */ (null), badges: { daily: false, wheel: false, codex: false },
};

const ghEsc = (/** @type {any} */ s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ghT = (/** @type {string} */ k, /** @type {any} */ p = undefined) => Lang.t(k, p);
const ghQ = (/** @type {any} */ r, /** @type {string} */ s) => /** @type {any} */ (r.querySelector(s));
const ghFmt = (/** @type {number} */ n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const ghTime = (/** @type {any} */ s) => {
    if (s == null || !isFinite(s)) return '—';
    const t = Math.max(0, Math.round(s)), m = Math.floor(t / 60);
    return m + ':' + String(t % 60).padStart(2, '0');
};
const ghImg = (/** @type {string} */ src, /** @type {string} */ cls = '') => '<img src="' + ghEsc(src) + '"' + (cls ? ' class="' + cls + '"' : '') + ' alt="" draggable="false">';
/** Значение иконки из модели игры: путь к файлу, имя из набора или пусто. */
const ghIcon = (/** @type {any} */ v) => {
    const s = String(v || '');
    if (!s) return GH_IC.ore;
    if (/[\/.]/.test(s)) return s;
    return /** @type {any} */ (GH_IC)[s] || /** @type {any} */ (GH_IC)[s.replace(/^ic_/, '')] || GH_IC.ore;
};
const ghEl = (/** @type {string} */ tag, /** @type {string} */ cls, /** @type {string} */ html = undefined) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return /** @type {any} */ (e);
};
const ghCall = (/** @type {string} */ name, /** @type {any[]} */ ...args) => {
    const f = GH.h && GH.h[name];
    if (typeof f === 'function') { try { f(...args); } catch (e) { console.error('GameHud.' + name, e); } }
};
const ghLayout = () => { if (typeof HudLayout !== 'undefined' && HudLayout._inited) HudLayout.schedule(); };
/** Защита от двойного нажатия: true — действие разрешено. */
const ghGuard = () => {
    const t = Date.now();
    if (t - GH.lastAct < 300) return false;
    GH.lastAct = t;
    return true;
};
/** Рекламу сейчас можно предлагать (площадка умеет rewarded). */
const ghAdsOn = () => !!GH.ads.supported;
/** Подпись «Через N с», если идёт общая пауза между просмотрами, иначе ''. */
const ghAdWait = () => (GH.ads.wait > 0 ? ghT('hud.adIn', { n: Math.ceil(GH.ads.wait) }) : '');
const ghShake = (/** @type {any} */ b) => { b.classList.remove('gh-shake'); void b.offsetWidth; b.classList.add('gh-shake'); };
/** Нажатие на рекламную кнопку: пауза/просмотр идёт — тряска; иначе защита от двойного нажатия и колбэк игры. */
const ghAdPress = (/** @type {any} */ b, /** @type {string} */ name, /** @type {any[]} */ ...args) => {
    if (GH.adBusy || GH.ads.wait > 0 || b.classList.contains('x')) { ghShake(b); return; }
    if (!ghGuard()) return;
    GH.adBusy = true;
    const free = () => {
        if (typeof Platform !== 'undefined' && Platform.adActive) { GH.adBusyTimer = setTimeout(free, 500); return; }
        GH.adBusy = false; GH.adBusyTimer = 0;
    };
    clearTimeout(GH.adBusyTimer);
    GH.adBusyTimer = setTimeout(free, 2500);
    ghCall(name, ...args);
};
/** Число плавно меняется from -> to; запасной таймер ставит итог, даже если вкладка в фоне и rAF стоит. */
const ghCount = (/** @type {any} */ el, /** @type {number} */ from, /** @type {number} */ to, /** @type {number} */ ms, /** @type {string} */ pre) => {
    const t0 = performance.now();
    const set = (/** @type {number} */ v) => { el.textContent = pre + ghFmt(v); };
    const tick = () => {
        if (!el.isConnected) return;
        const k = Math.min(1, (performance.now() - t0) / ms), e = 1 - Math.pow(1 - k, 3);
        set(from + (to - from) * e);
        if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    setTimeout(() => { if (el.isConnected) set(to); }, ms + 150);
};
const ghAdIcon = () => ghImg(GH_IC.ad);
const ghT_ = (/** @type {string} */ k, /** @type {string} */ size = '') => '<span class="gh-t"' + (size ? ' style="font-size:' + size + '"' : '') + '>' + ghEsc(ghT(k)) + '</span>';

/** @satisfies {Record<string, any>} */
const GameHud = {
    /** Имя открытого окна или ''. */
    isOpen: '',

    // =====================================================================================
    // Запуск
    // =====================================================================================
    init(h) {
        if (GH.inited) return;
        GH.inited = true;
        GH.h = h || {};
        const st = document.createElement('style');
        st.id = 'gh-css';
        st.textContent = GH_CSS;
        document.head.appendChild(st);

        const root = GH.root = ghEl('div', 'gh-root');
        root.innerHTML =
            '<div class="gh-hud" id="gh-hud" hidden>' +
            // верх: сектор + чистота
            '<div class="gh-b gh-top" id="gh-top"><div class="gh-sector"><span class="gh-t" id="gh-sectxt"></span></div>' +
            '<div class="gh-bar" id="gh-prog">' + ghImg(GH_IC.sparkle, 'gh-bar-i') + '<div class="gh-bar-t"><div class="gh-bar-f" id="gh-progf"></div></div><div class="gh-bar-x"><span class="gh-t" id="gh-progt">0%</span></div></div></div>' +
            // босс, цель, тост
            '<div class="gh-b" id="gh-boss" hidden><div class="gh-bar gh-boss">' + ghImg(GH_IC.king, 'gh-bar-i') + '<div class="gh-bar-t"><div class="gh-bar-f" id="gh-bossf"></div></div><div class="gh-bar-x"><span class="gh-t" id="gh-bosst"></span></div></div></div>' +
            '<div class="gh-b" id="gh-obj" hidden><div class="gh-obj" id="gh-objt"></div></div>' +
            '<div class="gh-b" id="gh-toast" hidden></div>' +
            // справа сверху: монеты, звёзды
            '<div class="gh-b" id="gh-coins"><div class="gh-coins" id="gh-coinsp">' + ghImg(GH_IC.coin) + '<span class="gh-t" id="gh-coinst">0</span></div></div>' +
            '<div class="gh-b" id="gh-stars"><div class="gh-stars" id="gh-starsp"></div></div>' +
            '<div class="gh-b gh-hb" id="gh-radar" hidden></div>' +
            '<div class="gh-b gh-hb" id="gh-boost" hidden></div>' +
            '<div class="gh-b gh-hb gh-drone" id="gh-drone" hidden></div>' +
            // слева: пауза, кнопки
            '<div class="gh-b" id="gh-pause"><button type="button" class="gh-btn b gh-pausebtn" id="gh-pausebtn" aria-label="' + ghEsc(ghT('hud.pause')) + '">' + ghImg(GH_IC.pause) + '</button></div>' +
            '<div class="gh-b gh-side" id="gh-side">' +
            '<button type="button" class="gh-btn o gh-sq" id="gh-bup">' + ghImg(GH_IC.upgrades) + ghT_('hud.upgrades') + '</button>' +
            '<button type="button" class="gh-btn b gh-sq" id="gh-blv">' + ghImg(GH_IC.levels) + ghT_('hud.levels') + '</button>' +
            '<button type="button" class="gh-btn p gh-sq" id="gh-bshop">' + ghImg(GH_IC.cosmetics) + ghT_('hud.shop') + '</button>' +
            '<button type="button" class="gh-btn t gh-sq" id="gh-bcodex">' + ghImg(GH_IC.codex) + ghT_('hud.codex') + '</button></div>' +
            // низ: бак, способность и топливо
            '<div class="gh-b" id="gh-tank"><div class="gh-bar gh-tankb" id="gh-tankb">' + ghImg(GH_IC.tank, 'gh-bar-i') + '<div class="gh-bar-t"><div class="gh-bar-f" id="gh-tankf"></div></div><div class="gh-bar-x"><span class="gh-t" id="gh-tankt">0/0</span></div></div></div>' +
            '<div class="gh-b gh-blastb" id="gh-blastb"><div class="gh-fuelw" id="gh-fuelw" hidden><div class="gh-fuel"><i id="gh-fueli"></i></div>' + ghImg(GH_IC.jet) + '</div>' +
            '<button type="button" class="gh-blast" id="gh-blast" aria-label="' + ghEsc(ghT('hud.blast')) + '"><span class="gh-key">E</span><span class="gh-blast-in">' + ghImg(GH_IC.blast) + '</span>' + ghT_('hud.blast') + '<span class="gh-adbadge" id="gh-blastad" hidden>' + ghAdIcon() + '</span></button></div>' +
            '</div>' +
            // меню
            '<div class="gh-menu" id="gh-menu" hidden><div class="gh-menu-box">' + ghImg(GH_IC.logo, 'gh-logo') +
            '<div class="gh-menu-bot"><button type="button" class="gh-btn gh-play" id="gh-mplay">' + ghImg(GH_IC.play) + ghT_('hud.play') + '</button>' +
            '<div class="gh-menu-row"><button type="button" class="gh-btn b" id="gh-mlv">' + ghImg(GH_IC.levels) + ghT_('hud.levels') + '</button>' +
            '<button type="button" class="gh-btn p" id="gh-mset">' + ghImg(GH_IC.settings) + ghT_('hud.settings') + '</button>' +
            '<button type="button" class="gh-btn o" id="gh-mhow">' + ghImg(GH_IC.hand) + ghT_('hud.howto') + '</button>' +
            '<button type="button" class="gh-btn y" id="gh-mlb" hidden>' + ghImg(GH_IC.leaders) + ghT_('hud.leaders') + '</button></div>' +
            '<div class="gh-menu-row"><button type="button" class="gh-btn p" id="gh-mshop">' + ghImg(GH_IC.cosmetics) + ghT_('hud.shop') + '</button>' +
            '<button type="button" class="gh-btn" id="gh-mdaily">' + ghImg(GH_IC.gift) + ghT_('hud.daily') + '<i class="gh-dot" hidden></i></button>' +
            '<button type="button" class="gh-btn o" id="gh-mwheel">' + ghImg(GH_IC.wheel) + ghT_('hud.wheel') + '<i class="gh-dot" hidden></i></button>' +
            '<button type="button" class="gh-btn t" id="gh-mcodex">' + ghImg(GH_IC.codex) + ghT_('hud.codex') + '<i class="gh-dot" hidden></i></button></div></div></div></div>' +
            // слой эффектов
            '<div class="gh-fx" id="gh-fx"><div class="gh-pon" id="gh-pon" hidden><div class="gh-pon-in"><span class="gh-t" id="gh-ponl"></span>' +
            '<svg viewBox="0 0 40 40"><path d="M6 8 L34 8 L20 35 Z" fill="#ffd84a" stroke="#10142e" stroke-width="5" stroke-linejoin="round"/></svg></div></div>' +
            '<div class="gh-pe" id="gh-pe" hidden><div class="gh-pe-arrow" id="gh-pea"><svg viewBox="0 0 22 34"><path d="M3 3 L19 17 L3 31 Z" fill="#ffd84a" stroke="#10142e" stroke-width="4.5" stroke-linejoin="round"/></svg></div>' +
            '<div class="gh-pe-bubble" id="gh-peb"><img id="gh-pei" alt="" src="' + GH_IC.star + '"></div><div class="gh-pe-label"><span class="gh-t" id="gh-pel"></span></div></div></div>';
        document.body.appendChild(root);
        GH.wl = ghEl('div', 'gh-wl');
        document.body.appendChild(GH.wl);

        // не пускаем нажатия по интерфейсу к игровому вводу (стик, свайп-взгляд)
        const stop = (/** @type {any} */ e) => { if (e.target && e.target.closest && e.target.closest('.gh-btn,.gh-blast,.gh-ov,.gh-lv')) e.stopPropagation(); };
        root.addEventListener('pointerdown', stop);
        GH.wl.addEventListener('pointerdown', stop);

        const on = (/** @type {string} */ id, /** @type {() => void} */ fn) => ghQ(root, '#' + id).addEventListener('click', fn);
        on('gh-mplay', () => { if (ghGuard()) ghCall('onPlay'); });
        on('gh-mlv', () => { if (ghGuard()) ghCall('onLevels'); });
        on('gh-mset', () => { if (ghGuard()) GameHud.openSettings(); });
        on('gh-mhow', () => { if (ghGuard()) ghCall('onHowTo'); });
        on('gh-pausebtn', () => { if (!GH.win && ghGuard()) { ghCall('onPause'); GameHud.openPause(); } });
        on('gh-bup', () => { if (ghGuard()) ghCall('onUpgrades'); });
        on('gh-blv', () => { if (ghGuard()) ghCall('onLevels'); });
        on('gh-mshop', () => { if (ghGuard()) ghCall('onShop'); });
        on('gh-mdaily', () => { if (ghGuard()) ghCall('onDaily'); });
        on('gh-mwheel', () => { if (ghGuard()) ghCall('onWheel'); });
        on('gh-mcodex', () => { if (ghGuard()) ghCall('onCodex'); });
        on('gh-mlb', () => { if (ghGuard()) ghCall('onLeaders'); });
        on('gh-bshop', () => { if (ghGuard()) ghCall('onShop'); });
        on('gh-bcodex', () => { if (ghGuard()) ghCall('onCodex'); });
        on('gh-blast', () => {
            const b = ghQ(root, '#gh-blast');
            if (b.classList.contains('rdy')) ghCall('onBlast');
            else if (ghAdsOn() && typeof GH.h.onBlastAd === 'function') ghAdPress(b, 'onBlastAd');
            else ghShake(b);
        });
        // кнопки в блоках буста, радара и дрона создаются заново — слушаем корень
        root.addEventListener('click', (/** @type {any} */ e) => {
            const b = e.target.closest && e.target.closest('[data-hb]');
            if (!b) return;
            const k = b.dataset.hb;
            ghAdPress(b, k === 'boost' ? 'onBoost' : k === 'radar' ? 'onRadar' : 'onDrone');
        });

        window.addEventListener('keydown', e => {
            if (e.key !== 'Escape' || e.repeat || !GH.inited) return;
            if (GH.win) {
                if (GH.win === 'result') return;
                e.preventDefault();
                GameHud._dismiss();
            } else if (GH.screen === 'game') {
                e.preventDefault();
                ghCall('onPause');
                GameHud.openPause();
            }
        });

        // блоки HudLayout
        if (typeof HudLayout !== 'undefined') {
            const B = (/** @type {string} */ id, /** @type {any} */ d) => HudLayout.block(id, Object.assign({ el: '#' + id }, d));
            // gh-top — первым в верхнем центре (выше карточки обучения, order -5): иначе в низком окне он уезжает под неё
            B('gh-top', { dock: 'tc', w: 440, h: 68, fill: true, maxW: 500, minW: 125, order: -10 });
            B('gh-boss', { dock: 'tc', w: 440, h: 42, fill: true, maxW: 500, minW: 220, order: 1 });
            B('gh-obj', { dock: 'tc', w: 400, h: 'auto', fill: true, maxW: 480, minW: 200, order: 2 });
            B('gh-toast', { dock: 'tc', w: 380, h: 'auto', fill: true, maxW: 460, minW: 200, order: 3 });
            B('gh-coins', { dock: 'tr', w: 170, h: 48, min: 40, order: 0 });
            B('gh-stars', { dock: 'tr', w: 128, h: 38, order: 1 });
            B('gh-pause', { dock: 'tl', w: 48, h: 48, min: 44, order: -1 });
            B('gh-side', { dock: { tall: 'tl', default: 'ml' }, w: 70, h: 266, order: 0 });
            B('gh-radar', { dock: 'tr', w: 140, h: 40, order: 2 });
            B('gh-boost', { dock: 'tr', w: 124, h: 46, order: 3 });
            B('gh-drone', { dock: { tall: 'mr', default: 'bc' }, w: 184, h: 40, order: 1 });
            // размеры блоков зависят от режима окна (в низком — значки) и состояния (кнопка или таймер)
            HudLayout.onChange(() => GameHud._sizes());
            B('gh-tank', { dock: 'bc', w: 300, h: 48, fill: true, maxW: 380, minW: 170, order: 0 });
            B('gh-blastb', { dock: 'br', w: 140, h: 104, min: 84, order: 0 });
        }

        GameHud._syncAds();
        GameHud.setStars(0, 3);
        GameHud.setCoins(0);
        GameHud.setSector({ index: 0, total: 5, name: '' });
        GameHud.screen('hidden');
    },

    /** 'menu' | 'game' | 'hidden'. */
    screen(name) {
        GH.screen = name;
        if (!GH.root) return;
        ghQ(GH.root, '#gh-hud').hidden = name !== 'game';
        ghQ(GH.root, '#gh-menu').hidden = name !== 'menu';
        if (name !== 'game') GameHud.setPointer(null);
        ghLayout();
    },

    // =====================================================================================
    // HUD
    // =====================================================================================
    setCoins(n) {
        if (!GH.root) return;
        n = Math.max(0, Math.round(+n || 0));
        const txt = ghQ(GH.root, '#gh-coinst');
        if (!GH.coinsInit) { GH.coinsInit = true; GH.coinsShown = GH.coinsFrom = GH.coinsTo = n; txt.textContent = ghFmt(n); return; }
        if (n === GH.coinsTo) return;
        const up = n > GH.coinsTo;
        GH.coinsFrom = GH.coinsShown; GH.coinsTo = n; GH.coinsT0 = performance.now();
        GH.coinsDur = up ? 450 : 250;
        if (up) {
            const p = ghQ(GH.root, '#gh-coinsp');
            p.classList.remove('gh-bump'); void p.offsetWidth; p.classList.add('gh-bump');
        }
        if (GH.coinsRaf) return;
        const tick = () => {
            const k = Math.min(1, (performance.now() - GH.coinsT0) / GH.coinsDur), e = 1 - Math.pow(1 - k, 3);
            GH.coinsShown = GH.coinsFrom + (GH.coinsTo - GH.coinsFrom) * e;
            txt.textContent = ghFmt(GH.coinsShown);
            if (k < 1) GH.coinsRaf = requestAnimationFrame(tick);
            else { GH.coinsRaf = 0; GH.coinsShown = GH.coinsTo; txt.textContent = ghFmt(GH.coinsTo); }
        };
        GH.coinsRaf = requestAnimationFrame(tick);
        // вкладка в фоне: rAF встанет, поэтому страхуем таймером
        setTimeout(() => { if (GH.coinsRaf && performance.now() - GH.coinsT0 > GH.coinsDur + 300) { cancelAnimationFrame(GH.coinsRaf); GH.coinsRaf = 0; GH.coinsShown = GH.coinsTo; txt.textContent = ghFmt(GH.coinsTo); } }, GH.coinsDur + 400);
    },

    setProgress(frac) {
        if (!GH.root) return;
        const f = Math.max(0, Math.min(1, +frac || 0));
        const pct = f >= 1 ? 100 : Math.min(99, Math.floor(f * 100 + 1e-6));
        ghQ(GH.root, '#gh-progf').style.width = (f * 100).toFixed(1) + '%';
        ghQ(GH.root, '#gh-progt').textContent = pct + '%';
    },

    setSector(s) {
        if (!GH.root || !s) return;
        const head = ghT('hud.sector', { n: (s.index || 0) + 1, m: s.total || 5 });
        ghQ(GH.root, '#gh-sectxt').textContent = s.name ? head + ' · ' + s.name : head;
    },

    setTank(units, cap) {
        if (!GH.root) return;
        const u = Math.max(0, Math.round(+units || 0)), c = Math.max(1, Math.round(+cap || 1));
        const full = u >= c;
        ghQ(GH.root, '#gh-tankf').style.width = Math.min(100, u / c * 100).toFixed(1) + '%';
        ghQ(GH.root, '#gh-tankt').textContent = full ? ghT('hud.tankFull') : u + '/' + c;
        ghQ(GH.root, '#gh-tankb').classList.toggle('full', full);
    },

    setStars(found, total) {
        if (!GH.root) return;
        const p = ghQ(GH.root, '#gh-starsp'), tot = Math.max(1, total || 3), fo = Math.max(0, Math.min(tot, found || 0));
        const prev = GH.starsFound == null ? fo : GH.starsFound;
        let html = '';
        for (let i = 0; i < tot; i++) html += ghImg(i < fo ? GH_IC.star : GH_IC.star_off, i >= prev && i < fo ? 'pop' : '');
        p.innerHTML = html;
        GH.starsFound = fo;
    },

    setBlast(charge) {
        if (!GH.root) return;
        const c = Math.max(0, Math.min(1, +charge || 0)), b = ghQ(GH.root, '#gh-blast');
        b.style.setProperty('--p', c.toFixed(3));
        b.classList.toggle('rdy', c >= 1);
        GH.blastCharge = c;
        GameHud._syncBlastAd();
    },

    // =====================================================================================
    // Реклама: общее состояние, буст, радар, дрон, значки-уведомления
    // =====================================================================================
    /** Общее состояние рекламы: supported — площадка умеет rewarded (false — все рекламные кнопки скрыты); wait — секунд общей паузы. */
    setAds(a) {
        const o = a || {};
        const sup = !!o.supported, wait = Math.max(0, Math.ceil(+o.wait || 0));
        if (sup === GH.ads.supported && wait === GH.ads.wait) return;
        GH.ads = { supported: sup, wait };
        GameHud._syncAds();
    },

    _syncAds() {
        if (!GH.root) return;
        GameHud._syncBlastAd();
        GameHud._syncBoost();
        GameHud._syncRadar();
        GameHud._syncDrone();
        GameHud._syncUpAds();
        GameHud._syncResAd();
    },

    _syncBlastAd() {
        if (!GH.root) return;
        const e = ghQ(GH.root, '#gh-blastad'), show = ghAdsOn() && GH.blastCharge < 1;
        e.hidden = !show;
        if (!show) return;
        e.classList.toggle('dim', GH.ads.wait > 0);
        const html = GH.ads.wait > 0 ? '<span class="gh-t">' + Math.ceil(GH.ads.wait) + '</span>' : ghAdIcon();
        if (e.dataset.h !== html) { e.dataset.h = html; e.innerHTML = html; }
        ghQ(GH.root, '#gh-blast').title = ghT('hud.blastAd');
    },

    /** Кнопка-предложение в блоке HUD: иконка, подпись, вторая строка, ключ data-hb; значок рекламы. */
    _hbBtn(kind, cls, icon, label, sub, title) {
        const w = GH.ads.wait > 0;
        return '<button type="button" class="gh-btn ' + (w ? 'x' : cls) + '" data-hb="' + kind + '" title="' + ghEsc(title) + '" aria-label="' + ghEsc(title) + '">' + ghImg(icon) +
            '<span class="gh-bt"><span class="gh-t">' + ghEsc(w ? ghAdWait() : label) + '</span>' + (sub && !w ? '<span class="gh-t gh-s gh-sub">' + ghEsc(sub) + '</span>' : '') + '</span>' +
            '<span class="gh-adbadge' + (w ? ' dim' : '') + '">' + ghAdIcon() + '</span></button>';
    },

    _hbSet(id, html, show) {
        const b = ghQ(GH.root, '#' + id), was = !b.hidden;
        if (b.dataset.h !== html) { b.dataset.h = html; b.innerHTML = html; }
        b.hidden = !show;
        GameHud._sizes();
        if (was !== show) ghLayout();
    },

    /** Размеры блоков HUD при k = 1: в низком окне буст и радар — значки, левая стопка — две колонки. */
    _sizes() {
        if (typeof HudLayout === 'undefined' || !HudLayout._inited || !GH.root) return;
        const low = HudLayout.mode === 'low', compact = low || HudLayout.mode === 'land';
        const want = /** @type {any} */ ({
            'gh-top': { w: 440, h: compact ? 35 : 68, min: 1 },
            'gh-side': low ? { w: 100, h: 100, min: 93 } : { w: 70, h: 266, min: 1 },
            'gh-radar': typeof GH.radar === 'number' ? { w: low ? 112 : 140, h: low ? 40 : 46, min: 1 } : { w: low ? 44 : 140, h: 40, min: 1 },
            'gh-boost': GH.boost > 0 ? { w: low ? 112 : 124, h: low ? 40 : 46, min: 1 } : { w: low ? 44 : 124, h: low ? 40 : 46, min: 1 },
            'gh-drone': { w: 184, h: 40, min: 1 },
        });
        for (const id of Object.keys(want)) {
            const d = HudLayout._defs[id], w = want[id];
            if (d && (d.w !== w.w || d.h !== w.h || (d.min || 1) !== w.min)) HudLayout.block(id, { w: w.w, h: w.h, min: w.min });
        }
    },

    _chip(icon, text, frac, cy) {
        return '<div class="gh-chip' + (cy ? ' cy' : '') + '"><div class="gh-chiprow">' + ghImg(icon) + '<span class="gh-t">' + ghEsc(text) + '</span></div>' +
            '<div class="gh-chipbar"><i style="width:' + Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%"></i></div></div>';
    },

    /** Буст: sec > 0 — активен (таймер); 0 — кнопка-предложение (только если реклама поддерживается). len — длительность для подписи кнопки (по умолчанию 90). */
    setBoost(sec, len) {
        GH.boost = Math.max(0, Math.ceil(+sec || 0));
        if (GH.boost > 0) GH.boostMax = Math.max(GH.boostMax, GH.boost); else GH.boostMax = 0;
        if (len > 0) GH.boostLen = len;
        if (GH.root) GameHud._syncBoost();
    },

    _syncBoost() {
        if (GH.boost > 0) {
            GameHud._hbSet('gh-boost', GameHud._chip(GH_IC.boost, ghT('hud.boostOn', { t: ghTime(GH.boost) }), GH.boost / Math.max(1, GH.boostMax), false), true);
        } else {
            GameHud._hbSet('gh-boost', GameHud._hbBtn('boost', 'p', GH_IC.boost, ghT('hud.boost'), ghT('hud.boostSec', { n: GH.boostLen || 90 }), ghT('hud.boostFull')), ghAdsOn());
        }
    },

    /** Радар звёзд: 'hidden' | 'offer' | число секунд > 0 (активен, таймер). */
    setRadar(state) {
        GH.radar = typeof state === 'number' && state > 0 ? Math.ceil(state) : state === 'offer' ? 'offer' : 'hidden';
        if (typeof GH.radar === 'number') GH.radarMax = Math.max(GH.radarMax, GH.radar); else GH.radarMax = 0;
        if (GH.root) GameHud._syncRadar();
    },

    _syncRadar() {
        if (typeof GH.radar === 'number') GameHud._hbSet('gh-radar', GameHud._chip(GH_IC.radar, ghT('hud.radarOn', { t: ghTime(GH.radar) }), GH.radar / Math.max(1, GH.radarMax), true), true);
        else GameHud._hbSet('gh-radar', GameHud._hbBtn('radar', 'b', GH_IC.radar, ghT('hud.radar'), '', ghT('hud.radarFull')), GH.radar === 'offer' && ghAdsOn());
    },

    /** «Сдать дроном +50%» над полосой бака (игра включает при баке ≥ 60%). */
    setDrone(on) {
        GH.drone = !!on;
        if (GH.root) GameHud._syncDrone();
    },

    _syncDrone() {
        GameHud._hbSet('gh-drone', GameHud._hbBtn('drone', '', GH_IC.drone, ghT('hud.drone'), '', ghT('hud.droneFull')), GH.drone && ghAdsOn());
    },

    /** Красные точки «есть что забрать»: { daily, wheel, codex } (пропущенное поле не меняется). */
    /** Кнопка «Рекорды» в меню: видна только на площадке с таблицей лидеров. */
    setLeaders(on) {
        if (!GH.root) return;
        const b = ghQ(GH.root, '#gh-mlb');
        if (b) b.hidden = !on;
    },

    setBadges(b) {
        if (!GH.root || !b) return;
        for (const k of ['daily', 'wheel', 'codex']) if (k in b) /** @type {any} */ (GH.badges)[k] = !!b[k];
        const set = (/** @type {string} */ sel, /** @type {boolean} */ on) => {
            const btn = ghQ(GH.root, sel);
            let dot = btn.querySelector('.gh-dot');
            if (on && !dot) { dot = ghEl('i', 'gh-dot'); btn.appendChild(dot); }
            if (dot) dot.hidden = !on;
        };
        set('#gh-mdaily', GH.badges.daily); set('#gh-mwheel', GH.badges.wheel);
        set('#gh-mcodex', GH.badges.codex); set('#gh-bcodex', GH.badges.codex);
    },

    /** Скрыть HUD и меню, пока открыто окно другого модуля (GameMetaUI): они скрывают меню, а не рисуются поверх. */
    cover(on) {
        GH.coverOn = !!on;
        if (GH.root) GH.root.classList.toggle('gh-hasWin', GH.coverOn || !!GH.win);
    },

    setJet(fuel) {
        if (!GH.root) return;
        const w = ghQ(GH.root, '#gh-fuelw');
        if (fuel == null) { if (!w.hidden) { w.hidden = true; ghLayout(); } return; }
        const f = Math.max(0, Math.min(1, +fuel || 0));
        if (w.hidden) { w.hidden = false; ghLayout(); }
        ghQ(w, '#gh-fueli').style.setProperty('--f', (f * 100).toFixed(1) + '%');
        w.classList.toggle('low', f < 0.2);
    },

    setBoss(frac, name) {
        if (!GH.root) return;
        const b = ghQ(GH.root, '#gh-boss');
        if (frac == null) { if (!b.hidden) { b.hidden = true; ghLayout(); } return; }
        const was = b.hidden;
        b.hidden = false;
        ghQ(b, '#gh-bossf').style.width = (Math.max(0, Math.min(1, +frac || 0)) * 100).toFixed(1) + '%';
        if (name != null) ghQ(b, '#gh-bosst').textContent = name;
        if (was) ghLayout();
    },

    setObjective(text) {
        if (!GH.root) return;
        const b = ghQ(GH.root, '#gh-obj'), has = !!text;
        if (has && ghQ(b, '#gh-objt').textContent !== text) ghQ(b, '#gh-objt').textContent = text;
        if (b.hidden === has) { b.hidden = !has; ghLayout(); }
    },

    toast(text, kind) {
        if (!GH.root || !text) return;
        const k = kind === 'good' || kind === 'warn' ? kind : 'info';
        if (GH.toasts.some(t => t.text === text) || (GH.toastBusy && GH.toastCur === text)) return;
        if (GH.toasts.length >= 4) GH.toasts.shift();
        GH.toasts.push({ text, kind: k });
        if (!GH.toastBusy) GameHud._nextToast();
    },

    _nextToast() {
        const box = ghQ(GH.root, '#gh-toast');
        const t = GH.toasts.shift();
        if (!t) { GH.toastBusy = false; GH.toastCur = ''; box.hidden = true; box.innerHTML = ''; ghLayout(); return; }
        GH.toastBusy = true; GH.toastCur = t.text;
        box.innerHTML = '<div class="gh-toast ' + t.kind + '"><span class="gh-t">' + ghEsc(t.text) + '</span></div>';
        box.hidden = false;
        ghLayout();
        clearTimeout(GH.toastTimer);
        GH.toastTimer = setTimeout(() => {
            box.hidden = true; ghLayout();
            GH.toastTimer = setTimeout(() => GameHud._nextToast(), 120);
        }, 2200);
    },

    float(text, x, y, kind) {
        if (!GH.root || GH.screen !== 'game') return;
        const fx = ghQ(GH.root, '#gh-fx');
        const k = kind === 'dirt' || kind === 'star' || kind === 'bad' ? kind : 'coin';
        const e = ghEl('div', 'gh-fl ' + k, (k === 'coin' ? ghImg(GH_IC.coin) : k === 'star' ? ghImg(GH_IC.star) : '') + '<span class="gh-t">' + ghEsc(text) + '</span>');
        e.style.left = Math.round(x) + 'px';
        e.style.top = Math.round(y) + 'px';
        fx.appendChild(e);
        const kill = () => { if (e.parentNode) e.parentNode.removeChild(e); };
        e.addEventListener('animationend', kill);
        setTimeout(kill, 1500);
        while (fx.querySelectorAll('.gh-fl').length > 40) { const o = fx.querySelector('.gh-fl'); if (o) o.remove(); else break; }
    },

    /** Метка цели: onScreen — стрелка над точкой, иначе значок у края экрана. */
    setPointer(p) {
        if (!GH.root) return;
        const pon = ghQ(GH.root, '#gh-pon'), pe = ghQ(GH.root, '#gh-pe');
        if (!p || GH.screen !== 'game') {
            if (GH.ptrMode) { pon.hidden = true; pe.hidden = true; GH.ptrMode = 0; }
            return;
        }
        const x = Math.round(p.x), y = Math.round(p.y);
        if (p.onScreen) {
            if (GH.ptrMode !== 1) { pon.hidden = false; pe.hidden = true; GH.ptrMode = 1; GH.ptrKey = ''; }
            const key = 'o' + (p.label || '');
            if (key !== GH.ptrKey) { GH.ptrKey = key; ghQ(pon, '#gh-ponl').textContent = p.label || ''; }
            pon.style.transform = 'translate(' + x + 'px,' + y + 'px)';
        } else {
            if (GH.ptrMode !== 2) { pe.hidden = false; pon.hidden = true; GH.ptrMode = 2; GH.ptrKey = ''; }
            const kind = p.kind || 'star';
            const key = 'e' + kind + '|' + (p.label || '');
            if (key !== GH.ptrKey) {
                GH.ptrKey = key;
                const col = /** @type {any} */ ({ sell: ['#7dff5a', '#23c552'], shop: ['#ffc247', '#ff8a1f'], rocket: ['#ff7a7a', '#e23636'], dirt: ['#d9a06a', '#a8692f'], star: ['#ffe36a', '#f0a81c'] })[kind] || ['#5fd0ff', '#2f7bff'];
                const b = ghQ(pe, '#gh-peb');
                b.style.setProperty('--c1', col[0]); b.style.setProperty('--c2', col[1]);
                ghQ(pe, '#gh-pei').setAttribute('src', kind === 'dirt' ? GH_IC.junk : (/** @type {any} */ (GH_IC))[kind] || GH_IC.star);
                ghQ(pe, '#gh-pel').textContent = p.label || '';
            }
            pe.classList.toggle('up', y > GH.root.clientHeight * 0.6);
            pe.style.transform = 'translate(' + x + 'px,' + y + 'px)';
            ghQ(pe, '#gh-pea').style.transform = 'rotate(' + (+p.angle || 0).toFixed(3) + 'rad)';
        }
    },

    // =====================================================================================
    // Окна
    // =====================================================================================
    /** Каркас окна. opts: { title, c1, c2, cls, noClose }. Возвращает { ov, win, body }. */
    _shell(name, opts) {
        const prev = GH.win;
        if (prev) GameHud._remove();
        const ov = ghEl('div', 'gh-ov');
        const win = ghEl('div', 'gh-win ' + (opts.cls || ''));
        if (opts.c1) { win.style.setProperty('--c1', opts.c1); win.style.setProperty('--c2', opts.c2); }
        win.innerHTML = '<div class="gh-ribbon"><span class="gh-t">' + ghEsc(opts.title) + '</span></div>' +
            (opts.noClose ? '' : '<button type="button" class="gh-btn r gh-x" aria-label="' + ghEsc(ghT('hud.close')) + '">' + ghImg(GH_IC.close) + '</button>') +
            '<div class="gh-wb"></div>';
        ov.appendChild(win);
        GH.wl.appendChild(ov);
        GH.win = name; GameHud.isOpen = name;
        GH.root.classList.add('gh-hasWin');
        if (!opts.noClose) {
            ov.addEventListener('click', e => { if (e.target === ov) GameHud._dismiss(); });
            ghQ(win, '.gh-x').addEventListener('click', () => GameHud._dismiss());
        }
        GH.ov = ov;
        ghCall('onWindow', name);
        return { ov, win, body: ghQ(win, '.gh-wb') };
    },

    _remove() {
        if (GH.ov && GH.ov.parentNode) GH.ov.parentNode.removeChild(GH.ov);
        GH.ov = null; GH.win = ''; GameHud.isOpen = '';
        GH.root.classList.toggle('gh-hasWin', GH.coverOn);
        GH.res = null;
    },

    /** Закрытие игроком: пауза — возобновляет игру, настройки из паузы — возвращают в паузу. */
    _dismiss() {
        const w = GH.win;
        if (w === 'settings' && GH.back === 'pause') { GH.back = ''; GameHud.openPause(); return; }
        if (w === 'pause') { GameHud.closeWindow(); ghCall('onResume'); return; }
        GameHud.closeWindow();
    },

    closeWindow() {
        if (!GH.win) return;
        GH.back = '';
        GameHud._remove();
        ghCall('onWindow', '');
        ghLayout();
    },

    openPause() {
        if (GH.win === 'pause') return;
        GH.back = '';
        const s = GameHud._shell('pause', { title: ghT('hud.pause'), c1: '#5fd0ff', c2: '#2f7bff', cls: 'gh-menuwin' });
        s.body.innerHTML = '<div class="gh-pause">' +
            '<button type="button" class="gh-btn" data-a="resume">' + ghImg(GH_IC.play) + ghT_('hud.resume') + '</button>' +
            '<button type="button" class="gh-btn o" data-a="restart">' + ghImg(GH_IC.restart) + ghT_('hud.restart') + '</button>' +
            '<button type="button" class="gh-btn b" data-a="howto">' + ghImg(GH_IC.hand) + ghT_('hud.howto') + '</button>' +
            '<button type="button" class="gh-btn p" data-a="settings">' + ghImg(GH_IC.settings) + ghT_('hud.settings') + '</button>' +
            '<button type="button" class="gh-btn r" data-a="menu">' + ghImg(GH_IC.home) + ghT_('hud.toMenu') + '</button></div>';
        s.body.addEventListener('click', (/** @type {any} */ e) => {
            const b = e.target.closest('[data-a]');
            if (!b || !ghGuard()) return;
            const a = b.dataset.a;
            if (a === 'resume') GameHud._dismiss();
            else if (a === 'settings') { GH.back = 'pause'; GameHud.openSettings(true); }
            else if (a === 'restart') { GameHud.closeWindow(); ghCall('onRestart'); }
            else if (a === 'menu') { GameHud.closeWindow(); ghCall('onMenu'); }
            else if (a === 'howto') { GameHud.closeWindow(); ghCall('onResume'); ghCall('onHowTo'); }
        });
    },

    openSettings(fromPause) {
        if (GH.win === 'settings') return;
        if (!fromPause && GH.win !== 'pause') GH.back = '';
        const s = GameHud._shell('settings', { title: ghT('hud.settings'), c1: '#c58bff', c2: '#8a3df0', cls: 'gh-menuwin' });
        s.body.innerHTML = '<div class="gh-set">' +
            '<div class="gh-card gh-row" data-k="sound"></div><div class="gh-card gh-row" data-k="music"></div>' +
            '<div class="gh-card gh-row" style="flex-wrap:wrap"><img src="' + GH_IC.settings + '" alt=""><span class="gh-n">' + ghEsc(ghT('hud.quality')) + '</span>' +
            '<div class="gh-seg" id="gh-seg">' + ['auto', 'low', 'medium', 'high'].map(q => '<button type="button" class="gh-btn b" data-q="' + q + '">' + ghT_('hud.q.' + q) + '</button>').join('') + '</div></div></div>';
        GH.body = s.body;
        GameHud._syncSettings();
        s.body.addEventListener('click', (/** @type {any} */ e) => {
            const sw = e.target.closest('[data-sw]'), q = e.target.closest('[data-q]');
            if (sw) {
                if (sw.dataset.sw === 'sound') { GameHud.setSound(!GH.sound); ghCall('onSound', GH.sound); }
                else { GameHud.setMusic(!GH.music); ghCall('onMusic', GH.music); }
            } else if (q) { GameHud.setQuality(q.dataset.q); ghCall('onQuality', GH.quality); }
        });
    },

    _syncSettings() {
        if (GH.win !== 'settings' || !GH.body) return;
        for (const k of ['sound', 'music']) {
            const row = ghQ(GH.body, '[data-k="' + k + '"]'), on = GH[k];
            row.innerHTML = ghImg(/** @type {any} */ (GH_IC)[k + (on ? '_on' : '_off')]) + '<span class="gh-n">' + ghEsc(ghT('hud.' + k)) + '</span>' +
                '<button type="button" class="gh-btn gh-sw ' + (on ? '' : 'off') + '" data-sw="' + k + '">' + ghT_(on ? 'hud.on' : 'hud.off') + '</button>';
        }
        for (const b of /** @type {any} */ (GH.body.querySelectorAll('[data-q]'))) {
            const cur = b.dataset.q === GH.quality;
            b.classList.toggle('x', !cur); b.classList.toggle('b', cur);
        }
    },

    setSound(on) { GH.sound = !!on; GameHud._syncSettings(); },
    setMusic(on) { GH.music = !!on; GameHud._syncSettings(); },
    setQuality(q) { GH.quality = q || 'auto'; GameHud._syncSettings(); },

    openUpgrades(model) {
        GH.upModel = model;
        const s = GameHud._shell('upgrades', { title: ghT('hud.upgrades'), c1: '#ffc247', c2: '#ff8a1f', cls: 'gh-w-up', });
        s.win.style.width = 'min(48em,100%)';
        GH.upBody = s.body;
        GameHud._renderUpgrades();
        s.body.addEventListener('click', (/** @type {any} */ e) => {
            const ad = e.target.closest('.gh-adbtn');
            if (ad) { ghAdPress(ad, 'onBuyAd', ad.dataset.id); return; }
            const b = e.target.closest('.gh-buy');
            if (!b) return;
            if (b.classList.contains('x')) { b.classList.remove('gh-shake'); void b.offsetWidth; b.classList.add('gh-shake'); return; }
            if (!ghGuard()) return;
            ghCall('onBuy', b.dataset.id);
        });
    },

    setUpgrades(model) {
        GH.upModel = model;
        GH.adBusy = false;
        if (GH.win === 'upgrades') GameHud._renderUpgrades();
    },

    /** Подпись и вид кнопки «За рекламу» на карточке улучшения. */
    _adBtnHtml(it) {
        const w = GH.ads.wait > 0, lack = it.afford === false;
        const label = w ? ghAdWait() : ghT('hud.adBuy') + ' ' + it.ad.have + '/' + it.ad.need;
        return '<button type="button" class="gh-btn ' + (w ? 'x' : 'p') + ' gh-adbtn' + (lack && !w ? ' gh-pulse' : '') + '" data-id="' + ghEsc(it.id) + '">' +
            ghAdIcon() + '<span class="gh-t">' + ghEsc(label) + '</span></button>';
    },

    /** Только подписи и состояние рекламных кнопок (пауза идёт раз в секунду — карточки не пересобираем). */
    _syncUpAds() {
        if (GH.win !== 'upgrades' || !GH.upBody) return;
        const items = (GH.upModel && GH.upModel.items) || [];
        const adOn = ghAdsOn();
        const need = items.some((/** @type {any} */ it) => it.price != null && it.ad && adOn);
        if (need !== !!GH.upBody.querySelector('.gh-adbtn')) { GameHud._renderUpgrades(); return; }
        for (const b of /** @type {any} */ (GH.upBody.querySelectorAll('.gh-adbtn'))) {
            const it = items.find((/** @type {any} */ x) => x.id === b.dataset.id);
            if (!it || !it.ad) continue;
            const w = GH.ads.wait > 0;
            b.classList.toggle('x', w); b.classList.toggle('p', !w);
            b.classList.toggle('gh-pulse', !w && it.afford === false);
            ghQ(b, '.gh-t').textContent = w ? ghAdWait() : ghT('hud.adBuy') + ' ' + it.ad.have + '/' + it.ad.need;
        }
    },

    _renderUpgrades() {
        const m = GH.upModel || { coins: 0, tool: null, items: [] }, body = GH.upBody;
        const top = body.scrollTop;
        const tool = m.tool;
        let html = '<div class="gh-uphead">' +
            (tool ? '<div class="gh-card gh-tool">' + ghImg(ghIcon(tool.icon)) + '<div><span class="gh-s">' + ghEsc(ghT('hud.tool')) + '</span><span class="gh-n">' + ghEsc(tool.name) + '</span></div></div>' : '') +
            '<div class="gh-pill">' + ghImg(GH_IC.coin) + '<span class="gh-t">' + ghFmt(m.coins || 0) + '</span></div></div><div class="gh-grid">';
        for (const it of m.items || []) {
            const max = it.price == null, lv = it.level || 0, mx = it.max || 0;
            let pips = '';
            for (let i = 0; i < mx && i < 12; i++) pips += '<i class="' + (i < lv ? 'on' : '') + '"></i>';
            const st = (it.now || it.next) ? '<div class="gh-st"><span>' + ghEsc(it.now || '') + '</span>' + (it.next && !max ? '<span>→</span><b>' + ghEsc(it.next) + '</b>' : '') + '</div>' : '';
            html += '<div class="gh-card gh-up"><div class="gh-up-top"><div class="gh-up-ic">' + ghImg(ghIcon(it.icon)) + '</div><div class="gh-up-info"><div class="gh-n">' + ghEsc(it.name) + '</div><div class="gh-s">' + ghEsc(it.desc) + '</div></div></div>' +
                '<div class="gh-pips">' + pips + '<b>' + ghEsc(ghT('hud.lvl', { n: lv, m: mx })) + '</b></div>' + st +
                (max ? '<div class="gh-max">' + ghEsc(ghT('hud.max')) + '</div>' :
                    '<div class="gh-upb"><button type="button" class="gh-btn gh-buy ' + (it.afford ? '' : 'x') + '" data-id="' + ghEsc(it.id) + '">' + ghImg(GH_IC.coin) + '<span class="gh-t">' + ghFmt(it.price) + '</span></button>' +
                    (it.ad && ghAdsOn() ? GameHud._adBtnHtml(it) : '') + '</div>') + '</div>';
        }
        body.innerHTML = html + '</div>';
        body.scrollTop = top;
    },

    openLevels(model) {
        GH.lvModel = model;
        const s = GameHud._shell('levels', { title: ghT('hud.levels'), c1: '#5fd0ff', c2: '#2f7bff' });
        const m = model || { current: 0, items: [] };
        let html = '<div class="gh-lvgrid">';
        for (const it of m.items || []) {
            const cur = it.index === m.current;
            let stars = '';
            for (let i = 0; i < 3; i++) stars += ghImg(i < (it.stars || 0) ? GH_IC.star : GH_IC.star_off);
            html += '<button type="button" class="gh-card gh-lv ' + (it.unlocked ? '' : 'lock') + (it.done ? ' done' : '') + (cur ? ' cur' : '') + '" data-i="' + it.index + '"' + (it.unlocked ? '' : ' disabled') + '>' +
                '<span class="gh-lv-n"><span class="gh-t">' + (it.index + 1) + '</span></span>' + (it.unlocked ? '' : ghImg(GH_IC.lock, 'gh-lv-lock')) +
                '<span class="gh-n">' + ghEsc(it.name) + '</span><span class="gh-lv-st">' + stars + '</span>' +
                '<span class="gh-s">' + ghEsc(it.unlocked ? (it.best != null ? ghT('hud.best', { t: ghTime(it.best) }) : ' ') : ghT('hud.locked')) + '</span>' +
                (cur ? '<span class="gh-lv-tag"><span class="gh-t">' + ghEsc(ghT('hud.here')) + '</span></span>' : '') + '</button>';
        }
        s.body.innerHTML = html + '</div>';
        s.body.addEventListener('click', (/** @type {any} */ e) => {
            const b = e.target.closest('.gh-lv');
            if (!b || b.classList.contains('lock') || !ghGuard()) return;
            const i = +b.dataset.i;
            GameHud.closeWindow();
            ghCall('onLevel', i);
        });
    },

    openResult(model) {
        const m = model || {};
        const s = GameHud._shell('result', { title: ghT('hud.res.title'), c1: '#7dff5a', c2: '#23c552', cls: 'gh-res', noClose: true });
        const n = Math.max(0, Math.min(3, m.stars == null ? 3 : m.stars));
        let stars = '';
        for (let i = 0; i < 3; i++) stars += ghImg(i < n ? GH_IC.star : GH_IC.star_off, 'gh-rs ' + (i < n ? 'on' : 'off')).replace('<img ', '<img style="--i:' + i + '" ');
        const row = (/** @type {string} */ ic, /** @type {string} */ label, /** @type {string} */ val, /** @type {string} */ cls) =>
            '<div class="gh-card gh-rrow">' + ghImg(ic) + '<span class="gh-n">' + ghEsc(label) + '</span><span class="gh-v ' + (cls || '') + '">' + ghEsc(val) + '</span></div>';
        const rec = m.time != null && m.best != null && m.time <= m.best + 0.001;
        let html = (m.name ? '<div class="gh-res-sub">' + ghEsc(m.name) + '</div>' : '') + '<div class="gh-res-cols"><div class="gh-res-l"><div class="gh-rstars">' + stars + '</div>' + (rec ? '<div class="gh-rec">' + ghT_('hud.res.record') + '</div>' : '');
        if (m.tool) html += '<div class="gh-card gh-newtool">' + ghImg(ghIcon(m.tool.icon)) + '<div><span class="gh-s">' + ghEsc(ghT('hud.res.newTool')) + '</span><span class="gh-n">' + ghEsc(m.tool.name) + '</span></div></div>';
        html += '</div><div class="gh-res-r">' +
            row(GH_IC.time, ghT('hud.res.time'), ghTime(m.time), '') +
            row(GH_IC.check, ghT('hud.res.best'), ghTime(m.best), '') +
            row(GH_IC.coin, ghT('hud.res.reward'), '+' + ghFmt(m.coins || 0), 'c gh-rcoins') +
            (m.bonus ? row(GH_IC.sparkle, ghT('hud.res.bonus'), '+' + ghFmt(m.bonus), 'bn') : '') +
            (m.starsTotal ? row(GH_IC.star, ghT('hud.res.stars'), (m.starsFound || 0) + '/' + m.starsTotal, '') : '') +
            '</div></div>';
        const foot = ghEl('div', 'gh-resbtns',
            (m.hasNext ? '<button type="button" class="gh-btn big" data-a="next">' + ghImg(GH_IC.next) + ghT_('hud.next') + '</button>' : '') +
            '<button type="button" class="gh-btn o" data-a="again">' + ghImg(GH_IC.restart) + ghT_('hud.again') + '</button>' +
            '<button type="button" class="gh-btn r" data-a="menu">' + ghImg(GH_IC.home) + ghT_('hud.toMenu') + '</button>');
        GH.res = { win: s.win, coins: m.coins || 0, doubled: false };
        if (m.canDouble) s.win.appendChild(ghEl('div', 'gh-dblw', '<button type="button" class="gh-btn p big gh-dbl" data-a="double">' + ghAdIcon() + '<span class="gh-t"></span></button>'));
        s.win.appendChild(foot);
        s.body.innerHTML = html;
        GameHud._syncResAd();
        s.win.addEventListener('click', (/** @type {any} */ e) => {
            const b = e.target.closest('[data-a]');
            if (!b) return;
            if (b.dataset.a === 'double') { ghAdPress(b, 'onDouble'); return; }
            if (!ghGuard()) return;
            const a = b.dataset.a;
            GameHud.closeWindow();
            ghCall(a === 'next' ? 'onNext' : a === 'again' ? 'onReplay' : 'onMenu');
        });
    },

    /** Кнопка «x2 монет за рекламу» в окне результата: видна, пока реклама поддерживается и удвоение не выдано. */
    _syncResAd() {
        const r = GH.res;
        if (!r || GH.win !== 'result' || r.doubled) return;
        const d = r.win.querySelector('.gh-dbl'), wrap = r.win.querySelector('.gh-dblw');
        if (!wrap || !d) return;
        wrap.hidden = !ghAdsOn();
        const wait = GH.ads.wait > 0;
        d.classList.toggle('x', wait); d.classList.toggle('p', !wait);
        d.classList.toggle('gh-pulse', !wait);
        ghQ(d, '.gh-t').textContent = wait ? ghAdWait() : ghT('hud.double');
    },

    /** Игра выдала удвоение: кнопка -> «Удвоено! +total», монеты в окне пересчитываются. total — новое значение строки «Награда». */
    setResultDoubled(total) {
        const r = GH.res;
        if (!r || GH.win !== 'result' || r.doubled) return;
        r.doubled = true;
        GH.adBusy = false;
        const t = Math.max(0, Math.round(+total || 0));
        const wrap = r.win.querySelector('.gh-dblw');
        if (wrap) { wrap.hidden = false; wrap.innerHTML = '<div class="gh-dbldone">' + ghImg(GH_IC.coin) + '<span class="gh-t">' + ghEsc(ghT('hud.doubled', { n: ghFmt(t) })) + '</span></div>'; }
        const v = r.win.querySelector('.gh-rcoins');
        if (v) {
            ghCount(v, r.coins, t, 900, '+');
            v.classList.remove('gh-bump'); void v.offsetWidth; v.classList.add('gh-bump');
            v.style.display = 'inline-block';
        }
        r.coins = t;
    },

    // =====================================================================================
    // Обучение
    // =====================================================================================
    /** CSS для Tutorial.init({ css }): карточка обучения в стиле игры. */
    tutorialCss() {
        return [
            ".lory-tut{--tut-bg:#1b2250;--tut-fg:#fff;--tut-accent:#ffd84a;--tut-border:#10142e;--tut-font:'Rubik','Segoe UI',system-ui,sans-serif;--tut-radius:18px}",
            '.lory-tut-card{border-width:3px;background:linear-gradient(180deg,#252f78,#141a3a);box-shadow:inset 0 3px 0 rgba(255,255,255,.22),0 5px 0 #10142e,0 10px 22px rgba(0,0,0,.4)}',
            '.lory-tut-card.lory-tut-ok{border-color:#10142e;background:linear-gradient(180deg,#2f9a4a,#16632d)}',
            '.lory-tut-title{font-weight:900;color:#ffd84a;-webkit-text-stroke:.2em #10142e;paint-order:stroke fill;text-shadow:0 .1em 0 #10142e}',
            '.lory-tut-hint{font-weight:800;color:#fff}',
            '.lory-tut-key{background:#fff;color:#10142e;border:2px solid #10142e;box-shadow:0 3px 0 #10142e;font-weight:900}',
            '.lory-tut-bar{background:#0d1230;border:2px solid #10142e;height:10px}',
            '.lory-tut-bar i{background:linear-gradient(180deg,#9bff8a,#23c552)}',
            '.lory-tut-skip{background:linear-gradient(180deg,#ffc247,#ff8a1f);color:#fff;border:3px solid #10142e;box-shadow:inset 0 3px 0 rgba(255,255,255,.4),0 4px 0 #10142e;font-weight:900;-webkit-text-stroke:.16em #10142e;paint-order:stroke fill;text-shadow:0 2px 0 #10142e;transition:transform .06s,box-shadow .06s}',
            '.lory-tut-skip:active{transform:translateY(3px);box-shadow:inset 0 3px 0 rgba(255,255,255,.4),0 1px 0 #10142e}',
            '.lory-tut-skip kbd{background:#fff;color:#10142e;-webkit-text-stroke:0;text-shadow:none}',
            '.lory-tut-final{border:3px solid #10142e;background:linear-gradient(180deg,#7dff5a,#23c552);box-shadow:0 4px 0 #10142e;-webkit-text-stroke:.16em #10142e;paint-order:stroke fill;text-shadow:0 2px 0 #10142e}',
            '.lory-tut-dots i.cur{background:#ffd84a}',
        ].join('\n');
    },
};
