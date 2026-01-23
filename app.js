/***********************
 * Mission 72 Elite (frontend)
 * Offline-first + secure sync + editable history + trends toggle + PWA
 ************************/

const STORAGE_KEY = "m72_elite_v2";

/** Default DB foods (expand anytime) */
const FOOD_DB = [
  { id:"egg", n:"Boiled Egg", u:"1 large", c:78,  p:6,  cb:0.6, f:5 },
  { id:"chick", n:"Chicken Breast", u:"150g", c:250, p:45, cb:0,   f:6 },
  { id:"rice", n:"White Rice", u:"1 cup", c:205, p:4,  cb:44,  f:0.4 },
  { id:"roti", n:"Roti / Chapati", u:"1 pc", c:70,  p:3,  cb:15,  f:0.5 },
  { id:"dal", n:"Dal", u:"1 bowl", c:260, p:12, cb:30, f:10 },
  { id:"paneer", n:"Paneer", u:"100g", c:265, p:18, cb:1, f:20 },
  { id:"banana", n:"Banana", u:"1 medium", c:105, p:1.3, cb:27, f:0.4 },
  { id:"yogurt", n:"Greek Yogurt", u:"1 cup", c:130, p:12, cb:8, f:0 },
];

function todayKey(){
  return new Date().toISOString().slice(0,10);
}
function clamp(n,min,max){ return Math.max(min, Math.min(max,n)); }
function nnum(x){ const v = Number(x); return Number.isFinite(v) ? v : 0; }
function round0(x){ return Math.round(nnum(x)); }
function round1(x){ return Math.round(nnum(x)*10)/10; }
function uid(){ return (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + "_" + Math.random().toString(16).slice(2)); }

const App = {
  state: null,
  init(){
    const raw = localStorage.getItem(STORAGE_KEY);
    this.state = raw ? this.migrate(JSON.parse(raw)) : this.defaultState();

    // Ensure today
    const t = todayKey();
    this.state.days[t] ||= { logs: [], burn: 0, water: 0 };

    // UI
    this.setMeal(this.state.meal || "Breakfast");
    Settings.render();
    Trends.init();

    Render.all();
    History.renderDays();

    // swipe navigation (Home<->Trends<->History<->Library)
    UI.enableSwipeNav();

    // initial nav
    UI.nav(this.state.ui?.view || "home", null, true);
  },
  defaultState(){
    return {
      v:2,
      meal:"Breakfast",
      settings:{
        goal:1650,
        pro:130,
        carb:170,
        fat:55,
        url:"",
        token:""
      },
      favorites:[],      // food ids
      customFoods:[],    // custom foods
      days:{},           // by date
      weightHistory:{},  // date -> weight
      ui:{ view:"home", trendMode:"day" }
    };
  },
  migrate(s){
    const d = this.defaultState();
    s ||= d;
    s.v ||= 2;
    s.settings ||= d.settings;
    s.settings.goal = nnum(s.settings.goal || s.settings.c || 1650);
    s.settings.pro = nnum(s.settings.pro || 130);
    s.settings.carb = nnum(s.settings.carb || 170);
    s.settings.fat = nnum(s.settings.fat || 55);
    s.settings.url ||= "";
    s.settings.token ||= "";
    s.favorites ||= [];
    s.customFoods ||= [];
    s.days ||= {};
    s.weightHistory ||= {};
    s.ui ||= d.ui;
    s.ui.view ||= "home";
    s.ui.trendMode ||= "day";
    s.meal ||= "Breakfast";
    return s;
  },
  save(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  },
  getToday(){
    const t = todayKey();
    this.state.days[t] ||= { logs: [], burn: 0, water: 0 };
    return this.state.days[t];
  },
  setMeal(meal){
    this.state.meal = meal;
    this.save();

    ["Breakfast","Lunch","Snack","Dinner"].forEach(m=>{
      const btn = document.getElementById("btn-"+m);
      if(!btn) return;
      btn.classList.toggle("active", m===meal);
    });

    const title = document.getElementById("logMealTitle");
    if(title) title.textContent = meal;

    Render.listToday();
  }
};

