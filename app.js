/* ---------- Mission 72 Elite - Core Logic ---------- */

const Utils = {
  // Returns YYYY-MM-DD in local time
  todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + 
           String(d.getMonth() + 1).padStart(2, '0') + '-' + 
           String(d.getDate()).padStart(2, '0');
  },
  
  formatDisplayDate(iso) {
    if (iso === this.todayKey()) return "Today";
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', weekday: 'short' });
  },

  addDays(iso, days) {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + 
           String(d.getMonth() + 1).padStart(2, '0') + '-' + 
           String(d.getDate()).padStart(2, '0');
  }
};

const DB = [
  { id: 'egg', n: 'Boiled Egg', c: 78, p: 6, cb: 0, f: 5 },
  { id: 'chick', n: 'Chicken Breast (150g)', c: 250, p: 45, cb: 0, f: 6 },
  { id: 'rice', n: 'White Rice (1 cup)', c: 205, p: 4, cb: 44, f: 0 },
  { id: 'roti', n: 'Roti / Chapati', c: 70, p: 3, cb: 15, f: 0.5 },
  { id: 'paneer', n: 'Paneer (100g)', c: 265, p: 18, cb: 4, f: 20 }
];

const App = {
  state: {
    settings: { goal: 1650 },
    selectedDate: Utils.todayKey(),
    meal: 'Breakfast',
    days: {}, // "YYYY-MM-DD": { logs: [], water: 0, burn: 0 }
    weight: {} // "YYYY-MM-DD": 80
  },

  init() {
    const saved = localStorage.getItem('m72_elite_v4');
    if (saved) this.state = JSON.parse(saved);
    
    // Safety check for selected date
    if (!this.state.selectedDate) this.state.selectedDate = Utils.todayKey();
    
    this.setMeal(this.state.meal, true);
    Render.all();
  },

  save() {
    localStorage.setItem('m72_elite_v4', JSON.stringify(this.state));
  },

  getDay(date) {
    if (!this.state.days[date]) {
      this.state.days[date] = { logs: [], water: 0, burn: 0 };
    }
    return this.state.days[date];
  },

  setMeal(m, skipSave) {
    this.state.meal = m;
    const meals = ['Breakfast', 'Lunch', 'Snack', 'Dinner'];
    meals.forEach(id => {
      const btn = document.getElementById('btn-' + id);
      if (btn) {
        const isActive = id === m;
        btn.classList.toggle('bg-zinc-800', isActive);
        btn.classList.toggle('text-white', isActive);
        btn.classList.toggle('text-zinc-500', !isActive);
      }
    });
    if (!skipSave) this.save();
    Render.list();
  }
};

const Render = {
  all() {
    const date = App.state.selectedDate;
    const day = App.getDay(date);
    const goal = App.state.settings.goal;
    
    document.getElementById('home-title-day').innerText = Utils.formatDisplayDate(date);
    
    const eaten = day.logs.reduce((acc, curr) => acc + curr.c, 0);
    const net = eaten - day.burn;
    const remaining = Math.max(0, goal - net);
    
    document.getElementById('val-rem').innerText = Math.round(remaining);
    document.getElementById('val-net').innerText = Math.round(net);
    document.getElementById('val-goal').innerText = goal;
    document.getElementById('val-burned').innerText = day.burn;
    document.getElementById('val-water').innerText = (day.water * 0.25).toFixed(1);
    
    const pct = Math.min(100, (net / goal) * 100);
    document.getElementById('val-pct').innerText = Math.round(pct) + '%';
    document.getElementById('ring-progress').style.strokeDashoffset = 214 - (214 * pct / 100);
    
    this.list();
  },

  list() {
    const date = App.state.selectedDate;
    const day = App.getDay(date);
    const container = document.getElementById('log-list');
    const filtered = day.logs.filter(l => l.meal === App.state.meal);
    
    if (filtered.length === 0) {
      container.innerHTML = `<div class="p-8 text-center text-zinc-600 text-xs font-bold uppercase tracking-widest">No Logs for ${App.state.meal}</div>`;
      return;
    }

    container.innerHTML = filtered.map(l => `
      <div class="card p-4 flex justify-between items-center">
        <div>
          <div class="text-white font-black text-sm">${l.n}</div>
          <div class="text-[10px] text-zinc-500 font-bold uppercase">× ${l.qty} · ${l.meal}</div>
        </div>
        <div class="text-right">
          <div class="text-blue-400 font-black mono">${Math.round(l.c)}</div>
          <button onclick="Data.deleteLog('${l.id}')" class="text-[10px] text-red-500 font-black uppercase mt-1">Delete</button>
        </div>
      </div>
    `).join('');
  }
};

