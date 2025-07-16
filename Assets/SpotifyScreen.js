/* НАЧАЛО ТЕМЫ */

const { Theme, UI, SettingsManager } = window.WolfyLibrary;

const SpotColЛичная = new Theme('SpotColЛичная');

SpotColЛичная.stylesManager.add(
  'spotify-like-wrapper',
  `.LikeTrack{flex:0 0 42px;display:flex;align-items:center;justify-content:center;cursor:pointer;top:10px;right:14px}
   @keyframes likePulse{0%{transform:scale(1);}45%{transform:scale(1.25);}100%{transform:scale(1);} }
   .LikeTrack.animate{animation:likePulse .35s ease-out;}`
);

/*_____________________________________________________________________________________________*/
(function(theme){
  let $root,$bg,$cover,$track,$artist,$like,$origLike,observer;
  let prevLiked=null;

  /* UTIL */
  const el=(tag,cls,parent=document.body,txt)=>{const n=document.createElement(tag);n.classList.add(cls);if(txt)n.textContent=txt;parent.appendChild(n);return n;};

  /* LIKE STATE HELPERS */
  const isLiked=node=>{
    if(!node) return false;
    if(node.getAttribute('aria-checked')!==null) return node.getAttribute('aria-checked')==='true';
    return node.classList.contains('Like_active') || !!node.querySelector('svg[class*="_active"],svg[class*="-active"],svg .LikeIcon_active');
  };

  const syncState=()=>{
    if(!$origLike||!$like) return;
    const svgO=$origLike.querySelector('svg');
    const svgC=$like.querySelector('svg');
    if(svgO){ svgC?svgC.replaceWith(svgO.cloneNode(true)):$like.appendChild(svgO.cloneNode(true)); }
    const liked=isLiked($origLike);
    $like.classList.toggle('Like_active',liked);
    if(liked!==prevLiked){
      $like.classList.add('animate');
      setTimeout(()=>{$like&&$like.classList.remove('animate');},350);
      prevLiked=liked;
    }
  };

  const attachObserver=()=>{
    if(observer) observer.disconnect();
    if(!$origLike) return;
    observer=new MutationObserver(syncState);
    observer.observe($origLike,{attributes:true,childList:true,subtree:true});
  };

  const findOriginalLike=()=>{
    const sels=[
      '.FullscreenPlayerDesktopControls_likeButton__vpJ7S[data-test-id="LIKE_BUTTON"]',
      '.PlayerBarDesktop_root__d2Hwi [data-test-id="LIKE_BUTTON"]',
      '[data-test-id="PLAYERBAR_DESKTOP_LIKE_BUTTON"]',
      '[data-test-id="LIKE_BUTTON"]'];
    return sels.map(q=>document.querySelector(q)).find(Boolean)||null;
  };

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

  /* BUILD UI */
  const build=()=>{
    if($root) return;
    const container=document.querySelector('[class*="Content_rootOld"]')?.parentElement||document.body;
    $root=el('div','Spotify_Screen',container);
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

  /* UPDATE SCREEN */
  const update=state=>{
    build();
    if(!$origLike||!document.contains($origLike)){
      const fresh=createClone();
      $like.replaceWith(fresh);$like=fresh;
    }
    const t=state.track||{};
    const img=t.coverUri?`https://${t.coverUri.replace('%%','1000x1000')}`:'http://127.0.0.1:2007/Assets/no-cover-image.png';
    [$bg,$cover].forEach(n=>n.style.background=`url(${img}) center/cover no-repeat`);
    $track.textContent=t.title||'';
    $artist.textContent=(t.artists||[]).map(a=>a.name).join(', ');
    syncState();
    $root.style.display='block';
  };

  /* SUBSCRIBE PLAYER EVENTS */
  theme.player?.on('openPlayer',({state})=>update(state));
  theme.player?.on('trackChange',({state})=>update(state));
})(SpotColЛичная);

/*_____________________________________________________________________________________________*/
/* GPT & WIKI helper */
(() => {
  const sm = SpotColЛичная.settingsManager;
  const modelMap = {1:'searchgpt',2:'gpt-4o-mini',3:'llama-3.3',4:'gemini-2.0-flash',5:'gemini-2.0-flash-mini'};
  let neuroSearch = sm.get('gptSearch')?.value ?? false;
  let useStream   = sm.get('useStream')?.value ?? false;
  let useModel    = modelMap[sm.get('useModel')?.value] || 'gpt-4o-mini';

  sm.onChange('gptSearch', v=>{neuroSearch=v; clearUI(); refresh();});
  sm.onChange('useStream',  v=>{useStream=v; clearUI(); refresh();});
  sm.onChange('useModel',   v=>{useModel=modelMap[v]||useModel; clearUI(); refresh();});

  const selArtist='.SM_Artist';
  const selTrack ='.SM_Track_Name';
  const $=s=>document.querySelector(s);
  const UIbox = () => $('.GPT_Info_Container');
  const UI = {artist:()=>$('.Search_Info'),track:()=>$('.GPT_Search_Info'),alert:()=>$('.Achtung_Alert')};

  function clearUI(){ UI.artist()?.replaceChildren(); UI.track()?.replaceChildren(); const a=UI.alert(); if(a)a.style.display='none'; UIbox()&&(UIbox().style.display='none'); }

  const md2html = md => md?.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\[(.+?)\]\((https?:[^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/^(#{1,6})\s+(.+)$/gm,(_,h,t)=>`<h${h.length}>${t}</h${h.length}>`)
      .replace(/\*\*(.+?)\*\*|__(.+?)__/g,'<strong>$1$2</strong>')
      .replace(/\*(.+?)\*|_(.+?)_/g,'<em>$1$2</em>')
      .replace(/(^|\n)[ \t]*[-*+]\s+(.+)/g,'$1<ul><li>$2</li></ul>')
      .replace(/(^|\n)[ \t]*\d+[.)]\s+(.+)/g,'$1<ol><li>$2</li></ol>')
      .replace(/\r?\n/g,'<br>');

  async function fetchWiki(name){const out=UI.artist(),alert=UI.alert();if(!out) return;try{const url=`https://ru.wikipedia.org/w/api.php?action=query&format=json&origin=*&titles=${encodeURIComponent(name)}&prop=extracts&exintro&explaintext`;const j=await fetch(url).then(r=>r.json());const page=Object.values(j.query.pages)[0]||{};out.innerHTML=md2html(page.extract||'Информация не найдена');alert.style.display='block';}catch{out.innerHTML='<b>Ошибка Wiki</b>';alert.style.display='none';}}

  const endpoint='https://api.onlysq.ru/ai/v2'; let ctl=null;
  const buildPrompt=(a,t)=>[`Ты всегда должен писать на русском`,`Ты — музыкальный справочник`,`=== Артист ===`,a||'—',``,`=== Трек ===`,t?`${a} — ${t}`:'—'].join('\n');
  const splitSections=txt=>{const reA=/===\s*(Артист|Artist)\s*===/i,reT=/===\s*(Трек|Track|Song)\s*===/i;const aIdx=txt.search(reA),tIdx=txt.search(reT);let a='',t='';if(aIdx>=0&&tIdx>=0){aIdx<tIdx?(a=txt.slice(aIdx,tIdx),t=txt.slice(tIdx)):(t=txt.slice(tIdx,aIdx),a=txt.slice(aIdx));}else if(aIdx>=0){a=txt.slice(aIdx);}else if(tIdx>=0){t=txt.slice(tIdx);}else a=txt;return{artistText:a.replace(reA,'').trim(),trackText:t.replace(reT,'').trim()};};
  async function fetchGPT(a,t){const artEl=UI.artist(),trEl=UI.track(),alert=UI.alert();if(!artEl||!trEl)return;UIbox()&&(UIbox().style.display='block');artEl.textContent='⏳';trEl.textContent='';ctl&&ctl.abort();ctl=new AbortController();const prompt=buildPrompt(a,t);try{const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:useModel,request:{messages:[{role:'user',content:prompt}]}}),signal:ctl.signal});const j=await res.json();const txt=j.choices?.[0]?.message?.content||'';const {artistText,trackText}=splitSections(txt);artEl.innerHTML=md2html(artistText);trEl.innerHTML=md2html(trackText);alert.style.display='block';}catch{artEl.innerHTML='<b>Ошибка GPT</b>';trEl.innerHTML='';alert.style.display='none';}}

  let prevA='',prevT='';
  function refresh(){const a=($(selArtist)?.textContent||'').trim();const t=($(selTrack)?.textContent||'').trim();if(!a&&!t)return;if(a===prevA&&t===prevT)return;prevA=a;prevT=t;clearUI();neuroSearch?fetchGPT(a,t):fetchWiki(a||t);}refresh();setInterval(refresh,1200);
})();

/*_____________________________________________________________________________________________*/

SpotColЛичная.start(1000);
