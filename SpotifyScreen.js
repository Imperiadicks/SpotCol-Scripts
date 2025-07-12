(function () {
  'use strict';
  /*  SpotifyScreen.js  (2025-07-12, GPT-fixed)  */

  /*────────────────── 1. Bootstrap Imperiadicks ──────────────────*/
  if (!window.Theme) window.Theme = {};
  const theme = window.Imperiadicks instanceof Theme
    ? window.Imperiadicks
    : new Theme(Theme.getThemeId());
  window.Imperiadicks = theme;

  const sm     = theme.settingsManager;
  const styles = theme.stylesManager;
  const player = theme.player;

  /*────────────────── 2. Константы + runtime ────────────────────*/
  const ENDPOINT    = 'https://api.onlysq.ru/ai/v2';
  const DEFAULT_IMG = 'http://127.0.0.1:2007/Assets/no-cover-image.png';

  let neuroSearch = sm.get('gptSearch')?.value ?? false;
  let useStream   = sm.get('useStream')?.value ?? false;
  let useModel    = 'searchgpt';      // рабочая модель

  sm.on('change:gptSearch', ({settings}) => { neuroSearch = settings.get('gptSearch').value; refresh(); });
  sm.on('change:useStream', ({settings}) => { useStream   = settings.get('useStream').value; refresh(); });
  sm.on('change:useModel',  ({settings}) => { useModel    = settings.get('useModel').value || useModel; });

  /*────────────────── 3. DOM helpers ────────────────────────────*/
  function el(tag, cls, par = document.body, txt) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined) n.textContent = txt;
    par.appendChild(n);
    return n;
  }
  function md2html(md = '') {
    return md.replace(/&/g,'&amp;').replace(/</g,'&lt;')
             .replace(/>/g,'&gt;')
             .replace(/\[(.+?)\]\((https?:[^)]+)\)/g,'<a href="$2" target="_blank">$1</a>')
             .replace(/^(#{1,6})\s+(.+)$/gm,(_,h,t)=>`<h${h.length}>${t}</h${h.length}>`)
             .replace(/\*\*(.+?)\*\*|__(.+?)__/g,'<strong>$1$2</strong>')
             .replace(/\*(.+?)\*|_(.+?)_/g,'<em>$1$2</em>')
             .replace(/\r?\n/g,'<br>');
  }

  /*────────────────── 4. Like-button helpers ────────────────────*/
  let $root,$bg,$cover,$track,$artist,$like,$origLike,likeObs;
  styles.add('imp-like',`
    .LikeTrack{flex:0 0 42px;display:flex;align-items:center;justify-content:center;cursor:pointer}
    @keyframes pulse{0%{transform:scale(1)}45%{transform:scale(1.25)}100%{transform:scale(1)}}
    .LikeTrack.animate{animation:pulse .35s ease-out}
  `);
  function isLiked(n){return n?.getAttribute('aria-checked')==='true'||
    n?.classList.contains('Like_active')||
    !!n?.querySelector('svg[class*="_active"]');}
  function syncLike(){
    if(!$origLike||!$like) return;
    const src=$origLike.querySelector('svg'),
          dst=$like.querySelector('svg');
    if(src){ dst?dst.replaceWith(src.cloneNode(true)):$like.append(src.cloneNode(true)); }
    const liked=isLiked($origLike), prev=$like.dataset.prev==='1';
    $like.classList.toggle('Like_active',liked);
    if(liked!==prev){ $like.classList.add('animate'); setTimeout(()=> $like?.classList.remove('animate'),350);}
    $like.dataset.prev = liked?'1':'0';
  }
  function findLike(){
    return ['.FullscreenPlayerDesktopControls_likeButton__vpJ7S[data-test-id="LIKE_BUTTON"]',
            '.PlayerBarDesktop_root__d2Hwi [data-test-id="LIKE_BUTTON"]',
            '[data-test-id="PLAYERBAR_DESKTOP_LIKE_BUTTON"]',
            '[data-test-id="LIKE_BUTTON"]']
           .map(q=>document.querySelector(q)).find(Boolean)||null;
  }
  function cloneLike(){
    $origLike=findLike(); if(!$origLike) return el('div','LikeTrack');
    const c=$origLike.cloneNode(true); c.classList.add('LikeTrack'); c.removeAttribute('data-test-id');
    c.onclick=()=>{$origLike.click();};
    likeObs?.disconnect(); likeObs=new MutationObserver(syncLike); likeObs.observe($origLike,{attributes:true,childList:true,subtree:true});
    syncLike(); return c;
  }

  /*────────────────── 5. Wiki / GPT ─────────────────────────────*/
  const RE_A=/===\s*(Артист|Artist|Исполнитель)\s*===/i, RE_T=/===\s*(Трек|Track|Song|Песня)\s*===/i;
  function split(txt){
    const ai=txt.search(RE_A),ti=txt.search(RE_T); let a='',t='';
    if(ai>=0&&ti>=0){ ai<ti?(a=txt.slice(ai,ti),t=txt.slice(ti)):(t=txt.slice(ti,ai),a=txt.slice(ai)); }
    else if(ai>=0) a=txt.slice(ai); else if(ti>=0) t=txt.slice(ti); else a=txt;
    return {artist: a.replace(RE_A,'').trim(), track: t.replace(RE_T,'').trim()};
  }
  async function fetchWiki(q){
    const elA=document.querySelector('.Search_Info'), alert=document.querySelector('.Achtung_Alert');
    if(!elA) return;
    try{
      const u='https://ru.wikipedia.org/w/api.php?action=query&format=json&origin=*'+'&titles='+encodeURIComponent(q)+'&prop=extracts&exintro&explaintext';
      const r=await fetch(u); if(!r.ok) throw 0; const j=await r.json();
      const p=Object.values(j.query.pages)[0]||{}, text=p.extract||'Информация не найдена';
      elA.innerHTML=md2html(text); alert.style.display='block';
    }catch{ elA.innerHTML='<b>Ошибка Wiki</b>'; alert.style.display='none';}
  }
  async function fetchGPT(art,trk){
    const elA=document.querySelector('.Search_Info'), elT=document.querySelector('.GPT_Search_Info'), alert=document.querySelector('.Achtung_Alert');
    if(!elA||!elT) return;
    elA.textContent='⏳ ChatGPT…'; elT.textContent=''; alert.style.display='none';
    const prompt=[
      'Всегда отвечай по-русски без эмодзи.',
      '=== Артист ===', art||'—','',
      '=== Трек ===',   art ? `${art} — ${trk}` : trk||'—'
    ].join('\n');
    try{
      const r=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({model:useModel,request:{messages:[{role:'user',content:prompt}]}})});
      if(!r.ok) throw 0; const j=await r.json();
      const txt=j.choices?.[0]?.message?.content||'Информация не найдена';
      const {artist,track}=split(txt);
      elA.innerHTML=md2html(artist); elT.innerHTML=md2html(track); alert.style.display='block';
    }catch{ elA.innerHTML='<b>Ошибка GPT</b>'; elT.textContent=''; }
  }

  /*────────────────── 6. UI ─────────────────────────────────────*/
  function buildUI(){
    if($root) return;
    $root = el('div','Spotify_Screen');
    $bg   = el('div','SM_Background',$root);
    $cover= el('div','SM_Cover',$root);
    const row=el('div','SM_Title_Line',$root);
    $track= el('div','SM_Track_Name',row);
    $like = cloneLike(); row.appendChild($like);
    $artist=el('div','SM_Artist',$root);

    const info=el('div','All_Info_Container',$root),
          art =el('div','Artist_Info_Container',info),
          gpt =el('div','GPT_Info_Container',info);
    el('div','Info_Title',art,'Сведения об исполнителе');
    el('div','Search_Info',art);
    el('div','GPT_Info_Title',gpt,'Сведения о треке');
    el('div','GPT_Search_Info',gpt);
    el('div','Achtung_Alert',info,'Информация может содержать ошибки.');
  }
  function clearUI(){
    document.querySelector('.Search_Info')?.replaceChildren();
    document.querySelector('.GPT_Search_Info')?.replaceChildren();
    const a=document.querySelector('.Achtung_Alert'); if(a) a.style.display='none';
  }
  theme.on('clear-screen', clearUI);

  function updateUI(st){
    buildUI();
    if(!$origLike||!document.contains($origLike)){ const fresh=cloneLike(); $like.replaceWith(fresh); $like=fresh; }
    const t=st.track||{}, img=t.coverUri?`https://${t.coverUri.replace('%%','1000x1000')}`:DEFAULT_IMG;
    [$bg,$cover].forEach(n=>n.style.background=`url(${img}) center/cover no-repeat`);
    const art=(t.artists||[]).map(a=>a.name).join(', '), ttl=t.title||'';
    const changed= $track.textContent!==ttl || $artist.textContent!==art;
    $track.textContent=ttl; $artist.textContent=art; syncLike();
    if(changed){ clearUI(); neuroSearch?fetchGPT(art,ttl):fetchWiki(art||ttl); }
    $root.style.display='block';
  }

  /*────────────────── 7. Player events ─────────────────────────*/
  player.on('trackChange',({state})=>updateUI(state));
  player.on('play',({state})=>updateUI(state));
  if(player.state?.track) updateUI(player.state);

  /*────────────────── 8. Fallback refresh ──────────────────────*/
  let pa='',pt=''; setInterval(()=>{
    const a=player.state.track?.artists?.map(x=>x.name).join(', ')||'',
          t=player.state.track?.title||'';
    if(a!==pa||t!==pt){ pa=a; pt=t; updateUI(player.state); }
  },1600);
})();
