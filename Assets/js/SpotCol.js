(() => {
  const GH_ROOT = 'https://raw.githubusercontent.com/Imperiadicks/SpotCol-Scripts/main/Assets/';
  const JS_BASE = GH_ROOT + 'js/';
  const CSS_BASE = GH_ROOT + 'css/';

  console.log('SPOTCOL v1.0.6');

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

    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    console.log(`[SpotCol] ✅ Подключён: ${name}`);

    // Ждём, пока CSS применится
    await new Promise(resolve => requestAnimationFrame(resolve));

    // Генерируем ключ вида --spotcol-css-version
    const key = '--' + name
      .replace(/\.css$/i, '')       // убираем расширение
      .replace(/[^a-z0-9]/gi, '')   // убираем лишние символы
      .toLowerCase() + '-css-version';

    const version = getComputedStyle(document.documentElement).getPropertyValue(key)?.trim().replace(/^['"]|['"]$/g, '');

    if (version) {
      console.log(`%c[SpotCol] 📘 ${name} версия: ${version}`, 'color: #3498db');
    } else {
      console.log(`%c[SpotCol] ⚠️ ${name} версия: не указана`, 'color: #e67e22');
    }
  } catch (e) {
    console.error(`[SpotCol] ❌ Ошибка загрузки CSS: ${name}`, e);
  }
}

  (async () => {
    await Promise.all(styles.map(loadCss)); // CSS параллельно
    for (const script of scripts) await loadScript(script); // JS по очереди
    console.log('[SpotCol] 🟢 Все модули загружены и активированы');
  })();
})();
