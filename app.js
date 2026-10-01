/* Forge — application (tout est stocké sur l'appareil). */
(function () {
  "use strict";
  var D = window.CLB_DATA;
  var APP_VERSION = "2.0.0";
  var STORE_KEY = "clb.state.v1";

  /* ================= utilitaires ================= */
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseISO(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2], 12); }
  function addDays(s, k) { var d = parseISO(s); d.setDate(d.getDate() + k); return iso(d); }
  function today() { return iso(new Date()); }
  function mondayOf(s) { var d = parseISO(s); var wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return iso(d); }
  function daysBetween(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 864e5); }
  function short(s) { var p = s.split("-"); return p[2] + "/" + p[1]; }
  function longDate(s) { return parseISO(s).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }); }
  function fmt(n, d) { if (n == null || isNaN(n)) return "—"; return n.toFixed(d == null ? 1 : d).replace(".", ","); }
  function euro(n) { return fmt(n, 2) + " €"; }
  function parseNum(v) { if (v == null) return null; v = String(v).trim().replace(",", "."); if (!v) return null; var n = parseFloat(v); return isNaN(n) ? null : n; }
  function sign(n, d) { return (n > 0 ? "+" : n < 0 ? "−" : "") + fmt(Math.abs(n), d); }

  var toastTimer = null;
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 2400);
  }

  /* ================= état ================= */
  function defaults() {
    return {
      settings: { startDate: "2026-09-21", mealHours: [10, 14, 18], shopMode: "mix", stores: ["lidl"], showProgram: false, lastExport: null },
      profile: null, weights: {}, waist: {}, kcal: {}, plan: {}, day: {}, shop: {}, prices: {}, rides: {}
    };
  }
  var S = load();
  function load() {
    var base = defaults();
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var s = JSON.parse(raw), legacy = !("profile" in s);
        Object.keys(base).forEach(function (k) { if (s[k] == null && k !== "profile") s[k] = base[k]; });
        if (!("profile" in s)) s.profile = null;
        Object.keys(base.settings).forEach(function (k) { if (s.settings[k] == null) s.settings[k] = base.settings[k]; });
        if (legacy) migrateV1(s);
        return s;
      }
    } catch (e) {}
    return base;
  }
  /* Installation d'avant la version multi-profil : on garde le programme, Alcampo + Lidl et l'objectif en kcal. */
  function migrateV1(s) {
    s.settings.showProgram = true;
    s.settings.stores = ["alcampo", "lidl"];
    s.settings.shopMode = s.settings.shopMode === "a" ? "alcampo" : s.settings.shopMode === "l" ? "lidl" : "mix";
    var ks = Object.keys(s.weights || {}).sort();
    s.profile = { name: "", sex: "h", age: null, height: null, weight: ks.length ? s.weights[ks[ks.length - 1]] : null,
      activity: "assis", sessions: 4, goal: "bulk", kcalOverride: s.settings.kcalTarget || 2700 };
    delete s.settings.kcalTarget;
    Object.keys(s.prices || {}).forEach(function (k) {
      var o = s.prices[k], n = {};
      if (typeof o.a === "number") n.alcampo = o.a;
      if (typeof o.l === "number") n.lidl = o.l;
      Object.keys(o).forEach(function (x) { if (x !== "a" && x !== "l") n[x] = o[x]; });
      s.prices[k] = n;
    });
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); }
    catch (e) { toast("Stockage plein : exporte une sauvegarde puis supprime des photos."); }
  }
  function pruneOld() {
    var lim = addDays(today(), -60), limW = addDays(mondayOf(today()), -56);
    delete S.meals; delete S.settings.rotStart;
    Object.keys(S.day).forEach(function (k) { if (k < lim) delete S.day[k]; });
    Object.keys(S.rides).forEach(function (k) { if (k < lim) delete S.rides[k]; });
    Object.keys(S.shop).forEach(function (k) { if (k.indexOf("w-") !== 0 || k.slice(2) < limW) delete S.shop[k]; });
    var pk = Object.keys(S.plan).sort(); pk.slice(0, Math.max(0, pk.length - 10)).forEach(function (k) { delete S.plan[k]; });
  }

  /* ================= photos (IndexedDB) ================= */
  var dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      var r = indexedDB.open("clb", 1);
      r.onupgradeneeded = function () { r.result.createObjectStore("photos", { keyPath: "id" }); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return dbp;
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction("photos", mode), st = t.objectStore("photos"), out = fn(st);
        t.oncomplete = function () { res(out && out.result !== undefined ? out.result : out); };
        t.onerror = function () { rej(t.error); };
      });
    });
  }
  function photosAll() { return tx("readonly", function (st) { return st.getAll(); }).then(function (a) { return (a || []).sort(function (x, y) { return y.date < x.date ? -1 : y.date > x.date ? 1 : y.id - x.id; }); }); }
  function photoPut(p) { return tx("readwrite", function (st) { st.put(p); }); }
  function photoDel(id) { return tx("readwrite", function (st) { st.delete(id); }); }
  function photosClear() { return tx("readwrite", function (st) { st.clear(); }); }

  function compress(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var max = 1400, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? res(b) : rej(new Error("compress")); }, "image/jpeg", 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error("image")); };
      img.src = url;
    });
  }
  function blobToDataURL(b) { return new Promise(function (res) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.readAsDataURL(b); }); }
  function dataURLToBlob(u) { var p = u.split(","), m = p[0].match(/:(.*?);/)[1], bin = atob(p[1]), a = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type: m }); }

  /* ================= programme ================= */
  function progWeek(dateIso) { return Math.floor(daysBetween(mondayOf(S.settings.startDate), mondayOf(dateIso)) / 7) + 1; }
  function blockFor(w) { for (var i = 0; i < D.BLOCKS.length; i++) if (w >= D.BLOCKS[i].from && w <= D.BLOCKS[i].to) return D.BLOCKS[i]; return null; }
  function weekStartOf(n) { return addDays(mondayOf(S.settings.startDate), (n - 1) * 7); }

  /* ================= profil & besoins ================= */
  var GOALS = {
    bulk: { label: "Prise de masse", short: "Prise de masse", prot: 1.8, desc: "Prendre du muscle avec un léger surplus (+300 kcal)." },
    maintain: { label: "Maintien", short: "Maintien", prot: 1.6, desc: "Garder ton poids et ta forme actuels." },
    cut: { label: "Sèche", short: "Sèche", prot: 2.2, desc: "Perdre du gras en gardant le muscle (−20 %)." },
    endurance: { label: "Performance / endurance", short: "Endurance", prot: 1.6, desc: "Vélo, course, trail : manger assez pour performer, avec un bonus les jours de sortie." }
  };
  var ACTIVITY = {
    assis: { label: "Assis la plupart du temps", hint: "Études, bureau, peu de marche", pal: 1.25 },
    debout: { label: "Debout ou marche régulière", hint: "Vente, restauration, 8 000 pas et plus", pal: 1.4 },
    actif: { label: "Très actif", hint: "Travail physique, chantier, manutention", pal: 1.55 }
  };
  var BASE_KCAL = 2700, RIDE_KCAL = 600;
  function goal() { return (S.profile && GOALS[S.profile.goal]) ? S.profile.goal : "bulk"; }
  function curWeight() {
    var ks = Object.keys(S.weights).sort().slice(-7);
    if (ks.length) return ks.reduce(function (a, k) { return a + S.weights[k]; }, 0) / ks.length;
    return S.profile && S.profile.weight;
  }
  function needs() {
    var p = S.profile; if (!p || !p.age || !p.height) return null;
    var w = curWeight() || p.weight; if (!w) return null;
    var bmr = 10 * w + 6.25 * p.height - 5 * p.age + (p.sex === "f" ? -161 : 5);
    var pal = (ACTIVITY[p.activity] || ACTIVITY.assis).pal + 0.04 * Math.min(10, p.sessions || 0);
    var tdee = bmr * pal, g = goal();
    var calc = g === "bulk" ? tdee + 300 : g === "cut" ? tdee * 0.8 : tdee;
    calc = Math.round(calc / 50) * 50;
    return { w: w, bmr: Math.round(bmr), pal: pal, tdee: Math.round(tdee / 10) * 10, calc: calc,
      target: p.kcalOverride || calc, custom: !!p.kcalOverride, prot: Math.round(GOALS[g].prot * w / 5) * 5 };
  }
  function rideHours(d) { return goal() === "endurance" ? (S.rides[d] || 0) : 0; }
  function targetKcal(d) { var n = needs(); return (n ? n.target : BASE_KCAL) + (d ? rideHours(d) * RIDE_KCAL : 0); }
  function factor(d) { return targetKcal(d) / BASE_KCAL; }
  function showsES() { return S.settings.stores.some(function (id) { var st = storeById(id); return st && st.es; }); }

  /* ================= repas (à la carte) ================= */
  var MK = D.MOMENTS.map(function (m) { return m.k; });
  var RBY = {};
  MK.forEach(function (k) { D.RECIPES[k].forEach(function (r) { r.m = k; RBY[r.id] = r; }); });
  /* Midi et soir partagent les mêmes gamelles : celles du moment choisi d'abord, puis les autres. */
  function recipesFor(m) {
    if (m === "midi") return D.RECIPES.midi.concat(D.RECIPES.soir);
    if (m === "soir") return D.RECIPES.soir.concat(D.RECIPES.midi);
    return D.RECIPES[m];
  }
  var DEFAULT_PLAN = { pd: { "pd-porridge": 4, "pd-pancakes": 3 }, midi: { "mi-poulriz": 4, "mi-tikka": 3 }, coll: { "co-skyramandes": 4, "co-fbnoix": 3 }, soir: { "so-bolo": 4, "so-chili": 3 } };
  function macros(ing, k) { k = k || 1; var t = [0, 0, 0, 0]; ing.forEach(function (x) { var f = D.FOOD[x[0]]; for (var i = 0; i < 4; i++) t[i] += f.n[i] * x[1] * k / 100; }); return t; }
  var PIECES = { oeuf: 1, banane: 1, pomme: 1, clem: 1, tortilla: 1 };
  function ingLabel(x, k) {
    if (Math.abs(k - 1) < 0.04) return x[2];
    var key = x[0], f = D.FOOD[key], g = x[1] * k;
    if (PIECES[key] && f.piece) { var n = g / f.piece; return n < 0.75 ? "½" : String(Math.round(n * 2) / 2).replace(".5", " ½"); }
    if (f.liquid) return Math.max(5, Math.round(g / 10) * 10) + " ml";
    var suf = (x[2].match(/ (cru|crue|crues|égouttés?)$/) || [""])[0];
    return Math.max(5, Math.round(g / 5) * 5) + " g" + suf;
  }
  function recipeName(id) { return id === "libre" ? "Repas libre (hors plan)" : RBY[id] ? RBY[id].name : "Recette supprimée"; }
  function recipeMacros(id, k) { return RBY[id] ? macros(RBY[id].ing, k) : null; }
  function planFor(ws) {
    if (S.plan[ws]) return S.plan[ws];
    var keys = Object.keys(S.plan).filter(function (k) { return k < ws; }).sort();
    return JSON.parse(JSON.stringify(keys.length ? S.plan[keys[keys.length - 1]] : DEFAULT_PLAN));
  }
  function planIsCopy(ws) { return !S.plan[ws]; }
  function planEnsure(ws) { if (!S.plan[ws]) S.plan[ws] = planFor(ws); MK.forEach(function (k) { if (!S.plan[ws][k]) S.plan[ws][k] = {}; }); return S.plan[ws]; }
  function planCount(p, m) { var n = 0, o = p[m] || {}; Object.keys(o).forEach(function (id) { if (RBY[id]) n += o[id]; }); return n; }
  function eatenInWeek(ws, id, exceptDate) {
    var n = 0;
    for (var i = 0; i < 7; i++) { var d = addDays(ws, i), x = S.day[d]; if (d === exceptDate || !x) continue; MK.forEach(function (k) { if (x[k] && x[k].r === id && x[k].done) n++; }); }
    return n;
  }
  function suggest(m, d) {
    var ws = mondayOf(d), p = planFor(ws)[m] || {}, best = null, bestLeft = -Infinity;
    Object.keys(p).forEach(function (id) { if (!RBY[id] || !p[id]) return; var left = p[id] - eatenInWeek(ws, id, d); if (left > bestLeft) { bestLeft = left; best = id; } });
    return best || recipesFor(m)[0].id;
  }
  function pickFor(m, d) { var x = S.day[d] && S.day[d][m]; return (x && x.r) || suggest(m, d); }
  function isDone(m, d) { var x = S.day[d] && S.day[d][m]; return !!(x && x.done); }
  function dayRec(d) { if (!S.day[d]) S.day[d] = {}; return S.day[d]; }
  function setDone(m, d, v) { var r = pickFor(m, d); dayRec(d)[m] = { r: r, done: v }; }
  function setPick(m, d, id) { var x = dayRec(d); x[m] = { r: id, done: !!(x[m] && x[m].done) }; }
  function slotNow() { var h = new Date().getHours() + new Date().getMinutes() / 60, mh = S.settings.mealHours; return h < mh[0] ? 0 : h < mh[1] ? 1 : h < mh[2] ? 2 : 3; }
  function ingName(k) { return D.RNAME[k] || D.FOOD[k].fr.replace(" (égoutté)", "").replace(" (égouttées)", ""); }

  /* ================= pesées ================= */
  function weekValues(ws) { var out = []; for (var i = 0; i < 7; i++) { var v = S.weights[addDays(ws, i)]; out.push(typeof v === "number" ? v : null); } return out; }
  function weekAvg(ws) { var v = weekValues(ws).filter(function (x) { return x != null; }); return v.length ? { avg: v.reduce(function (a, b) { return a + b; }, 0) / v.length, n: v.length } : null; }
  function weekList() {
    var keys = Object.keys(S.weights).sort();
    var first = S.settings.showProgram ? mondayOf(S.settings.startDate) : (keys.length ? mondayOf(keys[0]) : mondayOf(today()));
    if (keys.length && keys[0] < first) first = mondayOf(keys[0]);
    var cur = mondayOf(today()), out = [];
    for (var ws = first; ws <= cur; ws = addDays(ws, 7)) out.push(ws);
    return out;
  }
  function trend() {
    var ws = weekList().map(function (w) { var a = weekAvg(w); return a && a.n >= 3 ? { ws: w, avg: a.avg } : null; }).filter(Boolean);
    if (ws.length < 3) return { ready: false, left: 3 - ws.length };
    var a = ws[ws.length - 1], b = ws[Math.max(0, ws.length - 4)];
    var span = Math.max(1, daysBetween(b.ws, a.ws) / 7), perWeek = (a.avg - b.avg) / span;
    var wa = S.waist[a.ws], wb = S.waist[b.ws];
    return { ready: true, perMonth: perWeek * 4.33, dWaist: (typeof wa === "number" && typeof wb === "number") ? wa - wb : null, kcal: S.kcal[a.ws] || targetKcal() };
  }
  function verdictHTML() {
    var t = trend(), g = goal();
    if (!t.ready) return '<span class="chip grey">En attente</span><p>Encore ' + t.left + ' semaine' + (t.left > 1 ? "s" : "") + ' avec au moins 3 pesées avant d\'ajuster les calories. D\'ici là, on ne touche à rien.</p>';
    var up = '<p>Ajoute 150 kcal (vise ~' + (t.kcal + 150) + ' kcal/j), par exemple 20 g de riz cru et ½ banane.</p>';
    var down = '<p>Retire 150 kcal (vise ~' + (t.kcal - 150) + ' kcal/j) et réévalue dans 2-3 semaines.</p>';
    var pm = sign(t.perMonth, 1) + ' kg/mois';
    if (g === "bulk") {
      if (t.perMonth > 1 || (t.dWaist != null && t.dWaist >= 1)) return '<span class="chip red">Trop rapide</span>' + down.replace('<p>', '<p>' + (t.dWaist != null && t.dWaist >= 1 ? "Tour de taille +" + fmt(t.dWaist, 1) + " cm. " : pm + ". "));
      if (t.perMonth < 0.3) {
        if (t.dWaist != null && t.dWaist <= -0.5) return '<span class="chip good">Recompo</span><p>Poids stable mais tour de taille en baisse (' + fmt(t.dWaist, 1) + ' cm) : tu prends du muscle en perdant du gras. Garde les calories.</p>';
        return '<span class="chip warn">Stagnation</span>' + up.replace('<p>', '<p>Le poids ne bouge presque pas. ');
      }
      return '<span class="chip good">Dans la cible</span><p>' + pm + (t.dWaist != null ? ', tour de taille ' + sign(t.dWaist, 1) + ' cm' : '') + '. Ne change rien.</p>';
    }
    if (g === "cut") {
      if (t.perMonth < -4) return '<span class="chip red">Trop rapide</span>' + up.replace('<p>', '<p>' + pm + ' : tu risques de perdre du muscle. ');
      if (t.perMonth > -1) {
        if (t.dWaist != null && t.dWaist <= -0.5) return '<span class="chip good">Recompo</span><p>Le poids bouge peu mais le tour de taille baisse (' + fmt(t.dWaist, 1) + ' cm). Garde les calories.</p>';
        return '<span class="chip warn">Stagnation</span>' + down.replace('<p>', '<p>' + pm + '. ');
      }
      return '<span class="chip good">Dans la cible</span><p>' + pm + ' : rythme de sèche idéal (−1 à −4 kg/mois). Ne change rien.</p>';
    }
    if (t.perMonth > 0.5) return '<span class="chip warn">En hausse</span>' + down.replace('<p>', '<p>' + pm + '. ');
    if (t.perMonth < -0.5) return '<span class="chip warn">En baisse</span>' + up.replace('<p>', '<p>' + pm + '. ' + (g === "endurance" ? 'Vérifie que tu ajoutes bien tes sorties le jour même. ' : ''));
    return '<span class="chip good">Stable</span><p>' + pm + ' : poids stable, c\'est l\'objectif. Ne change rien.</p>';
  }

  /* ================= prix & courses ================= */
  function storeById(id) { for (var i = 0; i < D.STORES.length; i++) if (D.STORES[i].id === id) return D.STORES[i]; return null; }
  function storeName(id) { var st = storeById(id); return st ? st.name : id; }
  function basePrice(k, id) {
    var b = D.PRICES[k], st = storeById(id); if (!b || !st) return { v: null, est: true };
    if (st.src === "a") return { v: b.a, est: id !== "alcampo" || !!b.ae };
    if (st.src === "l") return { v: b.l, est: true };
    return { v: Math.round(b.l * 1.12 * 100) / 100, est: true };
  }
  function price(k, id) {
    var o = S.prices[k] && S.prices[k][id];
    if (typeof o === "number") return { v: o, src: "corrigé" };
    var b = basePrice(k, id);
    return { v: b.v, src: b.est ? "estimé" : "relevé le " + D.PRICES_DATE };
  }
  function costOf(k, grams, id) {
    var p = price(k, id).v; if (p == null) return null;
    if (k === "oeuf") return Math.ceil(grams / D.FOOD.oeuf.piece) * p;
    return grams / 1000 * p;
  }
  function qtyLabel(k, g) {
    var f = D.FOOD[k];
    if (f.piece) { var n = Math.ceil(g / f.piece); return n + (k === "yaourt" ? " pot" + (n > 1 ? "s" : "") : ""); }
    if (f.liquid) return g >= 1000 ? (Math.ceil(g / 500) * 0.5).toFixed(1).replace(".0", "").replace(".", ",") + " L" : Math.ceil(g / 10) * 10 + " ml";
    if (g >= 1000) return (Math.ceil(g / 100) / 10).toFixed(1).replace(".0", "").replace(".", ",") + " kg";
    return Math.ceil(g / 50) * 50 + " g";
  }
  function shopItems(ws) {
    var sum = {}, p = planFor(ws), k = factor(), stores = S.settings.stores;
    MK.forEach(function (m) { Object.keys(p[m] || {}).forEach(function (id) { var r = RBY[id], n = p[m][id]; if (!r || !n) return; r.ing.forEach(function (x) { sum[x[0]] = (sum[x[0]] || 0) + x[1] * n * k; }); }); });
    return Object.keys(sum).filter(function (key) { return !D.FOOD[key].stock; }).map(function (key) {
      var c = {}, best = stores[0];
      stores.forEach(function (sid) { c[sid] = costOf(key, sum[key], sid); if (c[sid] != null && (c[best] == null || c[sid] < c[best])) best = sid; });
      return { k: key, f: D.FOOD[key], g: sum[key], q: qtyLabel(key, sum[key]), c: c, best: best };
    });
  }
  function shopTotals(items) {
    var t = { mix: 0 };
    S.settings.stores.forEach(function (sid) { t[sid] = 0; });
    items.forEach(function (it) { S.settings.stores.forEach(function (sid) { t[sid] += it.c[sid] || 0; }); t.mix += it.c[it.best] || 0; });
    return t;
  }
  function shopMode() { var m = S.settings.shopMode, st = S.settings.stores; if (st.length < 2) return st[0]; return (m === "mix" || st.indexOf(m) >= 0) ? m : "mix"; }
  function shopChecked(ws) { var key = "w-" + ws; if (!S.shop[key]) S.shop[key] = {}; return S.shop[key]; }
  var RAYONS = ["Protéines", "Féculents", "Légumes", "Laitiers", "Fruits & oléagineux", "Placard"];

  /* ================= navigation ================= */
  var current = "accueil";
  var weekOff = 0;
  var repasSeg = MK[slotNow()];
  function planWeek() { return addDays(mondayOf(today()), 7 * weekOff); }
  var suiviSeg = "pesees";
  function show(tab) {
    if (!$("view-" + tab)) tab = "accueil";
    current = tab;
    document.querySelectorAll(".tab").forEach(function (b) { b.setAttribute("aria-selected", String(b.dataset.tab === tab)); });
    document.querySelectorAll(".view").forEach(function (v) { v.hidden = v.id !== "view-" + tab; });
    $("title").innerHTML = tab === "accueil" ? 'FOR<em>GE</em>' : esc($("view-" + tab).dataset.title);
    render();
    window.scrollTo(0, 0);
    try { sessionStorage.setItem("clb.tab", tab); } catch (e) {}
  }
  function render() {
    ({ accueil: renderAccueil, suivi: renderSuivi, repas: renderRepas, courses: renderCourses })[current]();
  }
  document.querySelectorAll(".tab").forEach(function (b) { b.addEventListener("click", function () { show(b.dataset.tab); }); });
  window.addEventListener("scroll", function () { $("topbar").classList.toggle("scrolled", window.scrollY > 4); }, { passive: true });

  var CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  /* ================= ACCUEIL ================= */
  var photoCache = null;
  function renderAccueil() {
    var t = today(), w = progWeek(t), b = blockFor(w), el = $("view-accueil");
    var html = "";

    /* --- programme (optionnel) --- */
    var track = "";
    if (S.settings.showProgram) {
    for (var i = 1; i <= 24; i++) {
      var bi = blockFor(i), cls = (bi && (bi.phase === "Deload")) ? "deload" : "";
      if (i < w) cls += " done"; if (i === w) cls += " now";
      track += '<i class="' + cls + '" title="Semaine ' + i + '"></i>';
    }
    if (w < 1) {
      html += '<section class="hero">' + ribbon() + '<span class="eyebrow">Programme 24 semaines</span><div class="phase-name">Début le ' + esc(longDate(S.settings.startDate)) + '</div><div class="track">' + track + '</div></section>';
    } else if (w > 24 || !b) {
      html += '<section class="hero">' + ribbon() + '<span class="eyebrow">Programme 24 semaines</span><div class="weekbig">Terminé</div><p class="muted">Cycle bouclé. Prochaine étape envisagée : format top set / back-off sets.</p><div class="track">' + track + '</div></section>';
    } else {
      var nextDeload = D.BLOCKS.filter(function (x) { return x.phase === "Deload" && x.from > w; })[0];
      var dayN = ((new Date().getDay() + 6) % 7) + 1;
      html += '<section class="hero">' + ribbon() +
        '<div class="row"><span class="chip red">' + esc(b.phase) + '</span><span class="chip grey">' + esc(b.intensity) + '</span></div>' +
        '<div><div class="weekbig num">S' + w + '<small>/ 24</small></div><div class="phase-name">' + esc(b.name) + '</div></div>' +
        '<div class="track" aria-label="Avancement : semaine ' + w + ' sur 24">' + track + '</div>' +
        '<p class="small">' + esc(b.summary) + '</p>' +
        '<ul class="keys">' + b.keys.map(function (k) { return "<li>" + esc(k) + "</li>"; }).join("") + '</ul>' +
        '<p class="tiny muted">Jour ' + dayN + '/7 · ' + (nextDeload ? 'Prochaine décharge en semaine ' + nextDeload.from + ' (dans ' + (nextDeload.from - w) + ' sem.)' : 'Plus de décharge avant les tests') + ' · Nutrition : ' + esc(b.nutri) + '</p>' +
        (b.sessions ? '<details class="fold"><summary>Séances du bloc</summary><div class="sessions">' + Object.keys(b.sessions).map(function (s) {
          return '<div class="session"><h4>' + esc(s) + '</h4>' + b.sessions[s].map(function (e) {
            return '<div class="ex"><span>' + esc(e[0]) + '</span><span class="s">' + esc(e[1]) + '</span><span class="d">Tempo ' + esc(e[2]) + ' · repos ' + esc(e[3]) + '</span></div>';
          }).join("") + '</div>';
        }).join("") + '</div></details>' : '') +
        '<details class="fold"><summary>Règles du programme</summary><ul class="keys" style="margin-top:10px">' + D.GENERAL.map(function (g) { return "<li>" + esc(g) + "</li>"; }).join("") + '</ul></details>' +
        '</section>';
    }
    }

    /* --- objectif du jour --- */
    html += goalCardHTML(t);

    /* --- pesée --- */
    var tw = S.weights[t], ws = mondayOf(t), wa = weekAvg(ws), prev = weekAvg(addDays(ws, -7));
    var avgs = weekList().map(function (x) { var a = weekAvg(x); return a ? a.avg : null; }).filter(function (x) { return x != null; });
    html += '<section class="card"><div class="card-head"><h2>Pesée du jour</h2><span class="tiny muted">' + esc(longDate(t)) + '</span></div>';
    if (typeof tw === "number") {
      html += '<div class="row"><div class="grow"><div class="bigval num">' + fmt(tw, 2) + '<small>kg</small></div><p class="small muted">Moyenne semaine : ' + (wa ? fmt(wa.avg, 2) + ' kg (' + wa.n + ' pesée' + (wa.n > 1 ? 's' : '') + ')' : '—') + (wa && prev ? ' · <span class="' + (wa.avg - prev.avg >= 0.05 ? 'up' : wa.avg - prev.avg <= -0.05 ? 'down' : 'flat') + '">' + sign(wa.avg - prev.avg, 2) + ' kg</span> vs sem. dernière' : '') + '</p></div><button class="btn" data-act="edit-today">Modifier</button></div>';
    } else {
      html += '<p class="small muted">Le matin, à jeun, après les toilettes.</p><div class="weigh"><input id="today-w" type="text" inputmode="decimal" placeholder="' + (avgs.length ? fmt(avgs[avgs.length - 1], 1) : "87,5") + '" aria-label="Poids du jour en kg"><button class="btn primary" data-act="save-today">Enregistrer</button></div>';
    }
    if (avgs.length >= 2) html += spark(avgs);
    html += '</section>';

    /* --- repas --- */
    var done = MK.map(function (k) { return isDone(k, t); }), slot = slotNow(), next = -1;
    for (var k = slot; k < 4; k++) if (!done[k]) { next = k; break; }
    var missed = 0; for (var j = 0; j < slot; j++) if (!done[j]) missed++;
    html += '<section class="card"><div class="card-head"><h2>Prochain repas</h2><div class="dots" aria-label="' + done.filter(Boolean).length + ' repas sur 4">' + done.map(function (d) { return '<i class="' + (d ? 'on' : '') + '"></i>'; }).join("") + '</div></div>';
    if (next >= 0) {
      var mk = MK[next], id = pickFor(mk, t), mc = recipeMacros(id, factor(t));
      html += '<div><span class="eyebrow">' + esc(D.MOMENTS[next].label) + '</span><h3>' + esc(recipeName(id)) + '</h3>' + (mc ? '<p class="small muted num">' + Math.round(mc[0]) + ' kcal · ' + Math.round(mc[1]) + ' g protéines</p>' : '') + '</div>' +
        '<div class="row"><button class="btn primary grow" data-act="eat" data-m="' + mk + '">Mangé</button><button class="btn" data-act="choose" data-m="' + mk + '">Changer</button></div>';
    } else if (done.every(Boolean)) {
      html += '<p><b>Journée complète.</b> <span class="muted">Les 4 repas sont cochés.</span></p>';
    } else {
      html += '<p class="small">Plus de repas prévu à cette heure-ci.</p>';
    }
    if (missed) html += '<p class="tiny muted">' + missed + ' repas plus tôt non coché' + (missed > 1 ? 's' : '') + '. <button class="link" data-go="repas">Cocher</button></p>';
    html += '</section>';

    /* --- courses --- */
    var items = shopItems(mondayOf(t)), ck = shopChecked(mondayOf(t)), left = items.filter(function (it) { return !ck[it.k]; });
    var mode = shopMode();
    html += '<section class="card"><div class="card-head"><h2>Courses</h2><span class="chip ' + (left.length ? 'grey' : 'good') + '">' + (left.length ? left.length + ' à acheter' : 'Tout est pris') + '</span></div>';
    if (left.length) {
      html += '<div class="mini-list">' + left.slice(0, 4).map(function (it) {
        var st = mode === "mix" ? it.best : mode;
        return '<div class="li"><span>' + esc(it.f.fr) + ' <span class="muted small">' + esc(it.q) + '</span></span>' + (S.settings.stores.length > 1 ? '<span class="chip ' + (st === S.settings.stores[0] ? "alc" : "lidl") + '">' + esc(storeName(st)) + '</span>' : '') + '</div>';
      }).join("") + '</div>';
      if (left.length > 4) html += '<p class="tiny muted">+ ' + (left.length - 4) + ' autre' + (left.length - 4 > 1 ? 's' : '') + '</p>';
    }
    html += '<button class="btn block" data-go="courses">Voir la liste de la semaine</button></section>';

    /* --- photo --- */
    html += '<section class="card" id="photo-card"><div class="card-head"><h2>Photo</h2></div><p class="small muted" id="photo-status">…</p><button class="btn block" data-act="photo-go">Ouvrir mes photos</button></section>';

    el.innerHTML = html;
    photosAll().then(function (ps) {
      var st = $("photo-status"); if (!st) return;
      if (!ps.length) { st.innerHTML = "Aucune photo pour l'instant. Prends ta photo de départ : même lumière, le matin à jeun."; return; }
      var d = daysBetween(ps[0].date, today());
      st.innerHTML = 'Dernière photo le ' + short(ps[0].date) + ' (il y a ' + d + ' jour' + (d > 1 ? 's' : '') + '). ' + (d >= 28 ? '<b style="color:var(--red-hi)">C\'est le moment d\'en reprendre une.</b>' : 'Prochaine dans ' + (28 - d) + ' jours.');
    }).catch(function () {});
  }
  function goalCardHTML(t) {
    var n = needs(), g = goal(), h = rideHours(t);
    if (!n) return '<section class="card"><h2>Ton objectif</h2><p class="small muted">Complète ton profil pour calculer tes besoins.</p><button class="btn primary block" data-act="profile">Compléter mon profil</button></section>';
    var name = S.profile.name ? esc(S.profile.name) : "";
    var html = '<section class="card goalcard">' + (S.settings.showProgram ? '' : ribbon()) +
      '<div class="card-head"><div><span class="eyebrow">' + (name ? 'Salut ' + name + ' · ' : '') + esc(GOALS[g].label) + '</span><h2>Objectif du jour</h2></div></div>' +
      '<div class="row goalnums"><div><div class="bigval num">' + targetKcal(t) + '<small>kcal</small></div></div><div><div class="bigval num">' + n.prot + '<small>g prot.</small></div></div></div>' +
      '<p class="tiny muted">' + (n.custom ? 'Objectif personnalisé' : 'Maintenance estimée ' + n.tdee + ' kcal') + (h ? ' · dont +' + (h * RIDE_KCAL) + ' kcal pour ta sortie' : '') + '</p>';
    if (g === "endurance") {
      html += '<div class="ride"><span class="small"><b>Sortie aujourd\'hui ?</b></span><div class="seg ride-seg" role="group" aria-label="Durée de la sortie">' +
        [0, 1, 2, 3, 4].map(function (x) { return '<button data-ride="' + x + '" aria-pressed="' + (h === x) + '">' + (x === 0 ? 'Non' : x === 4 ? '4 h +' : x + ' h') + '</button>'; }).join("") + '</div>' +
        (h ? '<p class="tiny muted">Tes portions du jour sont augmentées. Pendant l\'effort : 30 à 60 g de glucides par heure (banane, galettes de riz, boisson sucrée), et bois régulièrement.</p>' : '') + '</div>';
    }
    return html + '</section>';
  }
  function ribbon() {
    return '<svg class="ribbon" viewBox="0 0 260 220" aria-hidden="true"><path d="M30 -10 C 90 60, 60 120, 150 140 S 250 120, 290 190" fill="none" stroke="#E8322D" stroke-width="22" stroke-linecap="round" opacity=".85"/><path d="M70 -20 C 130 50, 110 100, 190 110 S 270 90, 300 140" fill="none" stroke="#3a3a43" stroke-width="14" stroke-linecap="round"/><path d="M0 40 C 60 90, 70 160, 150 185 S 240 200, 280 240" fill="none" stroke="#7A1411" stroke-width="9" stroke-linecap="round"/></svg>';
  }
  function spark(vals) {
    var W = 300, H = 56, min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (max - min < 1) { var mid = (max + min) / 2; min = mid - 0.5; max = mid + 0.5; }
    var pts = vals.map(function (v, i) { return [8 + i * (W - 16) / Math.max(1, vals.length - 1), 6 + (max - v) / (max - min) * (H - 12)]; });
    var d = pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" ");
    var last = pts[pts.length - 1];
    return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-label="Évolution du poids moyen par semaine"><path d="' + d + ' L' + last[0] + ' ' + H + ' L' + pts[0][0] + ' ' + H + ' Z" fill="rgba(232,50,45,.12)"/><path d="' + d + '" fill="none" stroke="#E8322D" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><circle cx="' + last[0] + '" cy="' + last[1] + '" r="4" fill="#E8322D"/></svg><p class="tiny muted">Moyenne par semaine · ' + sign(vals[vals.length - 1] - vals[0], 1) + ' kg depuis le début</p>';
  }

  $("view-accueil").addEventListener("click", function (e) {
    var go = e.target.closest("[data-go]"); if (go) { show(go.dataset.go); return; }
    var a = e.target.closest("[data-act]"); if (!a) return;
    var act = a.dataset.act;
    if (act === "save-today") {
      var v = parseNum($("today-w").value);
      if (v == null || v < 30 || v > 250) { toast("Entre ton poids en kg, par exemple 87,6"); return; }
      S.weights[today()] = v; save(); toast("Pesée enregistrée"); renderAccueil();
    } else if (act === "edit-today") {
      delete S.weights[today()]; save(); renderAccueil(); var i = $("today-w"); if (i) i.focus();
    } else if (act === "eat") {
      setDone(a.dataset.m, today(), true); save(); toast("Repas coché"); renderAccueil();
    } else if (act === "choose") {
      chooseSheet(a.dataset.m, today(), renderAccueil);
    } else if (act === "photo-go") { suiviSeg = "photos"; show("suivi"); }
    else if (act === "profile") openProfile(false);
  });
  $("view-accueil").addEventListener("click", function (e) {
    var r = e.target.closest("[data-ride]"); if (!r) return;
    var h = +r.dataset.ride; if (h) S.rides[today()] = h; else delete S.rides[today()];
    save(); renderAccueil(); if (h) toast("Objectif du jour : " + targetKcal(today()) + " kcal");
  });
  $("view-accueil").addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.id === "today-w") { e.preventDefault(); $("view-accueil").querySelector('[data-act="save-today"]').click(); } });

  /* ================= SUIVI ================= */
  var editingDay = null;
  function renderSuivi() {
    var el = $("view-suivi");
    var html = '<div class="seg" role="group" aria-label="Affichage"><button data-seg="pesees" aria-pressed="' + (suiviSeg === "pesees") + '">Pesées</button><button data-seg="photos" aria-pressed="' + (suiviSeg === "photos") + '">Photos</button></div><div id="suivi-body"></div>';
    el.innerHTML = html;
    if (suiviSeg === "pesees") renderPesees(); else renderPhotos();
  }
  function renderPesees() {
    var weeks = weekList(), body = $("suivi-body");
    var allKeys = Object.keys(S.weights).sort(), first = allKeys.length ? S.weights[allKeys[0]] : null;
    var withAvg = weeks.map(function (w) { return { ws: w, a: weekAvg(w) }; });
    var lastA = withAvg.filter(function (x) { return x.a; }).pop();
    var waistKeys = Object.keys(S.waist).filter(function (k) { return typeof S.waist[k] === "number"; }).sort();
    var t = trend();
    var html = '<div class="stats four">' +
      '<div class="stat"><span class="eyebrow">Départ</span><span class="v">' + fmt(first, 1) + '<small>kg</small></span></div>' +
      '<div class="stat"><span class="eyebrow">Moy. sem.</span><span class="v">' + (lastA ? fmt(lastA.a.avg, 1) : "—") + '<small>kg</small></span></div>' +
      '<div class="stat"><span class="eyebrow">Tendance</span><span class="v">' + (t.ready ? sign(t.perMonth, 1) : "—") + '<small>kg/mois</small></span></div>' +
      '<div class="stat"><span class="eyebrow">Taille</span><span class="v">' + (waistKeys.length ? fmt(S.waist[waistKeys[waistKeys.length - 1]], 1) : "—") + '<small>cm</small></span></div></div>' +
      '<div class="verdict">' + verdictHTML() + '</div>' +
      '<section class="card"><div class="card-head"><h2>Poids</h2><span class="tiny muted">points : pesées · ligne : moyenne</span></div><div class="chart">' + chartSVG(weeks) + '</div></section>' +
      '<p class="tiny muted">Touche un jour pour saisir ou corriger. Tour de taille au nombril, une fois par semaine, le même jour.</p>';
    var prevAvg = null, rows = [];
    withAvg.forEach(function (x) {
      var n = progWeek(x.ws), vals = weekValues(x.ws), td = today();
      var days = vals.map(function (v, i) {
        var d = addDays(x.ws, i), fut = d > td, cls = "day" + (v == null ? " empty" : "") + (d === td ? " today" : "") + (fut ? " future" : "");
        if (editingDay === d) return '<div class="' + cls + '"><span class="dl">' + "LMMJVSD"[i] + '</span><input id="day-edit" data-date="' + d + '" type="text" inputmode="decimal" value="' + (v == null ? "" : fmt(v, 2)) + '" aria-label="Poids du ' + short(d) + '"></div>';
        return '<button class="' + cls + '" data-day="' + d + '"' + (fut ? ' disabled' : '') + ' aria-label="' + longDate(d) + (v == null ? ", pas de pesée" : ", " + fmt(v, 2) + " kg") + '"><span class="dl">' + "LMMJVSD"[i] + '</span><span class="dv">' + (v == null ? "—" : fmt(v, 1)) + '</span></button>';
      }).join("");
      var delta = (x.a && prevAvg != null) ? x.a.avg - prevAvg : null;
      rows.push('<div class="week"><div class="week-top"><span class="wn">' + (S.settings.showProgram ? (n >= 1 ? "S" + n : "Avant") : "Sem. " + short(x.ws)) + '</span><span class="tiny muted">' + short(x.ws) + ' → ' + short(addDays(x.ws, 6)) + '</span></div><div class="days">' + days + '</div>' +
        '<div class="week-meta"><div><span class="eyebrow">Moyenne</span><b>' + (x.a ? fmt(x.a.avg, 2) : "—") + '</b></div>' +
        '<div><span class="eyebrow">Δ sem.</span><b class="' + (delta == null ? "flat" : delta >= 0.05 ? "up" : delta <= -0.05 ? "down" : "flat") + '">' + (delta == null ? "—" : sign(delta, 2)) + '</b></div>' +
        '<div><span class="eyebrow">Taille cm</span><input type="text" inputmode="decimal" data-waist="' + x.ws + '" value="' + (typeof S.waist[x.ws] === "number" ? fmt(S.waist[x.ws], 1) : "") + '" placeholder="—" aria-label="Tour de taille semaine ' + n + '"></div>' +
        '<div><span class="eyebrow">kcal/j</span><input type="text" inputmode="numeric" data-kcal="' + x.ws + '" value="' + (S.kcal[x.ws] || "") + '" placeholder="' + targetKcal() + '" aria-label="Calories par jour semaine ' + n + '"></div></div></div>');
      if (x.a) prevAvg = x.a.avg;
    });
    html += rows.reverse().join("");
    body.innerHTML = html;
    var inp = $("day-edit"); if (inp) { inp.focus(); inp.select && inp.select(); }
  }
  function chartSVG(weeks) {
    var pts = [], avgs = [];
    weeks.forEach(function (ws, wi) {
      weekValues(ws).forEach(function (v, i) { if (v != null) pts.push({ x: wi + i / 7, v: v }); });
      var a = weekAvg(ws); if (a) avgs.push({ x: wi + 3 / 7, v: a.avg });
    });
    if (!pts.length) return '<div class="empty">La courbe apparaît dès ta première pesée.</div>';
    var W = 340, H = 180, L = 36, R = 10, T = 12, B = 22;
    var vs = pts.map(function (p) { return p.v; }), lo = Math.floor(Math.min.apply(null, vs) - 0.5), hi = Math.ceil(Math.max.apply(null, vs) + 0.5);
    if (hi - lo < 2) hi = lo + 2;
    var n = Math.max(weeks.length, 4);
    function x(v) { return L + v / n * (W - L - R); }
    function y(v) { return T + (hi - v) / (hi - lo) * (H - T - B); }
    var g = "", step = (hi - lo) > 6 ? 2 : 1;
    for (var v = lo; v <= hi; v += step) g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#2A2A31"/><text x="' + (L - 6) + '" y="' + (y(v) + 3) + '" text-anchor="end">' + v + '</text>';
    var xl = ""; weeks.forEach(function (ws, i) { var pw = progWeek(ws), lab = S.settings.showProgram ? (pw >= 1 ? "S" + pw : "") : short(ws); if (weeks.length <= 8 || i % 2 === 0) xl += '<text x="' + x(i + 0.5) + '" y="' + (H - 6) + '" text-anchor="middle">' + lab + '</text>'; });
    var dots = pts.map(function (p) { return '<circle cx="' + x(p.x).toFixed(1) + '" cy="' + y(p.v).toFixed(1) + '" r="2.5" fill="#8E8E98"/>'; }).join("");
    var line = avgs.length > 1 ? '<path d="' + avgs.map(function (p, i) { return (i ? "L" : "M") + x(p.x).toFixed(1) + " " + y(p.v).toFixed(1); }).join(" ") + '" fill="none" stroke="#E8322D" stroke-width="2.5" stroke-linejoin="round"/>' : "";
    var ad = avgs.map(function (p) { return '<circle cx="' + x(p.x).toFixed(1) + '" cy="' + y(p.v).toFixed(1) + '" r="4" fill="#E8322D"/>'; }).join("");
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Courbe de poids">' + g + xl + dots + line + ad + '</svg>';
  }
  function commitDay(inp) {
    var d = inp.dataset.date, v = parseNum(inp.value);
    editingDay = null;
    if (v == null) delete S.weights[d];
    else if (v < 30 || v > 250) { toast("Poids invalide"); renderPesees(); return; }
    else S.weights[d] = v;
    save(); renderPesees();
  }
  var viewSuivi = $("view-suivi");
  viewSuivi.addEventListener("click", function (e) {
    var sg = e.target.closest("[data-seg]"); if (sg) { suiviSeg = sg.dataset.seg; renderSuivi(); return; }
    var dy = e.target.closest("[data-day]"); if (dy) { editingDay = dy.dataset.day; renderPesees(); return; }
    var a = e.target.closest("[data-act]"); if (!a) return;
    if (a.dataset.act === "add-photo") $("photo-input").click();
    else if (a.dataset.act === "view-photo") openPhoto(+a.dataset.id);
  });
  viewSuivi.addEventListener("focusout", function (e) {
    if (e.target.id === "day-edit") commitDay(e.target);
  });
  viewSuivi.addEventListener("change", function (e) {
    var t = e.target;
    if (t.dataset.waist) { var v = parseNum(t.value); if (v == null) delete S.waist[t.dataset.waist]; else if (v > 40 && v < 200) S.waist[t.dataset.waist] = v; else { toast("Tour de taille en cm, par exemple 86"); t.value = ""; return; } save(); renderPesees(); }
    if (t.dataset.kcal) { var k = parseNum(t.value); if (k == null) delete S.kcal[t.dataset.kcal]; else S.kcal[t.dataset.kcal] = Math.round(k); save(); }
  });
  viewSuivi.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); e.target.blur(); } });

  /* --- photos --- */
  var urls = [];
  function revoke() { urls.forEach(function (u) { URL.revokeObjectURL(u); }); urls = []; }
  function objURL(b) { var u = URL.createObjectURL(b); urls.push(u); return u; }
  function renderPhotos() {
    var body = $("suivi-body");
    body.innerHTML = '<button class="btn primary block" data-act="add-photo">Ajouter une photo</button><p class="tiny muted">Même endroit, même lumière, le matin à jeun, toutes les 4 semaines. Les photos restent sur ton téléphone.</p><div id="ph-wrap"><div class="empty">Chargement…</div></div>';
    photosAll().then(function (ps) {
      revoke();
      var wrap = $("ph-wrap"); if (!wrap) return;
      if (!ps.length) { wrap.innerHTML = '<div class="empty">Aucune photo. Ta photo de départ servira de référence.</div>'; return; }
      var h = "";
      if (ps.length >= 2) {
        var a = ps[ps.length - 1], b = ps[0], wa = weekAvg(mondayOf(a.date)), wb = weekAvg(mondayOf(b.date));
        h += '<section class="card"><div class="card-head"><h2>Avant / maintenant</h2><span class="tiny muted">' + daysBetween(a.date, b.date) + ' jours</span></div><div class="compare">' +
          '<figure><img src="' + objURL(a.blob) + '" alt="Photo du ' + short(a.date) + '"><figcaption>' + short(a.date) + (wa ? ' · ' + fmt(wa.avg, 1) + ' kg' : '') + '</figcaption></figure>' +
          '<figure><img src="' + objURL(b.blob) + '" alt="Photo du ' + short(b.date) + '"><figcaption>' + short(b.date) + (wb ? ' · ' + fmt(wb.avg, 1) + ' kg' : '') + '</figcaption></figure></div></section>';
      }
      h += '<div class="photos">' + ps.map(function (p) {
        var w = progWeek(p.date);
        return '<button class="ph" data-act="view-photo" data-id="' + p.id + '" aria-label="Photo du ' + short(p.date) + '"><img src="' + objURL(p.blob) + '" alt=""><span>' + short(p.date) + (S.settings.showProgram && w >= 1 && w <= 24 ? ' · S' + w : '') + '</span></button>';
      }).join("") + '</div>';
      wrap.innerHTML = h;
    }).catch(function () { var w = $("ph-wrap"); if (w) w.innerHTML = '<div class="empty">Impossible de lire les photos sur cet appareil.</div>'; });
  }
  $("photo-input").addEventListener("change", function (e) {
    var f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
    toast("Enregistrement…");
    compress(f).then(function (blob) { return photoPut({ id: Date.now(), date: today(), blob: blob }); })
      .then(function () { toast("Photo enregistrée"); if (current === "suivi") renderSuivi(); })
      .catch(function () { toast("Cette image n'a pas pu être lue. Essaie une autre photo."); });
  });
  function openPhoto(id) {
    photosAll().then(function (ps) {
      var p = ps.filter(function (x) { return x.id === id; })[0]; if (!p) return;
      var u = URL.createObjectURL(p.blob), wa = weekAvg(mondayOf(p.date));
      sheet('<div class="viewer"><img src="' + u + '" alt="Photo du ' + short(p.date) + '"></div>' +
        '<div class="field"><label for="ph-date">Date de la photo</label><input id="ph-date" type="date" value="' + p.date + '"></div>' +
        '<p class="small muted">' + (wa ? 'Moyenne de la semaine : ' + fmt(wa.avg, 2) + ' kg' : 'Pas de pesée cette semaine-là') + '</p>' +
        '<div class="two"><button class="btn" data-sheet="close">Fermer</button><button class="btn danger" id="ph-del">Supprimer</button></div>', function (root) {
        root.querySelector("#ph-date").addEventListener("change", function (e) { if (!e.target.value) return; p.date = e.target.value; photoPut(p).then(function () { toast("Date modifiée"); renderSuivi(); }); });
        var del = root.querySelector("#ph-del");
        del.addEventListener("click", function () {
          if (!del.dataset.armed) { del.dataset.armed = "1"; del.textContent = "Confirmer la suppression"; return; }
          photoDel(p.id).then(function () { closeSheet(); toast("Photo supprimée"); renderSuivi(); });
        });
      }, function () { URL.revokeObjectURL(u); });
    });
  }

  /* ================= REPAS ================= */
  function weekSegHTML() {
    var ws0 = mondayOf(today());
    return '<div class="seg" role="group" aria-label="Semaine"><button data-week="0" aria-pressed="' + (weekOff === 0) + '">Cette semaine</button><button data-week="1" aria-pressed="' + (weekOff === 1) + '">Semaine du ' + short(addDays(ws0, 7)) + '</button></div>';
  }
  function recipeBody(r, k) {
    return '<ul class="ing">' + r.ing.map(function (x) { return '<li><span class="q">' + esc(ingLabel(x, k || 1)) + '</span><span>' + esc(ingName(x[0])) + '</span></li>'; }).join("") + '</ul>' +
      '<ol class="steps">' + r.steps.map(function (st) { return '<li>' + esc(st) + '</li>'; }).join("") + '</ol>' +
      (r.batch ? '<p class="batch"><b>Batch :</b> ' + esc(r.batch) + '</p>' : '');
  }
  function renderRepas() {
    var el = $("view-repas"), t = today(), eaten = 0, total = 0;
    var rows = D.MOMENTS.map(function (mo) {
      var id = pickFor(mo.k, t), d = isDone(mo.k, t), mc = recipeMacros(id, factor(t));
      if (mc) { total += mc[0]; if (d) eaten += mc[0]; }
      return '<div class="tl' + (d ? ' done' : '') + '"><button class="check" role="checkbox" aria-checked="' + d + '" data-eat="' + mo.k + '" aria-label="' + esc(mo.label) + ' mangé">' + CHECK_SVG + '</button>' +
        '<button class="txt pick" data-choose="' + mo.k + '" aria-label="Changer le ' + esc(mo.short) + '"><span class="eyebrow">' + esc(mo.short) + '</span><span class="nm">' + esc(recipeName(id)) + '</span></button>' +
        '<span class="k">' + (mc ? Math.round(mc[0]) + ' kcal' : '—') + '</span></div>';
    }).join("");
    var html = '<section class="card"><div class="card-head"><h2>Aujourd\'hui</h2><span class="tiny muted">' + esc(longDate(t)) + '</span></div>' +
      '<div class="bar" aria-hidden="true"><i style="width:' + (total ? eaten / total * 100 : 0) + '%"></i></div><p class="tiny muted num">' + Math.round(eaten) + ' / ' + Math.round(total) + ' kcal' + (rideHours(t) ? ' (sortie de ' + rideHours(t) + ' h incluse)' : '') + ' · touche un repas pour en choisir un autre · remise à zéro chaque jour</p>' +
      '<div class="today-list">' + rows + '</div></section>';

    var ws = planWeek(), p = planFor(ws), counts = MK.map(function (k) { return planCount(p, k); });
    var mi = MK.indexOf(repasSeg), cnt = counts[mi];
    html += '<div class="section-head"><h2>Ma semaine</h2><span class="tiny muted">' + short(ws) + ' → ' + short(addDays(ws, 6)) + '</span></div>' + weekSegHTML() +
      '<div class="moments" role="group" aria-label="Moment de la journée">' + D.MOMENTS.map(function (mo, i) {
        return '<button class="mo" data-seg="' + mo.k + '" aria-pressed="' + (mo.k === repasSeg) + '"><span class="mn">' + esc(mo.short) + '</span><span class="mc ' + (counts[i] === 7 ? 'ok' : 'ko') + '">' + counts[i] + '/7</span></button>';
      }).join("") + '</div>' +
      '<p class="small muted">Choisis combien de fois tu manges chaque recette' + (weekOff ? ' la semaine prochaine' : ' cette semaine') + ' : la liste de courses se calcule dessus. ' +
      (cnt === 7 ? '<span class="chip good">7/7 prévus</span>' : '<span class="chip warn">' + cnt + '/7 prévus</span>') +
      (planIsCopy(ws) ? ' <span class="tiny">Planning repris de la semaine précédente.</span>' : '') + '</p>';
    html += recipesFor(repasSeg).map(function (r) {
      var n = (p[repasSeg] && p[repasSeg][r.id]) || 0, kf = factor(), mc = macros(r.ing, kf);
      return '<article class="meal' + (n ? ' planned' : '') + '"><div class="meal-top"><div class="grow"><h3>' + esc(r.name) + '</h3><p class="small muted num">' + Math.round(mc[0]) + ' kcal · ' + Math.round(mc[1]) + ' g P · ' + Math.round(mc[2]) + ' g G · ' + Math.round(mc[3]) + ' g L</p></div>' +
        '<div class="stepper" role="group" aria-label="Portions de ' + esc(r.name) + '"><button data-step="-1" data-id="' + r.id + '" aria-label="Une portion de moins"' + (n ? '' : ' disabled') + '>−</button><span class="num">' + n + '</span><button data-step="1" data-id="' + r.id + '" aria-label="Une portion de plus">+</button></div></div>' +
        '<details class="fold"><summary>Ingrédients & recette</summary>' + recipeBody(r, kf) + '</details></article>';
    }).join("");
    html += '<section class="card"><h2>Organisation</h2><ul class="keys"><li>Deux sessions de cuisine : dimanche pour lundi-mercredi, mercredi soir pour jeudi-samedi.</li><li>Les gamelles se gardent 3-4 jours au frigo, sinon congèle-les le jour même.</li><li>Riz, pâtes et semoule pesés crus.</li><li>Les 20 gamelles sont communes au midi et au soir.</li><li>Les quantités sont calculées pour ton objectif (' + targetKcal() + ' kcal/j) : tu peux combiner les recettes librement, tu restes dans ta cible.</li>' + (Math.abs(factor() - 1) > 0.04 ? '<li>Les recettes de base sont prévues pour 2700 kcal : les grammes affichés sont déjà ajustés pour toi (×' + fmt(factor(), 2) + ').</li>' : '') + '</ul></section>';
    el.innerHTML = html;
  }
  $("view-repas").addEventListener("click", function (e) {
    var t = today();
    var wk = e.target.closest("[data-week]"); if (wk) { weekOff = +wk.dataset.week; renderRepas(); return; }
    var sg = e.target.closest("[data-seg]"); if (sg) { repasSeg = sg.dataset.seg; renderRepas(); return; }
    var st = e.target.closest("[data-step]");
    if (st) {
      var ws = planWeek(), p = planEnsure(ws), o = p[repasSeg], id = st.dataset.id, n = (o[id] || 0) + (+st.dataset.step);
      n = Math.max(0, Math.min(14, n)); if (n) o[id] = n; else delete o[id];
      save(); renderRepas(); return;
    }
    var ea = e.target.closest("[data-eat]"); if (ea) { var m = ea.dataset.eat; setDone(m, t, !isDone(m, t)); save(); renderRepas(); return; }
    var ch = e.target.closest("[data-choose]"); if (ch) { chooseSheet(ch.dataset.choose, t, renderRepas); }
  });

  function chooseSheet(m, d, after) {
    var mo = D.MOMENTS[MK.indexOf(m)], ws = mondayOf(d), p = planFor(ws)[m] || {}, cur = pickFor(m, d);
    var all = recipesFor(m), planned = all.filter(function (r) { return p[r.id]; }), others = all.filter(function (r) { return !p[r.id]; });
    function row(r, extra) {
      var mc = macros(r.ing, factor(d));
      return '<button class="opt' + (r.id === cur ? ' sel' : '') + '" data-pick="' + r.id + '"><span class="grow"><span class="nm">' + esc(r.name) + '</span>' + (extra ? '<span class="tiny muted">' + extra + '</span>' : '') + '</span><span class="k num">' + Math.round(mc[0]) + ' kcal</span></button>';
    }
    sheet('<h2>' + esc(mo.label) + '</h2><p class="small muted">Qu\'est-ce qui te fait envie ?</p>' +
      (planned.length ? '<span class="eyebrow">Prévu cette semaine</span><div class="opts">' + planned.map(function (r) { var left = p[r.id] - eatenInWeek(ws, r.id, d); return row(r, left > 0 ? 'Encore ' + left + ' prévu' + (left > 1 ? 's' : '') : 'Quota de la semaine atteint'); }).join("") + '</div>' : '') +
      '<span class="eyebrow">Autres recettes</span><div class="opts">' + others.map(function (r) { return row(r, 'Hors planning'); }).join("") +
      '<button class="opt' + (cur === "libre" ? ' sel' : '') + '" data-pick="libre"><span class="grow"><span class="nm">Repas libre (hors plan)</span><span class="tiny muted">Resto, repas de famille…</span></span></button></div>' +
      '<button class="btn block" data-sheet="close">Annuler</button>', function (root) {
      root.querySelectorAll("[data-pick]").forEach(function (b) {
        b.addEventListener("click", function () { setPick(m, d, b.dataset.pick); save(); closeSheet(); after(); toast("Repas choisi"); });
      });
    });
  }

  /* ================= COURSES ================= */
  function renderCourses() {
    var el = $("view-courses"), ws = planWeek(), items = shopItems(ws), ck = shopChecked(ws), tot = shopTotals(items), mode = shopMode(), stores = S.settings.stores, es = showsES();
    var done = items.filter(function (it) { return ck[it.k]; }).length;
    var p = planFor(ws), missing = D.MOMENTS.filter(function (mo) { return planCount(p, mo.k) !== 7; });
    var cheapest = stores.reduce(function (a, b) { return tot[b] < tot[a] ? b : a; }, stores[0]);
    var bestKey = (stores.length > 1 && tot.mix < tot[cheapest] - 0.5) ? "mix" : cheapest;
    var html = weekSegHTML();
    if (missing.length) html += '<div class="verdict"><span class="chip warn">Planning</span><p>' + missing.map(function (mo) { return esc(mo.short) + ' ' + planCount(p, mo.k) + '/7'; }).join(" · ") + ' : la liste ne couvre pas toute la semaine. <button class="link" data-go="repas" data-seg="' + missing[0].k + '">Compléter</button></p></div>';
    var cells = stores.map(function (sid) { return '<div class="' + (bestKey === sid ? "best" : "") + '"><span class="eyebrow">' + esc(storeName(sid)) + '</span><span class="v">' + fmt(tot[sid], 0) + ' €</span></div>'; });
    if (stores.length > 1) cells.push('<div class="' + (bestKey === "mix" ? "best" : "") + '"><span class="eyebrow">Mix</span><span class="v">' + fmt(tot.mix, 0) + ' €</span></div>');
    var srcNote = stores.map(function (sid) { return storeName(sid) + (sid === "alcampo" ? " : prix relevés en ligne le " + D.PRICES_DATE + " (sauf ~)" : " : prix estimés"); }).join(". ");
    html += '<section class="card"><div class="card-head"><h2>Coût de la semaine</h2><span class="tiny muted">' + short(ws) + ' → ' + short(addDays(ws, 6)) + '</span></div>' +
      '<div class="cost" style="grid-template-columns:repeat(' + cells.length + ',minmax(0,1fr))">' + cells.join("") + '</div>' +
      '<p class="tiny muted">Coût des quantités de ton planning, ajustées à ton objectif (hors épices et whey). ' + esc(srcNote) + '. Touche un prix pour le corriger.' + (bestKey === "mix" ? ' Le mix fait économiser ' + fmt(tot[cheapest] - tot.mix, 0) + ' € mais demande deux magasins.' : '') + ' Magasins modifiables dans les réglages.</p></section>';
    if (stores.length > 1) html += '<div class="seg" role="group" aria-label="Magasin"><button data-mode="mix" aria-pressed="' + (mode === "mix") + '">Meilleur prix</button>' + stores.map(function (sid) { return '<button data-mode="' + sid + '" aria-pressed="' + (mode === sid) + '">Tout ' + esc(storeName(sid)) + '</button>'; }).join("") + '</div>';
    html += '<section class="card"><div class="row"><div class="bar grow" aria-hidden="true"><i style="width:' + (items.length ? done / items.length * 100 : 0) + '%"></i></div><span class="small muted num">' + done + ' / ' + items.length + '</span><button class="link" data-act="reset">Tout décocher</button></div>';
    if (!items.length) html += '<div class="empty">Aucune recette prévue pour cette semaine. Planifie tes repas dans l\'onglet Repas.</div>';
    var groups;
    if (mode === "mix") groups = stores.map(function (sid) { return { t: "À acheter chez " + storeName(sid), items: items.filter(function (it) { return it.best === sid; }) }; });
    else groups = RAYONS.map(function (r) { return { t: r, items: items.filter(function (it) { return it.f.rayon === r; }) }; });
    groups.forEach(function (g) {
      if (!g.items.length) return;
      if (mode === "mix") g.items.sort(function (x, y) { return RAYONS.indexOf(x.f.rayon) - RAYONS.indexOf(y.f.rayon); });
      html += '<div class="group"><h3>' + esc(g.t) + '</h3>' + g.items.map(function (it) {
        var st = mode === "mix" ? it.best : mode, c = it.c[st], pr = price(it.k, st), edited = S.prices[it.k] && stores.some(function (sid) { return typeof S.prices[it.k][sid] === "number"; });
        var other = stores.filter(function (x) { return x !== st; })[0], diff = (other && it.c[other] != null && c != null) ? it.c[other] - c : null;
        return '<div class="item' + (ck[it.k] ? ' done' : '') + '"><button class="check" role="checkbox" aria-checked="' + !!ck[it.k] + '" data-ck="' + it.k + '" aria-label="' + esc(it.f.fr) + ' acheté">' + CHECK_SVG + '</button>' +
          '<div class="txt" data-ck="' + it.k + '"><span class="nm">' + esc(it.f.fr) + '</span>' + (es ? '<span class="es">' + esc(it.f.es) + '</span>' : '') + (mode === "mix" && diff != null && diff > 0.2 ? '<span class="tiny muted">' + fmt(diff, 2) + ' € de moins que chez ' + esc(storeName(other)) + '</span>' : '') + '</div>' +
          '<div class="right"><span class="qty">' + esc(it.q) + '</span><button class="pricebtn" data-price="' + it.k + '" aria-label="Modifier le prix de ' + esc(it.f.fr) + '">' + (edited ? '<span class="edited"></span>' : '') + (c == null ? '—' : fmt(c, 2) + ' €') + '<span class="muted">' + (pr.src === "estimé" ? '~' : '') + '</span></button></div></div>';
      }).join("") + '</div>';
    });
    html += '<div class="group"><h3>Épices · à vérifier</h3>' + D.SPICES.map(function (sp) { return '<div class="item"><div class="txt"><span class="nm">' + esc(sp[0]) + '</span>' + (es ? '<span class="es">' + esc(sp[1]) + '</span>' : '') + '</div></div>'; }).join("") + '</div></section>';
    el.innerHTML = html;
  }
  var resetTimer = null;
  $("view-courses").addEventListener("click", function (e) {
    var go = e.target.closest("[data-go]"); if (go) { if (go.dataset.seg) repasSeg = go.dataset.seg; show(go.dataset.go); return; }
    var wk = e.target.closest("[data-week]"); if (wk) { weekOff = +wk.dataset.week; renderCourses(); return; }
    var md = e.target.closest("[data-mode]"); if (md) { S.settings.shopMode = md.dataset.mode; save(); renderCourses(); return; }
    var pb = e.target.closest("[data-price]"); if (pb) { priceSheet(pb.dataset.price); return; }
    var c = e.target.closest("[data-ck]"); if (c) { var ck = shopChecked(planWeek()), k = c.dataset.ck; if (ck[k]) delete ck[k]; else ck[k] = true; save(); renderCourses(); return; }
    var a = e.target.closest("[data-act]");
    if (a && a.dataset.act === "reset") {
      if (!a.dataset.armed) { a.dataset.armed = "1"; a.textContent = "Confirmer ?"; clearTimeout(resetTimer); resetTimer = setTimeout(function () { if (a.isConnected) { delete a.dataset.armed; a.textContent = "Tout décocher"; } }, 3000); return; }
      S.shop["w-" + planWeek()] = {}; save(); renderCourses(); toast("Liste remise à zéro");
    }
  });
  function priceSheet(k) {
    var f = D.FOOD[k], base = D.PRICES[k], unit = base.unit === "pièce" ? "€ / œuf" : "€ / " + base.unit, stores = S.settings.stores;
    sheet('<h2>' + esc(f.fr) + '</h2>' + (showsES() ? '<p class="small muted">' + esc(f.es) + '</p>' : '') +
      '<div class="two">' + stores.map(function (sid) {
        var pr = price(k, sid), b = basePrice(k, sid);
        return '<div class="field"><label for="pr-' + sid + '">' + esc(storeName(sid)) + ' (' + unit + ')</label><input id="pr-' + sid + '" data-sid="' + sid + '" type="text" inputmode="decimal" value="' + fmt(pr.v, 2) + '"><span class="tiny muted">' + esc(pr.src) + (pr.src === "corrigé" ? ' · origine ' + fmt(b.v, 2) : '') + '</span></div>';
      }).join("") + '</div>' +
      '<p class="tiny muted">Entre le prix au ' + (base.unit === "pièce" ? "œuf" : base.unit) + ' affiché sur l\'étiquette (« prix au kg »).</p>' +
      '<button class="btn primary block" id="p-save">Enregistrer</button><div class="two"><button class="btn" id="p-reset">Prix d\'origine</button><button class="btn" data-sheet="close">Annuler</button></div>', function (root) {
      root.querySelector("#p-save").addEventListener("click", function () {
        var o = {};
        Object.keys(S.prices[k] || {}).forEach(function (x) { if (stores.indexOf(x) < 0) o[x] = S.prices[k][x]; });
        root.querySelectorAll("[data-sid]").forEach(function (inp) { var v = parseNum(inp.value), b = basePrice(k, inp.dataset.sid).v; if (v != null && (b == null || Math.abs(v - b) > 0.001)) o[inp.dataset.sid] = v; });
        var has = Object.keys(o).some(function (x) { return x !== "at"; });
        if (has) { o.at = today(); S.prices[k] = o; } else delete S.prices[k];
        save(); closeSheet(); renderCourses(); toast("Prix enregistré");
      });
      root.querySelector("#p-reset").addEventListener("click", function () { delete S.prices[k]; save(); closeSheet(); renderCourses(); toast("Prix d'origine rétabli"); });
    });
  }

  /* ================= feuille (sheet) ================= */
  var onClose = null;
  var sheetLocked = false;
  function sheet(html, setup, cleanup, locked) {
    sheetLocked = false; closeSheet();
    var root = $("sheet-root");
    root.innerHTML = '<div class="scrim" id="scrim"><div class="sheet' + (locked ? ' full' : '') + '" role="dialog" aria-modal="true">' + (locked ? '' : '<div class="grab"></div>') + html + '</div></div>';
    onClose = cleanup || null; sheetLocked = !!locked;
    root.querySelector("#scrim").addEventListener("click", function (e) { if ((e.target.id === "scrim" && !sheetLocked) || e.target.closest('[data-sheet="close"]')) closeSheet(); });
    if (setup) setup(root);
    document.body.style.overflow = "hidden";
  }
  function closeSheet() {
    var root = $("sheet-root"); if (!root.innerHTML) return;
    root.innerHTML = ""; document.body.style.overflow = "";
    if (onClose) { var f = onClose; onClose = null; f(); }
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !sheetLocked) closeSheet(); });

  /* ================= réglages & sauvegarde ================= */
  var exportFile = null;
  function buildExport() {
    return photosAll().then(function (ps) {
      return Promise.all(ps.map(function (p) { return blobToDataURL(p.blob).then(function (u) { return { id: p.id, date: p.date, data: u }; }); }));
    }).then(function (photos) {
      var payload = { app: "forge", version: 2, exportedAt: new Date().toISOString(), state: S, photos: photos };
      var name = "forge-sauvegarde-" + today() + ".json";
      return new File([JSON.stringify(payload)], name, { type: "application/json" });
    });
  }
  function openSettings() {
    var st = S.settings, mh = st.mealHours, n = needs(), pf = S.profile;
    sheet('<h2>Réglages</h2>' +
      '<section class="card"><h3>Mon profil</h3>' + (n ? '<p class="small">' + esc(GOALS[goal()].label) + ' · ' + (pf.name ? esc(pf.name) + ' · ' : '') + pf.age + ' ans · ' + pf.height + ' cm · ' + fmt(n.w, 1) + ' kg</p><p class="small muted">Objectif ' + n.target + ' kcal/j · ' + n.prot + ' g de protéines' + (n.custom ? ' (objectif personnalisé, calcul : ' + n.calc + ' kcal)' : '') + '</p>' : '<p class="small muted">Profil incomplet.</p>') +
      '<button class="btn block" id="s-profile">Modifier mon profil</button></section>' +
      '<section class="card"><h3>Sauvegarde</h3><p class="small muted">Tes données vivent uniquement sur ce téléphone. Exporte une sauvegarde de temps en temps et range-la dans Fichiers ou iCloud Drive. ' + (st.lastExport ? 'Dernier export : ' + short(st.lastExport) + '.' : 'Aucun export pour l\'instant.') + '</p>' +
      '<button class="btn primary block" id="exp" disabled>Préparation…</button><button class="btn block" id="imp">Importer une sauvegarde</button></section>' +
      '<section class="card"><h3>Rappel de pesée</h3><p class="small muted">Une web app ne peut pas programmer seule une notification. On passe par l\'app Rappels, fiable à 100 % :</p><ol class="steps-guide"><li>Ouvre <b>Rappels</b> et crée « Pesée à jeun ».</li><li>Touche <b>ⓘ</b> → active <b>Date</b> et <b>Heure</b> → 7:30.</li><li><b>Répéter</b> → Tous les jours.</li><li>Le matin, touche la notif puis l\'icône Forge : la pesée se saisit dès l\'accueil.</li></ol></section>' +
      '<section class="card"><h3>Programme de musculation</h3><label class="switch"><input type="checkbox" id="s-prog"' + (st.showProgram ? ' checked' : '') + '><span>Afficher le programme Upper/Lower 24 semaines</span></label>' +
      '<div class="field" id="s-start-wrap"' + (st.showProgram ? '' : ' hidden') + '><label for="s-start">Date de début (semaine 1)</label><input id="s-start" type="date" value="' + st.startDate + '"></div></section>' +
      '<section class="card"><h3>Repas</h3><div class="field"><label>Heures limites des repas (petit-déj / midi / collation)</label><div class="row"><input id="s-h0" type="text" inputmode="numeric" value="' + mh[0] + '" aria-label="Petit-déjeuner avant"><input id="s-h1" type="text" inputmode="numeric" value="' + mh[1] + '" aria-label="Midi avant"><input id="s-h2" type="text" inputmode="numeric" value="' + mh[2] + '" aria-label="Collation avant"></div><span class="tiny muted">Ex. 10 = le petit-déj est proposé jusqu\'à 10 h.</span></div></section>' +
      '<button class="btn primary block" id="s-save">Enregistrer les réglages</button>' +
      '<section class="card"><h3>Données</h3><button class="btn danger block" id="wipe">Effacer toutes les données</button></section>' +
      '<p class="tiny muted" style="text-align:center">Forge ' + APP_VERSION + ' · prix Alcampo du ' + D.PRICES_DATE + '</p>' +
      '<button class="btn block" data-sheet="close">Fermer</button>', function (root) {
      var exp = root.querySelector("#exp");
      exportFile = null;
      buildExport().then(function (f) { exportFile = f; exp.disabled = false; exp.textContent = "Exporter une sauvegarde (" + Math.max(1, Math.round(f.size / 1024)) + " Ko)"; })
        .catch(function () { exp.textContent = "Export impossible"; });
      exp.addEventListener("click", function () {
        if (!exportFile) return;
        var done = function () { S.settings.lastExport = today(); save(); toast("Sauvegarde exportée"); };
        if (navigator.canShare && navigator.canShare({ files: [exportFile] })) {
          navigator.share({ files: [exportFile], title: "Sauvegarde Forge" }).then(done).catch(function (err) { if (err && err.name !== "AbortError") download(exportFile, done); });
        } else download(exportFile, done);
      });
      root.querySelector("#imp").addEventListener("click", function () { $("import-input").click(); });
      root.querySelector("#s-profile").addEventListener("click", function () { openProfile(false); });
      root.querySelector("#s-prog").addEventListener("change", function (e) { root.querySelector("#s-start-wrap").hidden = !e.target.checked; });
      root.querySelector("#s-save").addEventListener("click", function () {
        var sd = root.querySelector("#s-start").value;
        var h = [0, 1, 2].map(function (i) { return parseNum(root.querySelector("#s-h" + i).value); });
        S.settings.showProgram = root.querySelector("#s-prog").checked;
        if (sd) S.settings.startDate = sd;
        if (h.every(function (x) { return x != null && x >= 0 && x <= 24; }) && h[0] < h[1] && h[1] < h[2]) S.settings.mealHours = h;
        save(); closeSheet(); render(); toast("Réglages enregistrés");
      });
      var wipe = root.querySelector("#wipe");
      wipe.addEventListener("click", function () {
        if (!wipe.dataset.armed) { wipe.dataset.armed = "1"; wipe.textContent = "Confirmer : tout effacer (profil, pesées, photos, listes)"; return; }
        S = defaults(); save(); photosClear().then(function () { closeSheet(); render(); openProfile(true); });
      });
    });
  }

  /* ================= profil (premier lancement & modification) ================= */
  function openProfile(first) {
    var pf = S.profile || {}, st = S.settings, draft = {
      name: pf.name || "", sex: pf.sex || "h", age: pf.age || "", height: pf.height || "", weight: pf.weight || (curWeight() ? Math.round(curWeight() * 10) / 10 : ""),
      activity: pf.activity || "assis", sessions: pf.sessions == null ? 3 : pf.sessions, goal: pf.goal || "", kcalOverride: pf.kcalOverride || "",
      stores: st.stores.slice()
    };
    function optBtn(attr, val, cur, label, hint) { return '<button type="button" class="opt' + (cur === val ? ' sel' : '') + '" data-' + attr + '="' + val + '"><span class="grow"><span class="nm">' + esc(label) + '</span>' + (hint ? '<span class="tiny muted">' + esc(hint) + '</span>' : '') + '</span></button>'; }
    function formHTML() {
      return (first ? '<div class="brand"><span class="logo" aria-hidden="true"></span><div><h2>Bienvenue sur Forge</h2><p class="small muted">2 minutes pour calculer tes besoins. Tout reste sur ton téléphone.</p></div></div>' : '<h2>Mon profil</h2>') +
        '<div class="field"><label for="pf-name">Prénom</label><input id="pf-name" type="text" autocomplete="given-name" value="' + esc(draft.name) + '" placeholder="Facultatif"></div>' +
        '<div class="field"><label>Sexe</label><div class="seg" role="group"><button type="button" data-sex="h" aria-pressed="' + (draft.sex === "h") + '">Homme</button><button type="button" data-sex="f" aria-pressed="' + (draft.sex === "f") + '">Femme</button></div></div>' +
        '<div class="three"><div class="field"><label for="pf-age">Âge</label><input id="pf-age" type="text" inputmode="numeric" value="' + esc(draft.age) + '" placeholder="ans"></div>' +
        '<div class="field"><label for="pf-h">Taille</label><input id="pf-h" type="text" inputmode="numeric" value="' + esc(draft.height) + '" placeholder="cm"></div>' +
        '<div class="field"><label for="pf-w">Poids</label><input id="pf-w" type="text" inputmode="decimal" value="' + esc(String(draft.weight).replace(".", ",")) + '" placeholder="kg"></div></div>' +
        '<div class="field"><label>Activité au quotidien (hors sport)</label><div class="opts">' + Object.keys(ACTIVITY).map(function (k) { return optBtn("act", k, draft.activity, ACTIVITY[k].label, ACTIVITY[k].hint); }).join("") + '</div></div>' +
        '<div class="field"><label>Séances de sport par semaine</label><div class="row"><div class="stepper"><button type="button" data-sess="-1" aria-label="Une séance de moins">−</button><span class="num" id="pf-sess">' + draft.sessions + '</span><button type="button" data-sess="1" aria-label="Une séance de plus">+</button></div><span class="tiny muted grow" id="pf-sess-hint">' + (draft.goal === "endurance" ? 'Sans compter tes longues sorties : tu les ajoutes le jour même depuis l\'accueil.' : 'Muscu, sport collectif, course…') + '</span></div></div>' +
        '<div class="field"><label>Objectif</label><div class="opts">' + Object.keys(GOALS).map(function (k) { return optBtn("goal", k, draft.goal, GOALS[k].label, GOALS[k].desc); }).join("") + '</div></div>' +
        '<div class="field"><label>Où fais-tu tes courses ? (1 ou 2 magasins)</label><div class="chips">' + D.STORES.map(function (s) { return '<button type="button" class="chipbtn" data-store="' + s.id + '" aria-pressed="' + (draft.stores.indexOf(s.id) >= 0) + '">' + esc(s.name) + '</button>'; }).join("") + '</div><span class="tiny muted">Prix relevés pour Alcampo, estimés pour les autres : tu les corriges en magasin.</span></div>' +
        '<details class="fold"' + (draft.kcalOverride ? ' open' : '') + '><summary>Avancé : objectif calorique personnalisé</summary><div class="field" style="margin-top:10px"><label for="pf-kcal">Objectif kcal / jour (laisse vide pour le calcul automatique)</label><input id="pf-kcal" type="text" inputmode="numeric" value="' + esc(draft.kcalOverride) + '" placeholder="Calcul automatique"></div></details>' +
        '<p class="small" id="pf-err" style="color:var(--red-hi)" hidden></p>' +
        '<button class="btn primary block" id="pf-next">Calculer mes besoins</button>' + (first ? '' : '<button class="btn block" data-sheet="close">Annuler</button>');
    }
    function readInputs(root) {
      draft.name = root.querySelector("#pf-name").value.trim();
      draft.age = parseNum(root.querySelector("#pf-age").value);
      draft.height = parseNum(root.querySelector("#pf-h").value);
      draft.weight = parseNum(root.querySelector("#pf-w").value);
      draft.kcalOverride = parseNum(root.querySelector("#pf-kcal").value);
    }
    function err(root, msg) { var e = root.querySelector("#pf-err"); e.textContent = msg; e.hidden = false; e.scrollIntoView({ block: "center" }); }
    function bind(root) {
      root.querySelector(".sheet").addEventListener("click", function (e) {
        var b;
        if ((b = e.target.closest("[data-sex]"))) { draft.sex = b.dataset.sex; root.querySelectorAll("[data-sex]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); }
        else if ((b = e.target.closest("[data-act]"))) { draft.activity = b.dataset.act; root.querySelectorAll("[data-act]").forEach(function (x) { x.classList.toggle("sel", x === b); }); }
        else if ((b = e.target.closest("[data-goal]"))) {
          draft.goal = b.dataset.goal; root.querySelectorAll("[data-goal]").forEach(function (x) { x.classList.toggle("sel", x === b); });
          root.querySelector("#pf-sess-hint").textContent = draft.goal === "endurance" ? "Sans compter tes longues sorties : tu les ajoutes le jour même depuis l'accueil." : "Muscu, sport collectif, course…";
        }
        else if ((b = e.target.closest("[data-sess]"))) { draft.sessions = Math.max(0, Math.min(10, draft.sessions + (+b.dataset.sess))); root.querySelector("#pf-sess").textContent = draft.sessions; }
        else if ((b = e.target.closest("[data-store]"))) {
          var id = b.dataset.store, i = draft.stores.indexOf(id);
          if (i >= 0) { if (draft.stores.length > 1) draft.stores.splice(i, 1); }
          else { if (draft.stores.length >= 2) draft.stores.shift(); draft.stores.push(id); }
          root.querySelectorAll("[data-store]").forEach(function (x) { x.setAttribute("aria-pressed", String(draft.stores.indexOf(x.dataset.store) >= 0)); });
        }
        else if (e.target.closest("#pf-next")) {
          readInputs(root);
          if (!draft.age || draft.age < 14 || draft.age > 90) return err(root, "Indique ton âge (entre 14 et 90 ans).");
          if (!draft.height || draft.height < 130 || draft.height > 230) return err(root, "Indique ta taille en cm, par exemple 178.");
          if (!draft.weight || draft.weight < 35 || draft.weight > 250) return err(root, "Indique ton poids en kg, par exemple 72,5.");
          if (!draft.goal) return err(root, "Choisis ton objectif.");
          if (draft.kcalOverride && (draft.kcalOverride < 1200 || draft.kcalOverride > 6000)) return err(root, "L'objectif personnalisé doit être entre 1200 et 6000 kcal, ou vide.");
          var prevGoal = S.profile && S.profile.goal;
          S.profile = { name: draft.name, sex: draft.sex, age: Math.round(draft.age), height: Math.round(draft.height), weight: draft.weight, activity: draft.activity, sessions: draft.sessions, goal: draft.goal, kcalOverride: draft.kcalOverride ? Math.round(draft.kcalOverride) : null };
          S.settings.stores = draft.stores;
          if (S.settings.shopMode !== "mix" && draft.stores.indexOf(S.settings.shopMode) < 0) S.settings.shopMode = "mix";
          if (!Object.keys(S.weights).length) S.weights[today()] = draft.weight;
          if (prevGoal === "endurance" && draft.goal !== "endurance") S.rides = {};
          save(); result(root);
        }
      });
    }
    function result(root) {
      var n = needs(), g = goal();
      root.querySelector(".sheet").innerHTML = '<h2>Tes besoins</h2>' +
        '<div class="calc"><div class="li"><span>Métabolisme de base<br><span class="tiny muted">Ce que ton corps brûle au repos complet (formule de Mifflin-St Jeor).</span></span><b class="num">' + n.bmr + ' kcal</b></div>' +
        '<div class="li"><span>Maintenance<br><span class="tiny muted">Métabolisme × ' + fmt(n.pal, 2) + ' (activité + ' + S.profile.sessions + ' séance' + (S.profile.sessions > 1 ? 's' : '') + '/sem.)</span></span><b class="num">' + n.tdee + ' kcal</b></div>' +
        '<div class="li hl"><span>Ton objectif · ' + esc(GOALS[g].label) + '<br><span class="tiny muted">' + (n.custom ? 'Objectif personnalisé (calcul : ' + n.calc + ' kcal)' : g === "bulk" ? 'Maintenance + 300 kcal' : g === "cut" ? 'Maintenance − 20 %' : g === "endurance" ? 'Maintenance, + ~' + RIDE_KCAL + ' kcal par heure de sortie' : 'Maintenance') + '</span></span><b class="num">' + n.target + ' kcal</b></div>' +
        '<div class="li"><span>Protéines<br><span class="tiny muted">' + fmt(GOALS[g].prot, 1) + ' g par kg de poids de corps</span></span><b class="num">' + n.prot + ' g</b></div></div>' +
        '<p class="small muted">Les recettes sont ajustées automatiquement à ton objectif (×' + fmt(n.target / BASE_KCAL, 2) + '). Ce sont des estimations : après 3 semaines de pesées, l\'onglet Suivi te dira s\'il faut ajouter ou retirer 150 kcal.</p>' +
        '<button class="btn primary block" id="pf-go">' + (first ? 'C\'est parti' : 'Terminé') + '</button><button class="btn block" id="pf-back">Modifier</button>';
      root.querySelector("#pf-go").addEventListener("click", function () { sheetLocked = false; closeSheet(); repasSeg = MK[slotNow()]; render(); });
      root.querySelector("#pf-back").addEventListener("click", function () { root.querySelector(".sheet").innerHTML = formHTML(); });
    }
    sheet(formHTML(), bind, null, first);
  }

  function download(file, done) {
    var u = URL.createObjectURL(file), a = document.createElement("a");
    a.href = u; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 4000); done();
  }
  $("open-settings").addEventListener("click", openSettings);
  $("import-input").addEventListener("change", function (e) {
    var f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      var p; try { p = JSON.parse(r.result); } catch (err) { toast("Fichier illisible : choisis un fichier .json exporté par l'app."); return; }
      if (!p || (p.app !== "carnet-lean-bulk" && p.app !== "forge") || !p.state) { toast("Ce fichier n'est pas une sauvegarde Forge."); return; }
      var s = p.state, nW = 0;
      if (!("profile" in s)) migrateV1(s);
      if (s.profile && s.profile.age) S.profile = s.profile;
      ["weights", "waist", "kcal", "plan", "day", "shop", "prices", "rides"].forEach(function (k) {
        if (s[k] && typeof s[k] === "object") Object.keys(s[k]).forEach(function (x) { if (k === "weights" && S.weights[x] !== s.weights[x]) nW++; S[k][x] = s[k][x]; });
      });
      if (s.settings) Object.keys(s.settings).forEach(function (x) { if (x !== "lastExport") S.settings[x] = s.settings[x]; });
      save();
      var ph = Array.isArray(p.photos) ? p.photos : [];
      Promise.all(ph.map(function (x) { return photoPut({ id: x.id, date: x.date, blob: dataURLToBlob(x.data) }); })).then(function () {
        closeSheet(); render(); if (!S.profile || !S.profile.age) openProfile(true);
        toast("Import terminé : " + nW + " pesée" + (nW > 1 ? "s" : "") + ", " + ph.length + " photo" + (ph.length > 1 ? "s" : ""));
      });
    };
    r.readAsText(f);
  });

  /* ================= démarrage ================= */
  pruneOld(); save();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
  var lastDay = today();
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && today() !== lastDay) { lastDay = today(); repasSeg = MK[slotNow()]; render(); }
  });
  var startTab = null;
  if (location.hash) startTab = location.hash.slice(1);
  if (!startTab) try { startTab = sessionStorage.getItem("clb.tab"); } catch (e) {}
  show(startTab || "accueil");
  if (!S.profile || !S.profile.age || !S.profile.height) openProfile(true);

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").then(function (reg) {
      function ready(w) { $("update-banner").hidden = false; $("update-btn").onclick = function () { w.postMessage("skipWaiting"); }; }
      if (reg.waiting && navigator.serviceWorker.controller) ready(reg.waiting);
      reg.addEventListener("updatefound", function () {
        var w = reg.installing; if (!w) return;
        w.addEventListener("statechange", function () { if (w.state === "installed" && navigator.serviceWorker.controller) ready(w); });
      });
      document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") reg.update().catch(function () {}); });
    }).catch(function () {});
    var reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", function () { if (!reloaded) { reloaded = true; location.reload(); } });
  }
})();
