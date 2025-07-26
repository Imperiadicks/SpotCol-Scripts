const SpotColЛичная = window.Theme;
console.log("проверка SPOTIFYSCREEN 1")
if (!SpotColЛичная) {
  console.error("[SpotifyScreen] Theme is not available.");
  throw new Error("Theme not loaded");
}

// 🎨 Базовые стили Like‑кнопки
SpotColЛичная.stylesManager.add('spotify-like-wrapper', `
  .LikeTrack {
    flex: 0 0 42px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    top: 10px;
    right: 14px;
  }
  @keyframes likePulse {
    0%   { transform: scale(1); }
    45%  { transform: scale(1.25); }
    100% { transform: scale(1); }
  }
  .LikeTrack.animate {
    animation: likePulse 0.35s ease-out;
  }
`);

// 🎛 Переменные
let $root, $bg, $cover, $track, $artist, $like, $origLike, observer;
let prevLiked = null;

// 🔧 Утилиты
const el = (tag, cls, parent, txt = '') => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt) n.textContent = txt;
  (parent ?? document.body).appendChild(n);
  return n;
};

const isLiked = node => {
  if (!node) return false;
  if (node.getAttribute('aria-checked') !== null)
    return node.getAttribute('aria-checked') === 'true';
  return node.classList.contains('Like_active') ||
         !!node.querySelector('svg[class*="_active"],svg[class*="-active"],svg .LikeIcon_active');
};

const syncState = () => {
  if (!$origLike || !$like) return;
  const src = $origLike.querySelector('svg');
  const dst = $like.querySelector('svg');
  if (src) dst ? dst.replaceWith(src.cloneNode(true))
               : $like.appendChild(src.cloneNode(true));

  const liked = isLiked($origLike);
  $like.classList.toggle('Like_active', liked);
  if (liked !== prevLiked) {
    $like.classList.add('animate');
    setTimeout(() => $like?.classList.remove('animate'), 350);
    prevLiked = liked;
  }
};

const attachObserver = () => {
  if (observer) observer.disconnect();
  if (!$origLike) return;
  observer = new MutationObserver(syncState);
  observer.observe($origLike, { attributes: true, childList: true, subtree: true });
};

const findOriginalLike = () => {
  const sels = [
    '.FullscreenPlayerDesktopControls_likeButton__vpJ7S[data-test-id="LIKE_BUTTON"]',
    '.PlayerBarDesktop_root__d2Hwi [data-test-id="LIKE_BUTTON"]',
    '[data-test-id="PLAYERBAR_DESKTOP_LIKE_BUTTON"]',
    '[data-test-id="LIKE_BUTTON"]'
  ];
  return sels.map(q => document.querySelector(q)).find(Boolean) || null;
};

const createClone = () => {
  $origLike = findOriginalLike();
  prevLiked = null;
  if (!$origLike) return el('div', 'LikeTrack');
  const c = $origLike.cloneNode(true);
  c.classList.add('LikeTrack');
  c.removeAttribute('data-test-id');
  c.onclick = () => $origLike.click();
  attachObserver();
  syncState();
  return c;
};

// 🧱 Построение интерфейса
const build = () => {
  if ($root) return;

  const layout = document.querySelector('div[class^="CommonLayout_root"]');
  const content = layout?.querySelector('div[class*="Content_rootOld"]');

  $root  = el('div', 'Spotify_Screen');
  $bg    = el('div', 'SM_Background', $root);
  $cover = el('div', 'SM_Cover',      $root);

  if (content) {
    content.insertAdjacentElement('afterend', $root);
  } else if (layout) {
    layout.appendChild($root);
  } else {
    document.body.appendChild($root);
  }

  const row = el('div', 'SM_Title_Line', $root);
  $track  = el('div', 'SM_Track_Name', row);
  $like   = createClone();
  row.appendChild($like);
  $artist = el('div', 'SM_Artist', $root);

  const info = el('div', 'All_Info_Container', $root);
  const art  = el('div', 'Artist_Info_Container', info);
  el('div', 'Info_Title',  art, 'Сведения об исполнителе');
  el('div', 'Search_Info', art);
  const gpt = el('div', 'GPT_Info_Container', info);
  el('div', 'GPT_Info_Title', gpt, 'Сведения о треке');
  el('div', 'GPT_Search_Info', gpt);
  el('div', 'Achtung_Alert',   info,
     'В сведениях иногда бывают неправильные результаты. Проверяйте информацию подробнее, если изначально вам не всё равно!');
};

// 🔁 Обновление контента
const update = state => {
  build();
  if (!$origLike || !document.contains($origLike)) {
    const fresh = createClone();
    $like.replaceWith(fresh); $like = fresh;
  }

  const t = state.track || {};
  const img = t.coverUri
    ? `https://${t.coverUri.replace('%%', '1000x1000')}`
    : 'https://raw.githubusercontent.com/Imperiadicks/SpotCol-Scripts/main/Assets/no-cover.png';

  [$bg, $cover].forEach(n => n.style.background = `url(${img}) center/cover no-repeat`);
  $track.textContent  = t.title || '';
  $artist.textContent = (t.artists || []).map(a => a.name).join(', ');
  syncState();
  $root.style.display = 'block';
};

// 🧩 События от плеера
SpotColЛичная.player.on('openPlayer',  ({ state }) => update(state));
SpotColЛичная.player.on('trackChange', ({ state }) => update(state));
// 🚀 Принудительно запускаем update, если уже есть трек
const track = SpotColЛичная.player.getCurrentTrack?.();
if (track?.title || track?.coverUri) {
  update({ track });
}
