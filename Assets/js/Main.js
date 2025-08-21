// === Main.js — core (v2.2.0) ===
// Фокус: корректная работа с handle для «Прозрачность», «Подкасты» и всего раздела Open-Blocker.
// Ничего не удалено из API — только добавлено/усилено.

(() => {
  console.log('[Main] v2.2.0');

  // ── 1) Bootstrap Theme instance (совместимо с твоей библиотекой)
  const ThemeClass = window.Theme;
  if (typeof ThemeClass !== 'function') {
    console.error('[Main] Theme class not found on window.Theme');
    return;
  }
  const App = new ThemeClass('SpotColЛичная');
  window.Theme = App;

  const sm = App.settingsManager;

  // Безопасные значения по умолчанию (если включена поддержка defaults)
  if (typeof sm?.defaults === 'function') {
    sm.defaults({
      'Тема.useCustomColor': { value: false },
      'Тема.baseColor':      { value: '#7da6ff' },

      'Эффекты.enableBackgroundImage': { value: true  },
      'Эффекты.enableAvatarZoom':      { value: true  },
      'Эффекты.enableFullVibe':        { value: false },

      // Общие ключи Open-Blocker (true = включить)
      'OpenBlocker.enabled': { value: true },
      // Частные ключи (могут приходить из handle)
      'OpenBlocker.podcasts': { value: true }, // «Подкасты»
      'Effects.transparency': { value: false }, // «Прозрачность»
    });
  }

  App.__settingsReady = false;

  // ────────────────────────────────────────────────────────────────────────────
  // Helpers
  const readSM = (keys, def = null) => {
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
  // 2) Open-Blocker CSS (строго через raw → fetch → <style>, обход проблем с MIME)
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
  const obTagId = (mod) => `ob-css-${mod}`;

  function toOBKey(mod) {
    // ключи вида OpenBlocker.podcasts / OB.podcasts / blocker.podcasts / podcasts
    return [
      `OpenBlocker.${mod}`, `OB.${mod}`, `blocker.${mod}`, mod
    ];
  }

  async function loadOB(mod) {
    const id = obTagId(mod);
    if (document.getElementById(id)) return true;

    try {
      const key = `${OB_REMOTE_BASE}/${encodeURIComponent(mod)}.css`;
      let css = obCache.get(key);
      if (!css) {
        const res = await fetch(key, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        css = await res.text();
        obCache.set(key, css);
      }
      const st = document.createElement('style');
      st.id = id;
      st.textContent = css;
      document.head.appendChild(st);
      return true;
    } catch (e) {
      console.warn('[Main][OB] load failed:', mod, e);
      return false;
    }
  }

  function removeOB(mod) {
    document.getElementById(obTagId(mod))?.remove();
  }

  function isModuleEnabled(mod) {
    // Глобальный выключатель Open-Blocker
    const global = !!readSM(['OpenBlocker.enabled', 'OB.enabled', 'blocker.enabled'], true);
    if (!global) return false;

    // Персональные флаги модуля
    const flags = toOBKey(mod).map(k => !!readSM(k, true));
    // Если хотя бы один явный false — отключаем модуль
    if (flags.includes(false)) return false;
    // Если есть хотя бы один true — включаем
    if (flags.includes(true))  return true;

    // По умолчанию включаем
    return true;
  }

  async function applyOpenBlocker() {
    // Принудительно обработаем «Подкасты»: часто ломается в handle
    const wantPodcasts = !!readSM(toOBKey('podcasts'), true);
    if (wantPodcasts) {
      // защитный CSS, чтобы раздел точно был видим
      const id = 'ob-protect-podcasts-visibility';
      let st = document.getElementById(id);
      if (!st) {
        st = document.createElement('style');
        st.id = id;
        st.textContent = `
          /* Ensure "Podcasts" sections are visible */
          [class*="Podcasts_root"],
          [data-block-id*="podcast"],
          [data-test-id*="podcast"],
          a[href*="/podcasts"] { display: initial !important; visibility: visible !important; }
        `;
        document.head.appendChild(st);
      }
    } else {
      document.getElementById('ob-protect-podcasts-visibility')?.remove();
    }

    await Promise.all(OB_MODULES.map(async (m) => {
      if (isModuleEnabled(m)) await loadOB(m);
      else removeOB(m);
    }));
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 3) Эффекты (фон/FullVibe/Zoom) — синхронизируются с handle
  const Effects = (() => {
    let domObs = null, guardIv = null, lastURL = '';

    const bgEnabled   = () => !!readSM(['Эффекты.enableBackgroundImage','enableBackgroundImage'], true);
    const fullVEnabled= () => !!readSM(['Эффекты.enableFullVibe','FullVibe'], false);
    const zoomEnabled = () => !!readSM(['Эффекты.enableAvatarZoom','enableAvatarZoom'], true);

    const findVibe = () =>
      document.querySelector('[class*="MainPage_vibe"]') ||
      document.querySelector('[class*="VibeBlock_vibe"]') ||
      document.querySelector('[data-test-id="MAIN_PAGE"]') ||
      document.body;

    function makeLayer(url) {
      const layer = document.createElement('div');
      layer.className = 'bg-layer';
      Object.assign(layer.style, {
        position: 'absolute', inset: '0',
        pointerEvents: 'none',
        zIndex: '-1',
        opacity: '0', transition: 'opacity .9s ease'
      });

      const img = document.createElement('div');
      img.className = 'bg-cover';
      Object.assign(img.style, {
        position: 'absolute', inset: '0',
        backgroundImage: `url("${url}")`,
        backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
        opacity: '1', pointerEvents: 'none'
      });

      const grad = document.createElement('div');
      grad.className = 'bg-gradient';
      Object.assign(grad.style, {
        position: 'absolute', inset: '0',
        background: 'var(--grad-main)',
        mixBlendMode: 'multiply',
        opacity: '1', pointerEvents: 'none'
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

      if (current) { current.style.opacity = '0'; setTimeout(() => current.remove(), 700); }
      lastURL = url;
    }

    function unmountBackground() {
      const tgt = findVibe();
      const cur = tgt?.querySelector('.bg-layer');
      if (cur) { cur.style.opacity = '0'; setTimeout(() => cur.remove(), 400); }
      lastURL = '';
    }

    // Zoom на обложку в мини-плеере
    function setupZoom() {
      const img = document.querySelector('[data-test-id="PLAYERBAR_DESKTOP_COVER_CONTAINER"] img');
      if (!img || img.dataset.zoomReady) return;
      Object.assign(img.style, { transition: 'transform .25s ease, filter .25s ease', willChange: 'transform' });
      img.addEventListener('mousemove', onMove);
      img.addEventListener('mouseleave', onLeave);
      img.dataset.zoomReady = '1';
      function onMove(e) {
        const r = img.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        img.style.transform = `scale(1.05) translate(${dx * 6}px, ${dy * 6}px)`;
        img.style.filter = 'drop-shadow(0 10px 25px rgba(0,0,0,45))';
      }
      function onLeave() {
        img.style.transform = 'scale(1)';
        img.style.filter = 'drop-shadow(0 6px 18px rgba(0,0,0,35))';
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
      if (v) v.style.setProperty('height', '88.35vh', 'important');
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
      domObs.observe(document.body, { childList: true, subtree: true });
      (document.querySelector('[class*="CommonLayout_root"]') || document.body)
        .addEventListener?.('transitionend', updateAll, { passive: true });
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
      sync:  updateAll,
      start: () => { watchDOM(); startGuard(); updateAll(); },
      onTrack: (url) => { if (!bgEnabled()) return; if (url) mountBackground(url); }
    };
  })();

  // экспорт для других модулей (совместимость)
  App.backgroundReplace      = (url) => Effects.onTrack(url || getCover());
  App.removeBackgroundImage  = ()    => { /* compat */ };
  App.FullVibe               = ()    => Effects.sync();
  App.RemoveFullVibe         = ()    => Effects.sync();
  App.setupAvatarZoomEffect  = ()    => Effects.sync();
  App.removeAvatarZoomEffect = ()    => Effects.sync();

  // ────────────────────────────────────────────────────────────────────────────
  // 4) ПРОЗРАЧНОСТЬ (безопасные селекторы)
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
[class*="Sidebar_root"]{
  background: transparent !important;
  background-color: transparent !important;
  box-shadow: none !important;
  border: 0 !important;
}

[class*="overlay"], [class*="Backdrop"], [class*="backdrop"],
[class*="blur"], [style*="backdrop-filter"], [class*="frost"], [class*="glass"]{
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

div[data-test-id="FULLSCREEN_PLAYER_MODAL"]{
  --brightness: 1 !important;
  --brightness-correction: 1 !important;
  background: transparent !important;
}`.trim();

    ensureStyle(ID, CSS);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 5) Синхронизация с плеером/сменой трека → фон + Colorize 2
  (() => {
    const Lib = window.Library || {};
    const tp  = App.player;

    const onChange = () => {
      const url = getCover();
      try { Effects.onTrack(url); } catch {}
      try { window.Library?.colorize2?.recolor?.(true); } catch {}
    };

    try { Lib.onTrack?.(() => onChange(), { immediate: true }); } catch {}
    tp?.on?.('trackChange', ({ state }) => onChange(state?.track));
    tp?.on?.('openPlayer',  ({ state }) => onChange(state?.track));
    tp?.on?.('pageChange',  ()          => onChange());
    setInterval(onChange, 1500);
  })();

  // ────────────────────────────────────────────────────────────────────────────
  // 6) UNIVERSAL watcher: реагируем на любые изменения handle (по .value)
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
        // На ЛЮБОЕ изменение handle применяем всё
        applyOpenBlocker();
        applyTransparency();
        try { Effects.sync(); } catch {}
        try { window.Library?.colorize2?.recolor?.(true); } catch {}
      }
    }

    const start = () => { tick(); clearInterval(App.__settingsWatcher); App.__settingsWatcher = setInterval(tick, 1200); };
    if (App.__settingsReady) start(); else {
      const iv = setInterval(() => { if (App.__settingsReady) { clearInterval(iv); start(); } }, 250);
    }
    ['visibilitychange', 'focus', 'pageshow'].forEach(ev => window.addEventListener(ev, tick));
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
  // 8) Start effect guards
  Effects.start();

  // Удобный хук для ручной синхронизации из консоли
  window.syncEffects = () => { applyOpenBlocker(); applyTransparency(); Effects.sync(); };
})();
