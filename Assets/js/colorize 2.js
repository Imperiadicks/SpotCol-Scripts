// === BEGIN: Library.colorize2 (inline rewrite of "colorize 2") ===
(() => {
  const Library = (window.Library = window.Library || {});
  const Colorize2 = (Library.colorize2 = Library.colorize2 || {});
  const Util = (Library.util = Library.util || {});
  Library.versions = Library.versions || {};
  Library.versions['Library.colorize2'] = 'v2.0.0';

  const LOG = (...a) => console.log('[Library.colorize2]', ...a);

  /* ───────────────────────── helpers: color math ───────────────────────── */
  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0, s = 0, l = (max + min) / 2;
    if (d) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2;               break;
        case b: h = (r - g) / d + 4;               break;
      }
      h /= 6;
    }
    return { h: Math.round(h * 360), s: +(s * 100).toFixed(1), l: +(l * 100).toFixed(1) };
  }
  const H  = (o)    => `hsl(${o.h},${o.s}%,${o.l}%)`;
  const HA = (o, a) => `hsla(${o.h},${o.s}%,${o.l}%,${a})`;
  function parseHEX(hex) {
    if (!hex) return { h: 0, s: 0, l: 50 };
    hex = String(hex).replace('#', '').trim();
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const n = parseInt(hex, 16);
    if (Number.isNaN(n)) return { h: 0, s: 0, l: 50 };
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return rgb2hsl(r, g, b);
  }
  const clampL = (o) => ({ ...o, l: Math.max(20, Math.min(85, o.l)) });

  /* ───────────────────────── settings adapter ───────────────────────── */
  // Ключи: "Тема.useCustomColor", "Тема.baseColor", "Эффекты.enableBackgroundImage",
  //        "Эффекты.enableAvatarZoom", "Эффекты.FullVibe"
  let _getSetting = (key, fallback) => fallback;

  Colorize2.setSettingsAdapter = (fn) => { if (typeof fn === 'function') _getSetting = fn; };

  function _defaultSettingsAdapter(key, fallback) {
    const sm = window.Theme?.settingsManager;
    if (!sm) return fallback;
    // пробуем разные варианты путей
    const candidates = [
      key,
      key.replace('Тема.', ''),
      key.replace('Эффекты.', ''),
      key.toLowerCase(),
      key.replace('Тема.', 'theme.'),
      key.replace('Эффекты.', 'effects.')
    ];
    for (const k of candidates) {
      const v = sm.get?.(k);
      const val = (v && typeof v === 'object' && 'value' in v) ? v.value : v;
      if (val !== undefined) return val;
    }
    return fallback;
  }
  if (_getSetting === ((k, f) => f)) Colorize2.setSettingsAdapter(_defaultSettingsAdapter);

  const getBool = (keys, def = false) => {
    for (const k of keys) {
      const v = _getSetting(k, undefined);
      if (v === undefined) continue;
      if (typeof v === 'boolean') return v;
      if (typeof v === 'string') return v === 'true';
      return !!v;
    }
    return def;
  };
  const getText = (keys, def = '') => {
    for (const k of keys) {
      const v = _getSetting(k, undefined);
      if (typeof v === 'string') return v.trim();
      if (v && typeof v === 'object' && 'text' in v) return String(v.text || '');
    }
    return def;
  };

  /* ───────────────────────── cover helpers ───────────────────────── */
  const _canvas = document.createElement('canvas'); _canvas.width = _canvas.height = 64;
  const _ctx = _canvas.getContext('2d', { willReadFrequently: true });
  const _paletteCache = new Map();

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
          let total = 0;

          for (let y = 0; y < 64; y++) {
            for (let x = 0; x < 64; x++) {
              const i = (y * 64 + x) * 4;
              const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
              if (a < 24) continue;
              const sum = r + g + b;
              if (sum < 30 || sum > 740) continue;
              const hsl = rgb2hsl(r, g, b);
              if (hsl.s < 20) continue; // серые
              const key = Math.round(hsl.h / 10) * 10; // корзины по 10°
              const bin = hueBins.get(key) || { count: 0, s: 0, l: 0 };
              bin.count++; bin.s += hsl.s; bin.l += hsl.l;
              hueBins.set(key, bin);
              total++;
            }
          }

          if (!total || !hueBins.size) {
            LOG('colorsFromCover: not enough pixels');
            res(null); return;
          }

          let best = null, maxCount = -1;
          for (const [hue, data] of hueBins.entries()) {
            if (data.count > maxCount) {
              maxCount = data.count;
              best = { h: hue, s: +(data.s / data.count).toFixed(1), l: +(data.l / data.count).toFixed(1) };
            }
          }
          const color = clampL(best);
          const pair = [color, color];
          _paletteCache.set(src, pair);
          res(pair);
        } catch (e) {
          console.warn('[colorize2] palette error:', e);
          res(null);
        }
      };
      img.onerror = () => res(null);
      img.src = src;
    });
  }

  /* ───────────────────────── CSS vars & gradient ───────────────────────── */
  function buildVars(base) {
    const vars = {};
    for (let i = 1; i <= 10; i++) {
      const lHi = base.l + (80 - base.l) * (i / 10);
      const lLo = base.l - (base.l) * (i / 10);
      vars[`--color-light-${i}`] = H({ ...base, l: Math.min(100, Math.max(0, lHi)) });
      vars[`--color-dark-${i}`]  = H({ ...base, l: Math.min(100, Math.max(0, lLo)) });
      for (let a = 1; a <= 10; a++) {
        vars[`--color-light-${i}-${a}`] = HA({ ...base, l: Math.min(100, Math.max(0, lHi)) }, a / 10);
        vars[`--color-dark-${i}-${a}`]  = HA({ ...base, l: Math.min(100, Math.max(0, lLo)) }, a / 10);
      }
    }
    vars['--grad-main'] =
      `linear-gradient(120deg,
        hsl(${base.h},${base.s}%,${Math.max(0, base.l - 25)}%) 0%,
        hsl(${base.h},${base.s}%,${Math.min(100, base.l + 25)}%) 100%)`;
    return vars;
  }

  const YM_MAP_RAW = `
    --ym-background-color-primary-enabled-basic: var(--color-dark-8);
    --ym-surface-color-primary-enabled-list: var(--color-light-1-4);
    --ym-background-color-primary-enabled-content: var(--color-dark-6);
    --ym-controls-color-primary-text-enabled_variant: var(--color-light-10-10);
    --ym-controls-color-primary-text-enabled: var(--color-light-10-5);
    --ym-controls-color-primary-text-hovered: var(--color-light-7);
    --ym-background-color-secondary-enabled-blur: var(--color-light-1);
    --ym-controls-color-secondary-outline-enabled_stroke: var(--color-light-10-10);
    --ym-controls-color-primary-text-disabled: var(--ym-controls-color-secondary-outline-enabled_stroke);
    --ym-controls-color-secondary-outline-hovered_stroke: var(--color-light-5);
    --ym-controls-color-secondary-on_outline-enabled: var(--color-light-10-8);
    --ym-logo-color-primary-variant: var(--color-light-10);
    --ym-controls-color-primary-outline-enabled: var(--color-dark-1-10);
    --ym-controls-color-secondary-outline-selected: var(--color-dark-3);
    --ym-controls-color-secondary-card-enabled: var(--color-dark-5-7);
    --ym-controls-color-secondary-card-hovered: var(--color-light-5-5);
    --ym-controls-color-primary-default-disabled: var(--color-light-4);
    --ym-controls-color-primary-default-enabled: var(--color-light-10);
    --ym-controls-color-primary-default-hovered: var(--color-light-8);
    --ym-controls-color-secondary-default-disabled: var(--color-dark-1);
    --ym-controls-color-secondary-default-enabled: var(--color-dark-5);
    --ym-controls-color-secondary-default-hovered: var(--color-dark-3);
    --ym-background-color-primary-enabled-popover: var(--color-dark-7-9);
    --ym-controls-color-secondary-text-enabled: var(--color-light-10-10);
    --ym-controls-color-secondary-on_default-hovered: var(--color-light-10-10);
    --ym-controls-color-secondary-on_default-enabled: var(--color-light-10-10);
    --id-default-color-dark-surface-elevated-0: var(--color-dark-6);
  `;
  const EXTRA_CSS = `
    /* Make main layout transparent to show gradient */
    .DefaultLayout_root__*, .CommonLayout_root__* { background: transparent !important; }
    .ChangeVolume_root__HDxtA { max-width: 160px; }
    .DefaultLayout_content__md70Z .MainPage_root__STXqc::-webkit-scrollbar { width:0; }
    .MainPage_landing___FGNm { padding-right: 24px; }
    .SyncLyrics_content__lbkWP:after, .SyncLyrics_content__lbkWP:before { display:none; }
    .FullscreenPlayerDesktopContent_syncLyrics__6dTfH { margin-block-end:0; height: calc(100vh); }
    .NavbarDesktop_logoLink__KR0Dk { margin-top:15px; }
    canvas { opacity:.2 !important; filter: blur(360px) !important; }
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

    .VibeContext_context__Z_82k,
    .VibeSettings_toggleSettingsButton__j6fIU,
    .VibeContext_pinButton__b6SNF {
      backdrop-filter: blur(25px);
      background-color: rgba(0, 0, 0, 0.15);
    }
    .Root { background: var(--ym-background-color-primary-enabled-content) !important; }
  `;

  let _styleVars, _styleExtra, _styleOverlay;
  function ensureStyleTags() {
    if (!_styleVars) {
      _styleVars = document.createElement('style');
      _styleVars.id = 'colorize2-vars';
      document.head.appendChild(_styleVars);
    }
    if (!_styleExtra) {
      _styleExtra = document.createElement('style');
      _styleExtra.id = 'colorize2-extra';
      document.head.appendChild(_styleExtra);
    }
  }
  function applyVars(vars) {
    ensureStyleTags();
    const varLines = Object.entries(vars).map(([k, v]) => `  ${k}: ${v} !important;`).join('\n');
    const ymLines = YM_MAP_RAW.split('\n').map(s => s.trim()).filter(s => s.startsWith('--')).map(s => '  ' + s).join('\n');
    _styleVars.textContent = `.ym-dark-theme {\n${varLines}\n${ymLines}\n}`;
    _styleExtra.textContent = EXTRA_CSS;
  }

  function ensureGradientOverlay() {
    if (_styleOverlay) return;
    _styleOverlay = document.createElement('style');
    _styleOverlay.id = 'sc-grad-overlay';
    _styleOverlay.textContent = `
      body.sc-has-grad::before {
        content: '';
        position: fixed; inset: 0;
        background: var(--grad-main);
        z-index: -1; pointer-events: none;
      }`;
    document.head.appendChild(_styleOverlay);
    document.body.classList.add('sc-has-grad');
  }

  /* ───────────────────────── Background image on Vibe ───────────────────────── */
  let _lastBgUrl = null;
  function backgroundReplace(imageURL) {
    const target = document.querySelector('[class*="MainPage_vibe"]');
    if (!target || !imageURL || imageURL === _lastBgUrl) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      _lastBgUrl = imageURL;

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
        backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
        opacity: '0', transition: 'opacity 1s ease', pointerEvents: 'none'
      });

      const gradient = document.createElement('div');
      gradient.className = 'bg-gradient';
      Object.assign(gradient.style, {
        position: 'absolute', inset: '0',
        background: `radial-gradient(circle at 70% 70%,
          var(--ym-background-color-secondary-enabled-blur, rgba(0,0,0,0)) 0%,
          var(--ym-background-color-primary-enabled-content, rgba(0,0,0,0.2)) 70%,
          var(--ym-background-color-primary-enabled-basic, rgba(0,0,0,0.3)) 100%)`,
        opacity: '0.6', pointerEvents: 'none', zIndex: 1
      });

      [...target.querySelectorAll('.bg-layer')].forEach(layer => {
        layer.style.opacity = '0';
        layer.style.transition = 'opacity 0.6s ease';
        setTimeout(() => layer.remove(), 700);
      });

      wrapper.appendChild(imageLayer);
      wrapper.appendChild(gradient);
      target.appendChild(wrapper);

      requestAnimationFrame(() => {
        imageLayer.getBoundingClientRect(); // force reflow
        imageLayer.style.opacity = '1';
      });
    };
    img.onerror = () => console.warn('[colorize2] background image load error:', imageURL);
    img.src = imageURL;
  }
  function removeBackgroundImage() {
    const layers = document.querySelectorAll('.bg-layer');
    layers.forEach(layer => {
      layer.style.opacity = '0';
      layer.style.transition = 'opacity 0.6s ease';
      setTimeout(() => layer.remove(), 700);
    });
    _lastBgUrl = null;
  }

  /* ───────────────────────── Avatar zoom ───────────────────────── */
  function onAvatarMove(e) {
    const r = this.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * 9;
    const y = ((e.clientY - r.top) / r.height - 0.5) * 9;
    const tx = Math.max(-45, Math.min(45, -x * 11));
    const ty = Math.max(-45, Math.min(45, -y * 11));
    this.style.transform = `scale(1.8) translate(${tx}px, ${ty}px)`;
  }
  function onAvatarLeave() { this.style.transform = 'scale(1)'; }
  function setupAvatarZoomEffect() {
    const avatar = document.querySelector('[class*="PageHeaderCover_coverImage"]');
    if (!avatar || avatar.classList.contains('avatar-zoom-initialized')) return;
    avatar.classList.add('avatar-zoom-initialized');
    avatar.addEventListener('mousemove', onAvatarMove);
    avatar.addEventListener('mouseleave', onAvatarLeave);
  }
  function removeAvatarZoomEffect() {
    const avatar = document.querySelector('[class*="PageHeaderCover_coverImage"]');
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

  /* ───────────────────────── Recolor core ───────────────────────── */
  let _lastSrc = '', _lastHex = '';
  let _lastBgEnabled = null, _lastZoom = null, _lastFullVibe = null;

  async function recolor(force = false) {
    const useHex = getBool(['Тема.useCustomColor', 'useCustomColor'], false);
    const hex = getText(['Тема.baseColor', 'baseColor'], '');

    let base, c1, c2;

    if (useHex) {
      if (!force && hex === _lastHex) return;
      base = clampL(parseHEX(hex)); c1 = c2 = base; _lastHex = hex;
      LOG('palette: HEX mode', hex, base);
    } else {
      const src = currentCoverURL();
      if (!force && src === _lastSrc) return;
      const pair = await colorsFromCover(src);
      if (!pair) return;
      [c1, c2] = pair;
      base = {
        h: Math.round((c1.h + c2.h) / 2),
        s: +((c1.s + c2.s) / 2).toFixed(1),
        l: +((c1.l + c2.l) / 2).toFixed(1)
      };
      _lastSrc = src;
      LOG('palette: cover mode', src, c1, c2, '=>', base);
    }

    applyVars(buildVars(base));
    ensureGradientOverlay();

    // эффекты
    const bgEnabled  = getBool(['Эффекты.enableBackgroundImage', 'enableBackgroundImage'], false);
    const zoomEnable = getBool(['Эффекты.enableAvatarZoom', 'enableAvatarZoom'], false);
    const fullVibe   = getBool(['Эффекты.FullVibe', 'FullVibe'], false);

    if (bgEnabled !== _lastBgEnabled || force) {
      _lastBgEnabled = bgEnabled;
      if (bgEnabled) backgroundReplace(await getHiResCover());
      else removeBackgroundImage();
    }
    if (zoomEnable !== _lastZoom || force) {
      _lastZoom = zoomEnable;
      if (zoomEnable) setupAvatarZoomEffect();
      else removeAvatarZoomEffect();
    }
    if (fullVibe !== _lastFullVibe || force) {
      _lastFullVibe = fullVibe;
      if (fullVibe) FullVibe();
      else RemoveFullVibe();
    }
  }

  /* ───────────────────────── lifecycle / watchers ───────────────────────── */
  const _debouncedRecolor = typeof Util.debounce === 'function' ? Util.debounce(recolor, 120) : recolor;

  let _domObs = null, _settingsUnsub = null, _trackUnsub = null, _pageTimer = null, _vibeGuard = null;
  let _lastURL = location.href;

  function startWatchers() {
    if (!_domObs) {
      _domObs = new MutationObserver(() => _debouncedRecolor());
      _domObs.observe(document.body, { childList: true, subtree: true });
    }
    if (!_trackUnsub) {
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
            backgroundReplace(getHiResCover());
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
          LOG('vibe guard → refresh');
          await recolor(true);
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
// === END: Library.colorize2 (inline rewrite) ===
