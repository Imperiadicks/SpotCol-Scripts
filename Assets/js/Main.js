// === Main.js — core bootstrap (v1.0.4) ===
(() => {
  console.log('[Main] v1.0.4');

  // 1) Инициализируем тему (класс приходит из Library.js)
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

  // пока handle не подтянут — эффекты не трогаем
  App.__settingsReady = false;

  // 3) Подтягиваем handle и сразу синхронизируем эффекты/цвета
  (async () => {
    try { await sm.update(); } catch {}
    finally {
      App.__settingsReady = true;
      try { window.Library?.colorize2?.recolor?.(true); } catch {}
      syncEffects();
      applyOpenBlocker();
    }
  })();

  // 4) Open-Blocker CSS (подключение по настройкам)
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
    // Если укажешь глобально base, возьмём его, иначе — официальный репозиторий
    return window.OpenBlockerBaseCSS || 'https://raw.githubusercontent.com/Open-Blocker-FYM/Open-Blocker/main/blocker-css';
  }

  function applyOpenBlocker() {
    for (const module of OB_MODULES) {
      const keyId = `OB${module.charAt(0).toUpperCase()}${module.slice(1)}`;
      const isEnabled = sm.get(`OpenBlocker.${keyId}`)?.value ?? false;
      if (!isEnabled || openBlockerCache.get(module)) continue;

      openBlockerCache.set(module, true);
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `${cssBase()}/${module}.css`;
      link.dataset.id = `ob:${module}`;
      document.head.appendChild(link);
    }
  }
  sm.on('update', () => { applyOpenBlocker(); syncEffects(); });

  // 5) Background / Zoom / FullVibe — только здесь (colorize2 занимается «краской»)
  (function integrateBackgroundTools(App){
    App.__lastBgUrl    = App.__lastBgUrl    || null;
    App.__bgRetryTimer = App.__bgRetryTimer || null;
    App.__vibeObserver = App.__vibeObserver || null;
    App.__vibeGuard    = App.__vibeGuard    || null;

    const findVibe = () => document.querySelector('[class*="MainPage_vibe"]');

    // универсальный геттер булевых настроек (и по секции, и по id)
    function getBoolSM(paths, def=false) {
      for (const key of paths) {
        const v = sm.get(key);
        if (typeof v?.value === 'boolean') return v.value;
        if (typeof v === 'boolean') return v;
      }
      return def;
    }
    const bgEnabled       = () => getBoolSM(['Эффекты.enableBackgroundImage','enableBackgroundImage'], false);
    const fullVibeEnabled = () => getBoolSM(['Эффекты.enableFullVibe','FullVibe'], false);
    const zoomEnabled     = () => getBoolSM(['Эффекты.enableAvatarZoom','enableAvatarZoom'], true);

    function currentCover() {
      return window.Library?.getHiResCover?.()
          || window.Library?.coverURL?.()
          || App.__lastBgUrl
          || '';
    }

    function ensureVibeThen(imageURL, retries = 24) { // ~7.2s с шагом 300мс
      if (!App.__settingsReady || !bgEnabled()) return;
      const target = findVibe();
      if (!target) {
        clearTimeout(App.__bgRetryTimer);
        if (retries > 0) App.__bgRetryTimer = setTimeout(() => ensureVibeThen(imageURL, retries - 1), 300);
        return;
      }
      const hasLayer = !!target.querySelector('.bg-layer');
      if (imageURL === App.__lastBgUrl && hasLayer) return;
      applyBackground(target, imageURL, hasLayer);
    }

    function applyBackground(target, imageURL/*, hadLayer*/) {
      if (!App.__settingsReady || !bgEnabled()) return;
      if (!target || !imageURL) return;

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        App.__lastBgUrl = imageURL;

        const wrapper = document.createElement('div');
        wrapper.className = 'bg-layer';
        Object.assign(wrapper.style, {
          position:'absolute', inset:'0', zIndex:0, pointerEvents:'none', opacity:'0', transition:'opacity 1s ease'
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
          background:'var(--grad-main)', // линейный градиент — оставляем
          mixBlendMode:'multiply',
          opacity:'0', transition:'opacity 1.2s ease', pointerEvents:'none'
        });

        // убрать старый слой, если был
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

    // ——— Avatar Zoom
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

    // ——— FullVibe
    function FullVibe() {
      if (!App.__settingsReady || !fullVibeEnabled()) return;
      const vibe = findVibe();
      if (vibe) vibe.style.setProperty('height', '88.35vh', 'important');
    }
    function RemoveFullVibe() {
      const vibe = findVibe();
      if (vibe) vibe.style.removeProperty('height');
    }

    // ——— Наблюдатели за DOM (возврат на «Главное» и т.п.)
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

    // ——— Guard: фон должен всегда присутствовать и быть актуальным
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

    // ——— Синхронизация эффектов с настройками
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

    // ——— Публичное API
    App.backgroundReplace      = backgroundReplace;
    App.removeBackgroundImage  = removeBackgroundImage;
    App.setupAvatarZoomEffect  = setupAvatarZoomEffect;
    App.removeAvatarZoomEffect = removeAvatarZoomEffect;
    App.FullVibe               = FullVibe;
    App.RemoveFullVibe         = RemoveFullVibe;
  })(App);

  // 6) Внешняя обёртка (по желанию можешь дергать из консоли)
  function syncEffects(){ App.__syncEffects?.(); }
  window.syncEffects = syncEffects; // не обязателен, но удобно

  // финал
})();

