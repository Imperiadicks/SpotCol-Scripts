/* ------------------------------------------------------------------
            *Colorize - v3.0*
 * ------------------------------------------------------------------ */

(() => {
    /* ---------- Константы & утилиты -------------------------------- */
  
    const CANVAS = document.createElement('canvas');
    const CTX    = CANVAS.getContext('2d');
    const CACHE  = new Map();                 // src → {h,s,l}
  
    const L_MIN = 20, L_MAX = 80, S_MIN = 25, SAMPLE_SIZE = 64;
  
    const rgbToHsl = (r, g, b) => {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
      let h = 0, s = 0, l = (max + min) / 2;
      if (d) {
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
          case g: h = ((b - r) / d + 2);               break;
          case b: h = ((r - g) / d + 4);               break;
        }
        h /= 6;
      }
      return { h: Math.round(h * 360), s: +(s * 100).toFixed(1), l: +(l * 100).toFixed(1) };
    };
  
    const H = o => `hsl(${o.h},${o.s}%,${o.l}%)`;
    const HA = (o, a = 1) => `hsla(${o.h},${o.s}%,${o.l}%,${a})`;
  
    const fallbackHSL = () => {
      const root = document.querySelector('[class*="PlayerBarDesktop_root"]');
      if (!root) return { h: 0, s: 0, l: 50 };
      const raw = getComputedStyle(root)
        .getPropertyValue('--player-average-color-background')
        .trim();
      const m = raw.match(/hsl\((\d+),\s*([\d.]+)%,\s*([\d.]+)%\)/);
      return m ? { h: +m[1], s: +m[2], l: +m[3] } : { h: 0, s: 0, l: 50 };
    };
  
    /* ---------- Читаем «средний» цвет обложки ---------------------- */
  
    const getAvgHSL = src => {
      if (CACHE.has(src)) return Promise.resolve(CACHE.get(src));
  
      return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
  
        img.onload = () => {
          try {
            CANVAS.width = CANVAS.height = SAMPLE_SIZE;
            CTX.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
            const { data } = CTX.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  
            let rSum = 0, gSum = 0, bSum = 0, cnt = 0;
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i], g = data[i + 1], b = data[i + 2];
              const { s, l } = rgbToHsl(r, g, b);
              if (l >= L_MIN && l <= L_MAX && s >= S_MIN) {
                rSum += r; gSum += g; bSum += b; cnt++;
              }
            }
  
            if (!cnt) {                       // ни один пиксель не прошёл фильтр
              for (let i = 0; i < data.length; i += 4) {
                rSum += data[i]; gSum += data[i + 1]; bSum += data[i + 2];
              }
              cnt = data.length / 4;
            }
  
            const avg = rgbToHsl(rSum / cnt, gSum / cnt, bSum / cnt);
            CACHE.set(src, avg);
            resolve(avg);
          } catch {
            /* Canvas «tainted» (нет CORS) */
            const fb = fallbackHSL();
            CACHE.set(src, fb);
            resolve(fb);
          }
        };
  
        img.onerror = () => resolve(fallbackHSL());
        img.src = src;
      });
    };
  
    /* ---------- Генерируем палитру & пишем переменные -------------- */
  
    const genPalette = (base, steps = 10) => {
      const vars = {};
      for (let i = 1; i <= steps; i++) {
        const lHi = base.l + (i * (80 - base.l)) / steps;
        const lLo = base.l - (i * base.l)        / steps;
  
        vars[`--color-light-${i}`] = H({ ...base, l: lHi });
        vars[`--color-dark-${i}`]  = H({ ...base, l: lLo });
  
        for (let j = 1; j <= 10; j++) {
          vars[`--color-light-${i}-${j}`] = HA({ ...base, l: lHi }, j / 10);
          vars[`--color-dark-${i}-${j}`]  = HA({ ...base, l: lLo }, j / 10);
        }
      }
      return vars;
    };
  
    const setRootVars = obj => {
      const st = document.documentElement.style;
      for (const k in obj) st.setProperty(k, obj[k]);
    };
  
    /* ---------- Главная функция раскраски -------------------------- */
  
    let currentSrc = '';
  
    const recolor = async () => {
      const img = document.querySelector('[class*="PlayerBarDesktop_coverContainer"] img');
      if (!img?.src || img.src === currentSrc) return;
  
      currentSrc = img.src;
      const base = await getAvgHSL(img.src);
  
      // собственная палитра
      setRootVars(genPalette(base));
  
      // ключевые YM-переменные
      setRootVars({
        '--ym-background-color-primary-enabled-content' : 'var(--color-dark-3)',
        '--ym-background-color-primary-enabled-basic'   : 'var(--color-dark-8)',
        '--ym-surface-color-primary-enabled-list'       : 'var(--color-light-1-4)',
        '--ym-controls-color-primary-text-enabled'      : 'var(--color-light-10-5)',
        '--ym-controls-color-primary-text-hovered'      : 'var(--color-light-7)'
      });
  
      // фон «вибы»
      const vibe = document.querySelector('[class*="MainPage_vibe"]');
      if (vibe) {
        vibe.style.background =
          `linear-gradient(180deg,rgba(0,0,0,.2) 0%,var(--color-dark-3) 100%),` +
          `url(${img.src}) center/cover no-repeat`;
      }
    };
  
    /* ---------- Точное наблюдение за <img> ------------------------- */
  
    const observeCover = () => {
      const img = document.querySelector('[class*="PlayerBarDesktop_coverContainer"] img');
      if (!img) return;
  
      const mo = new MutationObserver(recolor);
      mo.observe(img, { attributes: true, attributeFilter: ['src'] });
  
      // если DOM-элемент сменился — пересоздаём observer
      const bodyWatch = new MutationObserver(() => {
        const fresh = document.querySelector('[class*="PlayerBarDesktop_coverContainer"] img');
        if (fresh && fresh !== img) {
          mo.disconnect();
          bodyWatch.disconnect();
          observeCover();
          recolor();
        }
      });
      bodyWatch.observe(document.body, { childList: true, subtree: true });
    };
  
    /* ---------- Старт --------------------------------------------- */
  
    const init = () => { observeCover(); recolor(); };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();                     // скрипт вставлен после полной загрузки
    }
  })();