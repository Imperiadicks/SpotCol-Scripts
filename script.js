(function initSpotCol () {
  const LIB_URL  = 'https://cdn.jsdelivr.net/gh/Imperiadicks/SpotCol-Scripts@latest/ImperiaLibrary.js';
  const THEME_ID = 'SpotColЛичная';

  if (window.ImperiaLibrary?.Theme) {
    startTheme();
    return;
  }

  const s = document.createElement('script');
  s.src   = LIB_URL;
  s.async = true;
  s.onload = startTheme;
  document.head.appendChild(s);

  function startTheme () {
    const { Theme } = window.ImperiaLibrary;
    if (!Theme) {
      console.error('[SpotCol] ImperiaLibrary.Theme отсутствует');
      return;
    }
    const SpotCol = new Theme(THEME_ID);
/*_____________________________________________________________________________________________*/
 /* ФУНКЦИИ ДЛЯ ПОМОЩИ */


/* Асинхронная загрузка изображения для коррекции */
function loadImage(url) {
  return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
  });
}

/* Получение коррекции яркости, для её нормализации */
async function getBrightnessCorrection(imageUrl, targetBrightness = 0.3) {
  // Загружаем изображение
  const img = await loadImage(imageUrl);

  // Создаем временный canvas
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Уменьшаем размер для производительности
  const scale = 100 / Math.max(img.width, img.height);
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;

  // Рисуем изображение
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Получаем данные пикселей
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;

  // Собираем яркости с учетом веса
  const brightnessList = [];
  for (let i = 0; i < pixels.length; i += 4) {
      const x = (i / 4) % canvas.width;
      const y = Math.floor((i / 4) / canvas.width);

      // Вес центральной области
      const dx = x / canvas.width - 0.5;
      const dy = y / canvas.height - 0.5;
      const weight = 1 - Math.sqrt(dx * dx + dy * dy) * 2;

      if (weight > 0) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          brightnessList.push(brightness * weight);
      }
  }

  // Сортируем и берем 90-й перцентиль
  brightnessList.sort((a, b) => a - b);
  const percentile = brightnessList[Math.floor(brightnessList.length * 0.9)];

  // Рассчитываем коэффициент с ограничениями
  let coefficient = targetBrightness / percentile;
  return Math.min(Math.max(coefficient, 0.4), 1);
}


/* Установка фона, яркости, коррекции и блюра */
function setPlayerBackground(settings, image) {
  const autoBlackout = settings.get('autoBlackout');
  const brightness = settings.get('brightness');
  const blur = settings.get('blur');

  const backgroundDiv = document.querySelector('div[data-test-id="FULLSCREEN_PLAYER_MODAL"]');
  if (!backgroundDiv) return;

  backgroundImage = image ? `url("${image}")` : 'none';

  if (backgroundDiv.style.getPropertyValue('--background') == backgroundImage) return;
  if (backgroundDiv.style.getPropertyValue('--background-next')) return;

  backgroundDiv.style.setProperty('--background-next', backgroundImage);
  backgroundDiv.classList.add('animate');

  const onTransitionEnd = (event) => {
      if (event.propertyName !== 'opacity') return;

      backgroundDiv.style.setProperty('--background', backgroundImage);
      backgroundDiv.classList.remove('animate');
      backgroundDiv.style.removeProperty('--background-next');
      backgroundDiv.removeEventListener('transitionend', onTransitionEnd);
  };

  backgroundDiv.addEventListener('transitionend', onTransitionEnd);

  if (autoBlackout.value && image) {
      getBrightnessCorrection(image)
          .then(correction => {
              backgroundDiv.style.setProperty('--brightness-correction', correction);
          })
          .catch(console.error);
  } else {
      backgroundDiv.style.setProperty('--brightness-correction', 1);
  }

  if (brightness.value) {
      backgroundDiv.style.setProperty('--brightness', (brightness.value != undefined) ? (brightness.value / 100) : (brightness.default / 100));
  }

  if (blur.value != undefined) {
      backgroundDiv.style.setProperty('--blur', blur.value != undefined ? `${blur.value}px` : `${blur.default}px`);
  }
}


/* Установка "Улучшенного плеера" */
let controlsParents = {}

function clickCustomText(originalSyncLyricsButton, customText) {
  customText.onclick = () => {
      originalSyncLyricsButton.click();
  };
}

