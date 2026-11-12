/**
 * Portatargetes Vedruna — recull de comandes.
 *
 * Aquest script va LLIGAT al full de càlcul de les comandes
 * (Extensions → Apps Script des del mateix full). Veure LLEGEIX-ME.md.
 *
 * Pestanya «Comandes»: una fila per comanda, amb tota la informació. Cada comanda
 * entra com a «Per fer»; el generador de plaques llegeix directament aquesta
 * pestanya i agafa les files «Per fer». No hi ha cap fórmula que es pugui trencar.
 */

var FULL_COMANDES = 'Comandes';
var CAPCALERA = ['Data', 'Referència', 'Logotip', 'Correu', 'Text a gravar', 'Model', 'Mida lletra (mm)', 'Estat', 'Confirmació', 'Avís recollida'];
/* Codi que es desa a la columna «Model»: el que llegeix el generador de peces 3D.
   Va per logotip: Escorial → A granat, A blanc, B; Pro → A, B.
   La web envia el codi intern (Pro A / Pro B): aquí es tradueix. */
var CODIS = {
  'Vedruna Escorial Vic': { 'A granat': 'A granat', 'A blanc': 'A blanc', 'B': 'B' },
  'Vedruna Pro Vic':      { 'Pro A': 'A', 'Pro B': 'B', 'A': 'A', 'B': 'B' }
};
// El nom que veu la mestra (el mateix que a la web)
var NOM_MODEL = {
  'Vedruna Escorial Vic': { 'A granat': 'Clàssic granat', 'A blanc': 'Clàssic blanc', 'B': 'Etiqueta' },
  'Vedruna Pro Vic':      { 'A': 'Clàssic', 'B': 'Etiqueta' }
};
function nomModel_(escola, codi) { return (NOM_MODEL[escola] && NOM_MODEL[escola][codi]) || codi; }

/**
 * Executa-la UN COP des de l'editor (botó ▶): passa les comandes de Pro ja apuntades
 * de «Pro A» / «Pro B» a «A» / «B», com vol el generador de peces.
 */
function arreglaCodisPro() {
  var sh = full_(), n = sh.getLastRow();
  if (n < 2) return 'No hi ha comandes.';
  var r = sh.getRange(2, 3, n - 1, 4), v = r.getValues(), canvis = 0;   // columnes C (Logotip) a F (Model)
  for (var i = 0; i < v.length; i++) {
    var escola = v[i][0], model = v[i][3];
    if (escola === 'Vedruna Pro Vic' && (model === 'Pro A' || model === 'Pro B')) {
      sh.getRange(i + 2, 6).setValue(CODIS[escola][model]); canvis++;
    }
  }
  return canvis + ' comandes de Vedruna Pro Vic arreglades.';
}
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

var ESTAT_NOU = 'Per fer';   // estat amb què entra cada comanda (desplegable: Per fer, Imprimint, Acabat)

/**
 * Executa-la des de l'editor (botó ▶) si mai hi ha comandes amb l'estat buit:
 * les marca com a «Per fer». (El generador de plaques llegeix directament «Comandes»
 * i agafa les files «Per fer»: no cal cap pestanya de producció ni cap fórmula.)
 */
