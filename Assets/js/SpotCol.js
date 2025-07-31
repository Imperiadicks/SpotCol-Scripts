(() => {
  const GH_ROOT = 'https://raw.githubusercontent.com/Imperiadicks/SpotCol-Scripts/main/Assets/';
  const JS_BASE = GH_ROOT + 'js/';
  const CSS_BASE = GH_ROOT + 'css/';

  console.log('[SpotCol] v1.1.2');

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

 // Загружаем CSS и проверяем версию
function loadCSS(name, url) {
  return new Promise(resolve => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.onload = () => {
      console.log(`%c[SpotCol] ✅ Подключён: ${name}`, 'color: #2ecc71');
      // Проверка версии
      const testEl = document.createElement('div');
      testEl.className = `css-${name.replace(/[^a-z0-9]/gi, '')}`;
      document.body.appendChild(testEl);

      requestAnimationFrame(() => {
        const styles = getComputedStyle(testEl);
        const version = styles.getPropertyValue('--css-version')?.trim().replace(/^['"]|['"]$/g, '');
        if (version) {
          console.log(`%c[SpotCol] 📘 ${name} версия: ${version}`, 'color: #3498db');
        } else {
          console.log(`%c[SpotCol] ⚠️ ${name}.css версия: не указана`, 'color: #e67e22');
        }
        testEl.remove();
        resolve();
      });
    };
    link.onerror = () => {
      console.log(`%c[SpotCol] ❌ Ошибка загрузки: ${name}`, 'color: #e74c3c');
      resolve();
    };
    document.head.appendChild(link);
  });
}

  (async () => {
    await Promise.all(styles.map(loadCss));
    for (const script of scripts) await loadScript(script);
    console.log('[SpotCol] 🟢 Все модули загружены и активированы');
  })();
})();
