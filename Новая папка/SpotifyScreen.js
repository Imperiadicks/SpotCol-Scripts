/* НАЧАЛО ТЕМЫ */
const SpotColЛичная = new Theme('SpotColЛичная');

/* — Стили для лайка — */
SpotColЛичная.stylesManager.add('spotify-like-wrapper', `
  .LikeTrack{flex:0 0 42px;display:flex;align-items:center;justify-content:center;cursor:pointer;top:10px;right:14px}
  @keyframes likePulse{0%{transform:scale(1);}45%{transform:scale(1.25);}100%{transform:scale(1);} }
  .LikeTrack.animate{animation:likePulse .35s ease-out;}
`);

/* —————————————————— VISUAL & LIKE —————————————————— */
(function(theme){
  let $root,$bg,$cover,$track,$artist,$like,$origLike,observer,prevLiked=null;

  const isLiked = n => n?.getAttribute('aria-checked')==='true'
                    || n?.classList.contains('Like_active')
                    || !!n?.querySelector('svg[class*="_active"],svg[class*="-active"],svg .LikeIcon_active"');

  const syncState = ()=>{
    if(!$origLike||!$like) return;
    const svgO=$origLike.querySelector('svg'),
          svgC=$like.querySelector('svg');
    if(svgO){ svgC?svgC.replaceWith(svgO.cloneNode(true)):$like.append(svgO.cloneNode(true)); }

    const liked=isLiked($origLike);
    $like.classList.toggle('Like_active',liked);
    if(liked!==prevLiked){
      $like.classList.add('animate');
      setTimeout(()=> $like?.classList.remove('animate'),350);
      prevLiked=liked;
    }
  };

  const attachObserver=()=>{
    observer?.disconnect();
    if(!$origLike) return;
    observer=new MutationObserver(syncState);
    observer.observe($origLike,{attributes:true,childList:true,subtree:true});
  };

  const findOriginalLike=()=>[
    '.FullscreenPlayerDesktopControls_likeButton__vpJ7S[data-test-id="LIKE_BUTTON"]',
    '.PlayerBarDesktop_root__d2Hwi [data-test-id="LIKE_BUTTON"]',
    '[data-test-id="PLAYERBAR_DESKTOP_LIKE_BUTTON"]',
    '[data-test-id="LIKE_BUTTON"]'
  ].map(q=>document.querySelector(q)).find(Boolean)||null;

  const createClone=()=>{
    $origLike=findOriginalLike(); prevLiked=null;
    if(!$origLike) return el('div','LikeTrack');
    const clone=$origLike.cloneNode(true);
    clone.classList.add('LikeTrack');
    clone.removeAttribute('data-test-id');
    clone.onclick=()=> $origLike.click();
    attachObserver();
    syncState();
    return clone;
  };

  const el=(tag,cls,p=document.body,txt)=>{
    const n=document.createElement(tag); n.classList.add(cls); if(txt) n.textContent=txt; p.appendChild(n); return n;
  };

  const build=()=>{
    if($root) return;
    $root = el('div','Spotify_Screen');
    $bg   = el('div','SM_Background',$root);
    $cover= el('div','SM_Cover',$root);

    const row=el('div','SM_Title_Line',$root);
    $track = el('div','SM_Track_Name',row);
    $like  = createClone(); row.appendChild($like);
    $artist= el('div','SM_Artist',$root);

    const info=el('div','All_Info_Container',$root),
          art =el('div','Artist_Info_Container',info),
          gpt =el('div','GPT_Info_Container',info);
    el('div','Info_Title',art,'Сведения об исполнителе');
    el('div','Search_Info',art);
    el('div','GPT_Info_Title',gpt,'Сведения о треке');
    el('div','GPT_Search_Info',gpt);
    el('div','Achtung_Alert',info,'В сведениях иногда бывают неправильные результаты. Проверяйте информацию подробнее, если изначально вам не всё равно!');
  };

  const update=state=>{
    build();
    if(!$origLike||!document.contains($origLike)){ const n=createClone(); $like.replaceWith(n); $like=n; }
    const t=state.track||{}, img=t.coverUri?`https://${t.coverUri.replace('%%','1000x1000')}`:'http://127.0.0.1:2007/Assets/no-cover-image.png';
    [$bg,$cover].forEach(n=>n.style.background=`url(${img}) center/cover no-repeat`);
    $track.textContent=t.title||'';
    $artist.textContent=(t.artists||[]).map(a=>a.name).join(', ');
    syncState(); $root.style.display='block';
  };

  /* player события (если theme.player есть) */
  if (theme.player) {
    theme.player.on('trackChange',({state})=>update(state));
    theme.player.on('play',       ({state})=>update(state));
    if(theme.player.state?.track) update(theme.player.state);
  }
})(SpotColЛичная);

