// === Main.js — core bootstrap (v1.1.0) ===
(() => {
  console.log('[Main] v1.1.0');

  // 1) Инициализация Theme (класс приходит из Library.js)
  const ThemeClass = window.Theme;
  if (typeof ThemeClass !== 'function') {
    console.error('[Main] Theme class not found on window.Theme');
    return;
  }
  const App = new ThemeClass('SpotColЛичная');
  window.Theme = App; // публикуем ИНСТАНС

  // 2) Настройки (дефолты согласованы с handle)
  const sm = App.settingsManager;
  sm.defaults({
    'Тема.useCustomColor': { value:false },
    'Тема.baseColor':      { value:'#7da6ff' },

    // Эффекты
    'Эффекты.enableBackgroundImage': { value:true  },
    'Эффекты.enableAvatarZoom':      { value:true  },
    'Эффекты.enableFullVibe':        { value:false }
  });

  // флаг — пока настройки не подтянуты, ничего не «насильно» не вставляем
  App.__settingsReady = false;

  // 3) Подтягиваем handle (первый раз) и сразу синхронизируем всё
  (async () => {
    try { await sm.update(); } catch {}
    finally {
      App.__settingsReady = true;
      try { window.Library?.colorize2?.recolor?.(true); } catch {}
      applyOpenBlocker();
      syncEffects();
    }
  })();

  // ───────────────────────── helpers для чтения настроек ─────────────────────────
  function readSetting(paths, def = null) {
    const tryKeys = Array.isArray(paths) ? paths : [paths];
    for (const k of tryKeys) {
      let v = sm.get?.(k);
      if (v === undefined && k.includes('.')) v = sm.get?.(k.split('.').pop());
      if (v === undefined) continue;
      if (v && typeof v === 'object') {
        if ('value' in v) return v.value;
        if ('text'  in v) return v.text;
      }
      return v;
    }
    return def;
  }

  // ───────────────────────── Open-Blocker ─────────────────────────
  const openBlockerCache = new Map(); // module -> injected?
  const OB_MODULES = [
    'donations','concerts','userprofile','trailers','betabutton',
    'vibeanimation','globaltabs','relevantnow','instyle','likesandhistory','neuromusic',
    'newreleases','personalartists','personalplaylists','recommendedplaylists','smartopenplaylist',
    'waves','charttracks','artistrecommends','barbelow','podcasts','chartalbums',
    'continuelisten','editorialartists','editorialnewreleases','mixedblock',
    'mixesgrid','newplaylists','nonmusiceditorialcompilation','openplaylist'
  ];

  function cssBase() {
    // Можно переопределить глобально window.OpenBlockerBaseCSS
    return window.OpenBlockerBaseCSS || 'https://raw.githubusercontent.com/Open-Blocker-FYM/Open-Blocker/main/blocker-css';
  }

  function applyOpenBlocker() {
    for (const module of OB_MODULES) {
      const keyId = `OB${module.charAt(0).toUpperCase()}${module.slice(1)}`;
      // поддерживаем обе нотации в handle: "OpenBlocker" и "Open-Blocker"
      const val = !!readSetting([`OpenBlocker.${keyId}`, `Open-Blocker.${keyId}`, keyId], false);
      const id = `ob:${module}`;
      const already = document.querySelector(`link[data-id="${id}"]`);

      if (val && !already) {
        // включена блокировка — подгружаем CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `${cssBase()}/${module}.css`;
        link.dataset.id = id;
        document.head.appendChild(link);
        openBlockerCache.set(module, true);
      } else if (!val && already) {
        // выключено — удаляем CSS если был
        already.remove();
        openBlockerCache.delete(module);
      }
    }
  }
  sm.on('update', () => { applyOpenBlocker(); syncEffects(); });

  // ───────────────────────── Background / Zoom / FullVibe ─────────────────────────
  ;(function integrateBackgroundTools(App){
    App.__lastBgUrl    = App.__lastBgUrl    || null;
    App.__bgRetryTimer = App.__bgRetryTimer || null;
    App.__vibeObserver = App.__vibeObserver || null;
    App.__vibeGuard    = App.__vibeGuard    || null;

    const findVibe = () => document.querySelector('[class*="MainPage_vibe"]');

    function getBool(paths, def=false) { return !!readSetting(paths, def); }
    const bgEnabled       = () => getBool(['Эффекты.enableBackgroundImage','enableBackgroundImage'], false);
    const fullVibeEnabled = () => getBool(['Эффекты.enableFullVibe','FullVibe'], false);
    const zoomEnabled     = () => getBool(['Эффекты.enableAvatarZoom','enableAvatarZoom'], true);

    function currentCover() {
      return window.Library?.getHiResCover?.()
          || window.Library?.coverURL?.()
          || App.__lastBgUrl
          || '';
    }

    function ensureVibeThen(imageURL, retries = 24) {
      if (!App.__settingsReady || !bgEnabled()) return;
      const target = findVibe();
      if (!target) {
        clearTimeout(App.__bgRetryTimer);
        if (retries > 0) App.__bgRetryTimer = setTimeout(() => ensureVibeThen(imageURL, retries - 1), 300);
        return;
      }
      const hasLayer = !!target.querySelector('.bg-layer');
      if (imageURL === App.__lastBgUrl && hasLayer) return;
      applyBackground(target, imageURL);
    }

    function applyBackground(target, imageURL) {
      if (!App.__settingsReady || !bgEnabled()) return;
      if (!target || !imageURL) return;

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        App.__lastBgUrl = imageURL;

        const wrapper = document.createElement('div');
        wrapper.className = 'bg-layer';
        Object.assign(wrapper.style, {
          position:'absolute', inset:'0', zIndex:0, pointerEvents:'none',
          opacity:'0', transition:'opacity 1s ease'
        });

        const imageLayer = document.createElement('div');
        imageLayer.className = 'bg-cover';
        Object.assign(imageLayer.style, {
          position:'absolute', inset:'0',
          backgroundImage:`url("${imageURL}")`,
          backgroundSize:'cover', backgroundPosition:'center', backgroundRepeat:'no-repeat',
          opacity:'0', transition:'opacity 1s ease', pointerEvents:'none'
        });

        const gradient = document.createElement('div');
        gradient.className = 'bg-gradient';
        Object.assign(gradient.style, {
          position:'absolute', inset:'0',
          background:'var(--grad-main)', // линейный градиент оставляем
          mixBlendMode:'multiply',
          opacity:'0', transition:'opacity 1.2s ease', pointerEvents:'none'
        });

        const old = target.querySelector('.bg-layer');
        if (old) { old.style.opacity = '0'; setTimeout(() => old.remove(), 900); }

        wrapper.appendChild(imageLayer);
        wrapper.appendChild(gradient);

        target.style.position ||= 'relative';
        target.insertAdjacentElement('afterbegin', wrapper);

        requestAnimationFrame(() => {
          wrapper.style.opacity = '1';
          imageLayer.style.opacity = '1';
          gradient.style.opacity = '1';
        });
      };
      img.src = imageURL;
    }

    function backgroundReplace(imageURL) {
      if (!App.__settingsReady || !bgEnabled()) return;
      ensureVibeThen(imageURL);
    }

    function removeBackgroundImage() {
      const target = findVibe();
      const old = target?.querySelector('.bg-layer');
      if (old) { old.style.opacity = '0'; setTimeout(() => old.remove(), 500); }
    }

    // Avatar Zoom
    function onAvatarMove(e) {
      const avatar = e.currentTarget;
      const rect = avatar.getBoundingClientRect();
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);
      avatar.style.transform = `scale(1.05) translate(${dx * 6}px, ${dy * 6}px)`;
      avatar.style.filter = 'drop-shadow(0 10px 25px rgba(0,0,0,.5))';
    }
    function onAvatarLeave(e) {
      const avatar = e.currentTarget;
      avatar.style.transform = 'scale(1) translate(0,0)';
      avatar.style.filter = 'drop-shadow(0 6px 20px rgba(0,0,0,.35))';
    }
    function setupAvatarZoomEffect() {
      const avatar = document.querySelector('[data-test-id="PLAYERBAR_DESKTOP_COVER_CONTAINER"] img');
      if (!avatar || avatar.classList.contains('avatar-zoom-initialized')) return;
      Object.assign(avatar.style, {
        transition:'transform .25s ease, filter .25s ease',
        willChange:'transform',
        filter:'drop-shadow(0 6px 20px rgba(0,0,0,.35))'
      });
      avatar.addEventListener('mousemove', onAvatarMove);
      avatar.addEventListener('mouseleave', onAvatarLeave);
      avatar.classList.add('avatar-zoom-initialized');
    }
    function removeAvatarZoomEffect() {
      const avatar = document.querySelector('[data-test-id="PLAYERBAR_DESKTOP_COVER_CONTAINER"] img');
      if (!avatar) return;
      avatar.removeEventListener('mousemove', onAvatarMove);
      avatar.removeEventListener('mouseleave', onAvatarLeave);
      avatar.classList.remove('avatar-zoom-initialized');
    }

    // FullVibe
    function FullVibe() {
      if (!App.__settingsReady || !fullVibeEnabled()) return;
      const vibe = findVibe();
      if (vibe) vibe.style.setProperty('height', '88.35vh', 'important');
    }
    function RemoveFullVibe() {
      const vibe = findVibe();
      if (vibe) vibe.style.removeProperty('height');
    }

    // Наблюдатель за DOM (возврат на «Главное» и т.п.)
    function ensureVibeObserver() {
      if (App.__vibeObserver) return;
      App.__vibeObserver = new MutationObserver(() => {
        if (!App.__settingsReady) return;
        if (bgEnabled()) {
          const url = currentCover();
          if (url) ensureVibeThen(url, 8);
        } else {
          removeBackgroundImage();
        }
        if (fullVibeEnabled()) FullVibe(); else RemoveFullVibe();
      });
      const root = document.querySelector('[class*="CommonLayout_root"]') || document.body;
      App.__vibeObserver.observe(root, { childList:true, subtree:true });
    }
    ensureVibeObserver();

    // Сторож: фон обязан быть актуален
    if (!App.__vibeGuard) {
      App.__vibeGuard = setInterval(() => {
        if (!App.__settingsReady || !bgEnabled()) return;
        const target = findVibe();
        if (!target) return;

        const src = currentCover();
        const hasBg = target.querySelector('.bg-layer');
        if (src && (!hasBg || src !== App.__lastBgUrl)) {
          ensureVibeThen(src, 4);
        }
      }, 1200);
    }

    // Применение эффектов в одном месте
    function syncEffects() {
      if (!App.__settingsReady) return;

      const bg   = bgEnabled();
      const full = fullVibeEnabled();
      const zoom = zoomEnabled();
      console.log('[Main] syncEffects', { bg, full, zoom });

      if (bg) {
        const url = currentCover();
        if (url) ensureVibeThen(url, 6);
      } else {
        removeBackgroundImage();
      }

      if (full) FullVibe(); else RemoveFullVibe();
      if (zoom) setupAvatarZoomEffect(); else removeAvatarZoomEffect();
    }
    App.__syncEffects = syncEffects;

    // Публичное API
    App.backgroundReplace      = backgroundReplace;
    App.removeBackgroundImage  = removeBackgroundImage;
    App.setupAvatarZoomEffect  = setupAvatarZoomEffect;
    App.removeAvatarZoomEffect = removeAvatarZoomEffect;
    App.FullVibe               = FullVibe;
    App.RemoveFullVibe         = RemoveFullVibe;
  })(App);

  // 6) Внешняя обёртка (удобно дёргать из консоли)
  function syncEffects(){ App.__syncEffects?.(); }
  window.syncEffects = syncEffects;

  // 7) Персистентный watcher handle (poll + storage)
  (() => {
    // Ключи, за которыми точно следим (эффекты + тема + Open-Blocker)
    const EFFECT_KEYS = [
      'Эффекты.enableBackgroundImage',
      'Эффекты.enableAvatarZoom',
      'Эффекты.enableFullVibe'
    ];
    const OB_KEYS = OB_MODULES.map(m => [
      `OpenBlocker.OB${m.charAt(0).toUpperCase()}${m.slice(1)}`,
      `Open-Blocker.OB${m.charAt(0).toUpperCase()}${m.slice(1)}`
    ]).flat();

    let sigPrev = '';
    let inflight = false;

    function makeSignature() {
      const eff = EFFECT_KEYS.map(k => `${k}=${readSetting(k)}`).join('|');
      const ob  = OB_KEYS.map(k => `${k}=${readSetting(k)}`).join('|');
      const theme = [
        `Тема.useCustomColor=${readSetting('Тема.useCustomColor')}`,
        `Тема.baseColor=${readSetting('Тема.baseColor')}`,
        `useCustomColor=${readSetting('useCustomColor')}`,
        `baseColor=${readSetting('baseColor')}`
      ].join('|');
      return `${eff}#${ob}#${theme}`;
    }

    async function tick() {
      if (inflight || !App.__settingsReady) return;
      inflight = true;
      try { await sm.update(); } catch {}
      finally { inflight = false; }

      const sig = makeSignature();
      if (sig !== sigPrev) {
        sigPrev = sig;
        try { applyOpenBlocker(); } catch {}
        try { App.__syncEffects?.(); } catch {}
        try { window.Library?.colorize2?.recolor?.(true); } catch {}
      }
    }

    const start = () => {
      tick();
      App.__settingsWatcher && clearInterval(App.__settingsWatcher);
      App.__settingsWatcher = setInterval(tick, 1200);
    };

    if (App.__settingsReady) start();
    else {
      const iv = setInterval(() => { if (App.__settingsReady) { clearInterval(iv); start(); } }, 250);
    }

    window.addEventListener('storage', tick);
  })();

})();
