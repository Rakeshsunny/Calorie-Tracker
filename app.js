/* =========================
   Mission 72 Elite - app.js
   Fixes:
   - Local date keys (no UTC ISO bug)
   - Selectable day (edit old days)
   - Home date slider + swipe
   - Calendar highlights today + selected day
   ========================= */

/* ---------- Utilities ---------- */
function localISODate_(d) {
  // returns YYYY-MM-DD in LOCAL time (prevents UTC date flip)
  const dt = d ? new Date(d) : new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays_(iso, delta) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return localISODate_(dt);
}

function prettyDate_(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function clamp_(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function uid_() {
  return "c_" + Math.random().toString(36).slice(2, 9) + "_" + Date.now();
}

function escapeHtml_(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ---------- Built-in DB ---------- */
const DB = [
  { id: "egg", n: "Boiled Egg", u: "1 large", c: 78, p: 6, cb: 0, f: 5 },
  { id: "chick", n: "Chicken Breast", u: "150g", c: 250, p: 45, cb: 0, f: 6 },
  { id: "rice", n: "White Rice", u: "1 cup", c: 205, p: 4, cb: 44, f: 0 },
  { id: "roti", n: "Roti", u: "1 pc", c: 70, p: 3, cb: 15, f: 0 },
  { id: "dal", n: "Dal", u: "1 bowl", c: 260, p: 12, cb: 30, f: 10 },
  { id: "paneer", n: "Paneer", u: "100g", c: 265, p: 18, cb: 1, f: 20 }
];

/* ---------- App State ---------- */
const App = {
  key: "m72_enterprise_vfinal",
  state: {
    settings: { c: 1650, url: "" },
    meal: "Breakfast",
    custom: [],
    days: {},           // { "YYYY-MM-DD": { logs:[], burn:0, water:0 } }
    weightHistory: {},  // { "YYYY-MM-DD": 80.2 }
    selectedDate: null  // active day on Home/History
  },

  init() {
    const raw = localStorage.getItem(this.key);
    if (raw) {
      try { this.state = JSON.parse(raw); } catch (e) {}
    }
    // Ensure selectedDate exists and is LOCAL today by default
    const today = localISODate_();
    if (!this.state.selectedDate) this.state.selectedDate = today;

    // Ensure structure
    this.getDay(this.state.selectedDate);

    this.setMeal(this.state.meal || "Breakfast", true);
    Render.all();
    UI.attachHomeSwipe();
  },

  save() {
    localStorage.setItem(this.key, JSON.stringify(this.state));
  },

  setMeal(m, silent) {
    this.state.meal = m;

    ["Breakfast", "Lunch", "Snack", "Dinner"].forEach((id) => {
      const el = document.getElementById("btn-" + id);
      if (!el) return;
      if (id === m) {
        el.classList.add("text-white", "bg-zinc-800", "rounded-xl");
        el.classList.remove("text-zinc-500");
      } else {
        el.classList.remove("text-white", "bg-zinc-800", "rounded-xl");
        el.classList.add("text-zinc-500");
      }
    });

    if (!silent) {
      this.save();
      Render.all();
    }
  },

  setSelectedDate(iso) {
    this.state.selectedDate = iso;
    this.getDay(iso);
    this.save();
    Render.all();
  },

  getDay(iso) {
    const k = iso || localISODate_();
    if (!this.state.days[k]) this.state.days[k] = { logs: [], burn: 0, water: 0 };
    // Ensure defaults
    this.state.days[k].logs ||= [];
    this.state.days[k].burn ||= 0;
    this.state.days[k].water ||= 0;
    return this.state.days[k];
  },

  getSelectedDay() {
    return this.getDay(this.state.selectedDate);
  }
};

/* ---------- Render ---------- */
const Render = {
  all() {
    const dayKey = App.state.selectedDate;
    const day = App.getSelectedDay();
    const goal = App.state.settings.c;

    // totals
    const eaten = day.logs.reduce((a, b) => a + (Number(b.c) || 0), 0);
    const burn = Number(day.burn) || 0;
    const net = eaten - burn;

    // header date pill
    const dateLabel = document.getElementById("home-date-label");
    if (dateLabel) dateLabel.innerText = prettyDate_(dayKey);

    // main
    const rem = Math.round(Math.max(0, goal - net));
    const pct = clamp_((net / goal) * 100, 0, 100);

    const elRem = document.getElementById("val-rem");
    const elNet = document.getElementById("val-net");
    const elBurn = document.getElementById("val-burned");
    const elWater = document.getElementById("val-water");
    const elPct = document.getElementById("val-pct");
    const ring = document.getElementById("ring-progress");

    if (elRem) elRem.innerText = rem;
    if (elNet) elNet.innerText = Math.round(net);
    if (elBurn) elBurn.innerText = Math.round(burn);
    if (elWater) elWater.innerText = ((Number(day.water) || 0) * 0.25).toFixed(1);
    if (elPct) elPct.innerText = Math.round(pct) + "%";
    if (ring) ring.style.strokeDashoffset = 214 - (214 * pct) / 100;

    // macros totals
    const m = day.logs.reduce(
      (a, b) => ({
        p: a.p + (Number(b.p) || 0),
        cb: a.cb + (Number(b.cb) || 0),
        f: a.f + (Number(b.f) || 0)
      }),
      { p: 0, cb: 0, f: 0 }
    );

    // If you have these elements in your UI, keep them
    const proCurr = document.getElementById("curr-pro");
    const proTgt = document.getElementById("tgt-pro");
    const proBar = document.getElementById("bar-pro");

    const carbCurr = document.getElementById("curr-carb");
    const carbTgt = document.getElementById("tgt-carb");
    const carbBar = document.getElementById("bar-carb");

    const fatCurr = document.getElementById("curr-fat");
    const fatTgt = document.getElementById("tgt-fat");
    const fatBar = document.getElementById("bar-fat");

    const tgtPro = 130, tgtCarb = 170, tgtFat = 55;

    if (proCurr) proCurr.innerText = Math.round(m.p);
    if (proTgt) proTgt.innerText = tgtPro;
    if (proBar) proBar.style.width = clamp_((m.p / tgtPro) * 100, 0, 100) + "%";

    if (carbCurr) carbCurr.innerText = Math.round(m.cb);
    if (carbTgt) carbTgt.innerText = tgtCarb;
    if (carbBar) carbBar.style.width = clamp_((m.cb / tgtCarb) * 100, 0, 100) + "%";

    if (fatCurr) fatCurr.innerText = Math.round(m.f);
    if (fatTgt) fatTgt.innerText = tgtFat;
    if (fatBar) fatBar.style.width = clamp_((m.f / tgtFat) * 100, 0, 100) + "%";

    // weight chip
    const weights = Object.keys(App.state.weightHistory).sort();
    const latestW = weights.length ? App.state.weightHistory[weights[weights.length - 1]] : "--";
    const headerW = document.getElementById("header-weight");
    if (headerW) headerW.innerText = latestW;

    this.list();
    this.predict();

    // update history calendar highlights
    UI.renderCalendar();
  },

  list() {
    const day = App.getSelectedDay();
    const items = day.logs.filter((l) => l.meal === App.state.meal);

    const list = document.getElementById("log-list");
    if (!list) return;

    list.innerHTML =
      items
        .map(
          (i) => `
      <div class="glass-card p-4 flex justify-between items-center">
        <div>
          <div class="text-white font-bold text-sm">
            ${escapeHtml_(i.n)} <span class="text-zinc-500 font-normal">× ${i.qty}</span>
          </div>
          <div class="text-[10px] text-zinc-500 mt-1">P${Math.round(i.p)} C${Math.round(i.cb)} F${Math.round(i.f)}</div>
        </div>

        <div class="flex items-center gap-3">
          <button class="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 btn-press"
            onclick="Data.editLog('${i.id}')">
            <i class="ph-bold ph-pencil-simple"></i>
          </button>
          <button class="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-red-400 btn-press"
            onclick="Data.deleteLog('${i.id}')">
            <i class="ph-bold ph-trash"></i>
          </button>
          <span class="text-blue-400 font-bold w-12 text-right">${Math.round(i.c)}</span>
        </div>
      </div>
    `
        )
        .join("") ||
      `<div class="text-center py-6 text-zinc-700 text-[10px] border border-dashed border-zinc-800 rounded-2xl">Empty</div>`;
  },

  predict() {
    const eta = document.getElementById("eta-date");
    if (!eta) return;

    const dates = Object.keys(App.state.weightHistory).sort();
    if (dates.length < 2) return (eta.innerText = "Log 2+ Weights");

    const w0 = Number(App.state.weightHistory[dates[0]]);
    const w1 = Number(App.state.weightHistory[dates[dates.length - 1]]);
    const diff = w0 - w1;
    const velocity = diff / dates.length;

    if (velocity <= 0) return (eta.innerText = "Steady State");

    const days = Math.ceil((w1 - 72) / velocity);
    const d = new Date();
    d.setDate(d.getDate() + days);
    eta.innerText = d.toLocaleDateString([], { month: "short", day: "numeric" });
  }
};

/* ---------- UI ---------- */
const UI = {
  nav(idx, btn, viewId) {
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
    if (btn) btn.classList.add("active");

    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active-view"));
    const view = document.getElementById(viewId);
    if (view) view.classList.add("active-view");

    if (idx === 1) Analytics.render();
    if (idx === 2) this.renderCalendar();
  },

  open(id) {
    const backdrop = document.getElementById("backdrop");
    const sheet = document.getElementById(`sheet-${id}`);
    if (backdrop) backdrop.style.display = "block";
    if (sheet) sheet.classList.add("open");
  },

  closeAll() {
    const backdrop = document.getElementById("backdrop");
    if (backdrop) backdrop.style.display = "none";
    document.querySelectorAll(".sheet").forEach((s) => s.classList.remove("open"));
  },

  renderCalendar() {
    const body = document.getElementById("calendar-body");
    if (!body) return;

    body.innerHTML = "";
    const keys = Object.keys(App.state.days).sort(); // oldest -> newest

    const today = localISODate_();
    const selected = App.state.selectedDate;

    // Show latest ~35 days if too many
    const visible = keys.slice(Math.max(0, keys.length - 35));

    visible.forEach((date) => {
      const day = App.state.days[date];
      const goal = App.state.settings.c;
      const eaten = (day.logs || []).reduce((a, b) => a + (Number(b.c) || 0), 0);
      const burn = Number(day.burn) || 0;
      const net = eaten - burn;

      let base = "bg-zinc-900/50 text-zinc-400 border border-zinc-800";
      if (net > goal * 1.1) base = "bg-red-500/15 text-red-300 border border-red-500/20";
      if (net < goal * 0.9) base = "bg-emerald-500/12 text-emerald-300 border border-emerald-500/20";

      // highlight today & selected
      const isToday = date === today;
      const isSelected = date === selected;

      const extra =
        (isToday ? " ring-2 ring-blue-500/60 " : "") +
        (isSelected ? " ring-2 ring-white/70 " : "");

      body.innerHTML += `
        <button
          onclick="UI.openDay('${date}')"
          class="aspect-square rounded-xl flex items-center justify-center text-[11px] font-black ${base} ${extra} btn-press"
          title="${prettyDate_(date)}"
        >
          ${date.split("-")[2]}
        </button>
      `;
    });
  },

  openDay(date) {
    App.setSelectedDate(date);
    // switch to home tab automatically
    const homeBtn = document.querySelectorAll(".nav-btn")[0];
    UI.nav(0, homeBtn, "view-home");
  },

  attachHomeSwipe() {
    const home = document.getElementById("view-home");
    if (!home) return;

    let x0 = null;
    let y0 = null;

    home.addEventListener("touchstart", (e) => {
      if (!e.touches || !e.touches.length) return;
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
    }, { passive: true });

    home.addEventListener("touchend", (e) => {
      if (x0 === null || y0 === null) return;

      const x1 = e.changedTouches[0].clientX;
      const y1 = e.changedTouches[0].clientY;

      const dx = x1 - x0;
      const dy = y1 - y0;

      // swipe must be more horizontal than vertical
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) Data.shiftDay(+1); // swipe left -> next day
        else Data.shiftDay(-1);        // swipe right -> prev day
      }

      x0 = null;
      y0 = null;
    }, { passive: true });
  }
};

/* ---------- Foods / Search ---------- */
const Foods = {
  search() {
    const q = document.getElementById("search-input").value.trim().toLowerCase();
    const res = document.getElementById("search-results");
    if (!q) { res.classList.add("hidden"); return; }

    const pool = [...App.state.custom, ...DB];
    const hits = pool.filter((f) => (f.n || "").toLowerCase().includes(q)).slice(0, 5);

    res.classList.remove("hidden");

    const cards = hits.map((f) => `
      <div onclick="Sheet.openAdd('${f.id}')" class="bg-zinc-900 p-3 rounded-xl flex justify-between items-center border border-zinc-800 btn-press">
        <div class="text-white text-sm font-bold">${escapeHtml_(f.n)}</div>
        <div class="text-zinc-500 text-xs">${Math.round(f.c)} kcal</div>
      </div>
    `);

    if (hits.length === 0) {
      cards.push(`
        <div onclick="CustomFood.open('${q.replace(/'/g, "\\'")}')" class="bg-blue-600/10 border border-blue-500/20 p-4 rounded-2xl flex items-center justify-between btn-press">
          <div>
            <div class="text-white font-bold text-sm">Add “${escapeHtml_(q)}”</div>
            <div class="text-zinc-400 text-xs mt-1">Not found — create your own entry</div>
          </div>
          <i class="ph-bold ph-plus-circle text-blue-400 text-2xl"></i>
        </div>
      `);
    } else {
      cards.push(`
        <div onclick="CustomFood.open('${q.replace(/'/g, "\\'")}')" class="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between btn-press">
          <div>
            <div class="text-white font-bold text-sm">Add new food</div>
            <div class="text-zinc-500 text-xs mt-1">Create a custom item for “${escapeHtml_(q)}”</div>
          </div>
          <i class="ph-bold ph-plus text-zinc-300 text-2xl"></i>
        </div>
      `);
    }

    res.innerHTML = cards.join("");
  }
};

/* ---------- Sheets (Food add) ---------- */
const Sheet = {
  curr: null,
  qty: 1,

  openAdd(fid) {
    this.curr = [...App.state.custom, ...DB].find((f) => f.id === fid);
    this.qty = 1;
    this.render();
    UI.open("food");
  },

  render() {
    if (!this.curr) return;
    document.getElementById("sheet-name").innerText = this.curr.n;
    document.getElementById("sheet-qty").innerText = this.qty.toFixed(1);
    document.getElementById("sheet-total").innerText = Math.round(this.curr.c * this.qty) + " kcal";
  },

  adj(d) {
    this.qty = Math.max(0.5, this.qty + d);
    this.render();
  },

  save() {
    const day = App.getSelectedDay();
    const now = Date.now();

    day.logs.unshift({
      ...this.curr,
      id: now,
      qty: this.qty,
      c: this.curr.c * this.qty,
      p: (this.curr.p || 0) * this.qty,
      cb: (this.curr.cb || 0) * this.qty,
      f: (this.curr.f || 0) * this.qty,
      meal: App.state.meal,
      ts: now
    });

    App.save();
    Render.all();
    UI.closeAll();
  }
};

/* ---------- Custom Food ---------- */
const CustomFood = {
  open(prefillName) {
    document.getElementById("cf-name").value = prefillName ? prefillName : "";
    document.getElementById("cf-unit").value = "";
    document.getElementById("cf-cal").value = "";
    document.getElementById("cf-pro").value = "";
    document.getElementById("cf-carb").value = "";
    document.getElementById("cf-fat").value = "";
    document.getElementById("cf-save-lib").checked = true;
    UI.open("custom");
  },

  save() {
    const name = document.getElementById("cf-name").value.trim();
    if (!name) return alert("Enter food name");

    const unit = document.getElementById("cf-unit").value.trim() || "1 serving";
    const c = parseFloat(document.getElementById("cf-cal").value);
    const p = parseFloat(document.getElementById("cf-pro").value) || 0;
    const cb = parseFloat(document.getElementById("cf-carb").value) || 0;
    const f = parseFloat(document.getElementById("cf-fat").value) || 0;

    if (!isFinite(c) || c <= 0) return alert("Enter calories (kcal)");

    const item = { id: uid_(), n: name, u: unit, c, p, cb, f };
    const saveToLib = document.getElementById("cf-save-lib").checked;

    if (saveToLib) App.state.custom.unshift(item);

    // Add to selected day logs immediately
    const day = App.getSelectedDay();
    const now = Date.now();
    day.logs.unshift({
      ...item,
      id: now,
      qty: 1,
      meal: App.state.meal,
      ts: now
    });

    App.save();
    Render.all();
    UI.closeAll();

    document.getElementById("search-input").value = "";
    document.getElementById("search-results").classList.add("hidden");
  }
};

/* ---------- Data actions ---------- */
const Data = {
  // Home date navigation
  shiftDay(delta) {
    const next = addDays_(App.state.selectedDate, delta);
    App.setSelectedDate(next);
  },

  // Water controls now affect SELECTED day (not only today)
  addWater() {
    const day = App.getSelectedDay();
    day.water = (Number(day.water) || 0) + 1;
    App.save();
    Render.all();
  },

  removeWater() {
    const day = App.getSelectedDay();
    day.water = Math.max(0, (Number(day.water) || 0) - 1);
    App.save();
    Render.all();
  },

  addExercise(name, kcal) {
    const day = App.getSelectedDay();
    day.burn = (Number(day.burn) || 0) + Number(kcal || 0);
    App.save();
    Render.all();
    UI.closeAll();
  },

  editLog(logId) {
    // Simple edit: open food sheet with that log’s values as qty adjustment
    // For pro editing, you can add another sheet—this is minimal but works.
    const day = App.getSelectedDay();
    const log = day.logs.find((l) => String(l.id) === String(logId));
    if (!log) return;

    // Re-open the standard sheet and allow qty edits
    Sheet.curr = { id: log.id, n: log.n, u: log.u, c: log.c / (log.qty || 1), p: log.p / (log.qty || 1), cb: log.cb / (log.qty || 1), f: log.f / (log.qty || 1) };
    Sheet.qty = Number(log.qty) || 1;
    Sheet.render();

    // Save will add a new entry, so instead we do update on save:
    // set a flag for edit mode
    Sheet._editId = logId;
    UI.open("food");

    // Patch Sheet.save temporarily for edit mode:
    const originalSave = Sheet.save.bind(Sheet);
    Sheet.save = function() {
      const d = App.getSelectedDay();
      const idx = d.logs.findIndex((l) => String(l.id) === String(Sheet._editId));
      if (idx === -1) { Sheet.save = originalSave; return originalSave(); }

      const q = Sheet.qty;
      const base = Sheet.curr;

      d.logs[idx] = {
        ...d.logs[idx],
        n: base.n,
        u: base.u,
        qty: q,
        c: base.c * q,
        p: (base.p || 0) * q,
        cb: (base.cb || 0) * q,
        f: (base.f || 0) * q
      };

      Sheet._editId = null;
      Sheet.save = originalSave;
      App.save();
      Render.all();
      UI.closeAll();
    };
  },

  deleteLog(logId) {
    const day = App.getSelectedDay();
    day.logs = day.logs.filter((l) => String(l.id) !== String(logId));
    App.save();
    Render.all();
  },

  saveSettings() {
    const urlEl = document.getElementById("s-url");
    const calEl = document.getElementById("s-cal");
    App.state.settings = {
      url: urlEl ? urlEl.value : "",
      c: calEl ? parseInt(calEl.value || "1650", 10) : 1650
    };
    App.save();
    Render.all();
    UI.closeAll();
  },

  resetAll() {
    localStorage.removeItem(App.key);
    location.reload();
  }
};

/* ---------- Analytics (Trends) ---------- */
const Analytics = {
  render() {
    if (!window.Chart) return;
    const canvas = document.getElementById("chart-weight");
    if (!canvas) return;

    const dates = Object.keys(App.state.weightHistory).sort();
    const data = dates.map((k) => App.state.weightHistory[k]);

    if (window.wChart) window.wChart.destroy();
    window.wChart = new Chart(canvas, {
      type: "line",
      data: { labels: dates.map((d) => d.slice(5)), datasets: [{ label: "Weight", data, tension: 0.35, borderColor: "#10b981" }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false } } }
    });
  }
};

/* ---------- Boot ---------- */
document.addEventListener("DOMContentLoaded", () => App.init());
