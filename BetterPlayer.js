// BetterPlayer.js
function defineBetterPlayer() {
  function BetterPlayer(theme) {
theme.player.on('openPlayer', ({ settings, styles, state }) => {
  const setting = settings.get('playerBackground');
  const backgroundImage = settings.get('backgroundImage');
  if (!setting) return;
  
  const image = setting.value ? 'https://'+state.track.coverUri.replace('%%', '1000x1000') : backgroundImage.value.replace(/\\/g, '/');
  setPlayerBackground(settings, image);
  
  setupSpotColЛичная(settings, styles);
});

theme.player.on('trackChange', ({ settings, state }) => {
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
theme.player.on('openText', () => {
  const customLyricsButton = document.querySelector('.custom-text');
  if (customLyricsButton) customLyricsButton.querySelector('svg').classList.add('SyncLyricsButton_icon_active__6WcWG');
})
theme.player.on('closeText', () => {
  const customLyricsButton = document.querySelector('.custom-text');
  if (customLyricsButton) customLyricsButton.querySelector('svg').classList.remove('SyncLyricsButton_icon_active__6WcWG');
})


theme.settingsManager.on('change:playerBackground', ({ settings, state }) => {
  const playerBackground = settings.get('playerBackground');
  const backgroundImage = settings.get('backgroundImage');

  if (!playerBackground) return;

  const image = playerBackground.value ? 'https://'+state.track.coverUri.replace('%%', '1000x1000') : backgroundImage.value.replace(/\\/g, '/');
  setPlayerBackground(settings, image);
});

theme.settingsManager.on('change:backgroundImage', ({ settings }) => {
  const playerBackground = settings.get('playerBackground');
  const backgroundImage = settings.get('backgroundImage');

  if (playerBackground.value) return;
  
  const image = backgroundImage.value.replace(/\\/g, '/');
  setPlayerBackground(settings, image);
});

theme.settingsManager.on('change:autoBlackout', async ({ settings, state }) => {
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

theme.settingsManager.on('change:brightness', ({ settings }) => {
  const brightness = settings.get('brightness');
  if (!brightness) return;

  const backgroundDiv = document.querySelector('div[data-test-id="FULLSCREEN_PLAYER_MODAL"]');
  if (!backgroundDiv) return;
  backgroundDiv.style.setProperty('--brightness', (brightness.value != undefined) ? (brightness.value / 100) : (brightness.default / 100));
});

theme.settingsManager.on('change:blur', ({ settings }) => {
  const blur = settings.get('blur');
  if (!blur) return;

  const backgroundDiv = document.querySelector('div[data-test-id="FULLSCREEN_PLAYER_MODAL"]');
  if (!backgroundDiv) return;
  backgroundDiv.style.setProperty('--blur', blur.value != undefined ? `${blur.value}px` : `${blur.default}px`);
});

theme.settingsManager.on('change:SpotColЛичная', ({ settings, styles }) => {
  setupSpotColЛичная(settings, styles);
});

theme.settingsManager.on('change:playerButtonsBackground', ({ settings, styles }) => {
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

theme.settingsManager.on('change:playerButtonsInvertBackground', ({ settings, styles }) => {
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
})
  }};