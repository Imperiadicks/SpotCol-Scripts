// BetterPlayer.js
// Плагин для SpotCol: BetterPlayer

(function() {
  /**
   * Конструктор BetterPlayer — принимается экземпляр темы SpotCol
   * @param {import('ImperiaLibrary').Theme} theme
   */
  function BetterPlayer(theme) {
    // при открытии плеера
    theme.player.on('openPlayer', ({ settings, styles, state }) => {
      const setting = settings.get('playerBackground');
      const backgroundImage = settings.get('backgroundImage');
      if (!setting) return;

      const image = setting.value
        ? 'https://' + state.track.coverUri.replace('%%', '1000x1000')
        : backgroundImage.value.replace(/\\/g, '/');

      // функция из helpers.js
      setPlayerBackground(settings, image);
      // инициализация других фич
      setupSpotColЛичная(settings, styles);
    });

    // при смене трека
    theme.player.on('trackChange', ({ settings, state }) => {
      const setting = settings.get('playerBackground');
      if (!setting) return;
      if (setting.value) {
        const image = 'https://' + state.track.coverUri.replace('%%', '1000x1000');
        setPlayerBackground(settings, image);
      }

      // Отключение/включение кастомной кнопки по доступности синхронизированных текстов
      const customLyricsButton = document.querySelector('.custom-text');
      const syncLyricsButton = document.querySelector(
        '[data-test-id="PLAYERBAR_DESKTOP_SYNC_LYRICS_BUTTON"]'
      );

      if (customLyricsButton) {
        if (!syncLyricsButton) {
          const icon = customLyricsButton.querySelector('svg');
          icon && icon.classList.remove('SyncLyricsButton_icon_active__6WcWG');
          customLyricsButton.disabled = true;
        } else {
          customLyricsButton.disabled = false;
          clickCustomText(syncLyricsButton, customLyricsButton);

          const syncIcon = syncLyricsButton.querySelector('svg');
          const customIcon = customLyricsButton.querySelector('svg');
          if (
            syncIcon.classList.contains('SyncLyricsButton_icon_active__6WcWG') &&
            !customIcon.classList.contains('SyncLyricsButton_icon_active__6WcWG')
          ) {
            customIcon.classList.add('SyncLyricsButton_icon_active__6WcWG');
          }
        }
      }
    });

    // чтобы иконка не сбрасывалась при открытии текста
    theme.player.on('openText', () => {
      const btn = document.querySelector('.custom-text');
      btn && btn.querySelector('svg').classList.add('SyncLyricsButton_icon_active__6WcWG');
    });
    theme.player.on('closeText', () => {
      const btn = document.querySelector('.custom-text');
      btn && btn.querySelector('svg').classList.remove('SyncLyricsButton_icon_active__6WcWG');
    });

    // изменения через UI
    theme.settingsManager.on('change:playerBackground', ({ settings, state }) => {
      const pb = settings.get('playerBackground');
      const bg = settings.get('backgroundImage');
      if (!pb) return;
      const image = pb.value
        ? 'https://' + state.track.coverUri.replace('%%', '1000x1000')
        : bg.value.replace(/\\/g, '/');
      setPlayerBackground(settings, image);
    });

    theme.settingsManager.on('change:backgroundImage', ({ settings }) => {
      const pb = settings.get('playerBackground');
      const bg = settings.get('backgroundImage');
      if (pb.value) return;
      const image = bg.value.replace(/\\/g, '/');
      setPlayerBackground(settings, image);
    });

    theme.settingsManager.on('change:autoBlackout', async ({ settings, state }) => {
      const ab = settings.get('autoBlackout');
      const pb = settings.get('playerBackground');
      if (!ab) return;
      const div = document.querySelector('div[data-test-id="FULLSCREEN_PLAYER_MODAL"]');
      if (!div) return;
      if (!ab.value || !pb.value) {
        div.style.setProperty('--brightness-correction', 1);
        return;
      }
      const thumb = 'https://' + state.track.coverUri.replace('%%', '100x100');
      try {
        const corr = await getBrightnessCorrection(thumb);
        div.style.setProperty('--brightness-correction', corr);
      } catch (e) {
        console.error(e);
      }
    });

    theme.settingsManager.on('change:brightness', ({ settings }) => {
      const b = settings.get('brightness');
      if (!b) return;
      const div = document.querySelector('div[data-test-id="FULLSCREEN_PLAYER_MODAL"]');
      if (!div) return;
      const val = b.value != null ? b.value / 100 : b.default / 100;
      div.style.setProperty('--brightness', val);
    });

    theme.settingsManager.on('change:blur', ({ settings }) => {
      const bl = settings.get('blur');
      if (!bl) return;
      const div = document.querySelector('div[data-test-id="FULLSCREEN_PLAYER_MODAL"]');
      if (!div) return;
      const val = bl.value != null ? `${bl.value}px` : `${bl.default}px`;
      div.style.setProperty('--blur', val);
    });

    theme.settingsManager.on('change:SpotColЛичная', ({ settings, styles }) => {
      setupSpotColЛичная(settings, styles);
    });

    theme.settingsManager.on('change:playerButtonsBackground', ({ settings, styles }) => {
      const master = settings.get('SpotColЛичная');
      if (!master?.value) {
        styles.remove('playerButtonsBackground');
        styles.remove('playerButtonsInvertBackground');
        return;
      }
      const pbBg = settings.get('playerButtonsBackground');
      const pbInv = settings.get('playerButtonsInvertBackground');

      if (pbBg.value) {
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
        if (pbInv.value) {
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
      const master = settings.get('SpotColЛичная');
      const pbBg   = settings.get('playerButtonsBackground');
      const pbInv  = settings.get('playerButtonsInvertBackground');
      if (!master?.value || !pbBg.value) return;
      if (pbInv.value) {
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
  }

  // Экспорт конструктора в глобальную область
  window.BetterPlayer = BetterPlayer;
})();
