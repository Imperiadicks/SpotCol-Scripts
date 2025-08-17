(() => {
  'use strict';

  const Library   = (window.Library = window.Library || {});
  const Colorize2 = (Library.colorize2 = Library.colorize2 || {});
  const Util      = (Library.util     = Library.util     || {});
  Library.versions = Library.versions || {};
  Library.versions['Library.colorize2'] = 'v3.0.1';
  console.log('[colorize 2] load v3.0.1');

  /* ───────────────────────── helpers: color math ───────────────────────── */
  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0, s = 0, l = (max + min) / 2;
    if (d !== 0) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h = h / 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  function parseHEX(hex) {
    if (!hex) return { h: 220, s: 80, l: 56 };
    hex = hex.replace('#', '').trim();
    const n = parseInt(hex, 16);
    let r, g, b;
    if (hex.length === 3) {
      r = ((n >> 8) & 0xf) * 17;
      g = ((n >> 4) & 0xf) * 17;
      b = (n & 0xf) * 17;
    } else {
      r = (n >> 16) & 255;
      g = (n >> 8) & 255;
      b =  n        & 255;
    }
    return rgb2hsl(r, g, b);
  }

  const clamp   = (x, a, b) => Math.max(a, Math.min(b, x));
  const clampL  = (o) => ({ ...o, l: clamp(o.l, 20, 85) });
  const addS    = (k, d) => ({ ...k, s: clamp(Math.round(k.s + d), 0, 100) });
  const addL    = (k, d) => ({ ...k, l: clamp(Math.round(k.l + d), 0, 100) });
  const toHSL   = ({h,s,l}) => `hsl(${h} ${s}% ${l}%)`;

  // Лёгкая «подкраска» серых/ч/б обложек и мягкая коррекция яркости
  function nudgeAccent(hsl) {
    let { h, s, l } = hsl;
    if (s < 12) {
      s = 16;                 // делаем минимальную насыщенность
      l = l >= 55 ? l - 4 : l + 4; // «пара процентов»: затемнить светлое / подсветлить тёмное
    } else {
      if (l > 92) l = 88;
      if (l < 8)  l = 12;
    }
    return { h: Math.round(h), s: Math.round(s), l: Math.round(l) };
  }

  /* ───────────────────────── cover helpers ───────────────────────── */
  const _paletteCache = new Map();
  const _imgCache     = new Map();
  const _canvas = document.createElement('canvas');
  _canvas.width = _canvas.height = 64;
  const _ctx = _canvas.getContext('2d', { willReadFrequently: true });

  function currentCoverURL() {
    const t = Library.getCurrentTrack?.();
    return (Library.util?.coverURLFromTrack?.(t, '1000x1000') || Library.coverURL?.() || '') || '';
  }
  function getHiResCover() {
    return Library.getHiResCover?.() || currentCoverURL();
  }

  function loadImg(src) {
    if (!src) return Promise.resolve(null);
    if (_imgCache.has(src)) return _imgCache.get(src);
    const p = new Promise((res) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = src;
    }).finally(() => { _imgCache.delete(src); });
    _imgCache.set(src, p);
    return p;
  }

  // Акцент с устойчивым выбором: бины по hue + фильтры по S/L + нудж
  async function colorsFromCover(src) {
    if (!src) return null;
    if (_paletteCache.has(src)) return _paletteCache.get(src);

    const img = await loadImg(src);
    if (!img) {
      const fallback = { h: 220, s: 80, l: 56 };
      _paletteCache.set(src, fallback);
      return fallback;
    }

    const { width: w, height: h } = img;
    const scale = 64 / Math.max(w, h);
    _ctx.clearRect(0, 0, 64, 64);
    _ctx.drawImage(img, 0, 0, Math.round(w * scale), Math.round(h * scale));
    const d = _ctx.getImageData(0, 0, 64, 64).data;

    const bins = new Map(); // hue(int) -> {count, s, l}
    let strongCount = 0;

    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const i = (y * 64 + x) * 4;
        const A = d[i + 3]; if (A < 18) continue;

        const R = d[i], G = d[i + 1], B = d[i + 2];
        const { h, s, l } = rgb2hsl(R, G, B);

        // Жёсткие отсечки: слишком тёмные/светлые игнорим
        if (l < 8 || l > 92) continue;

        // Основная масса — с нормальной насыщенностью и средней яркостью
        if (s >= 20 && l >= 16 && l <= 84) {
          strongCount++;
          const key = Math.round(h);
          const obj = bins.get(key) || { count: 0, s: 0, l: 0 };
          obj.count++; obj.s += s; obj.l += l;
          bins.set(key, obj);
        }
      }
    }

    let base = { h: 220, s: 80, l: 56 };

    if (strongCount >= 96 && bins.size > 0) {
      // Выбираем «модальный» оттенок с учётом насыщенности и близости к среднему l
      let bestHue = 220, bestScore = -1, bestS = 80, bestL = 56;
      for (const [hue, stats] of bins) {
        const c = stats.count;
        const avgS = stats.s / c;
        const avgL = stats.l / c;
        const score = c + avgS * 0.7 - Math.abs(avgL - 50) * 0.35;
        if (score > bestScore) { bestScore = score; bestHue = hue; bestS = avgS; bestL = avgL; }
      }
      base = { h: bestHue, s: clamp(Math.round(bestS), 20, 92), l: clamp(Math.round(bestL), 18, 82) };
    } else {
      // Мало сильных пикселей → средняя оценка по всем приемлемым + нудж
      let S = 0, L = 0, N = 0;
      for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 64; x++) {
          const i = (y * 64 + x) * 4;
          const A = d[i + 3]; if (A < 18) continue;
          const R = d[i], G = d[i + 1], B = d[i + 2];
          const { s, l } = rgb2hsl(R, G, B);
          if (l < 8 || l > 92) continue;
          S += s; L += l; N++;
        }
      }
      const avgS = N ? S / N : 40;
      const avgL = N ? L / N : 56;
      base = { h: 220, s: clamp(Math.round(avgS), 12, 92), l: clamp(Math.round(avgL), 18, 82) };
    }

    // Нудж для ч/б, чёрного и белого
    base = nudgeAccent(base);
    _paletteCache.set(src, base);
    return base;
  }

  /* ───────────────────────── vars builder (только «краска») ───────────── */
  function buildVars(baseHSL) {
    const o = clampL(baseHSL);

    const light1 = addL(o, 22), light2 = addL(o, 16), light3 = addL(o, 10), light4 = addL(o, 6);
    const dark1  = addL(o, -10), dark2  = addL(o, -16), dark3  = addL(o, -22), dark4 = addL(o, -28);
    const dark5  = addL(o, -34), dark6  = addL(o, -40), dark7  = addL(o, -46);

    const grad1  = addS(addL(o, -8),  8);
    const grad2  = addS(addL(o, -24), 8);

    // Акцент с коррекцией (серые/ч/б) — делаем читаемым и живым
    const accent = nudgeAccent(addS(addL(o, 6), 10));

    return {
      '--color-light-1': toHSL(light1),
      '--color-light-2': toHSL(light2),
      '--color-light-3': toHSL(light3),
      '--color-light-4': toHSL(light4),

      '--color-dark-1':  toHSL(dark1),
      '--color-dark-2':  toHSL(dark2),
      '--color-dark-3':  toHSL(dark3),
      '--color-dark-4':  toHSL(dark4),
      '--color-dark-5':  toHSL(dark5),
      '--color-dark-6':  toHSL(dark6),
      '--color-dark-7':  toHSL(dark7),

      '--color-accent':  toHSL(accent),

      // ЛИНЕЙНЫЙ ГРАДИЕНТ ОСТАВЛЯЕМ (круговой не используем)
      '--grad-main': `linear-gradient(180deg, ${toHSL(grad1)} 0%, ${toHSL(grad2)} 76%)`,
    };
  }

  /* ───────────────────────── YM variable map (совместимость) ──────────── */
  const YM_MAP_RAW = `
--ym-button-primary-normal: var(--color-light-2);
--ym-button-primary-hovered: var(--color-light-1);
--ym-button-primary-pressed: var(--color-dark-1);
--ym-button-primary-disabled: var(--color-dark-4);

--ym-letterleds-main-text: var(--color-light-1);

--ym-shimmers-primary: var(--color-light-1);
--ym-shimmers-secondary: var(--color-light-2);

--ym-favorite: var(--color-light-1);
--ym-dislike: var(--color-dark-3);

--ym-toast-border: var(--color-light-3);
--ym-toast-notify: var(--color-accent);
--ym-toast-warning: var(--color-dark-5);

--ym-divider-main: var(--color-dark-4);
--ym-divider-active: var(--color-light-2);

--ym-waves-brand: var(--color-accent);

--ym-background-color-primary-enabled-basic: var(--color-dark-7);
--ym-background-color-primary-enabled-content: var(--color-dark-6);
--ym-background-color-primary-enabled-blur: var(--color-dark-5);
--ym-background-color-primary-enabled-contrast: var(--color-dark-4);

--ym-background-color-secondary-enabled-basic: var(--color-dark-6);
--ym-background-color-secondary-enabled-content: var(--color-dark-5);
--ym-background-color-secondary-enabled-blur: var(--color-dark-4);
--ym-background-color-secondary-enabled-contrast: var(--color-dark-3);

--ym-background-alpha-color-enabled: rgba(0,0,0,.4);

--ym-foreground-color-enabled-basic: var(--color-light-4);
--ym-foreground-color-enabled-basic-hover: var(--color-light-3);
--ym-foreground-color-enabled-basic-press: var(--color-light-2);
--ym-foreground-color-enabled-additional-contrast: var(--color-light-1);

--ym-semitransparent-color-1: rgba(0,0,0,.35);
--ym-semitransparent-color-2: rgba(0,0,0,.5);

--ym-brand-accent: var(--color-accent);
`;
const EXTRA_CSS = `
/* прибираем штатный вайб, чтобы наш градиент был виден */
.VibeBlock_canvas__EtGGS { opacity:.22 !important; filter: blur(360px) !important; }
.VibeBlock_gradient__32n9m { opacity: 0 !important; }
.VibeBlock_wrap__KsKTk:has(.VibeBlock_vibeAnimation__XVEE6) canvas { opacity:.2 !important; filter: blur(360px) !important; }
.VibeBlock_vibeAnimation__XVEE6:after { background:transparent !important; }

/* страховка: если класс меняется — наш контейнер всё равно получает градиент */
.bg-layer .bg-gradient { background: var(--grad-main) !important; mix-blend-mode: multiply; }

/* общий фон страницы подчищаем, чтобы не забивал цвет */
.DefaultLayout_root__*, .CommonLayout_root__* { background: transparent !important; }
`;

  /* ───────────────────────── style tags + apply ───────────────────────── */
