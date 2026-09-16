const cfg = window.CALIP_CONFIG || {};

const sb = window.supabase.createClient(
  cfg.SUPABASE_URL,
  cfg.SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage
    }
  }
);

const $ = id => document.getElementById(id);

let products = [];
let selectedProduct = null;
let counts = [];

function msg(id, text, ok = false) {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.style.color = ok ? "#17633f" : "#a12d35";
}

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}

function pick(o, ...keys) {
  for (const k of keys) {
    if (o && o[k] !== undefined && o[k] !== null && o[k] !== "") {
      return o[k];
    }
  }
  return "";
}

function usuarioAEmail(v) {
  const u = String(v || "").trim().toLowerCase();
  if (!u) return "";
  return u.includes("@") ? u : u + "@gmail.com";
}

function showOnly(id) {
  ["loginView", "recoveryView", "appView"].forEach(x => {
    const el = $(x);
    if (el) el.classList.add("hidden");
  });

  const target = $(id);
  if (target) target.classList.remove("hidden");
}

/* =========================
   INICIO
========================= */

async function init() {
  if (
    !cfg.SUPABASE_URL ||
    !cfg.SUPABASE_PUBLISHABLE_KEY
  ) {
    msg("loginMsg", "Falta configurar la conexión con Supabase.");
    return;
  }

  /*
    Si venimos de un correo de recuperación,
    mostramos directamente la pantalla de nueva contraseña.
  */
  const hash = window.location.hash || "";

  if (
    hash.includes("access_token=") &&
    (
      hash.includes("type=recovery") ||
      hash.includes("type%3Drecovery")
    )
  ) {
    showOnly("recoveryView");
  }

  const { data } = await sb.auth.getSession();

  if (data && data.session) {
    /*
      Si es una recuperación, no entrar todavía
      al sistema: primero cambiar contraseña.
    */
    if (
      hash.includes("type=recovery") ||
      hash.includes("type%3Drecovery")
    ) {
      showOnly("recoveryView");
    } else {
      enterApp(data.session.user);
    }
  }
}

/* =========================
   LOGIN
========================= */

async function login(e) {
  e.preventDefault();

  msg("loginMsg", "Ingresando...", true);

  const email = usuarioAEmail($("usuario").value);
  const password = $("password").value;

  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    msg(
      "loginMsg",
      "Usuario o contraseña incorrectos."
    );
    return;
  }

  enterApp(data.user);
}

/* =========================
   RECUPERAR CONTRASEÑA
========================= */

async function setNewPassword(e) {
  e.preventDefault();

  msg("recoveryMsg", "Guardando contraseña...", true);

  const password = $("newPassword").value;
  const password2 = $("newPassword2").value;

  if (password.length < 6) {
    msg(
      "recoveryMsg",
      "La contraseña debe tener al menos 6 caracteres."
    );
    return;
  }

  if (password !== password2) {
    msg(
      "recoveryMsg",
      "Las contraseñas no coinciden."
    );
    return;
  }

  const { data: sessionData } = await sb.auth.getSession();

  if (!sessionData || !sessionData.session) {
    msg(
      "recoveryMsg",
      "El enlace de recuperación no tiene una sesión válida. Solicita un nuevo enlace cuando Supabase permita enviarlo."
    );
    return;
  }

  const { error } = await sb.auth.updateUser({
    password
  });

  if (error) {
    msg(
      "recoveryMsg",
      "No se pudo cambiar la contraseña: " + error.message
    );
    return;
  }

  msg(
    "recoveryMsg",
    "Contraseña actualizada correctamente. Entrando a CALIP...",
    true
  );

  /*
    Limpiamos el enlace de recuperación
    para que no vuelva a abrir la pantalla.
  */
  window.history.replaceState(
    {},
    document.title,
    window.location.pathname + window.location.search
  );

  setTimeout(async () => {
    const { data } = await sb.auth.getUser();

    if (data && data.user) {
      enterApp(data.user);
    } else {
      showOnly("loginView");
    }
  }, 800);
}

/* =========================
   ENTRAR AL SISTEMA
========================= */

function enterApp(user) {
  showOnly("appView");

  if ($("sessionUser")) {
    $("sessionUser").textContent = user?.email || "";
  }

  loadProducts();
  loadCounts();
}

/* =========================
   CERRAR SESIÓN
========================= */

