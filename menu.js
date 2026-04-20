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
  const p = getPopularity();
  return Object.entries(p)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([id]) => String(id));
}

// ── SCHEDULE ─────────────────────────────────────────────
// L–V: 18:00–23:00  |  S–D: 17:00–24:00
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
  { label: "Lunes",     open: "6:00 PM", close: "11:00 PM", weekend: false },
  { label: "Martes",    open: "6:00 PM", close: "11:00 PM", weekend: false },
  { label: "Miércoles", open: "6:00 PM", close: "11:00 PM", weekend: false },
  { label: "Jueves",    open: "6:00 PM", close: "11:00 PM", weekend: false },
  { label: "Viernes",   open: "6:00 PM", close: "11:00 PM", weekend: false },
  { label: "Sábado",    open: "5:00 PM", close: "12:00 AM", weekend: true  },
  { label: "Domingo",   open: "5:00 PM", close: "12:00 AM", weekend: true  },
];

function renderBadge() {
  const badge = document.querySelector(".badge-open, .badge-abierto, .badge-cerrado");
  if (!badge) return;
  const { isOpen, minsLeft } = getOpenStatus();
  const h = Math.floor(minsLeft / 60);
  const m = minsLeft % 60;
  const timeStr = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
  if (isOpen) {
    badge.textContent = `● Abierto — cierra en ${timeStr}`;
    badge.className   = "badge-abierto";
  } else {
    badge.textContent = `● Cerrado — abre en ${timeStr}`;
    badge.className   = "badge-cerrado";
  }
  badge.title = "Ver horarios";
  badge.style.cursor = "pointer";
}

// Horario popup al hacer click en el badge
function initSchedulePopup() {
  document.addEventListener("click", e => {
    const badge = e.target.closest(".badge-abierto, .badge-cerrado, .badge-open");
    if (badge) { showScheduleModal(); return; }
    // Cerrar si click fuera
    const modal = document.getElementById("schedule-modal");
    if (modal && !modal.querySelector(".schedule-box").contains(e.target)) {
      modal.remove();
    }
  });
}

function showScheduleModal() {
  document.getElementById("schedule-modal")?.remove();
  const today = new Date().getDay(); // 0=Dom,1=Lun...6=Sáb
  // Mapear JS day index a nuestro array (0=Lun...6=Dom)
  const todayIdx = today === 0 ? 6 : today - 1;

  const rows = SCHEDULE_DAYS.map((d, i) => {
    const isToday = i === todayIdx;
    return `<div class="sch-row${isToday ? " sch-today" : ""}">
      <span class="sch-day">${d.label}${isToday ? " <span class='sch-hoy'>hoy</span>" : ""}</span>
      <span class="sch-hours">${d.open} – ${d.close}</span>
    </div>`;
  }).join("");

  const div = document.createElement("div");
  div.id = "schedule-modal";
  div.innerHTML = `
    <div class="schedule-box">
      <div class="schedule-title">🕐 Horario de atención</div>
      ${rows}
      <button class="schedule-close" onclick="document.getElementById('schedule-modal').remove()">Cerrar</button>
    </div>`;
  document.body.appendChild(div);
}

// Bloquear pedido si está cerrado
function checkout() {
  const { isOpen } = getOpenStatus();
  if (!isOpen) {
    showClosedAlert();
    return;
  }
  if (!cart.length) { showNotification("Tu carrito está vacío", "error"); return; }
  cartModal.classList.remove("show");
  document.getElementById("pedido-modal").style.display = "flex";
}