const Render = {
  all(){
    this.header();
    this.listToday();
    Library.render();
    Trends.render();
  },
  header(){
    const day = App.getToday();
    const goal = nnum(App.state.settings.goal);

    const eaten = day.logs.reduce((a,b)=>a+nnum(b.c), 0);
    const burn  = nnum(day.burn);
    const net = eaten - burn;

    const rem = Math.max(0, goal - net);
    document.getElementById("val-rem").textContent = round0(rem);
    document.getElementById("val-net").textContent = round0(net);
    document.getElementById("val-burned").textContent = round0(burn);
    document.getElementById("val-water").textContent = (nnum(day.water)*0.25).toFixed(1);

    // Weight in header = latest by date
    const dates = Object.keys(App.state.weightHistory).sort();
    const w = dates.length ? App.state.weightHistory[dates[dates.length-1]] : "--";
    document.getElementById("header-weight").textContent = (w==="--" ? w : round1(w));

    // ring %
    const pct = clamp(goal ? (net/goal)*100 : 0, 0, 100);
    document.getElementById("val-pct").textContent = `${round0(pct)}%`;

    // ring stroke
    const circumference = 2*Math.PI*40; // r=40
    const offset = circumference - (circumference * pct / 100);
    const ring = document.getElementById("ring-progress");
    ring.style.strokeDasharray = String(circumference);
    ring.style.strokeDashoffset = String(offset);

    // macros totals today
    const macros = day.logs.reduce((a,b)=>({
      p:a.p+nnum(b.p), cb:a.cb+nnum(b.cb), f:a.f+nnum(b.f)
    }), {p:0,cb:0,f:0});

    const tp = nnum(App.state.settings.pro);
    const tc = nnum(App.state.settings.carb);
    const tf = nnum(App.state.settings.fat);

    document.getElementById("curr-pro").textContent = round0(macros.p);
    document.getElementById("curr-carb").textContent = round0(macros.cb);
    document.getElementById("curr-fat").textContent = round0(macros.f);

    document.getElementById("tgt-pro").textContent = round0(tp);
    document.getElementById("tgt-carb").textContent = round0(tc);
    document.getElementById("tgt-fat").textContent = round0(tf);

    const pPct = clamp(tp ? (macros.p/tp)*100 : 0, 0, 100);
    const cPct = clamp(tc ? (macros.cb/tc)*100 : 0, 0, 100);
    const fPct = clamp(tf ? (macros.f/tf)*100 : 0, 0, 100);

    document.getElementById("bar-pro").style.width = `${pPct}%`;
    document.getElementById("bar-carb").style.width = `${cPct}%`;
    document.getElementById("bar-fat").style.width = `${fPct}%`;

    document.getElementById("pct-pro").textContent = round0(pPct);
    document.getElementById("pct-carb").textContent = round0(cPct);
    document.getElementById("pct-fat").textContent = round0(fPct);
  },
  listToday(){
    const day = App.getToday();
    const meal = App.state.meal;
    const items = day.logs.filter(l => l.meal === meal);

    const box = document.getElementById("log-list");
    if(!items.length){
      box.innerHTML = `<div class="card p-5 text-center muted text-sm">No items logged for ${meal}.</div>`;
      return;
    }

    box.innerHTML = items.map(l => `
      <div class="card logRow btn-press" onclick="Sheet.openLogEdit('${todayKey()}','${l.id}')">
        <div>
          <div class="logName">${escapeHtml(l.n)} <span class="muted" style="font-weight:800;">× ${fmtQty(l.qty)}</span></div>
          <div class="logSub">P${round0(l.p)} C${round0(l.cb)} F${round0(l.f)}</div>
        </div>
        <div class="logRight">
          <div class="logKcal">${round0(l.c)}</div>
          <div class="logSub">kcal</div>
        </div>
      </div>
    `).join("");
  }
};

