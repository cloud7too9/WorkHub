// Info(#): Zentrale Datenhaltung (localStorage) + Seeds + Material-DB + Picker-Keys
(() => {
  "use strict";

  const KEY = "workhub_state_v1";

  const PICK_CTX_KEY = "workhub.pickMaterialCtx.v1";
  const PICK_RES_KEY = "workhub.pickMaterialRes.v1";

  const nowISO = () => new Date().toISOString();
  const uid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function safeParse(raw, fallback) {
    try { return JSON.parse(raw); } catch { return fallback; }
  }

  function readLS() {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return safeParse(raw, null);
  }

  function writeLS(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function readJSON(key, fallback) {
    const raw = localStorage.getItem(key);
    return raw ? safeParse(raw, fallback) : fallback;
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  async function fetchJSON(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error("fetch failed");
    return await res.json();
  }

  function defaultSaws() {
    return [
      { id: "s1", name: "Säge 1", kerfMm: 1.7, currentOp: null },
      { id: "s2", name: "Säge 2", kerfMm: 1.7, currentOp: null },
      { id: "s3", name: "Säge 3", kerfMm: 1.7, currentOp: null }
    ];
  }

  function migrate(state) {
    const s = state && typeof state === "object" ? state : {};
    const orders = Array.isArray(s.orders) ? s.orders : [];
    const saws = Array.isArray(s.saws) && s.saws.length === 3 ? s.saws : defaultSaws();
    const materials = Array.isArray(s.materials) ? s.materials : [];

    return {
      v: 1,

      // materials = Stangen / Längen (optional später in Sägen nutzbar)
      materials: materials.map(m => ({
        id: m.id || uid(),
        name: String(m.name || "Material").trim(),
        lengthMm: Number(m.lengthMm ?? 0) || 0
      })),

      orders: orders.map(o => ({
        id: o.id || uid(),
        title: String(o.title || "(Ohne Titel)").trim(),
        material: String(o.material || "").trim(),
        materialId: String(o.materialId || "").trim(), // Handbuch-Ref
        note: String(o.note || "").trim(),
        done: !!o.done,
        createdAt: o.createdAt || nowISO(),
        updatedAt: o.updatedAt || nowISO(),
        pieces: Array.isArray(o.pieces) ? o.pieces.map(p => ({
          id: p.id || uid(),
          name: String(p.name || "").trim(),
          lengthMm: Number(p.lengthMm ?? 0) || 0,
          durationSec: Number(p.durationSec ?? 0) || 0,
          qtyTotal: Number(p.qtyTotal ?? 0) || 0,
          qtyDone: Number(p.qtyDone ?? 0) || 0,
          note: String(p.note || "").trim(),
          createdAt: p.createdAt || nowISO(),
          updatedAt: p.updatedAt || nowISO()
        })) : []
      })),

      saws: saws.map((sw, i) => ({
        id: sw.id || `s${i + 1}`,
        name: String(sw.name || `Säge ${i + 1}`),
        kerfMm: Number(sw.kerfMm ?? 1.7) || 1.7,
        currentOp: sw.currentOp ? { ...sw.currentOp } : null
      }))
    };
  }

  // ---- Handbuch DB (data/materials.json) ----
  let _materialDBCache = null;

  function normalizeDB(db) {
    return {
      groups: Array.isArray(db?.groups) ? db.groups : [],
      materials: Array.isArray(db?.materials) ? db.materials : []
    };
  }

  async function loadMaterialDB(url = "./data/materials.json") {
    if (_materialDBCache) return _materialDBCache;
    try {
      const db = await fetchJSON(url);
      _materialDBCache = normalizeDB(db);
      return _materialDBCache;
    } catch {
      _materialDBCache = normalizeDB({ groups: [], materials: [] });
      return _materialDBCache;
    }
  }

  function groupById(db, id) {
    return db?.groups?.find(g => g.id === id) || null;
  }

  function materialById(db, id) {
    return db?.materials?.find(m => m.id === id) || null;
  }

  function formatVc(vc) {
    if (vc == null) return "—";
    if (typeof vc === "object") {
      const gt = vc.durchmesser_gt_10 ?? "—";
      const lt = vc.durchmesser_lt_10 ?? "—";
      return `Ø > 10: ${gt} m/s • Ø < 10: ${lt} m/s`;
    }
    return `${vc} m/s`;
  }

  // Public State API
  const State = {
    data: migrate(readLS() || {}),

    save() { this.data = migrate(this.data); writeLS(this.data); },
    load() { const ls = readLS(); if (ls) this.data = migrate(ls); return this.data; },

    // ---- seeds ----
    async resetToSeed() {
      let ordersSeed = [];
      let materialsSeed = [];
      try {
        [ordersSeed, materialsSeed] = await Promise.all([
          fetchJSON("./data/orders.seed.json"),
          fetchJSON("./data/materials.seed.json")
        ]);
      } catch {
        ordersSeed = [];
        materialsSeed = [];
      }

      this.data.orders = Array.isArray(ordersSeed) ? ordersSeed : [];
      this.data.materials = Array.isArray(materialsSeed) ? materialsSeed : [];
      this.data.saws = defaultSaws();
      this.save();
      return this.data;
    },

    // ---- picker ----
    setPickCtx(ctx) { writeJSON(PICK_CTX_KEY, ctx); },
    getPickCtx() { return readJSON(PICK_CTX_KEY, null); },

    setPickRes(res) { writeJSON(PICK_RES_KEY, res); },
    consumePickRes() {
      const res = readJSON(PICK_RES_KEY, null);
      if (res) localStorage.removeItem(PICK_RES_KEY);
      return res;
    },

    // ---- handbuch db ----
    loadMaterialDB,
    groupById,
    materialById,
    formatVc,

    // ---- helpers ----
    getOpenOrders() { return this.data.orders.filter(o => !o.done); },
    findOrder(orderId) { return this.data.orders.find(o => o.id === orderId) || null; },
    findPiece(orderId, pieceId) {
      const o = this.findOrder(orderId);
      return o ? (o.pieces || []).find(p => p.id === pieceId) || null : null;
    },

    // ---- orders CRUD ----
    addOrder({ title, material, materialId, note }) {
      const t = String(title || "").trim();
      if (!t) return { ok: false, error: "Titel fehlt." };

      const o = {
        id: uid(),
        title: t,
        material: String(material || "").trim(),
        materialId: String(materialId || "").trim(),
        note: String(note || "").trim(),
        done: false,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        pieces: []
      };

      this.data.orders.unshift(o);
      this.save();
      return { ok: true, order: o };
    },

    toggleOrder(orderId) { const o = this.findOrder(orderId); if (!o) return; o.done = !o.done; o.updatedAt = nowISO(); this.save(); },
    deleteOrder(orderId) { this.data.orders = this.data.orders.filter(o => o.id !== orderId); this.save(); },
    clearOrders() { this.data.orders = []; this.save(); },

    // ---- pieces CRUD ----
    addPiece(orderId, { name, lengthMm, durationSec, qtyTotal, note }) {
      const o = this.findOrder(orderId);
      if (!o) return { ok: false, error: "Auftrag nicht gefunden." };

      const L = Number(lengthMm), D = Number(durationSec), Q = Number(qtyTotal);
      if (!(L > 0) || !(D > 0) || !(Q > 0)) return { ok: false, error: "Länge, Dauer, Menge müssen > 0 sein." };

      const p = { id: uid(), name: String(name || "").trim(), lengthMm: L, durationSec: D, qtyTotal: Q, qtyDone: 0, note: String(note || "").trim(), createdAt: nowISO(), updatedAt: nowISO() };
      o.pieces.push(p); o.updatedAt = nowISO(); this.save();
      return { ok: true, piece: p };
    },

    piecePlus(orderId, pieceId) { const p = this.findPiece(orderId, pieceId); if (!p) return; p.qtyDone = clamp((Number(p.qtyDone) || 0) + 1, 0, Number(p.qtyTotal) || 0); p.updatedAt = nowISO(); const o = this.findOrder(orderId); if (o) o.updatedAt = nowISO(); this.save(); },
    pieceMinus(orderId, pieceId) { const p = this.findPiece(orderId, pieceId); if (!p) return; p.qtyDone = clamp((Number(p.qtyDone) || 0) - 1, 0, Number(p.qtyTotal) || 0); p.updatedAt = nowISO(); const o = this.findOrder(orderId); if (o) o.updatedAt = nowISO(); this.save(); },
    deletePiece(orderId, pieceId) { const o = this.findOrder(orderId); if (!o) return; o.pieces = (o.pieces || []).filter(p => p.id !== pieceId); o.updatedAt = nowISO(); this.save(); }
  };

  window.WorkHubState = State;
})();
