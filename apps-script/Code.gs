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
  correuConfirmacio_(jo, 'PT-PROVA', 'Vedruna Escorial Vic', 'A granat', 'Nom Cognom', 6, '');
  return 'Correu de prova enviat a ' + jo + '. Et queden ' + MailApp.getRemainingDailyQuota() + ' correus per avui.';
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
    // la foto 3D que fa la web del seu portatargetes (JPEG en base64); si no hi és o és massa gran, el correu en fa servir una de genèrica
    var foto = typeof d.foto === 'string' && d.foto.length < 600000 && /^[A-Za-z0-9+\/=]+$/.test(d.foto) ? d.foto : '';

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
  try { correuConfirmacio_(correu, ref, escola, model, text, mida, foto); }
  catch (err) { estatCorreu = 'error: ' + err.message; }
  try { desada.sh.getRange(desada.fila, 9).setValue(estatCorreu === 'enviat' ? 'correu enviat' : estatCorreu); } catch (x) {}
  return json_({ ok: true, ref: ref, correu: estatCorreu === 'enviat' });
}

var WEB = 'https://poldpm.github.io/portatargetes/';

function correuConfirmacio_(correu, ref, escola, model, text, mida, fotoB64) {
  var opcions = {
    to: correu,
    name: 'Portatargetes Vedruna',
    subject: (text ? '«' + text + '» ' : 'El teu portatargetes ') + 'ja és a la cua d\'impressió · ' + ref,
    htmlBody: htmlCorreu_({ ref: ref, escola: escola, model: model, text: text, mida: mida, foto: fotoB64 ? 'cid:portatargetes' : '' }),
    body: textCorreu_({ ref: ref, escola: escola, model: model, text: text })
  };
  if (fotoB64) opcions.inlineImages = { portatargetes: Utilities.newBlob(Utilities.base64Decode(fotoB64), 'image/jpeg', ref + '.jpg') };
  MailApp.sendEmail(opcions);
}

function textCorreu_(c) {
  return 'Comanda ' + c.ref + ' rebuda.\n\n' +
    'Logotip: ' + c.escola + '\nModel: ' + (NOM_MODEL[c.model] || c.model) + '\nText a la tapa: ' + (c.text ? '«' + c.text + '»' : 'sense nom') +
    '\n\nS\'imprimirà exactament així. Si hi ha alguna cosa que no està bé, respon aquest correu.\n\n' + WEB;
}

/* El correu, amb el mateix aire que la web: fosc, filets prims, xifres en mm.
   Fet amb taules i estils en línia perquè es vegi bé a Gmail, Outlook i al mòbil. */
