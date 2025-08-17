(() => {
  console.log('[Main] v1.0.0');

  // 1) Создаём инстанс темы (важно: перезаписываем window.Theme на ИНСТАНС)
  const ThemeClass = window.Theme;           // класс из Library.js
  const App = new ThemeClass('SpotColЛичная');
  window.Theme = App;                        // как и раньше — глобально доступен инстанс

  // 2) Загружаем шрифт Google Noto Sans (без дублей)
  (function injectFonts() {
    const ensure = (attrs) => {
      const id = attrs.id || attrs.href || attrs.rel + ':' + attrs.href;
      if (id && document.querySelector(`link[data-id="${CSS.escape(id)}"]`)) return;
      const link = document.createElement('link');
      Object.assign(link, attrs);
      if (id) link.dataset.id = id;
      document.head.appendChild(link);
    };
    ensure({ rel:'preconnect', href:'https://fonts.googleapis.com' });
    ensure({ rel:'preconnect', href:'https://fonts.gstatic.com', crossOrigin:'anonymous' });
    ensure({ rel:'stylesheet', href:'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&display=swap', id:'noto-sans' });
  })();

  // 3) Вставляем глобальные CSS (аккуратно, через stylesManager темы)
  App.stylesManager.add('global-ui-reset', `
    :root, html, body { font-family: "Noto Sans", system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol"; }
    .Spotify_Screen .SM_Title_Line { line-height: 1.2; }
  `);

  // 4) Инициализация SettingsManager для темы (и дефолты)
  const sm = App.settingsManager;
  sm.defaults({
    // Тема / базовый цвет (опционально может переопределяться handle'ом)
    'Тема.useCustomColor': { value:false },
    'Тема.baseColor':      { value:'#7da6ff' },

    // Эффекты
    'Эффекты.enableBackgroundImage': { value:true },
    'Эффекты.enableAvatarZoom':      { value:true },
    'Эффекты.enableFullVibe':        { value:true }
  });

  // 5) Автозагрузка актуальных настроек из локального handle (если доступен)
  (async () => {
    try { await sm.update(); } catch {}
  })();

  // 6) Небольшие утилиты UI
  App.stylesManager.add('spotify-screen-basics', `
    .Spotify_Screen{ --sm-accent: rgba(255,255,255,.85); }
    .Spotify_Screen .SM_Background,
    .Spotify_Screen .SM_Cover{ transition: opacity .45s ease; }
  `);

  // 7) Open-Blocker: подкачка CSS с GitHub при выключенных блоках
  const openBlockerCache = new Map(); // module -> true/false (injected)
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
      const keyId = `OB${module.charAt(0).toUpperCase()}${module.slice(1)}`; // как у тебя было
      const isEnabled = sm.get(`OpenBlocker.${keyId}`)?.value ?? false;
      if (!isEnabled) continue;
      if (openBlockerCache.get(module)) continue;
      openBlockerCache.set(module, true);

      // подкачиваем css с GitHub, где у тебя лежат стили этих блоков
      const link = document.createElement('link');
      link.rel  = 'stylesheet';
      link.href = `https://raw.githubusercontent.com/Imperiadicks/SpotCol-Scripts/main/Assets/css/open-blocker/${module}.css`;
      link.dataset.id = `ob:${module}`;
      document.head.appendChild(link);
    }
  }
  // следим за обновлениями настроек и применяем OpenBlocker
  sm.on('update', applyOpenBlocker);
  applyOpenBlocker();

  // === Moved from colorize 2.js: Background/Vibe utilities ===
  (function integrateBackgroundTools(App){
    App.__lastBgUrl = App.__lastBgUrl || null;

function backgroundReplace(imageURL) {
    const target = document.querySelector('[class*="MainPage_vibe"]');
    if (!target || !imageURL || imageURL === App.__lastBgUrl) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      App.__lastBgUrl = imageURL;

      const wrapper = document.createElement('div');
      wrapper.className = 'bg-layer';
      Object.assign(wrapper.style, {
        position: 'absolute', inset: '0', zIndex: 0, pointerEvents: 'none'
      });

      const imageLayer = document.createElement('div');
      imageLayer.className = 'bg-cover';
      Object.assign(imageLayer.style, {
        position: 'absolute', inset: '0',
        backgroundImage: `url("${imageURL}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        opacity: '0', transition: 'opacity 1s ease', pointerEvents: 'none'
      });

      const gradient = document.createElement('div');
      gradient.className = 'bg-gradient';
      Object.assign(gradient.style, {
        position: 'absolute', inset: '0',
        background: 'var(--grad-main)',
        mixBlendMode: 'multiply',
        opacity: '0', transition: 'opacity 1.2s ease', pointerEvents: 'none'
      });

      const vibe = target;
      const old = vibe.querySelector('.bg-layer');
      if (old) {
        old.style.opacity = '0';
        setTimeout(() => old.remove(), 1000);
      }

      wrapper.appendChild(imageLayer);
      wrapper.appendChild(gradient);
      wrapper.style.opacity = '0';
      vibe.style.position = 'relative';
      vibe.insertAdjacentElement('afterbegin', wrapper);

      requestAnimationFrame(() => {
        wrapper.style.transition = 'opacity 1s ease';
        wrapper.style.opacity = '1';
        imageLayer.style.opacity = '1';
        gradient.style.opacity = '1';
      });
    };
    img.src = imageURL;
  }

  function removeBackgroundImage() {
    const target = document.querySelector('[class*="MainPage_vibe"]');
    const old = target?.querySelector('.bg-layer');
    if (old) {
      old.style.opacity = '0';
      setTimeout(() => old.remove(), 500);
    }
  }

  function onAvatarMove(e) {
    const avatar = e.currentTarget;
    const rect = avatar.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
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
      transition: 'transform .25s ease, filter .25s ease',
      willChange: 'transform',
      filter: 'drop-shadow(0 6px 20px rgba(0,0,0,.35))'
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

  /* ───────────────────────── FullVibe height ───────────────────────── */
  function FullVibe() {
    const vibe = document.querySelector('[class*="MainPage_vibe"]');
    if (vibe) vibe.style.setProperty('height', '88.35vh', 'important');
  }
  function RemoveFullVibe() {
    const vibe = document.querySelector('[class*="MainPage_vibe"]');
    if (vibe) vibe.style.setProperty('height', '0', 'important');
  }

    // expose API
    App.backgroundReplace = backgroundReplace;
    App.removeBackgroundImage = removeBackgroundImage;
    App.setupAvatarZoomEffect = setupAvatarZoomEffect;
    App.removeAvatarZoomEffect = removeAvatarZoomEffect;
    App.FullVibe = FullVibe;
    App.RemoveFullVibe = RemoveFullVibe;
  })(App);
  // === End moved block ===

  // финал: можно разместить любые хелперы, завязанные на App
})();
