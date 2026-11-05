// Portatargetes Vedruna — anunci, tria d'escola i configurador en 3D.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ───────────────────────── dades ─────────────────────────
const ESCOLES = {
  escorial: { nom: 'Vedruna Escorial Vic' },
  pro:      { nom: 'Vedruna Pro Vic' },
};
const MODELS = [
  { id: 'model_A_granat', nom: 'Clàssic granat', curt: 'Clàssic granat', codi: 'A granat', escola: 'escorial', h: 110.4,
    desc: "Cos granat amb el logo de l'escola incrustat i un filet blanc." },
  { id: 'model_A_blanc',  nom: 'Clàssic blanc',  curt: 'Clàssic blanc',  codi: 'A blanc',  escola: 'escorial', h: 110.4,
    desc: "Cos blanc amb el logo de l'escola i un filet granat." },
  { id: 'model_B',        nom: 'Etiqueta',         curt: 'Etiqueta',          codi: 'B',        escola: 'escorial', h: 113.4,
    desc: 'Forma d\'etiqueta, símbol bicolor gran i tall diagonal granat.' },
  { id: 'model_Pro_A',    nom: 'Clàssic',          curt: 'Clàssic',    codi: 'Pro A',    escola: 'pro',      h: 110.4,
    desc: 'Cos blanc, logo horitzontal i filet vermell.' },
  { id: 'model_Pro_B',    nom: 'Etiqueta',         curt: 'Etiqueta',    codi: 'Pro B',    escola: 'pro',      h: 113.4,
    desc: "Forma d'etiqueta amb el logo gran en vertical." },
];
const NOM = { mida: 6.0, min: 4.8, ampladaMax: 44.0 };
const DEF = Object.fromEntries(MODELS.map((d) => [d.id, d]));
const PX_MM = 12;                      // resolució de la textura del darrere
const INTRO_FI = 14.6;                 // durada de l'anunci (s)

const $ = (s) => document.querySelector(s);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const eOutExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const eInOut = (x) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const eOut = (x) => 1 - Math.pow(1 - x, 3);
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const angNorm = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ───────────────────────── estat ─────────────────────────
const S = {
  etapa: 'carrega', introT: 0, escola: null, model: null,
  text: '', ajust: { mida: NOM.mida, estat: 'buit', ample: 0 },
  yaw: 0, pitch: 0, yawVel: 0, yawObjectiu: null, gira: true, ultimToc: 0,
  hover: null, ratoli: { x: 0, y: 0 }, impuls: 0,
};

// ───────────────────────── escena ─────────────────────────
const canvas = $('#escena');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  document.body.classList.add('sense3d');
}
const mobil = () => innerWidth <= 760;
const scene = new THREE.Scene();
const FONS = new THREE.Color('#0b0608');
scene.background = FONS;
scene.fog = new THREE.FogExp2(FONS, 0.055);
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.05, 120);
camera.position.set(0, 0, 4.5);

let composer, bloom;
if (renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobil() ? 1.75 : 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // brillantor a resolució completa i només per a la llum de debò (línies, escàner): els models i l'anella no brillen
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.35, 1.6);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}

// llums
scene.add(new THREE.HemisphereLight(0xfff3ec, 0x1a0a10, 0.35));
const clau = new THREE.DirectionalLight(0xfff1e6, 1.7); clau.position.set(2.5, 3.5, 4); scene.add(clau);
const contra = new THREE.DirectionalLight(0xffe6ee, 1.1); contra.position.set(-3, 1, -4); scene.add(contra);
const vora = new THREE.PointLight(0xc4123f, 9, 9, 1.6); scene.add(vora);
const vora2 = new THREE.PointLight(0xff6f8f, 2.5, 7, 1.6); scene.add(vora2);

// terra: graella de taller que s'esvaeix
const terraMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uT: { value: 0 }, uA: { value: 0 }, uPols: { value: 0 } },
  vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `uniform float uT, uA, uPols; varying vec3 vW;
    void main(){
      vec2 c = vW.xz*4.0;
      vec2 g = abs(fract(c - .5) - .5)/fwidth(c);
      float l = 1.0 - min(min(g.x, g.y), 1.0);
      vec2 c2 = vW.xz*0.8;
      vec2 g2 = abs(fract(c2 - .5) - .5)/fwidth(c2);
      float l2 = 1.0 - min(min(g2.x, g2.y), 1.0);
      float d = length(vW.xz);
      float fade = smoothstep(8.5, 0.6, d);
      float ona = smoothstep(.35, 0., abs(d - mod(uT*1.4, 9.0))) * (.35 + uPols);
      vec3 col = mix(vec3(.42,.10,.17), vec3(1.,.25,.42), ona);
      float a = (l*.28 + l2*.45 + ona*(l*.9 + .05)) * fade * uA;
      gl_FragColor = vec4(col*(1.0 + ona*2.0), a);
    }`,
});
const terra = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), terraMat);
terra.rotation.x = -Math.PI / 2; terra.position.y = -0.92; scene.add(terra);

// halo sota el model
function texRadial(c0, c1) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'); const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, c0); g.addColorStop(1, c1); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const halo = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2),
  new THREE.MeshBasicMaterial({ map: texRadial('rgba(196,18,63,.9)', 'rgba(196,18,63,0)'), transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending }));
halo.rotation.x = -Math.PI / 2; halo.position.y = -0.915; scene.add(halo);

