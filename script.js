/* =====================================================================
   CONFIGURACIÓN — edita solo este bloque con los datos reales del evento
   ===================================================================== */
const CONFIG = {
  beneficiario: "Jimmy Marroquin",
  mensaje:
    "Nos reunimos para apoyar con los gastos médicos de Jimmy Marroquin. Cada boleto que compras es una ayuda directa para su tratamiento. Gracias por acompañarnos.",

  fechaTexto: "Sábado 19 de diciembre",
  horaTexto: "", // ej. "5:00 a 8:00 p. m." — vacío = no se muestra la hora
  // Para la cuenta regresiva (año-mes-día T hora:minutos, formato 24 h)
  inicio: "2026-12-19T00:00",
  fin: "2026-12-19T23:59",

  lugar: "Wendy's City Mall, Tegucigalpa",
  mapaUrl: "https://www.google.com/maps/search/?api=1&query=Wendy%27s+City+Mall+Tegucigalpa", // enlace de Google Maps (opcional)

  precioBoleto: "L 260", //   = espacio que no se parte en dos líneas
  incluye: "Incluye un combo clásico",
  comoPagar:
    "Paga y recoge tu boleto en la sucursal, Wendy's City Mall. De preferencia en efectivo.",

  totalBoletos: 250, // boletos disponibles, para la barra de avance (0 = sin barra)

  // URL de la app web de Google Apps Script (ver google-apps-script/Code.gs).
  // Si se deja vacío, la página funciona en modo de prueba (no guarda en la hoja).
  endpoint: "https://script.google.com/macros/s/AKfycbxX_kdwbnPp-OA7G-wNFIkaqqZrGdA34vGrSk1RGY2xl9mSOngqaYpJ7yVXne38-wQxOw/exec",
};

/* ===================================================================== */

const $ = (id) => document.getElementById(id);
const CLAVE_LOCAL = "noche-benefica-registros";

/* ---------- Textos del evento ---------- */
document.querySelectorAll("[data-cfg]").forEach((el) => {
  el.textContent = CONFIG[el.dataset.cfg] ?? "";
});

if (CONFIG.mapaUrl) {
  $("enlace-mapa").href = CONFIG.mapaUrl;
  $("enlace-mapa").hidden = false;
}

if (!CONFIG.horaTexto) {
  $("bloque-hora").hidden = true;
  $("bloque-fecha").classList.add("ancho");
}

// Un precio largo (p. ej. "Por confirmar") se muestra en letra más pequeña.
document
  .querySelector(".talon-precio")
  .classList.toggle("largo", CONFIG.precioBoleto.length > 7);

if (!CONFIG.endpoint) $("aviso-demo").hidden = false;

/* ---------- Cuenta regresiva ---------- */
(function cuentaRegresiva() {
  const inicio = new Date(CONFIG.inicio).getTime();
  const fin = new Date(CONFIG.fin).getTime();
  if (Number.isNaN(inicio)) {
    $("cuenta").hidden = true;
    return;
  }
  const dos = (n) => String(n).padStart(2, "0");

  function mostrarMensaje(texto) {
    $("cuenta").hidden = true;
    $("cuenta-msg").textContent = texto;
    $("cuenta-msg").hidden = false;
  }

  function tic() {
    const ahora = Date.now();
    const falta = inicio - ahora;
    if (falta <= 0) {
      clearInterval(reloj);
      mostrarMensaje(
        !Number.isNaN(fin) && ahora > fin
          ? "¡Gracias a todos los que nos acompañaron!"
          : "¡Es hoy! Te esperamos."
      );
      return;
    }
    const seg = Math.floor(falta / 1000);
    $("c-dias").textContent = Math.floor(seg / 86400);
    $("c-horas").textContent = dos(Math.floor((seg % 86400) / 3600));
    $("c-min").textContent = dos(Math.floor((seg % 3600) / 60));
    $("c-seg").textContent = dos(seg % 60);
  }

  const reloj = setInterval(tic, 1000);
  tic();
})();

/* ---------- Datos ----------
   Los nombres se guardan solo en la hoja de Google. La página únicamente
   recibe la cantidad de boletos apartados, para la barra de avance. */
function leerLocal() {
  try {
    const datos = JSON.parse(localStorage.getItem(CLAVE_LOCAL));
    return Array.isArray(datos) ? datos : [];
  } catch {
    return [];
  }
}
const sumaLocal = (registros) => ({
  ok: true,
  totalBoletos: registros.reduce((s, r) => s + (Number(r.boletos) || 0), 0),
});

async function obtenerAvance() {
  if (!CONFIG.endpoint) return sumaLocal(leerLocal());
  const resp = await fetch(CONFIG.endpoint);
  if (!resp.ok) throw new Error("HTTP " + resp.status);
  return resp.json();
}

