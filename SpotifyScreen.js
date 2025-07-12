/*  SpotifyScreen.js  •  rev-2025-07-12
 *  Зависит от WolfyLibrary ≥ v4.1
 *  ───────────────────────────────────────────────────────── */

(function () {
  'use strict';
  const dbg = (...a) => { if (window.__WOLFY_DEBUG__) console.log('[SpotifyScreen]', ...a); };

  /* === 1. THEME === */
  const theme = window.Imperiadicks instanceof Theme
    ? window.Imperiadicks
    : new Theme(Theme.getThemeId());
  window.Imperiadicks = theme;

  const sm     = theme.settingsManager;
  const styles = theme.stylesManager;
  const player = theme.player;

  /* === 2. SETTINGS === */
  const modelMap = {
    1: 'searchgpt',
    2: 'gpt-4o-mini',
    3: 'llama-3.3',
    4: 'gemini-2.0-flash',
    5: 'gemini-2.0-flash-mini'
  };
  let neuroSearch = sm.get('gptSearch')?.value ?? false;
  let useStream   = sm.get('useStream')?.value ?? false;
  let useModel    = modelMap[Number(sm.get('useModel')?.value)] || 'searchgpt';

  sm.onChange('gptSearch', v => (neuroSearch = v, dbg('gptSearch',v)));
  sm.onChange('useStream', v => (useStream   = v, dbg('useStream',v)));
  sm.onChange('useModel',  v => (useModel    = modelMap[Number(v)]||useModel, dbg('useModel',useModel)));

  /* === 3. LIKE-CLONE STYLES === */
  styles.add('like-wrapper', `
.LikeTrack{flex:0 0 42px;display:flex;align-items:center;justify-content:center;cursor:pointer}
@keyframes likePulse{0%{transform:scale(1);}45%{transform:scale(1.25);}100%{transform:scale(1);}}
.LikeTrack.animate{animation:likePulse .35s ease-out;}
`);

  /* === 4. LIKE-CLONE LOGIC === */
  let $like,$origLike,likeObs,prevLiked=null;

  const queryLike = [
    '.FullscreenPlayerDesktopControls_likeButton__vpJ7S[data-test-id=\"LIKE_BUTTON\"]',
    '.PlayerBarDesktop_root__d2Hwi [data-test-id=\"LIKE_BUTTON\"]',
    '[data-test-id=\"PLAYERBAR_DESKTOP_LIKE_BUTTON\"]',
    '[data-test-id=\"LIKE_BUTTON\"]'
  ];

  const findOrig = () => queryLike.map(q=>document.querySelector(q)).find(Boolean) || null;
  const isLiked  = n =>
       n?.getAttribute('aria-checked')==='true'
    || n?.classList.contains('Like_active')
    || !!n?.querySelector('svg[class*=\"_active\"],svg[class*=\"-active\"],svg .LikeIcon_active');

  const syncLike = () => {
    if(!$origLike||!$like) return;
    const src=$origLike.querySelector('svg'), dst=$like.querySelector('svg');
    if(src){ dst?dst.replaceWith(src.cloneNode(true)):$like.append(src.cloneNode(true)); }
    const liked=isLiked($origLike);
    $like.classList.toggle('Like_active',liked);
    if(liked!==prevLiked){ $like.classList.add('animate'); setTimeout(()=> $like?.classList.remove('animate'),350); }
    prevLiked=liked;
  };

  const observeOrig = () => {
    likeObs?.disconnect();
    if(!$origLike) return;
    likeObs=new MutationObserver(syncLike);
    likeObs.observe($origLike,{attributes:true,childList:true,subtree:true});
  };

  const makeClone = () => {
    $origLike=findOrig(); prevLiked=null;
    if(!$origLike) return Object.assign(document.createElement('div'),{className:'LikeTrack'});
    const c=$origLike.cloneNode(true);
    c.classList.add('LikeTrack'); c.removeAttribute('data-test-id');
    c.onclick = ()=> $origLike.click();
    observeOrig(); syncLike();
    return c;
  };

  /* === 5. DOM BUILD === */
  const ENDPOINT  = 'https://api.onlysq.ru/ai/v2';
  const NO_COVER  = 'http://127.0.0.1:2007/Assets/no-cover-image.png';
  const reA=/===\\s*(Артист|Artist|Исполнитель)\\s*===/i, reT=/===\\s*(Трек|Track|Song|Песня)\\s*===/i;

  let $root,$bg,$cover,$track,$artist;
  const el=(t,c,p=document.body,txt)=>{const n=document.createElement(t); if(c)n.className=c; if(txt)n.textContent=txt; p.appendChild(n); return n;};

  function buildUI(){
    if($root) return;
    $root  = el('div','Spotify_Screen');
    $bg    = el('div','SM_Background',$root);
    $cover = el('div','SM_Cover',$root);

    const row = el('div','SM_Title_Line',$root);
    $track = el('div','SM_Track_Name',row);
    $like  = makeClone(); row.appendChild($like);
    $artist= el('div','SM_Artist',$root);

    const info=el('div','All_Info_Container',$root),
          art =el('div','Artist_Info_Container',info),
          gpt =el('div','GPT_Info_Container',info);
    el('div','Info_Title',art,'Сведения об исполнителе');
    el('div','Search_Info',art);
    el('div','GPT_Info_Title',gpt,'Сведения о треке');
    el('div','GPT_Search_Info',gpt);
    el('div','Achtung_Alert',info,'Информация может содержать ошибки.');
  }

  /* === 6. HELPER === */
  const md2html = md=>md
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\\[(.+?)\\]\\((https?:[^)]+)\\)/g,'<a href=\"$2\" target=\"_blank\">$1</a>')
    .replace(/^(#{1,6})\\s+(.+)$/gm,(_,h,t)=>`<h${h.length}>${t}</h${h.length}>`)
    .replace(/\\*\\*(.+?)\\*\\*|__(.+?)__/g,'<strong>$1$2</strong>')
    .replace(/\\*(.+?)\\*|_(.+?)_/g,'<em>$1$2</em>')
    .replace(/\\r?\\n/g,'<br>');

  const split = txt=>{
    const ai=txt.search(reA), ti=txt.search(reT); let a='',t='';
    if(ai>=0&&ti>=0){ ai<ti?(a=txt.slice(ai,ti),t=txt.slice(ti)):(t=txt.slice(ti,ai),a=txt.slice(ai));}
    else if(ai>=0) a=txt.slice(ai); else if(ti>=0) t=txt.slice(ti); else a=txt;
    return { artist:a.replace(reA,'').trim(), track:t.replace(reT,'').trim() };
  };

  /* === 7. GPT / WIKI FETCH === */
  const wiki = async q=>{
    const box=document.querySelector('.Search_Info'), alert=document.querySelector('.Achtung_Alert');
    if(!box) return;
    try{
      const u='https://ru.wikipedia.org/w/api.php?action=query&format=json&origin=*'+'&titles='+encodeURIComponent(q)+'&prop=extracts&exintro&explaintext';
      const r=await fetch(u); const j=await r.json(); const page=Object.values(j.query.pages)[0]||{};
      box.innerHTML=md2html(page.extract||'Информация не найдена'); alert.style.display='block';
    }catch{ box.innerHTML='<b>Ошибка Wiki</b>'; alert.style.display='none'; }
  };

  const streamGPT = async (prompt,onChunk)=>{
    const res=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:useModel,request:{messages:[{role:'user',content:prompt}],stream:true}})});
    const rd=res.body.getReader(), dec=new TextDecoder(); let acc='';
    while(true){ const {done,value}=await rd.read(); if(done) break;
      for(let line of dec.decode(value,{stream:true}).split('\\n')){
        if(!(line=line.trim())||line==='[DONE]') continue;
        if(line.startsWith('data:')) line=line.slice(5).trim();
        try{const js=JSON.parse(line); acc+=js.choices?.[0]?.delta?.content||''; onChunk(acc);}catch{}
      }
    }
  };

  const gpt = async (a,t)=>{
    const art=document.querySelector('.Search_Info'), tr=document.querySelector('.GPT_Search_Info'), alert=document.querySelector('.Achtung_Alert');
    if(!art||!tr) return;
    art.textContent='⏳'; tr.textContent=''; alert.style.display='none';
    const prompt=['Всегда отвечай по-русски без эмодзи.','=== Артист ===',a||'—','','=== Трек ===', a?`${a} — ${t}`:t||'—'].join('\\n');
    try{
      if(useStream){
        await streamGPT(prompt,txt=>{ const {artist,track}=split(txt); art.innerHTML=md2html(artist); tr.innerHTML=md2html(track); });
      }else{
        const r=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:useModel,request:{messages:[{role:'user',content:prompt}]}})});
        const {artist,track}=split((await r.json()).choices?.[0]?.message?.content||'');
        art.innerHTML=md2html(artist); tr.innerHTML=md2html(track);
      }
      alert.style.display='block';
    }catch{ art.innerHTML='<b>Ошибка GPT</b>'; tr.textContent=''; }
  };

  /* === 8. UPDATE UI === */
  function update(st){
    buildUI();
    if(!$origLike||!document.contains($origLike)){ const c=makeClone(); $like.replaceWith(c); $like=c; }
    const t=st.track||{}, img=t.coverUri?`https://${t.coverUri.replace('%%','1000x1000')}`:NO_COVER;
    [$bg,$cover].forEach(n=>n.style.background=`url(${img}) center/cover no-repeat`);
    const art=(t.artists||[]).map(x=>x.name).join(', '), ttl=t.title||'';
    const changed=$track.textContent!==ttl||$artist.textContent!==art;
    $track.textContent=ttl; $artist.textContent=art; syncLike();
    if(changed){ neuroSearch?gpt(art,ttl):wiki(art||ttl); }
    $root.style.display='block';
  }

  /* === 9. EVENTS + POLL === */
  player.on('trackChange',({state})=>update(state));
  player.on('play',       ({state})=>update(state));
  if(player.state?.track) update(player.state);

  let pa='',pt='';
  setInterval(()=>{ const a=player.state.track?.artists?.map(x=>x.name).join(', ')||'', t=player.state.track?.title||''; if(a!==pa||t!==pt){ pa=a;pt=t; update(player.state);} },1500);
})();