// estels de llum (velocitat)
const N_EST = mobil() ? 110 : 190;
const estels = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 0.012, 1),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), N_EST);
const estData = [];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
for (let i = 0; i < N_EST; i++) {
  const a = Math.random() * Math.PI * 2, r = 1.1 + Math.pow(Math.random(), .7) * 6;
  estData.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * .75, z: -40 + Math.random() * 44, v: .6 + Math.random() * .8 });
  const col = Math.random() < .62 ? new THREE.Color(3.2, .25, .7) : new THREE.Color(2.4, 2.2, 2.1);
  estels.setColorAt(i, col);
}
estels.frustumCulled = false; scene.add(estels);
let intensitat = 1;

// pols suspesa
const NP = mobil() ? 350 : 700;
const pg = new THREE.BufferGeometry(); const pp = new Float32Array(NP * 3);
for (let i = 0; i < NP; i++) { pp[i * 3] = (Math.random() - .5) * 14; pp[i * 3 + 1] = (Math.random() - .5) * 7; pp[i * 3 + 2] = (Math.random() - .5) * 14; }
pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
const pols = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffd9e2, size: 0.016, transparent: true, opacity: .55,
  depthWrite: false, blending: THREE.AdditiveBlending, map: texRadial('rgba(255,255,255,1)', 'rgba(255,255,255,0)') }));
scene.add(pols);

// làser d'escaneig
const escaner = new THREE.Group();
const escLinia = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.006),
  new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.2, 3.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
const gc = document.createElement('canvas'); gc.width = 4; gc.height = 128;
{ const x = gc.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, 'rgba(196,18,63,0)'); g.addColorStop(.5, 'rgba(196,18,63,.85)'); g.addColorStop(1, 'rgba(196,18,63,0)');
  x.fillStyle = g; x.fillRect(0, 0, 4, 128); }
const gt = new THREE.CanvasTexture(gc); gt.colorSpace = THREE.SRGBColorSpace;
const escGlow = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.22),
  new THREE.MeshBasicMaterial({ map: gt, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
escaner.add(escGlow, escLinia); escaner.visible = false; scene.add(escaner);
let escaneig = null; // {t0, dur, y0, y1, x, w, z}
function escaneja(x, w, z = 0.12, dur = 0.9, y0 = -0.75, y1 = 0.8) { escaneig = { t0: rellotge, dur, y0, y1, x, w, z }; }

// ───────────────────────── models ─────────────────────────
let fontB64 = '';
const SVG = {};          // text cru del darrere de cada model
const M = {};            // id → { holder, inner, decal, ctx, tex, p, t }

const cromat = new THREE.MeshStandardMaterial({ color: 0xb4b4bb, metalness: 1, roughness: .3, envMapIntensity: .6 });
function anella(h) {
  const r = new THREE.Mesh(new THREE.TorusGeometry(8, 0.85, 20, 72), cromat);
  r.rotation.y = Math.PI / 2;
  r.position.set(30, h - 6.6 + 8 - 0.85, 2.1);
  return r;
}

function preparaModel(def, gltf) {
  const inner = new THREE.Group();
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    // els colors del GLB són sRGB escrits com a lineals: es tornen a interpretar perquè el granat sigui #7a1f34
    const c = o.material.color ? o.material.color.clone().convertSRGBToLinear() : new THREE.Color(1, 1, 1);
    o.material = new THREE.MeshPhysicalMaterial({ color: c, roughness: .55, metalness: 0, clearcoat: .25, clearcoatRoughness: .4,
      flatShading: true, envMapIntensity: .3, side: THREE.DoubleSide });
  });
  // els GLB són en metres i centrats: es passen a mm amb l'origen a la cantonada, com els SVG
  let ref = null; gltf.scene.traverse((o) => { if (o.isMesh && !ref) ref = o; });
  gltf.scene.scale.setScalar(ref ? 1 / ref.scale.x : 1000);
  if (ref) gltf.scene.position.set(-ref.position.x / ref.scale.x, -ref.position.y / ref.scale.y, -ref.position.z / ref.scale.z);
  inner.add(gltf.scene);
  inner.add(anella(def.h));
  // el darrere: una làmina amb el dibuix exacte del SVG (i el nom), a tocar de la cara de darrere
  const cv = document.createElement('canvas'); cv.width = 60 * PX_MM; cv.height = Math.round(def.h * PX_MM);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(60, def.h),
    new THREE.MeshPhysicalMaterial({ map: tex, alphaTest: .5, roughness: .55, clearcoat: .25, clearcoatRoughness: .4, envMapIntensity: .3 }));
  decal.rotation.y = Math.PI; decal.position.set(30, def.h / 2, -0.06);
  inner.add(decal);
  inner.scale.setScalar(0.01);
  inner.position.set(-0.30, -def.h * 0.005, -0.021);
  const holder = new THREE.Group(); holder.add(inner); holder.visible = false; scene.add(holder);
  const p = { x: 0, y: 0, z: 0, s: 0, rx: 0, ry: 0, rz: 0 };
  M[def.id] = { def, holder, inner, cv, ctx: cv.getContext('2d'), tex, p, t: { ...p }, pintat: null };
}

