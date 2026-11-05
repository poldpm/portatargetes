/**
 * Portatargetes Vedruna — recull de comandes.
 *
 * Aquest script va LLIGAT al full de càlcul de les comandes
 * (Extensions → Apps Script des del mateix full). Veure LLEGEIX-ME.md.
 *
 * Pestanyes que crea sol:
 *  - «Comandes»:  una fila per comanda, amb tota la informació.
 *  - «Producció»: només text,model — Fitxer → Baixa → CSV d'aquesta pestanya
 *                 i surt el fitxer per generar les plaques de la Bambu Lab.
 */

var FULL_COMANDES = 'Comandes';
var FULL_PRODUCCIO = 'Producció';
var CAPCALERA = ['Data', 'Referència', 'Logotip', 'Correu', 'Text a gravar', 'Model', 'Mida lletra (mm)', 'Estat'];
var MODELS_VALIDS = ['A granat', 'A blanc', 'B', 'Pro A', 'Pro B'];
var ESCOLES_VALIDES = ['Vedruna Escorial Vic', 'Vedruna Pro Vic'];

/** Executa-la UN COP des de l'editor (botó ▶) per crear les pestanyes. */
function prepara() {
  var ss = SpreadsheetApp.getActive();
  var c = ss.getSheetByName(FULL_COMANDES) || ss.insertSheet(FULL_COMANDES);
  if (c.getLastRow() === 0) {
    c.appendRow(CAPCALERA);
    c.getRange(1, 1, 1, CAPCALERA.length).setFontWeight('bold').setBackground('#7a1f34').setFontColor('#f4f2ee');
    c.setFrozenRows(1);
    c.setColumnWidths(1, CAPCALERA.length, 150);
    c.getRange('E:E').setNumberFormat('@');
  }
  var p = ss.getSheetByName(FULL_PRODUCCIO) || ss.insertSheet(FULL_PRODUCCIO);
  p.clear();
  p.getRange('A1:B1').setValues([['text', 'model']]).setFontWeight('bold');
  // Només les comandes que no s'han anul·lat (columna Estat ≠ "anul·lada"), agrupades per model
  var c_ = FULL_COMANDES + '!';
  p.getRange('A2').setFormula(
    '=IFERROR(SORT(FILTER({' + c_ + 'E2:E, ' + c_ + 'F2:F}, ' + c_ + 'F2:F<>"", ' + c_ + 'H2:H<>"anul·lada"), 2, TRUE), "")'
  );
  var full1 = ss.getSheetByName('Full 1') || ss.getSheetByName('Sheet1') || ss.getSheetByName('Hoja 1');
  if (full1 && full1.getLastRow() === 0 && ss.getSheets().length > 2) ss.deleteSheet(full1);
  return 'Fet';
}

function doGet() {
  return json_({ ok: true, servei: 'portatargetes', comandes: Math.max(0, full_().getLastRow() - 1) });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var text = net_(d.text, 40);
    var correu = net_(d.correu, 120).toLowerCase();
    var model = String(d.model || '');
    var escola = String(d.escola || '');
    var ref = net_(d.ref, 20);
    var mida = Number(d.midaLletra) || '';

    if (MODELS_VALIDS.indexOf(model) < 0) return json_({ ok: false, error: 'Model desconegut.' });
    if (ESCOLES_VALIDES.indexOf(escola) < 0) return json_({ ok: false, error: 'Logotip desconegut.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correu)) return json_({ ok: false, error: 'Falta un correu electrònic vàlid.' });
    if (!ref) return json_({ ok: false, error: 'Falta la referència.' });

    var sh = full_();
    // si el navegador ha enviat la mateixa comanda dues vegades, no es duplica
    var n = sh.getLastRow();
    if (n > 1) {
      var refs = sh.getRange(2, 2, n - 1, 1).getValues();
      for (var i = 0; i < refs.length; i++) if (refs[i][0] === ref) return json_({ ok: true, ref: ref, repetida: true });
    }
    sh.appendRow([new Date(), ref, escola, segur_(correu), segur_(text), model, mida, '']);
    return json_({ ok: true, ref: ref });
  } catch (err) {
    return json_({ ok: false, error: 'Error del servidor: ' + err.message });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function full_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(FULL_COMANDES);
  if (!sh) { prepara(); sh = ss.getSheetByName(FULL_COMANDES); }
  return sh;
}
function net_(v, max) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max); }
// Un text que comença per = + - @ el full el prendria per una fórmula: l'apòstrof el deixa com a text
function segur_(v) { return /^[=+\-@]/.test(v) ? "'" + v : v; }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
