/* ======================================================================================
 * SpotCol Universal Library 1.0.0
 * ───────────────────────────────────────────────────────────────────────────────────────*/

(() => {
  if (window.WolfyLibrary) return;     // защита от двойной загрузки
  const DEBUG = !!window.__WOLFY_DEBUG__;
  const log   = (...a) => DEBUG && console.log('[WolfyLibrary]', ...a);

  /* ════════════════════════════════════════════════════════════════════════════════════
   *  EventEmitter
   * ══════════════════════════════════════════════════════════════════════════════════ */
  class EventEmitter {
    #ev = Object.create(null);
    on   (e, fn) { (this.#ev[e] ??= []).push(fn); return this; }
    once (e, fn) { const g = (...a)=>{this.off(e,g);fn(...a);}; return this.on(e,g); }
    off  (e, fn) { this.#ev[e] = (this.#ev[e] || []).filter(f=>f!==fn); return this; }
    emit (e, d ) { (this.#ev[e] || []).forEach(f=>f(d)); return this; }
    removeAll(e) { e ? delete this.#ev[e] : this.#ev = Object.create(null); }
  }

  /* ════════════════════════════════════════════════════════════════════════════════════
   *  StylesManager
   * ══════════════════════════════════════════════════════════════════════════════════ */
  class StylesManager {
    #bag = {};                       // id -> css
    #id  = 'wolfy-style';
    #flush() {
      let tag = document.getElementById(this.#id);
      if (!tag) { tag = document.createElement('style'); tag.id = this.#id; document.head.appendChild(tag); }
      tag.textContent = Object.values(this.#bag).join('\n\n');
    }
    add(id, css)    { if (!id||!css) return; this.#bag[id] = css.toString(); this.#flush(); }
    remove(id)      { delete this.#bag[id]; this.#flush(); }
    clear()         { this.#bag = {}; this.#flush(); }
    has(id)         { return Object.hasOwn(this.#bag, id); }
    get keys()      { return Object.keys(this.#bag); }
    get size()      { return this.keys.length; }
  }

  /* ════════════════════════════════════════════════════════════════════════════════════
   *  SettingsManager  (расширенный)
   * ══════════════════════════════════════════════════════════════════════════════════ */
  class SettingsManager extends EventEmitter {
    #theme;
    #cur   = {};
    #prev  = {};
    constructor(theme) { super(); this.#theme = theme; }

    /* util */
    #pick(obj, path) { return path.split('.').reduce((o,k)=>o?.[k], obj); }

    /* public API */
    get(id)          { return this.#pick(this.#cur, id); }
    has(id)          { return this.#pick(this.#cur, id) !== undefined; }
    getAll()         { return structuredClone(this.#cur); }
    hasChanged(id)   { return JSON.stringify(this.#pick(this.#cur,id)) !== JSON.stringify(this.#pick(this.#prev,id)); }
    onChange(id, cb) { this.on(`change:${id}`, cb); }
    defaults(obj)    { for (const [k,v] of Object.entries(obj)) if (!this.has(k)) this.#silentSet(k,v); this.emit('update', {settings:this}); }

    /* загрузка с PulseSync Controls */
    async update() {
      try {
        const url = `http://127.0.0.1:2007/get_handle?name=${encodeURIComponent(this.#theme.id)}`;
        const r   = await fetch(url, {cache:'no-store'}); if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const { data } = await r.json(); if (!data?.sections) { log('settings: no sections'); return; }
        this.#prev = structuredClone(this.#cur);
        this.#cur  = this.#transform(data.sections);
        this.emit('update', {settings:this});
        for(const id of Object.keys(this.#cur))
          if (this.hasChanged(id)) this.emit(`change:${id}`, {settings:this});
      } catch(e){ console.error('[SettingsManager]', e); }
    }

    /* преобразование API → плоский объект */
    #transform(sections) {
      const out = {};
      for(const s of sections){
        for(const it of s.items){
          if(it.type==='text' && it.buttons){
            out[it.id] = {};
            for(const b of it.buttons) out[it.id][b.id] = { value:b.text, default:b.defaultParameter };
          } else {
            const v = it.bool ?? it.input ?? it.filePath ?? it.selected ?? it.value;
            out[it.id] = { value:v, default:it.defaultParameter };
          }
        }
      }
      return out;
    }

    #silentSet(path,val){
      const keys = path.split('.'); let o=this.#cur;
      keys.slice(0,-1).forEach(k=>{ if(!o[k]) o[k] = {}; o=o[k]; });
      o[keys.at(-1)] = val;
    }
  }
  /* ════════════════════════════════════════════════════════════════════════════════════
   *                                          UI
   * ══════════════════════════════════════════════════════════════════════════════════ */
  const UI = {
    /* --- helpers --- */
    _el(tag, styleObj = {}, parent = document.body, html='') {
      const n = document.createElement(tag);
      Object.assign(n.style, styleObj);
      if (html) n.innerHTML = html;
      parent.appendChild(n); return n;
    },

    /* --- alert (удаляется автоматически) --- */
    alert(msg, ms=2500) {
      const d = this._el('div',{
        position:'fixed',bottom:'20px',left:'50%',transform:'translateX(-50%)',
        background:'#222',color:'#fff',padding:'10px 22px',borderRadius:'8px',
        font:'14px/1 sans-serif',opacity:0,transition:'opacity .25s',zIndex:9999
      },document.body,msg);
      requestAnimationFrame(()=>d.style.opacity=1);
      setTimeout(()=>{ d.style.opacity=0; setTimeout(()=>d.remove(),250); }, ms);
    },

    /* --- modal (клик по фону или Esc закрывает) --- */
    modal(html) {
      const wrap = this._el('div',{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',display:'flex',
        alignItems:'center',justifyContent:'center',zIndex:10000});
      const box  = this._el('div',{maxWidth:'80vw',maxHeight:'80vh',overflow:'auto',background:'#111',color:'#eee',
        padding:'24px',borderRadius:'12px',fontFamily:'sans-serif'},wrap,html);
      wrap.addEventListener('click',e=>e.target===wrap&&wrap.remove());
      const esc = e=>{ if(e.key==='Escape'){wrap.remove();document.removeEventListener('keydown',esc);} };
      document.addEventListener('keydown',esc);
    },

    /* --- confirm (promise) --- */
    confirm(text, ok='OK', cancel='Cancel') {
      return new Promise(res=>{
        const wrap=this._el('div',{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:10000});
        const panel=this._el('div',{background:'#222',color:'#fff',padding:'20px',borderRadius:'10px',minWidth:'260px',fontFamily:'sans-serif',textAlign:'center'},wrap);
        this._el('div',{marginBottom:'12px',fontSize:'15px'},panel,text);
        const row=this._el('div',{display:'flex',gap:'8px',justifyContent:'center'},panel);
        const mkBtn=(t,v)=>{const b=this._el('button',{padding:'6px 16px',background:'#444',color:'#fff',border:'none',borderRadius:'6px',cursor:'pointer'},row,t); b.onclick=()=>{wrap.remove();res(v);} };
        mkBtn(ok,true); mkBtn(cancel,false);
      });
    },

    /* --- prompt (promise) --- */
    prompt(label, placeholder='', ok='OK', cancel='Cancel'){
      return new Promise(res=>{
        const wrap=this._el('div',{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:10000});
        const panel=this._el('div',{background:'#222',color:'#fff',padding:'20px',borderRadius:'10px',minWidth:'260px',fontFamily:'sans-serif'},wrap);
        this._el('div',{marginBottom:'8px'},panel,label);
        const input=document.createElement('input');
        Object.assign(input.style,{width:'100%',padding:'6px',marginBottom:'12px',border:'1px solid #555',borderRadius:'6px',background:'#111',color:'#eee'});
        input.placeholder=placeholder; panel.appendChild(input); input.focus();
        const row=this._el('div',{display:'flex',gap:'8px',justifyContent:'right'},panel);
        const mk=(t,v)=>{const b=this._el('button',{padding:'6px 16px',background:'#444',color:'#fff',border:'none',borderRadius:'6px',cursor:'pointer'},row,t); b.onclick=()=>{wrap.remove();res(v);} };
        mk(cancel,null); mk(ok,null); row.lastChild.onclick = ()=>{wrap.remove();res(input.value);} ;
      });
    },

    /* --- toast (правый верх, стек) --- */
    toast(msg, ms=3000){
      const areaId='wolfy-toast-area';
      let area=document.getElementById(areaId);
      if(!area){ area=this._el('div',{position:'fixed',top:'16px',right:'16px',display:'flex',flexDirection:'column',gap:'8px',zIndex:10000}); area.id=areaId; }
      const itm=this._el('div',{background:'#333',color:'#fff',padding:'10px 16px',borderRadius:'8px',font:'14px/1 sans-serif',opacity:0,transition:'opacity .2s'},area,msg);
      requestAnimationFrame(()=>itm.style.opacity=1);
      setTimeout(()=>{itm.style.opacity=0; setTimeout(()=>itm.remove(),200);},ms);
    },

    /* --- simple progress bar (returns {update,finish}) --- */
    progressBar(initial=0){
      const bar=this._el('div',{position:'fixed',bottom:0,left:0,height:'4px',width:'0%',background:'#1db954',transition:'width .1s',zIndex:9999});
      const update=p=>bar.style.width=`${Math.min(100,Math.max(0,p))}%`;
      const finish=()=>{bar.remove();};
      update(initial); return {update,finish};
    }
  };

  /* ════════════════════════════════════════════════════════════════════════════════════
   *  PlayerEvents  (минимальная реализация; расшири при необходимости)
   * ══════════════════════════════════════════════════════════════════════════════════ */
  class PlayerEvents extends EventEmitter{
    state={ status:'paused', track:{}, progress:{duration:0,position:0}, volume:0, shuffle:false, repeat:'none'};
    constructor(theme){ super(); /* можно подключиться к window.player */ }
  }

  /* ════════════════════════════════════════════════════════════════════════════════════
   *  Theme  (applyTheme, addAction, update, start, stop, destroy)
   * ══════════════════════════════════════════════════════════════════════════════════ */
  class Theme {
    id; stylesManager; settingsManager; assetsManager; player;
    #ev=new EventEmitter(); #actions={}; #loop=null; context = Object.create(null);

    constructor(id) {
    if (!id) throw Error('Theme id required');
    this.id              = id;
    this.stylesManager   = new StylesManager();
    this.settingsManager = new SettingsManager(this);

    /*  ↓↓↓  Создаём менеджер ассетов лишь при наличии класса  ↓↓↓  */
    if (typeof AssetsManager !== 'undefined')
      this.assetsManager = new AssetsManager();

    this.player = new PlayerEvents(this);
    log('Theme', id, 'init');
  }

    /* --- события темы --- */
    on (...a){ this.#ev.on (...a); }
    off(...a){ this.#ev.off(...a); }
    emit(...a){ this.#ev.emit(...a); }

    /* --- context --- */
    ctx = Object.create(null);
    setContext(k,v){ this.ctx[k]=v; }
    getContext(k){ return this.ctx[k]; }

    /* --- actions (реакция на изменение конкретной настройки) --- */
    addAction(id, fn){ this.#actions[id]=fn; }

    /* --- применить тему = вызвать все actions и нарисовать CSS --- */
    applyTheme(){
      for(const id of Object.keys(this.#actions)){
        const changed = this.settingsManager.hasChanged(id);
        const val     = this.settingsManager.get(id);
        this.#actions[id]?.({value:val, changed, styles:this.stylesManager, settings:this.settingsManager, state:this.player.state });
      }
      /* собственно вставить CSS */
      this.stylesManager.clear();   // стили могли измениться внутри actions
      for(const [id,fn] of Object.entries(this.#actions))
        fn({value:this.settingsManager.get(id), changed:false, styles:this.stylesManager, settings:this.settingsManager, state:this.player.state });
    }

    /* --- update(): тянем настройки и применяем тему --- */
    async update(){ await this.settingsManager.update(); this.applyTheme(); }

    /* --- циклическое обновление --- */
    start(ms=2500){ if(this.#loop) return;
      const tick=async()=>{ try{ await this.update(); }finally{ this.#loop=setTimeout(tick,ms);} };
      tick();
    }
    stop(){ clearTimeout(this.#loop); this.#loop=null; }

    destroy(){ this.stop(); this.stylesManager.clear(); this.#actions={}; this.emit('destroy'); }
  }

  /* ════════════════════════════════════════════════════════════════════════════════════
   *  Export
   * ══════════════════════════════════════════════════════════════════════════════════ */
  window.WolfyLibrary = { EventEmitter, StylesManager, SettingsManager, UI, PlayerEvents, Theme };
  log('WolfyLibrary loaded ✓');
})();