function showClosedAlert() {
  document.getElementById("closed-alert")?.remove();
  const now = new Date();
  const day = now.getDay();
  const todayIdx = day === 0 ? 6 : day - 1;
  const nextDay  = SCHEDULE_DAYS[(todayIdx + 1) % 7];

  const div = document.createElement("div");
  div.id = "closed-alert";
  div.innerHTML = `
    <div class="closed-alert-box">
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
  { terms: ["2 personas", "dos personas", "para dos", "pareja", "para 2"],
    keywords: ["dos personas", "2 personas", "doble", "familiar", "picada dos", "para dos"] },
  { terms: ["3 personas", "tres personas", "para tres", "para 3"],
    keywords: ["tres", "3 personas", "familiar", "mediana"] },
  { terms: ["4 personas", "cuatro", "familia", "para 4"],
    keywords: ["familiar", "super familiar", "cuatro", "picada el cuñao", "la master"] },
  { terms: ["1 persona", "individual", "personal", "para uno", "solo"],
    keywords: ["sencill", "personal", "porción", "clásic"] },
  { terms: ["grande", "gigante", "super", "mega"],
    keywords: ["super", "mega", "master", "familiar", "grande"] },
  { terms: ["pequeño", "pequeña", "mini", "chico"],
    keywords: ["mini", "sencill", "personal", "porción"] },
  { terms: ["pollo"],   keywords: ["pollo", "pechuga"] },
  { terms: ["cerdo", "lomo", "puerco"], keywords: ["cerdo", "lomo", "chicharrón"] },
  { terms: ["mixto", "variado", "de todo", "combinado"],
    keywords: ["mixto", "mixta", "especial", "el cuñao", "master"] },
  { terms: ["barato", "económico"],
    keywords: ["sencill", "personal", "clásic"] },
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

  // Búsqueda directa por palabras
  return products.filter(p => {
    const text = `${p.nombre} ${p.descripcion || ""}`.toLowerCase();
    return q.split(/\s+/).every(word => text.includes(word));
  });
}

// ── EMOJIS ───────────────────────────────────────────────
const catEmojis = {
  "Salchipapas": "🍟", "Perros Calientes": "🌭", "Hamburguesas": "🍔",
  "Desgranados": "🌽", "Patacones Rellenos": "🫓",
  "Arepas Picadas y Chuzos": "🫔", "Pizzas": "🍕",
  "Picadas": "🥩", "Asados": "🔥", "Bebidas": "🥤"
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
    btn.className   = "category-btn";
    btn.dataset.id  = cat.id;
    btn.innerHTML   = `${getEmoji(cat.nombre)} ${cat.nombre} <span class="cat-count">${counts[cat.id] || 0}</span>`;
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
  });
}

// ── RENDER ───────────────────────────────────────────────
// Cuando hay secciones (#menu pasa a display:block con grids internos).
// Cuando no hay secciones, #menu vuelve a su grid CSS normal.
function renderAll() {
  theMenu.innerHTML = "";

  let pool = activeCatId > 0
    ? allProducts.filter(p => p.categoria_id === activeCatId)
    : [...allProducts];

  if (searchQuery) pool = smartSearch(searchQuery, pool);

  // Vista "Todos" sin búsqueda — puede mostrar sección popular
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

  // Pizzas: subcategorías por tamaño
  if (!searchQuery && activeCatId === 7) {
    theMenu.style.display = "block";
    renderPizzas(pool);
    setLabel("🍕 Pizzas", pool.length);
    return;
  }

  // Vista normal: grid directo
  theMenu.style.display = "";

  const label = searchQuery
    ? `Resultados para "${searchQuery}"`
    : activeCatId > 0
      ? `${getEmoji(getCatName(activeCatId))} ${getCatName(activeCatId)}`
      : "Todo el menú";

  setLabel(label, pool.length);

  if (!pool.length) {
    theMenu.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <p>Sin resultados</p>
        <small>Intenta con otro término</small>
      </div>`;
    return;
  }

  pool.forEach(p => theMenu.appendChild(buildCard(p)));
}

// ── PIZZAS — acordeón por tamaño, sabores dentro ────────
const PIZZA_SIZES_ORDER = [
  { label: "Porción",        key: "a", porciones: "1 porción"   },
  { label: "Personal",       key: "b", porciones: "4 porciones" },
  { label: "Mediana",        key: "c", porciones: "6 porciones" },
  { label: "Familiar",       key: "d", porciones: "8 porciones" },
  { label: "Super Familiar", key: "e", porciones: "12 porciones"},
];

