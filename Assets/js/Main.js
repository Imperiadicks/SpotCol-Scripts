// === Main.js — rebooted core (v2.0.1) ===
(() => {
  console.log('[Main] v2.0.1');

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

  // ── 3. First load from handle, then sync everything
  (async () => {
    try { await sm.update(); } catch {}
    finally {
      App.__settingsReady = true;
      try { window.Library?.colorize2?.recolor?.(true); } catch {}
      applyOpenBlocker();
      Effects.sync();
    }
  })();

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
  // 4) Open-Blocker (Git-only)
  const OB_MODULES = [
    'donations','concerts','userprofile','trailers','betabutton',
    'vibeanimation','globaltabs','relevantnow','instyle','likesandhistory','neuromusic',
    'newreleases','personalartists','personalplaylists','recommendedplaylists','smartopenplaylist',
    'waves','charttracks','artistrecommends','barbelow','podcasts','chartalbums',
    'continuelisten','editorialartists','editorialnewreleases','mixedblock',
    'mixesgrid','newplaylists','nonmusiceditorialcompilation','openplaylist'
  ];
  const OB_REMOTE = () =>
    window.OpenBlockerBaseCSSRemote ||
    'https://raw.githubusercontent.com/Open-Blocker-FYM/Open-Blocker/main/blocker-css';
  const obCache = new Map();
  const obKey   = (m) => `OB${m.charAt(0).toUpperCase()}${m.slice(1)}`;

  function injectOB(mod) {
    const id = `ob:${mod}`;
    if (document.querySelector(`link[data-id="${id}"]`)) return;
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = `${OB_REMOTE()}/${mod}.css`;
    link.dataset.id = id;
    link.crossOrigin   = 'anonymous';
    link.referrerPolicy = 'no-referrer';
    document.head.appendChild(link);
  }
  function removeOB(mod) {
    document.querySelector(`link[data-id="ob:${mod}"]`)?.remove();
  }

  // ← ключевой фикс: поддерживаем легаси-ключ "NewbuttonHide" для подкастов
  function readOBEnabled(module) {
    // обычные варианты: OpenBlocker/ Open-Blocker / просто ключ (OBxxxx)
    const key = obKey(module);
    let v =
      readSM(`OpenBlocker.${key}`) ??
      readSM(`Open-Blocker.${key}`) ??
      readSM(key);

    // legacy: id "NewbuttonHide" = «Подкасты: убрать». True → включаем скрывающий CSS podcasts.
    if ((v === undefined || v === null) && module === 'podcasts') {
      v = readSM(['Open-Blocker.NewbuttonHide', 'OpenBlocker.NewbuttonHide', 'NewbuttonHide']);
    }
    return !!v;
  }

  function applyOpenBlocker() {
    for (const mod of OB_MODULES) {
      const enabled = readOBEnabled(mod);
      const prev = obCache.get(mod) ?? false;
      if (enabled && !prev) { injectOB(mod); obCache.set(mod, true); }
      else if (!enabled && prev) { removeOB(mod); obCache.set(mod, false); }
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 5) Background / FullVibe / Zoom — аккуратно и локально
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
  // 7) Persistent handle watcher (poll + storage)
  ;(() => {
    const EFFECT_KEYS = [
      'Эффекты.enableBackgroundImage',
      'Эффекты.enableAvatarZoom',
      'Эффекты.enableFullVibe',
      'Тема.useCustomColor','Тема.baseColor','useCustomColor','baseColor'
    ];
    const OB_KEYS = OB_MODULES.map(m => [
      `OpenBlocker.OB${m.charAt(0).toUpperCase()}${m.slice(1)}`,
      `Open-Blocker.OB${m.charAt(0).toUpperCase()}${m.slice(1)}`
    ]).flat();
    // ← добавили легаси ключи подкастов
    const LEGACY_PODCAST_KEYS = ['Open-Blocker.NewbuttonHide', 'OpenBlocker.NewbuttonHide', 'NewbuttonHide'];

    let prev = '';
    let inflight = false;

    const signature = () => {
      const eff = EFFECT_KEYS.map(k => `${k}=${readSM(k)}`).join('|');
      const ob  = OB_KEYS.map(k => `${k}=${readSM(k)}`).join('|');
      const lg  = LEGACY_PODCAST_KEYS.map(k => `${k}=${readSM(k)}`).join('|');
      return eff + '#' + ob + '#' + lg;
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
        Effects.sync();
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
  // 8) Start effects watchers
  Effects.start();

  // удобный хук для консоли
  window.syncEffects = () => Effects.sync();
})();