function setupSpotColЛичная(settings, styles) {
  const setting = settings.get('SpotColЛичная');
  let customControls = document.querySelector('.customPlayerControls');

  const controls = document.querySelector('.FullscreenPlayerDesktopControls_sonataControls__9AIki');
  const contextMenu = document.querySelector('.FullscreenPlayerDesktopControls_menuButton__R4cXl[data-test-id="FULLSCREEN_PLAYER_CONTEXT_MENU_BUTTON"]');
  const likeButton = document.querySelector('.FullscreenPlayerDesktopControls_likeButton__vpJ7S[data-test-id="LIKE_BUTTON"]');
  const playQueueButton = document.querySelector('.FullscreenPlayerDesktopControls_playQueueButton__reNOW[data-test-id="FULLSCREEN_PLAYER_QUEUE_BUTTON"]');
  const syncLyricsButton = document.querySelector('.FullscreenPlayerDesktopControls_syncLyricsButton__g6E6g[data-test-id="PLAYERBAR_DESKTOP_SYNC_LYRICS_BUTTON"]');

  if (!setting) return;
  if (!setting.value) {
      if (customControls) {
          if (controlsParents.playQueueButton) controlsParents.playQueueButton.appendChild(playQueueButton);
          if (controlsParents.controls) controlsParents.controls.appendChild(controls);
          if (controlsParents.contextMenu) controlsParents.contextMenu.appendChild(contextMenu);
          if (controlsParents.likeButton) controlsParents.likeButton.appendChild(likeButton);

          customControls.remove();
      }

      styles.remove('SpotColЛичная');
      styles.remove('playerButtonsBackground');
      styles.remove('playerButtonsInvertBackground');

      return;
  };

  const player = document.querySelector('.FullscreenPlayerDesktopContent_info__Dq69p');
  const timecode = player?.querySelector('div[data-test-id="TIMECODE_WRAPPER"]');

  if (timecode) timecode.classList.remove('ChangeTimecode_root_fullscreen__FA6r0');

  if (!customControls) {
      if (!controls) return;

      controlsParents = {
          'controls': controls.parentElement,
          'contextMenu': contextMenu.parentElement,
          'likeButton': likeButton.parentElement,
          'playQueueButton': playQueueButton.parentElement
      }

      customControls = document.createElement('div');
      customControls.classList.add('customPlayerControls');

      customControls.appendChild(playQueueButton);
      customControls.appendChild(contextMenu);
      customControls.appendChild(controls);
      customControls.appendChild(likeButton);

      const newCustomLyricsButton = document.createElement('button');
      newCustomLyricsButton.classList.add(
          'custom-text', 'cpeagBA1_PblpJn8Xgtv', 'iJVAJMgccD4vj4E4o068', 'zIMibMuH7wcqUoW7KH1B',
          'IlG7b1K0AD7E7AMx6F5p', 'nHWc2sto1C6Gm0Dpw_l0', 'SGYcNjvjmMsXeEVGUV2Z', 'qU2apWBO1yyEK0lZ3lPO',
          'FullscreenPlayerDesktopControls_syncLyricsButton__g6E6g'
      );

      newCustomLyricsButton.innerHTML = '<span class="JjlbHZ4FaP9EAcR_1DxF"><svg class="J9wTKytjOWG73QMoN5WP o_v2ds2BaqtzAsRuCVjw"><use xlink:href="#syncLyrics"></use></svg></span>';

      if (syncLyricsButton) {
          clickCustomText(syncLyricsButton, newCustomLyricsButton);

          if (syncLyricsButton.querySelector('svg').classList.contains('SyncLyricsButton_icon_active__6WcWG')) {
              newCustomLyricsButton.querySelector('svg').classList.add('SyncLyricsButton_icon_active__6WcWG');
          }
      } else {
          newCustomLyricsButton.disabled = true;
      }

      customControls.appendChild(newCustomLyricsButton);

      player.appendChild(customControls);

      styles.add('SpotColЛичная', `
          .customPlayerControls {
              display: flex;
              justify-content: center;
              align-items: center;
          }
          
          div[data-test-id="FULLSCREEN_PLAYER_POSTER_CONTENT"] {
              display: none;
          }
  
          .SonataFullscreenControlsDesktop_sonataButton__qmSTF,
          .SonataFullscreenControlsDesktop_sonataButton__qmSTF:disabled,
          .FullscreenPlayerDesktopControls_menuButton__R4cXl,
          .FullscreenPlayerDesktopControls_likeButton__vpJ7S,
          .FullscreenPlayerDesktopControls_playQueueButton__reNOW,
          .FullscreenPlayerDesktopControls_syncLyricsButton__g6E6g {
              background: transparent;
          }
          
          .SonataFullscreenControlsDesktop_sonataButton__qmSTF:not(:disabled):focus-visible,
          .SonataFullscreenControlsDesktop_sonataButton__qmSTF:not(:disabled):hover,
          .FullscreenPlayerDesktopControls_menuButton__R4cXl:not(:disabled):focus-visible,
          .FullscreenPlayerDesktopControls_menuButton__R4cXl:not(:disabled):hover,
          .FullscreenPlayerDesktopControls_menuButton_active__YZ8M8,
          .FullscreenPlayerDesktopControls_likeButton__vpJ7S:not(:disabled):focus-visible,
          .FullscreenPlayerDesktopControls_likeButton__vpJ7S:not(:disabled):hover,
          .FullscreenPlayerDesktopControls_playQueueButton__reNOW:not(:disabled):focus-visible,
          .FullscreenPlayerDesktopControls_playQueueButton__reNOW:not(:disabled):hover,
          .FullscreenPlayerDesktopControls_syncLyricsButton__g6E6g:not(:disabled):focus-visible,
          .FullscreenPlayerDesktopControls_syncLyricsButton__g6E6g:not(:disabled):hover {
              background: transparent;
          }
  
          .SonataFullscreenControlsDesktop_sonataButton__qmSTF[data-test-id="PLAY_BUTTON"],
          .SonataFullscreenControlsDesktop_sonataButton__qmSTF[data-test-id="PAUSE_BUTTON"] {
              border-style: solid;
              border-width: 3px;
              border-color: var(--ym-controls-color-secondary-text-enabled_variant);
          }
  
          .SonataFullscreenControlsDesktop_buttonContainer__mkxBw {
              min-width: fit-content;
          }
  
          .SonataFullscreenControlsDesktop_root__l4a2W {
              gap: 0;
          }
  
          .SonataFullscreenControlsDesktop_sonataButtons__BNse_ {
              gap: 4px;
              transform: scale(0.8);
          }
  
          .FullscreenPlayerDesktopControls_likeButton__vpJ7S svg,
          .FullscreenPlayerDesktopControls_menuButton__R4cXl svg,
          .FullscreenPlayerDesktopControls_playQueueButton__reNOW svg,
          .FullscreenPlayerDesktopControls_syncLyricsButton__g6E6g svg {
              height: 28px;
              width: 28px;
          }
              
          .FullscreenPlayerDesktopControls_playQueueButton__reNOW,
          .FullscreenPlayerDesktopControls_syncLyricsButton__g6E6g {
              margin-inline-end: 0;
              margin-block-end: 0;
              margin-block-start: 0;
              align-self: auto;
          }
  
          .ChangeTimecode_slider__P4qmT {
              --slider-thumb-box-shadow-color: transparent;
          }
  
          .FullscreenPlayerDesktopContent_fullscreenContent_enter__xMN2Y,
          .FullscreenPlayerDesktopContent_fullscreenContent_leave__6HeZ_ {
              animation-name: none;
          }
  
          .FullscreenPlayerDesktopContent_additionalContent__tuuy7 {
              transform: translate(50%);
              height: calc(100% - (var(--fullscreen-player-content-size-px)/2) - 8px - 32px);
              top: 32px;
          }
          
          .FullscreenPlayerDesktopContent_syncLyrics__6dTfH,
          .PlayQueue_root__ponhw {
              height: 100%;
          }
  
          .FullscreenPlayerDesktopContent_fullscreenContent__Nvety {
              transform: translate(calc(50dvw - var(--fullscreen-player-content-size-px)/2),calc(100dvh - var(--fullscreen-player-height-px)/2 + 32px));
          }
  
          .FullscreenPlayerDesktopContent_additionalContent_enter_active__a3nOf {
              animation-name: FullscreenPlayerDesktopContent_enter-fade-additional-content_custom;
          }
          
          .FullscreenPlayerDesktopContent_additionalContent_exit_active__vokVE {
              animation-name: FullscreenPlayerDesktopContent_leave-fade-additional-content_custom;
          }
  
          .custom-text {
              color: var(--ym-controls-color-secondary-text-enabled);
              transition: color 0.3s ease;
          }
  
          .custom-text svg {
              padding: 3px 2px 4px 2px;
          }
  
          .custom-text use:not(svg) {
              transform-origin: 0px 0px;
          }
  
          .custom-text[disabled] {
              color: var(--ym-controls-color-secondary-text-disabled);
              background: transparent;
          }
  
          @keyframes FullscreenPlayerDesktopContent_enter-fade-additional-content_custom {
              0% {
                  transform: translate(0dvw);
                  opacity: 0
              }
  
              50% {
                  transform: translate(26dvw);
              }
  
              to {
                  transform: translate(25dvw);
                  opacity: 1
              }
          }
  
          @keyframes FullscreenPlayerDesktopContent_leave-fade-additional-content_custom {
              0% {
                  transform: translate(25dvw);
                  opacity: 1
              }
  
              40% {
                  opacity: 0
              }
  
              to {
                  transform: translate(0dvw);
                  opacity: 0
              }
          }
  
          .ChangeTimecode_root_fullscreen__FA6r0 {
              grid-template: initial !important;
              column-gap: initial !important;
              row-gap: initial !important;
          }
  
          .FullscreenPlayerDesktopContent_meta__3jDTy {
              padding: 0;
          }
  
          .FullscreenPlayerDesktopContent_info__Dq69p {
              height: fit-content;
              width: fit-content;
          }
      `);
  }

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
      } else {
          styles.remove('playerButtonsInvertBackground');
      }
  } else {
      styles.remove('playerButtonsBackground');
      styles.remove('playerButtonsInvertBackground');
  }
}

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

