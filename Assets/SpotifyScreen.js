/* =====================================================================================
 * SpotifyScreen.js  (SpotCol, rev‑2025‑07‑16)
 * Работает с WolfyLibrary: Theme, UI, SettingsManager, PlayerEvents
 * =================================================================================== */

/* ------------------------- получение / создание темы ------------------------------ */
const { Theme, UI } = window.WolfyLibrary;
const SpotColЛичная = window.SpotColЛичная ?? (
  window.SpotColЛичная = new Theme('SpotColЛичная')    // если вдруг не создана
);

/* ------------------------------ базовые стили ------------------------------------- */
SpotColЛичная.stylesManager.add('spotify-like-wrapper', `
  .LikeTrack{flex:0 0 42px;display:flex;align-items:center;justify-content:center;
             cursor:pointer;top:10px;right:14px}
  @keyframes likePulse{0%{transform:scale(1);}45%{transform:scale(1.25);}100%{transform:scale(1);} }
  .LikeTrack.animate{animation:likePulse .35s ease-out;}
`);

/* =====================================================================================
 * Экран Spotify‑стиля
 * =================================================================================== */
(() => {
  let $root, $bg, $cover, $track, $artist, $like, $origLike, observer;
  let prevLiked = null;

  /* ----------- helpers ----------- */
  const el = (tag, cls, parent, txt = '') => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt) n.textContent = txt;
    (parent ?? document.body).appendChild(n);
    return n;
  };

  /* ----------- Like‑кнопка — проверка состояния ----------- */
  const isLiked = node => {
    if (!node) return false;
    if (node.getAttribute('aria-checked') !== null)
      return node.getAttribute('aria-checked') === 'true';
    return node.classList.contains('Like_active') ||
           !!node.querySelector('svg[class*=\"_active\"],svg[class*=\"-active\"],svg .LikeIcon_active');
  };

  /* ----------- синхронизация лайка ----------- */
  const syncState = () => {
    if (!$origLike || !$like) return;
    /* svg */
    const src = $origLike.querySelector('svg');
    const dst = $like   .querySelector('svg');
    if (src) dst ? dst.replaceWith(src.cloneNode(true))
                 : $like.appendChild(src.cloneNode(true));

    /* liked state */
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

  /* ----------- поиск исходной кнопки лайка ----------- */
  const findOriginalLike = () => {
    const sels = [
      '.FullscreenPlayerDesktopControls_likeButton__vpJ7S[data-test-id=\"LIKE_BUTTON\"]',
      '.PlayerBarDesktop_root__d2Hwi [data-test-id=\"LIKE_BUTTON\"]',
      '[data-test-id=\"PLAYERBAR_DESKTOP_LIKE_BUTTON\"]',
      '[data-test-id=\"LIKE_BUTTON\"]'
    ];
    return sels.map(q => document.querySelector(q)).find(Boolean) || null;
  };

  /* ----------- клонирование лайка ----------- */
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

  /* ----------- построение интерфейса ----------- */
  const build = () => {
    if ($root) return;
    const container = document.querySelector('[class*=\"Content_rootOld\"]')?.parentElement
                   || document.body;
    $root  = el('div', 'Spotify_Screen',   container);
    $bg    = el('div', 'SM_Background',    $root);
    $cover = el('div', 'SM_Cover',         $root);

    const row = el('div', 'SM_Title_Line', $root);
    $track = el('div', 'SM_Track_Name', row);
    $like  = createClone();
    row.appendChild($like);
    $artist = el('div', 'SM_Artist', $root);

    /* Wiki / GPT блоки */
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

  /* ----------- обновление данных экрана ----------- */
  const update = state => {
    build();

    /* лайк-кнопка могла измениться при переходе из мини‑плеера */
    if (!$origLike || !document.contains($origLike)) {
      const fresh = createClone();
      $like.replaceWith(fresh); $like = fresh;
    }

    const t   = state.track || {};
    const img = t.coverUri
      ? `https://${t.coverUri.replace('%%', '1000x1000')}`
      : 'https://raw.githubusercontent.com/Imperiadicks/SpotCol-Scripts/main/Assets/no-cover.png';

    [$bg, $cover].forEach(n => n.style.background = `url(${img}) center/cover no-repeat`);
    $track.textContent  = t.title || '';
    $artist.textContent = (t.artists || []).map(a => a.name).join(', ');
    syncState();
    $root.style.display = 'block';
  };

  /* ----------- подписка на события плеера ----------- */
  SpotColЛичная.player.on('openPlayer',  ({ state }) => update(state));
  SpotColЛичная.player.on('trackChange', ({ state }) => update(state));
})();

/* =====================================================================================
 * Wiki / GPT helper
 * =================================================================================== */