function svgDoc(id, text, mida) {
  const doc = new DOMParser().parseFromString(SVG[id], 'image/svg+xml');
  const svg = doc.documentElement;
  svg.querySelectorAll('style').forEach((s) => s.remove());
  const t = svg.querySelector('#nom');
  t.textContent = text; t.setAttribute('font-size', mida.toFixed(2)); t.setAttribute('font-family', 'FiraNom');
  return { doc, svg, t };
}
function svgInline(id, text, mida) {
  const { svg, t } = svgDoc(id, text, mida);
  t.removeAttribute('id'); svg.removeAttribute('width'); svg.removeAttribute('height');
  svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', text ? `Tapa amb el text «${text}»` : 'Tapa sense text');
  return new XMLSerializer().serializeToString(svg);
}
function pintaDecal(id, text, mida) {
  const m = M[id]; if (!m) return;
  const clau = text + '|' + mida.toFixed(2);
  if (m.pintat === clau) return; m.pintat = clau;
  const { svg } = svgDoc(id, text, mida);
  svg.setAttribute('width', m.cv.width); svg.setAttribute('height', m.cv.height);
  const st = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  st.textContent = `@font-face{font-family:"FiraNom";font-weight:700;src:url(data:font/woff2;base64,${fontB64}) format("woff2")}`;
  svg.insertBefore(st, svg.firstChild);
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
  const img = new Image();
  img.onload = () => {
    if (m.pintat !== clau) { URL.revokeObjectURL(url); return; }
    m.ctx.clearRect(0, 0, m.cv.width, m.cv.height);
    m.ctx.drawImage(img, 0, 0, m.cv.width, m.cv.height);
    m.tex.needsUpdate = true; URL.revokeObjectURL(url);
  };
  img.src = url;
}

// mesura del nom (unitats = mm, com al SVG de producció)
const mesuraSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
mesuraSvg.setAttribute('viewBox', '0 0 200 20');
mesuraSvg.setAttribute('style', 'position:absolute;left:-9999px;top:0;width:200px;height:20px;visibility:hidden');
const mesuraTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
mesuraTxt.setAttribute('font-family', 'FiraNom'); mesuraTxt.setAttribute('font-weight', '700'); mesuraTxt.setAttribute('font-size', '6');
mesuraTxt.setAttribute('x', '0'); mesuraTxt.setAttribute('y', '10');
mesuraSvg.appendChild(mesuraTxt); document.body.appendChild(mesuraSvg);
function ajusta(text) {
  if (!text) return { mida: NOM.mida, estat: 'buit', ample: 0 };
  mesuraTxt.textContent = text;
  const L = mesuraTxt.getComputedTextLength();
  if (L <= NOM.ampladaMax) return { mida: NOM.mida, estat: 'ok', ample: L };
  const s = Math.floor(NOM.mida * NOM.ampladaMax / L * 10) / 10;
  if (s >= NOM.min) return { mida: s, estat: 'reduit', ample: L * s / NOM.mida };
  return { mida: NOM.min, estat: 'massa', ample: L * NOM.min / NOM.mida };
}

// ───────────────────────── càrrega ─────────────────────────
async function carrega() {
  const total = MODELS.length * 2 + 1; let fet = 0;
  const avan = () => { fet++; const pc = Math.round(fet / total * 100);
    $('#carrega-pc').textContent = pc; $('#carrega-fil').style.width = pc + '%'; };
  const fontP = fetch('assets/fonts/FiraSans-Bold.woff2').then((r) => r.arrayBuffer()).then((b) => {
    let s = ''; const u = new Uint8Array(b); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    fontB64 = btoa(s); avan(); });
  const loader = new GLTFLoader();
  const tasques = MODELS.flatMap((d) => [
    fetch(`assets/svg/${d.id}_darrere.svg`).then((r) => r.text()).then((t) => { SVG[d.id] = t; avan(); }),
    renderer ? loader.loadAsync(`assets/models3d/${d.id}.glb`).then((g) => { preparaModel(d, g); avan(); }) : Promise.resolve(avan()),
  ]);
  await Promise.all([fontP, ...tasques, document.fonts.load('700 10px FiraNom')]);
  try { await document.fonts.ready; } catch (e) { /* res */ }
  MODELS.forEach((d) => pintaDecal(d.id, '', NOM.mida));
}

// ───────────────────────── càmera i encaix ─────────────────────────
const cam = { pos: new THREE.Vector3(0, 0, 4.5), look: new THREE.Vector3(), offX: 0, offY: 0 };
const camObj = { dist: 4.5, y: 0, offX: 0, offY: 0 };
function encaix(w, h, reg) {
  const W = innerWidth, H = innerHeight, tg = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const dh = h * (H / reg.h) / (2 * tg);
  const dw = w * (W / reg.w) / (2 * tg * (W / H));
  return { dist: Math.max(dh, dw), offX: -((reg.x + reg.w / 2) - W / 2), offY: -((reg.y + reg.h / 2) - H / 2) };
}
function regioVisor() {
  const W = innerWidth, H = innerHeight;
  if (mobil()) { const vh = $('#panell').getBoundingClientRect().top || H * .46; return { x: 0, y: 0, w: W, h: vh - 50 }; }
  const pw = $('#panell').getBoundingClientRect().width || 440;
  return { x: pw, y: 0, w: W - pw, h: H - 70 };
}

// ───────────────────────── poses ─────────────────────────
function posa(m, o) { Object.assign(m.p, o); Object.assign(m.t, o); }
function aplicaPoses(dt, suau) {
  for (const id in M) {
    const m = M[id];
    if (suau) for (const k in m.p) m.p[k] = damp(m.p[k], m.t[k], k === 'ry' && S.etapa === 'config' ? 10 : 5.5, dt);
    const h = m.holder;
    h.position.set(m.p.x, m.p.y, m.p.z); h.rotation.set(m.p.rx, m.p.ry, m.p.rz); h.scale.setScalar(Math.max(m.p.s, 1e-4));
    h.visible = m.p.s > 0.004;
  }
}