/*_____________________________________________________________________________________________*/
/*
 * SpotColЛичная — GPT / Wiki helper (rev‑2025‑05‑11‑i2)
 * Полностью завершённый скрипт без ссылок; устойчив к изменениям DOM/настроек.
 */

(() => {
  /* === SETTINGS === */
  const sm = SpotCol.settingsManager;
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
  sm.on('change:useModel', ({ settings }) => {
    // новая модель
    useModel = modelMap[settings.get('useModel').value] || useModel;

    // принудительно сбрасываем кэш, чтобы refresh() сделал запрос сразу
    prevA = '';
    prevT = '';

    clearUI();
    refresh();          // мгновенный запрос к новой модели
});


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
      'Если по данной записи не найдено надёжных сведений именно в таком написании — верни «Информация не найдена».',
      'Всегда начинай ответ секциями "=== Артист ===" и "=== Трек ===" (или англ. варианты).',
      'Для каждой секции дай 10–20 предложений (и всегда пиши с новым абзацам): биография, дискография, жанр, рекорды, интересные факты.',
      'Не задавай уточняющих вопросов. Без эмодзи и ссылок.',
      '',
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
        SpotCol.start(1000);
        console.log('[SpotCol] Theme initialised');
    }
})();
/*_____________________________________________________________________________________________*/
/* ------------------------------------------------------------------
            *Colorize - v3.0*
 * ------------------------------------------------------------------ */

