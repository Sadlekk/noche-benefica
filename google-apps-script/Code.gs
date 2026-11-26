/**
 * Noche Benéfica — guarda los registros en una hoja de Google Sheets.
 * La página nunca recibe los nombres de quienes se anotaron, solo la
 * cantidad de boletos apartados. La lista se consulta abriendo la hoja.
 *
 * CÓMO INSTALARLO (una sola vez, ~3 minutos):
 *  1. Abre la hoja de Google Sheets donde quieres guardar los registros.
 *  2. Menú Extensiones → Apps Script. Borra lo que haya y pega este archivo.
 *  3. Botón Implementar → Nueva implementación → tipo "Aplicación web".
 *       Ejecutar como:        Yo
 *       Quién tiene acceso:   Cualquier usuario
 *  4. Autoriza los permisos y copia la "URL de la aplicación web"
 *     (termina en /exec).
 *  5. Pega esa URL en script.js, en CONFIG.endpoint.
 *
 * Los registros aparecen en la pestaña "Registros" de la hoja:
 * fecha, nombre y cantidad de boletos.
 *
 * SI YA LO TENÍAS INSTALADO y cambias este código: pégalo de nuevo y usa
 * Implementar → Administrar implementaciones → Editar (lápiz) →
 * Versión: "Nueva versión" → Implementar. Así la URL sigue siendo la misma.
 */

const NOMBRE_HOJA = 'Registros';
const MAX_BOLETOS = 20;

// La página solo recibe la cantidad de boletos apartados, nunca los nombres.
function doGet() {
  return responder({ ok: true, totalBoletos: totalBoletos() });
}

function doPost(e) {
  const candado = LockService.getScriptLock();
  candado.waitLock(10000);
  try {
    const datos = JSON.parse(e.postData.contents);
    let nombre = String(datos.nombre || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    const boletos = Math.min(MAX_BOLETOS, Math.max(1, parseInt(datos.boletos, 10) || 1));

    if (nombre.length < 2) {
      return responder({ ok: false, error: 'Nombre inválido' });
    }
    // Evita que un nombre se interprete como fórmula en la hoja.
    if (/^[=+\-@]/.test(nombre)) nombre = "'" + nombre;

    hoja().appendRow([new Date(), nombre, boletos]);
    return responder({ ok: true, totalBoletos: totalBoletos() });
  } catch (err) {
    return responder({ ok: false, error: 'No se pudo guardar el registro' });
  } finally {
    candado.releaseLock();
  }
}

function hoja() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let h = libro.getSheetByName(NOMBRE_HOJA);
  if (!h) {
    h = libro.insertSheet(NOMBRE_HOJA);
    h.appendRow(['Fecha', 'Nombre', 'Boletos']);
    h.getRange('A1:C1').setFontWeight('bold');
    h.setFrozenRows(1);
  }
  return h;
}

// Suma la columna "Boletos" de la hoja.
function totalBoletos() {
  const h = hoja();
  const filas = h.getLastRow() - 1;
  if (filas < 1) return 0;
  return h.getRange(2, 3, filas, 1).getValues()
    .reduce(function (s, f) { return s + (Number(f[0]) || 0); }, 0);
}

function responder(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}
