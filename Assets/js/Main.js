// === Main.js — v2.4.0 (FULL) ===
// Возвращаю все «важные» функции + синхронизацию с handle.
// Включено: Open-Blocker, Прозрачность, backgroundReplace (плавная подмена фона),
// FullVibe, AvatarZoom, интеграция с Colorize 2, трек-вотчеры, страничные вотчеры.

(() => {
  console.log('[Main] v2.4.0 start');

  // ────────────────────────────────────────────────────────────────────────────
  // settingsManager (ищем во всех привычных местах; НИЧЕГО не создаём заново)
  const sm =
    window?.Theme?.settingsManager ||
    window?.SpotColЛичная?.settingsManager ||
    window?.settingsManager ||
    window?.SettingsManager ||
    null;

  if (!sm) {
    console.error('[Main] settingsManager not found — работаю в деградированном режиме');
  }

  // Универсальное чтение значения из handle (поддерживает { value })
  const getRaw = (key) => {
    try {
      if (sm?.get) {
        const v = sm.get(key);
        return v && typeof v === 'object' && 'value' in v ? v.value : v;
      }
      const parts = key.split('.');
      let cur = sm?.settings || {};
      for (const p of parts) cur = cur?.[p];
      return cur && typeof cur === 'object' && 'value' in cur ? cur.value : cur;
    } catch {
      return undefined;
    }
  };

  const read = (keys, def = undefined) => {
    const list = Array.isArray(keys) ? keys : [keys];
    for (const k of list) {
      const v = getRaw(k);
      if (v !== undefined) return v;
    }
    return def;
  };

  const setDefaultOnce = (key, value) => {
    try {
      if (getRaw(key) !== undefined) return;
      if (typeof sm?.defaults === 'function') sm.defaults({ [key]: { value } });
    } catch {}
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Open-Blocker (CSS из GitHub raw → <style>)
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

  const styleCache = new Map(); // url → css
  const styleId = (m) => `ob-css-${m}`;
  const obKeys = (m) => [`OpenBlocker.${m}`, `OB.${m}`, `blocker.${m}`, m];

  // Включение модуля: явное значение → оно и рулит; иначе ориентируемся на глобальный флаг
  const isOBEnabled = (m) => {
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

  async function applyOpenBlocker() {
    // Подкасты дополнительно страхуем от скрытия
    if (isOBEnabled('podcasts')) {
      mountStyle(
        'ob-protect-podcasts',
        `
        /* Ensure Podcasts stay visible */
        [class*="Podcasts_root"],
        [data-block-id*="podcast"],
        [data-test-id*="podcast"],
        a[href*="/podcasts"] { display: initial !important; visibility: visible !important; }
      `
      );
    } else {
      unmountStyle('ob-protect-podcasts');
    }

    await Promise.all(
      OB_MODULES.map(async (m) => {
        const id = styleId(m);
        if (isOBEnabled(m)) {
          try {
            const url = `${OB_BASE}/${encodeURIComponent(m)}.css`;
            const css = await fetchCSS(url);
            mountStyle(id, css);
          } catch (e) {
            console.warn('[Main][OB] failed', m, e);
          }
        } else {
          unmountStyle(id);
        }
      })
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Прозрачность (OFF по умолчанию, без «залипания»)
  const TRANSPARENCY_KEYS = [
    'Effects.transparency',
    'togglePlayerBackground',
    'Действия.togglePlayerBackground'
  ];
  setDefaultOnce('Effects.transparency', false);

  const isTransparencyOn = () => !!read(TRANSPARENCY_KEYS, false);

  function applyTransparency() {
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
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ЭФФЕКТЫ (возвращены ВСЕ «важные» функции)
  const Library = window.Library || {};
  const getCover = () =>
    Library.getHiResCover?.() ||
    Library.coverURL?.() ||
    '';

  // Не создаём дубликат lastBackgroundURL, если он уже есть у пользователя
  const bgState = {
    get last() {
      return typeof window.lastBackgroundURL !== 'undefined'
        ? window.lastBackgroundURL
        : window.__spotcol_lastBG || null;
    },
    set last(v) {
      if (typeof window.lastBackgroundURL !== 'undefined') {
        window.lastBackgroundURL = v;
      } else {
        window.__spotcol_lastBG = v;
      }
    }
  };

  function ensureVibeTarget() {
    return (
      document.querySelector('[class*="MainPage_vibe"]') ||
      document.querySelector('[class*="VibeBlock_vibe"]') ||
      document.querySelector('[data-test-id="MAIN_PAGE"]') ||
      document.body
    );
  }

  // applyGradientFade — вспомогательный мягкий затемняющий градиент (как ты просил ранее)
  function applyGradientFade(target) {
    if (!target) return;
    let layer = target.querySelector('.bg-gradient');
    if (!layer) return; // создаётся внутри backgroundReplace; тут лишь «мягкая» анимация
    layer.style.transition = 'opacity 0.8s ease';
    layer.style.opacity = '1';
    setTimeout(() => (layer.style.opacity = '0.85'), 1500);
  }

  // === backgroundReplace(imageURL) — реальная версия из твоего проекта ===
  function backgroundReplace(imageURL) {
    const target = ensureVibeTarget();
    if (!target || !imageURL || imageURL === bgState.last) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageURL;

    img.onload = () => {
      bgState.last = imageURL;

      const wrapper = document.createElement('div');
      wrapper.className = 'bg-layer';
      wrapper.style.cssText = `
        position: absolute; inset: 0; z-index: 0;
        pointer-events: none; overflow: hidden; opacity: 0;
        transition: opacity 1s ease;
      `;

      const imageLayer = document.createElement('div');
      imageLayer.className = 'bg-cover';
      imageLayer.style.cssText = `
        position: absolute; inset: 0;
        background-image: url("${imageURL}");
        background-size: cover; background-position: center; background-repeat: no-repeat;
        opacity: 1; pointer-events: none;
      `;

      const gradient = document.createElement('div');
      gradient.className = 'bg-gradient';
      gradient.style.cssText = `
        position: absolute; inset: 0;
        background: var(--grad-main);
        mix-blend-mode: multiply;
        opacity: 0.9; pointer-events: none;
      `;

      wrapper.dataset.src = imageURL;
      wrapper.appendChild(imageLayer);
      wrapper.appendChild(gradient);

      target.style.position ||= 'relative';
      const prev = target.querySelector('.bg-layer');
      target.insertAdjacentElement('afterbegin', wrapper);
      requestAnimationFrame(() => (wrapper.style.opacity = '1'));
      if (prev) {
        prev.style.opacity = '0';
        setTimeout(() => prev.remove(), 1000);
      }

      // доп. эффект «постепенного ослабления» градиента
      applyGradientFade(target);
    };
  }

  function removeBackgroundImage() {
    const target = ensureVibeTarget();
    const cur = target?.querySelector('.bg-layer');
    if (cur) {
      cur.style.opacity = '0';
      setTimeout(() => cur.remove(), 400);
    }
    bgState.last = null;
  }

  function FullVibe() {
    const v = ensureVibeTarget();
    if (v) v.style.setProperty('height', '88.35vh', 'important');
  }
  function RemoveFullVibe() {
    const v = ensureVibeTarget();
    if (v) v.style.removeProperty('height');
  }

  function setupAvatarZoomEffect() {
    const img = document.querySelector('[data-test-id="PLAYERBAR_DESKTOP_COVER_CONTAINER"] img');
    if (!img || img.dataset.zoomReady) return;
    Object.assign(img.style, {
      transition: 'transform .25s ease, filter .25s ease',
      willChange: 'transform'
    });
    const onMove = (e) => {
      const r = img.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      img.style.transform = `scale(1.05) translate(${dx * 6}px, ${dy * 6}px)`;
      img.style.filter = 'drop-shadow(0 10px 25px rgba(0,0,0,.45))';
    };
    const onLeave = () => {
      img.style.transform = 'scale(1)';
      img.style.filter = 'drop-shadow(0 6px 18px rgba(0,0,0,.35))';
    };
    img.addEventListener('mousemove', onMove);
    img.addEventListener('mouseleave', onLeave);
    img.dataset.zoomReady = '1';
  }
  function removeAvatarZoomEffect() {
    const img = document.querySelector('[data-test-id="PLAYERBAR_DESKTOP_COVER_CONTAINER"] img');
    if (!img?.dataset.zoomReady) return;
    img.replaceWith(img.cloneNode(true));
  }

  // «Обновить всё» — совместимая публичная функция (многие модули на неё опираются)
  function updateAll() {
    applyOpenBlocker();
    applyTransparency();
    const url = getCover();
    if (url) backgroundReplace(url);
    if (read(['Эффекты.enableFullVibe', 'FullVibe'], false)) FullVibe();
    else RemoveFullVibe();
    if (read(['Эффекты.enableAvatarZoom', 'enableAvatarZoom'], true)) setupAvatarZoomEffect();
    else removeAvatarZoomEffect();
    try { window.Library?.colorize2?.recolor?.(true); } catch {}
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Вотчеры: трек, страницы, DOM
  function hookTrackEvents() {
    // Library internal watcher
    try {
      Library.trackWatcher?.((track) => {
        const url = Library.coverFromTrack?.(track) || track?.cover || getCover();
        if (url) backgroundReplace(url);
        try { window.Library?.colorize2?.recolor?.(true); } catch {}
      });
    } catch {}

    // Возможный player API
    try {
      const p = window.Theme?.player || window.player;
      p?.on?.('trackChange', ({ state }) => {
        const t = state?.track;
        const url = Library.coverFromTrack?.(t) || t?.cover || getCover();
        if (url) backgroundReplace(url);
        try { window.Library?.colorize2?.recolor?.(true); } catch {}
      });
      p?.on?.('openPlayer', ({ state }) => {
        const t = state?.track;
        const url = Library.coverFromTrack?.(t) || t?.cover || getCover();
        if (url) backgroundReplace(url);
        try { window.Library?.colorize2?.recolor?.(true); } catch {}
      });
      p?.on?.('pageChange', () => updateAll());
    } catch {}
  }

  function hookDom() {
    const layout =
      document.querySelector('[class*="CommonLayout_root"]') ||
      document.body;
    const mo = new MutationObserver(() => updateAll());
    mo.observe(layout, { childList: true, subtree: true });
    setInterval(() => {
      // страхуем фон, если DOM перерисовали
      const tgt = ensureVibeTarget();
      const have = tgt?.querySelector('.bg-layer')?.dataset?.src;
      const want = getCover();
      if (want && have !== want) backgroundReplace(want);
    }, 1200);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Watcher по handle (только нужные ключи — чтоб не «залипало»)
  const WATCH_KEYS = [
    'OpenBlocker.enabled',
    ...OB_MODULES.map((m) => `OpenBlocker.${m}`),
    ...OB_MODULES.map((m) => `OB.${m}`),
    ...OB_MODULES.map((m) => `blocker.${m}`),
    ...TRANSPARENCY_KEYS,
    'Эффекты.enableBackgroundImage',
    'Эффекты.enableFullVibe',
    'Эффекты.enableAvatarZoom',
    'FullVibe',
    'enableAvatarZoom'
  ];

  const signature = () =>
    WATCH_KEYS.map((k) => `${k}=${JSON.stringify(read(k, null))}`).join('|');

  let lastSig = '';
  async function tick() {
    try { await sm?.update?.(); } catch {}
    const s = signature();
    if (s !== lastSig) {
      lastSig = s;
      updateAll();
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Инициализация
  (async () => {
    hookTrackEvents();
    hookDom();
    updateAll();
    lastSig = signature();

    setInterval(tick, 1000);
    ['visibilitychange', 'focus', 'pageshow'].forEach((ev) =>
      window.addEventListener(ev, tick, { passive: true })
    );
  })();

  // ────────────────────────────────────────────────────────────────────────────
  // Экспорт совместимых API, которые «ждали» другие модули
  window.backgroundReplace = backgroundReplace;               // исторический алиас
  window.FullVibe = FullVibe;
  window.FullVibeClean = RemoveFullVibe;                      // на случай старого имени
  window.RemoveFullVibe = RemoveFullVibe;
  window.setupAvatarZoomEffect = setupAvatarZoomEffect;
  window.removeAvatarZoomEffect = removeAvatarZoomEffect;
  window.SpotCol_updateAll = updateAll;                       // явная точка входа
})();
