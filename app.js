const {createClient}=window.supabase;
const cfg=window.CALIP_CONFIG||{};
const sb=createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY);
const $=id=>document.getElementById(id);
let products=[];
let localCounts=JSON.parse(localStorage.getItem("calip_counts")||"[]");

function msg(id,text,ok=false){const e=$(id);e.textContent=text;e.style.color=ok?"#1f7a4d":"#b42318"}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function pick(o,...keys){for(const k of keys)if(o&&o[k]!==undefined&&o[k]!==null)return o[k];return""}

function usuarioAEmail(v){
 const u=String(v||"").trim().toLowerCase();
 if(!u)return"";
 return u.includes("@")?u:u+"@gmail.com";
}

async function init(){
 if(!cfg.SUPABASE_URL||cfg.SUPABASE_URL.startsWith("PEGA_AQUI")){
   msg("loginMsg","Falta configurar config.js con tu URL y Publishable key de Supabase.");return;
 }
 const {data:{session}}=await sb.auth.getSession();
 if(session)enterApp(session.user);
}

async function login(e){
 e.preventDefault();msg("loginMsg","");
 const {data,error}=await sb.auth.signInWithPassword({email:usuarioAEmail($("usuario").value),password:$("password").value});
 if(error){msg("loginMsg",error.message);return}
 enterApp(data.user);
}

async function logout(){
 await sb.auth.signOut();$("appView").classList.add("hidden");$("loginView").classList.remove("hidden");
}

function enterApp(user){
 $("loginView").classList.add("hidden");$("appView").classList.remove("hidden");
 $("sessionUser").textContent=user.email||"";loadProducts();renderCounts();
}

async function loadProducts(){
 msg("productsMsg","Cargando...",true);
 const {data,error}=await sb.from("productos").select("*");
 if(error){msg("productsMsg","No se pudieron cargar productos: "+error.message);return}
 products=data||[];renderProducts();msg("productsMsg",`${products.length} productos cargados.`,true);
}

function renderProducts(){
 const q=$("productSearch").value.trim().toLowerCase();
 const rows=products.filter(p=>JSON.stringify(p).toLowerCase().includes(q)).slice(0,500);
 $("productsBody").innerHTML=rows.map(p=>`<tr><td>${esc(pick(p,"codigo","cod","id"))}</td><td>${esc(pick(p,"descripcion","nombre","desc_material"))}</td><td>${esc(pick(p,"codigo_fabrica","cod_fabrica","codigo_factory"))}</td><td>${esc(pick(p,"um","unidad_medida"))}</td></tr>`).join("");
}

function renderCounts(){
 $("inventoryBody").innerHTML=localCounts.map(x=>`<tr><td>${esc(x.codigo)}</td><td>${esc(x.descripcion)}</td><td>${esc(x.cantidad)}</td><td>${esc(x.fecha)}</td></tr>`).join("");
}

function saveCount(){
 const q=$("invSearch").value.trim().toLowerCase();
 const p=products.find(x=>JSON.stringify(x).toLowerCase().includes(q));
 const qty=$("invQty").value;
 if(!p){msg("inventoryMsg","Primero busca un producto válido.");return}
 if(qty===""){msg("inventoryMsg","Ingresa la cantidad.");return}
 localCounts.unshift({codigo:pick(p,"codigo","cod","id"),descripcion:pick(p,"descripcion","nombre","desc_material"),cantidad:Number(qty),fecha:new Date().toISOString()});
 localStorage.setItem("calip_counts",JSON.stringify(localCounts));renderCounts();msg("inventoryMsg","Conteo guardado en este dispositivo.",true);
}

function go(section){
 document.querySelectorAll(".section").forEach(s=>s.classList.add("hidden"));
 $(section).classList.remove("hidden");
 document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.section===section));
}

document.addEventListener("DOMContentLoaded",()=>{
 $("loginForm").addEventListener("submit",login);
 $("logoutBtn").addEventListener("click",logout);
 $("reloadProducts").addEventListener("click",loadProducts);
 $("productSearch").addEventListener("input",renderProducts);
 $("saveCount").addEventListener("click",saveCount);
 document.querySelectorAll("[data-section]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.section)));
 document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.go)));
 init();
});
