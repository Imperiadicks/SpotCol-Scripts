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
    ensure({ rel: 'preconnect', href: 'https://fonts.googleapis.com', id: 'gfonts-preconnect-1' });
    ensure({ rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous', id: 'gfonts-preconnect-2' });
    ensure({ rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,100..900;1,100..900&display=swap', id: 'gfonts-noto-sans' });
  })();

  // 3) Отключаем двойной клик в нижней панели плеера (без setInterval)
  (function disableDoubleClick() {
    const handler = (evt) => {
      const bar = evt.target.closest?.('.PlayerBar_root__cXUnU, .PlayerBarDesktop_root__d2Hwi');
      if (bar) {
        evt.preventDefault();
        evt.stopPropagation();
      }
    };
    // в «захвате», чтобы гарантированно перехватить
    document.addEventListener('dblclick', handler, true);
  })();

  // 4) Двигаем «Плейлист Мне нравится» в закреплённых — наверх
  (function pinLikedPlaylistToTop() {
    const obs = new MutationObserver(() => {
      const pin = document.querySelector('.PinItem_root__WSoCn > a[aria-label="Плейлист Мне нравится"]');
      if (!pin) return;
      const parent = pin.closest('.PinItem_root__WSoCn');
      if (parent && parent.parentNode.firstChild !== parent) {
        parent.parentNode.insertBefore(parent, parent.parentNode.firstChild);
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  })();

  // 5) Адаптер чтения настроек из SettingsManager (поддержка и "секция.ключ", и "ключ")
  const sm = App.settingsManager;
  const readSetting = (keys, def) => {
    const arr = Array.isArray(keys) ? keys : [keys];
    for (const k of arr) {
      // пытаемся получить как есть
      let v = sm.get?.(k);
      // если не нашли — пробуем «секция.ключ» → «ключ»
      if (v === undefined && k.includes('.')) v = sm.get?.(k.split('.').pop());
      if (v === undefined) continue;
      if (v && typeof v === 'object') {
        if ('value' in v) return v.value;
        if ('text' in v) return v.text;
      }
      return v;
    }
    return def;
  };

  // 6) Стили по тумблерам пользователя (один <style>, всё внутри)
  const styleId = 'sc-user-style';
  function ensureStyleTag() {
    let tag = document.getElementById(styleId);
    if (!tag) {
      tag = document.createElement('style');
      tag.id = styleId;
      document.head.appendChild(tag);
    }
    return tag;
  }

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
      const val = !!readSetting([`Open-Blocker.${keyId}`, keyId], true);
      const styleId = `openblocker-${module}`;
      const existing = document.getElementById(styleId);

      // Логика как в старом коде:
      // - true  → блок ВКЛЮЧЕН (ничего не загружаем, уверены что видим нативный блок)
      // - false → подгружаем CSS, чтобы ЗАБЛОКИРОВАТЬ элемент
      if (val === true) {
        if (existing) existing.remove();
        openBlockerCache.set(module, false);
      } else {
        if (!existing && openBlockerCache.get(module) !== true) {
          try {
            const res = await fetch(`https://raw.githubusercontent.com/Open-Blocker-FYM/Open-Blocker/refs/heads/main/blocker-css/${module}.css`, { cache: 'no-store' });
            const css = await res.text();
            const st = document.createElement('style');
            st.id = styleId;
            st.textContent = css;
            document.head.appendChild(st);
            openBlockerCache.set(module, true);
          } catch (e) {
            console.error('[Main][Open-Blocker] load error:', module, e);
          }
        }
      }
    }
  }

  // 8) UI-твики из секции «Действия» и «Особое»
  let _lastBgURL = '';
  function applyUiTweaks() {
    const st = ensureStyleTag();

    // Смена фонового изображения (если у тебя есть глобальная setNewBackground)
    const bgURL = readSetting(['Действия.myBackgroundButton', 'myBackgroundButton'], '');
    if (bgURL && bgURL !== _lastBgURL) {
      _lastBgURL = bgURL;
      try { window.setNewBackground?.(bgURL); } catch (e) { console.warn('[Main] setNewBackground failed', e); }
    }

    // Прозрачности/границы (togglePlayerBackground)
    const toggleBg = !!readSetting(['Действия.togglePlayerBackground', 'togglePlayerBackground'], false);

    // Увеличенная Vibe-зона (Newbuttona)
    const vibeTall = !!readSetting(['Действия.Newbuttona', 'Newbuttona'], false);

    // Включить пункт меню (NewbuttonHide) — по старой логике наоборот: если false — скрыть
    const showMenuItem = !!readSetting(['Действия.NewbuttonHide', 'NewbuttonHide'], true);

    // Автоплей при старте
    const autoPlay = !!readSetting(['Действия.devAutoPlayOnStart', 'devAutoPlayOnStart'], false);
    if (autoPlay && !window.__scAutoPlayed) {
      window.__scAutoPlayed = true;
      document.querySelector(`section.PlayerBar_root__cXUnU * [data-test-id="PLAY_BUTTON"]`)?.click();
    }

    st.textContent = `
      /* Прозрачности/фоны */
      .PlayerBarDesktop_root__d2Hwi { background: ${toggleBg ? 'transparent' : ''} !important; }
      .Content_main__8_wIa { background: ${toggleBg ? 'transparent' : ''} !important; }
      .Spotify_Screen,
      .All_Info_Container,
      .Artist_Info_Container,
      .GPT_Info_Container { background: ${toggleBg ? 'transparent' : ''} !important; }
      .LikesAndHistoryItem_root__oI1gk,
      .MixCard_root__9tPLV,
      .NewReleaseCard_root__IY5m_,
      .VibeButton_button__tXFAm,
      .NeuromusicButton_button__kT4GN {
        ${toggleBg ? 'background: transparent !important; border: 0 !important;' : ''}
      }
      .nHWc2sto1C6Gm0Dpw_l0 { backdrop-filter: ${toggleBg ? 'blur(0px)' : ''} !important; }
      .VibeContext_context__Z_82k { backdrop-filter: ${toggleBg ? 'blur(0px)' : 'blur(5px)'} !important; }

      /* Высота Vibe */
      .MainPage_vibe__XEBbh { height: ${vibeTall ? '89vh' : '57vh'} !important; }

      /* Пункты меню (селекторы как в старом коде) */
      body > div.WithTopBanner_root__P__x3 > div > div > aside > div > div.NavbarDesktop_scrollableContainer__HLc9D > div > nav > ol > li:nth-child(3) > a > div.zpkgiiHgDpbBThy6gavq {
        visibility: ${showMenuItem ? 'visible' : 'hidden'} !important;
      }
      body > div.WithTopBanner_root__P__x3 > div > div > aside > div > div.NavbarDesktop_scrollableContainer__HLc9D > div > nav > ol > li:nth-child(4) > a > div.zpkgiiHgDpbBThy6gavq {
        left: ${showMenuItem ? '175px' : '125px'} !important;
      }
    `;
  }

  // 9) Применение настроек при каждом апдейте SettingsManager
  sm.on('update', async () => {
    try {
      await applyOpenBlocker();
      applyUiTweaks();

      // Динамическая частота опроса настроек (Особое.setInterval)
      const msText = readSetting(['Особое.setInterval', 'setInterval'], { text: '1000' })?.text || readSetting('Особое.setInterval.text', '1000') || '1000';
      const ms = Math.max(300, parseInt(msText, 10) || 1000);

      if (App.__pollMs !== ms) {
        App.__pollMs = ms;
        App.stop();
        App.start(ms);
        console.log('[Main] settings poll interval =', ms, 'ms');
      }
    } catch (e) {
      console.error('[Main] apply settings failed:', e);
    }
  });

  // 10) Первый запуск: один апдейт и старт цикла
  (async () => {
    try {
      await App.update();
    } catch (e) {
      console.warn('[Main] initial update failed', e);
    }
    const initialMs = Math.max(300, parseInt(readSetting(['Особое.setInterval.text', 'setInterval.text'], '1000'), 10) || 1000);
    App.__pollMs = initialMs;
    App.start(initialMs);
  })();

  // 11) SpotifyScreen пересоздастся при смене адреса САМ (Theme это уже делает),
  //    но на всякий случай синхронизируем при возвращении на вкладку.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      try { App.SpotifyScreen?.check?.(); } catch {}
    }
  });

  // 12) Включаем расширенный цветокор (новый модуль) — он уже авто-стартует, но пусть будет вызов
  try { window.Library?.colorize2?.start?.(); } catch {}
})();
