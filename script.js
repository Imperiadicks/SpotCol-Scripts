;(function initSpotCol() {
  const LIB_URL     = `https://cdn.jsdelivr.net/gh/Imperiadicks/SpotCol-Scripts@latest/ImperiaLibrary.js?t=${Date.now()}`;
  const HELPER_URL  = `https://cdn.jsdelivr.net/gh/Imperiadicks/SpotCol-Scripts@latest/helpers.js?t=${Date.now()}`;
  const BP_URL      = `https://cdn.jsdelivr.net/gh/Imperiadicks/SpotCol-Scripts@latest/BetterPlayer.js?t=${Date.now()}`;
  const EVENTS_URL  = `https://cdn.jsdelivr.net/gh/Imperiadicks/SpotCol-Scripts@latest/handleEvents.json?t=${Date.now()}`;
  const THEME_ID    = 'SpotColЛичная';
  const POLL_INTERVAL = 1000;

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

  async function loadEvents() {
    let resp = await fetch(EVENTS_URL);
    if (!resp.ok) throw new Error(`handleEvents.json: ${resp.status}`);
    return resp.json();
  }

  async function startTheme() {
    // убедимся, что ImperiaLibrary подгрузилась
    const { Theme } = window.ImperiaLibrary || {};
    if (!Theme) {
      console.error('[SpotCol] ImperiaLibrary.Theme отсутствует');
      return;
    }

    // создаём экземпляр темы
    const SpotCol = new Theme(THEME_ID);
    window.SpotCol = SpotCol;

    // вручную подтягиваем handleEvents.json с cache-busting
    let events;
    try {
      events = await loadEvents();
    } catch (e) {
      console.error('[SpotCol] не удалось загрузить handleEvents.json', e);
      return;
    }

    // преобразуем JSON в структуру настроек и применяем один раз
    const settings = SpotCol.settingsManager.transformJSON(events);
    SpotCol.settingsManager.settings = settings;
    SpotCol.handleEvents.apply(settings);

    // теперь инициализируем ваш плагин BetterPlayer
    if (typeof window.BetterPlayer === 'function') {
      new window.BetterPlayer(SpotCol);
    } else {
      console.warn('[SpotCol] BetterPlayer не найден — проверьте загрузку BetterPlayer.js');
    }

    // запускаем цикл опроса настроек (при необходимости можно убрать)
    SpotCol.start(POLL_INTERVAL);
    console.log('[SpotCol] тема и BetterPlayer запущены');
  }

  // загружаем в очередь: ImperiaLibrary → helpers → BetterPlayer → старт темы
  loadScript(LIB_URL)
    .then(() => loadScript(HELPER_URL))
    .then(() => loadScript(BP_URL))
    .then(startTheme)
    .catch(err => console.error('[SpotCol] Ошибка загрузки скриптов:', err));

/*_____________________________________________________________________________________________*/
/**
 * Перенос фонового изображения с player-bar в main-vibe
 */
function updateBackgroundImage() {
  const imgs = document.querySelectorAll('[class*="PlayerBarDesktop_cover"]');
  for (const img of imgs) {
    if (img.src?.includes('/1000x1000')) {
      backgroundReplace(img.src);
      break; // после первого совпадения сразу выходим
    }
  }
}

function backgroundReplace(src) {
  const target = document.querySelector('[class*="MainPage_vibe"]');
  if (target) {
    target.style.background =
      `linear-gradient(180deg, rgba(0,0,0,0.2) 0%, var(--color-dark-6) 100%), 
       url(${src}) center/cover no-repeat`;
  }
}

/**
 * Добавляет эффект увеличения для аватарки
 * — логика 그대로 из Вашего скрипта :contentReference[oaicite:2]{index=2}:contentReference[oaicite:3]{index=3}
 */
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
/*--------------------------------------------*/

/*--------------------------------------------*/
const observer = new MutationObserver(() => {
    let pin = document.querySelector('.PinItem_root__WSoCn > a[aria-label="Плейлист Мне нравится"]');
    if (pin) {
        let parentPin = pin.closest('.PinItem_root__WSoCn');
        if (parentPin && parentPin.parentNode.firstChild !== parentPin) {
            parentPin.parentNode.insertBefore(parentPin, parentPin.parentNode.firstChild);
        }
    }
});

observer.observe(document.body, { childList: true, subtree: true });
/*--------------------------------------------*/

// Google Noto Sans Font
/*--------------------------------------------*/
const link1 = document.createElement('link');
link1.rel = 'preconnect';
link1.href = 'https://fonts.googleapis.com';
document.head.appendChild(link1);

const link2 = document.createElement('link');
link2.rel = 'preconnect';
link2.href = 'https://fonts.gstatic.com';
link2.crossOrigin = 'anonymous';
document.head.appendChild(link2);

const link3 = document.createElement('link');
link3.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,100..900;1,100..900&display=swap';
link3.rel = 'stylesheet';
document.head.appendChild(link3);
/*--------------------------------------------*/
document.querySelector('.PeivVKR1FPSKq0eXZVTH.Brf6Ike_kAhLsPhNEEmk, .nc4M2_N9M5ElqO2JOOq7.Brf6Ike_kAhLsPhNEEmk, .prAUKw3AUngspVHmnd5F.Brf6Ike_kAhLsPhNEEmk').remove()});
