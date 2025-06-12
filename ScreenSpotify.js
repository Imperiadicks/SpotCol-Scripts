const BASE = require('../SpotColЛичная/script');
const URLS = {
  noCover: `${BASE}/Assets/no-cover-image.png`,
  events:  `${BASE}/handleEvents.json`
};

;(function() {
  /**
   * Конструктор плагина ScreenSpotify — получает экземпляр темы SpotCol
   * @param {import('ImperiaLibrary').Theme} theme
   */
  function ScreenSpotify(theme) {
    // 1) Добавляем CSS для кнопки «лайк»
    theme.stylesManager.add(
      'spotify-like-wrapper',
      `.LikeTrack{flex:0 0 42px;
        display:flex;
        align-items:center;
        justify-content:center;
        cursor:pointer;
        top:10px;
        right:14px;}
       @keyframes likePulse{0%{transform:scale(1);}45%{transform:scale(1.25);}100%{transform:scale(1);} }
       .LikeTrack.animate{animation:likePulse .35s ease-out;}`
    );

    // 2) Логика «клон-лайка»
    let $root, $bg, $cover, $track, $artist, $like, $origLike, observer;
    let prevLiked = null;

    function isLiked(node) {
      if (!node) return false;
      if (node.getAttribute('aria-checked') !== null)
        return node.getAttribute('aria-checked') === 'true';
      return node.classList.contains('Like_active') ||
             !!node.querySelector('svg[class*="_active"], svg[class*="-active"], svg .LikeIcon_active');
    }

    function syncLike() {
      if (!$origLike || !$like) return;
      const svgO = $origLike.querySelector('svg');
      const svgC = $like.querySelector('svg');
      if (svgO) {
        svgC ? svgC.replaceWith(svgO.cloneNode(true))
             : $like.appendChild(svgO.cloneNode(true));
      }
      const liked = isLiked($origLike);
      $like.classList.toggle('Like_active', liked);
      if (liked !== prevLiked) {
        $like.classList.add('animate');
        setTimeout(() => $like && $like.classList.remove('animate'), 350);
        prevLiked = liked;
      }
    }

    function attachObserver() {
      if (observer) observer.disconnect();
      if (!$origLike) return;
      observer = new MutationObserver(syncLike);
      observer.observe($origLike, { attributes: true, childList: true, subtree: true });
    }

    function findOriginalLike() {
      const sels = [
        '[data-test-id="LIKE_BUTTON"]',
        '.FullscreenPlayerDesktopControls_likeButton__vpJ7S',
        '.PlayerBarDesktop_root__d2Hwi [data-test-id="LIKE_BUTTON"]'
      ];
      return sels.map(s => document.querySelector(s)).find(Boolean) || null;
    }

    function createLikeClone() {
      $origLike = findOriginalLike();
      prevLiked = null;
      if (!$origLike) return el('div', 'LikeTrack');
      const clone = $origLike.cloneNode(true);
      clone.classList.add('LikeTrack');
      clone.removeAttribute('data-test-id');
      clone.addEventListener('click', () => $origLike.click());
      attachObserver();
      syncLike();
      return clone;
    }

    // 3) Построение DOM-структуры экрана
    function buildUI() {
      if ($root) return;
      $root   = el('div', 'Spotify_Screen', document.body);
      $bg     = el('div', 'SM_Background', $root);
      $cover  = el('div', 'SM_Cover', $root);

      const row = el('div', 'SM_Title_Line', $root);
      $track = el('div', 'SM_Track_Name', row);
      $like  = createLikeClone();
      row.appendChild($like);
      $artist = el('div', 'SM_Artist', $root);

      const info = el('div', 'All_Info_Container', $root);
      const art  = el('div', 'Artist_Info_Container', info);
      el('div', 'Info_Title', art, 'Сведения об исполнителе');
      el('div', 'Search_Info', art);
      const gpt = el('div', 'GPT_Info_Container', info);
      el('div', 'GPT_Info_Title', gpt, 'Сведения о треке');
      el('div', 'GPT_Search_Info', gpt);
      el('div', 'Achtung_Alert', info,
         'В сведениях иногда бывают неправильные результаты. Проверяйте информацию подробнее!'
      );
    }

    // 4) Обновление UI при смене трека/открытии плеера
    function updateUI(state) {
      buildUI();
      if (!$origLike || !document.contains($origLike)) {
        const fresh = createLikeClone();
        $like.replaceWith(fresh);
        $like = fresh;
      }
      const t   = state.track || {};
      const img = t.coverUri
        ? `https://${t.coverUri.replace('%%','1000x1000')}`
        : URLS.noCover;
      [$bg, $cover].forEach(n =>
        n.style.background = `url(${img}) center/cover no-repeat`
      );
      $track.textContent  = t.title  || '';
      $artist.textContent = (t.artists||[]).map(a => a.name).join(', ');
      syncLike();
      $root.style.display = 'block';
    }

    // 5) Подписываемся на события плеера
    theme.player.on('openPlayer',  ({state}) => updateUI(state));
    theme.player.on('trackChange', ({state}) => updateUI(state));

    // 6) GPT / Wiki Helper — _внутри_ конструктора, чтобы сразу получить theme
    const UI = {
      artist: () => document.querySelector('.Search_Info'),
      track:  () => document.querySelector('.GPT_Search_Info'),
      alert:  () => document.querySelector('.Achtung_Alert'),
      box:    () => document.querySelector('.GPT_Info_Container')
    };
    let ctl;
    const useStream = true;

    function clearUI() {
      UI.artist() && (UI.artist().textContent = '');
      UI.track()  && (UI.track().innerHTML  = '');
      UI.alert()  && (UI.alert().style.display = 'none');
      UI.box()    && (UI.box().style.display   = 'none');
    }

    function buildPrompt(artist, track) {
      return `Ты помощник. Дай краткие факты о треке "${track}"${artist?` исполнителя "${artist}"`:''}.`;
    }

    async function streamGPT(prompt) {
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
        const {done, value} = await reader.read();
        if (done) break;
        const chunk = new TextDecoder().decode(value);
        chunk.split(/\n/).forEach(line => {
          if (!line.startsWith('data: ')) return;
          const json = line.replace(/^data: /, '');
          if (json === '[DONE]') return;
          try {
            const j = JSON.parse(json);
            acc += j.choices[0].delta.content || '';
            UI.track() && (UI.track().innerHTML = acc.replace(/\n/g, '<br>'));
          } catch {}
        });
      }
    }

    async function fetchGPT(artist, track) {
      clearUI();
      UI.box() && (UI.box().style.display = 'block');
      const prompt = buildPrompt(artist, track);
      UI.artist() && (UI.artist().textContent = '⏳');
      UI.track()  && (UI.track().innerHTML  = '');
      ctl && ctl.abort();
      ctl = new AbortController();
      try {
        if (useStream) {
          await streamGPT(prompt);
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
          const j   = await resp.json();
          const txt = j.choices?.[0]?.message?.content || 'Нет данных';
          UI.track() && (UI.track().innerHTML = txt.replace(/\n/g, '<br>'));
        }
      } catch {
        UI.track() && (UI.track().innerHTML = '<b>Ошибка GPT</b>');
      }
    }

    async function fetchWiki(query) {
      clearUI();
      const out = UI.artist(), al = UI.alert();
      try {
        const url = 'https://ru.wikipedia.org/w/api.php?action=query&format=json&origin=*' +
                    '&titles=' + encodeURIComponent(query) +
                    '&prop=extracts&exintro&explaintext';
        const res = await fetch(url);
        const j   = await res.json();
        const page = Object.values(j.query.pages)[0] || {};
        out.innerHTML = (page.extract || 'Информация не найдена').replace(/\r?\n/g, '<br>');
        al && (al.style.display = 'block');
      } catch {
        out && (out.innerHTML = '<b>Ошибка Wiki</b>');
        al && (al.style.display = 'none');
      }
    }

    function refresh() {
      const artist = theme.player.state.track?.artists?.[0]?.name;
      const track  = theme.player.state.track?.title;
      if (!artist && !track) return;
      if (window.useGPT) fetchGPT(artist, track);
      else fetchWiki(artist || track);
    }

    theme.player.on('openPlayer',  () => refresh());
    theme.player.on('trackChange', () => refresh());
    refresh();
    setInterval(refresh, 1200);
  }

  // Регистрируем конструктор, чтобы script.js мог сделать new ScreenSpotify(SpotCol)
  window.ScreenSpotify = ScreenSpotify;
})();
