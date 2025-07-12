(function () {
  'use strict';

  console.log('[SpotifyScreen] Запуск');

  const theme = window.Imperiadicks instanceof Theme
    ? window.Imperiadicks
    : new Theme(Theme.getThemeId());
  window.Imperiadicks = theme;

  const sm     = theme.settingsManager;
  const styles = theme.stylesManager;
  const player = theme.sonataState;

  const modelMap = {
    1: 'searchgpt',
    2: 'gpt-4o-mini',
    3: 'llama-3.3',
    4: 'gemini-2.0-flash',
    5: 'gemini-2.0-flash-mini'
  };

  const ENDPOINT = 'https://api.onlysq.ru/ai/v2';
  const DEFAULT_IMG = 'http://127.0.0.1:2007/Assets/no-cover-image.png';

  let neuroSearch = sm.get('gptSearch')?.value ?? false;
  let useStream   = sm.get('useStream')?.value ?? false;
  let useModel    = modelMap[sm.get('useModel')?.value] || 'searchgpt';

  sm.onChange('gptSearch', val => {
    neuroSearch = val;
    console.log('[Settings] Изменён gptSearch:', val);
  });

  sm.onChange('useStream', val => {
    useStream = val;
    console.log('[Settings] Изменён useStream:', val);
  });

  sm.onChange('useModel', val => {
    useModel = modelMap[val] || 'searchgpt';
    console.log('[Settings] Изменена модель:', useModel);
  });

  const RE_A = /===\s*(Артист|Artist|Исполнитель)\s*===/i;
  const RE_T = /===\s*(Трек|Track|Song|Песня)\s*===/i;

  function el(tag, cls, par = document.body, txt) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined) n.textContent = txt;
    par.appendChild(n);
    return n;
  }

  function md2html(md = '') {
    return md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
             .replace(/\[(.+?)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
             .replace(/^(#{1,6})\s+(.+)$/gm, (_, h, t) => `<h${h.length}>${t}</h${h.length}>`)
             .replace(/\*\*(.+?)\*\*|__(.+?)__/g, '<strong>$1$2</strong>')
             .replace(/\*(.+?)\*|_(.+?)_/g, '<em>$1$2</em>')
             .replace(/\r?\n/g, '<br>');
  }

  function split(txt) {
    const ai = txt.search(RE_A), ti = txt.search(RE_T);
    let a = '', t = '';
    if (ai >= 0 && ti >= 0) {
      if (ai < ti) { a = txt.slice(ai, ti); t = txt.slice(ti); }
      else { t = txt.slice(ti, ai); a = txt.slice(ai); }
    } else if (ai >= 0) a = txt.slice(ai);
    else if (ti >= 0) t = txt.slice(ti);
    else a = txt;
    return {
      artist: a.replace(RE_A, '').trim(),
      track: t.replace(RE_T, '').trim()
    };
  }

  async function streamGPT(prompt, onChunk) {
    console.log('[GPT-STREAM] Модель:', useModel);
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: useModel,
        request: {
          messages: [{ role: 'user', content: prompt }],
          stream: true
        }
      })
    });
    const rd = res.body.getReader();
    const dec = new TextDecoder('utf-8');
    let acc = '';
    while (true) {
      const { done, value } = await rd.read();
      if (done) break;
      const chunk = dec.decode(value, { stream: true });
      for (let line of chunk.split('\n')) {
        if (!(line = line.trim()) || line === '[DONE]') continue;
        if (line.startsWith('data:')) line = line.slice(5).trim();
        try {
          const js = JSON.parse(line);
          const piece = js.choices?.[0]?.delta?.content || '';
          acc += piece;
          onChunk(acc);
        } catch (e) {
          console.log('[GPT-STREAM] Ошибка парсинга:', e);
        }
      }
    }
    console.log('[GPT-STREAM] Завершено');
  }

  async function fetchWiki(q) {
    console.log('[Wiki] Загрузка для:', q);
    const elA = document.querySelector('.Search_Info');
    const alert = document.querySelector('.Achtung_Alert');
    if (!elA) return;
    try {
      const url = 'https://ru.wikipedia.org/w/api.php?action=query&format=json&origin=*' +
                  '&titles=' + encodeURIComponent(q) + '&prop=extracts&exintro&explaintext';
      const r = await fetch(url);
      const j = await r.json();
      const page = Object.values(j.query.pages)[0] || {};
      const text = page.extract || 'Информация не найдена';
      elA.innerHTML = md2html(text);
      alert.style.display = 'block';
    } catch {
      elA.innerHTML = '<b>Ошибка Wiki</b>';
      alert.style.display = 'none';
    }
  }

  async function fetchGPT(artist, track) {
    console.log('[GPT] fetchGPT:', useModel, 'стрим:', useStream);
    const elA = document.querySelector('.Search_Info');
    const elT = document.querySelector('.GPT_Search_Info');
    const alert = document.querySelector('.Achtung_Alert');
    if (!elA || !elT) return;

    elA.textContent = '⏳ ChatGPT…';
    elT.textContent = '';
    alert.style.display = 'none';

    const prompt = [
      'Всегда отвечай по-русски без эмодзи.',
      '=== Артист ===', artist || '—', '',
      '=== Трек ===', artist ? `${artist} — ${track}` : track || '—'
    ].join('\n');

    try {
      if (useStream) {
        await streamGPT(prompt, (acc) => {
          const { artist: a, track: t } = split(acc);
          elA.innerHTML = md2html(a);
          elT.innerHTML = md2html(t);
        });
      } else {
        const r = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: useModel,
            request: { messages: [{ role: 'user', content: prompt }] }
          })
        });
        const j = await r.json();
        const txt = j.choices?.[0]?.message?.content || 'Информация не найдена';
        const { artist: a, track: t } = split(txt);
        elA.innerHTML = md2html(a);
        elT.innerHTML = md2html(t);
      }
      alert.style.display = 'block';
    } catch (e) {
      elA.innerHTML = '<b>Ошибка GPT</b>';
      elT.textContent = '';
      alert.style.display = 'none';
    }
  }

  let $root, $bg, $cover, $track, $artist;
  function buildUI() {
    if ($root) return;
    $root = el('div', 'Spotify_Screen');
    $bg   = el('div', 'SM_Background', $root);
    $cover= el('div', 'SM_Cover', $root);
    const row = el('div', 'SM_Title_Line', $root);
    $track = el('div', 'SM_Track_Name', row);
    $artist = el('div', 'SM_Artist', $root);
    const info = el('div', 'All_Info_Container', $root);
    const art  = el('div', 'Artist_Info_Container', info);
    const gpt  = el('div', 'GPT_Info_Container', info);
    el('div', 'Info_Title', art, 'Сведения об исполнителе');
    el('div', 'Search_Info', art);
    el('div', 'GPT_Info_Title', gpt, 'Сведения о треке');
    el('div', 'GPT_Search_Info', gpt);
    el('div', 'Achtung_Alert', info, 'Информация может содержать ошибки.');
  }

  function clearUI() {
    document.querySelector('.Search_Info')?.replaceChildren();
    document.querySelector('.GPT_Search_Info')?.replaceChildren();
    const a = document.querySelector('.Achtung_Alert');
    if (a) a.style.display = 'none';
  }

  theme.on('clear-screen', clearUI);

  function updateUI(state) {
    buildUI();
    const t = state.track || {};
    const img = t.coverUri ? `https://${t.coverUri.replace('%%', '1000x1000')}` : DEFAULT_IMG;
    const art = (t.artists || []).map(a => a.name).join(', ');
    const ttl = t.title || '';
    [$bg, $cover].forEach(n => n.style.background = `url(${img}) center/cover no-repeat`);
    const changed = $track.textContent !== ttl || $artist.textContent !== art;
    $track.textContent = ttl;
    $artist.textContent = art;
    if (changed) {
      clearUI();
      neuroSearch ? fetchGPT(art, ttl) : fetchWiki(art || ttl);
    }
    $root.style.display = 'block';
  }

  player.on('trackChange', ({ state }) => updateUI(state));
  player.on('play',        ({ state }) => updateUI(state));

  if (player.state?.track) updateUI(player.state);

  let pa = '', pt = '';
  setInterval(() => {
    const a = player.state.track?.artists?.map(x => x.name).join(', ') || '';
    const t = player.state.track?.title || '';
    if (a !== pa || t !== pt) {
      pa = a; pt = t;
      updateUI(player.state);
    }
  }, 1600);
})();
ы