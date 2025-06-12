
SpotCol.player.on('openPlayer', ({ settings, styles, state }) => {
  const setting = settings.get('playerBackground');
  const backgroundImage = settings.get('backgroundImage');
  if (!setting) return;
  
  const image = setting.value ? 'https://'+state.track.coverUri.replace('%%', '1000x1000') : backgroundImage.value.replace(/\\/g, '/');
  setPlayerBackground(settings, image);
  
  setupSpotColЛичная(settings, styles);
});

SpotCol.player.on('trackChange', ({ settings, state }) => {
  const setting = settings.get('playerBackground');
  if (!setting) return;
  if (setting.value) {
      const image = 'https://'+state.track.coverUri.replace('%%', '1000x1000');
      setPlayerBackground(settings, image);
  }

  // Отключение кнопочки, если текст недоступен
  const customLyricsButton = document.querySelector('.custom-text');
  const syncLyricsButton = document.querySelector('.FullscreenPlayerDesktopControls_syncLyricsButton__g6E6g[data-test-id="PLAYERBAR_DESKTOP_SYNC_LYRICS_BUTTON"]');

  if (customLyricsButton) {
      if (!syncLyricsButton) {
          customLyricsButton.querySelector('svg').classList.remove('SyncLyricsButton_icon_active__6WcWG');
          customLyricsButton.disabled = true;
      }
      else {
          customLyricsButton.disabled = false;
          clickCustomText(syncLyricsButton, customLyricsButton);

          if (syncLyricsButton.querySelector('svg').classList.contains('SyncLyricsButton_icon_active__6WcWG') && !customLyricsButton.querySelector('svg').classList.contains('SyncLyricsButton_icon_active__6WcWG')) {
              customLyricsButton.querySelector('svg').classList.add('SyncLyricsButton_icon_active__6WcWG');
          }
      }
  }
});

// Навсякий, чтобы не баговалось
SpotCol.player.on('openText', () => {
  const customLyricsButton = document.querySelector('.custom-text');
  if (customLyricsButton) customLyricsButton.querySelector('svg').classList.add('SyncLyricsButton_icon_active__6WcWG');
})
SpotCol.player.on('closeText', () => {
  const customLyricsButton = document.querySelector('.custom-text');
  if (customLyricsButton) customLyricsButton.querySelector('svg').classList.remove('SyncLyricsButton_icon_active__6WcWG');
})


SpotCol.settingsManager.on('change:playerBackground', ({ settings, state }) => {
  const playerBackground = settings.get('playerBackground');
  const backgroundImage = settings.get('backgroundImage');

  if (!playerBackground) return;

  const image = playerBackground.value ? 'https://'+state.track.coverUri.replace('%%', '1000x1000') : backgroundImage.value.replace(/\\/g, '/');
  setPlayerBackground(settings, image);
});

SpotCol.settingsManager.on('change:backgroundImage', ({ settings }) => {
  const playerBackground = settings.get('playerBackground');
  const backgroundImage = settings.get('backgroundImage');

  if (playerBackground.value) return;
  
  const image = backgroundImage.value.replace(/\\/g, '/');
  setPlayerBackground(settings, image);
});

SpotCol.settingsManager.on('change:autoBlackout', async ({ settings, state }) => {
  const autoBlackout = settings.get('autoBlackout');
  const playerBackground = settings.get('playerBackground');
  if (!autoBlackout) return;

  const backgroundDiv = document.querySelector('div[data-test-id="FULLSCREEN_PLAYER_MODAL"]');
  if (!backgroundDiv) return;
  if (!autoBlackout.value || !playerBackground.value) return backgroundDiv.style.setProperty('--brightness-correction', 1);

  if (!playerBackground.value) return;

  const image = 'https://'+state.track.coverUri.replace('%%', '100x100');
  if (!image) return;

  getBrightnessCorrection(image)
      .then(correction => {
          backgroundDiv.style.setProperty('--brightness-correction', correction);
      })
      .catch(console.error);
});