async function logout() {
  await sb.auth.signOut();
  showOnly("loginView");
}

/* =========================
   PRODUCTOS
========================= */

async function loadProducts() {
  msg("productsMsg", "Cargando productos...", true);

  const { data, error } = await sb
    .from("productos")
    .select("*");

  if (error) {
    msg(
      "productsMsg",
      "No se pudieron cargar productos: " + error.message
    );
    return;
  }

  products = data || [];

  renderProducts();

  msg(
    "productsMsg",
    `${products.length} productos cargados correctamente.`,
    true
  );
}

function renderProducts() {
  const search = String(
    $("productSearch")?.value || ""
  ).trim().toLowerCase();

  const rows = products
    .filter(p =>
      JSON.stringify(p)
        .toLowerCase()
        .includes(search)
    )
    .slice(0, 500);

  if (!$("productsBody")) return;

  $("productsBody").innerHTML = rows.map(p => `
    <tr>
      <td>${esc(pick(p, "codigo", "cod", "id"))}</td>
      <td>${esc(pick(p, "descripcion", "nombre", "desc_material"))}</td>
      <td>${esc(pick(p, "codigo_fabrica", "cod_fabrica", "codigo_factory"))}</td>
      <td>${esc(pick(p, "um", "unidad_medida"))}</td>
    </tr>
  `).join("");
}

/* =========================
   BUSCAR PRODUCTO INVENTARIO
========================= */

function searchInventoryProduct() {
  const q = String(
    $("invSearch")?.value || ""
  ).trim().toLowerCase();

  if (!q) {
    selectedProduct = null;

    if ($("selectedProduct")) {
      $("selectedProduct").innerHTML =
        "Busca un producto por código o descripción.";
    }

    return;
  }

  selectedProduct = products.find(p =>
    JSON.stringify(p)
      .toLowerCase()
      .includes(q)
  );

  if (!selectedProduct) {
    if ($("selectedProduct")) {
      $("selectedProduct").innerHTML =
        "<span>No se encontró el producto.</span>";
    }

    return;
  }

  const codigo = pick(
    selectedProduct,
    "codigo",
    "cod",
    "id"
  );

  const descripcion = pick(
    selectedProduct,
    "descripcion",
    "nombre",
    "desc_material"
  );

  const linea = pick(
    selectedProduct,
    "linea",
    "línea"
  );

  if ($("selectedProduct")) {
    $("selectedProduct").innerHTML = `
      <strong>${esc(codigo)}</strong> —
      ${esc(descripcion)}
      ${linea ? `<br><small>${esc(linea)}</small>` : ""}
    `;
  }
}

/* =========================
   GUARDAR CONTEO REAL
========================= */

async function saveCount() {
  if (!selectedProduct) {
    searchInventoryProduct();
  }

  if (!selectedProduct) {
    msg(
      "inventoryMsg",
      "Primero busca y selecciona un producto."
    );
    return;
  }

  const cantidadValue = $("invQty")?.value || "";
  const cajasValue = $("invCajas")?.value || "0";
  const unidadesValue = $("invUnidades")?.value || "0";
  const vencimientoValue = $("invVencimiento")?.value || "";

  if (cantidadValue === "") {
    msg(
      "inventoryMsg",
      "Ingresa la cantidad contada."
    );
    return;
  }

  if (!vencimientoValue) {
    msg(
      "inventoryMsg",
      "Ingresa la fecha de vencimiento."
    );
    return;
  }

  const codigo = String(
    pick(selectedProduct, "codigo", "cod", "id")
  );

  const descripcion = String(
    pick(
      selectedProduct,
      "descripcion",
      "nombre",
      "desc_material"
    )
  );

  const linea = String(
    pick(selectedProduct, "linea", "línea")
  );

  const cantidad = Number(cantidadValue);
  const cajas = Number(cajasValue || 0);
  const unidades = Number(unidadesValue || 0);

  const fecha = new Date()
    .toISOString()
    .slice(0, 10);

  /*
    ID único del registro.
  */
  const id =
    codigo +
    "_" +
    vencimientoValue +
    "_" +
    Date.now();

  msg(
    "inventoryMsg",
    "Guardando en Supabase...",
    true
  );

  const { error } = await sb
    .from("lotes_conteo")
    .insert({
      id,
      codigo,
      descripcion,
      linea,
      cantidad,
      cajas,
      unidades,
      vencimiento: vencimientoValue,
      fecha,
      usuario: usuarioActual()
    });

  if (error) {
    msg(
      "inventoryMsg",
      "No se pudo guardar: " + error.message
    );
    return;
  }

  msg(
    "inventoryMsg",
    "✓ Conteo guardado correctamente en Supabase.",
    true
  );

  limpiarFormulario();
  await loadCounts();
}

