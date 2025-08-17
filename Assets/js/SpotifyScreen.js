// === SpotifyScreen — panel + cover/title/artist + like + GPT slots ===
(() => {
  const Theme = window.Theme;
  if (!Theme) { console.error('[SpotifyScreen] Theme is not available'); return; }
  console.log('[SpotifyScreen] load v1.1');

  const Lib = window.Library || {};
  const LOG = '[SpotifyScreen]';

  let $root, $cover, $title, $artist, $like, $origLike, likeObserver, keepAliveObs;
  let $gpt, $gptTitle, $gptText, $gptExtra, $gptActions, $alert;
  let uiBound = false;
  let prevLiked = null;
  let lastCover = '';

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

  // лайк ТОЛЬКО из плеербара (чтобы к альбомам/плейлистам не липнуть)
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

      <section class="SM_GPT" data-gpt="container">
        <header class="SM_GPT_Header">
          <div class="SM_GPT_Title" data-gpt="title"></div>
          <div class="SM_GPT_Actions" data-gpt="actions"></div>
        </header>
        <div class="SM_GPT_Body">
          <div class="SM_GPT_Text" data-gpt="text"></div>
          <div class="SM_GPT_Extra" data-gpt="extra" hidden></div>
        </div>
      </section>

      <footer class="Achtung_Alert" hidden>
        В сведениях иногда бывают неправильные результаты.
        Проверьте информацию подробнее, если изначально вам не всё равно!
      </footer>
    `;

    (findAnchor() || document.body).insertAdjacentElement('afterbegin', root);

    $root     = root;
    $cover    = root.querySelector('.SM_Cover');
    $title    = root.querySelector('.SM_Track_Name');
    $artist   = root.querySelector('.SM_Artist');
    $gpt      = root.querySelector('.SM_GPT');
    $gptTitle = root.querySelector('.SM_GPT_Title');
    $gptText  = root.querySelector('.SM_GPT_Text');
    $gptExtra = root.querySelector('.SM_GPT_Extra');
    $gptActions = root.querySelector('.SM_GPT_Actions');
    $alert    = root.querySelector('.Achtung_Alert');

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

    // синхронизируем SVG
    const svgO = $origLike.querySelector('svg');
    const svgC = $like.querySelector('svg');
    if (svgO) {
      svgC ? svgC.replaceWith(svgO.cloneNode(true)) : $like.appendChild(svgO.cloneNode(true));
    }

    const liked = isLiked($origLike);
    $like.classList.toggle('Like_active', liked);

    if (liked !== prevLiked) {
      // анимация на «переключение» (ожидается, что CSS её оформляет)
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

  // ───────────────────────── Track helpers ─────────────────────────
  function deriveCoverURL(track) {
    return (
      Lib.util?.coverURLFromTrack?.(track, '1000x1000') ||
      Lib.coverURL?.() ||
      track?.coverUrl ||
      track?.cover ||
      ''
    );
  }

  function deriveTitle(track) {
    return track?.title || track?.name || '';
  }

  function deriveArtist(track) {
    if (track?.artists && Array.isArray(track.artists) && track.artists.length) {
      return track.artists.map(a => a.name || a.title || a).join(', ');
    }
    return track?.artist || track?.author || '';
  }

  // если у тебя в CSS есть переходы для .SM_Cover — просто меняем bgImage
  function updateCover(url) {
    if (!url || !$cover) return;
    if (url === lastCover) return;
    lastCover = url;
    $cover.style.backgroundImage = `url("${url}")`;
  }

  function updateTexts(track) {
    if (!$title || !$artist) return;
    const t = deriveTitle(track);
    const a = deriveArtist(track);
    $title.textContent = t || '';
    $artist.textContent = a || '';
  }

  // ───────────────────────── Track update ─────────────────────────
  function updateTrackUI(track) {
    if (!track) return;
    buildOnce();
    ensureMounted();

    // 1) обложка/тексты (fallback своими руками)
    updateCover(deriveCoverURL(track));
    updateTexts(track);

    // 2) если есть твой helper — пусть тоже отработает (он умеет кроссфейдить)
    try {
      Lib.ui?.updateTrackUI?.(
        { cover: '.SM_Cover', title: '.SM_Track_Name', artist: '.SM_Artist' },
        track,
        { duration: 600 }
      );
    } catch {}

    // 3) на всякий — перехватить лайк после изменения вёрстки
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

  // ───────────────────────── Public API (в т.ч. для GPT-файла) ──────────
  // Эти методы будут вызывать из отдельного файла с fetch к ChatGPT
  const API = {
    init() { buildOnce(); bindToTrackBusOnce(); },
    check(){ buildOnce(); attachLikeObserver(); },

    // управление GPT-блоком (без логики fetch)
    setGPTTitle(text)      { buildOnce(); $gptTitle.textContent = text ?? ''; },
    setGPTText(htmlOrText) { buildOnce(); $gptText.innerHTML = htmlOrText ?? ''; },
    setGPTExtra(html, show=true){ buildOnce(); $gptExtra.innerHTML = html ?? ''; $gptExtra.hidden = !show; },
    setGPTActions(node)    { buildOnce(); $gptActions.replaceChildren(); if (node) $gptActions.appendChild(node); },
    showAlert(flag=true)   { buildOnce(); $alert.hidden = !flag; },
    hideAlert()            { buildOnce(); $alert.hidden = true; }
  };

  Theme.SpotifyScreen = API;

  // автоинициализация (если плеер уже есть)
  try { Theme.SpotifyScreen.init(); } catch {}
})();
