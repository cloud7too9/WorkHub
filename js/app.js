// Info(#): Boot + Pages-Mount (Aufträge, Sägen, Handbuch)
(() => {
  "use strict";

  const S = window.WorkHubState;
  const UI = window.WorkHubUI;

  // ---------- Shared helpers ----------
  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function piecesPerBar(barLenMm, pieceLenMm, kerfMm) {
    const denom = Number(pieceLenMm) + Number(kerfMm);
    if (!(barLenMm > 0) || !(denom > 0)) return 0;
    return Math.floor(Number(barLenMm) / denom);
  }

  function getOpElapsedSec(op) {
    const base = Number(op.elapsedSecAcc || 0);
    if (op.status !== "running") return base;
    const lastStart = Number(op.lastStartEpochMs || 0);
    if (!lastStart) return base;
    return Math.max(0, base + (Date.now() - lastStart) / 1000);
  }

  function effectiveTPieceSec(op) {
    const a = Number(op.tPieceAutoSec || 0);
    if (a > 0) return a;
    const i = Number(op.tPieceInputSec || 0);
    return i > 0 ? i : 0;
  }

  // ---------- Page: Handbuch ----------
  function mountHandbuch(root, ctx) {
    const groupFilter = UI.qs("#groupFilter", root);
    const q = UI.qs("#q", root);
    const list = UI.qs("#list", root);
    const details = UI.qs("#details", root);
    const hbMode = UI.qs("#hbMode", root);

    let DB = null;
    let activeGroup = "all";
    let activeId = null;

    const params = new URLSearchParams(ctx?.queryString || "");
    const PICK_MODE = params.get("pick") === "1";
    hbMode.textContent = PICK_MODE ? "Auswahlmodus" : "Normal";

    function renderDropdown() {
      groupFilter.innerHTML =
        `<option value="all">Alle anzeigen</option>` +
        DB.groups.map(g => `<option value="${g.id}">${UI.escapeHtml(g.name)}</option>`).join("");
      groupFilter.value = activeGroup;
    }

    function fmtVc(vc){ return S.formatVc(vc); }

    function materialDetailsHTML(m) {
      const g = S.groupById(DB, m.groupId);
      return `
        <h2 style="margin:0 0 10px 0">${UI.escapeHtml(m.name || "—")}</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
          <span class="pill">${UI.escapeHtml(g?.name || "Unbekannte Gruppe")}</span>
          <span class="pill">ID: ${UI.escapeHtml(m.id || "—")}</span>
        </div>

        <div class="kvrow"><div class="k">Schnittgeschwindigkeit</div><div class="v">${UI.escapeHtml(fmtVc(g?.saw?.schnittgeschwindigkeit_ms))}</div></div>
        <div class="kvrow"><div class="k">Sägedruck (SD)</div><div class="v">${UI.escapeHtml(g?.saw?.saegedruck_sd ?? "—")}</div></div>
        <div class="kvrow"><div class="k">Sägesenkgeschwindigkeit</div><div class="v">${UI.escapeHtml(g?.saw?.saegesenkgeschwindigkeit ?? "—")}</div></div>
        <div class="kvrow"><div class="k">Späne → wohin</div><div class="v">${UI.escapeHtml(g?.chipsBin ?? "—")}</div></div>
        <div class="kvrow"><div class="k">Reste → wohin</div><div class="v">${UI.escapeHtml((g?.scrapStorage && g.scrapStorage.trim()) ? g.scrapStorage : "—")}</div></div>

        <div class="subcard">
          <div class="k">Notizen</div>
          <div style="margin-top:8px;padding:10px;border:1px solid var(--border2);border-radius:12px;background:var(--panel);">
            ${m.notes?.trim() ? UI.escapeHtml(m.notes) : "<span class='muted'>—</span>"}
          </div>
        </div>
      `;
    }

    function renderPickActions(m) {
      const pickCtx = S.getPickCtx();
      if (!pickCtx?.returnHash) {
        return `
          <div class="warn" style="margin-top:12px">
            Auswahlmodus aktiv, aber Kontext fehlt.<br>
            <span class="muted">Starte die Auswahl über „Werkstoff wählen“ in Aufträge.</span>
          </div>
        `;
      }

      return `
        <div class="warn" style="margin-top:12px">
          Tippe auf <b>„Zum Auftrag hinzufügen“</b>, um den Werkstoff zu übernehmen.
        </div>

        <div class="row" style="margin-top:10px">
          <button class="btn primary" data-action="pick-apply" data-id="${m.id}">Zum Auftrag hinzufügen</button>
          <button class="btn ghost" data-action="pick-cancel">Abbrechen</button>
        </div>
      `;
    }

    function renderDetails(id) {
      const m = DB.materials.find(x => x.id === id);
      if (!m) {
        details.innerHTML = `<div class="warn">Werkstoff nicht gefunden.</div>`;
        return;
      }
      details.innerHTML = materialDetailsHTML(m) + (PICK_MODE ? renderPickActions(m) : "");
    }

    function renderList(filterText = "") {
      list.innerHTML = "";
      const t = filterText.trim().toLowerCase();

      const items = DB.materials
        .filter(m => {
          const matchesText =
            !t ||
            (m.name && m.name.toLowerCase().includes(t)) ||
            (m.id && m.id.toLowerCase().includes(t));
          const matchesGroup = activeGroup === "all" || m.groupId === activeGroup;
          return matchesText && matchesGroup;
        })
        .sort((a,b) => (a.name || "").localeCompare(b.name || "", "de"));

      if (!items.length) {
        list.innerHTML = `<div class="muted">Keine Treffer.</div>`;
        return;
      }

      for (const m of items) {
        const g = S.groupById(DB, m.groupId);

        const el = document.createElement("div");
        el.className = "item" + (m.id === activeId ? " active" : "");
        el.innerHTML = `
          <div class="item-head">
            <strong>${UI.escapeHtml(m.name ?? "—")}</strong>
            <span class="pill">${UI.escapeHtml(g?.name || "—")}</span>
          </div>
          <div class="meta">
            vc: ${UI.escapeHtml(fmtVc(g?.saw?.schnittgeschwindigkeit_ms))} • SD: ${UI.escapeHtml(g?.saw?.saegedruck_sd ?? "—")} • ID: ${UI.escapeHtml(m.id ?? "—")}
          </div>
        `;
        el.onclick = () => {
          activeId = m.id;
          renderList(q.value);
          renderDetails(m.id);
        };
        list.appendChild(el);
      }
    }

    // events
    groupFilter.addEventListener("change", (e) => {
      activeGroup = e.target.value;
      activeId = null;
      details.innerHTML = `<div class="warn">Wähle links einen Werkstoff aus.</div>`;
      renderList(q.value);
    });

    q.addEventListener("input", () => renderList(q.value));

    UI.on(root, "click", "[data-action='pick-cancel']", () => {
      const pickCtx = S.getPickCtx();
      location.hash = pickCtx?.returnHash || "#/auftraege";
    });

    UI.on(root, "click", "[data-action='pick-apply']", (_, el) => {
      const pickCtx = S.getPickCtx();
      S.setPickRes({ materialId: el.dataset.id, ctx: pickCtx, ts: Date.now() });
      location.hash = pickCtx?.returnHash || "#/auftraege";
    });

    // init
    details.innerHTML = `<div class="warn">Wähle links einen Werkstoff aus.</div>`;
    S.loadMaterialDB("./data/materials.json").then(db => {
      DB = db;
      renderDropdown();
      renderList("");
    });

    return () => {};
  }

  // ---------- Page: Aufträge ----------
  function mountAuftraege(root) {
    S.load();

    // ---- refs
    const form = UI.qs("#orderForm", root);
    const titleEl = UI.qs("#title", root);
    const materialEl = UI.qs("#material", root);
    const materialIdEl = UI.qs("#materialId", root);
    const materialHintEl = UI.qs("#materialHint", root);
    const pickMaterialBtn = UI.qs("#pickMaterial", root);

    const noteEl = UI.qs("#note", root);
    const msgEl = UI.qs("#msg", root);

    const activeList = UI.qs("#activeList", root);
    const doneList = UI.qs("#doneList", root);
    const emptyActive = UI.qs("#emptyActive", root);
    const emptyDone = UI.qs("#emptyDone", root);

    const clearAllBtn = UI.qs("#clearAll", root);
    const seedResetBtn = UI.qs("#seedReset", root);

    function flash(text, isError = false) {
      msgEl.textContent = text;
      msgEl.style.opacity = "1";
      msgEl.classList.toggle("error", isError);
      window.clearTimeout(flash._t);
      flash._t = window.setTimeout(() => (msgEl.style.opacity = "0"), 1800);
    }

    let materialDB = null;
    async function ensureDB() {
      if (materialDB) return materialDB;
      materialDB = await S.loadMaterialDB("./data/materials.json");
      return materialDB;
    }

    function setSelectedMaterialUI({ materialId, materialName, groupName }) {
      materialIdEl.value = materialId || "";
      if (materialName) materialEl.value = materialName;

      if (materialId) {
        materialHintEl.textContent = `Handbuch: ${materialName || "—"} (${materialId})` + (groupName ? ` • ${groupName}` : "");
      } else {
        materialHintEl.textContent = "Kein Werkstoff aus dem Handbuch gewählt.";
      }
    }

    function startPickMaterial(ctx) {
      S.setPickCtx({
        returnHash: "#/auftraege",
        target: ctx.target,
        orderId: ctx.orderId || "",
        ts: Date.now(),
      });
      location.hash = "#/handbuch?pick=1";
    }

    function orderTemplate(o) {
      const status = o.done ? "Erledigt" : "Aktiv";
      const pieces = Array.isArray(o.pieces) ? o.pieces : [];

      const hbMat = o.materialId
        ? `<div class="meta"><span>Werkstoff:</span> ${UI.escapeHtml(o.material || "—")} <span class="muted">(${UI.escapeHtml(o.materialId)})</span></div>`
        : "";

      const freeMat = (!o.materialId && o.material)
        ? `<div class="meta"><span>Material:</span> ${UI.escapeHtml(o.material)}</div>`
        : "";

      const piecesHtml = o.done
        ? piecesListTemplate(o, pieces, true)
        : piecesEditorTemplate(o, pieces);

      return `
        <li class="item ${o.done ? "done" : ""}" data-order="${o.id}">
          <div class="item-head">
            <strong>${UI.escapeHtml(o.title)}</strong>
            <span class="pill">${status}</span>
          </div>

          ${hbMat}
          ${freeMat}
          ${o.note ? `<div class="meta"><span>Notiz:</span> ${UI.escapeHtml(o.note)}</div>` : ""}

          <div class="row" style="margin-top:10px">
            <button class="btn small" data-action="order-pick-material" data-id="${o.id}">
              Werkstoff ${o.materialId ? "ändern" : "wählen"}
            </button>
            ${o.materialId ? `<button class="btn small danger" data-action="order-clear-material" data-id="${o.id}">Werkstoff entfernen</button>` : ""}
          </div>

          ${piecesHtml}

          <div class="row" style="margin-top:10px">
            <button class="btn small" data-action="toggle-order" data-id="${o.id}">
              ${o.done ? "Wieder aktiv" : "Erledigen"}
            </button>
            <button class="btn small danger" data-action="delete-order" data-id="${o.id}">
              Löschen
            </button>
          </div>
        </li>
      `;
    }

    function piecesListTemplate(order, pieces, readOnly) {
      if (!pieces.length) return `<p class="muted">Keine Sägestücke hinterlegt.</p>`;
      const rows = pieces.map(p => `
        <li class="item ${readOnly ? "done" : ""}">
          <div class="item-head">
            <strong>${UI.escapeHtml(p.name || "Sägestück")}</strong>
            <span class="pill">${Number(p.qtyDone || 0)}/${Number(p.qtyTotal || 0)}</span>
          </div>
          <div class="meta"><span>Länge:</span> ${Number(p.lengthMm || 0)} mm</div>
          <div class="meta"><span>Dauer:</span> ${Number(p.durationSec || 0)} s/Stk</div>
          ${p.note ? `<div class="meta"><span>Notiz:</span> ${UI.escapeHtml(p.note)}</div>` : ""}
        </li>
      `).join("");

      return `<div class="subcard"><h3>Sägestücke</h3><ul class="list">${rows}</ul></div>`;
    }

    function piecesEditorTemplate(order, pieces) {
      const rows = pieces.length
        ? pieces.map(p => `
          <li class="item">
            <div class="item-head">
              <strong>${UI.escapeHtml(p.name || "Sägestück")}</strong>
              <span class="pill">${Number(p.qtyDone || 0)}/${Number(p.qtyTotal || 0)}</span>
            </div>
            <div class="meta"><span>Länge:</span> ${Number(p.lengthMm || 0)} mm</div>
            <div class="meta"><span>Dauer:</span> ${Number(p.durationSec || 0)} s/Stk</div>

            <div class="row" style="margin-top:10px">
              <button class="btn small" data-action="piece-plus" data-order="${order.id}" data-piece="${p.id}">+1 fertig</button>
              <button class="btn small" data-action="piece-minus" data-order="${order.id}" data-piece="${p.id}">-1</button>
              <button class="btn small danger" data-action="piece-delete" data-order="${order.id}" data-piece="${p.id}">Löschen</button>
            </div>
          </li>
        `).join("")
        : `<p class="muted">Noch keine Sägestücke. Füge eins hinzu.</p>`;

      return `
        <div class="subcard">
          <h3>Sägestücke</h3>

          <form class="form" data-action="piece-add-form" data-order="${order.id}">
            <label class="field">
              <span>Name (optional)</span>
              <input type="text" maxlength="40" placeholder="z.B. 120mm Stück" data-role="p-name" />
            </label>

            <div class="row">
              <label class="field" style="flex:1">
                <span>Länge (mm) *</span>
                <input type="number" inputmode="numeric" min="0" step="0.1" placeholder="z.B. 120" data-role="p-len" required />
              </label>

              <label class="field" style="flex:1">
                <span>Dauer pro Stück (s) *</span>
                <input type="number" inputmode="numeric" min="0" step="1" placeholder="z.B. 25" data-role="p-dur" required />
              </label>
            </div>

            <div class="row">
              <label class="field" style="flex:1">
                <span>Menge insgesamt *</span>
                <input type="number" inputmode="numeric" min="0" step="1" placeholder="z.B. 80" data-role="p-qty" required />
              </label>

              <label class="field" style="flex:1">
                <span>Notiz (optional)</span>
                <input type="text" maxlength="80" placeholder="z.B. Kante entgraten" data-role="p-note" />
              </label>
            </div>

            <button class="btn primary" type="submit">Sägestück hinzufügen</button>
          </form>

          <ul class="list">${rows}</ul>
        </div>
      `;
    }

    function render() {
      const orders = S.data.orders || [];
      const active = orders.filter(o => !o.done);
      const done = orders.filter(o => o.done);

      emptyActive.style.display = active.length ? "none" : "block";
      emptyDone.style.display = done.length ? "none" : "block";

      activeList.innerHTML = active.map(orderTemplate).join("");
      doneList.innerHTML = done.map(orderTemplate).join("");
    }

    // ---- consume pick result (wenn aus Handbuch zurück)
    (async () => {
      const res = S.consumePickRes();
      if (!res?.materialId) return;

      const db = await ensureDB();
      const m = S.materialById(db, res.materialId);
      if (!m) return UI.toast("Werkstoff nicht gefunden.", "error");

      const g = S.groupById(db, m.groupId);
      const materialName = m.name || m.id;
      const groupName = g?.name || "";

      const ctx = res.ctx || {};
      if (ctx.target === "order" && ctx.orderId) {
        const o = S.findOrder(ctx.orderId);
        if (o) {
          o.materialId = m.id;
          o.material = materialName;
          o.updatedAt = new Date().toISOString();
          S.save();
          UI.toast(`Werkstoff gesetzt: ${materialName}`, "ok");
        }
      } else {
        setSelectedMaterialUI({ materialId: m.id, materialName, groupName });
        UI.toast(`Werkstoff gewählt: ${materialName}`, "ok");
      }

      render();
    })();

    // ---- events: form
    pickMaterialBtn.addEventListener("click", () => startPickMaterial({ target: "newOrder" }));

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const r = S.addOrder({
        title: titleEl.value,
        material: materialEl.value,
        materialId: materialIdEl.value,
        note: noteEl.value
      });

      if (!r.ok) return flash(r.error, true);

      render();
      UI.toast("Auftrag erstellt ✅");

      form.reset();
      setSelectedMaterialUI({ materialId: "", materialName: "", groupName: "" });
      titleEl.focus();
    });

    clearAllBtn.addEventListener("click", () => {
      S.clearOrders();
      render();
      UI.toast("Alle Aufträge gelöscht.");
    });

    seedResetBtn.addEventListener("click", async () => {
      await S.resetToSeed();
      S.load();
      render();
      UI.toast("Seed geladen ✅");
    });

    // ---- events: delegation (orders + pieces)
    UI.on(root, "click", "[data-action='toggle-order']", (_, el) => { S.toggleOrder(el.dataset.id); render(); });
    UI.on(root, "click", "[data-action='delete-order']", (_, el) => { S.deleteOrder(el.dataset.id); render(); });

    UI.on(root, "click", "[data-action='order-pick-material']", (_, el) => {
      startPickMaterial({ target: "order", orderId: el.dataset.id });
    });

    UI.on(root, "click", "[data-action='order-clear-material']", (_, el) => {
      const o = S.findOrder(el.dataset.id);
      if (!o) return;
      o.materialId = "";
      o.material = "";
      o.updatedAt = new Date().toISOString();
      S.save();
      render();
      UI.toast("Werkstoff entfernt.", "ok");
    });

    UI.on(root, "click", "[data-action='piece-plus']", (_, el) => { S.piecePlus(el.dataset.order, el.dataset.piece); render(); });
    UI.on(root, "click", "[data-action='piece-minus']", (_, el) => { S.pieceMinus(el.dataset.order, el.dataset.piece); render(); });
    UI.on(root, "click", "[data-action='piece-delete']", (_, el) => { S.deletePiece(el.dataset.order, el.dataset.piece); render(); });

    UI.on(root, "submit", "[data-action='piece-add-form']", (e, formEl) => {
      e.preventDefault();
      const orderId = formEl.dataset.order;

      const payload = {
        name: formEl.querySelector("[data-role='p-name']").value,
        lengthMm: formEl.querySelector("[data-role='p-len']").value,
        durationSec: formEl.querySelector("[data-role='p-dur']").value,
        qtyTotal: formEl.querySelector("[data-role='p-qty']").value,
        note: formEl.querySelector("[data-role='p-note']").value
      };

      const r = S.addPiece(orderId, payload);
      if (!r.ok) return UI.toast(r.error, "error");

      formEl.reset();
      render();
      UI.toast("Sägestück hinzugefügt ✅");
    });

    // ---- init
    setSelectedMaterialUI({ materialId: "", materialName: "", groupName: "" });
    render();
    titleEl.focus();

    return () => {};
  }

  // ---------- Page: Sägen ----------
  function mountSaegen(root) {
    S.load();

    const wrap = UI.qs("#sawWrap", root);

    const opDialog = UI.qs("#opDialog", root);
    const opForm = UI.qs("#opForm", root);
    const opSawId = UI.qs("#opSawId", root);
    const opOrderSelect = UI.qs("#opOrderSelect", root);
    const opPieceSelect = UI.qs("#opPieceSelect", root);
    const opTotal = UI.qs("#opTotal", root);
    const opBarLen = UI.qs("#opBarLen", root);

    let tick = null;

    function save() { S.save(); }
    function saws() { return S.data.saws; }

    function updateOpLive(saw) {
      const op = saw.currentOp;
      if (!op || op.status !== "running") return;

      const elapsed = getOpElapsedSec(op);

      let autoCount = 0;
      if ((op.confirmedCount || 0) > 0 && (op.tPieceAutoSec || 0) > 0) {
        autoCount = Math.floor(elapsed / op.tPieceAutoSec);
      }

      op.fertig = Math.min(
        Math.max(Number(op.confirmedCount || 0), autoCount),
        Number(op.totalTarget || 0)
      );

      // Material-Check: wenn Stange leer -> pause_break
      if (op.barLengthMm > 0 && op.piecesPerBar > 0) {
        const cutOnBar = Number(op.fertig || 0) - Number(op.barStartCount || 0);
        if (cutOnBar >= Number(op.piecesPerBar)) {
          pauseOp(saw, "material");
        }
      }

      // Completion
      if (Number(op.fertig || 0) >= Number(op.totalTarget || 0)) {
        finishOp(saw);
      }

      // Sync progress in orders (offset + fertig)
      const piece = S.findPiece(op.orderId, op.pieceId);
      if (piece) {
        const next = Math.min(
          Number(op.pieceDoneOffset || 0) + Number(op.fertig || 0),
          Number(piece.qtyTotal || 0)
        );
        if (next !== Number(piece.qtyDone || 0)) {
          piece.qtyDone = next;
          piece.updatedAt = new Date().toISOString();
          const ord = S.findOrder(op.orderId);
          if (ord) ord.updatedAt = new Date().toISOString();
        }
      }
    }

    function startTick() {
      if (tick) return;
      tick = setInterval(() => {
        for (const saw of saws()) updateOpLive(saw);
        save();
        render();
      }, 350);
    }

    function stopTickIfIdle() {
      const any = saws().some(s => s.currentOp?.status === "running");
      if (!any && tick) { clearInterval(tick); tick = null; }
    }

    function createOpForSaw(sawId, orderId, pieceId, totalTarget, barLenMmOptional) {
      const saw = saws().find(s => s.id === sawId);
      const piece = S.findPiece(orderId, pieceId);
      if (!saw || !piece) return;

      const remaining = Math.max(0, Number(piece.qtyTotal || 0) - Number(piece.qtyDone || 0));
      const target = Math.max(1, Math.min(Number(totalTarget || 1), remaining > 0 ? remaining : Number(totalTarget || 1)));

      const op = {
        opId: (crypto?.randomUUID ? crypto.randomUUID() : (Math.random().toString(16).slice(2) + Date.now().toString(16))),
        status: "ready",          // ready | running | paused | paused_break | completed
        pauseReason: null,

        orderId,
        pieceId,

        pieceLenMm: Number(piece.lengthMm || 0),
        kerfMm: Number(saw.kerfMm || 1.7),

        totalTarget: target,
        fertig: 0,

        confirmedCount: 0,
        tPieceInputSec: Number(piece.durationSec || 0),
        tPieceAutoSec: 0,

        elapsedSecAcc: 0,
        lastStartEpochMs: 0,

        barLengthMm: barLenMmOptional ? Number(barLenMmOptional) : 0,
        piecesPerBar: 0,
        barStartCount: 0,

        pieceDoneOffset: Number(piece.qtyDone || 0)
      };

      if (op.barLengthMm > 0) {
        op.piecesPerBar = piecesPerBar(op.barLengthMm, op.pieceLenMm, op.kerfMm);
        op.barStartCount = 0;
      }

      saw.currentOp = op;
    }

    function startOp(saw) {
      const op = saw.currentOp;
      if (!op || op.status === "completed") return;

      op.status = "running";
      op.pauseReason = null;
      op.lastStartEpochMs = Date.now();

      save();
      render();
      startTick();
    }

    function pauseOp(saw, reason = "manual") {
      const op = saw.currentOp;
      if (!op || op.status !== "running") return;

      op.elapsedSecAcc = getOpElapsedSec(op);
      op.lastStartEpochMs = 0;

      op.status = (reason === "material") ? "paused_break" : "paused";
      op.pauseReason = reason;

      save();
      render();
      stopTickIfIdle();
    }

    function finishOp(saw) {
      const op = saw.currentOp;
      if (!op) return;

      if (op.status === "running") {
        op.elapsedSecAcc = getOpElapsedSec(op);
        op.lastStartEpochMs = 0;
      }

      op.status = "completed";
      op.pauseReason = null;

      save();
      render();
      stopTickIfIdle();
    }

    function clearOp(saw) {
      saw.currentOp = null;
      save();
      render();
      stopTickIfIdle();
    }

    function materialAddAndResume(saw, barLenMm) {
      const op = saw.currentOp;
      if (!op) return;

      const L = Number(barLenMm || 0);
      if (!(L > 0)) return UI.toast("Material-Länge fehlt.", "error");

      op.barLengthMm = L;
      op.piecesPerBar = piecesPerBar(op.barLengthMm, op.pieceLenMm, op.kerfMm);
      op.barStartCount = Number(op.fertig || 0);

      if (op.status === "paused_break") startOp(saw);

      save();
      render();
    }

    function confirmOnePiece(saw) {
      const op = saw.currentOp;
      if (!op || op.status !== "running") return;

      const elapsed = getOpElapsedSec(op);
      const basis = Number(op.fertig || 0);
      const nextConfirmed = Math.min(basis + 1, Number(op.totalTarget || 1));

      op.confirmedCount = nextConfirmed;
      op.tPieceAutoSec = Math.max(1, elapsed / op.confirmedCount);
      op.fertig = Math.max(op.fertig, op.confirmedCount);

      if (op.barLengthMm > 0 && op.piecesPerBar > 0) {
        const cutOnBar = Number(op.fertig || 0) - Number(op.barStartCount || 0);
        if (cutOnBar >= Number(op.piecesPerBar)) {
          pauseOp(saw, "material");
        }
      }

      if (Number(op.fertig || 0) >= Number(op.totalTarget || 0)) {
        finishOp(saw);
      }

      save();
      render();
    }

    function setPieceLen(saw, v) {
      const op = saw.currentOp;
      const n = Number(v || 0);
      if (!op || !(n > 0)) return;

      op.pieceLenMm = n;
      if (op.barLengthMm > 0) op.piecesPerBar = piecesPerBar(op.barLengthMm, op.pieceLenMm, op.kerfMm);

      save();
      render();
    }

    function setTPieceInput(saw, v) {
      const op = saw.currentOp;
      const n = Number(v || 0);
      if (!op || !(n > 0)) return;

      op.tPieceInputSec = n;
      save();
      render();
    }

    function populatePieces(orderId) {
      const o = S.findOrder(orderId);
      const pieces = o?.pieces || [];
      opPieceSelect.innerHTML = pieces.map(p => {
        const label = `${p.name || "Sägestück"} • ${p.lengthMm}mm • ${p.durationSec}s/Stk • ${p.qtyDone}/${p.qtyTotal}`;
        return `<option value="${p.id}">${UI.escapeHtml(label)}</option>`;
      }).join("");

      const first = pieces[0];
      if (first) {
        const remaining = Math.max(1, Number(first.qtyTotal || 1) - Number(first.qtyDone || 0));
        opTotal.value = String(remaining);
      } else {
        opTotal.value = "1";
      }
    }

    function openOpDialog(sawId) {
      const open = S.getOpenOrders();
      if (!open.length) return UI.toast("Keine offenen Aufträge vorhanden.", "error");

      opSawId.value = sawId;
      opOrderSelect.innerHTML = open.map(o => `<option value="${o.id}">${UI.escapeHtml(o.title)}</option>`).join("");
      populatePieces(opOrderSelect.value);

      opBarLen.value = "";

      if (opDialog?.showModal) opDialog.showModal();
      else UI.toast("Dialog nicht unterstützt.", "error");
    }

    opOrderSelect.addEventListener("change", () => populatePieces(opOrderSelect.value));
    opPieceSelect.addEventListener("change", () => {
      const p = S.findPiece(opOrderSelect.value, opPieceSelect.value);
      if (p) {
        const remaining = Math.max(1, Number(p.qtyTotal || 1) - Number(p.qtyDone || 0));
        opTotal.value = String(remaining);
      }
    });

    opForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const sawId = opSawId.value;
      const saw = saws().find(s => s.id === sawId);
      if (!saw) return;

      if (saw.currentOp?.status === "running") {
        return UI.toast("Säge läuft bereits.", "error");
      }

      createOpForSaw(
        sawId,
        opOrderSelect.value,
        opPieceSelect.value,
        Number(opTotal.value || 1),
        Number(opBarLen.value || 0)
      );

      save();
      render();
      opDialog.close();
      UI.toast("Vorgang bereit ✅");
    });

    function sawCard(saw) {
      const op = saw.currentOp;

      const status = !op ? ["Leer",""] :
        op.status === "ready" ? ["Bereit",""] :
        op.status === "running" ? ["Läuft",""] :
        op.status === "paused_break" ? ["Unterbrechung (Material)","warn"] :
        op.status === "paused" ? ["Pausiert","warn"] :
        ["Fertig","done"];

      const elapsed = op ? getOpElapsedSec(op) : 0;

      let breakTxt = "—";
      if (op && op.barLengthMm > 0 && op.piecesPerBar > 0) {
        const tPiece = effectiveTPieceSec(op);
        const cutOnBar = Number(op.fertig || 0) - Number(op.barStartCount || 0);
        const remainingPieces = Math.max(0, Number(op.piecesPerBar) - cutOnBar);
        breakTxt = (tPiece > 0) ? `${fmtTime(remainingPieces * tPiece)} (${remainingPieces} Stk)` : `(${remainingPieces} Stk)`;
      }

      const canStart = op && (op.status === "ready" || op.status === "paused");
      const canPause = op && op.status === "running";
      const canConfirm = op && op.status === "running";
      const canClear = op && op.status !== "running";

      return `
        <section class="card">
          <div class="item-head">
            <h2 style="margin:0">${UI.escapeHtml(saw.name)}</h2>
            <span class="pill ${status[1]}">${status[0]}</span>
          </div>

          <div class="row" style="margin-top:10px">
            <button class="btn primary" data-action="open-op" data-saw="${saw.id}">Vorgang hinzufügen</button>
            <button class="btn" data-action="start-op" data-saw="${saw.id}" ${canStart ? "" : "disabled"}>Vorgang starten</button>
            <button class="btn ghost" data-action="pause-op" data-saw="${saw.id}" ${canPause ? "" : "disabled"}>Pause</button>
            <button class="btn" data-action="confirm-one" data-saw="${saw.id}" ${canConfirm ? "" : "disabled"}>1. fertig</button>
            <button class="btn danger" data-action="clear-op" data-saw="${saw.id}" ${canClear ? "" : "disabled"}>Vorgang löschen</button>
          </div>

          ${!op ? `<p class="muted" style="margin-top:10px">Kein Vorgang.</p>` : `
            <div class="subcard">
              <div class="row">
                <div class="meta"><span>Insgesamt:</span> ${Number(op.totalTarget || 0)}</div>
                <div class="meta"><span>Fertig:</span> ${Number(op.fertig || 0)}</div>
              </div>

              <div class="row">
                <div class="meta"><span>Dauer insgesamt:</span> ${fmtTime(elapsed)}</div>
                <div class="meta"><span>Dauer bis Unterbrechung:</span> ${breakTxt}</div>
              </div>

              <div class="row">
                <label class="field" style="flex:1">
                  <span>Sägestück Länge (mm)</span>
                  <input type="number" min="0" step="0.1" inputmode="numeric"
                    value="${Number(op.pieceLenMm || 0)}"
                    data-action="set-piece-len" data-saw="${saw.id}">
                </label>

                <label class="field" style="flex:1">
                  <span>Sägedauer / Stück (s)</span>
                  <input type="number" min="0" step="1" inputmode="numeric"
                    value="${Number(op.tPieceInputSec || 0)}"
                    data-action="set-tpiece-input" data-saw="${saw.id}">
                </label>
              </div>

              <div class="row">
                <label class="field" style="flex:1">
                  <span>Material-Länge (mm)</span>
                  <input type="number" min="0" step="0.1" inputmode="numeric"
                    value="${op.barLengthMm ? Number(op.barLengthMm) : ""}"
                    placeholder="z.B. 3000"
                    data-role="barlen" data-saw="${saw.id}">
                  <div class="muted" style="font-size:.88rem;margin-top:6px">
                    Stücke/Stange = floor(Material / (Länge + ${Number(op.kerfMm || 1.7)}mm))
                  </div>
                </label>

                <button class="btn ghost" style="align-self:end"
                  data-action="material-add" data-saw="${saw.id}">
                  Material hinzufügen
                </button>
              </div>

              ${op.status === "paused_break"
                ? `<p class="msg error">Material leer → Länge eingeben → läuft automatisch weiter.</p>`
                : ``}
            </div>
          `}
        </section>
      `;
    }

    function render() {
      wrap.innerHTML = saws().map(sawCard).join("");
    }

    UI.on(root, "click", "[data-action='open-op']", (_, el) => openOpDialog(el.dataset.saw));

    UI.on(root, "click", "[data-action='start-op']", (_, el) => {
      const saw = saws().find(s => s.id === el.dataset.saw);
      if (saw) startOp(saw);
    });

    UI.on(root, "click", "[data-action='pause-op']", (_, el) => {
      const saw = saws().find(s => s.id === el.dataset.saw);
      if (saw) pauseOp(saw, "manual");
    });

    UI.on(root, "click", "[data-action='confirm-one']", (_, el) => {
      const saw = saws().find(s => s.id === el.dataset.saw);
      if (saw) confirmOnePiece(saw);
    });

    UI.on(root, "click", "[data-action='clear-op']", (_, el) => {
      const saw = saws().find(s => s.id === el.dataset.saw);
      if (saw) clearOp(saw);
    });

    UI.on(root, "click", "[data-action='material-add']", (_, el) => {
      const sawId = el.dataset.saw;
      const saw = saws().find(s => s.id === sawId);
      const input = root.querySelector(`[data-role="barlen"][data-saw="${sawId}"]`);
      if (saw) materialAddAndResume(saw, input?.value);
    });

    UI.on(root, "change", "input[data-action='set-piece-len']", (_, el) => {
      const saw = saws().find(s => s.id === el.dataset.saw);
      if (saw) setPieceLen(saw, el.value);
    });

    UI.on(root, "change", "input[data-action='set-tpiece-input']", (_, el) => {
      const saw = saws().find(s => s.id === el.dataset.saw);
      if (saw) setTPieceInput(saw, el.value);
    });

    render();

    if (saws().some(s => s.currentOp?.status === "running")) startTick();

    return () => {
      if (tick) { clearInterval(tick); tick = null; }
    };
  }

  // ---------- Pages registry ----------
  window.WorkHubPages = {
    auftraege: { mount: mountAuftraege },
    saegen: { mount: mountSaegen },
    handbuch: { mount: mountHandbuch }
  };

  // ---------- Boot ----------
  S.load();
  if (!location.hash) location.hash = "#/auftraege";
  window.WorkHubRouter.go();
})();
