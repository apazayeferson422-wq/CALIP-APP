const cfg = window.CALIP_CONFIG || { SUPABASE_URL: "https://waojqithcqqlptgpwewa.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_0rh00NFY3ikJrxgX9RYXRg_rB-pMYzI" };

let sb = null;
let products = [];
let counts = [];
let stocks = [];
let selectedProduct = null;

const $ = (id) => document.getElementById(id);

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setStatus(text, type = "") {
  const el = $("status");
  if (!el) return;

  el.textContent = text;
  el.className = "connection " + type;
}

function getValue(obj, keys) {
  for (const key of keys) {
    if (
      obj &&
      obj[key] !== undefined &&
      obj[key] !== null &&
      String(obj[key]).trim() !== ""
    ) {
      return obj[key];
    }
  }
  return "";
}

function productCode(p) {
  return getValue(p, ["codigo", "cod", "id"]);
}

function productDescription(p) {
  return getValue(p, [
    "descripcion",
    "nombre",
    "desc_material",
    "producto",
    "description"
  ]);
}

function productLine(p) {
  return getValue(p, ["linea", "línea", "categoria", "categoría"]);
}

function showMessage(text, type = "error") {
  let box = $("message");

  if (!box) {
    box = document.createElement("div");
    box.id = "message";
    box.className = "message";
    const main = document.querySelector(".main-content") || document.body;
    main.prepend(box);
  }

  box.textContent = text;
  box.className =
    "message " + (type === "success" ? "message-success" : "message-error");

  setTimeout(() => {
    if (box) box.textContent = "";
  }, 5000);
}

function searchProducts() {
  const input = $("invSearch");
  const results = $("results");

  if (!input || !results) return;

  const text = input.value.trim().toLowerCase();

  if (!text) {
    results.innerHTML = "";
    return;
  }

  const found = products
    .filter((p) => {
      const code = String(productCode(p)).toLowerCase();
      const desc = String(productDescription(p)).toLowerCase();
      const line = String(productLine(p)).toLowerCase();

      return (
        code.includes(text) ||
        desc.includes(text) ||
        line.includes(text)
      );
    })
    .slice(0, 20);

  if (!found.length) {
    results.innerHTML =
      '<div class="selected-product">No se encontró ningún producto.</div>';
    return;
  }

  results.innerHTML = found
    .map(
      (p, index) => `
        <button
          type="button"
          class="product-result"
          data-index="${index}"
          style="
            display:block;
            width:100%;
            text-align:left;
            margin-top:6px;
            background:#fff;
            border:1px solid #dce5e1;
            color:#18212b;
          "
        >
          <strong>${esc(productCode(p))}</strong>
          — ${esc(productDescription(p))}
          ${
            productLine(p)
              ? `<small style="display:block;color:#68756f;margin-top:3px;">
                   Línea: ${esc(productLine(p))}
                 </small>`
              : ""
          }
        </button>
      `
    )
    .join("");

  results.querySelectorAll(".product-result").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.index);
      selectProduct(found[index]);
    });
  });
}

function selectProduct(product) {
  selectedProduct = product;

  const code = productCode(product);
  const desc = productDescription(product);
  const line = productLine(product);

  if ($("invSearch")) $("invSearch").value = code;

  if ($("selectedProduct")) {
    $("selectedProduct").innerHTML = `
      <strong>${esc(code)}</strong> — ${esc(desc)}
      ${line ? `<br><small>Línea: ${esc(line)}</small>` : ""}
    `;
  }

  if ($("results")) $("results").innerHTML = "";

  if ($("invQty")) {
    $("invQty").focus();
  }
}

async function loadProducts() {
  setStatus("Cargando productos...", "");

  const { data, error } = await sb
    .from("productos")
    .select("*");

  if (error) {
    console.error("Error productos:", error);
    setStatus("Error de conexión", "offline");
    showMessage("No se pudieron cargar los productos: " + error.message);
    return false;
  }

  products = Array.isArray(data) ? data : [];

  setStatus(
    `Conectado · ${products.length} productos`,
    "online"
  );

  console.log("Productos cargados:", products.length);

  return true;
}

async function loadCounts() {
  const { data, error } = await sb
    .from("lotes_conteo")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("Error conteos:", error);
    showMessage("Error al cargar conteos: " + error.message);
    counts = [];
    renderCounts();
    return;
  }

  counts = Array.isArray(data) ? data : [];
  renderCounts();
}

async function loadStocks() {
  const { data, error } = await sb
    .from("lotes_stock")
    .select("*")
    .limit(1000);

  if (error) {
    console.error("Error stock:", error);
    stocks = [];
    return;
  }

  stocks = Array.isArray(data) ? data : [];
  renderCounts();
}

