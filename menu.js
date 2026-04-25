// ── DOM ──────────────────────────────────────────────────
const theMenu             = document.getElementById("menu");
const categoriesContainer = document.getElementById("categories");
const cartButton          = document.getElementById("cart-button");
const cartModal           = document.getElementById("cart-modal");
const cartItemsContainer  = document.getElementById("cart-items");
const closeCartButton     = document.getElementById("close-cart");
const totalDisplay        = document.getElementById("total-display");
const cartCountEl         = document.getElementById("cart-count");

let cart        = [];
let allProducts = [];
let allCats     = [];
let activeCatId = 0;
let searchQuery = "";

// ── VISITS COUNTER ───────────────────────────────────────
function trackVisit() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const visits = JSON.parse(localStorage.getItem("ec_visits") || "{}");
    visits[today] = (visits[today] || 0) + 1;
    visits._total = (visits._total || 0) + 1;
    localStorage.setItem("ec_visits", JSON.stringify(visits));
  } catch {}
}

function getVisits() {
  try { return JSON.parse(localStorage.getItem("ec_visits") || "{}"); }
  catch { return {}; }
}

// ── POPULARITY ───────────────────────────────────────────
function getPopularity() {
  try { return JSON.parse(localStorage.getItem("ec_popularity") || "{}"); }
  catch { return {}; }
}

function incrementPopularity(id) {
  const p = getPopularity();
  p[String(id)] = (p[String(id)] || 0) + 1;
  try { localStorage.setItem("ec_popularity", JSON.stringify(p)); } catch {}
}

function getTopIds(n = 5) {
  return Object.entries(getPopularity())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([id]) => String(id));
}

// ── HIGH DEMAND MESSAGE ──────────────────────────────────
function getHighDemand() {
  try { return JSON.parse(localStorage.getItem("ec_demand") || "{}"); }
  catch { return {}; }
}

function renderDemandBanner() {
  const existing = document.getElementById("demand-banner");
  const d = getHighDemand();
  if (!d.active) { existing?.remove(); return; }

  if (existing) return; // already shown
  const banner = document.createElement("div");
  banner.id = "demand-banner";
  banner.innerHTML = `⏱ ${d.message || "Alta demanda ahora — pedidos en ~50 min"}`;
  document.querySelector(".hero-banner")?.after(banner);
}

// ── SCHEDULE ─────────────────────────────────────────────
function getOpenStatus() {
  const now  = new Date();
  const day  = now.getDay();
  const time = now.getHours() + now.getMinutes() / 60;
  const isWeekend = day === 0 || day === 6;
  const open  = isWeekend ? 17 : 18;
  const close = isWeekend ? 24 : 23;
  const isOpen = time >= open && time < close;
  let minsLeft;
  if (isOpen) {
    minsLeft = Math.round((close - time) * 60);
  } else {
    const tomorrow = (day + 1) % 7;
    const tWeekend = tomorrow === 0 || tomorrow === 6;
    const nextOpen = tWeekend ? 17 : 18;
    minsLeft = time < open
      ? Math.round((open - time) * 60)
      : Math.round((24 - time + nextOpen) * 60);
  }
  return { isOpen, minsLeft };
}

const SCHEDULE_DAYS = [
  { label: "Lunes",     open: "6:00 PM", close: "11:00 PM" },
  { label: "Martes",    open: "6:00 PM", close: "11:00 PM" },
  { label: "Miércoles", open: "6:00 PM", close: "11:00 PM" },
  { label: "Jueves",    open: "6:00 PM", close: "11:00 PM" },
  { label: "Viernes",   open: "6:00 PM", close: "11:00 PM" },
  { label: "Sábado",    open: "5:00 PM", close: "12:00 AM" },
  { label: "Domingo",   open: "5:00 PM", close: "12:00 AM" },
];

function renderBadge() {
  const badge = document.querySelector(".badge-open, .badge-abierto, .badge-cerrado");
  if (!badge) return;
  const { isOpen, minsLeft } = getOpenStatus();
  const h = Math.floor(minsLeft / 60);
  const m = minsLeft % 60;
  const timeStr = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
  badge.textContent = isOpen
    ? `● Abierto — cierra en ${timeStr}`
    : `● Cerrado — abre en ${timeStr}`;
  badge.className   = isOpen ? "badge-abierto" : "badge-cerrado";
  badge.title = "Ver horarios";
  badge.style.cursor = "pointer";
}

function initSchedulePopup() {
  document.addEventListener("click", e => {
    const badge = e.target.closest(".badge-abierto, .badge-cerrado, .badge-open");
    if (badge) { showScheduleModal(); return; }
    const modal = document.getElementById("schedule-modal");
    if (modal && !modal.querySelector(".schedule-box").contains(e.target)) modal.remove();
  });
}

