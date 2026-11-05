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
var CAPCALERA = ['Data', 'Referència', 'Logotip', 'Correu', 'Text a gravar', 'Model', 'Mida lletra (mm)', 'Estat', 'Confirmació'];
var NOM_MODEL = { 'A granat': 'Clàssic granat', 'A blanc': 'Clàssic blanc', 'B': 'Etiqueta', 'Pro A': 'Clàssic', 'Pro B': 'Etiqueta' };
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

/**
 * Executa-la UN COP des de l'editor (botó ▶) després d'enganxar aquesta versió:
 * demana el permís per enviar correus i te n'envia un de prova a tu.
 */
function provaCorreu() {
  var jo = Session.getEffectiveUser().getEmail();
  MailApp.sendEmail({ to: jo, subject: 'Portatargetes: el correu de confirmació funciona',
    htmlBody: 'Si reps això, cada mestra rebrà un correu com aquest quan faci la comanda.' });
  return 'Correu enviat a ' + jo + '. Et queden ' + MailApp.getRemainingDailyQuota() + ' correus per avui.';
}

function doGet(e) {
  var ref = e && e.parameter && e.parameter.ref;
  if (ref) return json_({ ok: true, ref: ref, existeix: filaDe_(full_(), String(ref)) > 0 });
  return json_({ ok: true, servei: 'portatargetes', comandes: Math.max(0, full_().getLastRow() - 1) });
}

// Fila on és la referència (0 si no hi és)
function filaDe_(sh, ref) {
  var n = sh.getLastRow();
  if (n < 2) return 0;
  var refs = sh.getRange(2, 2, n - 1, 1).getValues();
  for (var i = refs.length - 1; i >= 0; i--) if (refs[i][0] === ref) return i + 2;
  return 0;
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  var desada = null;
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
    if (!sh.getRange(1, 9).getValue()) sh.getRange(1, 9).setValue('Confirmació').setFontWeight('bold');
    // si el navegador ha enviat la mateixa comanda dues vegades, no es duplica (ni es torna a enviar el correu)
    if (filaDe_(sh, ref)) return json_({ ok: true, ref: ref, repetida: true });
    sh.appendRow([new Date(), ref, escola, segur_(correu), segur_(text), model, mida, '', '']);
    SpreadsheetApp.flush();                       // desada de debò abans de dir-li a la mestra que sí
    desada = { fila: sh.getLastRow(), sh: sh };
  } catch (err) {
    return json_({ ok: false, error: 'Error del servidor: ' + err.message });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
  // El correu, fora del torn: així no fa esperar les comandes que venen darrere.
  // Si falla, la comanda ja és desada igualment; queda apuntat a «Confirmació».
  var estatCorreu = 'enviat';
  try { correuConfirmacio_(correu, ref, escola, model, text); }
  catch (err) { estatCorreu = 'error: ' + err.message; }
  try { desada.sh.getRange(desada.fila, 9).setValue(estatCorreu === 'enviat' ? 'correu enviat' : estatCorreu); } catch (x) {}
  return json_({ ok: true, ref: ref, correu: estatCorreu === 'enviat' });
}

function correuConfirmacio_(correu, ref, escola, model, text) {
  var nomModel = NOM_MODEL[model] || model;
  var esc = function (v) { return String(v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  MailApp.sendEmail({
    to: correu,
    name: 'Portatargetes Vedruna',
    subject: 'Comanda del portatargetes rebuda (' + ref + ')',
    htmlBody:
      '<div style="font-family:Arial,sans-serif;font-size:15px;color:#1b1b1b;max-width:520px">' +
      '<p>Hola,</p><p>Hem rebut la teva comanda del portatargetes. Aquestes són les dades:</p>' +
      '<table style="border-collapse:collapse">' +
      '<tr><td style="padding:4px 14px 4px 0;color:#7a1f34">Logotip</td><td><b>' + esc(escola) + '</b></td></tr>' +
      '<tr><td style="padding:4px 14px 4px 0;color:#7a1f34">Model</td><td><b>' + esc(nomModel) + '</b></td></tr>' +
      '<tr><td style="padding:4px 14px 4px 0;color:#7a1f34">Text a la tapa</td><td><b>' + (text ? '«' + esc(text) + '»' : 'Sense nom') + '</b></td></tr>' +
      '<tr><td style="padding:4px 14px 4px 0;color:#7a1f34">Referència</td><td>' + esc(ref) + '</td></tr>' +
      '</table>' +
      '<p>S\'imprimirà exactament així. Si hi ha alguna cosa que no està bé, respon aquest correu.</p>' +
      '</div>'
  });
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