function pintarAvance(datos) {
  const apartados = Number(datos && datos.totalBoletos);
  // Sin total configurado o sin dato del servidor: no se muestra la sección.
  if (!(CONFIG.totalBoletos > 0) || !Number.isFinite(apartados)) return;

  const pct = Math.min(100, Math.round((apartados / CONFIG.totalBoletos) * 100));
  const quedan = Math.max(0, CONFIG.totalBoletos - apartados);

  $("avance-num").textContent = apartados;
  $("avance-total").textContent = CONFIG.totalBoletos;
  $("avance-relleno").style.width = pct + "%";
  $("avance-barra").setAttribute("aria-valuenow", pct);
  $("avance-texto").textContent =
    quedan > 0
      ? `${pct}% apartado · ${quedan === 1 ? "queda 1 boleto" : `quedan ${quedan} boletos`}`
      : "100% apartado · ¡gracias a todos!";
  $("avance").hidden = false;
}

obtenerAvance().then(pintarAvance).catch((err) => console.error(err));

async function guardarRegistro(registro) {
  if (!CONFIG.endpoint) {
    // Modo de prueba: se guarda solo en este navegador.
    const registros = leerLocal();
    registros.push(registro);
    localStorage.setItem(CLAVE_LOCAL, JSON.stringify(registros));
    return sumaLocal(registros);
  }
  // text/plain evita la verificación CORS previa, que Apps Script no atiende.
  const resp = await fetch(CONFIG.endpoint, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(registro),
  });
  if (!resp.ok) throw new Error("HTTP " + resp.status);
  const datos = await resp.json();
  if (!datos.ok) throw new Error(datos.error || "Error del servidor");
  return datos;
}

/* ---------- Formulario ---------- */
const form = $("form-registro");
const campoBoletos = $("boletos");

function limitarBoletos(n) {
  return Math.min(20, Math.max(1, Math.round(Number(n)) || 1));
}
$("menos").addEventListener("click", () => {
  campoBoletos.value = limitarBoletos(Number(campoBoletos.value) - 1);
});
$("mas").addEventListener("click", () => {
  campoBoletos.value = limitarBoletos(Number(campoBoletos.value) + 1);
});
campoBoletos.addEventListener("change", () => {
  campoBoletos.value = limitarBoletos(campoBoletos.value);
});

function mostrarError(texto) {
  $("form-error").textContent = texto;
  $("form-error").hidden = !texto;
}

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  mostrarError("");

  const nombre = $("nombre").value.replace(/\s+/g, " ").trim();
  const boletos = limitarBoletos(campoBoletos.value);

  if (nombre.length < 2) {
    mostrarError("Escribe tu nombre para apartar tu boleto.");
    $("nombre").focus();
    return;
  }
  // Si el campo trampa tiene algo, es un bot: se ignora en silencio.
  if ($("sitio").value) return;

  const boton = $("enviar");
  boton.disabled = true;
  boton.textContent = "Guardando…";

  try {
    pintarAvance(await guardarRegistro({ nombre, boletos }));

    $("gracias-nombre").textContent = nombre.split(" ")[0];
    $("gracias-detalle").textContent =
      boletos === 1 ? "Apartaste 1 boleto." : `Apartaste ${boletos} boletos.`;
    form.hidden = true;
    $("gracias").hidden = false;
    $("gracias").focus();
  } catch (err) {
    console.error(err);
    mostrarError("No se pudo guardar tu registro. Revisa tu conexión e inténtalo de nuevo.");
  } finally {
    boton.disabled = false;
    boton.textContent = "Apartar boleto";
  }
});

$("otro").addEventListener("click", () => {
  form.reset();
  $("gracias").hidden = true;
  form.hidden = false;
  $("nombre").focus();
});

/* ---------- Compartir ---------- */
const textoCompartir = `Te invito a la Noche Benéfica en Wendy's a beneficio de ${CONFIG.beneficiario}. ${[CONFIG.fechaTexto, CONFIG.horaTexto, CONFIG.lugar].filter(Boolean).join(", ")}. Aparta tu boleto aquí:`;
const urlPagina = location.href.split("#")[0];

$("whatsapp").href = "https://wa.me/?text=" + encodeURIComponent(`${textoCompartir} ${urlPagina}`);

$("compartir").addEventListener("click", async () => {
  const boton = $("compartir");
  if (navigator.share) {
    try {
      await navigator.share({ title: document.title, text: textoCompartir, url: urlPagina });
    } catch {
      /* la persona canceló */
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(`${textoCompartir} ${urlPagina}`);
    boton.textContent = "¡Enlace copiado!";
  } catch {
    boton.textContent = "Copia el enlace de la barra";
  }
  setTimeout(() => (boton.textContent = "Compartir invitación"), 2500);
});