function showScheduleModal() {
  document.getElementById("schedule-modal")?.remove();
  const today = new Date().getDay();
  const todayIdx = today === 0 ? 6 : today - 1;
  const rows = SCHEDULE_DAYS.map((d, i) => `
    <div class="sch-row${i === todayIdx ? " sch-today" : ""}">
      <span class="sch-day">${d.label}${i === todayIdx ? " <span class='sch-hoy'>hoy</span>" : ""}</span>
      <span class="sch-hours">${d.open} – ${d.close}</span>
    </div>`).join("");
  const div = document.createElement("div");
  div.id = "schedule-modal";
  div.innerHTML = `<div class="schedule-box">
    <div class="schedule-title">🕐 Horario de atención</div>
    ${rows}
    <button class="schedule-close" onclick="document.getElementById('schedule-modal').remove()">Cerrar</button>
  </div>`;
  document.body.appendChild(div);
}

function checkout() {
  const { isOpen } = getOpenStatus();
  if (!isOpen) { showClosedAlert(); return; }
  if (!cart.length) { showNotification("Tu carrito está vacío", "error"); return; }
  cartModal.classList.remove("show");
  document.getElementById("pedido-modal").style.display = "flex";
}

function showClosedAlert() {
  document.getElementById("closed-alert")?.remove();
  const now = new Date();
  const day = now.getDay();
  const todayIdx = day === 0 ? 6 : day - 1;
  const nextDay = SCHEDULE_DAYS[(todayIdx + 1) % 7];
  const div = document.createElement("div");
  div.id = "closed-alert";
  div.innerHTML = `<div class="closed-alert-box">
    <div class="closed-alert-icon">😴</div>
    <h3>¡Estamos cerrados!</h3>
    <p>En este momento no estamos recibiendo pedidos.</p>
    <p class="closed-next">Volvemos <strong>${nextDay.label}</strong> desde las <strong>${nextDay.open}</strong></p>
    <button onclick="document.getElementById('closed-alert').remove()">Entendido</button>
  </div>`;
  document.body.appendChild(div);
}

// ── SMART SEARCH ─────────────────────────────────────────
const searchAliases = [
  { terms: ["2 personas","dos personas","para dos","pareja","para 2"],
    keywords: ["dos personas","2 personas","doble","familiar","picada dos","para dos"] },
  { terms: ["3 personas","tres personas","para tres","para 3"],
    keywords: ["tres","3 personas","familiar","mediana"] },
  { terms: ["4 personas","cuatro","familia","para 4"],
    keywords: ["familiar","super familiar","cuatro","picada el cuñao","la master"] },
  { terms: ["1 persona","individual","personal","para uno","solo"],
    keywords: ["sencill","personal","porción","clásic"] },
  { terms: ["grande","gigante","super","mega"],
    keywords: ["super","mega","master","familiar","grande"] },
  { terms: ["pequeño","pequeña","mini","chico"],
    keywords: ["mini","sencill","personal","porción"] },
  { terms: ["pollo"],   keywords: ["pollo","pechuga"] },
  { terms: ["cerdo","lomo","puerco"], keywords: ["cerdo","lomo","chicharrón"] },
  { terms: ["mixto","variado","de todo","combinado"],
    keywords: ["mixto","mixta","especial","el cuñao","master"] },
  { terms: ["barato","económico"], keywords: ["sencill","personal","clásic"] },
];

function smartSearch(query, products) {
  if (!query) return products;
  const q = query.toLowerCase().trim();
  for (const alias of searchAliases) {
    if (alias.terms.some(t => q.includes(t) || t.includes(q))) {
      const matched = products.filter(p => {
        const text = `${p.nombre} ${p.descripcion || ""}`.toLowerCase();
        return alias.keywords.some(kw => text.includes(kw));
      });
      if (matched.length) return matched;
    }
  }
  return products.filter(p => {
    const text = `${p.nombre} ${p.descripcion || ""}`.toLowerCase();
    return q.split(/\s+/).every(word => text.includes(word));
  });
}

// ── EMOJIS ───────────────────────────────────────────────
const catEmojis = {
  "Salchipapas":"🍟","Perros Calientes":"🌭","Hamburguesas":"🍔",
  "Desgranados":"🌽","Patacones Rellenos":"🫓",
  "Arepas Picadas y Chuzos":"🫔","Pizzas":"🍕",
  "Picadas":"🥩","Asados":"🔥","Bebidas":"🥤"
};
const getEmoji   = name => catEmojis[name] || "🍽️";
const getCatName = id   => (allCats.find(c => c.id === id) || {}).nombre || "";

// ── LOAD ─────────────────────────────────────────────────
function loadCategories() {
  Promise.all([
    fetch("categorias.json").then(r => r.json()),
    fetch("productos.json").then(r => r.json())
  ]).then(([cats, products]) => {
    allCats     = cats;
    allProducts = products;
    buildCategories();
    renderAll();
    renderBadge();
    renderDemandBanner();
    setInterval(renderBadge, 60000);
  });
}