/* =========================
   USUARIO ACTUAL
========================= */

function usuarioActual() {
  const email =
    $("sessionUser")?.textContent || "";

  if (email.includes("@")) {
    return email.split("@")[0];
  }

  return email;
}

/* =========================
   LEER CONTEOS DE SUPABASE
========================= */

async function loadCounts() {
  if (!$("inventoryBody")) return;

  const { data, error } = await sb
    .from("lotes_conteo")
    .select("*")
    .order("created_at", {
      ascending: false
    })
    .limit(500);

  if (error) {
    msg(
      "inventoryMsg",
      "No se pudieron cargar los conteos: " +
      error.message
    );
    return;
  }

  counts = data || [];

  renderCounts();
}

/* =========================
   MOSTRAR CONTEOS
========================= */

function renderCounts() {
  if (!$("inventoryBody")) return;

  $("inventoryBody").innerHTML = counts.map(x => `
    <tr>
      <td>${esc(x.codigo)}</td>
      <td>${esc(x.descripcion)}</td>
      <td>${esc(x.linea)}</td>
      <td>${esc(x.cantidad)}</td>
      <td>${esc(x.cajas)}</td>
      <td>${esc(x.unidades)}</td>
      <td>${esc(x.vencimiento)}</td>
      <td>${esc(x.fecha)}</td>
      <td>${esc(x.usuario)}</td>
    </tr>
  `).join("");
}

/* =========================
   LIMPIAR FORMULARIO
========================= */

function limpiarFormulario() {
  selectedProduct = null;

  if ($("invSearch")) $("invSearch").value = "";
  if ($("invQty")) $("invQty").value = "";
  if ($("invCajas")) $("invCajas").value = "0";
  if ($("invUnidades")) $("invUnidades").value = "0";
  if ($("invVencimiento")) $("invVencimiento").value = "";

  if ($("selectedProduct")) {
    $("selectedProduct").textContent =
      "Busca un producto por código o descripción.";
  }
}

/* =========================
   AUTENTICACIÓN
========================= */

sb.auth.onAuthStateChange((event, session) => {

  if (event === "PASSWORD_RECOVERY") {
    showOnly("recoveryView");
    return;
  }

  if (event === "SIGNED_OUT") {
    showOnly("loginView");
    return;
  }

  if (
    event === "SIGNED_IN" &&
    session
  ) {
    const hash = window.location.hash || "";

    if (
      hash.includes("type=recovery") ||
      hash.includes("type%3Drecovery")
    ) {
      showOnly("recoveryView");
      return;
    }

    enterApp(session.user);
  }
});

/* =========================
   EVENTOS
========================= */

document.addEventListener("DOMContentLoaded", () => {

  $("loginForm")?.addEventListener(
    "submit",
    login
  );

  $("recoveryForm")?.addEventListener(
    "submit",
    setNewPassword
  );

  $("logoutBtn")?.addEventListener(
    "click",
    logout
  );

  $("reloadProducts")?.addEventListener(
    "click",
    loadProducts
  );

  $("productSearch")?.addEventListener(
    "input",
    renderProducts
  );

  $("invSearch")?.addEventListener(
    "input",
    searchInventoryProduct
  );

  $("saveCount")?.addEventListener(
    "click",
    saveCount
  );

  document
    .querySelectorAll(".tab")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          document
            .querySelectorAll(".tab")
            .forEach(x =>
              x.classList.remove("active")
            );

          button.classList.add("active");

          document
            .querySelectorAll(".section")
            .forEach(x =>
              x.classList.add("hidden")
            );

          const section =
            $(button.dataset.section);

          if (section) {
            section.classList.remove("hidden");
          }
        }
      );
    });

  document
    .querySelectorAll("[data-go]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const target =
            document.querySelector(
              `[data-section="${button.dataset.go}"]`
            );

          if (target) {
            target.click();
          }
        }
      );
    });

  init();
});