(() => {
    /* ---------- Константы & утилиты -------------------------------- */
  
    const CANVAS = document.createElement('canvas');
    const CTX    = CANVAS.getContext('2d');
    const CACHE  = new Map();                 // src → {h,s,l}
  
    const L_MIN = 20, L_MAX = 80, S_MIN = 25, SAMPLE_SIZE = 64;
  
    const rgbToHsl = (r, g, b) => {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
      let h = 0, s = 0, l = (max + min) / 2;
      if (d) {
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
          case g: h = ((b - r) / d + 2);               break;
          case b: h = ((r - g) / d + 4);               break;
        }
        h /= 6;
      }
      return { h: Math.round(h * 360), s: +(s * 100).toFixed(1), l: +(l * 100).toFixed(1) };
    };
  
    const H = o => `hsl(${o.h},${o.s}%,${o.l}%)`;
    const HA = (o, a = 1) => `hsla(${o.h},${o.s}%,${o.l}%,${a})`;
  
    const fallbackHSL = () => {
      const root = document.querySelector('[class*="PlayerBarDesktop_root"]');
      if (!root) return { h: 0, s: 0, l: 50 };
      const raw = getComputedStyle(root)
        .getPropertyValue('--player-average-color-background')
        .trim();
      const m = raw.match(/hsl\((\d+),\s*([\d.]+)%,\s*([\d.]+)%\)/);
      return m ? { h: +m[1], s: +m[2], l: +m[3] } : { h: 0, s: 0, l: 50 };
    };
  
    /* ---------- Читаем «средний» цвет обложки ---------------------- */
  
    const getAvgHSL = src => {
      if (CACHE.has(src)) return Promise.resolve(CACHE.get(src));
  
      return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
  
        img.onload = () => {
          try {
            CANVAS.width = CANVAS.height = SAMPLE_SIZE;
            CTX.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
            const { data } = CTX.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  
            let rSum = 0, gSum = 0, bSum = 0, cnt = 0;
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i], g = data[i + 1], b = data[i + 2];
              const { s, l } = rgbToHsl(r, g, b);
              if (l >= L_MIN && l <= L_MAX && s >= S_MIN) {
                rSum += r; gSum += g; bSum += b; cnt++;
              }
            }
  
            if (!cnt) {                       // ни один пиксель не прошёл фильтр
              for (let i = 0; i < data.length; i += 4) {
                rSum += data[i]; gSum += data[i + 1]; bSum += data[i + 2];
              }
              cnt = data.length / 4;
            }
  
            const avg = rgbToHsl(rSum / cnt, gSum / cnt, bSum / cnt);
            CACHE.set(src, avg);
            resolve(avg);
          } catch {
            /* Canvas «tainted» (нет CORS) */
            const fb = fallbackHSL();
            CACHE.set(src, fb);
            resolve(fb);
          }
        };
  
        img.onerror = () => resolve(fallbackHSL());
        img.src = src;
      });
    };
  
    /* ---------- Генерируем палитру & пишем переменные -------------- */
  
    const genPalette = (base, steps = 10) => {
      const vars = {};
      for (let i = 1; i <= steps; i++) {
        const lHi = base.l + (i * (80 - base.l)) / steps;
        const lLo = base.l - (i * base.l)        / steps;
  
        vars[`--color-light-${i}`] = H({ ...base, l: lHi });
        vars[`--color-dark-${i}`]  = H({ ...base, l: lLo });
  
        for (let j = 1; j <= 10; j++) {
          vars[`--color-light-${i}-${j}`] = HA({ ...base, l: lHi }, j / 10);
          vars[`--color-dark-${i}-${j}`]  = HA({ ...base, l: lLo }, j / 10);
        }
      }
      return vars;
    };
  
    const setRootVars = obj => {
      const st = document.documentElement.style;
      for (const k in obj) st.setProperty(k, obj[k]);
    };
  
    /* ---------- Главная функция раскраски -------------------------- */
  
    let currentSrc = '';
  
    const recolor = async () => {
      const img = document.querySelector('[class*="PlayerBarDesktop_coverContainer"] img');
      if (!img?.src || img.src === currentSrc) return;
  
      currentSrc = img.src;
      const base = await getAvgHSL(img.src);
  
      // собственная палитра
      setRootVars(genPalette(base));
  
      // ключевые YM-переменные
      setRootVars({
        '--ym-background-color-primary-enabled-content' : 'var(--color-dark-3)',
        '--ym-background-color-primary-enabled-basic'   : 'var(--color-dark-8)',
        '--ym-surface-color-primary-enabled-list'       : 'var(--color-light-1-4)',
        '--ym-controls-color-primary-text-enabled'      : 'var(--color-light-10-5)',
        '--ym-controls-color-primary-text-hovered'      : 'var(--color-light-7)'
      });
  
      // фон «вибы»
      const vibe = document.querySelector('[class*="MainPage_vibe"]');
      if (vibe) {
        vibe.style.background =
          `linear-gradient(180deg,rgba(0,0,0,.2) 0%,var(--color-dark-3) 100%),` +
          `url(${img.src}) center/cover no-repeat`;
      }
    };
  
    /* ---------- Точное наблюдение за <img> ------------------------- */
  
    const observeCover = () => {
      const img = document.querySelector('[class*="PlayerBarDesktop_coverContainer"] img');
      if (!img) return;
  
      const mo = new MutationObserver(recolor);
      mo.observe(img, { attributes: true, attributeFilter: ['src'] });
  
      // если DOM-элемент сменился — пересоздаём observer
      const bodyWatch = new MutationObserver(() => {
        const fresh = document.querySelector('[class*="PlayerBarDesktop_coverContainer"] img');
        if (fresh && fresh !== img) {
          mo.disconnect();
          bodyWatch.disconnect();
          observeCover();
          recolor();
        }
      });
      bodyWatch.observe(document.body, { childList: true, subtree: true });
    };
  
    /* ---------- Старт --------------------------------------------- */
  
    const init = () => { observeCover(); recolor(); };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();                     // скрипт вставлен после полной загрузки
    }
  })();
  

