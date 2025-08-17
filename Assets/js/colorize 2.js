(() => {
  const Library = (window.Library = window.Library || {});
  const Colorize2 = (Library.colorize2 = Library.colorize2 || {});
  const Util = (Library.util = Library.util || {});
  Library.versions = Library.versions || {};
  Library.versions['Library.colorize2'] = 'v2.0.3';
  console.log('[colorize 2] load v2.0.1');

  const LOG = (...a) => console.log('[Library.colorize2]', ...a);

  /* ───────────────────────── helpers: color math ───────────────────────── */
  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0, s = 0, l = (max + min) / 2;
    if (d !== 0) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
        case g: h = ((b - r) / d + 2); break;
        case b: h = ((r - g) / d + 4); break;
      }
      h = h / 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  function parseHEX(hex) {
    if (!hex) return { h: 220, s: 90, l: 56 };
    hex = hex.replace('#', '').trim();
    const bigint = parseInt(hex, 16);
    let r, g, b;
    if (hex.length === 3) {
      r = ((bigint >> 8) & 0xf) * 17;
      g = ((bigint >> 4) & 0xf) * 17;
      b = (bigint & 0xf) * 17;
    } else {
      r = (bigint >> 16) & 255;
      g = (bigint >> 8) & 255;
      b = bigint & 255;
    }
    return rgb2hsl(r, g, b);
  }

  // bridge to SettingsManager (from window.Theme)
  function _defaultSettingsAdapter() {
    const get = (key, def) => window.Theme?.settingsManager?.get(key)?.value ?? def;
    return {
      getBool(keys, def=false){ for (const k of keys) { const v = get(k); if (typeof v==='boolean') return v; } return def; },
      getText(keys, def=''){ for (const k of keys) { const v = get(k); if (typeof v==='string') return v; } return def; }
    };
  }
  const { getBool, getText } = _defaultSettingsAdapter();

  /* ───────────────────────── cover helpers ───────────────────────── */
  const _paletteCache = new Map();
  const _coverCanvas = document.createElement('canvas');
  _coverCanvas.width = _coverCanvas.height = 64;
  const _ctx = _coverCanvas.getContext('2d', { willReadFrequently:true });

  function currentCoverURL() {
    const t = Library.getCurrentTrack?.();
    return (Library.util?.coverURLFromTrack?.(t, '1000x1000') || Library.coverURL?.() || '') || '';
  }
  function getHiResCover() {
    return Library.getHiResCover?.() || currentCoverURL();
  }

  function colorsFromCover(src) {
    if (!src) return Promise.resolve(null);
    if (_paletteCache.has(src)) return Promise.resolve(_paletteCache.get(src));

    return new Promise((res) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const w = img.width, h = img.height;
          const scale = 64 / Math.max(w, h);
          _ctx.clearRect(0, 0, 64, 64);
          _ctx.drawImage(img, 0, 0, w * scale, h * scale);
          const d = _ctx.getImageData(0, 0, 64, 64).data;

          const hueBins = new Map(); // hue -> {count, s, l}
          for (let y = 0; y < 64; y++) {
            for (let x = 0; x < 64; x++) {
              const i = (y * 64 + x) * 4;
              const a = d[i + 3];
              if (a < 18) continue;
              const r = d[i], g = d[i + 1], b = d[i + 2];
              const { h, s, l } = rgb2hsl(r, g, b);
              if (l < 10 || l > 90) continue;
              const key = Math.round(h);
              const entry = hueBins.get(key) || { count: 0, s: 0, l: 0 };
              entry.count++;
              entry.s += s; entry.l += l;
              hueBins.set(key, entry);
            }
          }

          let bestHue = 220, bestScore = -1, bestS = 80, bestL = 56;
          for (const [h, stats] of hueBins) {
            const count = stats.count;
            const avgS = stats.s / count;
            const avgL = stats.l / count;
            const score = count + avgS * 0.6 - Math.abs(avgL - 50) * 0.3;
            if (score > bestScore) {
              bestScore = score; bestHue = h; bestS = avgS; bestL = avgL;
            }
          }

          const base = { h: bestHue, s: Math.max(35, Math.min(92, Math.round(bestS))), l: Math.max(18, Math.min(82, Math.round(bestL))) };
          _paletteCache.set(src, base);
          res(base);
        } catch(e) { console.warn('[colorize2] palette error', e); res({ h: 220, s: 80, l: 55 }); }
      };
      img.onerror = () => res({ h: 220, s: 80, l: 55 });
      img.src = src;
    });
  }

  /* ───────────────────────── vars builder ───────────────────────── */
  const clampL = (o) => ({ ...o, l: Math.max(20, Math.min(85, o.l)) });

  function nudgeAccent(hsl) {
  let { h, s, l } = hsl;
  h = Math.round(h);
  s = Math.round(s);
  l = Math.round(l);

  // Если почти серый/чёрно-белый — слегка подкрашиваем и нуджим яркость
  if (s < 12) {
    s = 16; // лёгкая насыщенность, чтобы не было "грязной" серости
    l = l >= 55 ? l - 4 : l + 4; // «пару процентов»: затемнить светлое / подсветлить тёмное
  } else {
    // Для слишком ярких/тёмных — мягкий предел
    if (l > 92) l = 88;
    if (l < 8)  l = 12;
  }
  return { h, s, l };
}

  function buildVars(baseHSL) {
  const clampL = (o) => ({ ...o, l: Math.max(20, Math.min(85, o.l)) });
  const o = clampL(baseHSL);

  const toHSL = ({h,s,l}) => `hsl(${h} ${s}% ${l}%)`;
  const addS = (k, d) => ({...k, s: Math.max(0, Math.min(100, Math.round(k.s+d)))});
  const addL = (k, d) => ({...k, l: Math.max(0, Math.min(100, Math.round(k.l+d)))});

  const light1 = addL(o, 22), light2 = addL(o, 16), light3 = addL(o, 10), light4 = addL(o, 6);
  const dark1  = addL(o, -10), dark2  = addL(o, -16), dark3  = addL(o, -22), dark4 = addL(o, -28);
  const dark5  = addL(o, -34), dark6  = addL(o, -40), dark7  = addL(o, -46);

  const grad1  = addS(addL(o, -8),  8);
  const grad2  = addS(addL(o, -24), 8);

  // accent с корректировкой для ч/б кадров: лёгкая подсветка/затемнение
  const accentBase = addS(addL(o, 6), 10);
  const accent     = nudgeAccent(accentBase);

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

    '--grad-main': `linear-gradient(180deg, ${toHSL(grad1)} 0%, ${toHSL(grad2)} 76%)`,
  };
}

  /* ───────────────────────── YM variable map + extra CSS (integrated) ──── */
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
.VibeBlock_canvas__EtGGS { opacity:.22 !important; filter: blur(360px) !important; }
.VibeBlock_gradient__32n9m { opacity: 0 !important; }
.VibeBlock_wrap__KsKTk:has(.VibeBlock_vibeAnimation__XVEE6) canvas { opacity:.2 !important; filter: blur(360px) !important; }
.VibeBlock_vibeAnimation__XVEE6:after { background:transparent !important; }