// l'anunci, fotograma a fotograma (tot depèn només de t)
const ORDRE = MODELS.map((d) => d.id);
let R_ANELL = 1.45;
function poseAnell(i, t) {
  const a = i * Math.PI * 2 / 5 + (t - 8) * 0.75;
  return { x: Math.sin(a) * R_ANELL, y: 0.02, z: Math.cos(a) * R_ANELL - 0.2, ry: a, s: 1, rx: 0, rz: 0 };
}
function poseFila(i) { return { x: (i - 2) * 0.86, y: 0.16, z: 0, ry: 0, s: 1, rx: 0, rz: 0 }; }
function barreja(a, b, k) { const o = {}; for (const key in a) o[key] = lerp(a[key], b[key], k); return o; }

function intro(t) {
  const W = innerWidth, H = innerHeight;
  R_ANELL = W / H < .8 ? .98 : 1.45;   // al mòbil, el cercle més estret perquè ompli la pantalla
  // càmera
  const full = { x: 0, y: 0, w: W, h: H };
  const dHero = Math.max(2.5, encaix(0.7, 1.45, full).dist * (mobil() ? 1.05 : 1));
  const dAnell = encaix(R_ANELL * 2 + .8, 1.6, full).dist * (W / H < .8 ? 1.05 : 1.28);
  const dFila = encaix(4 * 0.86 + .9, 1.5, { x: 0, y: H * .06, w: W, h: H * .6 }).dist;
  let d = lerp(5.5, dHero, eInOut(seg(t, 1.4, 4.8)));
  d = lerp(d, dAnell, eInOut(seg(t, 7.7, 9.6)));
  d = lerp(d, dFila, eInOut(seg(t, 10.9, 12.5)));
  d *= 1 - 0.035 * seg(t, 12.5, INTRO_FI);
  const ang = Math.PI * eInOut(seg(t, 5.1, 6.5)) + Math.PI * eInOut(seg(t, 7.6, 9.6));
  let cy = lerp(0, 1.35, eInOut(seg(t, 7.7, 9.6)));
  cy = lerp(cy, 0.08, eInOut(seg(t, 10.9, 12.5)));
  const deriva = 0.18 * Math.sin(t * .6) * (1 - seg(t, 4.5, 5.2));
  cam.pos.set(Math.sin(ang) * d + deriva, cy, Math.cos(ang) * d);
  let ly = lerp(0, -0.32, eInOut(seg(t, 7.7, 9.6))); ly = lerp(ly, 0.12, seg(t, 10.9, 12.5));
  cam.look.set(0, ly, 0);
  const off = encaix(1, 1, { x: 0, y: 0, w: W, h: H * (t > 10.9 ? lerp(1, .74, eInOut(seg(t, 10.9, 12.5))) : 1) });
  // a l'ordinador el model s'aparta cap a la dreta mentre hi ha text a l'esquerra
  const aparta = mobil() ? 0 : seg(t, 1.6, 2.6) * (1 - eInOut(seg(t, 7.8, 8.8)));
  cam.offX = -W * .2 * eInOut(aparta); cam.offY = off.offY;

  // intensitat dels estels
  intensitat = t < 1.3 ? 1 : lerp(1, .1, eOut(seg(t, 1.3, 3.4)));
  intensitat += .55 * Math.sin(Math.PI * seg(t, 7.8, 9.8));
  terraMat.uniforms.uA.value = eOut(seg(t, 2.2, 4.2));
  halo.material.opacity = .5 * eOut(seg(t, 3.2, 4.6)) * (1 - seg(t, 7.8, 8.6)) + .25 * seg(t, 12, 13);

  // heroi: model A granat
  const heroi = M[ORDRE[0]];
  if (t < 8) {
    const e = eOutExpo(seg(t, 1.55, 4.5));
    posa(heroi, { x: 0, y: .02 * Math.sin(t * 1.4) * seg(t, 4.5, 5), z: lerp(-16, 0, e), s: t < 1.55 ? 0 : 1,
      ry: 7 * Math.PI * (1 - e), rx: 0, rz: .35 * (1 - e) });
  }
  // nom que s'escriu sol
  const mostra = 'Nom Cognom';
  const k = Math.round(mostra.length * seg(t, 6.3, 7.4));
  if (t > 5 && t < 9) pintaDecal(heroi.def.id, mostra.slice(0, k), NOM.mida);

  ORDRE.forEach((id, i) => {
    const m = M[id];
    if (t >= 8 && t < 10.9) {
      const e = eOut(seg(t, 8 + i * .07, 9.3 + i * .07));
      const ini = i === 0 ? { x: 0, y: 0, z: 0, ry: 0, s: 1, rx: 0, rz: 0 } : { x: 0, y: 0, z: -.4, ry: -Math.PI, s: 0, rx: 0, rz: 0 };
      posa(m, barreja(ini, poseAnell(i, t), e));
    } else if (t >= 10.9) {
      const an = poseAnell(i, 10.9); an.ry = angNorm(an.ry);
      const e = eInOut(seg(t, 10.9, 12.4));
      const f = poseFila(i); f.ry = .2 * Math.sin(t * .9) * seg(t, 12.4, 13.2);   // tots alhora: en paral·lel no es poden creuar
      f.y += .015 * Math.sin(t * 1.3 + i);
      posa(m, barreja(an, f, e));
    } else if (i > 0) posa(m, { s: 0 });
  });
  if (t >= 12.15 && t < 12.2 && !escaneig) escaneja(0, 5.2, .25, 1.1);

  // textos
  document.querySelectorAll('#intro [data-t]').forEach((el) => {
    const [a, b] = el.dataset.t.split(' ').map(Number);
    el.classList.toggle('on', t >= a && t < b);
  });
  const s = Math.floor(t), f = Math.floor((t % 1) * 24);
  $('#intro-tc').textContent = `00:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
}

// disposició de la tria d'escola
function layoutEscola() {
  const W = innerWidth, H = innerHeight;
  const esc = MODELS.filter((d) => d.escola === 'escorial'), pro = MODELS.filter((d) => d.escola === 'pro');
  const res = {};
  let e;
  if (mobil()) {
    const top = $('.escola-cap').getBoundingClientRect().bottom + 6;
    const bot = $('.escola-opcions').getBoundingClientRect().top - 6;
    const reg = { x: 0, y: top, w: W, h: Math.max(120, bot - top) };
    e = encaix(3 * .7 + .3, 2.75, reg);
    esc.forEach((d, i) => { res[d.id] = { x: (i - 1) * .74, y: .7, z: 0 }; });
    pro.forEach((d, i) => { res[d.id] = { x: (i - .5) * .74, y: -.72, z: 0 }; });
  } else {
    const top = $('.escola-cap').getBoundingClientRect().bottom;
    const bot = $('.escola-opcions').getBoundingClientRect().top;
    const reg = { x: 0, y: top, w: W, h: Math.max(160, bot - top) };
    e = encaix(1, 1.45, reg);
    const tg = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const visW = 2 * e.dist * tg * (W / H);
    const ample = Math.min(1100, W - 32) / W * visW;     // amplada de les dues opcions, en unitats de l'escena
    const cx = ample / 4 + ample * .02;
    // cada grup es queda dins la seva meitat: si no hi cap, els models es fan petits (mai s'aparten cap a l'altre logotip)
    const k = Math.min(1, ample * .42 / 2.2);
    const sep = .8 * k;
    esc.forEach((d, i) => { res[d.id] = { x: -cx + (i - 1) * sep, y: 0, z: 0, k }; });
    pro.forEach((d, i) => { res[d.id] = { x: cx + (i - .5) * sep, y: 0, z: 0, k }; });
  }
  return { cam: e, pos: res };
}

// ───────────────────────── etapes ─────────────────────────
function mostraEtapa(id) {
  ['intro', 'escola', 'config'].forEach((e) => { $('#' + e).hidden = e !== id; });
  S.etapa = id;
}

function comencaIntro() {
  S.introT = 0; mostraEtapa('intro');
  ORDRE.forEach((id) => posa(M[id], { s: 0, x: 0, y: 0, z: -16, rx: 0, ry: 0, rz: 0 }));
  pintaDecal(ORDRE[0], '', NOM.mida);
}

function entraEscola() {
  mostraEtapa('escola');
  $('#salta').blur();
  intensitat = Math.min(intensitat, .3);
  ORDRE.forEach((id) => pintaDecal(id, 'Nom Cognom', NOM.mida));
  ORDRE.forEach((id) => { M[id].t.s = 1; });
}

function entraConfig(escola) {
  S.escola = escola;
  $('#cfg-marca').textContent = ESCOLES[escola].nom;
  const llista = MODELS.filter((d) => d.escola === escola);
  const cont = $('#models'); cont.innerHTML = ''; cont.classList.toggle('n2', llista.length === 2);
  llista.forEach((d) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'model'; b.setAttribute('role', 'radio'); b.dataset.id = d.id; b.id = 'm-' + d.id;
    b.innerHTML = `<img src="assets/img/${d.id}_davant.webp" alt="" width="230" height="360"><span>${esc(d.curt)}</span>`;
    b.addEventListener('click', () => triaModel(d.id));
    cont.appendChild(b);
  });
  mostraEtapa('config');
  S.yaw = 0; S.gira = true; marcaCara('gira');
  MODELS.forEach((d) => pintaDecal(d.id, '', NOM.mida));
  const actual = S.model && DEF[S.model].escola === escola ? S.model : llista[0].id;
  S.model = null;
  triaModel(actual, true);
  refaText();
}

function triaModel(id, primer) {
  if (S.model === id) return;
  const anterior = S.model; S.model = id;
  document.querySelectorAll('.model').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.id === id)));
  $('#model-desc').textContent = DEF[id].desc;
  if (anterior && M[anterior] && M[id]) { M[anterior].t.s = 0; M[anterior].t.y = .5; M[anterior].t.ry = M[anterior].p.ry + Math.PI; }
  const m = M[id];
  if (m && !primer) { posa(m, { s: 0, y: -.45, x: 0, z: 0, rx: 0, rz: 0, ry: S.yaw - Math.PI * 1.5 }); escaneja(0, 1.1, .08, .9, -.7, .75); S.impuls = .5; }
  pintaDecal(id, S.text, S.ajust.mida);
  refaPrevis();
}

// ───────────────────────── interfície ─────────────────────────
function refaText() {
  const v = $('#text-nom').value.replace(/\s+/g, ' ').trim();
  S.text = v; S.ajust = ajusta(v);
  const a = S.ajust, fil = $('#regle-fil'), est = $('#mesura-estat'), det = $('#mesura-det');
  fil.style.width = Math.min(100, a.ample / NOM.ampladaMax * 100) + '%';
  fil.className = a.estat === 'massa' ? 'massa' : a.estat === 'reduit' ? 'reduit' : '';
  const mm = (x) => x.toFixed(1).replace('.', ',');
  est.className = 'xip ' + (a.estat === 'buit' ? '' : a.estat);
  if (a.estat === 'buit') { est.textContent = 'Sense nom'; det.textContent = 'La tapa anirà llisa'; }
  else if (a.estat === 'ok') { est.textContent = 'Hi cap'; det.textContent = `${mm(a.ample)} de 44 mm · lletra de 6 mm`; }
  else if (a.estat === 'reduit') { est.textContent = 'Lletra reduïda'; det.textContent = `lletra de ${mm(a.mida)} mm perquè hi càpiga`; }
  else { est.textContent = 'Massa llarg'; det.textContent = 'Escurça\'l una mica (fins a uns 16–18 caràcters)'; }
  if (S.model) pintaDecal(S.model, v, a.mida);
  refaPrevis();
}
function refaPrevis() {
  if (!S.model) return;
  $('#previs-svg').innerHTML = svgInline(S.model, S.text, S.ajust.mida);
}
function marcaCara(c) {
  ['davant', 'darrere', 'gira'].forEach((k) => $('#vc-' + k).setAttribute('aria-pressed', String(k === c)));
}
function giraA(cara) {
  if (cara === 'gira') { S.gira = true; S.yawObjectiu = null; marcaCara('gira'); return; }
  S.gira = false; marcaCara(cara);
  const base = cara === 'davant' ? 0 : Math.PI;
  S.yawObjectiu = S.yaw + angNorm(base - S.yaw);
  S.pitch = 0;
}

let tempsText;
$('#text-nom').addEventListener('input', () => {
  clearTimeout(tempsText); tempsText = setTimeout(refaText, 30);
  if (S.gira || Math.abs(angNorm(S.yaw - Math.PI)) > .6) giraA('darrere');
});
$('#previs-svg').addEventListener('click', () => giraA('darrere'));
document.querySelectorAll('.vc').forEach((b) => b.addEventListener('click', () => giraA(b.dataset.cara)));
document.querySelectorAll('.opcio').forEach((b) => {
  b.addEventListener('click', () => entraConfig(b.dataset.escola));
  b.addEventListener('pointerenter', () => { S.hover = b.dataset.escola; });
  b.addEventListener('pointerleave', () => { S.hover = null; });
  b.addEventListener('focus', () => { if (b.matches(':focus-visible')) S.hover = b.dataset.escola; });
  b.addEventListener('blur', () => { S.hover = null; });
});
$('#salta').addEventListener('click', entraEscola);
$('#reveure').addEventListener('click', comencaIntro);
$('#canvia-escola').addEventListener('click', () => { S.model = null; entraEscola(); });
try { const q = localStorage.getItem('pt-correu'); if (q) $('#correu').value = q; } catch (e) { /* res */ }
const CORREU_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function error(msg, on = '#error') { const e = $(on); e.textContent = msg || ''; e.hidden = !msg; }
$('#form').addEventListener('submit', (ev) => {
  ev.preventDefault(); refaText();
  const correu = $('#correu').value.trim().toLowerCase();
  if (S.ajust.estat === 'massa') { error('El text és massa llarg per a la tapa. Escurça\'l una mica.'); $('#text-nom').focus(); return; }
  if (!CORREU_OK.test(correu)) { error(correu ? 'Aquest correu no sembla complet. Revisa\'l (ha de ser com nom@exemple.cat).' : 'Escriu el teu correu electrònic, perquè sapiguem de qui és.'); $('#correu').focus(); return; }
  error('');
  const d = DEF[S.model];
  $('#r-escola').textContent = ESCOLES[S.escola].nom;
  $('#r-model').textContent = d.nom;
  $('#r-text').textContent = S.text ? `«${S.text}»` : 'Sense nom (tapa llisa)';
  $('#r-qui').textContent = correu;
  $('#resum-svg').innerHTML = svgInline(S.model, S.text, S.ajust.mida);
  error('', '#error-envia');
  $('#revisa').hidden = false; $('#envia').focus();
  giraA('darrere');
});
$('#torna').addEventListener('click', () => { $('#revisa').hidden = true; $('#text-nom').focus(); });
$('#revisa').addEventListener('click', (e) => { if (e.target.id === 'revisa') $('#revisa').hidden = true; });

function novaRef() { return 'PT-' + Date.now().toString(36).slice(-4).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase(); }
async function enviaServidor(dades) {
  const url = (window.PT_CONFIG && window.PT_CONFIG.endpoint || '').trim();
  if (!url) return { prova: true };
  const cos = JSON.stringify(dades);
  try {
    const r = await fetch(url, { method: 'POST', body: cos, headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'El servidor no ha acceptat la comanda.');
    return j;
  } catch (e) {
    if (e instanceof TypeError) {   // el navegador no ens deixa llegir la resposta: s'envia igualment
      await fetch(url, { method: 'POST', body: cos, mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
      return { ok: true };
    }
    throw e;
  }
}
$('#envia').addEventListener('click', async () => {
  const b = $('#envia'); b.disabled = true; b.querySelector('span').textContent = 'Enviant…';
  const correu = $('#correu').value.trim().toLowerCase();
  const d = DEF[S.model];
  const dades = { ref: novaRef(), escola: ESCOLES[S.escola].nom, correu, text: S.text, model: d.codi, modelId: d.id, midaLletra: S.ajust.mida };
  try {
    const r = await enviaServidor(dades);
    try { localStorage.setItem('pt-correu', correu); } catch (e) { /* res */ }
    $('#revisa').hidden = true;
    $('#ok-ref').textContent = dades.ref;
    $('#ok-txt').textContent = `${d.nom} · ${ESCOLES[S.escola].nom}${S.text ? `, amb «${S.text}»` : ', sense nom'}. Quan estigui imprès, te'l farem arribar.`;
    $('#ok-prova').hidden = !r.prova;
    $('#enviat').hidden = false; $('#un-altre').focus();
    celebra();
  } catch (e) {
    error('No s\'ha pogut enviar. Comprova la connexió i torna-ho a provar. (' + e.message + ')', '#error-envia');
  } finally { b.disabled = false; b.querySelector('span').textContent = 'Envia la comanda'; }
});
$('#un-altre').addEventListener('click', () => {
  $('#enviat').hidden = true; $('#text-nom').value = ''; refaText(); giraA('gira'); $('#text-nom').focus();
});
function celebra() {
  S.gira = false; S.yawObjectiu = S.yaw + Math.PI * 2 + angNorm(Math.PI - S.yaw); marcaCara('darrere');
  S.impuls = 1.4; escaneja(0, 1.3, .1, 1.2, -.75, .8);
  terraMat.uniforms.uPols.value = 1.2;
}
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (!$('#revisa').hidden) $('#revisa').hidden = true; else if (S.etapa === 'intro') entraEscola(); }
});