function fmtQty(q){
  const n = nnum(q);
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return n.toFixed(2).replace(/\.00$/,'').replace(/0$/,'');
}
function escapeHtml(str){
  return String(str||"")
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

const UI = {
  nav(view, btn, skipSave=false){
    const map = {
      home: "view-home",
      trends: "view-trends",
      history:"view-history",
      library:"view-library"
    };
    const id = map[view] || "view-home";

    document.querySelectorAll(".view").forEach(v=>v.classList.remove("active-view"));
    document.getElementById(id).classList.add("active-view");

    document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));
    if(btn) btn.classList.add("active");
    else {
      // set active based on view when swipe called
      const idx = {home:0,trends:1,history:2,library:3}[view] ?? 0;
      document.querySelectorAll(".nav-btn")[idx]?.classList.add("active");
    }

    App.state.ui.view = view;
    if(!skipSave) App.save();

    // rerenders
    if(view==="trends") Trends.render();
    if(view==="history") History.renderDays();
    if(view==="library") Library.render();
  },

  openSheet(name){
    document.getElementById("backdrop").style.display = "block";
    document.getElementById(`sheet-${name}`).classList.add("open");
  },
  closeAllSheets(){
    document.getElementById("backdrop").style.display = "none";
    document.querySelectorAll(".sheet").forEach(s=>s.classList.remove("open"));
  },

  enableSwipeNav(){
    let startX=0, startY=0, t0=0;
    const main = document.getElementById("scroll-area");
    const views = ["home","trends","history","library"];

    main.addEventListener("touchstart", (e)=>{
      if(!e.touches?.length) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      t0 = Date.now();
    }, {passive:true});

    main.addEventListener("touchend", (e)=>{
      const dt = Date.now()-t0;
      if(dt>450) return;
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const dx = endX - startX;
      const dy = endY - startY;

      // horizontal swipe only
      if(Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy)*1.2) return;

      const cur = App.state.ui.view || "home";
      let i = views.indexOf(cur); if(i<0) i=0;

      if(dx < 0) i = Math.min(views.length-1, i+1);
      else i = Math.max(0, i-1);

      UI.nav(views[i], null);
    }, {passive:true});
  }
};

const Settings = {
  render(){
    const s = App.state.settings;
    const cal = document.getElementById("s-cal");
    const pro = document.getElementById("s-pro");
    const carb= document.getElementById("s-carb");
    const fat = document.getElementById("s-fat");
    const url = document.getElementById("s-url");
    const tok = document.getElementById("s-token");
    if(!cal) return;

    cal.value = round0(s.goal);
    pro.value = round0(s.pro);
    carb.value = round0(s.carb);
    fat.value = round0(s.fat);
    url.value = s.url || "";
    tok.value = s.token || "";
  },
  save(){
    App.state.settings.goal = clamp(round0(document.getElementById("s-cal").value), 800, 5000);
    App.state.settings.pro  = clamp(round0(document.getElementById("s-pro").value), 0, 400);
    App.state.settings.carb = clamp(round0(document.getElementById("s-carb").value), 0, 600);
    App.state.settings.fat  = clamp(round0(document.getElementById("s-fat").value), 0, 200);
    App.state.settings.url  = (document.getElementById("s-url").value || "").trim();
    App.state.settings.token= (document.getElementById("s-token").value || "").trim();
    App.save();
    Render.all();
    UI.closeAllSheets();
    alert("Saved ✅");
  }
};

