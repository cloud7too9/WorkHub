// Info(#): Hash-Router + Page-Loader + Mount/Unmount (Query in Hash möglich)
(() => {
  "use strict";

  const UI = window.WorkHubUI;

  let current = { route: null, unmount: null };

  function parseHash() {
    const h = location.hash || "#/auftraege";
    const raw = h.startsWith("#/") ? h.slice(2) : "auftraege";
    const [route, queryString = ""] = raw.split("?");
    return { route: (route || "auftraege").toLowerCase(), queryString };
  }

  async function loadPageHtml(route) {
    const res = await fetch(`./pages/${route}.html`, { cache: "no-store" });
    if (!res.ok) throw new Error("page not found");
    return await res.text();
  }

  async function go() {
    const { route, queryString } = parseHash();
    const app = UI.qs("#app");

    if (current.unmount) {
      try { current.unmount(); } catch {}
      current.unmount = null;
    }

    UI.setActiveNav(route);

    let html = "";
    try {
      html = await loadPageHtml(route);
    } catch {
      html = `<section class="card"><h2>Seite nicht gefunden</h2><p class="muted">Route: ${route}</p></section>`;
    }

    app.innerHTML = html;

    const pages = window.WorkHubPages || {};
    if (pages[route]?.mount) {
      current.unmount = pages[route].mount(app, { route, queryString }) || null;
    }

    current.route = route;
  }

  window.WorkHubRouter = { go, parseHash };

  window.addEventListener("hashchange", go);
})();
