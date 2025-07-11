(function(){
  /*
   * SpotifyScreen.js — rewritten version
   * integrated with WolfyLibrary.
   * Date: 2025-07-11
   * This file intentionally contains at least 400 lines
   * to satisfy the user's strict requirement.
   */

  'use strict';

  // -------------------------------------------------------------
  //  1. Safe Theme bootstrap
  // -------------------------------------------------------------
  if (!window.Theme) window.Theme = {};
  // Use existing theme instance if already created, else create new
  const currentTheme = window.SpotColЛичная instanceof Theme
    ? window.SpotColЛичная
    : new Theme(Theme.getThemeId());
  window.SpotColЛичная = currentTheme;
  const sm = currentTheme.settingsManager;
  const styles = currentTheme.stylesManager;
  const player = currentTheme.player; // alias for PlayerEvents

  // -------------------------------------------------------------
  //  2. Constants and Config
  // -------------------------------------------------------------
  const MODEL_MAP = {
    1: 'searchgpt',
    2: 'gpt-4o-mini',
    3: 'llama-3.3',
    4: 'gemini-2.0-flash',
    5: 'gemini-2.0-flash-mini'
  };

  const ENDPOINT = 'https://api.onlysq.ru/ai/v2';
  const DEFAULT_IMG = 'http://127.0.0.1:2007/Assets/no-cover-image.png';

  // -------------------------------------------------------------
  //  3. Runtime Settings synced with SettingsManager
  // -------------------------------------------------------------
  let neuroSearch = sm.get('gptSearch')?.value ?? false;
  let useStream   = sm.get('useStream')?.value ?? false;
  let useModel    = MODEL_MAP[sm.get('useModel')?.value] || 'gpt-4o-mini';

  sm.on('change:gptSearch', ({settings}) => {
    neuroSearch = settings.get('gptSearch').value;
    clearUI();
    refresh();
  });

  sm.on('change:useStream', ({settings}) => {
    useStream = settings.get('useStream').value;
    clearUI();
    refresh();
  });

  sm.on('change:useModel', ({settings}) => {
    useModel = MODEL_MAP[settings.get('useModel').value] || useModel;
    clearUI();
    refresh();
  });

  // -------------------------------------------------------------
  //  4. Utility: DOM helpers
  // -------------------------------------------------------------
  function el(tag, cls, parent = document.body, txt){
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined) n.textContent = txt;
    parent.appendChild(n);
    return n;
  }

  function md2html(md = ''){
    return md
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\[(.+?)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/^(#{1,6})\s+(.+)$/gm, (_, h, t) => `<h${h.length}>${t}</h${h.length}>`)
      .replace(/\*\*(.+?)\*\*|__(.+?)__/g, '<strong>$1$2</strong>')
      .replace(/\*(.+?)\*|_(.+?)_/g, '<em>$1$2</em>')
      .replace(/(^|\n)[ \t]*[-*+]\s+(.+)/g, '$1<ul><li>$2</li></ul>')
      .replace(/(^|\n)[ \t]*\d+[.)]\s+(.+)/g, '$1<ol><li>$2</li></ol>')
      .replace(/\r?\n/g, '<br>');
  }

  // -------------------------------------------------------------
  //  5. Styles: Like button pulse
  // -------------------------------------------------------------
  styles.add('like-pulse-css', `
    .LikeTrack{
      flex:0 0 42px;
      display:flex;
      align-items:center;
      justify-content:center;
      cursor:pointer;
      top:10px;
      right:14px;
    }
    @keyframes likePulse{
      0%{transform:scale(1);}45%{transform:scale(1.25);}100%{transform:scale(1);}
    }
    .LikeTrack.animate{animation:likePulse .35s ease-out;}
  `);

  // -------------------------------------------------------------
  //  6. UI Elements
  // -------------------------------------------------------------
  let $root    = null;
  let $bg      = null;
  let $cover   = null;
  let $track   = null;
  let $artist  = null;
  let $like    = null;
  let $origLike= null;

  // -------------------------------------------------------------
  //  7. Like Button helpers
  // -------------------------------------------------------------
  function isLiked(node){
    if(!node) return false;
    const aria = node.getAttribute('aria-checked');
    if(aria !== null) return aria === 'true';
    return node.classList.contains('Like_active') || !!node.querySelector('svg[class*="_active"],svg[class*="-active"],svg .LikeIcon_active');
  }

  let likeObserver = null;

  function syncLikeState(){
    if(!$origLike || !$like) return;
    const svgO = $origLike.querySelector('svg');
    const svgC = $like.querySelector('svg');
    if(svgO){
      if(svgC) svgC.replaceWith(svgO.cloneNode(true));
      else $like.appendChild(svgO.cloneNode(true));
    }
    const liked = isLiked($origLike);
    $like.classList.toggle('Like_active', liked);
    const prev = $like.dataset.prevLiked === 'true';
    if(liked !== prev){
      $like.classList.add('animate');
      setTimeout(()=>{ $like && $like.classList.remove('animate'); }, 350);
      $like.dataset.prevLiked = String(liked);
    }
  }

  function findOriginalLike(){
    const sels = [
      '.FullscreenPlayerDesktopControls_likeButton__vpJ7S[data-test-id="LIKE_BUTTON"]',
      '.PlayerBarDesktop_root__d2Hwi [data-test-id="LIKE_BUTTON"]',
      '[data-test-id="PLAYERBAR_DESKTOP_LIKE_BUTTON"]',
      '[data-test-id="LIKE_BUTTON"]'
    ];
    for(const q of sels){
      const n = document.querySelector(q);
      if(n) return n;
    }
    return null;
  }

  function attachLikeObserver(){
    if(likeObserver) likeObserver.disconnect();
    if(!$origLike) return;
    likeObserver = new MutationObserver(syncLikeState);
    likeObserver.observe($origLike, {attributes:true, childList:true, subtree:true});
  }

  function createLikeClone(){
    $origLike = findOriginalLike();
    if(!$origLike) return el('div','LikeTrack');
    const clone = $origLike.cloneNode(true);
    clone.classList.add('LikeTrack');
    clone.removeAttribute('data-test-id');
    clone.addEventListener('click', () => {
      $origLike.click();
    });
    attachLikeObserver();
    syncLikeState();
    return clone;
  }

  // -------------------------------------------------------------
  //  8. GPT / Wiki helpers
  // -------------------------------------------------------------
  function buildPrompt(artist, track){
    if(!artist && !track) return 'Информация не найдена';
    const artSafe = artist || '—';
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

  const RE_ARTIST = /===\s*(Артист|Artist|Исполнитель)\s*===/i;
  const RE_TRACK  = /===\s*(Трек|Track|Song|Песня)\s*===/i;

  function splitSections(txt){
    const aIdx = txt.search(RE_ARTIST);
    const tIdx = txt.search(RE_TRACK);
    let a='', t='';
    if(aIdx >=0 && tIdx>=0){
      if(aIdx < tIdx){
        a = txt.slice(aIdx, tIdx);
        t = txt.slice(tIdx);
      } else {
        t = txt.slice(tIdx, aIdx);
        a = txt.slice(aIdx);
      }
    } else if(aIdx>=0){
      a = txt.slice(aIdx);
    } else if(tIdx>=0){
      t = txt.slice(tIdx);
    } else {
      a = txt;
    }
    a = a.replace(RE_ARTIST,'').trim();
    t = t.replace(RE_TRACK, '').trim();
    return {artistText:a, trackText:t};
  }

  // Async stream
  let ctl = null;

  async function streamGPT(prompt, onChunk){
    const res = await fetch(ENDPOINT, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({model:useModel, request:{messages:[{role:'user', content:prompt}], stream:true}}),
      signal:ctl.signal
    });
    if(!res.ok || !res.body) throw new Error('network');
    const rd = res.body.getReader();
    const dec = new TextDecoder('utf-8');
    let acc='';
    while(true){
      const {done,value} = await rd.read();
      if(done) break;
      const chunk = dec.decode(value,{stream:true});
      for(let line of chunk.split('\n')){
        line = line.trim();
        if(!line || line === '[DONE]') continue;
        if(line.startsWith('data:')) line = line.slice(5).trim();
        try{
          const js = JSON.parse(line);
          const piece = js.choices?.[0]?.delta?.content || '';
          acc += piece;
          onChunk(acc);
        }catch{}
      }
    }
  }

  async function fetchGPT(artist, track){
    const artEl = document.querySelector('.Search_Info');
    const trEl  = document.querySelector('.GPT_Search_Info');
    const alert = document.querySelector('.Achtung_Alert');
    if(!artEl || !trEl) return;
    artEl.textContent = '⏳';
    trEl.textContent  = '';
    alert.style.display = 'none';
    ctl && ctl.abort();
    ctl = new AbortController();
    const prompt = buildPrompt(artist, track);
    try{
      if(useStream){
        await streamGPT(prompt, acc => {
          const {artistText, trackText} = splitSections(acc);
          artEl.innerHTML = md2html(artistText);
          trEl.innerHTML  = md2html(trackText);
        });
      } else {
        const r = await fetch(ENDPOINT, {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({model:useModel, request:{messages:[{role:'user', content:prompt}]}}),
          signal:ctl.signal
        });
        const j = await r.json();
        const txt = j.choices?.[0]?.message?.content || '';
        const {artistText, trackText} = splitSections(txt);
        artEl.innerHTML = md2html(artistText);
        trEl.innerHTML  = md2html(trackText);
      }
      alert.style.display = 'block';
    }catch(e){
      artEl.innerHTML = '<b>Ошибка GPT</b>';
      trEl.textContent = '';
      alert.style.display = 'none';
    }
  }

  async function fetchWiki(query){
    const out = document.querySelector('.Search_Info');
    const alert = document.querySelector('.Achtung_Alert');
    if(!out) return;
    try{
      const url = 'https://ru.wikipedia.org/w/api.php?action=query&format=json&origin=*' +
                  '&titles=' + encodeURIComponent(query) +
                  '&prop=extracts&exintro&explaintext';
      const res = await fetch(url);
      if(!res.ok) throw 0;
      const j = await res.json();
      const page = Object.values(j.query.pages)[0] || {};
      const text = page.extract || 'Информация не найдена';
      out.innerHTML = md2html(text);
      alert.style.display = 'block';
    }catch{
      out.innerHTML = '<b>Ошибка Wiki</b>';
      alert.style.display = 'none';
    }
  }

  // -------------------------------------------------------------
  //  9. Build UI Skeleton
  // -------------------------------------------------------------
  function buildUI(){
    if($root) return;
    $root   = el('div','Spotify_Screen', document.body);
    $bg     = el('div','SM_Background',$root);
    $cover  = el('div','SM_Cover',$root);
    const row = el('div','SM_Title_Line',$root);
    $track  = el('div','SM_Track_Name', row);
    $like   = createLikeClone();
    row.appendChild($like);
    $artist = el('div','SM_Artist',$root);
    const info = el('div','All_Info_Container',$root);
    const art  = el('div','Artist_Info_Container',info);
    el('div','Info_Title',art,'Сведения об исполнителе');
    el('div','Search_Info',art);
    const gpt = el('div','GPT_Info_Container',info);
    el('div','GPT_Info_Title',gpt,'Сведения о треке');
    el('div','GPT_Search_Info',gpt);
    el('div','Achtung_Alert',info,'В сведениях иногда бывают неправильные результаты. Проверяйте информацию подробнее, если изначально вам не всё равно!');
  }

  // -------------------------------------------------------------
  // 10. Update Logic with smart resync
  // -------------------------------------------------------------
  function updateUI(state){
    buildUI();
    // ensure like button clone is fresh
    if(!$origLike || !document.contains($origLike)){
      const fresh = createLikeClone();
      $like.replaceWith(fresh);
      $like = fresh;
    }

    const t = state.track || {};
    const img = t.coverUri ? `https://${t.coverUri.replace('%%','1000x1000')}` : DEFAULT_IMG;
    [$bg,$cover].forEach(n=>{ n.style.background = `url(${img}) center/cover no-repeat`});
    const artistNames = (t.artists || []).map(a=>a.name).join(', ');
    const titleText   = t.title || '';

    // detect mismatch
    const mismatch = ($track.textContent !== titleText) || ($artist.textContent !== artistNames);
    // apply text
    $track.textContent  = titleText;
    $artist.textContent = artistNames;

    // synchronize like state
    syncLikeState();

    // GPT / Wiki fetch
    if(mismatch){
      clearUI();
      if(neuroSearch) fetchGPT(artistNames, titleText);
      else fetchWiki(artistNames || titleText);
    }

    $root.style.display = 'block';
  }

  function clearUI(){
    document.querySelector('.Search_Info')?.replaceChildren();
    document.querySelector('.GPT_Search_Info')?.replaceChildren();
    const alert = document.querySelector('.Achtung_Alert');
    if(alert) alert.style.display = 'none';
  }

  // -------------------------------------------------------------
  // 11. Event bindings
  // -------------------------------------------------------------
  player.on('trackChange', ({state}) => updateUI(state));
  player.on('play',        ({state}) => updateUI(state)); // ensure sync on play

  // initial boot when script loads (if player already playing)
  if(player.state && player.state.track){
    updateUI(player.state);
  }

  // -------------------------------------------------------------
  // 12. Refresh watchdog — fallback in case events are missed
  // -------------------------------------------------------------
  let prevA = '', prevT = '';
  function refresh(){
    const a = player.state.track?.artists?.map(x=>x.name).join(', ') || '';
    const t = player.state.track?.title || '';
    if(a === prevA && t === prevT) return;
    prevA = a;
    prevT = t;
    updateUI(player.state);
  }

  setInterval(refresh, 1500);

})();
