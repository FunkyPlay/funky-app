// Funky Launcher mobile — этап 1. Без сборщика: обычный JS.
(() => {
  const CATALOG = "https://raw.githubusercontent.com/FunkyPlay/FunkyLauncher/main/catalog2.json";
  const ASSETS = "https://raw.githubusercontent.com/FunkyPlay/FunkyLauncher/main/src/FunkyLauncher/Assets/";
  const DOWNLOAD = "https://funkylauncher.com/download";
  const CHANNEL = { ru: "https://t.me/FunkyPlayTV", en: "https://t.me/FunkyLauncher" };
  const DEALS_BOT = "https://t.me/FunkyDiscountBot";
  // витрина бота FunkyDiscount на нашем сервере; локально для проверки — data/deals.json
  const DEALS = location.hostname === "localhost" ? "data/deals.json" : "https://api.funkylauncher.com/support/deals.json";

  const tg = window.Telegram && Telegram.WebApp && Telegram.WebApp.initData ? Telegram.WebApp : null;
  const view = document.getElementById("view");
  const backBtn = document.getElementById("back");
  const langBtn = document.getElementById("lang");

  // ---------- язык ----------
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} }
  };
  const sysLang = ((tg && tg.initDataUnsafe.user && tg.initDataUnsafe.user.language_code) || navigator.language || "en").slice(0, 2);
  let lang = store.get("lang") || (["ru", "uk", "be", "kk"].includes(sysLang) ? "ru" : "en");
  const t = k => (STR[lang] && STR[lang][k]) || STR.en[k] || k;
  const L = v => v == null ? "" : typeof v === "string" ? v : (v[lang] || v.en || v.ru || "");
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const para = s => esc(s).split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");

  // ---------- данные ----------
  let lists = null, offline = false;
  async function loadCatalog() {
    if (lists) return lists;
    try {
      const r = await fetch(CATALOG, { cache: "no-cache" });
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      lists = d.modlists;
      // «Скоро» не показываем, пока Дизайн не скажет (GTA — личная сборка Funky, не анонсирована)
      store.set("catalog", JSON.stringify(lists = lists.filter(m => m.status !== "soon")));
    } catch (e) {
      const c = store.get("catalog");
      if (!c) throw e;
      lists = JSON.parse(c).filter(m => m.status !== "soon"); offline = true;
    }
    return lists;
  }
  let news = null;
  async function loadNews() {
    if (news) return news;
    try { news = await (await fetch("data/news.json", { cache: "no-cache" })).json(); } catch { news = {}; }
    return news;
  }
  const banner = m => m.banner && m.banner.startsWith("res:/Assets/") ? ASSETS + m.banner.slice(12) : "";

  // ---------- видеокарта (как PcCheck.Tier в лаунчере) ----------
  const norm = s => s.replace(/\((R|TM)\)|®|™/gi, "").replace(/\s+/g, " ").trim().toUpperCase();
  function gpuTier(gpu, laptop, r) {
    let name = norm(gpu); if (laptop && !name.includes("LAPTOP")) name += " LAPTOP";
    const order = ["low", "mid", "high"];
    let tier = null, best = 0;
    for (const [list, tr] of [[r.gpuHigh, "high"], [r.gpuMid, "mid"], [r.gpuLow, "low"]])
      for (const p of list || []) { const q = norm(p); if (q.length > best && name.includes(q)) { best = q.length; tier = tr; } }
    if (tier && tier !== "low" && name.includes("LAPTOP") && !(r.laptopKeep || []).some(k => name.includes(norm(k))))
      tier = order[order.indexOf(tier) - 1];
    return tier;
  }

  // ---------- экраны ----------
  // число модов — круглое, как в описании сборки («400+»); иначе округляем вниз
  function modsText(m) {
    const d = /(\d{2,4})\+/.exec(L(m.description));
    if (d) return `${d[1]}+ ${t("mods")}`;
    if (!m.modCount) return "";
    const n = m.modCount >= 300 ? Math.floor(m.modCount / 100) * 100 : Math.floor(m.modCount / 10) * 10;
    return `${n}+ ${t("mods")}`;
  }
  const ORDER = ["neon-nights", "starfield", "fallout4"];
  const rank = m => (m.status === "soon" ? 100 : 0) + (ORDER.includes(m.id) ? ORDER.indexOf(m.id) : 50);
  function card(m, first) {
    const mods = modsText(m);
    return `<a class="card${first ? " first" : ""}${m.status === "soon" ? " soon" : ""}" href="#/m/${encodeURIComponent(m.id)}">
      ${banner(m) ? `<img loading="lazy" src="${banner(m)}" alt="">` : ""}
      <span class="status">${t("status." + m.status)}</span>
      <div class="info">
        <div class="game slant">${esc(m.game)}</div>
        <div class="row"><span class="name">${esc(m.title)}${mods ? ` <em>· ${mods}</em>` : ""}</span>
          <span class="pill">${t("about")} ›</span></div>
      </div></a>`;
  }
  function catalogView(ls) {
    const s = [...ls].sort((a, b) => rank(a) - rank(b));
    return `<h1><span>${t("catalog.title")}</span></h1><p class="sub">${t("catalog.sub")}</p>
      ${offline ? `<p class="note">${t("offline")}</p>` : ""}
      <div class="cards">${s.map((m, i) => card(m, i === 0) + (i === 0 ? `<a class="btn wide" href="#/send">${t("send")}</a>` : "")).join("")}</div>`;
  }

  function detailView(m, nw) {
    const items = (nw[m.id] || []).filter(n => n[lang] || n.en);
    return `${banner(m) ? `<img class="hero" src="${banner(m)}" alt="">` : ""}
      <div class="title-game slant">${esc(m.game)}</div>
      <h1 style="font-size:20px;color:var(--cyan)">${esc(m.title)}</h1>
      <p class="muted">${esc(L(m.tag))}${m.version ? ` · ${t("version")} ${esc(m.version)}` : ""}</p>
      <p>${esc(L(m.description))}</p>
      ${m.status === "released" ? `<div class="actions">
        <a class="btn" href="#/send">${t("send")}</a>
        ${m.pcCheck ? `<a class="btn ghost" href="#/pc?g=${encodeURIComponent(m.id)}">${t("pc.check")}</a>` : ""}
        <a class="btn ghost" href="${CHANNEL[lang]}" target="_blank" rel="noopener">${t("notify")}</a></div>` : ""}
      <h2>${t("news")}</h2>
      ${items.length ? items.map(n => `<div class="news"><b>${esc(n.version || "")}</b> <span class="muted small">${esc(n.date || "")}</span>${para(L(n))}</div>`).join("") : `<p class="muted">${t("news.empty")}</p>`}
      ${m.details ? `<h2>${t("details")}</h2>${para(L(m.details))}` : ""}
      ${m.requirements ? `<h2>${t("requirements")}</h2>${para(L(m.requirements))}` : ""}`;
  }

  function pcView(ls, q) {
    const games = ls.filter(m => m.pcCheck);
    const g = games.find(m => m.id === q.get("g")) || games[0];
    const all = [...new Set(games.flatMap(m => [...(m.pcCheck.gpuHigh || []), ...(m.pcCheck.gpuMid || [])]))].sort();
    return `<h1>${t("pc.title")}</h1>
      <form id="pcf" class="form">
        <label>${t("pc.game")}<select name="g">${games.map(m => `<option value="${esc(m.id)}"${m === g ? " selected" : ""}>${esc(m.title)} — ${esc(m.game)}</option>`).join("")}</select></label>
        <label>${t("pc.gpu")}<input name="gpu" list="gpus" placeholder="${t("pc.gpu.ph")}" value="${esc(store.get("gpu") || "")}" autocomplete="off"></label>
        <datalist id="gpus">${all.map(x => `<option value="${esc(x)}">`).join("")}</datalist>
        <label class="check"><input type="checkbox" name="laptop"${store.get("laptop") === "1" ? " checked" : ""}> ${t("pc.laptop")}</label>
        <button class="btn" type="submit">${t("pc.go")}</button>
      </form><div id="pcr"></div>`;
  }
  function pcBind(ls) {
    const f = document.getElementById("pcf");
    f.onsubmit = e => {
      e.preventDefault();
      const m = ls.find(x => x.id === f.g.value), gpu = f.gpu.value.trim();
      if (!gpu) return;
      store.set("gpu", gpu); store.set("laptop", f.laptop.checked ? "1" : "0");
      const tier = gpuTier(gpu, f.laptop.checked, m.pcCheck);
      document.getElementById("pcr").innerHTML = `<div class="verdict ${tier || "unknown"}">${t("pc." + (tier || "unknown"))}
        ${m.pcCheck.gpuText ? `<div class="muted small">${t("pc.rec")}${esc(m.pcCheck.gpuText)}</div>` : ""}</div>`;
      if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred(tier === "high" ? "success" : "warning");
    };
  }

  function sendView() {
    const txt = `${t("send.text")} ${DOWNLOAD}`;
    return `<h1>${t("send")}</h1><p class="muted">${esc(txt)}</p><div class="actions col">
      <a class="btn" target="_blank" rel="noopener" href="https://t.me/share/url?url=${encodeURIComponent(DOWNLOAD)}&text=${encodeURIComponent(t("send.text"))}">${t("send.tg")}</a>
      <a class="btn ghost" href="mailto:?subject=Funky%20Launcher&body=${encodeURIComponent(txt)}">${t("send.mail")}</a>
      <button class="btn ghost" id="copy">${t("send.copy")}</button></div>`;
  }
  function sendBind() {
    document.getElementById("copy").onclick = async e => {
      try { await navigator.clipboard.writeText(DOWNLOAD); e.target.textContent = t("copied"); } catch {}
    };
  }

  // Скидки: витрина бота FunkyDiscount (чат Боты). Магазин не называем — только платформа и регион.
  async function loadDeals() {
    try { const r = await fetch(DEALS, { cache: "no-cache" }); if (r.ok) return await r.json(); } catch {}
    return null;
  }
  const money = (p, cur) => cur === "RUB" ? `${Math.round(p).toLocaleString("ru-RU")} ₽` : `$${Number(p).toFixed(2)}`;
  const date = s => s ? new Date(s).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { day: "numeric", month: "short" }) : "";
  function dealsView(d) {
    const soon = `<h1>${t("deals.title")}</h1><p class="muted">${t("deals.soon")}</p>
      <a class="btn" href="${DEALS_BOT}" target="_blank" rel="noopener">${t("deals.bot")}</a>`;
    if (!d || !Array.isArray(d.deals) || !d.deals.length) return soon;
    const cur = lang === "ru" ? "RUB" : "USD";
    const rows = d.deals.map(x => {
      const c = x.price && x.price[cur] != null ? cur : (x.price && x.price.RUB != null ? "RUB" : "USD");
      if (!x.price || x.price[c] == null) return "";
      return `<a class="deal" href="${esc(x.link || d.bot || DEALS_BOT)}" target="_blank" rel="noopener">
        ${x.image ? `<img loading="lazy" src="${esc(x.image)}" alt="" onerror="this.remove()">` : ""}
        <div class="deal-body"><b>${esc(x.title)}</b>
          <div class="row"><span><span class="price">${money(x.price[c], c)}</span>
            ${x.old_price && x.old_price[c] != null ? `<s class="muted small">${money(x.old_price[c], c)}</s>` : ""}</span>
            ${x.cut ? `<span class="badge">−${x.cut}%</span>` : ""}</div>
          <div class="muted small">${[x.platform ? t("platform." + x.platform) : "", esc(x["region_" + lang] || x.region_ru || "")].filter(Boolean).join(" · ")}${x.until ? ` · ${t("deals.until")} ${date(x.until)}` : ""}</div>
        </div></a>`;
    }).join("");
    return `<h1>${t("deals.title")}</h1>
      <div class="deals">${rows}</div>
      <a class="btn" href="${esc(d.bot || DEALS_BOT)}" target="_blank" rel="noopener">${t("deals.bot")}</a>
      <p class="muted small">${esc(d["note_" + lang] || d.note_ru || "")}${d.updated ? ` ${t("deals.updated")}: ${date(d.updated)}` : ""}</p>
      ${d.source ? `<p class="muted small">${t("deals.source")} <a href="${esc(d.source.url)}" target="_blank" rel="noopener">${esc(d.source.name)}</a></p>` : ""}`;
  }
  const wallsView = () => `<h1>${t("walls.title")}</h1><p class="muted">${t("walls.soon")}</p>`;

  // ---------- навигация ----------
  async function route() {
    const [path, qs] = (location.hash.slice(1) || "/").split("?");
    const q = new URLSearchParams(qs || "");
    const tab = path.startsWith("/pc") ? "pc" : path.startsWith("/deals") ? "deals" : path.startsWith("/walls") ? "walls" : "catalog";
    document.querySelectorAll("#tabs a").forEach(a => a.classList.toggle("on", a.dataset.tab === tab));
    const deep = path.startsWith("/m/") || path === "/send";
    backBtn.hidden = !deep || !!tg;
    if (tg) deep ? tg.BackButton.show() : tg.BackButton.hide();
    try {
      if (path.startsWith("/m/")) {
        const [ls, nw] = await Promise.all([loadCatalog(), loadNews()]);
        const m = ls.find(x => x.id === decodeURIComponent(path.slice(3)));
        view.innerHTML = m ? detailView(m, nw) : catalogView(ls);
      } else if (path === "/pc") { const ls = await loadCatalog(); view.innerHTML = pcView(ls, q); pcBind(ls); }
      else if (path === "/send") { view.innerHTML = sendView(); sendBind(); }
      else if (path === "/deals") view.innerHTML = dealsView(await loadDeals());
      else if (path === "/walls") view.innerHTML = wallsView();
      else view.innerHTML = catalogView(await loadCatalog());
    } catch { view.innerHTML = `<p class="note">${t("error")}</p>`; }
    window.scrollTo(0, 0);
  }
  function applyLang() {
    document.documentElement.lang = lang;
    langBtn.textContent = lang.toUpperCase();
    document.querySelectorAll("#tabs a").forEach(a => a.querySelector("span").textContent = t("tab." + a.dataset.tab));
  }
  langBtn.onclick = () => { lang = lang === "ru" ? "en" : "ru"; store.set("lang", lang); applyLang(); route(); };
  const goBack = () => history.length > 1 ? history.back() : (location.hash = "#/");
  backBtn.onclick = goBack;

  if (tg) {
    tg.ready(); tg.expand();
    document.body.classList.add("tg");
    tg.BackButton.onClick(goBack);
  }
  applyLang();
  window.addEventListener("hashchange", route);
  route();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