/**
 * Перенос фонового изображения с player-bar в main-vibe
 */
function updateBackgroundImage() {
  const imgs = document.querySelectorAll('[class*="PlayerBarDesktop_cover"]');
  for (const img of imgs) {
    if (img.src?.includes('/1000x1000')) {
      backgroundReplace(img.src);
      break; // после первого совпадения сразу выходим
    }
  }
}

function backgroundReplace(src) {
  const target = document.querySelector('[class*="MainPage_vibe"]');
  if (target) {
    target.style.background =
      `linear-gradient(180deg, rgba(0,0,0,0.2) 0%, var(--color-dark-6) 100%), 
       url(${src}) center/cover no-repeat`;
  }
}

/**
 * Добавляет эффект увеличения для аватарки
 * — логика 그대로 из Вашего скрипта :contentReference[oaicite:2]{index=2}:contentReference[oaicite:3]{index=3}
 */
function setupAvatarZoomEffect() {
  const avatar = document.querySelector('[class*="PageHeaderCover_coverImage"]');
  if (!avatar) return;
  avatar.classList.add('avatar-zoom');
  avatar.addEventListener('mousemove', e => {
    const r = avatar.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * 9;
    const y = ((e.clientY - r.top) / r.height - 0.5) * 9;
    const tx = Math.max(-45, Math.min(45, -x * 11));
    const ty = Math.max(-45, Math.min(45, -y * 11));
    avatar.style.transform = `scale(1.8) translate(${tx}px,${ty}px)`;
  });
  avatar.addEventListener('mouseleave', () => {
    avatar.style.transform = '';
  });
}
/*--------------------------------------------*/

