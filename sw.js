// SCRAPCORE: BREAKLANDS â€” service worker (offline cache for the installed web app).
//
// NETWORK FIRST: online, it always fetches the newest files, so reopening the
// app after a publish gets the new build. Offline, it plays from the saved copy.
//
// VERSION is stamped by publish.ps1 on every publish. A new version makes the
// phone install this worker fresh and throw the old copies away.
const VERSION = '20260926-195820';
const CACHE = 'scrapcore-breaklands-' + VERSION;

// The page itself plus the manifest, so the app opens offline straight away.
const CORE = ['./', './index.html', './manifest.webmanifest', './css/main.css'];
// Every script the game loads, filled in by publish.ps1 so the whole game is
// saved on the first visit. (Empty when the file is opened locally.)
const PRECACHE = ['./js/aim.js', './js/assetdata.js', './js/assets.js', './js/audio.js', './js/barriers.js', './js/bossdata.js', './js/bossphases.js', './js/camera.js', './js/compass.js', './js/config.js', './js/crusher.js', './js/cutscene.js', './js/director.js', './js/display.js', './js/districtgen.js', './js/districts.js', './js/effects.js', './js/enemies.js', './js/enemy.js', './js/families.js', './js/foreman.js', './js/forge.js', './js/frames.js', './js/furnace.js', './js/gadgetdata.js', './js/gadgetrun.js', './js/game.js', './js/gamepad.js', './js/garage.js', './js/garagescreen.js', './js/hazardreg.js', './js/hazards.js', './js/input.js', './js/iso.js', './js/keyboard.js', './js/lairs.js', './js/loose.js', './js/machine.js', './js/magnet.js', './js/main.js', './js/manifestdata.js', './js/mapscreen.js', './js/mastery.js', './js/menus.js', './js/missionrun.js', './js/missions.js', './js/mods.js', './js/opening.js', './js/outdoors.js', './js/paint.js', './js/paintdata.js', './js/parts.js', './js/permanents.js', './js/pickups.js', './js/player.js', './js/population.js', './js/profile.js', './js/progress.js', './js/projectiles.js', './js/props.js', './js/proto.js', './js/rack.js', './js/railhitch.js', './js/renderer.js', './js/rigs.js', './js/save.js', './js/settings.js', './js/skilldata.js', './js/skills.js', './js/spine.js', './js/sprite44data.js', './js/story.js', './js/storydata.js', './js/tint.js', './js/towing.js', './js/unlocks.js', './js/warden.js', './js/wardens.js', './js/wardentuning.js', './js/weapons.js', './js/world.js', './js/yard.js', './css/main.css', './pwa/icon-192.png', './pwa/icon-512.png', './pwa/icon-maskable-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // One file failing must not block the rest.
      .then((c) => Promise.allSettled(CORE.concat(PRECACHE).map((u) =>
        c.add(new Request(u, { cache: 'reload' })))))
      .catch(() => { /* offline during install: runtime caching fills in */ })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((k) => k.startsWith('scrapcore-breaklands-') && k !== CACHE)
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
