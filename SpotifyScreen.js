(function () {
  /*
   * SpotifyScreen.js — full rewrite 2025-07-12 (≈ 460 lines)
   * Интеграция с Imperiadicks library:
   *   • bus и emit('clear-screen') → подписка здесь
   *   • лайк-кнопка клонируется и синхронизируется
   *   • Wiki работает, GPT пока в заглушке
   * Каждая функция логирует своё имя.
   */

  'use strict';
  console.log('[SpotifyScreen] 🟢 Старт модуля Imperiadicks::SpotifyScreen');

  /*──────────────────────────────────────────────────────────────────*/
  /* 1. Bootstrap: получаем themeInstance, менеджеры                 */
  /*──────────────────────────────────────────────────────────────────*/
  if (!window.Theme) window.Theme = {};
  const themeInstance = window.SpotColЛичная instanceof Theme
    ? window.SpotColЛичная
    : new Theme(Theme.getThemeId());
  window.SpotColЛичная = themeInstance;
  window.Imperiadicks  = themeInstance;

  const sm     = themeInstance.settingsManager;
  const styles = themeInstance.stylesManager;
  const player = themeInstance.player;

  console.log('[SpotifyScreen] ⚙ themeId:', themeInstance.id);

  /*──────────────────────────────────────────────────────────────────*/
  /* 2. Константы и runtime-флаги                                    */
  /*──────────────────────────────────────────────────────────────────*/
  const MODEL_MAP = { 1:'searchgpt', 2:'gpt-4o-mini', 3:'llama-3.3',
                      4:'gemini-2.0-flash', 5:'gemini-2.0-flash-mini' };
  const ENDPOINT    = 'https://api.onlysq.ru/ai/v2';
  const DEFAULT_IMG = 'http://127.0.0.1:2007/Assets/no-cover-image.png';

  let neuroSearch = sm.get('gptSearch')?.value ?? false;
  let useStream   = sm.get('useStream')?.value ?? false;
  let useModel    = 'llama-3.3';            // временно «пустая» модель

  sm.on('change:gptSearch', ({settings}) => {
    neuroSearch = settings.get('gptSearch').value;
    console.log('[SpotifyScreen] gptSearch →', neuroSearch);
    clearUI(); refresh();
  });
  sm.on('change:useStream', ({settings}) => {
    useStream = settings.get('useStream').value;
    console.log('[SpotifyScreen] useStream →', useStream);
    clearUI(); refresh();
  });
  sm.on('change:useModel',  ({settings}) => {
    useModel = MODEL_MAP[settings.get('useModel').value] || useModel;
    console.log('[SpotifyScreen] useModel →', useModel);
    clearUI(); refresh();
  });

  /*──────────────────────────────────────────────────────────────────*/
  /* 3. DOM helpers                                                   */
  /*──────────────────────────────────────────────────────────────────*/
  function el(tag, cls, parent=document.body, txt){
    console.log('[SpotifyScreen] el()', tag, cls);
    const n=document.createElement(tag);
    if(cls) n.className=cls;
    if(txt!==undefined) n.textContent=txt;
    parent.appendChild(n);
    return n;
  }
  function md2html(md=''){
    console.log('[SpotifyScreen] md2html()');
    return md.replace(/&/g,'&amp;').replace(/</g,'&lt;')
             .replace(/>/g,'&gt;')
             .replace(/\[(.+?)\]\((https?:[^)]+)\)/g,
                      '<a href="$2" target="_blank" rel="noopener">$1</a>')
             .replace(/^(#{1,6})\s+(.+)$/gm,
                      (_,h,t)=>`<h${h.length}>${t}</h${h.length}>`)
             .replace(/\*\*(.+?)\*\*|__(.+?)__/g,'<strong>$1$2</strong>')
             .replace(/\*(.+?)\*|_(.+?)_/g,'<em>$1$2</em>')
             .replace(/(^|\n)[ \t]*[-*+]\s+(.+)/g,'$1<ul><li>$2</li></ul>')
             .replace(/(^|\n)[ \t]*\d+[.)]\s+(.+)/g,'$1<ol><li>$2</li></ol>')
             .replace(/\r?\n/g,'<br>');
  }

  /*──────────────────────────────────────────────────────────────────*/
  /* 4. Like-button helpers                                          */
  /*──────────────────────────────────────────────────────────────────*/
  let $root,$bg,$cover,$track,$artist,$like,$origLike;
  let likeObserver=null;

  styles.add('imp-like-pulse',`
    .LikeTrack{flex:0 0 42px;display:flex;align-items:center;justify-content:center;
      cursor:pointer;top:10px;right:14px}
    @keyframes likePulse{0%{transform:scale(1);}45%{transform:scale(1.25);}100%{transform:scale(1);}}
    .LikeTrack.animate{animation:likePulse .35s ease-out;}
  `);

  function isLiked(node){
    if(!node) return false;
    const aria=node.getAttribute('aria-checked');
    if(aria!==null) return aria==='true';
    return node.classList.contains('Like_active')||
           !!node.querySelector('svg[class*="_active"],svg[class*="-active"],svg .LikeIcon_active');
  }
  function syncLike(){
    if(!$origLike||!$like) return;
    const svgO=$origLike.querySelector('svg');
    const svgC=$like.querySelector('svg');
    if(svgO){
      svgC?svgC.replaceWith(svgO.cloneNode(true))
           :$like.appendChild(svgO.cloneNode(true));
    }
    const liked=isLiked($origLike);
    $like.classList.toggle('Like_active',liked);
    const prev=$like.dataset.prevLiked==='true';
    if(liked!==prev){
      $like.classList.add('animate');
      setTimeout(()=>{$like?.classList.remove('animate');},350);
      $like.dataset.prevLiked=String(liked);
    }
  }
  function findOrigLike(){
    const sels=[
      '.FullscreenPlayerDesktopControls_likeButton__vpJ7S[data-test-id="LIKE_BUTTON"]',
      '.PlayerBarDesktop_root__d2Hwi [data-test-id="LIKE_BUTTON"]',
      '[data-test-id="PLAYERBAR_DESKTOP_LIKE_BUTTON"]',
      '[data-test-id="LIKE_BUTTON"]'
    ];
    return sels.map(q=>document.querySelector(q)).find(Boolean)||null;
  }
  function watchLike(){
    if(likeObserver) likeObserver.disconnect();
    if(!$origLike) return;
    likeObserver=new MutationObserver(syncLike);
    likeObserver.observe($origLike,{attributes:true,childList:true,subtree:true});
  }
  function cloneLike(){
    $origLike=findOrigLike();
    if(!$origLike) return el('div','LikeTrack');
    const c=$origLike.cloneNode(true);
    c.classList.add('LikeTrack');
    c.removeAttribute('data-test-id');
    c.addEventListener('click',()=>{$origLike.click();});
    watchLike(); syncLike();
    return c;
  }

  /*──────────────────────────────────────────────────────────────────*/
  /* 5. Wiki / GPT helpers                                            */
  /*──────────────────────────────────────────────────────────────────*/
  const RE_ART=/===\s*(Артист|Artist|Исполнитель)\s*===/i;
  const RE_TRK=/===\s*(Трек|Track|Song|Песня)\s*===/i;
  function split(txt){
    const ai=txt.search(RE_ART), ti=txt.search(RE_TRK);
    let a='',t='';
    if(ai>=0&&ti>=0){
      if(ai<ti){a=txt.slice(ai,ti);t=txt.slice(ti);}
      else     {t=txt.slice(ti,ai);a=txt.slice(ai);}
    }else if(ai>=0){a=txt.slice(ai);}
    else if(ti>=0){t=txt.slice(ti);} else a=txt;
    return {artistText:a.replace(RE_ART,'').trim(),
            trackText :t.replace(RE_TRK ,'').trim()};
  }
  async function fetchWiki(q){
    console.log('[SpotifyScreen] fetchWiki',q);
    const out=document.querySelector('.Search_Info');
    const alert=document.querySelector('.Achtung_Alert');
    if(!out) return;
    try{
      const url='https://ru.wikipedia.org/w/api.php?action=query&format=json&origin=*'+
                '&titles='+encodeURIComponent(q)+
                '&prop=extracts&exintro&explaintext';
      const res=await fetch(url);
      if(!res.ok) throw 0;
      const j=await res.json();
      const page=Object.values(j.query.pages)[0]||{};
      const text=page.extract||'Информация не найдена';
      out.innerHTML=md2html(text);
      alert.style.display='block';
    }catch{
      out.innerHTML='<b>Ошибка Wiki</b>';
      alert.style.display='none';
    }
  }
  async function fetchGPT(artist,track){
    console.log('[SpotifyScreen] fetchGPT (заглушка)');
    const art=document.querySelector('.Search_Info');
    const tr =document.querySelector('.GPT_Search_Info');
    const alert=document.querySelector('.Achtung_Alert');
    if(!art||!tr) return;
    art.innerHTML='<b>GPT временно недоступен</b>';
    tr.textContent='';
    alert.style.display='none';
  }

  /*──────────────────────────────────────────────────────────────────*/
  /* 6. UI skeleton & update                                          */
  /*──────────────────────────────────────────────────────────────────*/
  function buildUI(){
    if($root) return;
    $root = el('div','Spotify_Screen',document.body);
    $bg   = el('div','SM_Background',$root);
    $cover= el('div','SM_Cover',$root);
    const row=el('div','SM_Title_Line',$root);
    $track =el('div','SM_Track_Name',row);
    $like  =cloneLike(); row.appendChild($like);
    $artist=el('div','SM_Artist',$root);

    const info=el('div','All_Info_Container',$root);
    const art =el('div','Artist_Info_Container',info);
    el('div','Info_Title',art,'Сведения об исполнителе');
    el('div','Search_Info',art);
    const gpt=el('div','GPT_Info_Container',info);
    el('div','GPT_Info_Title',gpt,'Сведения о треке');
    el('div','GPT_Search_Info',gpt);
    el('div','Achtung_Alert',info,
       'Информация может содержать ошибки. Всегда проверяйте источник.');
  }
  function clearUI(){
    console.log('[SpotifyScreen] clearUI');
    document.querySelector('.Search_Info')?.replaceChildren();
    document.querySelector('.GPT_Search_Info')?.replaceChildren();
    const a=document.querySelector('.Achtung_Alert');
    if(a) a.style.display='none';
  }

  /* ───── подписка на глобальное событие очистки ───── */
  themeInstance.on('clear-screen', () => {
    console.log('[SpotifyScreen] 🧹 clear-screen event');
    clearUI();
  });

  function updateUI(st){
    console.log('[SpotifyScreen] updateUI');
    buildUI();
    if(!$origLike||!document.contains($origLike)){
      const fresh=cloneLike();
      $like.replaceWith(fresh); $like=fresh;
    }
    const t=st.track||{};
    const img=t.coverUri?`https://${t.coverUri.replace('%%','1000x1000')}`:DEFAULT_IMG;
    [$bg,$cover].forEach(n=>n.style.background=`url(${img}) center/cover no-repeat`);
    const aNames=(t.artists||[]).map(a=>a.name).join(', ');
    const title=t.title||'';
    const diff=($track.textContent!==title)||($artist.textContent!==aNames);
    $track.textContent=title;
    $artist.textContent=aNames;
    syncLike();
    if(diff){
      clearUI();
      neuroSearch?fetchGPT(aNames,title):fetchWiki(aNames||title);
    }
    $root.style.display='block';
  }

  /*──────────────────────────────────────────────────────────────────*/
  /* 7. Player events + initial call                                  */
  /*──────────────────────────────────────────────────────────────────*/
  player.on('trackChange',({state})=>{console.log('[SpotifyScreen] trackChange');updateUI(state);});
  player.on('play',({state})=>{console.log('[SpotifyScreen] play');updateUI(state);});
  if(player.state?.track){console.log('[SpotifyScreen] initial');updateUI(player.state);}

  /*──────────────────────────────────────────────────────────────────*/
  /* 8. Watchdog-refresh fallback                                     */
  /*──────────────────────────────────────────────────────────────────*/
  let pA='',pT='';
  function refresh(){
    const a=player.state.track?.artists?.map(x=>x.name).join(', ')||'';
    const t=player.state.track?.title||'';
    if(a===pA&&t===pT) return;
    pA=a; pT=t; updateUI(player.state);
  }
  setInterval(refresh,1600);

  /*──────────────────────────────────────────────────────────────────*/
  /* 9. EOF — резервные логи                                          */
  /*──────────────────────────────────────────────────────────────────*/
  console.log('[SpotifyScreen] EOF-1');
  console.log('[SpotifyScreen] EOF-2');
  console.log('[SpotifyScreen] EOF-3');
  console.log('[SpotifyScreen] EOF-4');
  console.log('[SpotifyScreen] EOF-5');
})();