const Foods = {
  allFoods(){
    // dedupe by id
    const map = new Map();
    [...App.state.customFoods, ...FOOD_DB].forEach(f => map.set(f.id, f));
    return [...map.values()];
  },
  search(){
    const q = (document.getElementById("search-input").value || "").toLowerCase().trim();
    const box = document.getElementById("search-results");
    if(!q){
      box.classList.add("hidden");
      box.innerHTML = "";
      return;
    }

    const foods = this.allFoods();
    const hits = foods
      .filter(f => f.n.toLowerCase().includes(q))
      .slice(0, 12);

    box.classList.remove("hidden");
    box.innerHTML = hits.map(f => {
      const isFav = App.state.favorites.includes(f.id);
      return `
        <div class="card p-4 flex items-center justify-between gap-3">
          <button class="btn-press flex-1 text-left" onclick="Sheet.openFood('${f.id}')">
            <div class="font-black text-sm text-white">${escapeHtml(f.n)} <span class="muted" style="font-weight:800;">(${escapeHtml(f.u)})</span></div>
            <div class="muted text-xs mt-1">P${round0(f.p)} C${round0(f.cb)} F${round0(f.f)} · <b style="color:#9fc0ff">${round0(f.c)} kcal</b></div>
          </button>
          <button class="iconBtn btn-press" onclick="Foods.toggleFav('${f.id}')" title="Save">
            <i class="ph-bold ${isFav ? "ph-star-fill" : "ph-star"}"></i>
          </button>
        </div>
      `;
    }).join("") || `<div class="card p-5 text-center muted text-sm">No results. Create a custom food.</div>`;
  },
  toggleFav(id){
    const favs = App.state.favorites;
    const i = favs.indexOf(id);
    if(i>=0) favs.splice(i,1);
    else favs.push(id);
    App.save();
    this.search();
    Library.render();
    Sheet.refreshFavLabel();
  },
  createCustom(){
    const name = (document.getElementById("c-name").value || "").trim();
    const unit = (document.getElementById("c-unit").value || "1 serving").trim();
    const kcal = nnum(document.getElementById("c-kcal").value);
    const pro  = nnum(document.getElementById("c-pro").value);
    const carb = nnum(document.getElementById("c-carb").value);
    const fat  = nnum(document.getElementById("c-fat").value);

    if(!name || kcal<=0){
      alert("Please enter at least Name + Calories");
      return;
    }

    const id = "custom_" + uid().slice(0,8);
    App.state.customFoods.unshift({ id, n:name, u:unit, c:round1(kcal), p:round1(pro), cb:round1(carb), f:round1(fat) });
    App.save();

    UI.closeAllSheets();
    alert("Saved custom food ✅");
  }
};

const Library = {
  render(){
    const box = document.getElementById("library-list");
    if(!box) return;

    const q = (document.getElementById("library-search")?.value || "").toLowerCase().trim();
    const favs = new Set(App.state.favorites);
    const foods = Foods.allFoods().filter(f => favs.has(f.id));
    const filtered = q ? foods.filter(f => f.n.toLowerCase().includes(q)) : foods;

    if(!filtered.length){
      box.innerHTML = `<div class="card p-5 text-center muted text-sm">No saved foods yet. Search on Home and tap ★</div>`;
      return;
    }

    box.innerHTML = filtered
      .sort((a,b)=>a.n.localeCompare(b.n))
      .map(f => `
        <div class="card p-4 flex items-center justify-between gap-3 btn-press" onclick="Sheet.openFood('${f.id}')">
          <div>
            <div class="font-black text-sm text-white">${escapeHtml(f.n)}</div>
            <div class="muted text-xs mt-1">${escapeHtml(f.u)} · ${round0(f.c)} kcal</div>
          </div>
          <i class="ph-bold ph-plus-circle" style="color:#9fc0ff; font-size:22px;"></i>
        </div>
      `).join("");
  }
};

