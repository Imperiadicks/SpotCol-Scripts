// === Main.js — v2.3.0 ===
// Цель: корректная синхронизация с handle для «Прозрачности», «Подкастов» и всех модулей Open-Blocker.
// Ничего не ломаем: только добавления и более строгая логика чтения handle.

(() => {
  console.log('[Main] v2.3.0 start');

  // ────────────────────────────────────────────────────────────────────────────
  // Доступ к settingsManager из разных возможных мест (совместимость)
  const sm =
    window?.Theme?.settingsManager ||
    window?.SpotColЛичная?.settingsManager ||
    window?.settingsManager ||
    window?.SettingsManager ||
    null;

  if (!sm) {
    console.error('[Main] settingsManager not found.');
    return;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Утилиты для чтения handle c поддержкой формата { value }
  const getRaw = (key) => {
    try {
      if (typeof sm.get === 'function') {
        const v = sm.get(key);
        if (v && typeof v === 'object' && 'value' in v) return v.value;
        return v;
      }
      // прямой доступ, если есть sm.settings
      const parts = key.split('.');
      let cur = sm.settings || {};
      for (const p of parts) cur = cur?.[p];
      if (cur && typeof cur === 'object' && 'value' in cur) return cur.value;
      return cur;
    } catch { return undefined; }
  };

  // Чтение с альтернативными ключами
  const read = (keys, def = undefined) => {
    const list = Array.isArray(keys) ? keys : [keys];
    for (const k of list) {
      const v = getRaw(k);
      if (v !== undefined) return v;
    }
    return def;
  };

  // Один раз задать дефолт, только если значения нет и sm.defaults поддерживается
  const setDefaultOnce = (key, value) => {
    try {
      if (getRaw(key) !== undefined) return;
      if (typeof sm.defaults === 'function') sm.defaults({ [key]: { value } });
    } catch {}
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Open-Blocker
  const OB_BASE =
    'https://raw.githubusercontent.com/Imperiadicks/SpotCol-Scripts/main/Assets/blocker-css';

  const OB_MODULES = [
    'donations','concerts','userprofile','trailers','betabutton',
    'vibeanimation','globaltabs','relevantnow','instyle','likesandhistory','neuromusic',
    'newreleases','personalartists','personalplaylists','recommendedplaylists','smartopenplaylist',
    'waves','charttracks','artistrecommends','barbelow','podcasts','chartalbums',
    'continuelisten','editorialartists','editorialnewreleases','mixedblock',
    'mixesgrid','newplaylists','nonmusiceditorialcompilation','openplaylist'
  ];

  const styleCache = new Map(); // url -> css
  const styleIds = (m) => `ob-css-${m}`;
  const obLoaded = new Set();

  const obKeys = (m) => [
    `OpenBlocker.${m}`, `OB.${m}`, `blocker.${m}`, m
  ];

  // ЛОГИКА ВКЛ/ВЫКЛ:
  // 1) Если есть явное значение модуля → используем его (true/false).
  // 2) Иначе, если глобальный OpenBlocker.enabled === true → включаем модуль.
  // 3) Иначе модуль выключен (по умолчанию OFF, чтобы «не залипало»).
  const isObModuleEnabled = (m) => {
    const per = read(obKeys(m), undefined);
    if (typeof per === 'boolean') return per;
    const global = read(['OpenBlocker.enabled', 'OB.enabled', 'blocker.enabled'], false);
    return !!global;
  };

  const fetchCSS = async (url) => {
    if (styleCache.has(url)) return styleCache.get(url);
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const css = await res.text();
    styleCache.set(url, css);
    return css;
  };

  const mountStyle = (id, css) => {
    let st = document.getElementById(id);
    if (!st) {
      st = document.createElement('style');
      st.id = id;
      document.head.appendChild(st);
    }
    st.textContent = css;
  };

  const unmountStyle = (id) => document.getElementById(id)?.remove();

  const applyOpenBlocker = async () => {
    // «Подкасты» дополнительно защищаем от скрытия (частая проблема)
    const wantPodcasts = isObModuleEnabled('podcasts');
    if (wantPodcasts) {
      mountStyle(
        'ob-protect-podcasts',
        `
        /* Protect podcasts visibility */
        [class*="Podcasts_root"],
        [data-block-id*="podcast"],
        [data-test-id*="podcast"],
        a[href*="/podcasts"] { display: initial !important; visibility: visible !important; }
      `);
    } else {
      unmountStyle('ob-protect-podcasts');
    }

    // По каждому модулю – грузим/снимаем CSS
    await Promise.all(
      OB_MODULES.map(async (m) => {
        const id = styleIds(m);
        if (isObModuleEnabled(m)) {
          try {
            const url = `${OB_BASE}/${encodeURIComponent(m)}.css`;
            const css = await fetchCSS(url);
            mountStyle(id, css);
            obLoaded.add(m);
          } catch (e) {
            console.warn('[Main][OB] failed', m, e);
          }
        } else {
          unmountStyle(id);
          obLoaded.delete(m);
        }
      })
    );
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Прозрачность
  // Ключи, из которых читаем флаг; дефолт НЕ навязываем (OFF), чтобы не залипало.
  const TRANSPARENCY_KEYS = [
    'Effects.transparency',
    'togglePlayerBackground',
    'Действия.togglePlayerBackground'
  ];
  setDefaultOnce('Effects.transparency', false);

  const isTransparencyOn = () => {
    const v = read(TRANSPARENCY_KEYS, undefined);
    return !!v; // по умолчанию false, если значения нет
  };

  const applyTransparency = () => {
    const ID = 'spotcol-transparency';
    if (!isTransparencyOn()) {
      unmountStyle(ID);
      return;
    }
    const CSS = `
/* === SpotCol: Transparency (safe) === */
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
}`;
    mountStyle(ID, CSS);
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Реакция на изменения handle (строго по подписке нужных ключей)
  const WATCH_KEYS = [
    'OpenBlocker.enabled',
    ...OB_MODULES.map((m) => `OpenBlocker.${m}`),
    ...OB_MODULES.map((m) => `OB.${m}`),
    ...OB_MODULES.map((m) => `blocker.${m}`),

    ...TRANSPARENCY_KEYS
  ];

  const signature = () =>
    WATCH_KEYS
      .map((k) => `${k}=${JSON.stringify(read(k, null))}`)
      .join('|');

  let lastSig = '';
  const applyAll = async () => {
    await applyOpenBlocker();
    applyTransparency();
  };

  const tick = async () => {
    try { await sm.update?.(); } catch {}
    const s = signature();
    if (s !== lastSig) {
      lastSig = s;
      await applyAll();
    }
  };

  // Быстрая первая инициализация
  (async () => {
    await applyAll();
    lastSig = signature();

    // Периодический вотчер (стабильный для Electron/десктопа)
    setInterval(tick, 1000);

    // Доп. реакции
    ['visibilitychange','focus','pageshow'].forEach((ev) =>
      window.addEventListener(ev, tick, { passive: true })
    );
  })();

  // Хелпер для ручного вызова из консоли
  window.SpotColSync = async () => {
    await tick();
    console.log('[Main] sync done');
  };
})();