function renderPizzas(pool) {
  theMenu.innerHTML = "";
  const flavors = pool.filter(p => p.sabor && p.tamaños);
  const others  = pool.filter(p => !p.sabor || !p.tamaños);

  PIZZA_SIZES_ORDER.forEach(size => {
    // Recopilar sabores disponibles en este tamaño
    const sabores = flavors.map(pizza => {
      const tam = pizza.tamaños.find(t => t.label === size.label);
      if (!tam) return null;
      return { pizza, tam };
    }).filter(Boolean);

    if (!sabores.length) return;
    theMenu.appendChild(buildSizeAccordion(size, sabores));
  });

  // Pizzas sin estructura de tamaños
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
          <div class="pizza-desc">${size.porciones} · ${sabores.length} sabor${sabores.length !== 1 ? "es" : ""}</div>
        </div>
      </div>
      <div class="pizza-header-right">
        <span class="pizza-from">desde $${parseInt(minPrice).toLocaleString("es-CO")}</span>
        <span class="pizza-chevron">▾</span>
      </div>
    </div>
    <div class="pizza-sizes" style="display:none">
      ${saboresHTML}
    </div>`;
  return wrap;
}

function togglePizza(header) {
  const sizes   = header.nextElementSibling;
  const chevron = header.querySelector(".pizza-chevron");
  const isOpen  = sizes.style.display !== "none";
  sizes.style.display    = isOpen ? "none" : "block";
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

  card.innerHTML = `
    <div class="menu-item-img-wrap">${imgHTML}</div>
    <div class="menu-item-body">
      <span class="item-category-tag">${catName}</span>
      <h5>${product.nombre}</h5>
      <p>${product.descripcion || ""}</p>
      <div class="menu-item-footer">
        <div class="price"><span class="price-prefix">$</span>${parseInt(product.precio).toLocaleString("es-CO")}</div>
        <button class="add-btn" onclick="addToCart('${safeId}','${safeName}',${product.precio},'${emoji}')">+</button>
      </div>
    </div>`;
  return card;
}

// ── CART ─────────────────────────────────────────────────
function addToCart(id, name, price, emoji) {
  id = String(id);
  incrementPopularity(id);
  const existing = cart.find(i => i.id === id);
  if (existing) existing.quantity++;
  else cart.push({ id, name, price, emoji: emoji || "🍽️", quantity: 1 });
  updateCart();
  showNotification(`${name} agregado ✓`, "success");
  // Refrescar sección popular si estamos en vista general
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
          <button onclick="changeQty('${item.id}',-1)">−</button>
          <span>${item.quantity}</span>
          <button onclick="changeQty('${item.id}',1)">+</button>
        </div>
        <button class="remove-btn" onclick="removeFromCart('${item.id}')">✕</button>`;
      cartItemsContainer.appendChild(el);
    });
  }

  totalDisplay.textContent = "$" + total.toLocaleString("es-CO");
  const count = cart.reduce((s, i) => s + i.quantity, 0);
  if (cartCountEl) cartCountEl.textContent = count;
  const cartLabel = document.getElementById("cart-label");
  if (cartLabel) cartLabel.textContent = count > 0 ? `Ver carrito (${count})` : "Ver carrito";
}

function changeQty(id, delta) {
  const item = cart.find(i => i.id === String(id));
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) removeFromCart(id, true);
  else updateCart();
}

function removeFromCart(id, silent = false) {
  cart = cart.filter(i => i.id !== String(id));
  updateCart();
  if (!silent) showNotification("Producto eliminado");
}

// ── CHECKOUT (defined in schedule section above) ─────────

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
  if (entrega === "Domicilio") msg += `\n🛵 _El domicilio se cobra por separado según tu ubicación_`;
  msg += `\n\n🧍 *Nombre:* ${nombre}`;
  if (entrega === "Domicilio") msg += `\n📍 *Dirección:* ${direccion}`;
  if (notas) msg += `\n📝 *Observaciones:* ${notas}`;
  msg += `\n📦 *Entrega:* ${entrega}`;
  msg += `\n💳 *Pago:* ${metodoPago}`;
  msg += `\n\n📎 _Adjunta el comprobante de pago._`;

  window.location.href = `https://wa.me/573204206795?text=${encodeURIComponent(msg)}`;
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

// ── EXTRA STYLES ─────────────────────────────────────────
// Solo estilos que no están en estilo.css
function injectStyles() {
  const s = document.createElement("style");
  s.textContent = `
    .badge-open { transition: background 0.3s, color 0.3s, border-color 0.3s; }
  `;
  document.head.appendChild(s);
}

// ── DRAG SCROLL (barra de categorías en desktop) ──────────
function initDragScroll() {
  const wrapper = document.getElementById("categories-wrapper");
  if (!wrapper) return;
  let isDown = false, startX, scrollLeft;
  wrapper.addEventListener("mousedown", e => {
    isDown = true;
    startX = e.pageX - wrapper.offsetLeft;
    scrollLeft = wrapper.scrollLeft;
  });
  wrapper.addEventListener("mouseleave", () => { isDown = false; });
  wrapper.addEventListener("mouseup",    () => { isDown = false; });
  wrapper.addEventListener("mousemove",  e => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - wrapper.offsetLeft;
    wrapper.scrollLeft = scrollLeft - (x - startX);
  });
}

// ── INIT ─────────────────────────────────────────────────
cartButton.addEventListener("click", () => cartModal.classList.toggle("show"));
closeCartButton.addEventListener("click", () => cartModal.classList.remove("show"));
cartModal.addEventListener("click", e => { if (e.target === cartModal) cartModal.classList.remove("show"); });

window.addEventListener("DOMContentLoaded", () => {
  injectStyles();
  loadCategories();
  updateCart();
  initSearch();
  initDragScroll();
  initSchedulePopup();
  const entregaEl = document.getElementById("entrega");
  if (entregaEl) {
    entregaEl.addEventListener("change", toggleDeliveryNotice);
    toggleDeliveryNotice();
  }
});