function buildCategories() {
  const counts = {};
  allProducts.forEach(p => { counts[p.categoria_id] = (counts[p.categoria_id] || 0) + 1; });
  categoriesContainer.innerHTML = `
    <button class="category-btn active" data-id="0">
      ✨ Todos <span class="cat-count">${allProducts.length}</span>
    </button>`;
  allCats.forEach(cat => {
    const btn = document.createElement("button");
    btn.className  = "category-btn";
    btn.dataset.id = cat.id;
    btn.innerHTML  = `${getEmoji(cat.nombre)} ${cat.nombre} <span class="cat-count">${counts[cat.id] || 0}</span>`;
    categoriesContainer.appendChild(btn);
  });
  categoriesContainer.addEventListener("click", e => {
    const btn = e.target.closest(".category-btn");
    if (!btn) return;
    document.querySelectorAll(".category-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeCatId = parseInt(btn.dataset.id);
    const si = document.getElementById("search-input");
    const sc = document.getElementById("search-clear");
    if (si) { si.value = ""; searchQuery = ""; }
    if (sc) sc.style.display = "none";
    renderAll();
    // Share: update URL with category
    const url = new URL(window.location);
    if (activeCatId > 0) url.searchParams.set("cat", activeCatId);
    else url.searchParams.delete("cat");
    history.replaceState(null, "", url);
  });
}

// ── RENDER ───────────────────────────────────────────────
function renderAll() {
  theMenu.innerHTML = "";
  let pool = activeCatId > 0
    ? allProducts.filter(p => p.categoria_id === activeCatId)
    : [...allProducts];
  if (searchQuery) pool = smartSearch(searchQuery, pool);

  if (!searchQuery && activeCatId === 0) {
    const topIds = getTopIds(5);
    if (topIds.length) {
      const topProducts = topIds.map(id => allProducts.find(p => String(p.id) === id)).filter(Boolean);
      theMenu.style.display = "block";
      appendSection("🔥 Lo más pedido", topProducts, true);
      appendSection("Todo el menú", pool, false);
      setLabel("Todo el menú", pool.length);
      return;
    }
  }

  if (!searchQuery && activeCatId === 7) {
    theMenu.style.display = "block";
    renderPizzas(pool);
    setLabel("🍕 Pizzas", pool.length);
    return;
  }

  theMenu.style.display = "";
  const label = searchQuery
    ? `Resultados para "${searchQuery}"`
    : activeCatId > 0
      ? `${getEmoji(getCatName(activeCatId))} ${getCatName(activeCatId)}`
      : "Todo el menú";
  setLabel(label, pool.length);

  if (!pool.length) {
    theMenu.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>Sin resultados</p><small>Intenta con otro término</small></div>`;
    return;
  }
  pool.forEach(p => theMenu.appendChild(buildCard(p)));
}

// ── PIZZAS ───────────────────────────────────────────────
const PIZZA_SIZES_ORDER = [
  { label: "Porción",        porciones: "1 porción"    },
  { label: "Personal",       porciones: "4 porciones"  },
  { label: "Mediana",        porciones: "6 porciones"  },
  { label: "Familiar",       porciones: "8 porciones"  },
  { label: "Super Familiar", porciones: "12 porciones" },
];

function renderPizzas(pool) {
  theMenu.innerHTML = "";
  const flavors = pool.filter(p => p.sabor && p.tamaños);
  const others  = pool.filter(p => !p.sabor || !p.tamaños);
  PIZZA_SIZES_ORDER.forEach(size => {
    const sabores = flavors.map(pizza => {
      const tam = pizza.tamaños.find(t => t.label === size.label);
      return tam ? { pizza, tam } : null;
    }).filter(Boolean);
    if (!sabores.length) return;
    theMenu.appendChild(buildSizeAccordion(size, sabores));
  });
  others.forEach(p => theMenu.appendChild(buildCard(p)));
}

function buildSizeAccordion(size, sabores) {
  const minPrice = Math.min(...sabores.map(s => s.tam.precio));
  const wrap = document.createElement("div");
  wrap.className = "pizza-card";
  const saboresHTML = sabores.map(({ pizza, tam }) => `
    <div class="pizza-size-row">
      <div class="pizza-size-info">
        <span class="pizza-size-label">${pizza.nombre}</span>
        <span class="pizza-size-porciones">${pizza.descripcion || ""}</span>
      </div>
      <div class="pizza-size-actions">
        <span class="pizza-size-price">$${parseInt(tam.precio).toLocaleString("es-CO")}</span>
        <button class="add-btn add-btn-sm" onclick="addToCart('${tam.id}','🍕 ${pizza.nombre} (${size.label})',${tam.precio},'🍕')">+</button>
      </div>
    </div>`).join("");
  wrap.innerHTML = `
    <div class="pizza-header" onclick="togglePizza(this)">
      <div class="pizza-header-left">
        <span class="pizza-emoji">🍕</span>
        <div>
          <div class="pizza-name">${size.label}</div>
          <div class="pizza-desc">${size.porciones} · ${sabores.length} sabores</div>
        </div>
      </div>
      <div class="pizza-header-right">
        <span class="pizza-from">desde $${parseInt(minPrice).toLocaleString("es-CO")}</span>
        <span class="pizza-chevron">▾</span>
      </div>
    </div>
    <div class="pizza-sizes" style="display:none">${saboresHTML}</div>`;
  return wrap;
}

function togglePizza(header) {
  const sizes   = header.nextElementSibling;
  const chevron = header.querySelector(".pizza-chevron");
  const isOpen  = sizes.style.display !== "none";
  sizes.style.display     = isOpen ? "none" : "block";
  chevron.style.transform = isOpen ? "rotate(0deg)" : "rotate(180deg)";
}

function appendSection(title, products, isTop) {
  if (!products.length) return;
  const wrap = document.createElement("div");
  wrap.className = "menu-section";
  wrap.innerHTML = `<div class="menu-section-title${isTop ? " top" : ""}">
    ${title} <span class="section-sub">${products.length} producto${products.length !== 1 ? "s" : ""}</span>
  </div>`;
  const grid = document.createElement("div");
  grid.className = "menu-grid";
  products.forEach(p => grid.appendChild(buildCard(p, isTop)));
  wrap.appendChild(grid);
  theMenu.appendChild(wrap);
}

function setLabel(label, count) {
  const sl = document.getElementById("section-label");
  const sc = document.getElementById("section-count");
  if (sl) sl.textContent = label;
  if (sc) sc.textContent = count ? `${count} producto${count !== 1 ? "s" : ""}` : "";
}

// ── BUILD CARD ───────────────────────────────────────────
function buildCard(product, highlight = false) {
  const card    = document.createElement("div");
  card.className = "menu-item" + (highlight ? " menu-item-highlight" : "");
  const catName = getCatName(product.categoria_id);
  const emoji   = getEmoji(catName);
  const imgSrc  = product.imagen && product.imagen !== "default.jpg"
    ? `img/${product.imagen}` : null;
  const imgHTML = imgSrc
    ? `<img src="${imgSrc}" alt="${product.nombre}" onerror="this.parentElement.innerHTML='<div class=\\"img-placeholder\\">${emoji}</div>'">`
    : `<div class="img-placeholder">${emoji}</div>`;
  const safeId   = String(product.id).replace(/'/g, "");
  const safeName = product.nombre.replace(/'/g, "\\'");

  // Badges: nuevo o destacado
  const badgeHTML = product.nuevo
    ? `<span class="item-badge badge-new">🆕 Nuevo</span>`
    : product.destacado
      ? `<span class="item-badge badge-featured">⭐ Destacado</span>`
      : "";

  // Share button for this product
  const shareHTML = `<button class="share-btn" title="Compartir" onclick="shareProduct(event,'${safeId}','${safeName}')">🔗</button>`;

  card.innerHTML = `
    <div class="menu-item-img-wrap">${imgHTML}</div>
    <div class="menu-item-body">
      <div class="item-top-row">
        <span class="item-category-tag">${catName}</span>
        ${badgeHTML}
        ${shareHTML}
      </div>
      <h5>${product.nombre}</h5>
      <p>${product.descripcion || ""}</p>
      <div class="menu-item-footer">
        <div class="price"><span class="price-prefix">$</span>${parseInt(product.precio).toLocaleString("es-CO")}</div>
        <button class="add-btn" onclick="openNoteModal('${safeId}','${safeName}',${product.precio},'${emoji}')">+</button>
      </div>
    </div>`;
  return card;
}

// ── PRODUCT NOTE MODAL ───────────────────────────────────
function openNoteModal(id, name, price, emoji) {
  document.getElementById("note-modal")?.remove();
  const div = document.createElement("div");
  div.id = "note-modal";
  div.innerHTML = `
    <div class="note-modal-box">
      <div class="note-modal-header">
        <span style="font-size:28px">${emoji}</span>
        <div>
          <div class="note-modal-name">${name}</div>
          <div class="note-modal-price">$${parseInt(price).toLocaleString("es-CO")}</div>
        </div>
        <button class="close-modal-btn" onclick="document.getElementById('note-modal').remove()">✕</button>
      </div>
      <label class="note-label">¿Alguna personalización?</label>
      <textarea id="note-input" placeholder="Ej: sin cebolla, término medio, sin salsa..." rows="3"></textarea>
      <div class="note-modal-actions">
        <button class="btn-enviar" onclick="addToCartWithNote('${id}','${name}',${price},'${emoji}')">Agregar al carrito</button>
        <button class="btn-cancelar" onclick="document.getElementById('note-modal').remove()">Cancelar</button>
      </div>
    </div>`;
  document.body.appendChild(div);
  setTimeout(() => div.querySelector("textarea")?.focus(), 50);
}

function addToCartWithNote(id, name, price, emoji) {
  const note = document.getElementById("note-input")?.value.trim();
  document.getElementById("note-modal")?.remove();
  const displayName = note ? `${name} (${note})` : name;
  addToCart(id, displayName, price, emoji);
}

// ── SHARE ─────────────────────────────────────────────────
function shareProduct(e, id, name) {
  e.stopPropagation();
  const catId = allProducts.find(p => String(p.id) === String(id))?.categoria_id;
  const url = new URL(window.location.href.split("?")[0]);
  if (catId) url.searchParams.set("cat", catId);
  const shareUrl = url.toString();
  if (navigator.share) {
    navigator.share({ title: `El Cuñao — ${name}`, url: shareUrl });
  } else {
    navigator.clipboard.writeText(shareUrl).then(() => {
      showNotification("¡Link copiado! 🔗", "success");
    });
  }
}

function shareCategory() {
  const url = new URL(window.location.href);
  if (navigator.share) {
    const catName = activeCatId > 0 ? getCatName(activeCatId) : "Menú";
    navigator.share({ title: `El Cuñao — ${catName}`, url: url.toString() });
  } else {
    navigator.clipboard.writeText(url.toString()).then(() => {
      showNotification("¡Link copiado! 🔗", "success");
    });
  }
}

// ── LIGHT/DARK MODE ──────────────────────────────────────
function initThemeToggle() {
  const saved = localStorage.getItem("ec_theme") || "dark";
  applyTheme(saved);

  const btn = document.createElement("button");
  btn.id = "theme-toggle";
  btn.title = "Cambiar tema";
  btn.textContent = saved === "dark" ? "☀️" : "🌙";
  btn.onclick = () => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    localStorage.setItem("ec_theme", next);
    btn.textContent = next === "dark" ? "☀️" : "🌙";
  };
  document.querySelector(".header-inner")?.appendChild(btn);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

// ── CART ─────────────────────────────────────────────────
function addToCart(id, name, price, emoji) {
  id = String(id);
  incrementPopularity(id);
  const existing = cart.find(i => i.id === id && i.name === name);
  if (existing) existing.quantity++;
  else cart.push({ id, name, price, emoji: emoji || "🍽️", quantity: 1 });
  updateCart();
  showNotification(`Agregado ✓`, "success");
  if (!searchQuery && activeCatId === 0) renderAll();
}

function updateCart() {
  cartItemsContainer.innerHTML = "";
  let total = 0;
  if (!cart.length) {
    cartItemsContainer.innerHTML = `<div class="empty-state"><div class="empty-icon">🛒</div><p>Tu carrito está vacío</p></div>`;
  } else {
    cart.forEach(item => {
      const t = item.price * item.quantity;
      total += t;
      const el = document.createElement("div");
      el.className = "cart-item";
      el.innerHTML = `
        <div class="cart-item-emoji">${item.emoji}</div>
        <div class="cart-item-details">
          <div class="name">${item.name}</div>
          <div class="item-price">$${parseInt(t).toLocaleString("es-CO")}</div>
        </div>
        <div class="cart-controls">
          <button onclick="changeQty('${item.id}','${item.name}',-1)">−</button>
          <span>${item.quantity}</span>
          <button onclick="changeQty('${item.id}','${item.name}',1)">+</button>
        </div>
        <button class="remove-btn" onclick="removeFromCart('${item.id}','${item.name}')">✕</button>`;
      cartItemsContainer.appendChild(el);
    });
  }
  totalDisplay.textContent = "$" + total.toLocaleString("es-CO");
  const count = cart.reduce((s, i) => s + i.quantity, 0);
  if (cartCountEl) cartCountEl.textContent = count;
  const cartLabel = document.getElementById("cart-label");
  if (cartLabel) cartLabel.textContent = count > 0 ? `Ver carrito (${count})` : "Ver carrito";
}

function changeQty(id, name, delta) {
  const item = cart.find(i => i.id === String(id) && i.name === name);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) removeFromCart(id, name, true);
  else updateCart();
}

function removeFromCart(id, name, silent = false) {
  cart = cart.filter(i => !(i.id === String(id) && i.name === name));
  updateCart();
  if (!silent) showNotification("Producto eliminado");
}

function enviarPedido() {
  const nombre     = document.getElementById("cliente-nombre").value.trim();
  const direccion  = document.getElementById("cliente-direccion").value.trim();
  const notas      = document.getElementById("cliente-notas").value.trim();
  const entrega    = document.getElementById("entrega").value;
  const metodoPago = document.getElementById("metodo-pago").value;
  if (!nombre) { showNotification("Por favor ingresa tu nombre", "error"); return; }
  if (entrega === "Domicilio" && !direccion) { showNotification("Por favor ingresa tu dirección", "error"); return; }
  let total = 0;
  let msg = `🍽️ *Pedido — El Cuñao*\n\n`;
  cart.forEach(item => {
    const t = item.price * item.quantity;
    total += t;
    msg += `• ${item.name} x${item.quantity} → $${parseInt(t).toLocaleString("es-CO")}\n`;
  });
  msg += `\n💰 *Subtotal: $${parseInt(total).toLocaleString("es-CO")}*`;
  if (entrega === "Domicilio") msg += `\n🛵 _El domicilio se cobra por separado_`;
  msg += `\n\n🧍 *Nombre:* ${nombre}`;
  if (entrega === "Domicilio") msg += `\n📍 *Dirección:* ${direccion}`;
  if (notas) msg += `\n📝 *Observaciones:* ${notas}`;
  msg += `\n📦 *Entrega:* ${entrega}`;
  msg += `\n💳 *Pago:* ${metodoPago}`;
  msg += `\n\n📎 _Adjunta el comprobante de pago._`;
  window.location.href = `https://wa.me/573206700691?text=${encodeURIComponent(msg)}`;
}

// ── SEARCH ───────────────────────────────────────────────
function initSearch() {
  const si = document.getElementById("search-input");
  const sc = document.getElementById("search-clear");
  if (!si) return;
  si.addEventListener("input", e => {
    searchQuery = e.target.value.trim();
    sc.style.display = searchQuery ? "block" : "none";
    if (searchQuery) {
      document.querySelectorAll(".category-btn").forEach(b => b.classList.remove("active"));
      const allBtn = categoriesContainer.querySelector('[data-id="0"]');
      if (allBtn) allBtn.classList.add("active");
      activeCatId = 0;
    }
    renderAll();
  });
  sc.addEventListener("click", () => {
    si.value = ""; searchQuery = ""; sc.style.display = "none";
    renderAll();
  });
}

// ── DELIVERY NOTICE ──────────────────────────────────────
function toggleDeliveryNotice() {
  const entrega = document.getElementById("entrega");
  const aviso   = document.getElementById("aviso-domicilio");
  const dirGrp  = document.getElementById("direccion-grupo");
  if (!entrega) return;
  const isDom = entrega.value === "Domicilio";
  if (aviso) aviso.classList.toggle("visible", isDom);
  if (dirGrp) dirGrp.style.display = isDom ? "flex" : "none";
}

// ── NOTIFICATIONS ─────────────────────────────────────────
function showNotification(msg, type = "success") {
  const n = document.createElement("div");
  n.className = `notification ${type}`;
  n.textContent = msg;
  document.body.appendChild(n);
  setTimeout(() => { n.classList.add("fade-out"); setTimeout(() => n.remove(), 350); }, 2000);
}

// ── DRAG SCROLL ──────────────────────────────────────────
function initDragScroll() {
  const wrapper = document.getElementById("categories-wrapper");
  if (!wrapper) return;
  let isDown = false, startX, scrollLeft;
  wrapper.addEventListener("mousedown", e => { isDown = true; startX = e.pageX - wrapper.offsetLeft; scrollLeft = wrapper.scrollLeft; });
  wrapper.addEventListener("mouseleave", () => { isDown = false; });
  wrapper.addEventListener("mouseup",    () => { isDown = false; });
  wrapper.addEventListener("mousemove",  e => {
    if (!isDown) return;
    e.preventDefault();
    wrapper.scrollLeft = scrollLeft - (e.pageX - wrapper.offsetLeft - startX);
  });
}

// ── DEEP LINK (open category from URL) ───────────────────
function applyDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const catId  = parseInt(params.get("cat") || "0");
  if (catId > 0) {
    activeCatId = catId;
    setTimeout(() => {
      const btn = categoriesContainer.querySelector(`[data-id="${catId}"]`);
      if (btn) {
        document.querySelectorAll(".category-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        btn.scrollIntoView({ behavior: "smooth", inline: "center" });
      }
      renderAll();
    }, 100);
  }
}

// ── ADMIN PANEL ──────────────────────────────────────────
function checkAdmin() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("admin") !== "1") return;
  renderAdminPanel();
}