/*--------------------------------------------*/
const observer = new MutationObserver(() => {
    let pin = document.querySelector('.PinItem_root__WSoCn > a[aria-label="Плейлист Мне нравится"]');
    if (pin) {
        let parentPin = pin.closest('.PinItem_root__WSoCn');
        if (parentPin && parentPin.parentNode.firstChild !== parentPin) {
            parentPin.parentNode.insertBefore(parentPin, parentPin.parentNode.firstChild);
        }
    }
});

observer.observe(document.body, { childList: true, subtree: true });
/*--------------------------------------------*/
// Отключение тупого даблклика
/*--------------------------------------------*/
function disableDoubleClick() {
    const elements = document.querySelectorAll('.PlayerBar_root__cXUnU');

    elements.forEach(element => {
        element.addEventListener('dblclick', function(event) {
            event.preventDefault();
            event.stopPropagation();
        }, true);
    });
}

setInterval(disableDoubleClick, 1000);
/*--------------------------------------------*/

// Google Noto Sans Font
/*--------------------------------------------*/
const link1 = document.createElement('link');
link1.rel = 'preconnect';
link1.href = 'https://fonts.googleapis.com';
document.head.appendChild(link1);

const link2 = document.createElement('link');
link2.rel = 'preconnect';
link2.href = 'https://fonts.gstatic.com';
link2.crossOrigin = 'anonymous';
document.head.appendChild(link2);

const link3 = document.createElement('link');
link3.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,100..900;1,100..900&display=swap';
link3.rel = 'stylesheet';
document.head.appendChild(link3);
/*--------------------------------------------*/
document.querySelector('.PeivVKR1FPSKq0eXZVTH.Brf6Ike_kAhLsPhNEEmk, .nc4M2_N9M5ElqO2JOOq7.Brf6Ike_kAhLsPhNEEmk, .prAUKw3AUngspVHmnd5F.Brf6Ike_kAhLsPhNEEmk').remove();