// arrossegar per girar el model
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  if (S.etapa !== 'config') return;
  drag = { x: e.clientX, y: e.clientY, t: performance.now() }; canvas.setPointerCapture(e.pointerId);
  S.gira = false; S.yawObjectiu = null; S.yawVel = 0; marcaCara(null);
});
canvas.addEventListener('pointermove', (e) => {
  S.ratoli.x = e.clientX / innerWidth * 2 - 1; S.ratoli.y = e.clientY / innerHeight * 2 - 1;
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y, now = performance.now();
  S.yaw += dx * 0.011; S.pitch = clamp(S.pitch + dy * 0.006, -.5, .5);
  S.yawVel = dx * 0.011 / Math.max(1, now - drag.t) * 1000;
  drag = { x: e.clientX, y: e.clientY, t: now }; S.ultimToc = rellotge;
});
const deixa = () => { drag = null; S.ultimToc = rellotge; };
canvas.addEventListener('pointerup', deixa); canvas.addEventListener('pointercancel', deixa);
addEventListener('pointermove', (e) => { S.ratoli.x = e.clientX / innerWidth * 2 - 1; S.ratoli.y = e.clientY / innerHeight * 2 - 1; });

// ───────────────────────── bucle ─────────────────────────
let rellotge = 0, ant = performance.now();
const pausa = new URLSearchParams(location.search).has('pausa');
function redimensiona() {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  if (!renderer) return;
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', redimensiona);

function frame(now) {
  const dt = window.__dtFix || Math.min(.05, (now - ant) / 1000); ant = now; rellotge += dt;
  const W = innerWidth, H = innerHeight;

  if (S.etapa === 'intro') {
    if (!pausa) S.introT += dt;
    if (window.__dtFix) document.documentElement.classList.add('gravacio');
    intro(S.introT);
    aplicaPoses(dt, false);
    if (S.introT >= INTRO_FI) entraEscola();
  } else if (!Object.keys(M).length) {
    /* sense 3D: només la interfície */
  } else if (S.etapa === 'escola') {
    const L = layoutEscola();
    ORDRE.forEach((id, i) => {
      const m = M[id], q = L.pos[id], d = m.def;
      const hov = S.hover === d.escola, alt = S.hover && !hov;
      Object.assign(m.t, { x: q.x, y: q.y + .02 * Math.sin(rellotge * 1.2 + i) + (hov ? .05 : 0), z: hov ? .12 : (alt ? -.2 : 0),
        s: (q.k || 1) * (hov ? 1.06 : (alt ? .9 : 1)), rx: 0, rz: 0, ry: .2 * Math.sin(rellotge * .5) + (hov ? .25 * Math.sin(rellotge * 2) : 0) });   // tots giren alhora i en paral·lel
    });
    camObj.dist = damp(camObj.dist, L.cam.dist, 4, dt); camObj.offX = damp(camObj.offX, L.cam.offX, 4, dt);
    camObj.offY = damp(camObj.offY, L.cam.offY, 4, dt); camObj.y = damp(camObj.y, 0, 4, dt);
    intensitat = damp(intensitat, .1, 2, dt);
    terraMat.uniforms.uA.value = damp(terraMat.uniforms.uA.value, .8, 3, dt);
    halo.material.opacity = damp(halo.material.opacity, .18, 3, dt);
    aplicaPoses(dt, true);
  } else if (S.etapa === 'config') {
    const reg = regioVisor();
    const e = encaix(.75, 1.42, reg);
    // gir: automàtic, cap a una cara, o amb inèrcia
    if (S.yawObjectiu !== null) { S.yaw = damp(S.yaw, S.yawObjectiu, 6, dt); if (Math.abs(S.yaw - S.yawObjectiu) < .002) S.yawObjectiu = null; }
    else if (!drag) {
      S.yaw += S.yawVel * dt; S.yawVel = damp(S.yawVel, 0, 3, dt);
      if (S.gira) S.yaw += dt * .55;
      else if (rellotge - S.ultimToc > 6 && Math.abs(S.yawVel) < .05 && S.ultimToc > 0) { S.gira = true; marcaCara('gira'); }
    }
    if (!drag) S.pitch = damp(S.pitch, 0, 2.5, dt);
    for (const id in M) {
      const m = M[id];
      if (id === S.model) Object.assign(m.t, { x: 0, y: .015 * Math.sin(rellotge * 1.3), z: 0, s: 1, rx: S.pitch, rz: 0, ry: S.yaw });
      else m.t.s = 0;
    }
    camObj.dist = damp(camObj.dist, e.dist, 4, dt); camObj.offX = damp(camObj.offX, e.offX, 4, dt);
    camObj.offY = damp(camObj.offY, e.offY, 4, dt); camObj.y = damp(camObj.y, 0, 4, dt);
    intensitat = damp(intensitat, .08 + S.impuls * .6, 2.5, dt);
    S.impuls = damp(S.impuls, 0, 1.6, dt);
    terraMat.uniforms.uA.value = damp(terraMat.uniforms.uA.value, .9, 3, dt);
    terraMat.uniforms.uPols.value = damp(terraMat.uniforms.uPols.value, 0, 1.2, dt);
    halo.material.opacity = damp(halo.material.opacity, .42, 3, dt);
    aplicaPoses(dt, true);
  }

  if (S.etapa !== 'intro' && S.etapa !== 'carrega') {
    const px = S.etapa === 'escola' ? S.ratoli.x * .18 : 0, py = S.etapa === 'escola' ? -S.ratoli.y * .08 : 0;
    cam.pos.set(damp(cam.pos.x, px, 3, dt), damp(cam.pos.y, camObj.y + py, 3, dt), camObj.dist);
    cam.look.set(0, 0, 0);
    cam.offX = camObj.offX; cam.offY = camObj.offY;
  } else if (S.etapa === 'intro') {
    camObj.dist = cam.pos.length(); camObj.offX = cam.offX; camObj.offY = cam.offY; camObj.y = cam.pos.y;
  }
  camera.position.copy(cam.pos); camera.lookAt(cam.look);
  camera.setViewOffset(W, H, cam.offX, cam.offY, W, H);

  // el terra sempre per sota del model més baix (al mòbil la fila de baix hi quedava enfonsada)
  let baix = -0.92;
  for (const id in M) { const m = M[id]; if (m.p.s > .05) baix = Math.min(baix, m.p.y - .6 * m.p.s - .08); }
  terra.position.y = S.etapa === 'intro' ? baix : damp(terra.position.y, baix, 4, dt);
  halo.position.y = terra.position.y + .005;

  // estels
  for (let i = 0; i < N_EST; i++) {
    const s = estData[i];
    s.z += s.v * dt * (2 + intensitat * 38);
    if (s.z > 6) s.z -= 46;
    _p.set(s.x, s.y, s.z); _s.set(1, 1, .25 + intensitat * 3.2); _m.compose(_p, _q, _s); estels.setMatrixAt(i, _m);
  }
  estels.instanceMatrix.needsUpdate = true;
  estels.material.opacity = clamp(.15 + intensitat * .95);
  pols.rotation.y += dt * .02; pols.position.z = (pols.position.z + dt * intensitat * 6) % 4;

  // llums que ronden
  vora.position.set(Math.sin(rellotge * .7) * 2.4, 1.2 + Math.sin(rellotge * .4) * .4, -1.6 + Math.cos(rellotge * .7) * .8);
  vora2.position.set(Math.cos(rellotge * .5) * -2.6, -.6, 2.6);
  terraMat.uniforms.uT.value = rellotge;

  // escaneig
  if (escaneig) {
    const k = (rellotge - escaneig.t0) / escaneig.dur;
    if (k >= 1) { escaneig = null; escaner.visible = false; }
    else {
      escaner.visible = true;
      escaner.position.set(escaneig.x, lerp(escaneig.y0, escaneig.y1, eInOut(k)), escaneig.z);
      escaner.scale.set(escaneig.w, 1, 1);
      const a = Math.sin(Math.PI * k);
      escLinia.material.opacity = a; escGlow.material.opacity = a * .8;
    }
  }

  if (renderer && Object.keys(M).length) composer.render();
  if (!window.__manual) requestAnimationFrame(frame);
}

// per gravar l'anunci en vídeo fotograma a fotograma (?gravacio)
window.__pt = { S, pas(t) { S.introT = t; frame(performance.now()); } };
// ───────────────────────── arrencada ─────────────────────────
(async function () {
  try { await carrega(); }
  catch (e) { $('#carrega-pc').parentElement.textContent = 'No s\'ha pogut carregar. Torna a obrir la pàgina.'; console.error(e); return; }
  $('#carrega').classList.add('fora');
  if (!renderer) { canvas.hidden = true; entraEscola(); requestAnimationFrame(frame); return; }
  const params = new URLSearchParams(location.search);
  if (reduit || params.has('sense-anunci')) entraEscola(); else comencaIntro();
  if (params.has('t')) S.introT = parseFloat(params.get('t')) || 0;      // per revisar l'anunci des d'un punt
  requestAnimationFrame((n) => { ant = n; frame(n); });
})();