(() => {
  const sm = SpotColЛичная.settingsManager;
  const modelMap = { 1:'searchgpt', 2:'gpt-4o-mini', 3:'llama-3.3', 4:'gemini-2.0-flash', 5:'gemini-2.0-flash-mini' };

  /* --- reactive settings --- */
  let neuroSearch = sm.get('gptSearch')?.value ?? false;
  let useStream   = sm.get('useStream')?.value   ?? false;
  let useModel    = modelMap[sm.get('useModel')?.value] || 'gpt-4o-mini';

  sm.onChange('gptSearch', v => { neuroSearch = v; clearUI(); refresh(); });
  sm.onChange('useStream', v  => { useStream   = v; clearUI(); refresh(); });
  sm.onChange('useModel',  v  => { useModel    = modelMap[v] || useModel; clearUI(); refresh(); });

  /* --- DOM helpers --- */
  const $ = s => document.querySelector(s);
  const UIbox = () => $('.GPT_Info_Container');
  const UImap = { artist:'.Search_Info', track:'.GPT_Search_Info', alert:'.Achtung_Alert' };
  const UIel  = key => $(UImap[key]);

  const md2html = md => md
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\[(.+?)\]\((https?:[^)]+)\)/g,'<a href=\"$2\" target=\"_blank\" rel=\"noopener\">$1</a>')
    .replace(/^(#{1,6})\s+(.+)$/gm,(_,h,t)=>`<h${h.length}>${t}</h${h.length}>`)
    .replace(/\*\*(.+?)\*\*|__(.+?)__/g,'<strong>$1$2</strong>')
    .replace(/\*(.+?)\*|_(.+?)_/g,'<em>$1$2</em>')
    .replace(/(^|\n)[ \t]*[-*+]\s+(.+)/g,'$1<ul><li>$2</li></ul>')
    .replace(/(^|\n)[ \t]*\d+[.)]\s+(.+)/g,'$1<ol><li>$2</li></ol>')
    .replace(/\r?\n/g,'<br>');

  const clearUI = () => {
    UIel('artist')?.replaceChildren();
    UIel('track') ?.replaceChildren();
    const al = UIel('alert'); if (al) al.style.display = 'none';
    UIbox()?.style.setProperty('display','none');
  };

  /* --- Wiki fallback --- */
  async function fetchWiki(name) {
    const out = UIel('artist'), alert = UIel('alert');
    if (!out) return;
    try {
      const url = `https://ru.wikipedia.org/w/api.php?action=query&format=json&origin=*&titles=${encodeURIComponent(name)}&prop=extracts&exintro&explaintext`;
      const j   = await fetch(url).then(r => r.json());
      const page = Object.values(j.query.pages)[0] || {};
      out.innerHTML       = md2html(page.extract || 'Информация не найдена');
      alert.style.display = 'block';
    } catch {
      out.innerHTML       = '<b>Ошибка Wiki</b>';
      alert.style.display = 'none';
    }
  }

  /* --- GPT (non‑stream, для простоты) --- */
  const endpoint = 'https://api.onlysq.ru/ai/v2';
  async function fetchGPT(a, t) {
    const artEl = UIel('artist'), trEl = UIel('track'), alert = UIel('alert');
    if (!artEl || !trEl) return;
    UIbox()?.style.setProperty('display','block');
    artEl.textContent = '⏳'; trEl.textContent = '';

    const prompt = [
      'Ты всегда отвечаешь на русском.',
      '=== Артист ===', a || '—', '',
      '=== Трек ===',   t ? `${a} — ${t}` : '—'
    ].join('\n');

    try {
      const r = await fetch(endpoint, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ model:useModel,
          request:{ messages:[{role:'user',content:prompt}] } })
      });
      const j   = await r.json();
      const txt = j.choices?.[0]?.message?.content || '';
      const { artistText, trackText } = (() => {
        const reA=/===\\s*(Артист|Artist)\\s*===/i,
              reT=/===\\s*(Трек|Track|Song)\\s*===/i;
        const aIdx=txt.search(reA), tIdx=txt.search(reT);
        let aTxt='', tTxt='';
        if (aIdx>=0&&tIdx>=0){
          aIdx<tIdx ? (aTxt=txt.slice(aIdx,tIdx), tTxt=txt.slice(tIdx))
                    : (tTxt=txt.slice(tIdx,aIdx), aTxt=txt.slice(aIdx));
        } else if (aIdx>=0) aTxt=txt.slice(aIdx);
        else if (tIdx>=0)  tTxt=txt.slice(tIdx);
        else aTxt=txt;
        return {
          artistText:aTxt.replace(reA,'').trim(),
          trackText :tTxt.replace(reT,'').trim()
        };
      })();
      artEl.innerHTML = md2html(artistText);
      trEl.innerHTML  = md2html(trackText);
      alert.style.display = 'block';
    } catch {
      artEl.innerHTML = '<b>Ошибка GPT</b>';
      trEl.innerHTML  = '';
      alert.style.display = 'none';
    }
  }

  /* --- петля обновления --- */
  const selArtist='.SM_Artist', selTrack='.SM_Track_Name';
  let prevA='', prevT='';
  function refresh() {
    const a = (document.querySelector(selArtist)?.textContent || '').trim();
    const t = (document.querySelector(selTrack )?.textContent || '').trim();
    if (!a && !t) return;
    if (a === prevA && t === prevT) return;
    prevA = a; prevT = t;
    clearUI();
    neuroSearch ? fetchGPT(a, t) : fetchWiki(a || t);
  }
  refresh(); setInterval(refresh, 1200);
})();

/* =====================================================================================
 * Запуск авто‑обновления настроек (проверка раз в 1000 мс)
 * =================================================================================== */
SpotColЛичная.start(1000);
