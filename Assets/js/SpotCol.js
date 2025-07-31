(() => {
  const GH_ROOT = 'https://raw.githubusercontent.com/Imperiadicks/SpotCol-Scripts/main/Assets/';
  const JS_BASE = GH_ROOT + 'js/';
  const CSS_BASE = GH_ROOT + 'css/';

  console.log('[SpotCol] v1.1.5');

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

    return new Promise(resolve => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;

      link.onload = () => {
        console.log(`[SpotCol] ✅ Подключён: ${name}`);

        const testEl = document.createElement('div');
        document.body.appendChild(testEl);

        requestAnimationFrame(() => {
          const styles = getComputedStyle(testEl);
          const version = styles.getPropertyValue('--css-version')?.trim().replace(/^['"]|['"]$/g, '');
          if (version) {
            console.log(`%c[SpotCol] 📘 ${name} версия: ${version}`, 'color: #3498db');
          } else {
            console.log(`%c[SpotCol] ⚠️ ${name} версия: не указана`, 'color: #e67e22');
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
