/* === SpotCol Spotify Screen === */
const SpotColЛичная = new Theme('SpotColЛичная');

/* --- Добавим стили лайка --- */
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
    0% { transform: scale(1); }
    45% { transform: scale(1.25); }
    100% { transform: scale(1); }
  }
  .LikeTrack.animate {
    animation: likePulse 0.35s ease-out;
  }
`);

/* --- UI Setup --- */
(function(theme) {
  let $root, $bg, $cover, $track, $artist, $like, $origLike;
  const container = document.querySelector('[class*="Content_rootOld"]')?.parentElement || document.body;

  function el(tag, cls, parent, txt) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (txt) node.textContent = txt;
    if (parent) parent.appendChild(node);
    return node;
  }

  function createScreen() {
    $root = el('div', 'Spotify_Screen', container);
    $bg = el('div', 'SM_Background', $root);
    const info = el('div', 'All_Info_Container', $root);
    const coverWrap = el('div', 'SM_Cover', info);
    $cover = el('img', '', coverWrap);
    const titleRow = el('div', 'SM_TitleRow', info);
    $track = el('div', 'SM_Track', titleRow);
    $artist = el('div', 'SM_Artist', titleRow);
    $like = el('div', 'LikeTrack', info);
    $like.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6 ..."/></svg>';
    $like.onclick = () => $origLike?.click();
  }

  function isLiked(el) {
    return el?.getAttribute('aria-checked') === 'true' ||
           el?.classList.contains('Like_active') ||
           !!el?.querySelector('svg[class*="active"], svg .LikeIcon_active');
  }

  function syncLikeState() {
    if (!$like || !$origLike) return;
    const liked = isLiked($origLike);
    $like.classList.toggle('active', liked);
  }

  function updateScreen() {
    const coverImg = document.querySelector('[class*="cover"] img');
    const trackName = document.querySelector('[class*="track"]')?.textContent;
    const artistName = document.querySelector('[class*="artist"]')?.textContent;
    $track.textContent = trackName || '';
    $artist.textContent = artistName || '';
    $cover.src = coverImg?.src || '';
    syncLikeState();
    fetchWiki(artistName);
    if (SETTINGS?.['Эффекты']?.gptSearch) fetchGPT(`${trackName} ${artistName}`);
  }

  function fetchWiki(query) {
    if (!query) return;
    fetch(`https://ru.wikipedia.org/w/api.php?origin=*&action=query&format=json&prop=extracts&titles=${encodeURIComponent(query)}&exintro&explaintext`)
      .then(r => r.json())
      .then(d => {
        const page = d.query?.pages[Object.keys(d.query.pages)[0]];
        if (page?.extract) UI.artist(`<b>${query}</b><br><br>${page.extract}`);
      });
  }

  function fetchGPT(prompt) {
    fetch("https://api.onlysq.ru/ai/v2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    })
    .then(r => r.json())
    .then(data => {
      if (data?.result) UI.artist(`<b>GPT:</b><br>${data.result}`);
    });
  }

  function observeTrack() {
    const bar = document.querySelector('[class*="player"]') || document.body;
    const observer = new MutationObserver(() => {
      const btn = document.querySelector('[aria-label="Добавить в «Мне нравится»"]');
      if (btn) $origLike = btn;
      updateScreen();
    });
    observer.observe(bar, { childList: true, subtree: true });
  }

  createScreen();
  observeTrack();
})(SpotColЛичная);