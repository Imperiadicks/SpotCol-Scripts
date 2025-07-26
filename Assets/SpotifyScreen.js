const SpotColЛичная = window.Theme;
console.log("проверка SPOTIFYSCREEN 4")
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
   

/*_____________________________________________________________________________________________*/


     const isLiked=node=>{
       if(!node) return false;
       if(node.getAttribute('aria-checked')!==null) return node.getAttribute('aria-checked')==='true';
       return node.classList.contains('Like_active') || !!node.querySelector('svg[class*="_active"],svg[class*="-active"],svg .LikeIcon_active');
     };

/*_____________________________________________________________________________________________*/


     const syncState=()=>{
       if(!$origLike||!$like) return;
       const svgO=$origLike.querySelector('svg');
       const svgC=$like.querySelector('svg');
       if(svgO){
         svgC?svgC.replaceWith(svgO.cloneNode(true)):$like.appendChild(svgO.cloneNode(true));
       }

/*_____________________________________________________________________________________________*/
       const liked=isLiked($origLike);
       $like.classList.toggle('Like_active',liked);
       if(liked!==prevLiked){
         $like.classList.add('animate');
         setTimeout(()=>{$like&&$like.classList.remove('animate');},350);
         prevLiked=liked;
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


     const createClone=()=>{
       $origLike=findOriginalLike();
       prevLiked=null;
       if(!$origLike) return el('div','LikeTrack');
       const clone=$origLike.cloneNode(true);
       clone.classList.add('LikeTrack');
       clone.removeAttribute('data-test-id');
       clone.addEventListener('click',()=>{$origLike.click();});
       attachObserver();
       syncState();
       return clone;
     };

/*_____________________________________________________________________________________________*/


     const build=()=>{
       if($root) return;
       $root=el('div','Spotify_Screen',document.body);
       $bg  =el('div','SM_Background',$root);
       $cover=el('div','SM_Cover',$root);
       const row=el('div','SM_Title_Line',$root);
       $track=el('div','SM_Track_Name',row);
       $like =createClone();
       row.appendChild($like);
       $artist=el('div','SM_Artist',$root);
       const info =el('div','All_Info_Container',$root);
       const art  =el('div','Artist_Info_Container',info);
       el('div','Info_Title',art,'Сведения об исполнителе');
       el('div','Search_Info',art);
       const gpt =el('div','GPT_Info_Container',info);
       el('div','GPT_Info_Title',gpt,'Сведения о треке');
       el('div','GPT_Search_Info',gpt);
       el('div','Achtung_Alert',info,'В сведениях иногда бывают неправильные результаты. Проверяйте информацию подробнее, если изначально вам не всё равно!');
     };

/*_____________________________________________________________________________________________*/


     const update=state=>{
       build();
       if(!$origLike||!document.contains($origLike)){
         const fresh=createClone();
         $like.replaceWith(fresh);$like=fresh;
       }

/*_____________________________________________________________________________________________*/


       const t=state.track||{};
       const img=t.coverUri?`https://${t.coverUri.replace('%%','1000x1000')}`:'http://127.0.0.1:2007/Assets/no-cover-image.png';
       [$bg,$cover].forEach(n=>n.style.background=`url(${img}) center/cover no-repeat`);
       $track.textContent=t.title||'';
       $artist.textContent=(t.artists||[]).map(a=>a.name).join(', ');
       syncState();
       $root.style.display='block';
     };

/*_____________________________________________________________________________________________*/


     theme.sonataState.on('openPlayer',({state})=>update(state));
     theme.sonataState.on('trackChange',({state})=>update(state));
   
     function el(tag,cls,parent=document.body,txt){const n=document.createElement(tag);n.classList.add(cls);if(txt)n.textContent=txt;parent.appendChild(n);return n;}
   })(SpotColЛичная);
   
/*_____________________________________________________________________________________________*/

/*_____________________________________________________________________________________________*/
/*
 * SpotColЛичная — GPT / Wiki helper (rev‑2025‑05‑11‑i2)
 * Полностью завершённый скрипт без ссылок; устойчив к изменениям DOM/настроек.
 */

(() => {
  /* === SETTINGS === */
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
})();


/*_____________________________________________________________________________________________*/



setTimeout(() => {
  try {
  const screen = document.querySelector('.Spotify_Screen');
  if (!screen || !screen.classList.contains('SpotCol_Inserted')) {
    console.log('[SpotifyScreen] Вставка вручную');
    SpotColЛичная.player.emit('openPlayer', { state: SpotColЛичная.player.state });
  }
  } catch (e) {
    console.warn('[SpotifyScreen] Ошибка ручной вставки:', e);
  }
}, 3000);
console.log('[SpotifyScreen] Пробуем build вручную', screen);
if (SpotColЛичная.player && SpotColЛичная.player.on) {
  SpotColЛичная.player.on('openPlayer', ({ state }) => update(state));
  SpotColЛичная.player.on('trackChange', ({ state }) => update(state));
} else {
  console.warn('[SpotifyScreen] Нет доступа к SpotColЛичная.player');
}

  SpotColЛичная.start(1000)
