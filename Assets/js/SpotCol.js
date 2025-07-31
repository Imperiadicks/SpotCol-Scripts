(() => {
  const GH_ROOT = 'https://raw.githubusercontent.com/Imperiadicks/SpotCol-Scripts/main/Assets/';
  const JS_BASE = GH_ROOT + 'js/';
  const CSS_BASE = GH_ROOT + 'css/';

  console.log('SPOTCOL v1.1.0');

  const scripts = [
    'Library.js',
    'colorize 2.js',
    // 'BetterPlayer.js',
    'Main.js',
    'SpotifyScreen.js'
  ];

  const styles = [
    'SpotCol.css',
    'Colorize 2.css',
    'BetterPlayer.css',
    'main.css',
    'navbar.css',
    'SpotifyScreen.css',
    'user.css',
    'Rotating Cover Art.css'
  ];

  async function loadScript(name) {
    const url = JS_BASE + encodeURIComponent(name);
    console.log(`[SpotCol] 📦 Загружаю JS: ${url}`);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const code = await res.text();
      const run = Function(code);
      run.call(window);
      console.log(`[SpotCol] ✅ Выполнен: ${name}`);
    } catch (e) {
      console.error(`[SpotCol] ❌ Ошибка загрузки JS: ${name}`, e);
    }
  }

  async function loadCss(name) {
  const url = CSS_BASE + encodeURIComponent(name);
  console.log(`[SpotCol] 🎨 Загружаю CSS: ${url}`);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const css = await res.text();

    // Оборачиваем CSS в уникальный контейнер с классом для изоляции
    const id = `css-${name.replace(/[^a-z0-9]/gi, '-')}`;
    const scoped = `:root.${id} { ${css.match(/--css-version:.*?;/)?.[0] || ''} }`;

    // Вставка реального CSS
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    // Вставка временного контейнера для чтения версии
    const testEl = document.createElement('div');
    testEl.className = id;
    document.body.appendChild(testEl);

    // Задержка для рендера
    requestAnimationFrame(() => {
      const version = getComputedStyle(testEl).getPropertyValue('--css-version')?.trim().replace(/^['"]|['"]$/g, '');
      console.log(`[SpotCol] 📘 ${name} версия: ${version || 'не указана'}`);
      testEl.remove();
    });

    console.log(`[SpotCol] ✅ Подключён: ${name}`);
  } catch (e) {
    console.error(`[SpotCol] ❌ Ошибка загрузки CSS: ${name}`, e);
  }
}

  (async () => {
    await Promise.all(styles.map(loadCss));
    for (const script of scripts) await loadScript(script);
    console.log('[SpotCol] 🟢 Все модули загружены и активированы');
  })();
})();