.CommonLayout_root__WC_W1 {
  background: radial-gradient(circle at 70% 70%,
    var(--ym-background-color-secondary-enabled-blur) 0%,
    var(--ym-background-color-primary-enabled-content) 70%,
    var(--ym-background-color-primary-enabled-basic) 100%) !important;
}
.Navbar_root__chfAR,
.EntitySidebar_root__D1fGh,
.Divider_root__99zZ {
  background: radial-gradient(circle at 70% 70%,
    var(--ym-background-color-secondary-enabled-blur) 0%,
    var(--ym-background-color-primary-enabled-content) 70%,
    var(--ym-background-color-primary-enabled-basic) 100%) !important;
}

.CommonLayout_content__zy_Ja::before {
  content: '';
  position: fixed;
  pointer-events: none;
  inset: 0;
  background: var(--grad-main);
  opacity: .65;
  z-index: 0;
}
`;

  /* ───────────────────────── style tags + apply ───────────────────────── */
  let _styleVars = null, _styleExtra = null, _styleOverlay = null;
  function ensureStyleTags() {
    if (!_styleVars)  { _styleVars  = document.createElement('style'); _styleVars.id  = 'sc-vars';  document.head.appendChild(_styleVars); }
    if (!_styleExtra) { _styleExtra = document.createElement('style'); _styleExtra.id = 'sc-extra'; document.head.appendChild(_styleExtra); _styleExtra.textContent = EXTRA_CSS; }
    if (!_styleOverlay){ _styleOverlay = document.createElement('style'); _styleOverlay.id = 'sc-grad-overlay'; document.head.appendChild(_styleOverlay); }
  }

  function applyVars(vars) {
    ensureStyleTags();
    _styleVars.textContent = `
      :root {
        ${Object.entries(vars).map(([k,v])=>`${k}:${v};`).join('\n')}
        ${YM_MAP_RAW}
      }
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

  /* ───────────────────────── Recolor core ───────────────────────── */
  let _lastSrc = '', _lastHex = '';
  let _lastBgEnabled = null, _lastZoom = null, _lastFullVibe = null;

  async function recolor(force = false) {
    const useHex = getBool(['Тема.useCustomColor', 'useCustomColor'], false);
    const hex = getText(['Тема.baseColor', 'baseColor'], '');

    let base;

    if (useHex) {
      if (!force && hex === _lastHex) return;
      base = clampL(parseHEX(hex)); _lastHex = hex;
      LOG('palette: HEX mode', hex, base);
    } else {
      const src = currentCoverURL();
      if (!src) return;
      if (!force && src === _lastSrc) return;

      const p = await colorsFromCover(src);
      if (!p) return;
      base = p; _lastSrc = src;
      LOG('palette: COVER mode', src, base);
    }

    const vars = buildVars(base);
    applyVars(vars);
    ensureGradientOverlay();

    // фон Vibe + увеличение аватарки + высота Vibe по настройкам
    const bg = getBool(['Эффекты.enableBackgroundImage', 'enableBackgroundImage'], false);
    const zoom = getBool(['Эффекты.enableAvatarZoom', 'enableAvatarZoom'], false);
    const fullVibe = getBool(['Эффекты.enableFullVibe', 'enableFullVibe'], false);

    if (bg !== _lastBgEnabled || force) {
      _lastBgEnabled = bg;
      if (bg) window.Theme?.backgroundReplace?.(await getHiResCover());
      else     window.Theme?.removeBackgroundImage?.();
    }
    if (zoom !== _lastZoom || force) {
      _lastZoom = zoom;
      if (zoom) window.Theme?.setupAvatarZoomEffect?.();
      else      window.Theme?.removeAvatarZoomEffect?.();
    }
    if (fullVibe !== _lastFullVibe || force) {
      _lastFullVibe = fullVibe;
      if (fullVibe) window.Theme?.FullVibe?.();
      else          window.Theme?.RemoveFullVibe?.();
    }
  }

  /* ───────────────────────── lifecycle / watchers ───────────────────────── */
  const _debouncedRecolor = typeof Util.debounce === 'function' ? Util.debounce(recolor, 120) : recolor;

  let _domObs = null, _settingsUnsub = null, _trackUnsub = null, _pageTimer = null, _vibeGuard = null;
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
    if (!_pageTimer) {
      _pageTimer = setInterval(() => {
        if (location.href !== _lastURL) {
          _lastURL = location.href;
          LOG('page changed → recolor');
          recolor(true);
          // принудительная подстановка фона для Vibe после навигации
          if (getBool(['Эффекты.enableBackgroundImage', 'enableBackgroundImage'], false)) {
            window.Theme?.backgroundReplace?.(getHiResCover());
          }
        }
      }, 500);
    }
    if (!_vibeGuard) {
      let lastCover = '';
      _vibeGuard = setInterval(async () => {
        const vibe = document.querySelector('[class*="MainPage_vibe"]');
        if (!vibe) return;
        const src = currentCoverURL();
        const hasBg = vibe.querySelector('.bg-layer');
        if (!hasBg || src !== lastCover) {
          lastCover = src;
          if (getBool(['Эффекты.enableBackgroundImage', 'enableBackgroundImage'], false)) {
            window.Theme?.backgroundReplace?.(await getHiResCover());
          } else {
            window.Theme?.removeBackgroundImage?.();
          }
        }
      }, 1500);
    }
  }

  function stopWatchers() {
    _domObs?.disconnect(); _domObs = null;
    _trackUnsub?.(); _trackUnsub = null;
    _settingsUnsub?.(); _settingsUnsub = null;
    clearInterval(_pageTimer); _pageTimer = null;
    clearInterval(_vibeGuard); _vibeGuard = null;
  }

  /* ───────────────────────── public API ───────────────────────── */
  Colorize2.recolor = recolor;
  Colorize2.start = () => { startWatchers(); recolor(true); };
  Colorize2.stop  = () => { stopWatchers(); };
  Colorize2.applyVars = applyVars;
  Colorize2.buildVars = buildVars;
  Colorize2.colorsFromCover = colorsFromCover;
  Colorize2.clearCaches = () => _paletteCache.clear();
  Colorize2.setExtraCSS = (css) => { ensureStyleTags(); _styleExtra.textContent = css || ''; };

  // авто-инициализация
  try { Colorize2.start(); } catch (e) { console.warn('[colorize2] start failed', e); }
})();
