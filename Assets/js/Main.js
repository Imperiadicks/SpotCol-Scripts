// === Main.js — core (v2.1.1) ===
// Правки:
//  - OB-CSS: грузим raw → fetch + <style> (MIME fix)
//  - Watcher: универсальная подпись по ВСЕМ handle (не по белому списку)
//  - FullVibe/OB/Transparency применяются при ЛЮБОМ изменении handle
//  - Мелкие фиксы: безопасный sm.defaults, корректные хуки player

(() => {
  console.log('[Main] v2.1.1');

  // ── 1. Bootstrap Theme instance
  const ThemeClass = window.Theme;
  if (typeof ThemeClass !== 'function') {
    console.error('[Main] Theme class not found on window.Theme');
    return;
  }
  const App = new ThemeClass('SpotColЛичная');
  window.Theme = App;

  const sm = App.settingsManager;
  if (typeof sm?.defaults === 'function') {
    sm.defaults({
      'Тема.useCustomColor': { value:false },
      'Тема.baseColor':      { value:'#7da6ff' },

      'Эффекты.enableBackgroundImage': { value:true  },
      'Эффекты.enableAvatarZoom':      { value:true  },
      'Эффекты.enableFullVibe':        { value:false }
    });
  }

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
  // 2) Open-Blocker (CSS грузим ТОЛЬКО из твоего raw-репо; MIME fix: fetch → <style>)
  const OB_MODULES = [
    'donations','concerts','userprofile','trailers','betabutton',
    'vibeanimation','globaltabs','relevantnow','instyle','likesandhistory','neuromusic',
    'newreleases','personalartists','personalplaylists','recommendedplaylists','smartopenplaylist',
    'waves','charttracks','artistrecommends','barbelow','podcasts','chartalbums',
    'continuelisten','editorialartists','editorialnewreleases','mixedblock',
    'mixesgrid','newplaylists','nonmusiceditorialcompilation','openplaylist'
  ];

  const OB_REMOTE_BASE =
    'https://raw.githubusercontent.com/Imperiadicks/SpotCol-Scripts/main/Assets/blocker-css';

  const obCache = new Map();

  function toOBKey(mod) { return `OB${mod[0].toUpperCase()}${mod.slice(1)}`; }

  async function injectOB(mod) {
    const id = `ob:${mod}`;
    if (document.querySelector(`[data-id="${id}"]`)) return;

    const url = `${OB_REMOTE_BASE}/${encodeURIComponent(mod)}.css?nocache=${Date.now()}`;
    try {
      const res = await fetch(url, { mode: 'cors', cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const css = await res.text();

      const st = document.createElement('style');
      st.type = 'text/css';
      st.dataset.id = id;
      st.textContent = css;
      document.head.appendChild(st);

      console.log(`[OB] ✓ ${mod} inlined (${css.length} bytes)`);
    } catch (e) {
      console.warn(`[OB] ✗ ${mod} fetch failed`, e);
    }
  }
  function removeOB(mod) {
    const id = `ob:${mod}`;
    document.querySelectorAll(`[data-id="${id}"]`).forEach(n => n.remove());
  }

  // поддерживаем:
  //  - OB<Cap>                     (например, OBPodcasts)
  //  - OpenBlocker.<mod> / Open-Blocker.<mod>
  //  - OpenBlocker.OB<Cap> / Open-Blocker.OB<Cap>
  //  - legacy: NewbuttonHide (true → скрывать подкасты)
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
            const tail = path.split('.')[1];
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
  // 3) Background / FullVibe / Zoom — аккуратно и локально
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
      domObs.observe(document.body, { childList:true, subtree:true });
      (document.querySelector('[class*="CommonLayout_root"]') || document.body)
        .addEventListener?.('transitionend', updateAll, { passive:true });
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

  // экспорт для других модулей
  App.backgroundReplace      = (url) => Effects.onTrack(url || getCover());
  App.removeBackgroundImage  = ()    => { /* compat */ };
  App.FullVibe               = ()    => Effects.sync();
  App.RemoveFullVibe         = ()    => Effects.sync();
  App.setupAvatarZoomEffect  = ()    => Effects.sync();
  App.removeAvatarZoomEffect = ()    => Effects.sync();

  // ────────────────────────────────────────────────────────────────────────────
  // 4) ПРОЗРАЧНОСТЬ (возвращаем, безопасные селекторы)
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
  // 5) Track hooks
  ;(() => {
    const Lib = window.Library || {};
    const tp  = App.player;

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
  // 6) UNIVERSAL watcher: подпись по ВСЕМ handle (.value) → любые изменения сработают
  function makeSignatureAll() {
    const out = [];
    const walk = (obj, p = '') => {
      if (!obj || typeof obj !== 'object') return;
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        const path = p ? `${p}.${k}` : k;
        if (v && typeof v === 'object' && 'value' in v) {
          out.push(`${path}=${JSON.stringify(v.value)}`);
        } else if (v && typeof v === 'object') {
          walk(v, path);
        }
      }
    };
    try { walk(sm.settings); } catch {}
    return out.sort().join('|');
  }

  ;(() => {
    let prev = '';
    let inflight = false;

    async function tick() {
      if (inflight) return;
      inflight = true;
      try { await sm.update(); } catch {}
      finally { inflight = false; }

      const sig = makeSignatureAll();
      if (sig !== prev) {
        prev = sig;
        // применяем ВСЁ при любом изменении handle
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
    ['visibilitychange','focus','pageshow'].forEach(ev=>window.addEventListener(ev, tick));
  })();

  // ────────────────────────────────────────────────────────────────────────────
  // 7) First load
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
  // 8) Start effects guards
  Effects.start();

  // удобный хук для консоли
  window.syncEffects = () => { applyOpenBlocker(); applyTransparency(); Effects.sync(); };
})();
