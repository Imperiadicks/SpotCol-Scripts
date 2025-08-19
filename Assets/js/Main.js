// === Main.js — rebooted core (v2.1.0) ===
(() => {
  console.log('[Main] v2.1.0');

  // ── 1. Bootstrap Theme instance
  const ThemeClass = window.Theme;
  if (typeof ThemeClass !== 'function') {
    console.error('[Main] Theme class not found on window.Theme');
    return;
  }
  const App = new ThemeClass('SpotColЛичная');
  window.Theme = App;

  const sm = App.settingsManager;

  // ── 2. Defaults (минимум)
  sm.defaults({
    'Тема.useCustomColor': { value:false },
    'Тема.baseColor':      { value:'#7da6ff' },

    'Эффекты.enableBackgroundImage': { value:true  },
    'Эффекты.enableAvatarZoom':      { value:true  },
    'Эффекты.enableFullVibe':        { value:false }
  });

  App.__settingsReady = false;

  // ────────────────────────────────────────────────────────────────────────────
  // Helpers
  const readSM = (keys, def=null) => {
    const list = Array.isArray(keys) ? keys : [keys];
    for (const k of list) {
      let v = sm.get?.(k);
      if (v === undefined && k.includes('.')) v = sm.get?.(k.split('.').pop());
      if (v === undefined) continue;
      if (v && typeof v === 'object' && 'value' in v) return v.value;
      return v;
    }
    return def;
  };

  const getCover = () =>
    window.Library?.getHiResCover?.() ||
    window.Library?.coverURL?.()     ||
    '';

  // ────────────────────────────────────────────────────────────────────────────
  // 3) Open-Blocker (CSS грузим ТОЛЬКО из твоего raw-репо)
  const OB_MODULES = [
    'donations','concerts','userprofile','trailers','betabutton',
    'vibeanimation','globaltabs','relevantnow','instyle','likesandhistory','neuromusic',
    'newreleases','personalartists','personalplaylists','recommendedplaylists','smartopenplaylist',
    'waves','charttracks','artistrecommends','barbelow','podcasts','chartalbums',
    'continuelisten','editorialartists','editorialnewreleases','mixedblock',
    'mixesgrid','newplaylists','nonmusiceditorialcompilation','openplaylist'
  ];

  // Только твой репозиторий:
  const OB_REMOTE_BASE =
    'https://raw.githubusercontent.com/Imperiadicks/SpotCol-Scripts/main/Assets/blocker-css';

  const obCache = new Map();

  // Имя вида OBPodcasts/OBDonations
  const toOBKey = (mod) => `OB${mod.charAt(0).toUpperCase()}${mod.slice(1)}`;

  function injectOB(mod) {
    const id = `ob:${mod}`;
    if (document.querySelector(`link[data-id="${id}"]`)) return;

    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = `${OB_REMOTE_BASE}/${encodeURIComponent(mod)}.css`;
    link.dataset.id = id;
    link.crossOrigin   = 'anonymous';
    link.referrerPolicy = 'no-referrer';

    link.addEventListener('load', () =>
      console.log(`[OB] ✓ ${mod} loaded → ${link.href}`)
    );
    link.addEventListener('error', () =>
      console.warn(`[OB] ✗ ${mod} failed ← ${link.href}`)
    );

    document.head.appendChild(link);
  }
  function removeOB(mod) {
    document.querySelectorAll(`link[data-id="ob:${mod}"]`).forEach(n => n.remove());
  }

  // ← универсальное чтение флагов OB (новые и легаси)
  // поддерживаем:
  //  - OB<Cap>                     (например, OBPodcasts)
  //  - OpenBlocker.<mod>           (например, OpenBlocker.podcasts)
  //  - Open-Blocker.<mod>
  //  - OpenBlocker.OB<Cap> / Open-Blocker.OB<Cap> (на всякий)
  //  - legacy: NewbuttonHide для подкастов (true → скрывать)
  function readOBEnabled(module) {
    const cap = module[0].toUpperCase() + module.slice(1);
    const obKey = toOBKey(module);

    const candidates = [
      `OpenBlocker.${module}`,
      `Open-Blocker.${module}`,
      `OpenBlocker.${obKey}`,
      `Open-Blocker.${obKey}`,
      obKey,
    ];

    for (const k of candidates) {
      const s = sm.get?.(k);
      if (s && typeof s.value !== 'undefined') return !!s.value;
    }

    if (module === 'podcasts') {
      const legacy = readSM(['Open-Blocker.NewbuttonHide','OpenBlocker.NewbuttonHide','NewbuttonHide']);
      if (typeof legacy !== 'undefined' && legacy !== null) return !!legacy;
    }
    return false;
  }

  function detectOBModules() {
    // Автодетект из текущих настроек + гарантируем podcasts
    const mods = new Set();
    const walk = (obj, prefix='') => {
      if (!obj || typeof obj !== 'object') return;
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        const path = prefix ? `${prefix}.${k}` : k;

        if (v && typeof v === 'object' && 'value' in v) {
          if (/^OB[A-Z]/.test(path)) {
            const name = path.replace(/^OB/, '');
            mods.add(name.charAt(0).toLowerCase() + name.slice(1));
          }
          if (/^Open(Blocker|-Blocker)\./.test(path)) {
            const tail = path.split('.')[1]; // OpenBlocker.<tail>
            if (tail && !/^(OB[A-Z])/.test(tail)) mods.add(tail);
          }
          if (path === 'NewbuttonHide') mods.add('podcasts');
          continue;
        }
        if (v && typeof v === 'object') walk(v, path);
      }
    };
    try { walk(sm.settings); } catch {}
    for (const m of OB_MODULES) mods.add(m);
    mods.add('podcasts');
    return Array.from(mods);
  }

  function applyOpenBlocker() {
    const modules = detectOBModules();
    for (const mod of modules) {
      const enabled = readOBEnabled(mod);
      const prev = obCache.get(mod) ?? false;
      if (enabled && !prev) { injectOB(mod); obCache.set(mod, true); }
      else if (!enabled && prev) { removeOB(mod); obCache.set(mod, false); }
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 4) Background / FullVibe / Zoom — аккуратно и локально
  const Effects = (() => {
    let lastURL = '';
    let guardIv = null;
    let domObs  = null;

    const VIBE_SELECTORS = [
      '[class*="MainPage_vibe"]',
      '[class*="VibeBlock_wrap"]',
      'main section:has([class*="vibe"])'
    ];
    const findVibe = () => {
      for (const s of VIBE_SELECTORS) {
        const n = document.querySelector(s);
        if (n) return n;
      }
      return null;
    };

    const bgEnabled   = () => !!readSM(['Эффекты.enableBackgroundImage','enableBackgroundImage'], true);
    const fullVEnabled= () => !!readSM(['Эффекты.enableFullVibe','FullVibe'], false);
    const zoomEnabled = () => !!readSM(['Эффекты.enableAvatarZoom','enableAvatarZoom'], true);

    function makeLayer(url) {
      const layer = document.createElement('div');
      layer.className = 'bg-layer';
      Object.assign(layer.style, {
        position:'absolute', inset:'0',
        pointerEvents:'none',
        zIndex: '-1',
        opacity:'0', transition:'opacity .9s ease'
      });

      const img = document.createElement('div');
      img.className = 'bg-cover';
      Object.assign(img.style, {
        position:'absolute', inset:'0',
        backgroundImage:`url("${url}")`,
        backgroundSize:'cover', backgroundPosition:'center', backgroundRepeat:'no-repeat',
        opacity:'1', pointerEvents:'none'
      });

      const grad = document.createElement('div');
      grad.className = 'bg-gradient';
      Object.assign(grad.style, {
        position:'absolute', inset:'0',
        background:'var(--grad-main)',
        mixBlendMode:'multiply',
        opacity:'1', pointerEvents:'none'
      });

      layer.dataset.src = url;
      layer.appendChild(img);
      layer.appendChild(grad);
      return layer;
    }

    function mountBackground(url) {
      const tgt = findVibe();
      if (!tgt || !url) return;
      tgt.style.position ||= 'relative';

      const current = tgt.querySelector('.bg-layer');
      if (current && current.dataset.src === url) return;

      const next = makeLayer(url);
      tgt.insertAdjacentElement('afterbegin', next);
      requestAnimationFrame(() => { next.style.opacity = '1'; });

      if (current) { current.style.opacity = '0'; setTimeout(()=>current.remove(), 700); }
      lastURL = url;
    }

    function unmountBackground() {
      const tgt = findVibe();
      const cur = tgt?.querySelector('.bg-layer');
      if (cur) { cur.style.opacity='0'; setTimeout(()=>cur.remove(), 400); }
      lastURL = '';
    }

    // Zoom на обложку в плеере
    function setupZoom() {
      const img = document.querySelector('[data-test-id="PLAYERBAR_DESKTOP_COVER_CONTAINER"] img');
      if (!img || img.dataset.zoomReady) return;
      Object.assign(img.style, { transition:'transform .25s ease, filter .25s ease', willChange:'transform' });
      img.addEventListener('mousemove', onMove);
      img.addEventListener('mouseleave', onLeave);
      img.dataset.zoomReady = '1';
      function onMove(e){
        const r = img.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width/2)) / (r.width/2);
        const dy = (e.clientY - (r.top  + r.height/2)) / (r.height/2);
        img.style.transform = `scale(1.05) translate(${dx*6}px, ${dy*6}px)`;
        img.style.filter = 'drop-shadow(0 10px 25px rgba(0,0,0,.45))';
      }
      function onLeave(){
        img.style.transform = 'scale(1)';
        img.style.filter    = 'drop-shadow(0 6px 18px rgba(0,0,0,.35))';
      }
    }
    function removeZoom() {
      const img = document.querySelector('[data-test-id="PLAYERBAR_DESKTOP_COVER_CONTAINER"] img');
      if (!img || !img.dataset.zoomReady) return;
      img.replaceWith(img.cloneNode(true));
    }

    // FullVibe
    function applyFullVibe() {
      const v = findVibe();
      if (v) v.style.setProperty('height','88.35vh','important');
    }
    function resetFullVibe() {
      const v = findVibe();
      if (v) v.style.removeProperty('height');
    }

    function updateAll() {
      if (!App.__settingsReady) return;

      if (bgEnabled()) {
        const url = getCover();
        if (url) mountBackground(url); else unmountBackground();
      } else {
        unmountBackground();
      }

      if (fullVEnabled()) applyFullVibe(); else resetFullVibe();
      if (zoomEnabled())  setupZoom();     else removeZoom();
    }

    function watchDOM() {
      if (domObs) return;
      domObs = new MutationObserver(() => updateAll());
      (document.querySelector('[class*="CommonLayout_root"]') || document.body)
        .addEventListener?.('transitionend', updateAll, { passive:true });
      domObs.observe(document.body, { childList:true, subtree:true });
    }

    function startGuard() {
      if (guardIv) return;
      guardIv = setInterval(() => {
        if (!App.__settingsReady || !bgEnabled()) return;
        const tgt = findVibe();
        const url = getCover();
        if (!tgt || !url) return;
        const cur = tgt.querySelector('.bg-layer')?.dataset?.src;
        if (cur !== url) mountBackground(url);
      }, 1200);
    }

    return {
      sync: updateAll,
      start() { watchDOM(); startGuard(); updateAll(); },
      onTrack(url) { if (!bgEnabled()) return; if (url) mountBackground(url); }
    };
  })();

  // ── экспорт, чтобы SpotifyScreen мог дёргать
  App.backgroundReplace     = (url) => Effects.onTrack(url || getCover());
  App.removeBackgroundImage = ()    => { /* compat */ };
  App.FullVibe              = ()    => Effects.sync();
  App.RemoveFullVibe        = ()    => Effects.sync();
  App.setupAvatarZoomEffect = ()    => Effects.sync();
  App.removeAvatarZoomEffect= ()    => Effects.sync();

  // ────────────────────────────────────────────────────────────────────────────
  // 5) ПРОЗРАЧНОСТЬ (возвращаем как раньше, безопасные селекторы)
  const TRANSPARENCY_KEYS = [
    'togglePlayerBackground',
    'Effects.transparency',
    'Действия.togglePlayerBackground'
  ];

  const ensureStyle = (id, css) => {
    let st = document.getElementById(id);
    if (!st) {
      st = document.createElement('style');
      st.id = id;
      document.head.appendChild(st);
    }
    if (typeof css === 'string') st.textContent = css;
    return st;
  };
  const removeStyle = (id) => document.getElementById(id)?.remove();

  function isTransparencyEnabled() {
    for (const k of TRANSPARENCY_KEYS) {
      const s = sm.get?.(k);
      if (s && typeof s.value !== 'undefined') return !!s.value;
    }
    return false;
  }

  function applyTransparency() {
    const enabled = isTransparencyEnabled();
    const ID = 'spotcol-transparency';
    if (!enabled) { removeStyle(ID); return; }

    const CSS = `
/* === SpotCol Transparency (safe selectors) === */
[class*="PlayerBarDesktop_root"],
[class*="PlayerBar_root"],
[class*="MainPage_vibe"],
[class*="PlayQueue_root"],
[class*="FullscreenPlayerDesktopContent_info"],
[class*="FullscreenPlayerDesktopContent_syncLyrics"],
[class*="FullscreenPlayerDesktopControls"],
[class*="Content_root"],
[class*="Layout_root"],
[class*="Page_root"],
[class*="Card_root"],
[class*="Shelf_root"],
[class*="Sidebar_root"]
{
  background: transparent !important;
  background-color: transparent !important;
  box-shadow: none !important;
  border: 0 !important;
}

[class*="overlay"], [class*="Backdrop"], [class*="backdrop"],
[class*="blur"], [style*="backdrop-filter"], [class*="frost"], [class*="glass"]
{
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

div[data-test-id="FULLSCREEN_PLAYER_MODAL"] {
  --brightness: 1 !important;
  --brightness-correction: 1 !important;
  background: transparent !important;
}
`.trim();

    ensureStyle(ID, CSS);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 6) Track hooks: как только трек меняется — цвет и фон обновляются сразу
  ;(() => {
    const Lib = window.Library || {};
    const tp  = Theme?.player;

    const onChange = () => {
      const url = getCover();
      try { Effects.onTrack(url); } catch {}
      try { window.Library?.colorize2?.recolor?.(true); } catch {}
    };

    try { Lib.onTrack?.(() => onChange(), { immediate:true }); } catch {}
    tp?.on?.('trackChange', ({state}) => onChange(state?.track));
    tp?.on?.('openPlayer',  ({state}) => onChange(state?.track));
    tp?.on?.('pageChange',  ()        => onChange());
    setInterval(onChange, 1500);
  })();

  // ────────────────────────────────────────────────────────────────────────────
  // 7) Persistent handle watcher (poll + signature)
  ;(() => {
    const EFFECT_KEYS = [
      'Эффекты.enableBackgroundImage',
      'Эффекты.enableAvatarZoom',
      'Эффекты.enableFullVibe',
      'Тема.useCustomColor','Тема.baseColor','useCustomColor','baseColor'
    ];

    // Подписи для OB (оба формата ключей) + legacy подкастов:
    const OB_KEYS = OB_MODULES.map(m => {
      const cap = m[0].toUpperCase() + m.slice(1);
      return [
        `OpenBlocker.${m}`,
        `Open-Blocker.${m}`,
        `OpenBlocker.OB${cap}`,
        `Open-Blocker.OB${cap}`,
        `OB${cap}`
      ];
    }).flat();

    const LEGACY_PODCAST_KEYS = ['Open-Blocker.NewbuttonHide', 'OpenBlocker.NewbuttonHide', 'NewbuttonHide'];

    // Ключи прозрачности:
    const TRANSP_KEYS = [...TRANSPARENCY_KEYS];

    let prev = '';
    let inflight = false;

    const signature = () => {
      const eff = EFFECT_KEYS.map(k => `${k}=${readSM(k)}`).join('|');
      const ob  = OB_KEYS.map(k => `${k}=${readSM(k)}`).join('|');
      const lg  = LEGACY_PODCAST_KEYS.map(k => `${k}=${readSM(k)}`).join('|');
      const tr  = TRANSP_KEYS.map(k => `${k}=${readSM(k)}`).join('|');
      return [eff, ob, lg, tr].join('#');
    };

    async function tick() {
      if (inflight || !App.__settingsReady) return;
      inflight = true;
      try { await sm.update(); } catch {}
      finally { inflight = false; }

      const sig = signature();
      if (sig !== prev) {
        prev = sig;
        applyOpenBlocker();
        applyTransparency();
        try { Effects.sync(); } catch {}
        try { window.Library?.colorize2?.recolor?.(true); } catch {}
      }
    }

    const start = () => { tick(); clearInterval(App.__settingsWatcher); App.__settingsWatcher=setInterval(tick, 1200); };
    if (App.__settingsReady) start(); else {
      const iv = setInterval(()=>{ if (App.__settingsReady){ clearInterval(iv); start(); } }, 250);
    }
    window.addEventListener('storage', tick);
  })();

  // ────────────────────────────────────────────────────────────────────────────
  // 8) First load from handle, then sync everything
  (async () => {
    try { await sm.update(); } catch {}
    finally {
      App.__settingsReady = true;
      try { window.Library?.colorize2?.recolor?.(true); } catch {}
      applyOpenBlocker();
      applyTransparency();
      Effects.sync();
    }
  })();

  // ────────────────────────────────────────────────────────────────────────────
  // 9) Start effects watchers
  Effects.start();

  // удобный хук для консоли
  window.syncEffects = () => { applyOpenBlocker(); applyTransparency(); Effects.sync(); };
})();
