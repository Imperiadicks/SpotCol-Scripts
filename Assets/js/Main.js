(() => {
  console.log('[Main] v1.0.2');

  // 1) Создаём инстанс темы (класс берём из Library.js)
  const ThemeClass = window.Theme;           // класс
  const App = new ThemeClass('SpotColЛичная');
  window.Theme = App;                        // глобально доступный ИНСТАНС

  // 2) Инициализация SettingsManager (дефолты)
  const sm = App.settingsManager;
  sm.defaults({
    // Тема / базовый цвет (может переопределяться handle'ом)
    'Тема.useCustomColor': { value:false },
    'Тема.baseColor':      { value:'#7da6ff' },

    // Эффекты
    'Эффекты.enableBackgroundImage': { value:true },
    'Эффекты.enableAvatarZoom':      { value:true },
    'Эффекты.enableFullVibe':        { value:true }
  });

  // Флаг готовности настроек (пока handle не подгружен — ничего «насильно» не вставляем)
  App.__settingsReady = false;

  // 3) Автоподтяжка актуальных настроек из локального handle (если доступен)
  (async () => {
    try { await sm.update(); } catch {}
    finally {
      App.__settingsReady = true;
      syncEffects(); // сразу применим/отключим по фактическим настройкам
    }
  })();

  // 4) Open-Blocker: подкачка CSS с GitHub при включённых модулях
  const openBlockerCache = new Map(); // module -> injected?
  const OB_MODULES = [
    'donations','concerts','userprofile','trailers','betabutton',
    'vibeanimation','globaltabs','relevantnow','instyle','likesandhistory','neuromusic',
    'newreleases','personalartists','personalplaylists','recommendedplaylists','smartopenplaylist',
    'waves','charttracks','artistrecommends','barbelow','podcasts','chartalbums',
    'continuelisten','editorialartists','editorialnewreleases','mixedblock',
    'mixesgrid','newplaylists','nonmusiceditorialcompilation','openplaylist'
  ];
  async function applyOpenBlocker() {
    for (const module of OB_MODULES) {
      const keyId = `OB${module.charAt(0).toUpperCase()}${module.slice(1)}`;
      const isEnabled = sm.get(`OpenBlocker.${keyId}`)?.value ?? false;
      if (!isEnabled || openBlockerCache.get(module)) continue;
      openBlockerCache.set(module, true);

      const link = document.createElement('link');
      link.rel  = 'stylesheet';
      link.href = `https://raw.githubusercontent.com/Imperiadicks/SpotCol-Scripts/main/Assets/css/open-blocker/${module}.css`;
      link.dataset.id = `ob:${module}`;
      document.head.appendChild(link);
    }
  }
  sm.on('update', () => { applyOpenBlocker(); syncEffects(); });
  applyOpenBlocker();

  // === Background/Vibe utilities (усиленные DOM-проверки + уважение handle) ===
  (function integrateBackgroundTools(App){
    App.__lastBgUrl = App.__lastBgUrl || null;
    App.__bgRetryTimer = null;
    App.__vibeObserver = null;

    const findVibe = () => document.querySelector('[class*="MainPage_vibe"]');
    const bgEnabled = () => sm.get('Эффекты.enableBackgroundImage')?.value === true;
    const fullVibeEnabled = () => sm.get('Эффекты.enableFullVibe')?.value === true;

    function ensureVibeThen(imageURL, retries = 24) { // ~7.2s (шаг 300мс)
      if (!App.__settingsReady || !bgEnabled()) return;
      const target = findVibe();
      if (!target) {
        clearTimeout(App.__bgRetryTimer);
        if (retries > 0) App.__bgRetryTimer = setTimeout(() => ensureVibeThen(imageURL, retries - 1), 300);
        return;
      }
      // если слой уже есть и URL тот же — ничего не делаем
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
          background:'var(--grad-main)', // ← твой линейный градиент оставляем
          mixBlendMode:'multiply',
          opacity:'0', transition:'opacity 1.2s ease', pointerEvents:'none'
        });

        // убрать старый слой, если был
        const old = target.querySelector('.bg-layer');
        if (old) { old.style.opacity = '0'; setTimeout(() => old.remove(), 900); }

        wrapper.appendChild(imageLayer);
        wrapper.appendChild(gradient);

        target.style.position = target.style.position || 'relative';
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
      // Уважаем handle: пока настройки не готовы ИЛИ выключено — выходим
      if (!App.__settingsReady || !bgEnabled()) return;
      ensureVibeThen(imageURL);
    }

    function removeBackgroundImage() {
      const target = findVibe();
      const old = target?.querySelector('.bg-layer');
      if (old) { old.style.opacity = '0'; setTimeout(() => old.remove(), 500); }
    }

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

    function FullVibe() {
      if (!App.__settingsReady || !fullVibeEnabled()) return;
      const vibe = findVibe();
      if (vibe) vibe.style.setProperty('height', '88.35vh', 'important');
    }
    function RemoveFullVibe() {
      // Не прячем блок, а возвращаем нативную высоту
      const vibe = findVibe();
      if (vibe) vibe.style.removeProperty('height');
    }

    // Наблюдатель: когда блок Vibe появляется заново (возврат на «Главное»),
    // автоматически восстанавливаем фон, только если разрешено в настройках.
    function ensureVibeObserver() {
      if (App.__vibeObserver) return;
      App.__vibeObserver = new MutationObserver(() => {
        if (!App.__settingsReady || !bgEnabled()) return;
        const target = findVibe();
        if (target) {
          const url = window.Library?.getHiResCover?.() || window.Library?.coverURL?.() || App.__lastBgUrl;
          if (url) ensureVibeThen(url, 8);
        }
      });
      const root = document.querySelector('[class*="CommonLayout_root"]') || document.body;
      App.__vibeObserver.observe(root, { childList:true, subtree:true });
    }
    ensureVibeObserver();

    // Синхронизация эффектов с настройками
    function syncEffects() {
      if (!App.__settingsReady) return;
      if (bgEnabled()) {
        const url = window.Library?.getHiResCover?.() || window.Library?.coverURL?.() || App.__lastBgUrl;
        if (url) ensureVibeThen(url, 6);
      } else {
        removeBackgroundImage();
      }
      if (fullVibeEnabled()) FullVibe(); else RemoveFullVibe();
    }
    App.__syncEffects = syncEffects; // экспорт внутрь инстанса

    // Экспорт в инстанс темы
    App.backgroundReplace      = backgroundReplace;
    App.removeBackgroundImage  = removeBackgroundImage;
    App.setupAvatarZoomEffect  = setupAvatarZoomEffect;
    App.removeAvatarZoomEffect = removeAvatarZoomEffect;
    App.FullVibe               = FullVibe;
    App.RemoveFullVibe         = RemoveFullVibe;
  })(App);

  // Локальная обёртка, чтобы можно было вызвать изнаружи
  function syncEffects(){ App.__syncEffects?.(); }

  // финал
})();
