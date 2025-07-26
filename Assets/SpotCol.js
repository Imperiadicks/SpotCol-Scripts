(() => {
  const GH_BASE = 'https://raw.githubusercontent.com/Imperiadicks/SpotCol-Scripts/main/Assets/';

  const scripts = [
    'Library.js',
    'colorize 2.js',
    'Main.js',
    'SpotifyScreen.js'
  ];

  const styles = [
    'SpotCol.css',
    'Colorize 2.css'
  ];

  async function loadScript(name) {
    const url = GH_BASE + encodeURIComponent(name);
    console.log(`[SpotCol] 📦 Загружаю ${name} → ${url}`);
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.onload = () => {
        console.log(`[SpotCol] ✅ ${name} загружен и выполнен`);
        resolve();
      };
      s.onerror = e => {
        console.error(`[SpotCol] ❌ Не удалось загрузить ${name}:`, e);
        reject(e);
      };
      s.async = false; // <-- ключевой момент
      document.head.appendChild(s);
    });
  }

  async function loadCss(name) {
    const url = GH_BASE + encodeURIComponent(name);
    console.log(`[SpotCol] 🎨 Загружаю CSS → ${url}`);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const css = await res.text();
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
      console.log(`[SpotCol] ✅ CSS ${name} подключён`);
    } catch (e) {
      console.error(`[SpotCol] ❌ CSS ошибка: ${name}`, e);
    }
  }

  (async () => {
    for (const style of styles) await loadCss(style);
    for (const script of scripts) await loadScript(script);
    console.log('[SpotCol] 🟢 Все модули загружены');
  })();
})();
