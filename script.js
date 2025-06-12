// script.js
;(function initSpotCol() {
  // Базовый URL репозитория на jsDelivr
  const BASE = 'https://cdn.jsdelivr.net/gh/Imperiadicks/SpotCol-Scripts@50a6c56';
  window.BASE = BASE;
  const THEME_ID      = 'SpotColЛичная';
  const POLL_INTERVAL = 1000;

  // Внешние ресурсы с cache-busting
  const URLS = {
    lib:    `${BASE}/ImperiaLibrary.js?t=${Date.now()}`,
    helper: `${BASE}/helpers.js?t=${Date.now()}`,
    plugin1: `${BASE}/BetterPlayer.js?t=${Date.now()}`,
    events: `${BASE}/handleEvents.json?t=${Date.now()}`,
    plugin2: `${BASE}/ScreenSpotify.js?t=${Date.now()}`,
    plugin3: `${BASE}/colorize.js?t=${Date.now()}`
  };

  // Утиль для динамической загрузки <script>
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src     = src;
      s.async   = true;
      s.onload  = () => resolve();
      s.onerror = () => reject(new Error(`Не удалось загрузить ${src}`));
      document.head.appendChild(s);
    });
  }

  // Главная инициализация: создаём тему, загружаем JSON, плагин и запускаем UI
  async function startTheme() {
    if (!window.ImperiaLibrary?.Theme) {
      console.error('[SpotCol] ImperiaLibrary.Theme не найден');
      return;
    }

    // 1) Создаём тему
    const SpotCol = new window.ImperiaLibrary.Theme(THEME_ID);
    window.SpotCol = SpotCol;

    // 2) Загружаем handleEvents.json вручную (cache-bust)
    let events;
    try {
      const resp = await fetch(URLS.events);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      events = await resp.json();
    } catch (e) {
      console.error('[SpotCol] не удалось загрузить handleEvents.json', e);
      return;
    }

    // 3) Применяем настройки
    const settings = SpotCol.settingsManager.transformJSON(events);
    SpotCol.settingsManager.settings = settings;
    SpotCol.handleEvents.apply(settings);

    // 4) Инициализируем BetterPlayer-плагин
    if (typeof window.BetterPlayer === 'function') {
      new window.BetterPlayer(SpotCol);
    } else {
      console.warn('[SpotCol] BetterPlayer не найден — проверьте загрузку BetterPlayer.js');
    }
   // 4.1) Инициализируем ScreenSpotify-плагин
   if (typeof window.ScreenSpotify === 'function') {
     new window.ScreenSpotify(SpotCol);
   } else {
     console.warn('[SpotCol] ScreenSpotify не найден — проверьте загрузку ScreenSpotify.js');
   }
    // 5) Запускаем циклическое обновление темы/настроек
    SpotCol.start(POLL_INTERVAL);
    console.log('[SpotCol] Тема и плагины запущены');

    // ========== Дальнейшая логика из оригинала ==========

    // Перенос фонового изображения с player-bar в main-vibe
    function updateBackgroundImage() {
      const imgs = document.querySelectorAll('[class*="PlayerBarDesktop_cover"]');
      for (const img of imgs) {
        if (img.src?.includes('/1000x1000')) {
          backgroundReplace(img.src);
          break;
        }
      }
    }
    function backgroundReplace(src) {
      const target = document.querySelector('[class*="MainPage_vibe"]');
      if (target) {
        target.style.background =
          `linear-gradient(180deg, rgba(0,0,0,0.2) 0%, var(--color-dark-6) 100%),` +
          `url(${src}) center/cover no-repeat`;
      }
    }
    updateBackgroundImage();
    setInterval(updateBackgroundImage, 2000);

    // Эффект зума аватарки
    function setupAvatarZoomEffect() {
      const avatar = document.querySelector('[class*="PageHeaderCover_coverImage"]');
      if (!avatar) return;
      avatar.classList.add('avatar-zoom');
      avatar.addEventListener('mousemove', e => {
        const r = avatar.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width - 0.5) * 9;
        const y = ((e.clientY - r.top) / r.height - 0.5) * 9;
        const tx = Math.max(-45, Math.min(45, -x * 11));
        const ty = Math.max(-45, Math.min(45, -y * 11));
        avatar.style.transform = `scale(1.8) translate(${tx}px,${ty}px)`;
      });
      avatar.addEventListener('mouseleave', () => {
        avatar.style.transform = '';
      });
    }
    setupAvatarZoomEffect();

    // Переставляем «Мне нравится» в начало
    const pinObserver = new MutationObserver(() => {
      const pin = document.querySelector('.PinItem_root__WSoCn > a[aria-label="Плейлист Мне нравится"]');
      if (pin) {
        const parentPin = pin.closest('.PinItem_root__WSoCn');
        if (parentPin && parentPin.parentNode.firstChild !== parentPin) {
          parentPin.parentNode.insertBefore(parentPin, parentPin.parentNode.firstChild);
        }
      }
    });
    pinObserver.observe(document.body, { childList: true, subtree: true });

    // Подкупка шрифта Noto Sans
    const links = [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,100..900;1,100..900&display=swap' }
    ];
    for (const cfg of links) {
      const L = document.createElement('link');
      Object.assign(L, cfg);
      document.head.appendChild(L);
    }

    // Убираем даблклик на PlayerBar
    setInterval(() => {
      document.querySelectorAll('.PlayerBar_root__cXUnU').forEach(el => {
        el.addEventListener('dblclick', e => {
          e.preventDefault();
          e.stopPropagation();
        }, true);
      });
    }, 1000);

    // Убираем лишний баннер (если есть)
    const removeSel = [
      '.PeivVKR1FPSKq0eXZVTH.Brf6Ike_kAhLsPhNEEmk',
      '.nc4M2_N9M5ElqO2JOOq7.Brf6Ike_kAhLsPhNEEmk',
      '.prAUKw3AUngspVHmnd5F.Brf6Ike_kAhLsPhNEEmk'
    ].join(', ');
    document.querySelector(removeSel)?.remove();
  }

  // Загружаем скрипты в правильном порядке
  loadScript(URLS.lib)
    .then(() => loadScript(URLS.helper))
    .then(() => loadScript(URLS.plugin1))
    .then(() => loadScript(URLS.plugin2))
    .then(() => loadScript(URLS.plugin3))
    .then(startTheme)
    .catch(err => console.error('[SpotCol] Ошибка загрузки скриптов:', err));
})();