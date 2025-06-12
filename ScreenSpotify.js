// ScreenSpotify.js

// ---------------------------------------------
// Глобальные константы для CDN и локальных JSON/Assets
// ---------------------------------------------
const BASE = 'https://cdn.jsdelivr.net/gh/Imperiadicks/SpotCol-Scripts@13503c7';
const URLS = {
  noCover: `${BASE}/Assets/no-cover-image.png`,
};

// WolfyLibrary Theme: SpotColЛичная (v5.0)
SpotCol.stylesManager.add(
  'spotify-like-wrapper',
  `.LikeTrack{flex:0 0 42px;
   display:flex;
   align-items:center;
   justify-content:center;
   cursor:pointer;
   top: 10px;
   right: 14px;}
   @keyframes likePulse{0%{transform:scale(1);}45%{transform:scale(1.25);}100%{transform:scale(1);} }
   .LikeTrack.animate{animation:likePulse .35s ease-out;}
  `
);

;(function(theme) {
  let $root, $bg, $cover, $track, $artist, $like, $origLike, observer;
  let prevLiked = null;

  const isLiked = node => {
    if (!node) return false;
    if (node.getAttribute('aria-checked') !== null)
      return node.getAttribute('aria-checked') === 'true';
    return node.classList.contains('Like_active') ||
      !!node.querySelector('svg[class*="_active"], svg[class*="-active"], svg .LikeIcon_active');
  };

  const syncState = () => {
    if (!$origLike || !$like) return;
    const svgO = $origLike.querySelector('svg');
    const svgC = $like.querySelector('svg');
    if (svgO) {
      svgC ? svgC.replaceWith(svgO.cloneNode(true)) : $like.appendChild(svgO.cloneNode(true));
    }
    const liked = isLiked($origLike);
    $like.classList.toggle('Like_active', liked);
    if (liked !== prevLiked) {
      $like.classList.add('animate');
      setTimeout(() => { $like && $like.classList.remove('animate'); }, 350);
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
    const selectors = [
      '.FullscreenPlayerDesktopControls_likeButton__vpJ7S[data-test-id="LIKE_BUTTON"]',
      '.PlayerBarDesktop_root__d2Hwi [data-test-id="LIKE_BUTTON"]',
      '[data-test-id="PLAYERBAR_DESKTOP_LIKE_BUTTON"]',
      '[data-test-id="LIKE_BUTTON"]'
    ];
    return selectors
      .map(q => document.querySelector(q))
      .find(Boolean) || null;
  };

  const createClone = () => {
    $origLike = findOriginalLike();
    prevLiked = null;
    if (!$origLike) return el('div', 'LikeTrack');
    const clone = $origLike.cloneNode(true);
    clone.classList.add('LikeTrack');
    clone.removeAttribute('data-test-id');
    clone.addEventListener('click', () => { $origLike.click(); });
    attachObserver();
    syncState();
    return clone;
  };

  const build = () => {
    if ($root) return;
    $root   = el('div', 'Spotify_Screen', document.body);
    $bg     = el('div', 'SM_Background', $root);
    $cover  = el('div', 'SM_Cover', $root);

    const row = el('div', 'SM_Title_Line', $root);
    $track    = el('div', 'SM_Track_Name', row);
    $like     = createClone();
    row.appendChild($like);
    $artist   = el('div', 'SM_Artist', $root);

    const info = el('div', 'All_Info_Container', $root);
    const art  = el('div', 'Artist_Info_Container', info);
    el('div', 'Info_Title', art, 'Сведения об исполнителе');
    el('div', 'Search_Info', art);
    const gpt  = el('div', 'GPT_Info_Container', info);
    el('div', 'GPT_Info_Title', gpt, 'Сведения о треке');
    el('div', 'GPT_Search_Info', gpt);
    el('div', 'Achtung_Alert', info,
       'В сведениях иногда бывают неправильные результаты. Проверяйте информацию подробнее, если изначально вам не всё равно!'
    );
  };

  const update = state => {
    build();
    if (!$origLike || !document.contains($origLike)) {
      const fresh = createClone();
      $like.replaceWith(fresh);
      $like = fresh;
    }

    const t = state.track || {};
    const img = t.coverUri
      ? `https://${t.coverUri.replace('%%', '1000x1000')}`
      : URLS.noCover;
    [$bg, $cover].forEach(n =>
      n.style.background = `url(${img}) center/cover no-repeat`
    );
    $track.textContent  = t.title || '';
    $artist.textContent = (t.artists || []).map(a => a.name).join(', ');
    syncState();
    $root.style.display = 'block';
  };

  theme.player.on('openPlayer',   ({ state }) => update(state));
  theme.player.on('trackChange',  ({ state }) => update(state));

  function el(tag, cls, parent = document.body, txt) {
    const node = document.createElement(tag);
    node.classList.add(cls);
    if (txt) node.textContent = txt;
    parent.appendChild(node);
    return node;
  }
})(SpotCol);

// === GPT/UI helper: без изменений ===
(function() {
  // === Построение UI ===
  function clearUI() {
    UI.artist()      && (UI.artist().textContent      = '');
    UI.track()       && (UI.track().textContent       = '');
    UI.searchInfo()  && (UI.searchInfo().innerHTML    = '');
    UI.alert()       && (UI.alert().style.display     = 'none');
    UI.box()         && (UI.box().style.display       = 'none');
  }

  function buildPrompt(artist, track) {
    let p = `Ты помощник. Дай краткие факты о треке "${track}"${artist ? ` исполнителя "${artist}"` : ''}.`;
    return p;
  }

  async function streamGPT(prompt, onChunk) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Token.get('openai')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        stream: true,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const reader = res.body.getReader();
    let acc = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = new TextDecoder().decode(value);
      const parts = chunk
        .split(/\\n/)
        .filter(l => l.startsWith('data: '))
        .map(l => l.replace(/^data: /, ''));
      for (const part of parts) {
        if (part === '[DONE]') return;
        try {
          const js = JSON.parse(part);
          const piece = js.choices[0].delta.content || '';
          acc += piece;
          onChunk(acc);
        } catch {}
      }
    }
  }

  async function fetchGPT(artist, track) {
    const artEl   = UI.artist();
    const trEl    = UI.track();
    const alert   = UI.alert();
    const box     = UI.box();
    if (!artEl || !trEl) return;
    box && (box.style.display = 'block');
    artEl.textContent = '⏳';
    trEl.textContent  = '';
    ctl && ctl.abort();
    ctl = new AbortController();

    const prompt = buildPrompt(artist, track);
    try {
      if (useStream) {
        await streamGPT(prompt, acc => {
          UI.searchInfo() && (UI.searchInfo().innerHTML = acc.replace(/\\n/g, '<br>'));
        });
      } else {
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${Token.get('openai')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            stream: false,
            messages: [{ role: 'user', content: prompt }]
          })
        });
        const j = await resp.json();
        const txt = j.choices?.[0]?.message?.content || 'Нет данных';
        UI.searchInfo() && (UI.searchInfo().innerHTML = txt.replace(/\\n/g, '<br>'));
      }
    } catch {
      UI.searchInfo() && (UI.searchInfo().innerHTML = '<b>Ошибка GPT</b>');
    }
  }

  /* === WIKI FALLBACK === */
  async function fetchWiki(query) {
    const out   = UI.artist();
    const alert = UI.alert();
    if (!out) return;
    try {
      const url = 'https://ru.wikipedia.org/w/api.php?action=query&format=json&origin=*' +
                  '&titles=' + encodeURIComponent(query) +
                  '&prop=extracts&exintro&explaintext';
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const j   = await res.json();
      const page = Object.values(j.query.pages)[0] || {};
      const text = page.extract || 'Информация не найдена';
      out.innerHTML = text.replace(/\\r?\\n/g, '<br>');
      alert.style.display = 'block';
    } catch {
      out.innerHTML   = '<b>Ошибка Wiki</b>';
      alert.style.display = 'none';
    }
  }

  function refresh() {
    const a = SpotCol.player.state.track?.artists?.[0]?.name;
    const t = SpotCol.player.state.track?.title;
    clearUI();
    if (useGPT) {
      fetchGPT(a, t);
    } else {
      UI.box() && (UI.box().style.display = 'none');
      fetchWiki(a || t);
    }
  }

  refresh();
  setInterval(refresh, 1200);
})();
