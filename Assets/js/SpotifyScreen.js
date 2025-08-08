const SpotColЛичная = window.Theme;
console.log("проверка SPOTIFYSCREEN v0.6.4")
if (!SpotColЛичная) {
  console.error("[SpotifyScreen] Theme is not available.");
  throw new Error("Theme not loaded");
}

   SpotColЛичная.stylesManager.add(
     'spotify-like-wrapper',
     `.LikeTrack{flex:0 0 42px;
     display:flex;
     align-items:center;
     justify-content:center;
     cursor:pointer;
     top: 10px
     right: 14px}
      @keyframes likePulse{0%{transform:scale(1);}45%{transform:scale(1.25);}100%{transform:scale(1);} }
      .LikeTrack.animate{animation:likePulse .35s ease-out;}

      `
     
   );
   
/*_____________________________________________________________________________________________*/
   (function(theme){
     let $root,$bg,$cover,$track,$artist,$like,$origLike,observer;
     let prevLiked=null;

     const isLiked=node=>{
       if(!node) return false;
       if(node.getAttribute('aria-checked')!==null) return node.getAttribute('aria-checked')==='true';
       return node.classList.contains('Like_active') || !!node.querySelector('svg[class*="_active"],svg[class*="-active"],svg .LikeIcon_active');
     };

/*_____________________________________________________________________________________________*/

    const syncState = () => {
      if (!$origLike || !$like) return;
      console.log('[SpotifyScreen] 🔁 syncState() — синхронизация лайка');

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

/*_____________________________________________________________________________________________*/


     const attachObserver=()=>{
       if(observer) observer.disconnect();
       if(!$origLike) return;
       observer=new MutationObserver(syncState);
       observer.observe($origLike,{attributes:true,childList:true,subtree:true});
     };

/*_____________________________________________________________________________________________*/


     const findOriginalLike=()=>{
       const sels=[
         '.FullscreenPlayerDesktopControls_likeButton__vpJ7S[data-test-id="LIKE_BUTTON"]',
         '.PlayerBarDesktop_root__d2Hwi [data-test-id="LIKE_BUTTON"]',
         '[data-test-id="PLAYERBAR_DESKTOP_LIKE_BUTTON"]',
         '[data-test-id="LIKE_BUTTON"]'];
       return sels.map(q=>document.querySelector(q)).find(Boolean)||null;
     };

/*_____________________________________________________________________________________________*/

    const createClone = () => {
      console.log('[SpotifyScreen] 🧬 createClone() — создаём клон лайка');
      $origLike = findOriginalLike();
      prevLiked = null;
      if (!$origLike) return el('div', 'LikeTrack');
      const clone = $origLike.cloneNode(true);
      clone.classList.add('LikeTrack');
      clone.removeAttribute('data-test-id');
      clone.addEventListener('click', () => {
        console.log('[SpotifyScreen] 💚 Лайк нажали');
        $origLike.click();
      });
      attachObserver();
      syncState();
      return clone;
    };

/*_____________________________________________________________________________________________*/
// SpotifyScreen.js — build()
function build() {
  let root = document.querySelector('.Spotify_Screen');
  if (root && document.body.contains(root)) {
    $root   = root;
    $cover  = root.querySelector('.SM_Cover');
    $track  = root.querySelector('.SM_Track_Name');
    $artist = root.querySelector('.SM_Artist');
    return;
  }

  const anchor =
    document.querySelector('[class*="commonlayout_content"], [class*="CommonLayout_content"]') ||
    document.querySelector('[class*="Content_root"]') ||
    document.querySelector('[data-test-id="PLAYERBAR_DESKTOP"]')?.parentElement ||
    document.querySelector('[data-test-id="NAVBAR"]')?.parentElement ||
    document.querySelector('[class*="DefaultLayout_root"]') ||
    document.querySelector('[class*="CommonLayout_root"]') ||
    document.body;

  root = document.createElement('div');
  root.className = 'Spotify_Screen';
  root.innerHTML = `
    <div class="SM_Background"></div>
    <div class="SM_Cover"></div>
    <div class="SM_Title_Line"></div>
    <div class="SM_Track_Name"></div>
    <div class="SM_Artist"></div>
    <div class="All_Info_Container"></div>
  `;

  if (anchor && anchor.parentElement) {
    anchor.insertAdjacentElement('afterend', root);
  } else {
    (anchor || document.body).appendChild(root);
  }

  $root   = root;
  $cover  = root.querySelector('.SM_Cover');
  $track  = root.querySelector('.SM_Track_Name');
  $artist = root.querySelector('.SM_Artist');

  Object.assign($cover.style, {
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    aspectRatio: '1 / 1',
    zIndex: 2
  });

  const $title = root.querySelector('.SM_Title_Line');
  if ($title && typeof createClone === 'function') {
    $like = createClone();
    $title.appendChild($like);
    if (typeof attachObserver === 'function') attachObserver();
    if (typeof syncState === 'function') syncState();
  }
}

function ensureBuilt() {
  if (!document.querySelector('.Spotify_Screen')) build();
}

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

  const cur = window.Theme?.player?.state?.track || window.Theme?.player?.getCurrentTrack?.();
  if (cur) {
    const u = window.Library?.util?.coverURLFromTrack?.(cur);
    if (u) window.Library?.ui?.crossfade?.('.SM_Cover', u, { duration: 600 });
  }
}


/*_____________________________________________________________________________________________*/

     function el(tag,cls,parent=document.body,txt){
      const n=document.createElement(tag);
      n.classList.add(cls);if(txt)n.textContent=txt;
      parent.appendChild(n);
      return n;
    }

/*___________________________________SETTINGS__________________________________________________________*/

  const sm = SpotColЛичная.settingsManager;
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
  sm.on('change:useModel',  ({settings}) => { useModel    = modelMap[settings.get('useModel').value] || useModel; clearUI(); refresh(); });

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
      'Ты — музыкальный справочник с глобальным охватом.',
      'Используй только информацию из открытых интернет‑источников; не придумывай факты.',
      'Имя артиста (и название трека) используй строго **буквально**, без правок или сокращений.',
      'Если по данной записи не найдено надёжных сведений именно в таком написании — верни «Информация не найдена».',
      'Всегда начинай ответ секциями "=== Артист ===" и "=== Трек ===" (или англ. варианты).',
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

/*_____________________________________________________________________________________________*/
SpotColЛичная.SpotifyScreen = {
  init(player) {
    if (!player) return;

    window.Player = window.Player || player;

    const applyTrack = (stateOrTrack) => {
      ensureBuilt();
      ensureUIBound();

      const track = stateOrTrack?.track || stateOrTrack;
      if (!track) return;

      window.Library?.initUI?.();
      window.Library?.ui?.updateTrackUI?.(
        { cover: '.SM_Cover', title: '.SM_Track_Name', artist: '.SM_Artist' },
        track,
        { duration: 600 }
      );
    };

    player.on('trackChange', ({ state }) => applyTrack(state));
    player.on('openPlayer',  ({ state }) => applyTrack(state));
    player.on('pageChange',  () => { ensureBuilt(); ensureUIBound(); });

    const layout = document.querySelector('[class*="CommonLayout_root"]');
    if (layout) {
      const mo = new MutationObserver(() => { ensureBuilt(); ensureUIBound(); });
      mo.observe(layout, { childList: true, subtree: true });
    }

    ensureBuilt();
    ensureUIBound();

    const cur = window.Theme?.player?.state?.track || window.Theme?.player?.getCurrentTrack?.();
    if (cur) applyTrack(cur);
  },

  check() {
    ensureBuilt();
    ensureUIBound();
  }
};
/*_____________________________________________________________________________________________*/
theme.updateSpotifyScreen = update;
   })(SpotColЛичная, 1000);
