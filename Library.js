/*  WolfyLibrary.js  •  v4.0  (2025-07-12)
 *  Универсальная «прослойка» для тем / плагинов под новую Яндекс-Музыку
 *  ──────────────────────────────────────────────────────────────────
 *  🔹 EventEmitter      on / off / once / emit / removeAllListeners
 *  🔹 StylesManager     add / update / remove / clear / mediaQuery / prefersColor
 *  🔹 SettingsManager   get / set / onChange / toggle / defaults / validate
 *  🔹 PlayerEvents      ready / play / pause / trackChange / volume / seek /
 *                       shuffleChange / repeatChange
 *  🔹 Theme             bus-шина, .stylesManager, .settingsManager, .player
 *                       событие ‘clear-screen’, helper Theme.getThemeId()
 *  Все логи выводятся в консоль с префиксами [Wolfy-…]
 *  ────────────────────────────────────────────────────────────────── */
(() => {
  if (window.WolfyLibrary) return;
  const log = (...a) => console.log('[WolfyLibrary]', ...a);

  /*──────────────── 1. EventEmitter ────────────────*/
  class EventEmitter {
    #m = Object.create(null);
    on   (e, f){ (this.#m[e] ??= []).push(f); return this; }
    off  (e, f){ this.#m[e] = (this.#m[e]||[]).filter(x=>x!==f); return this; }
    once (e, f){ const g=(...a)=>{this.off(e,g);f(...a)}; return this.on(e,g); }
    emit (e, d ){ (this.#m[e]||[]).forEach(fn=>fn(d)); return this; }
    removeAllListeners(e){ e ? delete this.#m[e] : this.#m = Object.create(null); }
  }

  /*──────────────── 2. StylesManager ───────────────*/
  class StylesManager {
    #bag = {};
    #inject(){
      let tag = document.getElementById('wolfy-style');
      if(!tag){ tag = document.createElement('style'); tag.id='wolfy-style'; document.head.appendChild(tag); }
      tag.textContent = Object.values(this.#bag).join('\n\n');
    }
    add(id, css){ this.#bag[id]=css; this.#inject(); log('CSS +', id); }
    update(id, css){ if(id in this.#bag){ this.#bag[id]=css; this.#inject(); log('CSS ~', id);} }
    remove(id){ delete this.#bag[id]; this.#inject(); log('CSS –', id); }
    clear(){ this.#bag={}; this.#inject(); log('CSS cleared'); }
    /* helpers */
    media(q, css){ return `@media ${q}{${css}}`; }
    prefersColor(scheme, css){ return this.media(`(prefers-color-scheme:${scheme})`, css); }
  }

  /*──────────────── 3. SettingsManager ─────────────*/
  class SettingsManager extends EventEmitter{
    #key = 'spotcol_settings';
    #store = JSON.parse(localStorage.getItem(this.#key)||'{}');
    #save(){ localStorage.setItem(this.#key, JSON.stringify(this.#store)); }
    get(k){ return this.#store[k]; }
    set(k,v){
      const prev=this.#store[k];
      this.#store[k]=v; this.#save();
      this.emit('update', this.getAll());
      if(prev!==v) this.emit(`change:${k}`, {key:k, value:v});
    }
    onChange(k,fn){ return this.on(`change:${k}`, fn); }
    toggle(k){ this.set(k, !this.get(k)); }
    defaults(obj){ Object.entries(obj).forEach(([k,v])=>{ if(!(k in this.#store)) this.set(k,v); }); }
    validate(schema){                    // simple key-type validation
      for(const [k,t] of Object.entries(schema)){
        if(k in this.#store && typeof this.#store[k]!==t){
          log(`⚠️ setting '${k}' wrong type, resetting`); this.set(k, undefined);
        }
      }
    }
    getAll(){ return {...this.#store}; }
    clear(){ this.#store={}; this.#save(); this.emit('update',{}); }
  }

  /*──────────────── 4. PlayerEvents ────────────────*/
  class PlayerEvents extends EventEmitter{
    state = { status:'paused', track:{}, volume:1, position:0, shuffle:false, repeat:'none' };
    constructor(){ super(); this.#hook(); }
    #hook(){
      const wait = setInterval(()=>{
        const s = window.sonataState;
        if(!s?.state?.playerState) return;
        clearInterval(wait); log('Player ready');

        const ps=s.state.playerState, qs=s.state.queueState, vs=s.state.volumeState;
        const ms=s.state.managedState;

        const grabTrack = ()=>qs.currentEntity?.value?.entity?.data?.meta||
                            qs.currentEntity?.value?.entity_data_meta||{};

        const grabPos   = ()=>ps.position.value;
        const grabShuffle = ()=>ps.shuffle.value;
        const grabRepeat  = ()=>ps.repeatMode.value; // none / one / all

        /* init */
        this.state.track   = grabTrack();
        this.state.status  = ps.status.value;
        this.state.volume  = vs.volume.value;
        this.state.position= grabPos();
        this.state.shuffle = grabShuffle();
        this.state.repeat  = grabRepeat();
        this.emit('ready',{state:this.state});

        /* listeners */
        ps.status.onChange(st=>{
          this.state.status=st;
          this.emit(st==='playing'?'play':'pause',{state:this.state});
        });
        qs.currentEntity.onChange(()=>{
          this.state.track = grabTrack();
          this.emit('trackChange',{state:this.state});
        });
        vs.volume.onChange(v=>{
          this.state.volume=v; this.emit('volumeChange',{state:this.state});
        });
        ps.position.onChange(p=>{
          this.state.position=p; this.emit('seek',{state:this.state});
        });
        ps.shuffle.onChange(sh=>{
          this.state.shuffle=sh; this.emit('shuffleChange',{state:this.state});
        });
        ps.repeatMode.onChange(r=>{
          this.state.repeat=r; this.emit('repeatChange',{state:this.state});
        });

      },150);
    }
  }

  /*──────────────── 5. Theme ───────────────────────*/
  class Theme {
    constructor(id=Theme.getThemeId()){
      this.id=id;
      this.stylesManager   = new StylesManager();
      this.settingsManager = new SettingsManager();
      this.player          = new PlayerEvents();
      this.bus             = new EventEmitter();
      ['on','off','once','emit','removeAllListeners'].forEach(
        m=>this[m]=(...a)=>this.bus[m](...a)
      );

      /* auto clear-screen */
      this.player.on('trackChange',({state})=>this.emit('clear-screen',state));
    }
    static getThemeId(){
      try{
        const s=[...document.scripts].find(x=>x.src.includes('script.js'))?.src||'';
        const p=s.split('/'); return p[p.indexOf('SpotCol-Scripts')+1]||'unknown';
      }catch{ return 'unknown'; }
    }
  }

  /*──────────────── 6. Global export ───────────────*/
  window.EventEmitter    = EventEmitter;
  window.StylesManager   = StylesManager;
  window.SettingsManager = SettingsManager;
  window.PlayerEvents    = PlayerEvents;
  window.Theme           = Theme;

  window.WolfyLibrary = { EventEmitter, StylesManager, SettingsManager, PlayerEvents, Theme };
  log('v4.0 initialised');
})();
