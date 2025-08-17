// === SpotifyScreen — minimal UI only (panel + track texts + like) ===
(() => {
  const Theme = window.Theme;
  if (!Theme) { console.error('[SpotifyScreen] Theme is not available'); return; }
  console.log('[SpotifyScreen] load v1.0-min');

  const Lib = window.Library || {};
  const LOG = '[SpotifyScreen]';

  let $root, $cover, $title, $artist, $like, $origLike, likeObserver, keepAliveObs;
  let uiBound = false;
  let prevLiked = null;

  // ───────────────────────── DOM helpers ─────────────────────────
  function findAnchor() {
    return (
      document.querySelector('[class*="CommonLayout_content"]') ||
      document.querySelector('[class*="Content_root"]') ||
      document.querySelector('[data-test-id="PLAYERBAR_DESKTOP"]')?.parentElement ||
      document.querySelector('[class*="CommonLayout_root"]') ||
      document.body
    );
  }

  function findPlayerBar() {
    return (
      document.querySelector('[data-test-id="PLAYERBAR_DESKTOP"]') ||
      document.querySelector('[class*="PlayerBarDesktop_root"]')
    );
  }

  // находим «лайк» ТОЛЬКО в плеербаре (чтобы не цепляться к альбомам/плейлистам)
  function findTrackLikeButton() {
    const bar = findPlayerBar();
    if (!bar) return null;
    return (
      bar.querySelector('[data-test-id="PLAYERBAR_DESKTOP_LIKE_BUTTON"]') ||
      bar.querySelector('[data-test-id="LIKE_BUTTON"]')
    );
  }

  // ───────────────────────── build / mount ─────────────────────────
  function buildOnce() {
    if ($root && $root.isConnected) return;

    const root = document.createElement('div');
    root.className = 'Spotify_Screen';
    root.innerHTML = `
      <div class="SM_Cover"></div>

      <div class="SM_Title_Line">
        <div class="SM_Track_Name"></div>
        <div class="LikeTrack"></div>
      </div>

      <div class="SM_Artist"></div>

      <footer class="Achtung_Alert" hidden>
        В сведениях иногда бывают неправильные результаты.
        Проверьте информацию подробнее, если изначально вам не всё равно!
      </footer>
    `;

    (findAnchor() || document.body).insertAdjacentElement('afterbegin', root);

    $root   = root;
    $cover  = root.querySelector('.SM_Cover');
    $title  = root.querySelector('.SM_Track_Name');
    $artist = root.querySelector('.SM_Artist');

    // лайк-кнопка (клон оригинала из playerbar)
    const likeSlot = root.querySelector('.LikeTrack');
    $like = createLikeClone();
    likeSlot.replaceWith($like);

    attachLikeObserver();
    ensureKeepAlive();
  }

  function ensureMounted() {
    if (!$root || !document.body.contains($root)) {
      (findAnchor() || document.body).insertAdjacentElement('afterbegin', $root);
    }
  }

  // ───────────────────────── Like (clone & sync) ─────────────────────────
  function isLiked(node) {
    if (!node) return false;
    if (node.getAttribute('aria-checked') !== null) {
      return node.getAttribute('aria-checked') === 'true';
    }
    return (
      node.classList.contains('Like_active') ||
      !!node.querySelector('svg[class*="_active"],svg[class*="-active"],svg .LikeIcon_active')
    );
  }

  function syncLikeState() {
    if (!$origLike || !$like) return;

    // заменить SVG, чтобы соответствовал состоянию оригинала
    const svgO = $origLike.querySelector('svg');
    const svgC = $like.querySelector('svg');
    if (svgO) {
      svgC ? svgC.replaceWith(svgO.cloneNode(true)) : $like.appendChild(svgO.cloneNode(true));
    }

    const liked = isLiked($origLike);
    $like.classList.toggle('Like_active', liked);

    if (liked !== prevLiked) {
      // небольшая анимация — если не хочешь, убери класс в CSS
      $like.classList.add('animate');
      setTimeout(() => $like && $like.classList.remove('animate'), 300);
      prevLiked = liked;
    }
  }

  function attachLikeObserver() {
    if (likeObserver) likeObserver.disconnect();
    $origLike = findTrackLikeButton();
    if (!$origLike) return;

    likeObserver = new MutationObserver(syncLikeState);
    likeObserver.observe($origLike, { attributes: true, childList: true, subtree: true });
    syncLikeState();
  }

  function createLikeClone() {
    $origLike = findTrackLikeButton();
    prevLiked = null;

    const clone = document.createElement('div');
    clone.className = 'LikeTrack';
    clone.addEventListener('click', () => {
      console.log(`${LOG} 💚 like click (track only)`);
      $origLike?.click();
    });

    if ($origLike) {
      const svgO = $origLike.querySelector('svg');
      if (svgO) clone.appendChild(svgO.cloneNode(true));
    }
    return clone;
  }

  // ───────────────────────── Track update ─────────────────────────
  function updateTrackUI(track) {
    if (!track) return;
    buildOnce();
    ensureMounted();

    // название/артист + обложка через общий helper
    Lib.ui?.updateTrackUI?.(
      { cover: '.SM_Cover', title: '.SM_Track_Name', artist: '.SM_Artist' },
      track,
      { duration: 600 }
    );

    // на всякий — перехватываем лайк ещё раз (после смены страницы/вида)
    attachLikeObserver();
  }

  function bindToTrackBusOnce() {
    if (uiBound) return;
    uiBound = true;

    // единая шина из Library
    try {
      Lib.initUI?.();
      Lib.onTrack?.(t => updateTrackUI(t), { immediate: true });
    } catch (e) {
      console.warn(LOG, 'onTrack bind failed', e);
    }

    // страховка: если Theme.player есть — тоже слушаем
    const tp = Theme?.player;
    if (tp?.on) {
      tp.on('trackChange', ({ state }) => updateTrackUI(state?.track));
      tp.on('openPlayer',  ({ state }) => updateTrackUI(state?.track));
      tp.on('pageChange',  () => {
        // при смене страницы якоря могут меняться → вернуть ноду и пересинхронизировать
        ensureMounted();
        attachLikeObserver();
        const cur = tp?.state?.track || tp?.getCurrentTrack?.();
        if (cur) updateTrackUI(cur);
      });
    }
  }

  function ensureKeepAlive() {
    if (keepAliveObs) return;
    keepAliveObs = new MutationObserver(() => {
      if ($root && !document.body.contains($root)) {
        (findAnchor() || document.body).insertAdjacentElement('afterbegin', $root);
        attachLikeObserver();
      }
    });
    keepAliveObs.observe(document.body, { childList: true, subtree: true });
  }

  // ───────────────────────── Public API ─────────────────────────
  Theme.SpotifyScreen = {
    init(player) { buildOnce(); bindToTrackBusOnce(); },
    check()      { buildOnce(); attachLikeObserver(); }
  };

  // автоинициализация (если плеер уже есть)
  try { Theme.SpotifyScreen.init(Theme.player); } catch {}
})();