SpotCol.settingsManager.on('change:brightness', ({ settings }) => {
  const brightness = settings.get('brightness');
  if (!brightness) return;

  const backgroundDiv = document.querySelector('div[data-test-id="FULLSCREEN_PLAYER_MODAL"]');
  if (!backgroundDiv) return;
  backgroundDiv.style.setProperty('--brightness', (brightness.value != undefined) ? (brightness.value / 100) : (brightness.default / 100));
});

SpotCol.settingsManager.on('change:blur', ({ settings }) => {
  const blur = settings.get('blur');
  if (!blur) return;

  const backgroundDiv = document.querySelector('div[data-test-id="FULLSCREEN_PLAYER_MODAL"]');
  if (!backgroundDiv) return;
  backgroundDiv.style.setProperty('--blur', blur.value != undefined ? `${blur.value}px` : `${blur.default}px`);
});

SpotCol.settingsManager.on('change:SpotColЛичная', ({ settings, styles }) => {
  setupSpotColЛичная(settings, styles);
});

SpotCol.settingsManager.on('change:playerButtonsBackground', ({ settings, styles }) => {
  const SpotColЛичная = settings.get('SpotColЛичная');
  if (!SpotColЛичная) return;
  if (!SpotColЛичная.value)  return;
  
  const playerButtonsBackground = settings.get('playerButtonsBackground');
  const playerButtonsInvertBackground = settings.get('playerButtonsInvertBackground');

  if (playerButtonsBackground.value) {
      styles.add('playerButtonsBackground', `
          .FullscreenPlayerDesktopContent_syncLyrics__6dTfH,
          .FullscreenPlayerDesktopContent_info__Dq69p,
          .PlayQueue_root__ponhw {
              padding: 16px;
              background-color: rgba(0, 0, 0, 0.35);
              backdrop-filter: blur(15px);
              border-radius: 16px;
          }
      `);
      if (playerButtonsInvertBackground.value) {
          styles.add('playerButtonsInvertBackground', `
              .FullscreenPlayerDesktopContent_syncLyrics__6dTfH,
              .FullscreenPlayerDesktopContent_info__Dq69p,
              .PlayQueue_root__ponhw {
                  backdrop-filter: invert(1) blur(15px);
              }
          `);
      }
  } else {
      styles.remove('playerButtonsBackground');
      styles.remove('playerButtonsInvertBackground');
  }
});

SpotCol.settingsManager.on('change:playerButtonsInvertBackground', ({ settings, styles }) => {
  const SpotColЛичная = settings.get('SpotColЛичная');
  if (!SpotColЛичная) return;
  if (!SpotColЛичная.value)  return;
  
  const playerButtonsBackground = settings.get('playerButtonsBackground');
  if (!playerButtonsBackground.value) return;
  
  const playerButtonsInvertBackground = settings.get('playerButtonsInvertBackground');
  if (playerButtonsInvertBackground.value) {
      styles.add('playerButtonsInvertBackground', `
          .FullscreenPlayerDesktopContent_syncLyrics__6dTfH,
          .FullscreenPlayerDesktopContent_info__Dq69p,
          .PlayQueue_root__ponhw {
              backdrop-filter: invert(1) blur(15px);
          }
      `);
  } else {
      styles.remove('playerButtonsInvertBackground');
  }
});

    //WolfyLibrary Theme: SpotColЛичная (v5.0)
/*_____________________________________________________________________________________________*/

   SpotCol.stylesManager.add(
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

/*_____________________________________________________________________________________________*/


       const row=el('div','SM_Title_Line',$root);
       $track=el('div','SM_Track_Name',row);
       $like =createClone();
       row.appendChild($like);
       $artist=el('div','SM_Artist',$root);
   
/*_____________________________________________________________________________________________*/


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


     theme.player.on('openPlayer',({state})=>update(state));
     theme.player.on('trackChange',({state})=>update(state));
   
     function el(tag,cls,parent=document.body,txt){const n=document.createElement(tag);n.classList.add(cls);if(txt)n.textContent=txt;parent.appendChild(n);return n;}
   })(SpotCol);
   
/*_____________________________________________________________________________________________*/