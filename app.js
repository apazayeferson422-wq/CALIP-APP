const cfg=window.CALIP_CONFIG||{};
const sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storage:window.localStorage}});
const $=id=>document.getElementById(id);
let products=[];
let localCounts=JSON.parse(localStorage.getItem("calip_counts")||"[]");
let recoveryMode=false;

function msg(id,text,ok=false){const el=$(id);if(!el)return;el.textContent=text;el.style.color=ok?"#17633f":"#a12d35"}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]))}
function pick(o,...keys){for(const k of keys)if(o&&o[k]!=null)return o[k];return ""}
function usuarioAEmail(v){const u=String(v||"").trim().toLowerCase();return u.includes("@")?u:u+"@gmail.com"}
function showOnly(id){["loginView","recoveryView","appView"].forEach(x=>$(x).classList.add("hidden"));$(id).classList.remove("hidden")}
function hashParams(){return new URLSearchParams((location.hash||"").replace(/^#/,""))}
function hasRecoveryTokens(){const h=hashParams();return !!(h.get("access_token")&&h.get("refresh_token"))}

async function init(){
  if(!cfg.SUPABASE_URL||!cfg.SUPABASE_PUBLISHABLE_KEY){msg("loginMsg","Falta configurar config.js");return}

  // Flujo de recuperación con tokens en el hash.
  if(hasRecoveryTokens()){
    recoveryMode=true;
    showOnly("recoveryView");
    msg("recoveryMsg","Preparando cambio de contraseña...",true);
    const h=hashParams();
    const {error}=await sb.auth.setSession({access_token:h.get("access_token"),refresh_token:h.get("refresh_token")});
    if(error){msg("recoveryMsg","El enlace de recuperación no es válido o ya venció. Solicita un nuevo correo.");return}
    history.replaceState({},document.title,location.pathname+location.search);
    msg("recoveryMsg","Escribe tu nueva contraseña.",true);
    return;
  }

  // Flujo PKCE por ?code=...
  const code=new URLSearchParams(location.search).get("code");
  if(code){
    recoveryMode=true;
    showOnly("recoveryView");
    msg("recoveryMsg","Preparando cambio de contraseña...",true);
    const {error}=await sb.auth.exchangeCodeForSession(code);
    if(error){msg("recoveryMsg","El enlace de recuperación no es válido o ya venció. Solicita un nuevo correo.");return}
    history.replaceState({},document.title,location.pathname);
    msg("recoveryMsg","Escribe tu nueva contraseña.",true);
    return;
  }

  const {data:{session}}=await sb.auth.getSession();
  if(session)enterApp(session.user);else showOnly("loginView");
}

async function login(e){
  e.preventDefault();msg("loginMsg","");
  const {data,error}=await sb.auth.signInWithPassword({email:usuarioAEmail($("usuario").value),password:$("password").value});
  if(error){msg("loginMsg","Usuario o contraseña incorrectos: "+error.message);return}
  enterApp(data.user);
}

async function setNewPassword(e){
  e.preventDefault();msg("recoveryMsg","");
  const p=$("newPassword").value,p2=$("newPassword2").value;
  if(p.length<6){msg("recoveryMsg","La contraseña debe tener al menos 6 caracteres.");return}
  if(p!==p2){msg("recoveryMsg","Las contraseñas no coinciden.");return}
  const {error}=await sb.auth.updateUser({password:p});
  if(error){msg("recoveryMsg","No se pudo cambiar la contraseña: "+error.message);return}
  recoveryMode=false;
  msg("recoveryMsg","Contraseña actualizada. Entrando a CALIP...",true);
  setTimeout(async()=>{const {data}=await sb.auth.getUser();enterApp(data.user)},600);
}

function enterApp(user){recoveryMode=false;showOnly("appView");$("sessionUser").textContent=user?.email||"";loadProducts();renderCounts()}
async function logout(){await sb.auth.signOut();recoveryMode=false;showOnly("loginView")}
async function loadProducts(){msg("productsMsg","Cargando...",true);const {data,error}=await sb.from("productos").select("*");if(error){msg("productsMsg","No se pudieron cargar productos: "+error.message);return}products=data||[];renderProducts();msg("productsMsg",`${products.length} productos cargados.`,true)}
function renderProducts(){const q=$("productSearch").value.trim().toLowerCase();const rows=products.filter(p=>JSON.stringify(p).toLowerCase().includes(q)).slice(0,500);$("productsBody").innerHTML=rows.map(p=>`<tr><td>${esc(pick(p,"codigo","cod","id"))}</td><td>${esc(pick(p,"descripcion","nombre","desc_material"))}</td><td>${esc(pick(p,"codigo_fabrica","cod_fabrica","codigo_factory"))}</td><td>${esc(pick(p,"um","unidad_medida"))}</td></tr>`).join("")}
function renderCounts(){$("inventoryBody").innerHTML=localCounts.map(x=>`<tr><td>${esc(x.codigo)}</td><td>${esc(x.descripcion)}</td><td>${esc(x.cantidad)}</td><td>${esc(x.fecha)}</td></tr>`).join("")}
function saveCount(){const q=$("invSearch").value.trim().toLowerCase();const p=products.find(x=>JSON.stringify(x).toLowerCase().includes(q));const qty=$("invQty").value;if(!p){msg("inventoryMsg","Primero busca un producto válido.");return}if(qty===""){msg("inventoryMsg","Ingresa la cantidad.");return}localCounts.unshift({codigo:pick(p,"codigo","cod","id"),descripcion:pick(p,"descripcion","nombre","desc_material"),cantidad:Number(qty),fecha:new Date().toLocaleString("es-PE")});localStorage.setItem("calip_counts",JSON.stringify(localCounts));renderCounts();msg("inventoryMsg","Conteo guardado en este dispositivo.",true)}

sb.auth.onAuthStateChange((event,session)=>{
  if(event==="PASSWORD_RECOVERY"||recoveryMode){showOnly("recoveryView");}
  else if(event==="SIGNED_OUT"){showOnly("loginView");}
  else if(event==="SIGNED_IN"&&session){enterApp(session.user)}
});

$("loginForm").addEventListener("submit",login);
$("recoveryForm").addEventListener("submit",setNewPassword);
$("logoutBtn").addEventListener("click",logout);
$("reloadProducts").addEventListener("click",loadProducts);
$("productSearch").addEventListener("input",renderProducts);
$("saveCount").addEventListener("click",saveCount);
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.querySelectorAll(".section").forEach(x=>x.classList.add("hidden"));$(b.dataset.section).classList.remove("hidden")}));
document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>document.querySelector(`[data-section="${b.dataset.go}"]`).click()));
init();