function marcaPerFer() {
  var sh = full_(), n = sh.getLastRow(), posades = 0;
  if (n > 1) {
    var v = sh.getRange(2, 6, n - 1, 3).getValues();         // F (Model) a H (Estat)
    for (var i = 0; i < v.length; i++) if (v[i][0] !== '' && v[i][2] === '') { sh.getRange(i + 2, 8).setValue(ESTAT_NOU); posades++; }
  }
  return posades + ' comandes sense estat marcades com a «' + ESTAT_NOU + '».';
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
    var codis = CODIS[String(d.escola || '')];
    if (codis && codis[model]) model = codis[model];
    var escola = String(d.escola || '');
    var ref = net_(d.ref, 20);
    var mida = Number(d.midaLletra) || '';
    // la foto 3D que fa la web del seu portatargetes (JPEG en base64); si no hi és o és massa gran, el correu en fa servir una de genèrica
    var foto = typeof d.foto === 'string' && d.foto.length < 600000 && /^[A-Za-z0-9+\/=]+$/.test(d.foto) ? d.foto : '';

    if (ESCOLES_VALIDES.indexOf(escola) < 0) return json_({ ok: false, error: 'Logotip desconegut.' });
    if (!codis || !codis[model]) return json_({ ok: false, error: 'Model desconegut.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correu)) return json_({ ok: false, error: 'Falta un correu electrònic vàlid.' });
    if (!ref) return json_({ ok: false, error: 'Falta la referència.' });

    var sh = full_();
    if (!sh.getRange(1, 9).getValue()) sh.getRange(1, 9).setValue('Confirmació').setFontWeight('bold');
    // si el navegador ha enviat la mateixa comanda dues vegades, no es duplica (ni es torna a enviar el correu)
    if (filaDe_(sh, ref)) return json_({ ok: true, ref: ref, repetida: true });
    sh.appendRow([new Date(), ref, escola, segur_(correu), segur_(text), model, mida, ESTAT_NOU, '']);
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
    htmlBody: '',
    body: textCorreu_({ ref: ref, escola: escola, model: model, text: text })
  };
  // La imatge va SEMPRE dins del correu (no enllaçada a la web): així es veu a tots els programes de correu,
  // també els que no carreguen imatges de fora o les van a buscar abans que la web estigui publicada.
  var blob = null;
  if (fotoB64) blob = Utilities.newBlob(Utilities.base64Decode(fotoB64), 'image/jpeg', ref + '.jpg');
  else { try { blob = UrlFetchApp.fetch(WEB + 'assets/img/correu.jpg').getBlob().setName('portatargetes.jpg'); } catch (x) { blob = null; } }
  if (blob) opcions.inlineImages = { portatargetes: blob };
  opcions.htmlBody = htmlCorreu_({ ref: ref, escola: escola, model: model, text: text, mida: mida, foto: blob ? 'cid:portatargetes' : '' });
  MailApp.sendEmail(opcions);
}

function textCorreu_(c) {
  return 'Comanda ' + c.ref + ' rebuda.\n\n' +
    'Logotip: ' + c.escola + '\nModel: ' + nomModel_(c.escola, c.model) + '\nText a la tapa: ' + (c.text ? '«' + c.text + '»' : 'sense nom') +
    '\n\nS\'imprimirà exactament així. Si hi ha alguna cosa que no està bé, respon aquest correu.\n\n' + WEB;
}

/* El correu, amb el mateix aire que la web: fosc, filets prims, xifres en mm.
   Fet amb taules i estils en línia perquè es vegi bé a Gmail, Outlook i al mòbil. */
function htmlCorreu_(c) {
  var e = function (v) { return String(v).replace(/[&<>"]/g, function (x) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[x]; }); };
  var F = "'Fira Sans','Helvetica Neue',Helvetica,Arial,sans-serif";
  var MONO = "'Fira Code',Menlo,Consolas,'Courier New',monospace";
  var mono = function (t, color) { return '<span style="font-family:' + MONO + ';font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:' + (color || '#a8999d') + '">' + t + '</span>'; };
  var nomModel = nomModel_(c.escola, c.model);
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

/* ═══════════════════════════ AVÍS DE RECOLLIDA ═══════════════════════════
   Al full surt un menú «Portatargetes». Selecciones les files de qui ja el té
   imprès, tries «Avisa que ja el poden recollir», confirmes, i cada persona rep
   UN correu (amb tots els seus portatargetes, si en té més d'un). La columna
   «Avís recollida» guarda quan se li va enviar: una fila avisada no es torna a enviar. */

var COL_AVIS = 10;   // columna J
var LLOC_RECOLLIDA = 'Porteria de Santa Joaquima';
var VIDEO = WEB + 'com-funciona.html';

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Portatargetes')
    .addItem('Avisa que ja el poden recollir (files seleccionades)', 'avisaRecollida')
    .addSeparator()
    .addItem('Envia\'m una mostra del correu de recollida', 'provaRecollida')
    .addToUi();
}

function avisaRecollida() {
  var ui = SpreadsheetApp.getUi();
  var sh = SpreadsheetApp.getActive().getActiveSheet();
  if (sh.getName() !== FULL_COMANDES) {
    ui.alert('Ves a la pestanya «' + FULL_COMANDES + '» i selecciona les files de qui ja el pot recollir.');
    return;
  }
  if (!sh.getRange(1, COL_AVIS).getValue()) sh.getRange(1, COL_AVIS).setValue('Avís recollida').setFontWeight('bold');

  // files seleccionades (pot ser més d'una selecció, amb Ctrl)
  var files = {};
  sh.getActiveRangeList().getRanges().forEach(function (r) {
    for (var f = Math.max(2, r.getRow()); f <= r.getLastRow(); f++) files[f] = true;
  });
  var perCorreu = {}, ordre = [], jaAvisades = [], noAcabades = [], buides = 0;
  Object.keys(files).map(Number).sort(function (a, b) { return a - b; }).forEach(function (f) {
    var v = sh.getRange(f, 1, 1, COL_AVIS).getValues()[0];
    var ref = v[1], escola = v[2], correu = String(v[3]).replace(/^'/, '').trim(), text = String(v[4]).replace(/^'/, ''), model = v[5], estat = v[7], avis = v[9];
    if (!ref || !correu) { buides++; return; }
    if (avis) { jaAvisades.push(correu + ' (' + ref + ')'); return; }
    if (estat !== 'Acabat') noAcabades.push(correu + ' (' + ref + ', ' + (estat || 'sense estat') + ')');
    if (!perCorreu[correu]) { perCorreu[correu] = []; ordre.push(correu); }
    perCorreu[correu].push({ fila: f, ref: ref, escola: escola, model: model, text: text });
  });

  if (!ordre.length) {
    ui.alert('No hi ha ningú per avisar.' +
      (jaAvisades.length ? '\n\nAquestes ja estaven avisades:\n• ' + jaAvisades.join('\n• ') : '') +
      '\n\nSelecciona les files (clica el número de fila de l\'esquerra; amb Ctrl en pots triar més d\'una) i torna-ho a provar.');
    return;
  }
  var llista = ordre.map(function (c) {
    return '• ' + c + ' — ' + perCorreu[c].map(function (it) { return it.text ? '«' + it.text + '»' : 'sense nom'; }).join(', ');
  }).join('\n');
  var msg = 'S\'enviarà el correu de «ja el pots recollir» a ' + ordre.length + (ordre.length === 1 ? ' persona' : ' persones') + ':\n\n' + llista;
  if (noAcabades.length) msg += '\n\n⚠ Compte: aquestes no estan marcades com a «Acabat»:\n• ' + noAcabades.join('\n• ');
  if (jaAvisades.length) msg += '\n\nNo s\'enviarà a aquestes, perquè ja estaven avisades:\n• ' + jaAvisades.join('\n• ');
  msg += '\n\nEnvio els correus?';
  if (ui.alert('Avís de recollida', msg, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;

  var quota = MailApp.getRemainingDailyQuota(), enviats = 0, errors = [], pendents = [];
  var avui = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
  ordre.forEach(function (c) {
    if (enviats >= quota) { pendents.push(c); return; }
    try {
      correuRecollida_(c, perCorreu[c]);
      perCorreu[c].forEach(function (it) { sh.getRange(it.fila, COL_AVIS).setValue('Avisat ' + avui); });
      enviats++;
    } catch (err) { errors.push(c + ': ' + err.message); }
  });
  SpreadsheetApp.flush();
  ui.alert('Fet: ' + enviats + (enviats === 1 ? ' correu enviat.' : ' correus enviats.') +
    (pendents.length ? '\n\nAvui ja no queden correus disponibles. Demà torna a seleccionar aquestes:\n• ' + pendents.join('\n• ') : '') +
    (errors.length ? '\n\nNo s\'han pogut enviar:\n• ' + errors.join('\n• ') : ''));
}

function provaRecollida() {
  var jo = Session.getEffectiveUser().getEmail();
  correuRecollida_(jo, [{ ref: 'PT-PROVA', escola: 'Vedruna Escorial Vic', model: 'A granat', text: 'Nom Cognom' }]);
  try { SpreadsheetApp.getUi().alert('T\'he enviat una mostra a ' + jo + '.'); } catch (x) {}
  return 'Mostra enviada a ' + jo;
}

function correuRecollida_(correu, items) {
  var blob = null;
  try { blob = UrlFetchApp.fetch(WEB + 'assets/img/correu-video.jpg').getBlob().setName('video.jpg'); } catch (x) { blob = null; }
  var opcions = {
    to: correu,
    name: 'Portatargetes Vedruna',
    subject: items.length > 1 ? 'Els teus portatargetes ja t\'esperen a la porteria'
      : 'El teu portatargetes ja t\'espera a la porteria',
    body: 'Ja el pots recollir a la ' + LLOC_RECOLLIDA + '.\n\n' +
      items.map(function (it) { return '· ' + (it.text ? '«' + it.text + '»' : 'Sense nom') + ' — ' + nomModel_(it.escola, it.model) + ', ' + it.escola + ' (' + it.ref + ')'; }).join('\n') +
      '\n\nCom es munta (vídeo de 2 minuts): ' + VIDEO,
    htmlBody: htmlRecollida_(items, blob ? 'cid:video' : WEB + 'assets/img/correu-video.jpg')
  };
  if (blob) opcions.inlineImages = { video: blob };
  MailApp.sendEmail(opcions);
}

function htmlRecollida_(items, imatge) {
  var e = function (v) { return String(v).replace(/[&<>"]/g, function (x) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[x]; }); };
  var F = "'Fira Sans','Helvetica Neue',Helvetica,Arial,sans-serif";
  var MONO = "'Fira Code',Menlo,Consolas,'Courier New',monospace";
  var mono = function (t, color) { return '<span style="font-family:' + MONO + ';font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:' + (color || '#a8999d') + '">' + t + '</span>'; };
  var plural = items.length > 1;
  var escoles = items.map(function (it) { return it.escola; }).filter(function (x, i, a) { return a.indexOf(x) === i; }).join(' · ');
  var fitxes = items.map(function (it) {
    return '<tr><td style="padding:16px 0;border-bottom:1px solid #2e2226">' +
      '<span style="font-family:' + F + ';font-size:24px;line-height:1.25;font-weight:700;color:#efe9e2">' + (it.text ? '«' + e(it.text) + '»' : 'Sense nom') + '</span><br>' +
      mono(e(nomModel_(it.escola, it.model)) + ' &nbsp;·&nbsp; ' + e(it.escola) + ' &nbsp;·&nbsp; ' + e(it.ref)) + '</td></tr>';
  }).join('');
  var consell = function (n, titol, text) {
    return '<td width="33%" valign="top" style="padding:14px 12px 0 0;border-top:2px solid #3a2a2f">' + mono(n, '#ff4d73') +
      '<br><span style="font-family:' + F + ';font-size:15px;line-height:1.35;font-weight:500;color:#efe9e2">' + titol + '</span>' +
      '<br><span style="font-family:' + F + ';font-size:13px;line-height:1.45;color:#a8999d">' + text + '</span></td>';
  };
  return '<!doctype html><html lang="ca"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">' +
    '<style>@import url(https://fonts.googleapis.com/css2?family=Fira+Code:wght@400&family=Fira+Sans:wght@200;400;500;700&display=swap);' +
    '@media (max-width:620px){.pad{padding-left:22px!important;padding-right:22px!important}.titol{font-size:34px!important}.nomob{display:none!important}' +
    '.col{display:block!important;width:100%!important;padding-right:0!important;margin-bottom:14px}}</style></head>' +
    '<body style="margin:0;padding:0;background:#0b0608" bgcolor="#0b0608">' +
    '<div style="display:none;max-height:0;overflow:hidden">Ja el pots recollir a la ' + e(LLOC_RECOLLIDA) + '. I aquí tens el vídeo de com es munta.</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0b0608" style="background:#0b0608"><tr><td align="center" style="padding:28px 10px">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#110a0d;border:1px solid #2e2226" bgcolor="#110a0d">' +

    // capçalera HUD
    '<tr><td class="pad" style="padding:22px 40px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
      '<td class="nomob">' + mono('Portatargetes Vedruna') + '</td>' +
      '<td align="right" style="white-space:nowrap">' + mono('<span style="color:#7fd3a8">&#9679;</span>&nbsp; Llest per recollir', '#efe9e2') + '</td>' +
    '</tr></table></td></tr>' +
    '<tr><td style="padding:18px 0 0"><div style="height:1px;line-height:1px;font-size:0;background:#c4123f;background:linear-gradient(90deg,#c4123f,#7a1f34 40%,#110a0d)">&nbsp;</div></td></tr>' +

    // titular
    '<tr><td class="pad" style="padding:38px 40px 0">' + mono(e(escoles)) +
      '<h1 class="titol" style="margin:14px 0 0;font-family:' + F + ';font-weight:200;font-size:44px;line-height:1.02;letter-spacing:-1px;color:#efe9e2">' +
      (plural ? 'Ja els pots' : 'Ja el pots') + '<br><b style="font-weight:700">venir a buscar.</b></h1>' +
      '<div style="width:64px;height:3px;background:#c4123f;margin-top:18px;font-size:0;line-height:0">&nbsp;</div></td></tr>' +

    // on
    '<tr><td class="pad" style="padding:30px 40px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1a0f13;border:1px solid #3a2a2f;border-left:3px solid #c4123f"><tr><td style="padding:20px 22px">' +
      mono('On el recolliràs') + '<br><span style="font-family:' + F + ';font-size:26px;line-height:1.25;font-weight:700;color:#efe9e2">' + e(LLOC_RECOLLIDA) + '</span>' +
      '<br><span style="font-family:' + F + ';font-size:15px;line-height:1.5;color:#c9bfc2">Demana-hi ' + (plural ? 'els teus portatargetes' : 'el teu portatargetes') + ' i ja ' + (plural ? 'te\'ls' : 'te\'l') + ' pots endur.</span>' +
    '</td></tr></table></td></tr>' +

    // què recull
    '<tr><td class="pad" style="padding:30px 40px 0">' + mono(plural ? 'Els teus portatargetes' : 'El teu portatargetes') +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px">' + fitxes + '</table></td></tr>' +

    // vídeo
    '<tr><td class="pad" style="padding:38px 40px 0">' + mono('Abans d\'estrenar-' + (plural ? 'los' : 'lo')) +
      '<h2 style="margin:10px 0 0;font-family:' + F + ';font-weight:200;font-size:30px;line-height:1.1;letter-spacing:-.5px;color:#efe9e2">Com es munta, <b style="font-weight:700">en 2 minuts.</b></h2>' +
      '<p style="margin:10px 0 0;font-family:' + F + ';font-size:15px;line-height:1.55;color:#c9bfc2">Posar-hi la targeta, tancar la tapa amb un clic i, si mai cal, treure-la. Sense cap eina.</p></td></tr>' +
    '<tr><td style="padding:22px 0 0" align="center"><a href="' + VIDEO + '" style="text-decoration:none;display:block">' +
      '<img src="' + imatge + '" width="600" alt="Mira el vídeo: com es munta el portatargetes (2:20)" style="display:block;width:100%;max-width:600px;height:auto;border:0"></a></td></tr>' +
    '<tr><td class="pad" align="center" style="padding:24px 40px 0">' +
      '<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#c4123f" style="background:#c4123f">' +
      '<a href="' + VIDEO + '" style="display:inline-block;padding:16px 34px;font-family:' + F + ';font-size:16px;font-weight:500;color:#ffffff;text-decoration:none;letter-spacing:.3px">&#9654;&nbsp;&nbsp;Mira el vídeo</a>' +
      '</td></tr></table></td></tr>' +

    // consells
    '<tr><td class="pad" style="padding:38px 40px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
      consell('01 · Muntar', 'Fins que faci «clic»', 'Llisca la tapa per les guies fins al final.').replace('<td width', '<td class="col" width') +
      consell('02 · Fitxar', 'No cal treure la targeta', 'Acosta el portatargetes al lector tal com és.').replace('<td width', '<td class="col" width') +
      consell('03 · Cuidar-lo', 'Lluny de la calor', 'Ni al sol dins el cotxe ni sobre un radiador.').replace('<td width', '<td class="col" width') +
    '</tr></table></td></tr>' +

    // peu
    '<tr><td class="pad" style="padding:36px 40px 30px">' +
      '<div style="height:1px;line-height:1px;font-size:0;background:#2e2226">&nbsp;</div>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px"><tr>' +
      '<td class="nomob">' + mono('60 × 110 × 4,2 mm · imprès en 3D', '#6f6064') + '</td>' +
      '<td align="right" style="white-space:nowrap"><a href="' + VIDEO + '" style="font-family:' + MONO + ';font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:#ff4d73;text-decoration:none">Vídeo &rarr;</a></td>' +
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