function htmlCorreu_(c) {
  var e = function (v) { return String(v).replace(/[&<>"]/g, function (x) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[x]; }); };
  var F = "'Fira Sans','Helvetica Neue',Helvetica,Arial,sans-serif";
  var MONO = "'Fira Code',Menlo,Consolas,'Courier New',monospace";
  var mono = function (t, color) { return '<span style="font-family:' + MONO + ';font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:' + (color || '#a8999d') + '">' + t + '</span>'; };
  var nomModel = NOM_MODEL[c.model] || c.model;
  var mm = c.mida ? String(Number(c.mida).toFixed(1)).replace('.', ',') + ' mm' : '6,0 mm';
  var foto = c.foto || (WEB + 'assets/img/correu.jpg');
  var fila = function (eti, valor, gran) {
    return '<tr><td style="padding:14px 0;border-bottom:1px solid #2e2226">' + mono(eti) + '<br>' +
      '<span style="font-family:' + F + ';font-size:' + (gran ? '26px' : '17px') + ';line-height:1.3;font-weight:' + (gran ? '700' : '500') + ';color:#efe9e2">' + valor + '</span></td></tr>';
  };
  var pas = function (n, titol, actiu) {
    return '<td width="33%" valign="top" style="padding:14px 10px 14px 0;border-top:2px solid ' + (actiu ? '#c4123f' : '#3a2a2f') + '">' +
      mono(n, actiu ? '#ff4d73' : '#6f6064') + '<br><span style="font-family:' + F + ';font-size:14px;line-height:1.35;color:' + (actiu ? '#efe9e2' : '#8d7f83') + '">' + titol + '</span></td>';
  };
  return '<!doctype html><html lang="ca"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">' +
    '<style>@import url(https://fonts.googleapis.com/css2?family=Fira+Code:wght@400&family=Fira+Sans:wght@200;400;500;700&display=swap);' +
    '@media (max-width:620px){.pad{padding-left:22px!important;padding-right:22px!important}.titol{font-size:34px!important}.nomob{display:none!important}}</style></head>' +
    '<body style="margin:0;padding:0;background:#0b0608" bgcolor="#0b0608">' +
    '<div style="display:none;max-height:0;overflow:hidden">' + e(nomModel + ' · ' + c.escola + (c.text ? ' · «' + c.text + '»' : '')) + ' — ja és a la cua d\'impressió.</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0b0608" style="background:#0b0608"><tr><td align="center" style="padding:28px 10px">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#110a0d;border:1px solid #2e2226" bgcolor="#110a0d">' +

    // capçalera HUD
    '<tr><td class="pad" style="padding:22px 40px 0">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
      '<td class="nomob">' + mono('Portatargetes Vedruna') + '</td>' +
      '<td align="right" style="white-space:nowrap">' + mono('<span style="color:#c4123f">&#9679;</span>&nbsp; Comanda ' + e(c.ref), '#efe9e2') + '</td>' +
      '</tr></table></td></tr>' +
    '<tr><td style="padding:18px 0 0"><div style="height:1px;line-height:1px;font-size:0;background:#c4123f;background:linear-gradient(90deg,#c4123f,#7a1f34 40%,#110a0d)">&nbsp;</div></td></tr>' +

    // titular
    '<tr><td class="pad" style="padding:38px 40px 6px">' + mono(e(c.escola)) +
      '<h1 class="titol" style="margin:14px 0 0;font-family:' + F + ';font-weight:200;font-size:44px;line-height:1.02;letter-spacing:-1px;color:#efe9e2">' +
      'El teu portatargetes<br><b style="font-weight:700">ja és a la cua.</b></h1>' +
      '<div style="width:64px;height:3px;background:#c4123f;margin-top:18px;font-size:0;line-height:0">&nbsp;</div></td></tr>' +

    // la foto
    '<tr><td style="padding:28px 0 0" align="center">' +
      '<img src="' + foto + '" width="600" alt="' + e(nomModel + (c.text ? ' amb «' + c.text + '»' : '')) + '" style="display:block;width:100%;max-width:600px;height:auto;border:0;background:#0b0608">' +
    '</td></tr>' +

    // fitxa
    '<tr><td class="pad" style="padding:8px 40px 0">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
      fila('Text a la tapa', c.text ? '«' + e(c.text) + '»' : 'Sense nom · tapa llisa', true) +
      fila('Model', e(nomModel)) +
      fila('Logotip', e(c.escola)) +
      fila('Lletra', 'Fira Sans Bold · ' + mm) +
      '</table></td></tr>' +

    // què passa ara
    '<tr><td class="pad" style="padding:36px 40px 0">' + mono('Què passa ara') +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px"><tr>' +
      pas('01 · Fet', 'Comanda rebuda', true) + pas('02', 'Impressió en 3D', false) + pas('03', 'A les teves mans', false) +
      '</tr></table></td></tr>' +

    // nota
    '<tr><td class="pad" style="padding:26px 40px 0"><p style="margin:0;font-family:' + F + ';font-size:15px;line-height:1.55;color:#c9bfc2">' +
      'S\'imprimirà <b style="color:#efe9e2">exactament així</b>: majúscules, accents i tot. Si hi ha alguna cosa que no està bé, només cal que responguis aquest correu.</p></td></tr>' +

    // peu
    '<tr><td class="pad" style="padding:36px 40px 30px">' +
      '<div style="height:1px;line-height:1px;font-size:0;background:#2e2226">&nbsp;</div>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px"><tr>' +
      '<td class="nomob">' + mono('60 × 110 × 4,2 mm · imprès en 3D', '#6f6064') + '</td>' +
      '<td align="right" style="white-space:nowrap"><a href="' + WEB + '" style="font-family:' + MONO + ';font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:#ff4d73;text-decoration:none">Veure la web &rarr;</a></td>' +
      '</tr></table></td></tr>' +

    '</table></td></tr></table></body></html>';
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