/* —————————————————— GPT / WIKI helper —————————————————— */
(() => {
  const sm = SpotColЛичная.settingsManager;
  const modelMap = {1:'searchgpt',2:'gpt-4o-mini',3:'llama-3.3',4:'gemini-2.0-flash',5:'gemini-2.0-flash-mini'};
  let neuro = sm.get('gptSearch')?.value ?? false,
      useS  = sm.get('useStream')?.value ?? false,
      model = modelMap[Number(sm.get('useModel')?.value)] || 'gpt-4o-mini';

  sm.onChange('gptSearch',v=>(neuro=v,clearUI(),refresh()));
  sm.onChange('useStream',v=>(useS =v,clearUI(),refresh()));
  sm.onChange('useModel', v=>(model=modelMap[Number(v)]||model,clearUI(),refresh()));

  /* DOM селекторы */
  const selA='.SM_Artist', selT='.SM_Track_Name', $=s=>document.querySelector(s);
  const UI={ artist:()=>$('.Search_Info'), track:()=>$('.GPT_Search_Info'), alert:()=>$('.Achtung_Alert'), box:()=>$('.GPT_Info_Container') };

  const md = x=>x.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                 .replace(/\\[(.+?)\\]\\((https?:[^)]+)\\)/g,'<a href=\"$2\" target=\"_blank\" rel=\"noopener\">$1</a>')
                 .replace(/^(#{1,6})\\s+(.+)$/gm,(_,h,t)=>`<h${h.length}>${t}</h${h.length}>`)
                 .replace(/\\*\\*(.+?)\\*\\*|__(.+?)__/g,'<strong>$1$2</strong>')
                 .replace(/\\*(.+?)\\*|_(.+?)_/g,'<em>$1$2</em>')
                 .replace(/\\r?\\n/g,'<br>');

  /* Wiki fetch */
  const wiki = async q=>{
    const box=UI.artist(), a=UI.alert(); if(!box) return;
    try{
      const u='https://ru.wikipedia.org/w/api.php?action=query&format=json&origin=*'+'&titles='+encodeURIComponent(q)+'&prop=extracts&exintro&explaintext';
      const j=await (await fetch(u)).json(), page=Object.values(j.query.pages)[0]||{};
      box.innerHTML=md(page.extract||'Информация не найдена'); a.style.display='block';
    }catch{ box.innerHTML='<b>Ошибка Wiki</b>'; a.style.display='none'; }
  };

  /* GPT fetch */
  const END='https://api.onlysq.ru/ai/v2', reA=/===\\s*(Артист|Artist|Исполнитель)\\s*===/i, reT=/===\\s*(Трек|Track|Song|Песня)\\s*===/i;
  const split=t=>{const a=t.search(reA),b=t.search(reT);let A='',B=''; if(a>=0&&b>=0){a<b?(A=t.slice(a,b),B=t.slice(b)):(B=t.slice(b,a),A=t.slice(a));}else if(a>=0)A=t.slice(a);else if(b>=0)B=t.slice(b);else A=t;return{a:A.replace(reA,'').trim(),t:B.replace(reT,'').trim()};};
  let ctl=null;

  const gpt=async(art,tr)=>{
    const A=UI.artist(), T=UI.track(), al=UI.alert(); if(!A||!T) return;
    A.textContent='⏳'; T.textContent=''; al.style.display='none';
    ctl?.abort(); ctl=new AbortController();
    const prompt=['Всегда отвечай по-русски без эмодзи.','=== Артист ===',art||'—','','=== Трек ===',art?`${art} — ${tr}`:tr||'—'].join('\\n');

    const put=txt=>{ const {a,t}=split(txt); A.innerHTML=md(a); T.innerHTML=md(t); };
    try{
      if(useS){
        const r=await fetch(END,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,request:{messages:[{role:'user',content:prompt}],stream:true}}),signal:ctl.signal});
        const rd=r.body.getReader(), dec=new TextDecoder(); let acc='';
        while(true){const {done,value}=await rd.read(); if(done)break;
          for(let l of dec.decode(value,{stream:true}).split('\\n')){
            if(!(l=l.trim())||l==='[DONE]')continue;
            if(l.startsWith('data:'))l=l.slice(5).trim();
            try{const js=JSON.parse(l);acc+=js.choices?.[0]?.delta?.content||'';put(acc);}catch{}
          }
        }
      }else{
        const j=await (await fetch(END,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,request:{messages:[{role:'user',content:prompt}]}}),signal:ctl.signal})).json();
        put(j.choices?.[0]?.message?.content||'');
      }
      al.style.display='block';
    }catch{A.innerHTML='<b>Ошибка GPT</b>';T.textContent='';}
  };

  const clearUI=()=>{ UI.artist()?.replaceChildren(); UI.track()?.replaceChildren(); const a=UI.alert(); if(a) a.style.display='none'; };

  /* refresh */
  let pA='',pT='';
  const refresh=()=>{
    const a=($(selA)?.textContent||'').trim(), t=($(selT)?.textContent||'').trim();
    if(!a&&!t) return;
    if(a===pA&&t===pT) return;
    pA=a; pT=t; clearUI(); neuro ? gpt(a,t) : wiki(a||t);
  };
  refresh(); setInterval(refresh,1200);
})();

/* ————————————————————————————————— */
SpotColЛичная.start?.(1000);
