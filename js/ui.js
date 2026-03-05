// Info(#): DOM-Helper, Toasts, Delegation, Templates
(() => {
  "use strict";

  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

  function on(root, event, selector, handler, opts) {
    root.addEventListener(event, (e) => {
      const el = e.target.closest(selector);
      if (!el) return;
      handler(e, el);
    }, opts);
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toast(text, type = "ok") {
    const host = qs("#toastHost");
    if (!host) return;

    const node = document.createElement("div");
    node.className = "toast" + (type === "error" ? " error" : "");
    node.textContent = text;

    host.appendChild(node);
    setTimeout(() => node.remove(), 1800);
  }

  function setActiveNav(route) {
    qsa(".nav-link").forEach(a => a.classList.toggle("active", a.dataset.nav === route));
  }

  window.WorkHubUI = { qs, qsa, on, toast, escapeHtml, setActiveNav };
})();