function renderCounts() {
  const body = $("inventoryBody");

  if (!body) return;

  if (!counts.length) {
    body.innerHTML = `
      <tr>
        <td colspan="10" style="text-align:center;padding:25px;">
          No hay conteos registrados.
        </td>
      </tr>
    `;
    return;
  }

  body.innerHTML = counts
    .map((c) => {
      const code = getValue(c, ["codigo", "cod", "id"]);

      const desc = getValue(c, [
        "descripcion",
        "nombre",
        "desc_material"
      ]);

      const line = getValue(c, ["linea", "línea"]);

      const conteo = Number(
        getValue(c, ["cantidad", "conteo", "qty"]) || 0
      );

      // Buscar el producto correspondiente
      const product = products.find(
        (p) =>
          String(productCode(p)) === String(code)
      );

      // Stock teórico proveniente de la tabla productos
      const stock = product
        ? Number(product.stock_teorico || 0)
        : 0;

      // Diferencia = Conteo - Stock
      const diferencia = conteo - stock;

      const vencimiento =
        getValue(c, ["vencimiento"]) || "";

      const cajas =
        Number(getValue(c, ["cajas"]) || 0);

      const unidades =
        Number(getValue(c, ["unidades"]) || 0);

      const fecha =
        getValue(c, ["fecha", "fecha_conteo", "created_at"]) || "";

      return `
        <tr>
          <td>${esc(code)}</td>
          <td>${esc(desc)}</td>
          <td>${esc(line)}</td>
          <td>${esc(vencimiento)}</td>
          <td>${stock}</td>
          <td>${conteo}</td>
          <td>${diferencia}</td>
          <td>${cajas}</td>
          <td>${unidades}</td>
          <td>${esc(fecha)}</td>
        </tr>
      `;
    })
    .join("");
}

async function saveCount() {
  if (!selectedProduct) {
    showMessage("Selecciona un producto.");
    return;
  }

  const qtyValue = $("invQty")?.value;
  const boxesValue = $("invCajas")?.value || 0;
  const unitsValue = $("invUnidades")?.value || 0;
  const expiration = $("invVencimiento")?.value || null;

  if (qtyValue === "") {
    showMessage("Ingresa la cantidad contada.");
    $("invQty")?.focus();
    return;
  }

  const quantity = Number(qtyValue);
  const boxes = Number(boxesValue);
  const units = Number(unitsValue);

  if (Number.isNaN(quantity) || quantity < 0) {
    showMessage("La cantidad no es válida.");
    return;
  }

  const code = productCode(selectedProduct);
  const desc = productDescription(selectedProduct);
  const line = productLine(selectedProduct);

  const deviceId =
    localStorage.getItem("calip_device_id") ||
    "dev_" + crypto.randomUUID();

  localStorage.setItem("calip_device_id", deviceId);

  const row = {
    id: crypto.randomUUID(),
    codigo: String(code),
    descripcion: String(desc),
    linea: String(line || ""),
    cantidad: quantity,
    cajas: boxes,
    unidades: units,
    vencimiento: expiration,
    fecha: new Date().toISOString().slice(0, 10),
    usuario: "apazayeferson422",
    device_id: deviceId,
    version: 1,
    actualizado_en: new Date().toISOString()
  };

  const { error } = await sb
    .from("lotes_conteo")
    .insert(row);

  if (error) {
    console.error("Error guardando:", error);
    showMessage("No se pudo guardar: " + error.message);
    return;
  }

  showMessage("Conteo guardado correctamente.", "success");

  if ($("invQty")) $("invQty").value = "";
  if ($("invCajas")) $("invCajas").value = "0";
  if ($("invUnidades")) $("invUnidades").value = "0";
  if ($("invVencimiento")) $("invVencimiento").value = "";
  if ($("invSearch")) $("invSearch").value = "";

  if ($("selectedProduct")) {
    $("selectedProduct").innerHTML = "Selecciona un producto.";
  }

  if ($("results")) $("results").innerHTML = "";

  selectedProduct = null;

  await loadCounts();
}

async function init() {
  try {
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) {
      setStatus("Configuración faltante", "offline");
      showMessage("Falta la configuración de Supabase.");
      return;
    }

    if (!window.supabase || !window.supabase.createClient) {
      setStatus("Supabase no cargó", "offline");
      showMessage("No se pudo cargar la librería de Supabase.");
      return;
    }

    sb = window.supabase.createClient(
      cfg.SUPABASE_URL,
      cfg.SUPABASE_PUBLISHABLE_KEY
    );

    setStatus("Conectando...", "");

    const ok = await loadProducts();

    if (!ok) return;

    await loadCounts();
    await loadStocks();

  } catch (error) {
    console.error("Error inicializando CALIP:", error);
    setStatus("Error de conexión", "offline");
    showMessage("Error al iniciar CALIP: " + error.message);
  }
}

/* EVENTOS */
document.addEventListener("DOMContentLoaded", () => {
  $("invSearch")?.addEventListener("input", searchProducts);

  $("saveCount")?.addEventListener("click", saveCount);

  $("reload")?.addEventListener("click", async () => {
    await loadCounts();
    await loadStocks();
  });

  init();
});
