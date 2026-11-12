# Portatargetes Vedruna — la web

Web on cada mestre veu l'anunci, tria logotip (Vedruna Escorial Vic o Vedruna
Pro Vic), tria model, hi escriu el nom i en fa la comanda. Les comandes
s'apunten soles a un full de càlcul de Google.

Es veu igual a l'ordinador i al mòbil.

## Què hi ha

| Fitxer | Què és |
|---|---|
| `index.html` | la pàgina |
| `css/estil.css` | el disseny |
| `js/app.js` | l'anunci, els models en 3D, la previsualització del nom i l'enviament |
| `js/config.js` | **l'adreça del full de càlcul** (l'únic fitxer que s'ha de tocar) |
| `assets/` | models 3D (GLB), dibuix del darrere de cada model (SVG), tipografia Fira Sans i miniatures |
| `apps-script/Code.gs` | el codi que rep les comandes i les escriu al full |
| `anunci/` | l'anunci gravat en vídeo (MP4), per passar-lo per WhatsApp o ensenyar-lo en una reunió |

## Com funciona

1. **Anunci** (~15 s, en 3D i en directe): el portatargetes arriba volant, gira,
   s'hi escriu un nom a la tapa i apareixen els cinc models. Es pot saltar.
   Qui té activat «reduir el moviment» al dispositiu entra directament a la tria.
2. **Quin logotip vols?**: dos grans botons, cadascun amb els seus models en 3D al damunt.
   Clicar directament un dels portatargetes porta al configurador d'aquell model.
   Models: Escorial Vic → Clàssic granat, Clàssic blanc, Etiqueta; Pro Vic → Clàssic, Etiqueta.
   Al full hi van els codis del generador de peces: Escorial → A granat, A blanc, B;
   Pro → A, B (la columna Logotip diu de quina escola és).
3. **Configurador**:
   - el model gira sol; es pot arrossegar amb el dit o el ratolí, o prémer *Davant* / *Darrere*;
   - en escriure el text, el model es gira sol i el nom apareix gravat a la tapa;
   - el text es mesura com a la producció: lletra de 6 mm, amplada màxima de 44 mm;
     si no hi cap, la lletra baixa fins a 4,8 mm; per sota d'això, avisa que cal
     escurçar-lo i no deixa enviar;
   - a sota hi ha la tapa a mida real, exactament com sortirà a imprimir.
4. **Correu i enviament**: la mestra hi posa el seu correu electrònic; resum amb la tapa dibuixada, i la comanda s'apunta al full
   amb una referència (`PT-XXXXXX`).

Sense full connectat (`endpoint` buit a `js/config.js`) la web funciona en
**mode de prova**: es pot fer tot, però surt un avís que la comanda no s'ha guardat.

## Connectar-la al full de càlcul (un sol cop)

1. Crea un full de càlcul nou a Google Drive, per exemple «Comandes portatargetes».
2. Al full: **Extensions → Apps Script**. Esborra el que hi ha, enganxa-hi tot
   el contingut de `apps-script/Code.gs` i desa (icona del disquet).
3. A dalt, tria la funció **`prepara`** i prem **▶ Executa**. Google demanarà
   permís per accedir al full: accepta'l. Això crea la pestanya «Comandes».
4. **Implementa → Implementació nova** → a la rodeta, tria **Aplicació web**:
   - *Executa com a*: **Jo**
   - *Qui hi té accés*: **Qualsevol usuari**

   Prem **Implementa** i copia l'URL que acaba en `/exec`.
5. Aquella URL va a `js/config.js`, dins de `endpoint: ''`.
6. Executa també la funció **`provaCorreu`** (▶): demana el permís per enviar
   els correus de confirmació i te n'envia un de prova.

Això d'implementar només es fa **aquest primer cop**. Si més endavant es toca
`Code.gs`, cal fer *Implementa → Gestiona les implementacions → editar → Versió
nova* perquè la web faci servir el codi nou.

## Que no se'n perdi cap

