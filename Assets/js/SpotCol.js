(() => {
  const GH_ROOT = 'https://raw.githubusercontent.com/Imperiadicks/SpotCol-Scripts/main/Assets/';
  const JS_BASE = GH_ROOT + 'js/';
  const CSS_BASE = GH_ROOT + 'css/';

  console.log('[SpotCol] v1.1.1');

  const scripts = [
    'Library.js',
    'colorize 2.js',
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

      // Вставка CSS
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);

      // Создаём скрытый div с уникальным классом для этой темы
      const testDiv = document.createElement('div');
      const className = `css-check-${name.replace(/[^a-z0-9]/gi, '-')}`;
      testDiv.className = className;
      testDiv.style.display = 'none';
      document.body.appendChild(testDiv);

      // Ждём отрисовку
      requestAnimationFrame(() => {
        const version = getComputedStyle(testDiv).getPropertyValue('--css-version')?.trim().replace(/^['"]|['"]$/g, '');
        console.log(`[SpotCol] 📘 ${name} версия: ${version || 'не указана'}`);
        testDiv.remove();
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
