(() => {
  if (window.WolfyLibrary) return;

  const log = (...a) => {
    if (window.__WOLFY_DEBUG__) console.log('[WolfyLibrary]', ...a);
  };

  /* ───────────────── 1. EventEmitter ───────────────── */
  class EventEmitter {
    #ev = Object.create(null);
    on(e, fn) { (this.#ev[e] ??= []).push(fn); return this; }
    off(e, fn) { this.#ev[e] = (this.#ev[e] || []).filter(f => f !== fn); return this; }
    emit(e, d) { (this.#ev[e] || []).forEach(f => f(d)); return this; }
    once(e, fn) {
      const g = (...a) => { this.off(e, g); fn(...a); };
      return this.on(e, g);
    }
    removeAllListeners(e) {
      e ? delete this.#ev[e] : this.#ev = Object.create(null);
    }
  }

  /* ───────────────── 2. StylesManager ───────────────── */
  class StylesManager {
    #bag = {};
    #flush() {
      let tag = document.getElementById('wolfy-style');
      if (!tag) {
        tag = document.createElement('style');
        tag.id = 'wolfy-style';
        document.head.appendChild(tag);
      }
      tag.textContent = this.result;
    }

    add(name, css) {
      if (!name || !css) return;
      this.#bag[name] = css;
      this.#flush();
    }

    remove(name) {
      delete this.#bag[name];
      this.#flush();
    }

    clear() {
      this.#bag = {};
      this.#flush();
    }

    get result() {
      return Object.values(this.#bag).join('\n\n');
    }

    get keys() {
      return Object.keys(this.#bag);
    }
  }

  /* ───────────────── 3. SettingsManager ───────────────── */
  class SettingsManager extends EventEmitter {
    #store = {};
    #defaults = {};

    constructor(initial = {}) {
      super();
      this.#store = { ...initial };
    }

    get(key) {
      return this.#store[key];
    }

    set(key, value) {
      const old = this.#store[key];
      this.#store[key] = value;
      if (old !== value) this.emit('change', { key, value, old });
    }

    toggle(key) {
      this.set(key, !this.get(key));
    }

    has(key) {
      return Object.hasOwn(this.#store, key);
    }

    clear() {
      this.#store = {};
      this.emit('reset');
    }

    defaults(obj) {
      this.#defaults = { ...obj };
      for (const [k, v] of Object.entries(obj)) {
        if (!this.has(k)) this.set(k, v);
      }
    }

    getAll() {
      return { ...this.#store };
    }

    onChange(key, callback) {
      this.on('change', ({ key: changedKey, value }) => {
        if (changedKey === key) callback(value);
      });
    }
  }

  /* ───────────────── 4. UI ───────────────── */
  const UI = {
    alert(msg, timeout = 2500) {
      const el = document.createElement('div');
      el.textContent = msg;
      Object.assign(el.style, {
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#222',
        color: '#fff',
        padding: '10px 20px',
        borderRadius: '8px',
        zIndex: 9999,
        fontSize: '14px',
        fontFamily: 'sans-serif',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        opacity: '0',
        transition: 'opacity 0.3s ease'
      });
      document.body.appendChild(el);
      requestAnimationFrame(() => el.style.opacity = '1');
      setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 300);
      }, timeout);
    },

    artist(html) {
      const container = document.createElement('div');
      Object.assign(container.style, {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: '#111',
        color: '#fff',
        padding: '20px',
        borderRadius: '12px',
        maxWidth: '80vw',
        maxHeight: '70vh',
        overflowY: 'auto',
        zIndex: 10000,
        fontFamily: 'sans-serif',
      });
      container.innerHTML = html;
      const close = document.createElement('button');
      close.textContent = 'Закрыть';
      Object.assign(close.style, {
        marginTop: '20px',
        background: '#333',
        color: '#fff',
        border: 'none',
        padding: '10px',
        cursor: 'pointer',
        borderRadius: '6px'
      });
      close.onclick = () => container.remove();
      container.appendChild(close);
      document.body.appendChild(container);
    }
  };

  /* ───────────────── 5. Theme ───────────────── */
  class Theme {
    constructor(id) {
      if (!id) throw new Error("Theme must have an ID");
      this.id = id;
      this.stylesManager = new StylesManager();
      this.settingsManager = new SettingsManager();
      this.context = {};
      this.events = new EventEmitter();
      log('Theme initialized:', id);
    }

    on(...a) { this.events.on(...a); }
    off(...a) { this.events.off(...a); }
    emit(...a) { this.events.emit(...a); }

    setContext(key, value) {
      this.context[key] = value;
    }

    getContext(key) {
      return this.context[key];
    }
  }

  /* ───────────────── 6. Global export ───────────────── */
  window.WolfyLibrary = {
    Theme,
    UI,
    SettingsManager,
    StylesManager,
    EventEmitter
  };

  log('Library loaded');
})();