- **Moltes alhora:** el full rep les comandes una darrere l'altra (torn de 20 s
  com a màxim). Si una no entrés, la mestra veu un error, no un «Apuntat!».
- **«Apuntat!» només si és al full.** La web només ho diu quan el full ha
  contestat que l'ha desada. Si la resposta es perd pel camí, la web pregunta al
  full si la referència hi és abans de dir res.
- **Tornar a prémer el botó és segur.** Mentre la comanda sigui la mateixa, es
  reenvia amb la mateixa referència i el full no l'apunta dues vegades.
- **Sense connexió:** surt «La comanda NO consta com a enviada».
- **Correu de confirmació:** cada mestra rep un correu amb el disseny de la web,
  una foto en 3D del SEU portatargetes amb el seu nom (la fa la web en enviar),
  el logotip, el model, el text i la referència. `provaCorreu` n'envia un d'exemple. La columna **Confirmació** del full diu si s'ha enviat.
  Qui diu que ja va triar i no té el correu, no va arribar a fer la comanda.
  (Límit de Google: 100 correus al dia amb un compte normal.)

## Les comandes

- Pestanya **Comandes**: una fila per comanda (data, referència, logotip,
  correu, text a gravar, model, mida de la lletra, estat).
- Columna **Estat** (desplegable): cada comanda entra com a **Per fer**; quan va a
  una placa, **Imprimint**; quan és feta, **Acabat**. El generador de plaques de la
  Bambu Lab P1S llegeix directament «Comandes» i agafa les files «Per fer» (no hi
  ha pestanya de producció: en un full en català, les fórmules escrites des de
  l'script sortien amb comes i donaven #ERROR!). `marcaPerFer` posa «Per fer» a
  les comandes que no tinguin estat.
- Si el navegador d'algú envia la mateixa comanda dues vegades, només s'apunta un cop.
- El text es guarda exactament com l'ha escrit la mestra (majúscules, accents,
  ç, l·l). Un text que comenci per `=`, `+`, `-` o `@` es desa amb un apòstrof
  davant perquè el full no el prengui per una fórmula; a la baixada en CSV
  l'apòstrof no hi surt.

## Avisar que ja el poden recollir

Al full hi ha un menú **Portatargetes** (surt en obrir el full):

1. A «Comandes», selecciona les files de qui ja el té imprès (clica el número de
   fila; amb Ctrl en tries més d'una).
2. **Portatargetes → Avisa que ja el poden recollir (files seleccionades)**.
3. Surt la llista de qui el rebrà (i un avís si alguna fila no està «Acabat»).
   Confirma-ho.

Cada persona rep un sol correu (amb tots els seus portatargetes): on recollir-lo
(Porteria de Santa Joaquima), què recull i un botó al vídeo de com es munta
(`com-funciona.html`). La columna **Avís recollida** guarda quan se li va enviar;
una fila ja avisada no es torna a enviar. **Envia'm una mostra** te n'envia un a tu.

## Publicar-la

És una web estàtica: va a GitHub Pages tal com és, sense compilar res.
La biblioteca 3D (three.js 0.160.0) es carrega de `cdn.jsdelivr.net`.

Per revisar l'anunci des d'un moment concret: `?t=9` (segons). Per anar directe
a la tria de logotip: `?sense-anunci`.

## Detalls tècnics

- Els GLB venen en metres i centrats; a `js/app.js` es passen a mm amb l'origen
  a la cantonada, com els SVG, i s'hi afegeix l'anella del clauer.
- Els colors dels GLB són valors sRGB escrits com a lineals: es tornen a
  interpretar perquè el granat sigui de debò `#7a1f34`.
- El darrere de cada model en 3D és el SVG de producció (amb el nom ja posat)
  pintat com a textura a tocar de la cara del darrere. La tipografia va
  incrustada al SVG perquè el nom surti en Fira Sans Bold també dins del 3D.
- La mesura del nom fa servir `getComputedTextLength()` amb la mateixa
  tipografia i el SVG en mm, com diu el material de producció.
