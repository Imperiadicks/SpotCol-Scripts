const SpotColЛичная = window.Theme;
console.log('[SpotifyScreen] load v0.7.0-test1');
if (!SpotColЛичная) {
  console.error('[SpotifyScreen] Theme is not available.');
  throw new Error('Theme not loaded');
}

// Немного UI для кнопки лайка (через stylesManager, чтобы не плодить css-файлы)
SpotColЛичная.stylesManager.add(
  'spotify-like-wrapper',
  `.LikeTrack{flex:0 0 42px;display:flex;align-items:center;justify-content:center;cursor:pointer;top:10px;right:14px}
   @keyframes likePulse{0%{transform:scale(1);}45%{transform:scale(1.25);}100%{transform:scale(1);} }
   .LikeTrack.animate{animation:likePulse .35s ease-out;}`
);

/*_____________________________________________________________________________________________*/
(function(theme){
  const LOG = '[SpotifyScreen]';

  let $root,$bg,$bg1,$bg2,$cover,$track,$artist,$like,$origLike,observer;
  let prevLiked = null;
  let bgActive  = 1;          // какой слой сейчас активен (1/2)
  let coverLogObserver = null;

  // ---------------------------------- helpers ----------------------------------

  // найти якорь для вставки
  function findAnchor() {
    return (
      document.querySelector('[class*="commonlayout_content"], [class*="CommonLayout_content"]') ||
      document.querySelector('[class*="Content_root"]') ||
      document.querySelector('[data-test-id="PLAYERBAR_DESKTOP"]')?.parentElement ||
      document.querySelector('[data-test-id="NAVBAR"]')?.parentElement ||
      document.querySelector('[class*="DefaultLayout_root"]') ||
      document.querySelector('[class*="CommonLayout_root"]') ||
      document.body
    );
  }

  // построить ОДИН раз
  function build() {
    if (window.__spotifyBuilt && window.__spotifyRoot) {
      $root   = window.__spotifyRoot;
      $cover  = $root.querySelector('.SM_Cover');
      $track  = $root.querySelector('.SM_Track_Name');
      $artist = $root.querySelector('.SM_Artist');
      ensureBgLayers();
      ensureCoverLogging();
      return;
    }

    const root = document.createElement('div');
    root.className = 'Spotify_Screen';
    root.innerHTML = `

      <div class="SM_Cover"></div>

      <div class="SM_Title_Line" style="display:flex;align-items:center;gap:10px;margin-top:8px">
        <div class="SM_Track_Name" style="flex:1 1 auto;min-width:0"></div>
        <div class="LikeTrack"></div>
      </div>

      <div class="SM_Artist" style="opacity:.85;margin-bottom:8px"></div>

      <div class="All_Info_Container">
        <div class="Artist_Info_Container">
          <div class="Info_Title" style="font-weight:700;margin:10px 0 6px">Сведения об исполнителе</div>
          <div class="Search_Info"></div>
          <div class="Achtung_Alert" style="display:none;margin-top:8px;font-size:12px;opacity:.75">
            В сведениях иногда бывают неправильные результаты.
            Проверьте информацию подробнее, если изначально вам не всё равно!
          </div>
        </div>
        <div class="GPT_Info_Container" style="display:none;margin-top:10px">
          <div class="GPT_Info_Title" style="font-weight:700;margin:10px 0 6px">Сведения о треке</div>
          <div class="GPT_Search_Info"></div>
        </div>
      </div>
    `;

    // базовое позиционирование (аккуратный floating-виджет)
    Object.assign(root.style, {
      position: 'fixed', right: '24px', bottom: '24px',
      zIndex: '2147483000', width: '360px', maxWidth: 'calc(100vw - 32px)',
      borderRadius: '16px', overflow: 'hidden',
      border: '1px solid var(--sm-accent, rgba(255,255,255,.3))',
      boxShadow: '0 10px 30px rgba(0,0,0,.35)',
      backdropFilter: 'blur(10px)', background: 'rgba(0,0,0,.35)',
      color: '#fff', padding: '12px'
    });

    (findAnchor() || document.body).insertAdjacentElement('afterend', root);

    $root   = root;
    $cover  = root.querySelector('.SM_Cover');
    $track  = root.querySelector('.SM_Track_Name');
    $artist = root.querySelector('.SM_Artist');

    Object.assign($root.style, { position:'fixed', zIndex: '2147483000' });
    Object.assign($cover.style, { position:'relative', overflow:'hidden', width:'100%', aspectRatio:'1 / 1', borderRadius:'12px', boxShadow: '0 8px 24px rgba(0,0,0,.35), 0 0 20px var(--sm-accent, rgba(255,255,255,.15))' });

    ensureBgLayers();
    ensureCoverLogging();

    // Лайк-кнопка (клон оригинала)
    const $title = root.querySelector('.SM_Title_Line');
    const likeSlot = $title?.querySelector('.LikeTrack');
    if ($title && likeSlot) {
      $like = createClone();
      likeSlot.replaceWith($like);
      attachObserver();
      syncState();
    }

    // пульсация при play
    const cssPulse = document.createElement('style');
    cssPulse.textContent = `
      @keyframes coverPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
      .Spotify_Screen.playing .SM_Cover img._ui_cf.current { animation: coverPulse 4200ms ease-in-out infinite; }
    `;
    document.head.appendChild(cssPulse);

    window.__spotifyBuilt = true;
    window.__spotifyRoot  = root;
  }

  function ensureMounted() {
    const r = window.__spotifyRoot;
    if (r && !document.body.contains(r)) (findAnchor() || document.body).insertAdjacentElement('afterend', r);
  }
  function ensureBuilt() { if (!window.__spotifyBuilt) build(); else ensureMounted(); }

/*   function ensureBgLayers() {
    if (!$bg) return;
    if (!$bg1 || !$bg2) {
      $bg.innerHTML = '';
      $bg1 = document.createElement('div');
      $bg2 = document.createElement('div');
      $bg1.className = 'SM_Bg_Layer SM_Bg1';
      $bg2.className = 'SM_Bg_Layer SM_Bg2';
      const base = {
        position: 'absolute', inset: '-20px',
        backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
        opacity: '1', transition: 'opacity 500ms ease, filter 500ms ease',
        zIndex: '0', pointerEvents: 'none', filter: 'blur(24px) brightness(0.7)'
      };
      Object.assign($bg1.style, base);
      Object.assign($bg2.style, base, { opacity: '0' });
      Object.assign($bg.style, { position:'absolute', inset:'0', zIndex:'0', pointerEvents:'none' });
      if (getComputedStyle($root).position === 'static') $root.style.position = 'relative';
      $bg.appendChild($bg1);
      $bg.appendChild($bg2);
      bgActive = 1;
    }
  } */

  // двухслойный фон (плавная смена)
  function setBackground(url) {
    if (!$bg || !url) return;
/*     ensureBgLayers(); */
    const active = bgActive === 1 ? $bg1 : $bg2;
    const next   = bgActive === 1 ? $bg2 : $bg1;

    const cur = (active.style.backgroundImage || '').replace(/^url\(["']?(.+?)["']?\)$/, '$1');
    if (cur && cur === url) return;

    next.style.backgroundImage = `url("${url}")`;
    requestAnimationFrame(() => {
      next.style.opacity = '1';
      active.style.opacity = '0';
      const done = () => {
        next.removeEventListener('transitionend', done);
        bgActive = bgActive === 1 ? 2 : 1;
      };
      next.addEventListener('transitionend', done, { once: true });
      setTimeout(done, 900);
    });
  }

  // colorize обёртка: акцент и авто-яркость
  function applyColorization(url) {
    if (!url) return;
    const C = window.Library?.colorize;
    if (!C) return;
    (C.debounced?.applyAutoBrightness || C.applyAutoBrightness)(url, [$bg1, $bg2]);
    (C.debounced?.applyAccentFromImage || C.applyAccentFromImage)(url, $root, '--sm-accent');
  }

  // логирование загрузки текущей картинки в SM_Cover
  function ensureCoverLogging() {
    if (!$cover || coverLogObserver) return;
    coverLogObserver = new MutationObserver(() => {
      const cur = $cover.querySelector('img._ui_cf.current') || $cover.querySelector('img');
      if (!cur || cur._logBound) return;
      cur._logBound = true;
      const src = cur.currentSrc || cur.src;
      const onOk = () => console.log(`${LOG} ✅ Обложка успешно загружена (img load)`); // успех
      const onErr = () => console.error(`${LOG} ❌ Ошибка загрузки обложки (img error)`, src); // ошибка
      if (cur.complete) onOk();
      else {
        cur.addEventListener('load', onOk, { once: true });
        cur.addEventListener('error', onErr, { once: true });
      }
    });
    coverLogObserver.observe($cover, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'data-src', 'class'] });
  }

  // --- like-клон ---
  const isLiked = (node) => {
    if (!node) return false;
    if (node.getAttribute('aria-checked') !== null) return node.getAttribute('aria-checked') === 'true';
    return node.classList.contains('Like_active') || !!node.querySelector('svg[class*="_active"],svg[class*="-active"],svg .LikeIcon_active');
  };

  const findOriginalLike = () => {
    const sels = [
      '.FullscreenPlayerDesktopControls_likeButton__vpJ7S[data-test-id="LIKE_BUTTON"]',
      '.PlayerBarDesktop_root__d2Hwi [data-test-id="LIKE_BUTTON"]',
      '[data-test-id="PLAYERBAR_DESKTOP_LIKE_BUTTON"]',
      '[data-test-id="LIKE_BUTTON"]'
    ];
    return sels.map(q => document.querySelector(q)).find(Boolean) || null;
  };

  const syncState = () => {
    if (!$origLike || !$like) return;
    const svgO = $origLike.querySelector('svg');
    const svgC = $like.querySelector('svg');
    if (svgO) {
      svgC ? svgC.replaceWith(svgO.cloneNode(true)) : $like.appendChild(svgO.cloneNode(true));
    }
    const liked = isLiked($origLike);
    $like.classList.toggle('Like_active', liked);
    if (liked !== prevLiked) {
      $like.classList.add('animate');
      setTimeout(() => { $like && $like.classList.remove('animate'); }, 350);
      prevLiked = liked;
    }
  };

  const attachObserver = () => {
    if (observer) observer.disconnect();
    $origLike = findOriginalLike();
    if (!$origLike) return;
    observer = new MutationObserver(syncState);
    observer.observe($origLike, { attributes: true, childList: true, subtree: true });
  };

  const createClone = () => {
    $origLike = findOriginalLike();
    prevLiked = null;
    const clone = document.createElement('div');
    clone.className = 'LikeTrack';
    clone.addEventListener('click', () => { console.log(`${LOG} 💚 Лайк нажали`); $origLike?.click(); });
    if ($origLike) {
      const svgO = $origLike.querySelector('svg');
      if (svgO) clone.appendChild(svgO.cloneNode(true));
    }
    return clone;
  };

  // ---------------------------------- инфо блоки / настройки ----------------------------------

  const sm = SpotColЛичная.settingsManager;
  const modelMap = { 1: 'searchgpt', 2: 'gpt-4o-mini', 3: 'llama-3.3', 4: 'gemini-2.0-flash', 5: 'gemini-2.0-flash-mini' };
  let neuroSearch = sm.get('gptSearch')?.value ?? false;
  let useStream   = sm.get('useStream')?.value ?? false;
  let useModel    = modelMap[sm.get('useModel')?.value] || 'gpt-4o-mini';

  sm.on('change:gptSearch', ({settings}) => { neuroSearch = settings.get('gptSearch').value; clearUI(); refresh(); });
  sm.on('change:useStream', ({settings}) => { useStream   = settings.get('useStream').value;   clearUI(); refresh(); });
  sm.on('change:useModel',  ({settings}) => { useModel    = modelMap[settings.get('useModel').value] || useModel; clearUI(); refresh(); });

  const selArtist = '.SM_Artist';
  const selTrack  = '.SM_Track_Name';
  const $q = (s) => document.querySelector(s);
  const UI = {
    artist: () => $q('.Search_Info'),
    track : () => $q('.GPT_Search_Info'),
    alert : () => $q('.Achtung_Alert'),
    box   : () => $q('.GPT_Info_Container')
  };
  function clearUI() {
    UI.artist()?.replaceChildren();
    UI.track()?.replaceChildren();
    const a = UI.alert(); if (a) a.style.display = 'none';
  }
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
  function buildPrompt(artist, track) {
    if (!artist && !track) return 'Информация не найдена';
    const artSafe  = artist || '—';
    const trackKey = track ? `${artSafe} — ${track}` : '—';
    return [
      'Ты всегда должен писать на русском',
      'Ты — музыкальный справочник с глобальным охватом.',
      'Используй только информацию из открытых интернет-источников; не придумывай факты.',
      'Имя артиста (и название трека) используй строго **буквально**, без правок или сокращений.',
      'Если по данной записи не найдено надёжных сведений именно в таком написании — верни «Информация не найдена».',
      'Всегда начинай ответ секциями "=== Артист ===" и "=== Трек ===".',
      'Для каждой секции дай 10–20 предложений: биография, дискография, жанр, рекорды, интересные факты.',
      'Не задавай уточняющих вопросов. Без эмодзи и ссылок.',
      '',
      '=== Артист ===',
      artSafe,
      '',
      '=== Трек ===',
      trackKey
    ].join('\n');
  }
  const reArtist = /===\s*(Артист|Artist|Исполнитель)\s*===/i;
  const reTrack  = /===\s*(Трек|Track|Song|Песня)\s*===/i;
  function splitSections(txt) {
    const aIdx = txt.search(reArtist); const tIdx = txt.search(reTrack);
    let a = '', t = '';
    if (aIdx >= 0 && tIdx >= 0) { if (aIdx < tIdx) { a = txt.slice(aIdx, tIdx); t = txt.slice(tIdx); } else { t = txt.slice(tIdx, aIdx); a = txt.slice(aIdx); } }
    else if (aIdx >= 0) { a = txt.slice(aIdx); }
    else if (tIdx >= 0) { t = txt.slice(tIdx); }
    else { a = txt; }
    a = a.replace(reArtist, '').trim();
    t = t.replace(reTrack , '').trim();
    return { artistText: a, trackText: t };
  }
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

  // цикл обновления инфо (artist/track)
  let prevA = '', prevT = '';
  function refresh() {
    const a = ($q(selArtist)?.textContent || '').trim();
    const t = ($q(selTrack )?.textContent || '').trim();
    if (!a && !t) return;
    if (a === prevA && t === prevT) return;
    prevA = a; prevT = t;
    clearUI();
    if (neuroSearch) { fetchGPT(a, t); }
    else { UI.box() && (UI.box().style.display = 'none'); fetchWiki(a || t); }
  }
  refresh();
  setInterval(refresh, 1200);

  // ---------------------------------- основные API ----------------------------------

  SpotColЛичная.SpotifyScreen = {
    init(player) {
      if (!player) return;

      window.Player = window.Player || player;

      const currentTrack = () =>
        window.Theme?.player?.state?.track ||
        window.Theme?.player?.getCurrentTrack?.() ||
        window.Library?.getCurrentTrack?.() ||
        null;

      const updateAll = (maybeStateOrTrack) => {
        ensureBuilt();

        // ensure UI bind + crossfade support
        ensureUIBound();

        const track = (maybeStateOrTrack?.track || maybeStateOrTrack) || currentTrack();
        if (!track) return;

        const url = window.Library?.util?.coverURLFromTrack?.(track, '1000x1000') ||
                    window.Library?.util?.coverURLFromTrack?.(track) ||
                    '';

        // лог смены трека
        const name = track?.title || track?.name || '—';
        const artist = Array.isArray(track?.artists) ? track.artists.map(a => a.name || a.title).filter(Boolean).join(', ') : (track?.artist || track?.author || '');
        console.log(`${LOG} 🎵 Трек: ${artist ? artist + ' — ' : ''}${name}`);

        // тексты + обложка (через Library.ui.updateTrackUI)
        window.Library?.initUI?.();
        window.Library?.ui?.updateTrackUI?.(
          { cover: '.SM_Cover', title: '.SM_Track_Name', artist: '.SM_Artist' },
          track,
          { duration: 600 }
        );

        if (url) {
          console.log(`${LOG} 🖼️ Обновление обложки:`, url);
          setBackground(url);
          applyColorization(url);
        }

        ensureCoverLogging();
      };

      // события плеера
      player.on('trackChange', ({ state }) => updateAll(state));
      player.on('openPlayer',  ({ state }) => updateAll(state));
      player.on('pageChange',  () => updateAll());

      // пульсация при воспроизведении
      player.on('play',  () => { $root?.classList.add('playing');  });
      player.on('pause', () => { $root?.classList.remove('playing'); });

      // доп. «шина»
      try {
        window.Library?.initUI?.();
        window.Library?.onTrack?.((t) => updateAll(t), { immediate: true });
      } catch (_) {}

      // keep-alive: если узел выпал — вернуть и обновить
      const keepAlive = new MutationObserver(() => {
        const r = window.__spotifyRoot;
        if (r && !document.body.contains(r)) {
          (findAnchor() || document.body).insertAdjacentElement('afterend', r);
          updateAll();
        }
      });
      keepAlive.observe(document.body, { childList: true, subtree: true });

      // сторож на случай пропущенных событий
      let lastCoverURL = '';
      setInterval(() => {
        ensureBuilt();
        ensureUIBound();

        const t = currentTrack();
        if (!t) return;

        const url = window.Library?.util?.coverURLFromTrack?.(t, '1000x1000') ||
                    window.Library?.util?.coverURLFromTrack?.(t);
        const $c = document.querySelector('.SM_Cover');
        const hasImg = !!$c?.querySelector('img._ui_cf.current');
        if (url && (url !== lastCoverURL || !hasImg)) {
          window.Library?.ui?.crossfade?.('.SM_Cover', url, {
            duration: 600,
            onStart:  (u)=>console.log(`${LOG} 🖼️ start:`, u),
            onLoad:   ()=>console.log(`${LOG} ✅ loaded`),
            onError:  (u)=>console.error(`${LOG} ❌ error:`, u)
          });
          setBackground(url);
          applyColorization(url);
          lastCoverURL = url;
        }
      }, 1000);

      // первичная инициализация
      updateAll();
    },

    check() {
      ensureBuilt();
      ensureUIBound();
      const t = window.Theme?.player?.state?.track || window.Theme?.player?.getCurrentTrack?.();
      if (t) {
        const url = window.Library?.util?.coverURLFromTrack?.(t, '1000x1000') ||
                    window.Library?.util?.coverURLFromTrack?.(t);
        window.Library?.ui?.updateTrackUI?.(
          { cover: '.SM_Cover', title: '.SM_Track_Name', artist: '.SM_Artist' },
          t,
          { duration: 600 }
        );
        if (url) {
          setBackground(url);
          applyColorization(url);
        }
        ensureCoverLogging();
      }
    }
  };

  // Привязка UI к библиотеке (один раз)
  function ensureUIBound() {
    if (window.__spotifyUIBound && document.querySelector('.Spotify_Screen')) return;
    if (!document.querySelector('.Spotify_Screen')) { window.__spotifyUIBound = false; return; }

    const ok = document.querySelector('.SM_Cover') && document.querySelector('.SM_Track_Name');
    if (!ok) return;

    window.Library?.initUI?.();
    window.__spotifyUnbind = window.Library?.ui?.bindTrackUI?.(
      { cover: '.SM_Cover', title: '.SM_Track_Name', artist: '.SM_Artist' },
      { duration: 600 }
    );
    window.__spotifyUIBound = true;

    // первая картинка (и логи)
    const cur = window.Theme?.player?.state?.track || window.Theme?.player?.getCurrentTrack?.();
    if (cur) {
      const u = window.Library?.util?.coverURLFromTrack?.(cur);
      if (u) {
        console.log(`${LOG} 🖼️ Обновление обложки (init):`, u);
        window.Library?.ui?.crossfade?.('.SM_Cover', u, {
          duration: 600,
          onStart:  (url)=>console.log(`${LOG} 🖼️ start:`, url),
          onLoad:   ()=>console.log(`${LOG} ✅ loaded`),
          onError:  (url)=>console.error(`${LOG} ❌ error:`, url)
        });
        setBackground(u);
        applyColorization(u);
      }
    }
    ensureCoverLogging();
  }

  // Внешняя "update" (совместимость со старым кодом темы)
  function update(){ try { SpotColЛичная.SpotifyScreen.check(); } catch(_){} }
  theme.updateSpotifyScreen = update;

  // следим за сменой видимости (вернулись — синхронизация)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      try { SpotColЛичная.SpotifyScreen.check(); } catch {}
    }
  });

  // автозапуск, если player уже есть
  if (theme.player) {
    try { SpotColЛичная.SpotifyScreen.init(theme.player); } catch {}
  } else {
    const iv = setInterval(() => {
      if (theme.player) {
        clearInterval(iv);
        try { SpotColЛичная.SpotifyScreen.init(theme.player); } catch {}
      }
    }, 250);
    setTimeout(() => clearInterval(iv), 15000);
  }
})(SpotColЛичная);