function renderAdminPanel() {
  const visits    = getVisits();
  const pop       = getPopularity();
  const demand    = getHighDemand();
  const today     = new Date().toISOString().slice(0, 10);
  const todayV    = visits[today] || 0;
  const totalV    = visits._total || 0;

  // Top products with names
  const topProds = Object.entries(pop)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, count]) => {
      const p = allProducts.find(pr => String(pr.id) === id);
      return p ? `<div class="adm-row"><span>${p.nombre}</span><span class="adm-val">${count} veces</span></div>` : "";
    }).join("");

  const panel = document.createElement("div");
  panel.id = "admin-panel";
  panel.innerHTML = `
    <div class="adm-box">
      <div class="adm-header">
        <span>⚙️ Panel Admin</span>
        <button onclick="document.getElementById('admin-panel').remove()">✕</button>
      </div>

      <div class="adm-section">
        <div class="adm-title">📊 Visitas</div>
        <div class="adm-row"><span>Hoy</span><span class="adm-val">${todayV}</span></div>
        <div class="adm-row"><span>Total histórico</span><span class="adm-val">${totalV}</span></div>
      </div>

      <div class="adm-section">
        <div class="adm-title">🔥 Más pedidos</div>
        ${topProds || "<div class='adm-empty'>Aún sin datos</div>"}
      </div>

      <div class="adm-section">
        <div class="adm-title">⏱ Mensaje de alta demanda</div>
        <div class="adm-row">
          <span>Estado</span>
          <label class="adm-toggle">
            <input type="checkbox" id="demand-toggle" ${demand.active ? "checked" : ""} onchange="toggleDemand(this.checked)">
            <span class="adm-slider"></span>
          </label>
        </div>
        <input type="text" id="demand-msg" class="adm-input"
          value="${demand.message || "Alta demanda ahora — pedidos en ~50 min"}"
          placeholder="Mensaje de espera...">
        <button class="adm-btn" onclick="saveDemandMsg()">Guardar mensaje</button>
      </div>

      <div class="adm-section">
        <div class="adm-title">🔗 Compartir menú</div>
        <button class="adm-btn" onclick="shareCategory()">Copiar link de categoría activa</button>
      </div>

      <div class="adm-section">
        <button class="adm-btn adm-btn-danger" onclick="resetStats()">🗑 Resetear estadísticas</button>
      </div>
    </div>`;
  document.body.appendChild(panel);
}