const Sheet = {
  mode:"food", // food or log
  curr:null,
  qty:1,
  editCtx:null, // {date, logId}

  openFood(foodId){
    const f = Foods.allFoods().find(x=>x.id===foodId);
    if(!f) return;
    this.mode = "food";
    this.curr = f;
    this.qty = 1;
    this.editCtx = null;

    document.getElementById("sheet-mode").textContent = "Add";
    document.getElementById("sheet-name").textContent = f.n;
    document.getElementById("sheet-delete").classList.add("hidden");
    document.getElementById("sheet-qty").textContent = fmtQty(this.qty);
    this.updateTotal();
    this.refreshFavLabel();
    UI.openSheet("food");
  },

  openLogEdit(date, logId){
    const day = App.state.days[date];
    if(!day) return;
    const l = day.logs.find(x=>x.id===logId);
    if(!l) return;

    this.mode="log";
    this.curr = { ...l };
    this.qty = nnum(l.qty) || 1;
    this.editCtx = { date, logId };

    document.getElementById("sheet-mode").textContent = "Edit";
    document.getElementById("sheet-name").textContent = l.n;
    document.getElementById("sheet-delete").classList.remove("hidden");

    document.getElementById("sheet-qty").textContent = fmtQty(this.qty);
    this.updateTotal(true);
    this.refreshFavLabel(l.foodId);

    UI.openSheet("food");
  },

  refreshFavLabel(forcedFoodId){
    const foodId = forcedFoodId || this.curr?.id || this.curr?.foodId;
    const isFav = App.state.favorites.includes(foodId);
    const el = document.getElementById("sheet-fav");
    if(el) el.textContent = isFav ? "Saved" : "Save";
  },

  adj(delta){
    this.qty = clamp(round1(this.qty + delta), 0.25, 50);
    document.getElementById("sheet-qty").textContent = fmtQty(this.qty);
    this.updateTotal(this.mode==="log");
  },

  updateTotal(isLog){
    if(!this.curr) return;
    const base = this.curr;
    const q = this.qty;

    const kcal = isLog ? nnum(base.c) : nnum(base.c) * q;
    document.getElementById("sheet-total").textContent = `${round0(kcal)} kcal`;
  },

  toggleFav(){
    const foodId = (this.mode==="food") ? this.curr?.id : this.curr?.foodId;
    if(!foodId) return;
    Foods.toggleFav(foodId);
  },

  saveToDay(){
    if(!this.curr) return;

    const day = App.getToday();
    const meal = App.state.meal;

    if(this.mode === "log" && this.editCtx){
      // edit existing log (scale values by qty ratio)
      const {date, logId} = this.editCtx;
      const d = App.state.days[date];
      const idx = d.logs.findIndex(x=>x.id===logId);
      if(idx<0) return;

      // editing using qty stepper: scale kcal/macros proportionally
      const old = d.logs[idx];
      const oldQty = nnum(old.qty)||1;
      const ratio = (nnum(this.qty)||1) / oldQty;

      d.logs[idx] = {
        ...old,
        qty: this.qty,
        c: round1(nnum(old.c) * ratio),
        p: round1(nnum(old.p) * ratio),
        cb: round1(nnum(old.cb) * ratio),
        f: round1(nnum(old.f) * ratio),
        ts: Date.now()
      };

      App.save();
      Render.all();
      History.renderEditor(); // if editing history view
      UI.closeAllSheets();
      return;
    }

    // add new food log
    const f = this.curr;
    const q = this.qty;
    day.logs.unshift({
      id: uid(),
      meal,
      foodId: f.id,
      n: f.n,
      u: f.u,
      qty: q,
      c: round1(nnum(f.c) * q),
      p: round1(nnum(f.p) * q),
      cb: round1(nnum(f.cb) * q),
      f: round1(nnum(f.f) * q),
      ts: Date.now()
    });

    App.save();
    Render.all();
    UI.closeAllSheets();

    // clear search box for smooth UX
    const si = document.getElementById("search-input");
    const sr = document.getElementById("search-results");
    if(si) si.value="";
    if(sr){ sr.classList.add("hidden"); sr.innerHTML=""; }
  },

  deleteLog(){
    if(!(this.mode==="log" && this.editCtx)) return;
    const {date, logId} = this.editCtx;
    const d = App.state.days[date];
    if(!d) return;
    d.logs = d.logs.filter(x=>x.id!==logId);
    App.save();
    Render.all();
    History.renderEditor();
    UI.closeAllSheets();
  }
};

const Data = {
  addWater(){
    const day = App.getToday();
    day.water = nnum(day.water) + 1;
    App.save();
    Render.header();
    History.renderDays();
  },
  addBurn(name, kcal){
    const day = App.getToday();
    day.burn = nnum(day.burn) + nnum(kcal);
    App.save();
    Render.all();
    UI.closeAllSheets();
  },
  saveWeight(){
    const v = nnum(document.getElementById("w-val").value);
    if(v<=0){ alert("Enter a valid weight"); return; }
    App.state.weightHistory[todayKey()] = round1(v);
    App.save();
    Render.all();
    UI.closeAllSheets();
  },
  resetToday(){
    if(!confirm("Reset today?")) return;
    App.state.days[todayKey()] = { logs: [], burn: 0, water: 0 };
    App.save();
    Render.all();
    History.renderDays();
  },
  resetAll(){
    if(!confirm("Factory reset local data?")) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }
};