let _styleVars = null, _styleExtra = null, _styleOverlay = null;
function ensureStyleTags() {
  if (!_styleVars)   { _styleVars   = document.createElement('style'); _styleVars.id   = 'sc-vars';         document.head.appendChild(_styleVars); }
  if (!_styleExtra)  { _styleExtra  = document.createElement('style'); _styleExtra.id  = 'sc-extra';        document.head.appendChild(_styleExtra); _styleExtra.textContent = EXTRA_CSS; }
  if (!_styleOverlay){ _styleOverlay= document.createElement('style'); _styleOverlay.id= 'sc-grad-overlay'; document.head.appendChild(_styleOverlay); }
}


  function applyVars(vars) {
    ensureStyleTags();
    _styleVars.textContent = `
      :root {
        ${Object.entries(vars).map(([k,v]) => `${k}:${v};`).join('\n')}
        ${YM_MAP_RAW}
      }
      /* очищаем фон от нативных заливок; круговой градиент не используем */
      .DefaultLayout_root__*, .CommonLayout_root__* { background: transparent !important; }
    `;
  }

  function ensureGradientOverlay() {
    ensureStyleTags();
    _styleOverlay.textContent = `
      body.sc-has-grad::before {
        content: '';
        position: fixed; inset: 0;
        background: var(--grad-main);
        z-index: -1; pointer-events: none;
      }`;
    document.body.classList.add('sc-has-grad');
  }

  /* ───────────────────────── settings bridge (HEX / cover) ────────────── */
  function _settings() {
    const sm = window.Theme?.settingsManager;
    const get = (k, d) => sm?.get(k)?.value ?? d;
    return {
      useHex: get('Тема.useCustomColor', get('useCustomColor', false)),
      hex:    get('Тема.baseColor',      get('baseColor',      '')),
    };
  }

  /* ───────────────────────── core recolor (без фоновых вставок!) ──────── */
  let _lastKey = '';
  async function recolor(force = false) {
    const { useHex, hex } = _settings();

    let base, key = '';
    if (useHex && hex) {
      base = clampL(parseHEX(hex));
      key  = 'hex:' + hex;
    } else {
      const src = currentCoverURL();
      if (!src) return;
      base = await colorsFromCover(src);
      key  = 'img:' + src;
    }

    if (!force && key === _lastKey) return;
    _lastKey = key;

    const vars = buildVars(base);
    applyVars(vars);
    ensureGradientOverlay(); // линейный оверлей оставляем
  }

  /* ───────────────────────── lifecycle / watchers ─────────────────────── */
  const _debouncedRecolor = typeof Util.debounce === 'function'
    ? Util.debounce(recolor, 120)
    : recolor;

  let _domObs = null, _trackUnsub = null, _settingsUnsub = null, _urlTimer = null;
  let _lastURL = location.href;

  function startWatchers() {
    if (!_domObs) {
      const root = document.querySelector('[class*="CommonLayout_root"]') || document.body;
      _domObs = new MutationObserver(() => _debouncedRecolor());
      _domObs.observe(root, { childList: true, subtree: true });
    }
    if (!_trackUnsub && Library.onTrack) {
      _trackUnsub = Library.onTrack?.(() => _debouncedRecolor(), { immediate: false });
    }
    if (!_settingsUnsub && window.Theme?.settingsManager?.on) {
      const sm = window.Theme.settingsManager;
      const onUpd = () => recolor(true);
      sm.on('update', onUpd);
      _settingsUnsub = () => sm.off?.('update', onUpd);
    }
    if (!_urlTimer) {
      _urlTimer = setInterval(() => {
        if (location.href !== _lastURL) {
          _lastURL = location.href;
          recolor(true);
        }
      }, 500);
    }
  }

  function stopWatchers() {
    _domObs?.disconnect(); _domObs = null;
    _trackUnsub?.();       _trackUnsub = null;
    _settingsUnsub?.();    _settingsUnsub = null;
    clearInterval(_urlTimer); _urlTimer = null;
  }

  /* ───────────────────────── public API ───────────────────────────────── */
  Colorize2.recolor       = recolor;
  Colorize2.start         = () => { startWatchers(); recolor(true); };
  Colorize2.stop          = () => { stopWatchers(); };
  Colorize2.applyVars     = applyVars;
  Colorize2.buildVars     = buildVars;
  Colorize2.colorsFromCover = colorsFromCover;
  Colorize2.clearCaches   = () => { _paletteCache.clear(); _imgCache.clear(); };
  Colorize2.ensureGradientOverlay = ensureGradientOverlay;

  // автостарт
  try { Colorize2.start(); } catch(e) { console.warn('[colorize 2] start failed', e); }
})();