const Data = {
  shiftDay(delta) {
    App.state.selectedDate = Utils.addDays(App.state.selectedDate, delta);
    App.save();
    Render.all();
  },

  addWater(val) {
    const day = App.getDay(App.state.selectedDate);
    day.water = Math.max(0, day.water + val);
    App.save();
    Render.all();
  },

  deleteLog(id) {
    const day = App.getDay(App.state.selectedDate);
    day.logs = day.logs.filter(l => l.id !== id);
    App.save();
    Render.all();
    // If in History sheet, refresh that too
    if (document.getElementById('sheet-dayEditor').classList.contains('open')) {
      UI.refreshDayEditor(App.state.selectedDate);
    }
  }
};

const UI = {
  nav(view, btn) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'));
    document.getElementById('view-' + view).classList.add('active-view');
    
    if (view === 'history') this.renderCalendar();
  },

  openSheet(id) {
    document.getElementById('backdrop').style.display = 'block';
    document.getElementById('sheet-' + id).classList.add('open');
  },

  closeAllSheets() {
    document.getElementById('backdrop').style.display = 'none';
    document.querySelectorAll('.sheet').forEach(s => s.classList.remove('open'));
  },

  renderCalendar() {
    const container = document.getElementById('calendar-body');
    container.innerHTML = '';
    
    // Render last 28 days
    for (let i = 0; i < 28; i++) {
      const date = Utils.addDays(Utils.todayKey(), -i);
      const day = App.getDay(date);
      const net = day.logs.reduce((a,c) => a+c.c, 0) - day.burn;
      
      let status = '';
      if (day.logs.length > 0) {
        status = (net <= App.state.settings.goal) ? 'good' : 'bad';
      }

      const cell = document.createElement('button');
      cell.className = `day-cell ${status} ${date === App.state.selectedDate ? 'selected' : ''}`;
      cell.innerText = date.split('-')[2];
      cell.onclick = () => {
        App.state.selectedDate = date;
        App.save();
        this.refreshDayEditor(date);
        this.openSheet('dayEditor');
      };
      container.appendChild(cell);
    }
  },

  refreshDayEditor(date) {
    document.getElementById('edit-date-title').innerText = Utils.formatDisplayDate(date);
    const day = App.getDay(date);
    const list = document.getElementById('edit-logs-list');
    
    if (day.logs.length === 0) {
      list.innerHTML = '<div class="text-zinc-500 text-center py-4 text-xs">No entries for this day</div>';
    } else {
      list.innerHTML = day.logs.map(l => `
        <div class="card p-3 flex justify-between items-center">
          <div class="text-sm font-bold text-white">${l.n} <span class="text-zinc-500">(${l.c} kcal)</span></div>
          <button onclick="Data.deleteLog('${l.id}')" class="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center">
            <i class="ph-bold ph-trash"></i>
          </button>
        </div>
      `).join('');
    }
  }
};

const Foods = {
  search() {
    const q = document.getElementById('search-input').value.toLowerCase();
    const res = document.getElementById('search-results');
    if (!q) { res.classList.add('hidden'); return; }
    
    const hits = DB.filter(f => f.n.toLowerCase().includes(q));
    res.classList.remove('hidden');
    res.innerHTML = hits.map(f => `
      <button onclick="Sheet.open('${f.id}')" class="card p-4 text-left flex justify-between items-center">
        <span class="text-white font-bold">${f.n}</span>
        <span class="text-zinc-500 text-xs">${f.c} kcal</span>
      </button>
    `).join('');
  }
};

const Sheet = {
  curr: null,
  qty: 1,

  open(id) {
    this.curr = DB.find(f => f.id === id);
    this.qty = 1;
    this.render();
    UI.openSheet('food');
  },

  adj(v) {
    this.qty = Math.max(0.5, this.qty + v);
    this.render();
  },

  render() {
    document.getElementById('sheet-name').innerText = this.curr.n;
    document.getElementById('sheet-qty').innerText = this.qty.toFixed(1);
    document.getElementById('sheet-total').innerText = Math.round(this.curr.c * this.qty) + ' kcal';
  },

  save() {
    const day = App.getDay(App.state.selectedDate);
    day.logs.push({
      id: Date.now().toString(),
      n: this.curr.n,
      c: this.curr.c * this.qty,
      qty: this.qty,
      meal: App.state.meal
    });
    App.save();
    Render.all();
    UI.closeAllSheets();
    document.getElementById('search-input').value = '';
    document.getElementById('search-results').classList.add('hidden');
  }
};

// Start
App.init();