const History = {
  selectedDate: null,
  selectedLogId: null,

  renderDays(){
    const grid = document.getElementById("history-days");
    if(!grid) return;

    // Show last 28 days squares (including those with no logs)
    const now = new Date();
    const dates = [];
    for(let i=0;i<28;i++){
      const d = new Date(now);
      d.setDate(now.getDate()-i);
      dates.push(d.toISOString().slice(0,10));
    }

    grid.innerHTML = dates.reverse().map(date=>{
      const day = App.state.days[date];
      const goal = nnum(App.state.settings.goal);
      const eaten = day ? day.logs.reduce((a,b)=>a+nnum(b.c),0) : 0;
      const burn = day ? nnum(day.burn) : 0;
      const net = eaten - burn;

      let cls = "bg-[#0f0f12] border border-[#26262c] text-[#6f6f7a]";
      if(day && (day.logs.length || day.burn || day.water)){
        if(net > goal*1.1) cls = "bg-red-500/10 border border-red-500/25 text-red-300";
        else cls = "bg-emerald-500/10 border border-emerald-500/25 text-emerald-200";
      }

      const dd = date.slice(8,10);

      return `
        <button
          class="aspect-square rounded-xl flex items-center justify-center text-xs font-black ${cls} btn-press"
          onclick="History.openDay('${date}')"
          oncontextmenu="event.preventDefault(); History.confirmDeleteDay('${date}')"
          title="${date}"
        >${dd}</button>
      `;
    }).join("");

    // if editor open, refresh it
    if(this.selectedDate) this.renderEditor();
  },

  openDay(date){
    this.selectedDate = date;
    document.getElementById("history-editor").classList.remove("hidden");
    document.getElementById("history-date-title").textContent = date;

    // preload day edit sheet fields
    const d = App.state.days[date] || {logs:[], burn:0, water:0};
    document.getElementById("hd-date").value = date;
    document.getElementById("hd-water").value = nnum(d.water);
    document.getElementById("hd-burn").value = nnum(d.burn);

    this.renderEditor();
  },

  renderEditor(){
    if(!this.selectedDate) return;
    const date = this.selectedDate;
    const box = document.getElementById("history-log-list");
    const d = App.state.days[date] || {logs:[], burn:0, water:0};

    if(!d.logs.length){
      box.innerHTML = `<div class="card p-5 text-center muted text-sm">No logs on ${date}.</div>`;
      return;
    }

    box.innerHTML = d.logs.map(l=>`
      <div class="card p-4 flex items-center justify-between gap-3 btn-press" onclick="History.openLogEdit('${date}','${l.id}')">
        <div>
          <div class="font-black text-sm text-white">${escapeHtml(l.n)} <span class="muted" style="font-weight:800;">× ${fmtQty(l.qty)}</span></div>
          <div class="muted text-xs mt-1">${escapeHtml(l.meal)} · P${round0(l.p)} C${round0(l.cb)} F${round0(l.f)}</div>
        </div>
        <div class="text-right">
          <div class="font-black" style="color:#9fc0ff;">${round0(l.c)}</div>
          <div class="muted text-xs">kcal</div>
        </div>
      </div>
    `).join("");
  },

  openLogEdit(date, logId){
    const d = App.state.days[date];
    if(!d) return;
    const l = d.logs.find(x=>x.id===logId);
    if(!l) return;

    this.selectedLogId = logId;

    // fill sheet
    document.getElementById("hl-name").value = l.n || "";
    document.getElementById("hl-qty").value = nnum(l.qty) || 1;
    document.getElementById("hl-kcal").value = nnum(l.c);
    document.getElementById("hl-pro").value = nnum(l.p);
    document.getElementById("hl-carb").value = nnum(l.cb);
    document.getElementById("hl-fat").value = nnum(l.f);

    UI.openSheet("historyLogEdit");
  },

  saveLogEdits(){
    const date = this.selectedDate;
    const logId = this.selectedLogId;
    const d = App.state.days[date];
    if(!d) return;

    const idx = d.logs.findIndex(x=>x.id===logId);
    if(idx<0) return;

    d.logs[idx] = {
      ...d.logs[idx],
      n: (document.getElementById("hl-name").value || "").trim() || d.logs[idx].n,
      qty: clamp(round1(document.getElementById("hl-qty").value), 0.25, 50),
      c: round1(document.getElementById("hl-kcal").value),
      p: round1(document.getElementById("hl-pro").value),
      cb: round1(document.getElementById("hl-carb").value),
      f: round1(document.getElementById("hl-fat").value),
      ts: Date.now()
    };

    App.save();
    Render.all();
    this.renderDays();
    UI.closeAllSheets();
  },

  deleteLog(){
    const date = this.selectedDate;
    const logId = this.selectedLogId;
    const d = App.state.days[date];
    if(!d) return;
    d.logs = d.logs.filter(x=>x.id!==logId);

    App.save();
    Render.all();
    this.renderDays();
    UI.closeAllSheets();
  },

  saveDayEdits(){
    const date = this.selectedDate;
    if(!date) return;

    App.state.days[date] ||= {logs:[], burn:0, water:0};
    App.state.days[date].water = clamp(round0(document.getElementById("hd-water").value), 0, 1000);
    App.state.days[date].burn  = clamp(round0(document.getElementById("hd-burn").value), 0, 5000);

    App.save();
    Render.all();
    this.renderDays();
    UI.closeAllSheets();
  },

  deleteDay(){
    const date = this.selectedDate;
    if(!date) return;
    if(!confirm(`Delete entire day ${date}?`)) return;

    delete App.state.days[date];
    App.save();
    this.selectedDate = null;
    document.getElementById("history-editor").classList.add("hidden");

    Render.all();
    this.renderDays();
    UI.closeAllSheets();
  },

  confirmDeleteDay(date){
    if(!confirm(`Delete day ${date}?`)) return;
    delete App.state.days[date];
    App.save();
    Render.all();
    this.renderDays();
  }
};

