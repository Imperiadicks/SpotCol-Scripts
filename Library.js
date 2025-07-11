// ====================================================================
//      WOLFY-STUB  – минимальная замена WolfyLibrary (≈ 120 строк)
//      вставьте ЭТО в самый-самый верх скрипта темы
// ====================================================================
(() => {
  if (window.WolfyLibrary) return;           // если библиотека всё-таки ожила – ничего не делаем

  /* -------- EventEmitter (нужно SpotifyScreen / PlayerEvents) ------- */
  class EventEmitter {
    #ev = {};
    on(e, f){ (this.#ev[e] ??= []).push(f) }
    off(e, f){ this.#ev[e] = (this.#ev[e]||[]).filter(x=>x!==f) }
    emit(e, d){ (this.#ev[e]||[]).forEach(f=>f(d)) }
  }

  /* ----------------- StylesManager (add / remove) ------------------- */
  class StylesManager {
    #store = {};
    add(id, css){ this.#store[id]=css; this.#flush() }
    remove(id){ delete this.#store[id]; this.#flush() }
    clear(){ this.#store={}; this.#flush() }
    #flush(){
      let s = document.getElementById('wolfy-stub-style');
      if(!s){ s=document.createElement('style'); s.id='wolfy-stub-style'; document.head.appendChild(s); }
      s.textContent = Object.values(this.#store).join('\n\n');
    }
  }

  /* ---------------- PlayerEvents (подписки play/track) -------------- */
  class PlayerEvents extends EventEmitter {
    state = { status:'paused', track:{}, volume:0 };
    constructor(){ super(); this.#init(); }
    #init(){
      const wait = setInterval(()=>{
        const sonata = window.sonataState || window.player;
        if(!sonata?.state?.playerState) return;   // ждём пока ЯМ инициализируется
        clearInterval(wait);

        const ps = sonata.state.playerState;
        const qs = sonata.state.queueState;

        /* стартовые значения */
        this.state.track  = qs.currentEntity.value.entity.data.meta;
        this.state.status = ps.status.value;

        /* слушатели */
        ps.status.onChange(st=>{
          this.state.status = st;
          this.emit(st==='playing'?'play':'pause', {state:this.state});
        });

        qs.currentEntity.onChange(()=>{
          this.state.track = qs.currentEntity.value.entity.data.meta;
          this.emit('trackChange', {state:this.state});
        });
      }, 200);
    }
  }

  /* --------------- SettingsManager-заглушка (noop) ------------------ */
  class SettingsManager extends EventEmitter {
    get(){ return { value:false, default:false } }      // чтобы .get('что-угодно') не рушило код
    hasChanged(){ return false }
    on(){ /* из EventEmitter */ super.on(...arguments) }
  }

  /* ------------------- Theme (минималка) ---------------------------- */
  class Theme {
    constructor(id){
      this.id = id;
      this.stylesManager   = new StylesManager();
      this.settingsManager = new SettingsManager(this);
      this.player = new PlayerEvents(this);        // сохранили старое имя
      this.sonataState = this.player;             // для вашего скрипта
    }
    /* методы, которые вызывают BetterPlayer/тема */
    start(){ /* таймер настройки не нужен – всё делают ваши скрипты */ }
    addAction(){ /* noop */ }
  }
window.SETTINGS = {
  store: JSON.parse(localStorage.getItem('spotcol_settings') || '{}'),

  set(key, value) {
    this.store[key] = value;
    localStorage.setItem('spotcol_settings', JSON.stringify(this.store));
  },

  get(key) {
    return this.store[key];
  },

  has(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key);
  },

  clear() {
    this.store = {};
    localStorage.removeItem('spotcol_settings');
  }
};

  /* ---------- экспортируем в глобал, как делает WolfyLibrary -------- */
  window.EventEmitter   = EventEmitter;
  window.StylesManager  = StylesManager;
  window.PlayerEvents   = PlayerEvents;
  window.SettingsManager= SettingsManager;
  window.Theme          = Theme;

  window.WolfyLibrary = {
    EventEmitter, StylesManager, PlayerEvents, SettingsManager, Theme
  };

  console.log('[Wolfy-stub] активирован: WolfyLibrary временно заменён');
})();

// ====================================================================