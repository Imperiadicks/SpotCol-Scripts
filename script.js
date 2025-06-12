(function initSpotCol () {
  const LIB_URL     = 'https://cdn.jsdelivr.net/gh/Imperiadicks/SpotCol-Scripts@latest/ImperiaLibrary.js';
  const HELPER_URL  = 'https://cdn.jsdelivr.net/gh/Imperiadicks/SpotCol-Scripts@latest/helpers.js';
  const THEME_ID    = 'SpotColЛичная';

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src   = src;
      s.async = true;
      s.onload  = () => resolve();
      s.onerror = () => reject(new Error(`Не удалось загрузить ${src}`));
      document.head.appendChild(s);
    });
  }

  // Сначала библиотека, потом помощь, и только потом старт темы
  loadScript(LIB_URL)
    .then(()  => loadScript(HELPER_URL))
    .then(startTheme)
    .catch(err => console.error('[SpotCol] Ошибка загрузки скриптов:', err));

  function startTheme () {
    const { Theme } = window.ImperiaLibrary || {};
    if (!Theme) {
      console.error('[SpotCol] ImperiaLibrary.Theme отсутствует');
      return;
    }
    const SpotCol = new Theme(THEME_ID);
/*_____________________________________________________________________________________________*/
/*
 * SpotColЛичная — GPT / Wiki helper (rev‑2025‑05‑11‑i2)
 * Полностью завершённый скрипт без ссылок; устойчив к изменениям DOM/настроек.
 */

(() => {
  /* === SETTINGS === */
  const sm = SpotCol.settingsManager;
  const modelMap = {
    1: 'searchgpt',
    2: 'gpt-4o-mini',
    3: 'llama-3.3',
    4: 'gemini-2.0-flash',
    5: 'gemini-2.0-flash-mini'
  };

  let neuroSearch = sm.get('gptSearch')?.value ?? false;
  let useStream   = sm.get('useStream')?.value ?? false;
  let useModel    = modelMap[sm.get('useModel')?.value] || 'gpt-4o-mini';

  sm.on('change:gptSearch', ({settings}) => { neuroSearch = settings.get('gptSearch').value; clearUI(); refresh(); });
  sm.on('change:useStream', ({settings}) => { useStream   = settings.get('useStream').value;   clearUI(); refresh(); });
  sm.on('change:useModel', ({ settings }) => {
    // новая модель
    useModel = modelMap[settings.get('useModel').value] || useModel;

    // принудительно сбрасываем кэш, чтобы refresh() сделал запрос сразу
    prevA = '';
    prevT = '';

    clearUI();
    refresh();          // мгновенный запрос к новой модели
});


  /* === DOM === */
  const selArtist = '.SM_Artist';
  const selTrack  = '.SM_Track_Name';
  const $ = s => document.querySelector(s);
  const UI = {
    artist: () => $('.Search_Info'),
    track : () => $('.GPT_Search_Info'),
    alert : () => $('.Achtung_Alert'),
    box   : () => $('.GPT_Info_Container')
  };

  function clearUI() {
    UI.artist()?.replaceChildren();
    UI.track()?.replaceChildren();
    const a = UI.alert(); if (a) a.style.display = 'none';
  }

  /* === MARKDOWN === */
  function md2html(md = '') {
    md = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    md = md.replace(/\[(.+?)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    md = md.replace(/^(#{1,6})\s+(.+)$/gm, (_, h, t) => `<h${h.length}>${t}</h${h.length}>`);
    md = md.replace(/\*\*(.+?)\*\*|__(.+?)__/g, '<strong>$1$2</strong>');
    md = md.replace(/\*(.+?)\*|_(.+?)_/g, '<em>$1$2</em>');
    md = md.replace(/(^|\n)[ \t]*[-*+]\s+(.+)/g, '$1<ul><li>$2</li></ul>');
    md = md.replace(/(^|\n)[ \t]*\d+[.)]\s+(.+)/g, '$1<ol><li>$2</li></ol>');
    return md.replace(/\r?\n/g, '<br>');
  }

  /* === WIKI FALLBACK === */
  async function fetchWiki(artist) {
    const out = UI.artist(); const alert = UI.alert(); if (!out) return;
    try {
      const url = 'https://ru.wikipedia.org/w/api.php?action=query&format=json&origin=*' +
                  '&titles=' + encodeURIComponent(artist) + '&prop=extracts&exintro&explaintext';
      const res = await fetch(url); if (!res.ok) throw 0;
      const j = await res.json(); const page = Object.values(j.query.pages)[0] || {}; const text = page.extract || 'Информация не найдена';
      out.innerHTML = md2html(text); alert.style.display = 'block';
    } catch { out.innerHTML = '<b>Ошибка Wiki</b>'; alert.style.display = 'none'; }
  }

  /* === PROMPT BUILDER === */
  function buildPrompt(artist, track) {
    if (!artist && !track) return 'Информация не найдена';
    const artSafe  = artist || '—';
    const trackKey = track ? `${artSafe} — ${track}` : '—';
    return [
      'Ты всегда должен писать на русском',
      'Если по данной записи не найдено надёжных сведений именно в таком написании — верни «Информация не найдена».',
      'Всегда начинай ответ секциями "=== Артист ===" и "=== Трек ===" (или англ. варианты).',
      'Для каждой секции дай 10–20 предложений (и всегда пиши с новым абзацам): биография, дискография, жанр, рекорды, интересные факты.',
      'Не задавай уточняющих вопросов. Без эмодзи и ссылок.',
      '',
      '',
      '=== Артист ===',
      artSafe,
      '',
      '=== Трек ===',
      trackKey
    ].join('\n');
  }

  /* === SECTION SPLITTER === */
  const reArtist = /===\s*(Артист|Artist|Исполнитель)\s*===/i;
  const reTrack  = /===\s*(Трек|Track|Song|Песня)\s*===/i;
  function splitSections(txt) {
    const aIdx = txt.search(reArtist); const tIdx = txt.search(reTrack);
    let a = '', t = '';
    if (aIdx >= 0 && tIdx >= 0) {
      if (aIdx < tIdx) { a = txt.slice(aIdx, tIdx); t = txt.slice(tIdx); }
      else { t = txt.slice(tIdx, aIdx); a = txt.slice(aIdx); }
    } else if (aIdx >= 0) { a = txt.slice(aIdx); }
    else if (tIdx >= 0) { t = txt.slice(tIdx); }
    else { a = txt; }
    a = a.replace(reArtist, '').trim();
    t = t.replace(reTrack , '').trim();
    return { artistText: a, trackText: t };
  }

  /* === GPT STREAM & FETCH === */
  const endpoint = 'https://api.onlysq.ru/ai/v2';
  let ctl = null;

  async function streamGPT(prompt, onChunk) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: useModel, request: { messages: [{ role: 'user', content: prompt }], stream: true } }),
      signal: ctl.signal
    });
    if (!res.ok || !res.body) throw new Error('network');
    const rd = res.body.getReader(); const dec = new TextDecoder('utf-8'); let acc = '';
    while (true) {
      const { done, value } = await rd.read(); if (done) break;
      const chunk = dec.decode(value, { stream: true });
      for (let line of chunk.split('\n')) {
        if (!(line = line.trim()) || line === '[DONE]') continue;
        if (line.startsWith('data:')) line = line.slice(5).trim();
        try {
          const js = JSON.parse(line); const piece = js.choices?.[0]?.delta?.content || '';
          acc += piece; onChunk(acc);
        } catch {}
      }
    }
  }

  async function fetchGPT(artist, track) {
    const artEl = UI.artist(); const trEl = UI.track(); const alert = UI.alert(); const box = UI.box();
    if (!artEl || !trEl) return;
    box && (box.style.display = 'block'); artEl.textContent = '⏳'; trEl.textContent = '';
    ctl && ctl.abort(); ctl = new AbortController();
    const prompt = buildPrompt(artist, track);
    try {
      if (useStream) {
        await streamGPT(prompt, acc => {
          const { artistText, trackText } = splitSections(acc);
          artEl.innerHTML = md2html(artistText);
          trEl.innerHTML  = md2html(trackText);
        });
      } else {
        const r = await fetch(endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: useModel, request: { messages: [{ role: 'user', content: prompt }] } }),
          signal: ctl.signal
        });
        const j = await r.json(); const txt = j.choices?.[0]?.message?.content || '';
        const { artistText, trackText } = splitSections(txt);
        artEl.innerHTML = md2html(artistText);
        trEl.innerHTML  = md2html(trackText);
      }
      alert.style.display = 'block';
    } catch {
      artEl.innerHTML = '<b>Ошибка GPT</b>';
      trEl.innerHTML  = '';
      alert.style.display = 'none';
    }
  }

  /* === REFRESH LOOP === */
  let prevA = '', prevT = '';
  function refresh() {
    const a = ($(selArtist)?.textContent || '').trim();
    const t = ($(selTrack )?.textContent || '').trim();
    if (!a && !t) return;
    if (a === prevA && t === prevT) return;
    prevA = a; prevT = t;
    clearUI();
    if (neuroSearch) {
      fetchGPT(a, t);
    } else {
      UI.box() && (UI.box().style.display = 'none');
      fetchWiki(a || t); // если трека нет, пробуем артист / иначе строку трека
    }
  }

  refresh();
  setInterval(refresh, 1200);
})();


/*_____________________________________________________________________________________________*/
        SpotCol.start(1000);
        console.log('[SpotCol] Theme initialised');
    }
})();
/*_____________________________________________________________________________________________*/
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
// Отключение тупого даблклика
/*--------------------------------------------*/
function disableDoubleClick() {
    const elements = document.querySelectorAll('.PlayerBar_root__cXUnU');

    elements.forEach(element => {
        element.addEventListener('dblclick', function(event) {
            event.preventDefault();
            event.stopPropagation();
        }, true);
    });
}

setInterval(disableDoubleClick, 1000);
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
document.querySelector('.PeivVKR1FPSKq0eXZVTH.Brf6Ike_kAhLsPhNEEmk, .nc4M2_N9M5ElqO2JOOq7.Brf6Ike_kAhLsPhNEEmk, .prAUKw3AUngspVHmnd5F.Brf6Ike_kAhLsPhNEEmk').remove();