const Trends = {
  mode:"day",
  chartNet:null,
  chartMacros:null,
  chartWeight:null,

  init(){
    this.mode = App.state.ui.trendMode || "day";
    this.applySegmentUI();
  },
  setMode(mode){
    this.mode = mode;
    App.state.ui.trendMode = mode;
    App.save();
    this.applySegmentUI();
    this.render();
  },
  applySegmentUI(){
    ["day","week","month"].forEach(m=>{
      const btn = document.getElementById(`trend-${m}`);
      if(btn) btn.classList.toggle("active", m===this.mode);
    });
  },

  render(){
    // build data rows based on mode
    const rows = this.aggregate(this.mode);

    // net calories chart
    const labels = rows.map(r=>r.label);
    const net = rows.map(r=>r.net);

    const ctxNet = document.getElementById("chart-net");
    if(ctxNet){
      if(this.chartNet) this.chartNet.destroy();
      this.chartNet = new Chart(ctxNet, {
        type:"line",
        data:{ labels, datasets:[{
          label:"Net kcal",
          data: net,
          tension:.35
        }]},
        options:{
          responsive:true,
          maintainAspectRatio:false,
          plugins:{ legend:{display:false} },
          scales:{
            x:{ ticks:{ color:"#6f6f7a" }, grid:{ display:false } },
            y:{ ticks:{ color:"#6f6f7a" }, grid:{ color:"rgba(255,255,255,0.06)" }, beginAtZero:true }
          }
        }
      });
    }

    // macros stacked bar-ish (3 datasets)
    const ctxM = document.getElementById("chart-macros");
    if(ctxM){
      if(this.chartMacros) this.chartMacros.destroy();
      this.chartMacros = new Chart(ctxM, {
        type:"bar",
        data:{
          labels,
          datasets:[
            { label:"Protein", data: rows.map(r=>r.p) },
            { label:"Carbs", data: rows.map(r=>r.cb) },
            { label:"Fat", data: rows.map(r=>r.f) },
          ]
        },
        options:{
          responsive:true,
          maintainAspectRatio:false,
          plugins:{ legend:{ labels:{ color:"#9a9aa4" } } },
          scales:{
            x:{ ticks:{ color:"#6f6f7a" }, grid:{ display:false } },
            y:{ ticks:{ color:"#6f6f7a" }, grid:{ color:"rgba(255,255,255,0.06)" }, beginAtZero:true }
          }
        }
      });
    }

    // weight chart (always by day, last 30)
    const wDates = Object.keys(App.state.weightHistory).sort().slice(-30);
    const wVals  = wDates.map(d=>App.state.weightHistory[d]);
    const ctxW = document.getElementById("chart-weight");
    if(ctxW){
      if(this.chartWeight) this.chartWeight.destroy();
      this.chartWeight = new Chart(ctxW, {
        type:"line",
        data:{ labels: wDates.map(d=>d.slice(5)), datasets:[{ label:"Weight", data:wVals, tension:.35 }]},
        options:{
          responsive:true,
          maintainAspectRatio:false,
          plugins:{ legend:{display:false} },
          scales:{
            x:{ ticks:{ color:"#6f6f7a" }, grid:{ display:false } },
            y:{ ticks:{ color:"#6f6f7a" }, grid:{ color:"rgba(255,255,255,0.06)" } }
          }
        }
      });
    }
  },

  aggregate(mode){
    // Build daily list first (sorted)
    const keys = Object.keys(App.state.days).sort();
    const daily = keys.map(date=>{
      const d = App.state.days[date];
      const eaten = d.logs.reduce((a,b)=>a+nnum(b.c),0);
      const burn = nnum(d.burn);
      const net = eaten - burn;
      const macros = d.logs.reduce((a,b)=>({p:a.p+nnum(b.p), cb:a.cb+nnum(b.cb), f:a.f+nnum(b.f)}), {p:0,cb:0,f:0});
      return { date, net:round0(net), p:round0(macros.p), cb:round0(macros.cb), f:round0(macros.f) };
    });

    // If no data, provide empty
    if(!daily.length) return [{ label:"-", net:0, p:0, cb:0, f:0 }];

    if(mode==="day"){
      return daily.slice(-14).map(r=>({ ...r, label: r.date.slice(5) }));
    }

    // group by week or month
    const groups = new Map();

    for(const r of daily){
      const d = new Date(r.date+"T00:00:00");
      let key,label;
      if(mode==="week"){
        // ISO-ish week key (year-week)
        const y = d.getFullYear();
        const week = getWeekNumber(d);
        key = `${y}-W${String(week).padStart(2,"0")}`;
        label = `W${String(week).padStart(2,"0")}`;
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
        label = d.toLocaleDateString(undefined,{month:"short"});
      }

      if(!groups.has(key)) groups.set(key, { label, net:0, p:0, cb:0, f:0, count:0 });
      const g = groups.get(key);
      g.net += r.net;
      g.p += r.p;
      g.cb += r.cb;
      g.f += r.f;
      g.count += 1;
    }

    const arr = [...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(x=>x[1]);

    // For week/month, show average per day for net (looks nicer)
    if(mode==="week" || mode==="month"){
      for(const g of arr){
        g.net = round0(g.net / Math.max(1,g.count));
        g.p = round0(g.p / Math.max(1,g.count));
        g.cb= round0(g.cb/ Math.max(1,g.count));
        g.f = round0(g.f / Math.max(1,g.count));
      }
    }

    return arr.slice(-12);
  }
};

function getWeekNumber(d){
  // week number (simple, good enough)
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
  return Math.ceil((((date - yearStart)/86400000) + 1) / 7);
}

/** Secure Sync */
const Sync = {
  async syncNow(){
    const {url, token} = App.state.settings;
    if(!url || !token){
      alert("Set Web App URL + Token in Settings first.");
      return;
    }

    const btn = document.getElementById("sync-btn");
    btn.querySelector("i").classList.add("sync-spin");

    const payload = {
      app:"m72_elite",
      v: App.state.v,
      sentAt: new Date().toISOString(),
      state: App.state
    };

    try{
      // Try normal CORS fetch
      const res = await fetch(url, {
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "X-M72-TOKEN": token
        },
        body: JSON.stringify(payload),
      });

      // If browser blocks reading due to CORS, res may throw before here.
      const txt = await res.text().catch(()=> "");
      if(!res.ok){
        alert("Sync failed:\n" + txt);
      } else {
        alert("Synced ✅");
      }
    } catch(err){
      // Fallback: send-only no-cors
      try{
        await fetch(url, {
          method:"POST",
          mode:"no-cors",
          headers:{
            "Content-Type":"application/json",
            "X-M72-TOKEN": token
          },
          body: JSON.stringify(payload),
        });
        alert("Sync sent ✅ (no-cors)");
      } catch(e2){
        alert("Sync failed. Check Web App URL / deploy access.\n\n" + String(err));
      }
    } finally {
      btn.querySelector("i").classList.remove("sync-spin");
    }
  }
};

// Boot
window.addEventListener("keydown", (e)=>{ if(e.key==="Escape") UI.closeAllSheets(); });
App.init();