function toggleDemand(active) {
  const d = getHighDemand();
  d.active = active;
  try { localStorage.setItem("ec_demand", JSON.stringify(d)); } catch {}
  renderDemandBanner();
}

function saveDemandMsg() {
  const msg = document.getElementById("demand-msg")?.value.trim();
  const d = getHighDemand();
  d.message = msg;
  try { localStorage.setItem("ec_demand", JSON.stringify(d)); } catch {}
  renderDemandBanner();
  showNotification("Mensaje guardado ✓", "success");
}

function resetStats() {
  if (!confirm("¿Resetear todas las estadísticas de visitas y popularidad?")) return;
  localStorage.removeItem("ec_visits");
  localStorage.removeItem("ec_popularity");
  document.getElementById("admin-panel")?.remove();
  renderAdminPanel();
  showNotification("Estadísticas reseteadas", "success");
}

// ── EXTRA STYLES ─────────────────────────────────────────
function injectStyles() {
  const s = document.createElement("style");
  s.textContent = `
    .badge-open { transition: background 0.3s, color 0.3s, border-color 0.3s; }

    /* ── Light mode ── */
    [data-theme="light"] {
      --bg: #f5f0e8; --bg2: #fffdf8; --bg3: #f0e8d8; --bg4: #e8dcc8;
      --text: #2a1f10; --muted: #7a6040; --faint: #c0a880; --cream: #1a1008;
      --border: rgba(160,110,40,0.2); --border-strong: rgba(160,110,40,0.4);
    }
    [data-theme="light"] .menu-item { background: #fff; }
    [data-theme="light"] #cart      { background: #fff; }
    [data-theme="light"] .pedido-modal-content { background: #fff; }
    [data-theme="light"] header     { background: rgba(245,240,232,0.95); }
    [data-theme="light"] #search-cat-wrapper { background: #fffdf8; }

    /* ── Theme toggle button ── */
    #theme-toggle {
      background: transparent; border: 1px solid var(--border);
      border-radius: 50%; width: 34px; height: 34px;
      cursor: pointer; font-size: 16px;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s; margin-left: auto;
    }
    #theme-toggle:hover { border-color: var(--gold-d); }

    /* ── Share button on card ── */
    .item-top-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .share-btn {
      margin-left: auto; background: transparent; border: none;
      cursor: pointer; font-size: 13px; opacity: 0.4;
      transition: opacity 0.2s; padding: 2px 4px;
    }
    .share-btn:hover { opacity: 1; }

    /* ── Product badges ── */
    .item-badge {
      font-size: 10px; font-weight: 600; padding: 2px 7px;
      border-radius: 100px; letter-spacing: 0.3px;
    }
    .badge-new      { background: rgba(76,175,120,0.15); color: #4caf78; border: 1px solid rgba(76,175,120,0.3); }
    .badge-featured { background: rgba(212,169,66,0.15); color: var(--gold); border: 1px solid var(--gold-sm); }

    /* ── Note modal ── */
    #note-modal {
      position: fixed; inset: 0; background: rgba(0,0,0,0.65);
      display: flex; align-items: center; justify-content: center;
      z-index: 600; padding: 16px; animation: nIn 0.2s ease;
    }
    .note-modal-box {
      background: var(--bg2); border: 1px solid var(--border);
      border-radius: var(--radius-lg); padding: 22px;
      width: 100%; max-width: 400px;
      display: flex; flex-direction: column; gap: 12px;
    }
    .note-modal-header { display: flex; align-items: center; gap: 12px; }
    .note-modal-name   { font-size: 15px; font-weight: 600; color: var(--cream); }
    .note-modal-price  { font-size: 13px; color: var(--gold); }
    .note-modal-header .close-modal-btn { margin-left: auto; }
    .note-label { font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.8px; }
    #note-input {
      background: var(--bg3); border: 1px solid var(--border);
      border-radius: var(--radius-sm); color: var(--text);
      font-family: 'DM Sans', sans-serif; font-size: 14px;
      padding: 10px 12px; resize: vertical; outline: none;
      transition: border-color 0.2s;
    }
    #note-input:focus { border-color: var(--gold-d); }
    #note-input::placeholder { color: var(--faint); }
    .note-modal-actions { display: flex; flex-direction: column; gap: 8px; }

    /* ── Demand banner ── */
    #demand-banner {
      background: rgba(212,169,66,0.12); border-top: 1px solid var(--gold-sm);
      border-bottom: 1px solid var(--gold-sm);
      color: var(--gold); text-align: center;
      padding: 8px 16px; font-size: 13px; font-weight: 500;
    }

    /* ── Admin panel ── */
    #admin-panel {
      position: fixed; top: 0; right: 0; height: 100%;
      width: 100%; max-width: 360px;
      background: var(--bg2); border-left: 1px solid var(--border);
      z-index: 700; overflow-y: auto; animation: slideInRight 0.3s ease;
      box-shadow: -4px 0 20px rgba(0,0,0,0.4);
    }
    @keyframes slideInRight {
      from { transform: translateX(100%); }
      to   { transform: translateX(0); }
    }
    .adm-box { padding: 20px; display: flex; flex-direction: column; gap: 20px; }
    .adm-header {
      display: flex; justify-content: space-between; align-items: center;
      font-family: 'Playfair Display', serif; font-size: 18px; color: var(--gold);
    }
    .adm-header button {
      background: transparent; border: 1px solid var(--border);
      color: var(--muted); width: 30px; height: 30px;
      border-radius: 50%; cursor: pointer; font-size: 13px;
    }
    .adm-section {
      background: var(--bg3); border: 1px solid var(--border);
      border-radius: var(--radius-md); padding: 14px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .adm-title { font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 4px; }
    .adm-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--text); }
    .adm-val { font-weight: 600; color: var(--gold); }
    .adm-empty { font-size: 12px; color: var(--muted); font-style: italic; }
    .adm-input {
      background: var(--bg2); border: 1px solid var(--border);
      border-radius: var(--radius-sm); color: var(--text);
      font-family: 'DM Sans', sans-serif; font-size: 13px;
      padding: 8px 10px; width: 100%; outline: none;
    }
    .adm-btn {
      background: var(--gold); color: var(--bg); border: none;
      padding: 9px 14px; border-radius: var(--radius-sm);
      font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
      cursor: pointer; transition: background 0.2s; width: 100%;
    }
    .adm-btn:hover { background: var(--gold-l); }
    .adm-btn-danger { background: var(--red); color: white; }
    .adm-btn-danger:hover { background: var(--red-l); }

    /* Toggle switch */
    .adm-toggle { position: relative; display: inline-block; width: 42px; height: 22px; }
    .adm-toggle input { opacity: 0; width: 0; height: 0; }
    .adm-slider {
      position: absolute; inset: 0; background: var(--faint);
      border-radius: 22px; cursor: pointer; transition: 0.2s;
    }
    .adm-slider:before {
      content: ""; position: absolute;
      width: 16px; height: 16px; left: 3px; bottom: 3px;
      background: white; border-radius: 50%; transition: 0.2s;
    }
    .adm-toggle input:checked + .adm-slider { background: var(--green); }
    .adm-toggle input:checked + .adm-slider:before { transform: translateX(20px); }

    /* Menu section styles */
    .menu-section { margin-bottom: 30px; }
    .menu-section-title {
      font-family: 'Playfair Display', serif; font-size: 17px; font-weight: 700;
      color: var(--cream); margin-bottom: 12px;
      display: flex; align-items: baseline; gap: 10px;
      padding-bottom: 8px; border-bottom: 1px solid var(--border);
    }
    .menu-section-title.top { color: var(--gold); }
    .section-sub { font-family: 'DM Sans', sans-serif; font-size: 12px; color: var(--muted); font-weight: 300; }
    .menu-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
    .menu-item-highlight { border-color: rgba(212,169,66,0.35); }

    /* Badge styles */
    .badge-abierto {
      font-size: 11px; font-weight: 600; color: #4caf78;
      background: rgba(76,175,120,0.12); border: 1px solid rgba(76,175,120,0.25);
      padding: 4px 10px; border-radius: 100px; white-space: nowrap; letter-spacing: 0.3px;
    }
    .badge-cerrado {
      font-size: 11px; font-weight: 600; color: #e07070;
      background: rgba(176,64,64,0.12); border: 1px solid rgba(176,64,64,0.25);
      padding: 4px 10px; border-radius: 100px; white-space: nowrap; letter-spacing: 0.3px;
    }
    @media (max-width: 640px) {
      .menu-grid { grid-template-columns: 1fr; }
      #admin-panel { max-width: 100%; }
    }
  `;
  document.head.appendChild(s);
}

// ── INIT ─────────────────────────────────────────────────
cartButton.addEventListener("click", () => cartModal.classList.toggle("show"));
closeCartButton.addEventListener("click", () => cartModal.classList.remove("show"));
cartModal.addEventListener("click", e => { if (e.target === cartModal) cartModal.classList.remove("show"); });

window.addEventListener("DOMContentLoaded", () => {
  trackVisit();
  injectStyles();
  initThemeToggle();
  loadCategories();
  updateCart();
  initSearch();
  initDragScroll();
  initSchedulePopup();
  applyDeepLink();
  checkAdmin();
  const entregaEl = document.getElementById("entrega");
  if (entregaEl) {
    entregaEl.addEventListener("change", toggleDeliveryNotice);
    toggleDeliveryNotice();
  }
});