import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* =========================================================
   ABORDAGE ROYAL — prototype 3D v0.4 (Three.js)
   ========================================================= */
const $ = s => document.querySelector(s);
const V3 = THREE.Vector3;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeOutBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const fmt = n => Math.floor(n).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ');
const QS = new URLSearchParams(location.search);

/* ---------------- STATE ---------------- */
const SAVE_KEY = 'abordage-royal-v2';
const ZMIN = .42, ZMAX = 3.4;
const DEF = { gold: 2500, gems: 150, tro: 0, xp: 0, lvl: 1, b: { tresor: 1, canon: 1, quai: 1 }, skin: 'classique', owned: ['classique'], lastSpin: '', stored: 120, lastTick: Date.now(), sound: true, barrels: 0, chests: ['argent'] };
let S;
try { S = Object.assign(structuredClone(DEF), JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) { S = structuredClone(DEF); }
S.b = Object.assign({ ...DEF.b }, S.b); if (!Array.isArray(S.chests)) S.chests = [];
if (QS.has('lv')) { const n = clamp(+QS.get('lv') || 1, 1, 5); S.b = { tresor: n, canon: n, quai: n }; }
const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { } };
const today = () => new Date().toDateString();

const PROD = [0, 1.4, 2.4, 3.8, 5.6, 8];          // or / seconde
const CAP = [0, 800, 1800, 3800, 8000, 16000];
const DMG = [0, 30, 40, 52, 66, 82];
const SHIPS = [0, 2, 3, 3, 4, 4];
const SHIPHP = [0, 320, 400, 480, 580, 700];
const BUILD = {
  tresor: { name: 'Trésor Royal', desc: "Ton coffre produit de l'or en continu. Améliore-le pour produire et stocker davantage.", cost: [0, 0, 900, 2600, 6500, 14000],
    stats: l => [['Production / h', PROD[l] * 3600, PROD[Math.min(5, l + 1)] * 3600, PROD[5] * 3600], ['Capacité', CAP[l], CAP[Math.min(5, l + 1)], CAP[5]]] },
  canon: { name: 'Batterie de Canons', desc: "Ta puissance de feu. Chaque niveau rend les boulets de ta flotte plus destructeurs en raid.", cost: [0, 0, 700, 2200, 5800, 12500],
    stats: l => [['Dégâts par boulet', DMG[l], DMG[Math.min(5, l + 1)], DMG[5]], ['Portée', 40 + l * 6, 40 + Math.min(5, l + 1) * 6, 70]] },
  quai: { name: 'Quai de la Flotte', desc: "Ton port d'attache. Plus il est grand, plus tu lances de navires (et plus solides) en raid.", cost: [0, 0, 1100, 3200, 7200, 15500],
    stats: l => [['Navires en raid', SHIPS[l], SHIPS[Math.min(5, l + 1)], SHIPS[5]], ['Coque (PV)', SHIPHP[l], SHIPHP[Math.min(5, l + 1)], SHIPHP[5]]] },
};
const xpNeed = l => 120 + l * 80;
/* chaque niveau = nouvelle couleur + nouvelle taille + nouveaux éléments */
const LV = [null,
  { name: 'Bois brut', col: '#c98a4b', scale: 1, pal: null, chest: null },
  { name: 'Bois & Fer rouge', col: '#e0483a', scale: 1.06,
    pal: { '15,3': { c: '#d0412f' }, '11,3': { c: '#b5703c' }, '5,3': { c: '#e0483a', k: .6 }, '7,3': { c: '#a9a3a0' }, '9,3': { c: '#e64b3c' } }, chest: { c: '#b8bcc6', m: .85, r: .35 } },
  { name: 'Pierre & Azur', col: '#3d8bff', scale: 1.12,
    pal: { '15,3': { c: '#2f6fd8' }, '11,3': { c: '#8a5a34' }, '13,3': { c: '#5b3a22' }, '7,3': { c: '#d7dde6' }, '3,3': { c: '#9eabbf' }, '5,3': { c: '#3a6fd0', k: .6, m: .4, r: .4 }, '9,3': { c: '#3d8bff' } }, chest: { c: '#e0b040', m: .9, r: .3 } },
  { name: 'Forteresse Améthyste', col: '#a24bff', scale: 1.2,
    pal: { '15,3': { c: '#8a3fe0', e: .15 }, '11,3': { c: '#6a3a26' }, '13,3': { c: '#3b2018' }, '7,3': { c: '#efe9f7' }, '3,3': { c: '#bcb0d6' }, '5,3': { c: '#8a3fe0', k: .6, e: .1 }, '9,3': { c: '#b06bff', e: .3 }, '1,3': { c: '#2a1838' } }, chest: { c: '#ffcf3a', m: 1, r: .25, e: .1 } },
  { name: "Palais d'Or", col: '#ffc83a', scale: 1.28,
    pal: { '15,3': { c: '#ffcf3a', m: 1, r: .28, e: .05 }, '11,3': { c: '#8e2a36' }, '13,3': { c: '#5a1018' }, '7,3': { c: '#fffaf0' }, '3,3': { c: '#f2e4c2' }, '5,3': { c: '#ffd54a', m: 1, r: .25, e: .08 }, '9,3': { c: '#ffe9a0', e: .2 }, '1,3': { c: '#3a0e18' } }, chest: { c: '#ffe070', m: 1, r: .25, e: .08 } },
];

const SKINS = {
  classique: { name: 'Corsaire Classique', rar: 'com', price: 0, cur: 'gems', desc: 'Le fidèle navire de tes débuts.', glow: '#8fb8ff' },
  pourpre: { name: 'Voiles Pourpres', rar: 'rare', price: 180, cur: 'gems', desc: 'Acajou verni, voiles pourpres et ferrures dorées.', glow: '#b36bff',
    pal: { '11,3': { c: '#a8582c' }, '13,3': { c: '#5a2a14' }, '5,3': { c: '#7d2fe0', k: .7 }, '9,3': { c: '#ffcc4d', m: 1, r: .3, e: .15 }, '1,3': { c: '#2a2230' }, '7,3': { c: '#e0c27a', m: .8, r: .3 } },
    flag: { '5,3': { c: '#4b148a' } } },
  abysse: { name: 'Flotte Abyssale', rar: 'epic', price: 450, cur: 'gems', desc: 'Coque des profondeurs et voiles bioluminescentes.', glow: '#19c8ff',
    pal: { '11,3': { c: '#1f3a66' }, '13,3': { c: '#0c1830' }, '5,3': { c: '#0fb4d8', k: .6, e: .45 }, '9,3': { c: '#5ff3ff', e: .9 }, '1,3': { c: '#081222' }, '3,3': { c: '#1c4a6e' }, '7,3': { c: '#3ad7ff', e: .5 } },
    flag: { '5,3': { c: '#062238' } } },
  kraken: { name: 'Kraken Écarlate', rar: 'epic', price: 650, cur: 'gems', desc: 'Coque noire, voiles de sang et runes de feu.', glow: '#ff3b2f', isNew: true,
    pal: { '11,3': { c: '#3a0d12' }, '13,3': { c: '#16060a' }, '5,3': { c: '#d0141f', k: .7, e: .18 }, '9,3': { c: '#ff5a2e', e: 1 }, '1,3': { c: '#120608' }, '3,3': { c: '#5a1a1a' }, '7,3': { c: '#ff6a3a', e: .6 } },
    flag: { '5,3': { c: '#0d0d0f' }, '9,3': { c: '#ff3b2f', e: 1 } } },
  royal: { name: 'Armada Royale', rar: 'epic', price: 900, cur: 'gems', model: 'royal', desc: 'Le vaisseau amiral de la Couronne : blanc, azur et or.', glow: '#4f8dff',
    pal: { '11,3': { c: '#f3ede2' }, '13,3': { c: '#1f4fa8' }, '15,3': { c: '#ffcf3a', m: 1, r: .25, e: .15 }, '9,3': { c: '#fffaf0', k: .5 }, '1,3': { c: '#1a1f2e' } },
    flag: { '9,3': { c: '#1f4fa8' } } },
  glacier: { name: 'Glacier Boréal', rar: 'leg', price: 6.99, cur: 'eur', desc: 'Taillé dans la glace éternelle, il brille sous les aurores.', glow: '#7ff0ff', isNew: true,
    pal: { '11,3': { c: '#dff3ff', r: .25 }, '13,3': { c: '#6fa8dc', r: .3 }, '5,3': { c: '#f4fbff', k: .5, e: .12 }, '9,3': { c: '#7ff0ff', e: 1 }, '1,3': { c: '#2a4a6e' }, '3,3': { c: '#a8d8ff', m: .8, r: .2 }, '7,3': { c: '#bff4ff', m: .6, r: .2, e: .4 } },
    flag: { '5,3': { c: '#3fb8ff', e: .3 } } },
  fantome: { name: 'Vaisseau Fantôme', rar: 'leg', price: 4.99, cur: 'eur', model: 'ship-ghost', desc: 'Revenu des abysses, ses voiles spectrales brillent dans la nuit.', glow: '#3dff9e',
    pal: { '3,2': { c: '#1d3b3a', e: .12 }, '1,3': { c: '#0a1414' } }, sail: { '3,2': { c: '#4fe8a4', k: .8, e: .38 } }, flag: { '3,2': { c: '#4fe8a4', k: .8, e: .38 } } },
  dore: { name: 'Galion Doré', rar: 'leg', price: 9.99, cur: 'eur', desc: "Coque en or massif, voiles d'ivoire : le trésor ultime des mers.", glow: '#ffc83a',
    pal: { '11,3': { c: '#ffcf3a', m: 1, r: .22, e: .08 }, '13,3': { c: '#8c1f2c' }, '5,3': { c: '#fff1d0', k: .6 }, '9,3': { c: '#ffe17a', m: 1, r: .2, e: .4 }, '1,3': { c: '#3a0e18' }, '3,3': { c: '#ffd76a', m: 1, r: .25 }, '7,3': { c: '#ffd76a', m: 1, r: .25 } },
    flag: { '5,3': { c: '#c8102e' } } },
};
const RAR = { com: 'COMMUN', rare: 'RARE', epic: 'ÉPIQUE', leg: 'LÉGENDAIRE' };

/* ---------------- RENDERER ---------------- */
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const DPR = Math.min(window.devicePixelRatio || 1, QS.has('lowdpr') ? 1 : 1.75);
renderer.setPixelRatio(DPR);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .96;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 1, 4200);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.42;

const SUN_DIR = new V3(0.6, 0.52, 0.46).normalize();
const FOG_COL = new THREE.Color('#a9d3f2');
scene.fog = new THREE.Fog(FOG_COL, 260, 1100);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.55, 1.1);
if (!QS.has('nobloom')) composer.addPass(bloom);
composer.addPass(new OutputPass());
/* étalonnage couleur « AAA » : contraste, saturation, ombres froides / lumières chaudes, vignette */
const gradePass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uAsp: { value: innerWidth / innerHeight } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uAsp; varying vec2 vUv;
  void main(){ vec3 c=texture2D(tDiffuse,vUv).rgb; float l=dot(c,vec3(.2126,.7152,.0722));
   c=mix(vec3(l),c,1.14); c=(c-.5)*1.07+.5;
   c+=vec3(-.012,.008,.035)*(1.-l)+vec3(.035,.016,-.02)*l;
   vec2 d=vUv-.5; d.x*=uAsp; float v=smoothstep(1.,.32,length(d)); c*=mix(.72,1.,v);
   gl_FragColor=vec4(clamp(c,0.,1.),1.); }`
});
if (!QS.has('nograde')) composer.addPass(gradePass);

/* lights */
const hemi = new THREE.HemisphereLight('#cfe4ff', '#9a7a48', .85);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffe8c8', 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -38; sun.shadow.camera.right = 38; sun.shadow.camera.top = 38; sun.shadow.camera.bottom = -38;
sun.shadow.camera.near = 5; sun.shadow.camera.far = 320;
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);
function sunFocus(x, z) { sun.target.position.set(x, 0, z); sun.position.set(x + SUN_DIR.x * 140, SUN_DIR.y * 140, z + SUN_DIR.z * 140); }
let sunKey = '';
function updSun() {
  const t = camState.target, h = clamp(camState.dist * .62, 38, 150);
  const key = `${Math.round(t.x / 5)},${Math.round(t.z / 5)},${Math.round(h / 8)}`; if (key === sunKey) return; sunKey = key;
  const sc = sun.shadow.camera; sc.left = -h; sc.right = h; sc.top = h; sc.bottom = -h; sc.far = 200 + h * 1.6; sc.updateProjectionMatrix();
  sunFocus(t.x, t.z);
}
sunFocus(0, 0);
const flashLights = [];
for (let i = 0; i < 4; i++) { const l = new THREE.PointLight('#ffa040', 0, 60, 1.6); scene.add(l); flashLights.push(l); }
let flashIdx = 0;
function flashLight(p, power = 1) { const l = flashLights[flashIdx++ % 4]; l.position.copy(p); l.position.y += 2; l.intensity = 900 * power; l.userData.p = power; }

/* sky */
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color('#1f63c9') }, hor: { value: new THREE.Color('#dcefff') }, warm: { value: new THREE.Color('#ffd9a6') }, sunDir: { value: SUN_DIR } },
  vertexShader: `varying vec3 vDir; void main(){ vDir=normalize(position); vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position=p.xyww; }`,
  fragmentShader: `uniform vec3 top,hor,warm,sunDir; varying vec3 vDir;
  void main(){ vec3 d=normalize(vDir); float h=clamp(d.y,0.,1.); vec3 c=mix(hor,top,pow(h,.5));
   float s=max(dot(d,sunDir),0.); c=mix(c,warm,pow(s,5.)*.55*(1.-h*.6));
   c+=vec3(1.,.92,.75)*pow(s,900.)*14.+vec3(1.,.85,.6)*pow(s,40.)*.35;
   if(d.y<0.) c=mix(hor,vec3(.55,.75,.9),clamp(-d.y*3.,0.,1.));
   gl_FragColor=vec4(c,1.);}`
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(3600, 32, 16), skyMat);
sky.frustumCulled = false; sky.renderOrder = -10;
scene.add(sky);

/* procedural textures */
function canvasTex(size, draw) { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const puffTex = canvasTex(128, (g, s) => {
  for (let i = 0; i < 14; i++) {
    const x = s / 2 + rand(-18, 18), y = s / 2 + rand(-18, 18), r = rand(22, 40);
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
});
const glowTex = canvasTex(64, (g, s) => { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); });
const cloudTex = canvasTex(256, (g, s) => {
  for (let i = 0; i < 26; i++) {
    const x = rand(50, 206), y = 150 - Math.abs(x - 128) * .35 + rand(-25, 15), r = rand(28, 58);
    const gr = g.createRadialGradient(x, y - r * .3, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.6, 'rgba(240,246,255,.6)'); gr.addColorStop(1, 'rgba(220,235,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
});

/* clouds */
const clouds = [];
for (let i = 0; i < 16; i++) {
  const m = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: rand(.75, 1), color: new THREE.Color().setScalar(rand(1.05, 1.35)) });
  const sp = new THREE.Sprite(m); const a = rand(0, Math.PI * 2), r = rand(1300, 2100);
  sp.position.set(Math.cos(a) * r, rand(160, 480), Math.sin(a) * r); const sc = rand(600, 1100); sp.scale.set(sc, sc * .5, 1);
  sp.userData.a = a; sp.userData.r = r; scene.add(sp); clouds.push(sp);
}

/* ---------------- ISLANDS ---------------- */
const HOME = { x: 0, z: 0, R: 25, seed: 1.3 };
// îles des autres joueurs (positions fixes sur la carte des mers)
const RSLOTS = [
  { x: 122, z: -50, R: 21, seed: 4.7 }, { x: -116, z: -80, R: 19, seed: 2.2 }, { x: -134, z: 62, R: 18, seed: 7.9 },
  { x: 18, z: -145, R: 20, seed: 5.5 }, { x: 102, z: 106, R: 19, seed: 3.1 }, { x: -24, z: 143, R: 17.5, seed: 6.4 },
];
const ENEMY = { ...RSLOTS[0] };          // île actuellement attaquée (réassignée à chaque raid)
const ISL = [HOME, ...RSLOTS];
function shoreR(I, a) { const s = I.seed; return I.R * (1 + .07 * Math.sin(3 * a + s) + .05 * Math.sin(5 * a + s * 2.3) + .03 * Math.sin(9 * a + s * 4.1)); }
function hash2(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y) { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy; const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy); const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1); return lerp(lerp(a, b, ux), lerp(c, d, ux), uy); }
function fbm(x, y) { return vnoise(x, y) * .5 + vnoise(x * 2.1, y * 2.1) * .3 + vnoise(x * 4.3, y * 4.3) * .2; }
function profile(rn) { return 1.8 - 1.15 * ss(.5, .68, rn) - .8 * ss(.76, 1.0, rn) - 2.6 * ss(1.0, 1.4, rn); }
function islandH(I, lx, lz) {
  const a = Math.atan2(lz, lx), rn = Math.hypot(lx, lz) / shoreR(I, a);
  return profile(rn) + (fbm(lx * .09 + I.seed * 10, lz * .09) - .5) * .9 * (1 - ss(.5, .72, rn));
}
function segDist(px, pz, ax, az, bx, bz) { const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz; const t = l2 ? clamp(((px - ax) * vx + (pz - az) * vz) / l2, 0, 1) : 0; return Math.hypot(px - ax - vx * t, pz - az - vz * t); }
function makeIsland(I, opt = {}) {
  const rings = opt.rings || 64, seg = opt.seg || 160, rMax = 1.42, paths = opt.paths || [];
  const pos = [], col = [], idx = [];
  const cG1 = new THREE.Color('#2c8a26'), cG2 = new THREE.Color('#62bd38'), cG3 = new THREE.Color('#9ad94e'), cDirt = new THREE.Color('#b98a52'), cPath = new THREE.Color('#d9b277'),
    cSand = new THREE.Color('#f0cd88'), cSand2 = new THREE.Color('#e2b46e'), cWet = new THREE.Color('#bf9258'), cUnder = new THREE.Color('#58c9bb'), cFlow = new THREE.Color('#f7e36a'), tmp = new THREE.Color();
  for (let i = 0; i <= rings; i++) {
    const k = i / rings, rnBase = k * rMax;
    for (let j = 0; j < seg; j++) {
      const a = j / seg * Math.PI * 2;
      const R = shoreR(I, a), r = rnBase * R;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const rn = rnBase;
      const y = islandH(I, x, z);
      pos.push(x, y, z);
      const n1 = fbm(x * .07 + 3, z * .07), n2 = vnoise(x * .25, z * .25), n3 = vnoise(x * .6 + 9, z * .6);
      // sable avec ondulations
      tmp.copy(cSand).lerp(cSand2, .5 + .5 * Math.sin(x * .9 + z * .4 + n1 * 6) * .6);
      tmp.lerp(cWet, ss(.88, .99, rn));
      tmp.lerp(cUnder, ss(1.0, 1.12, rn));
      const g = 1 - ss(.5, .6, rn + (n1 - .5) * .18);
      const grass = new THREE.Color().copy(cG1).lerp(cG2, ss(.25, .7, n1 * .7 + n2 * .3)).lerp(cG3, ss(.62, .9, n2 * .6 + n3 * .4) * .55);
      grass.lerp(cFlow, ss(.8, .9, n3) * .3);
      const edge = ss(.44, .55, rn + (n1 - .5) * .18) * g;
      grass.lerp(cDirt, edge * .4);
      let pd = 99; for (const p of paths) pd = Math.min(pd, segDist(x, z, p[0], p[1], p[2], p[3]));
      grass.lerp(cPath, (1 - ss(.7, 1.5, pd + (n2 - .5) * .7)) * .92);
      tmp.lerp(grass, g);
      col.push(tmp.r, tmp.g, tmp.b);
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
    const a = i * seg + j, b = i * seg + (j + 1) % seg, c = (i + 1) * seg + j, d = (i + 1) * seg + (j + 1) % seg;
    idx.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .93, metalness: 0 }));
  mesh.receiveShadow = true;
  const grp = new THREE.Group(); grp.position.set(I.x, 0, I.z); grp.add(mesh);
  grp.userData.ground = mesh;
  scene.add(grp);
  return grp;
}

/* ---------------- OCEAN ---------------- */
const NI = ISL.length;
const oceanU = {
  uTime: { value: 0 }, uSun: { value: SUN_DIR },
  uDeep: { value: new THREE.Color('#06356e') }, uMid: { value: new THREE.Color('#0d66ad') }, uShallow: { value: new THREE.Color('#3be6d4') },
  uSky: { value: new THREE.Color('#cfe7ff') }, uZen: { value: new THREE.Color('#3a7fdc') }, uFog: { value: FOG_COL }, uFogNear: { value: 260 }, uFogFar: { value: 1100 },
  uIsl: { value: ISL.map(I => new THREE.Vector4(I.x, I.z, I.R, I.seed)) },
};
const oceanMat = new THREE.ShaderMaterial({
  uniforms: oceanU, fog: false,
  vertexShader: `uniform float uTime; varying vec3 vW;
  float W(vec2 p){ return .24*sin(dot(p,vec2(.17,.06))+uTime*1.1)+.15*sin(dot(p,vec2(-.08,.21))+uTime*1.35)+.07*sin(dot(p,vec2(.33,-.29))+uTime*2.1); }
  void main(){ vec4 w=modelMatrix*vec4(position,1.); w.y+=W(w.xz); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `#define NI ${NI}
  uniform float uTime,uFogNear,uFogFar; uniform vec3 uSun,uDeep,uMid,uShallow,uSky,uZen,uFog; uniform vec4 uIsl[NI]; varying vec3 vW;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}
  float fbm(vec2 p){return noise(p)*.55+noise(p*2.07)*.3+noise(p*4.3)*.15;}
  float shoreR(vec4 I,float a){float s=I.w;return I.z*(1.+.07*sin(3.*a+s)+.05*sin(5.*a+s*2.3)+.03*sin(9.*a+s*4.1));}
  float islD(vec2 p){float d=1e4;for(int i=0;i<NI;i++){vec2 q=p-uIsl[i].xy;float L=length(q);if(L-uIsl[i].z*1.2<d){float a=atan(q.y,q.x);d=min(d,L-shoreR(uIsl[i],a)*.985);}}return d;}
  vec2 dW(vec2 p){ vec2 g=.24*cos(dot(p,vec2(.17,.06))+uTime*1.1)*vec2(.17,.06); g+=.15*cos(dot(p,vec2(-.08,.21))+uTime*1.35)*vec2(-.08,.21); g+=.07*cos(dot(p,vec2(.33,-.29))+uTime*2.1)*vec2(.33,-.29); return g; }
  void main(){
    vec2 p=vW.xz; vec2 g=dW(p);
    float dist=length(cameraPosition-vW);
    float lod=1.-smoothstep(250.,900.,dist);
    float e=.2; vec2 rp=p*.32+vec2(uTime*.11,uTime*.07);
    float n0=fbm(rp), nx=fbm(rp+vec2(e,0.)), nz=fbm(rp+vec2(0.,e));
    vec2 rg=vec2(nx-n0,nz-n0)/e*.45*lod;
    vec2 rp2=p*1.1+vec2(-uTime*.21,uTime*.16); float m0=noise(rp2), mx=noise(rp2+vec2(e,0.)), mz=noise(rp2+vec2(0.,e));
    rg+=vec2(mx-m0,mz-m0)/e*.16*lod;
    vec3 N=normalize(vec3(-(g.x+rg.x),1.,-(g.y+rg.y)));
    vec3 V=normalize(cameraPosition-vW);
    float d=islD(p);
    float sh=exp(-max(d,0.)*.12);
    vec3 col=mix(uDeep,uMid,exp(-max(d,0.)*.014));
    col*=.88+.24*fbm(p*.012+3.);
    col=mix(col,uShallow,sh);
    float ca=fbm(p*.5+vec2(uTime*.2,-uTime*.15)), ca2=fbm(p*.75-vec2(uTime*.16,uTime*.11));
    col+=vec3(.6,1.,.95)*sh*(smoothstep(.62,.82,ca)*.28+smoothstep(.64,.82,ca2)*.2);
    col+=uShallow*clamp(vW.y*.8,0.,1.)*.2*(1.-sh);
    vec3 Rv=reflect(-V,N); float ry=clamp(Rv.y,0.,1.);
    vec3 skyR=mix(uSky,uZen,pow(ry,.55));
    float fres=.02+.98*pow(1.-max(dot(N,V),0.),5.);
    col=mix(col,skyR,clamp(fres*1.05,0.,.82));
    vec3 H=normalize(uSun+V); float sp=pow(max(dot(N,H),0.),420.);
    col+=vec3(1.,.93,.78)*sp*6.;
    float gl=pow(max(dot(reflect(-uSun,N),V),0.),30.); float tw=smoothstep(.78,.95,noise(p*2.6+vec2(uTime*1.7,-uTime*1.3)));
    col+=vec3(1.,.9,.7)*gl*tw*1.6*lod;
    float cs=smoothstep(.52,.78,fbm(p*.007+vec2(uTime*.014,uTime*.007)));
    col*=1.-cs*.16;
    float fn=fbm(p*.7+vec2(uTime*.25,-uTime*.18));
    float band=1.-smoothstep(-.5,2.6,d+fn*1.4);
    float lines=smoothstep(.6,1.,sin(d*1.5-uTime*1.6)*.5+.5)*(1.-smoothstep(0.,7.,d))*step(0.,d);
    float foam=clamp(band*smoothstep(.25,.55,fn+.2)+lines*smoothstep(.42,.7,fn)*.75,0.,1.);
    col=mix(col,vec3(1.),foam*.92);
    float cr=smoothstep(.3,.42,vW.y)*smoothstep(.55,.8,fn); col=mix(col,vec3(.95),cr*.35*lod);
    float fd=smoothstep(uFogNear,uFogFar,dist);
    col=mix(col,uFog,fd);
    gl_FragColor=vec4(col,1.);
  }`
});
const ocean = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500, 300, 300).rotateX(-Math.PI / 2), oceanMat);
scene.add(ocean);
// anneau lointain (basse résolution) pour que l'horizon reste de l'océan en vue dézoomée
const oceanFar = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000, 90, 90).rotateX(-Math.PI / 2), oceanMat);
oceanFar.position.y = -1.3; oceanFar.renderOrder = -1;
scene.add(oceanFar);
function waveH(x, z, t) { return .24 * Math.sin(x * .17 + z * .06 + t * 1.1) + .15 * Math.sin(-x * .08 + z * .21 + t * 1.35) + .07 * Math.sin(x * .33 - z * .29 + t * 2.1); }

/* ---------------- PARTICLES ---------------- */
class Particles {
  constructor(max, additive) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.siz = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.ml = new Float32Array(max);
    this.s0 = new Float32Array(max); this.s1 = new Float32Array(max); this.c0 = new Float32Array(max * 3); this.c1 = new Float32Array(max * 3); this.a0 = new Float32Array(max);
    this.drag = new Float32Array(max); this.grav = new Float32Array(max);
    const geo = new THREE.BufferGeometry();
    this.pA = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.cA = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.sA = new THREE.BufferAttribute(this.siz, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.pA); geo.setAttribute('color', this.cA); geo.setAttribute('size', this.sA);
    geo.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: additive ? glowTex : puffTex }, uScale: { value: 1 } },
      vertexShader: `attribute float size; attribute vec4 color; varying vec4 vC; uniform float uScale;
        void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=min(size*uScale/-mv.z,900.); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec4 vC; void main(){ vec4 t=texture2D(map,gl_PointCoord); gl_FragColor=vec4(vC.rgb*t.rgb, vC.a*t.a); }`,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, this.mat); this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 6 : 5;
    this.geo = geo; scene.add(this.points);
  }
  emit(x, y, z, vx, vy, vz, life, s0, s1, c0, c1, a = 1, drag = 1, grav = 0) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.pos.set([x, y, z], i * 3); this.vel.set([vx, vy, vz], i * 3);
    this.life[i] = 0; this.ml[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a; this.drag[i] = drag; this.grav[i] = grav;
    this.c0.set(c0, i * 3); this.c1.set(c1 || c0, i * 3);
  }
  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.life[i] += dt;
      if (this.life[i] >= this.ml[i]) {
        const j = --this.n;
        if (i !== j) {
          for (const [arr, k] of [[this.pos, 3], [this.vel, 3], [this.c0, 3], [this.c1, 3]]) arr.copyWithin(i * k, j * k, j * k + k);
          for (const arr of [this.life, this.ml, this.s0, this.s1, this.a0, this.drag, this.grav]) arr[i] = arr[j];
        }
        continue;
      }
      const t = this.life[i] / this.ml[i], k3 = i * 3, dr = Math.pow(this.drag[i], dt);
      this.vel[k3] *= dr; this.vel[k3 + 1] = this.vel[k3 + 1] * dr - this.grav[i] * dt; this.vel[k3 + 2] *= dr;
      this.pos[k3] += this.vel[k3] * dt; this.pos[k3 + 1] += this.vel[k3 + 1] * dt; this.pos[k3 + 2] += this.vel[k3 + 2] * dt;
      this.siz[i] = lerp(this.s0[i], this.s1[i], 1 - Math.pow(1 - t, 2));
      const k4 = i * 4;
      this.col[k4] = lerp(this.c0[k3], this.c1[k3], t); this.col[k4 + 1] = lerp(this.c0[k3 + 1], this.c1[k3 + 1], t); this.col[k4 + 2] = lerp(this.c0[k3 + 2], this.c1[k3 + 2], t);
      this.col[k4 + 3] = this.a0[i] * Math.min(1, t * 10) * Math.pow(1 - t, 1.3);
      i++;
    }
    this.geo.setDrawRange(0, this.n);
    this.pA.needsUpdate = this.cA.needsUpdate = this.sA.needsUpdate = true;
  }
}
const smoke = new Particles(1800, false);
const fire = new Particles(1600, true);
function setParticleScale() { const s = innerHeight * DPR / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))); smoke.mat.uniforms.uScale.value = s; fire.mat.uniforms.uScale.value = s; }

const FX = {
  explosion(p, power = 1) {
    for (let i = 0; i < 26 * power; i++) { const a = rand(0, 6.28), u = rand(-.2, 1), sp = rand(4, 14) * power; fire.emit(p.x, p.y + .5, p.z, Math.cos(a) * sp * (1 - u * .5), rand(3, 12) * power, Math.sin(a) * sp * (1 - u * .5), rand(.35, .8), rand(3, 5) * power, rand(6, 11) * power, [6, 4.2, 2], [2.2, .5, .08], 1, .08, 4); }
    for (let i = 0; i < 18 * power; i++) { const a = rand(0, 6.28), sp = rand(1, 5) * power; const g = rand(.12, .3); smoke.emit(p.x + rand(-1, 1), p.y + rand(0, 2), p.z + rand(-1, 1), Math.cos(a) * sp, rand(2, 7), Math.sin(a) * sp, rand(1.4, 3), rand(3, 6) * power, rand(10, 18) * power, [g + .1, g + .07, g + .05], [.55, .55, .58], .9, .5, -1); }
    for (let i = 0; i < 22 * power; i++) { const a = rand(0, 6.28), sp = rand(8, 22); fire.emit(p.x, p.y + 1, p.z, Math.cos(a) * sp, rand(6, 20), Math.sin(a) * sp, rand(.5, 1.2), .7, .3, [8, 5, 1.5], [3, .6, .1], 1, .6, 22); }
    flashLight(p, power); shake(.55 * power); SFX.explo(power);
  },
  hitSmall(p) {
    for (let i = 0; i < 10; i++) { const a = rand(0, 6.28), sp = rand(2, 7); fire.emit(p.x, p.y + .5, p.z, Math.cos(a) * sp, rand(2, 7), Math.sin(a) * sp, rand(.25, .5), 2.5, 5, [6, 4, 1.8], [2, .4, .05], 1, .08, 2); }
    for (let i = 0; i < 8; i++) smoke.emit(p.x + rand(-1, 1), p.y + rand(0, 1), p.z + rand(-1, 1), rand(-1, 1), rand(1, 4), rand(-1, 1), rand(1, 2), 3, 9, [.3, .28, .26], [.6, .6, .62], .8, .5, -.5);
    flashLight(p, .5); shake(.18); SFX.boom(.6);
  },
  splash(p) {
    for (let i = 0; i < 26; i++) { const a = rand(0, 6.28), sp = rand(.5, 4); smoke.emit(p.x, .3, p.z, Math.cos(a) * sp, rand(7, 15), Math.sin(a) * sp, rand(.8, 1.3), rand(1.2, 2), rand(3, 5), [1.3, 1.4, 1.5], [1, 1.1, 1.15], .95, .7, 18); }
    for (let i = 0; i < 10; i++) { const a = rand(0, 6.28); smoke.emit(p.x + Math.cos(a) * 1.5, .3, p.z + Math.sin(a) * 1.5, Math.cos(a) * 3, .5, Math.sin(a) * 3, 1.4, 3, 8, [1.2, 1.3, 1.35], [1, 1, 1], .6, .4, 0); }
    SFX.splash();
  },
  muzzle(p, dir) {
    for (let i = 0; i < 8; i++) fire.emit(p.x, p.y, p.z, dir.x * rand(6, 14) + rand(-1, 1), dir.y * 10 + rand(0, 2), dir.z * rand(6, 14) + rand(-1, 1), rand(.12, .25), 2.5, 4.5, [8, 6, 3], [3, 1, .2], 1, .02, 0);
    for (let i = 0; i < 10; i++) smoke.emit(p.x, p.y, p.z, dir.x * rand(3, 8) + rand(-1, 1), rand(.5, 2.5), dir.z * rand(3, 8) + rand(-1, 1), rand(1.2, 2.2), 2, 7, [.85, .85, .86], [.7, .7, .74], .8, .35, -.6);
  },
  sparkle(p, n = 14, spread = 3) {
    for (let i = 0; i < n; i++) fire.emit(p.x + rand(-spread, spread), p.y + rand(0, spread), p.z + rand(-spread, spread), rand(-1, 1), rand(1, 4), rand(-1, 1), rand(.6, 1.2), rand(.6, 1.2), .1, [6, 4.6, 1.6], [3, 2, .4], 1, .6, 1);
  },
  dust(p, r = 5) {
    for (let i = 0; i < 40; i++) { const a = i / 40 * 6.28; smoke.emit(p.x + Math.cos(a) * r * .4, p.y + .3, p.z + Math.sin(a) * r * .4, Math.cos(a) * rand(5, 10), rand(.5, 2), Math.sin(a) * rand(5, 10), rand(.8, 1.4), 3, 7, [1.05, .95, .78], [.9, .85, .75], .8, .2, 0); }
  },
};
let shakeAmt = 0;
const shake = a => shakeAmt = Math.min(1.6, shakeAmt + a);

/* ---------------- MODELS ---------------- */
const MODELS = {};
const MODEL_LIST = ['barrel', 'boat-row-small', 'boat-row-large', 'cannon', 'cannon-mobile', 'cannon-ball', 'castle-wall', 'castle-gate', 'castle-window', 'chest', 'crate', 'crate-bottles', 'flag-pirate', 'flag-pirate-high', 'flag-pirate-pennant', 'flag-high-pennant', 'flag-pennant', 'grass-patch', 'grass-plant', 'patch-grass-foliage', 'patch-sand-foliage', 'palm-bend', 'palm-detailed-bend', 'palm-detailed-straight', 'palm-straight', 'platform', 'platform-planks', 'rocks-a', 'rocks-b', 'rocks-c', 'rocks-sand-a', 'rocks-sand-b', 'rocks-sand-c', 'ship-ghost', 'ship-large', 'ship-medium', 'ship-small', 'ship-pirate-large', 'ship-pirate-medium', 'ship-pirate-small', 'ship-wreck', 'structure', 'structure-roof', 'structure-platform-dock', 'structure-platform', 'structure-fence', 'tower-base', 'tower-base-door', 'tower-middle', 'tower-middle-windows', 'tower-top', 'tower-roof', 'tower-watch', 'tower-complete-small', 'tower-complete-large', 'bottle-large', 'mast-ropes', 'flag-pirate-high-pennant', 'tool-paddle', 'tool-shovel'];
let boostedMap = null;
function boostColormap(tex) {
  const img = tex.image; const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    let r = p[i] / 255, gg = p[i + 1] / 255, b = p[i + 2] / 255;
    const l = .3 * r + .59 * gg + .11 * b, sat = 1.32, con = 1.06;
    r = (l + (r - l) * sat - .5) * con + .5; gg = (l + (gg - l) * sat - .5) * con + .5; b = (l + (b - l) * sat - .5) * con + .5;
    p[i] = clamp(r, 0, 1) * 255; p[i + 1] = clamp(gg, 0, 1) * 255; p[i + 2] = clamp(b, 0, 1) * 255;
  }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.magFilter = tex.magFilter; t.minFilter = tex.minFilter; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT; t.anisotropy = 4;
  return t;
}
async function loadModels(onProgress) {
  const loader = new GLTFLoader(); let done = 0;
  await Promise.all(MODEL_LIST.map(n => new Promise(res => {
    loader.load(`models/${n}.glb`, g => {
      g.scene.traverse(o => {
        if (o.isMesh) {
          o.castShadow = true; o.receiveShadow = true;
          if (o.material.map) { if (!boostedMap) boostedMap = boostColormap(o.material.map); o.material.map = boostedMap; }
          o.material.roughness = .78; o.material.metalness = 0;
        }
      });
      MODELS[n] = g.scene; done++; onProgress(done / MODEL_LIST.length); res();
    }, undefined, () => { done++; onProgress(done / MODEL_LIST.length); res(); });
  })));
}
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
function M(name, s = 1) { const src = MODELS[name]; if (!src) return new THREE.Group(); const o = src.clone(true); o.scale.setScalar(s); return o; }
/* ---- recoloration du colormap : une palette = un matériau (couleur, métal, brillance, lueur) ---- */
const PAL_CACHE = {};
const hexRGB = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
function palMaterial(key, roles) {
  if (PAL_CACHE[key]) return PAL_CACHE[key];
  if (!boostedMap) return null;
  const src = boostedMap.image, W = src.width, H = src.height, cw = W / 16, ch = H / 4;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const cM = mk(), gM = cM.getContext('2d', { willReadFrequently: true }); gM.drawImage(src, 0, 0);
  const cE = mk(), gE = cE.getContext('2d'); gE.fillStyle = '#000'; gE.fillRect(0, 0, W, H);
  const cR = mk(), gR = cR.getContext('2d'); gR.fillStyle = 'rgb(0,199,0)'; gR.fillRect(0, 0, W, H);
  let anyE = false;
  for (const [cell, r] of Object.entries(roles)) {
    const [cx, cy] = cell.split(',').map(Number), x0 = (cx - cx % 2) * cw, y0 = cy * ch, w = cw * 2;
    const d = gM.getImageData(x0, y0, w, ch), p = d.data; let ml = 0;
    for (let i = 0; i < p.length; i += 4) ml += .3 * p[i] + .59 * p[i + 1] + .11 * p[i + 2];
    ml = Math.max(8, ml / (p.length / 4));
    const [tr, tg, tb] = hexRGB(r.c), k = r.k ?? 1;
    for (let i = 0; i < p.length; i += 4) { const l = .3 * p[i] + .59 * p[i + 1] + .11 * p[i + 2]; const f = clamp(1 + (l / ml - 1) * k, .55, 1.45); p[i] = clamp(tr * f, 0, 255); p[i + 1] = clamp(tg * f, 0, 255); p[i + 2] = clamp(tb * f, 0, 255); }
    gM.putImageData(d, x0, y0);
    if (r.e) { anyE = true; gE.fillStyle = `rgb(${tr * r.e | 0},${tg * r.e | 0},${tb * r.e | 0})`; gE.fillRect(x0, y0, w, ch); }
    if (r.m != null || r.r != null) { gR.fillStyle = `rgb(0,${Math.round((r.r ?? .78) * 255)},${Math.round((r.m ?? 0) * 255)})`; gR.fillRect(x0, y0, w, ch); }
  }
  const T = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.flipY = false; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.magFilter = boostedMap.magFilter; t.minFilter = boostedMap.minFilter; t.wrapS = boostedMap.wrapS; t.wrapT = boostedMap.wrapT; t.anisotropy = 4; return t; };
  const mr = T(cR, false);
  const mat = new THREE.MeshStandardMaterial({ map: T(cM, true), roughnessMap: mr, metalnessMap: mr, roughness: 1, metalness: 1, emissive: anyE ? '#ffffff' : '#000000', emissiveMap: anyE ? T(cE, true) : null, emissiveIntensity: anyE ? 1.6 : 1 });
  PAL_CACHE[key] = mat; return mat;
}
function applyPal(root, mat, chestMat) {
  if (!mat) return;
  (function walk(o, inChest) {
    if (o.userData.noPal) return;
    const ch = inChest || o.userData.chest;
    if (o.isMesh && o.material && o.material.map) o.material = (ch && chestMat) ? chestMat : mat;
    for (const c of o.children) walk(c, ch);
  })(root, false);
}
const lvMat = l => LV[l] && LV[l].pal ? palMaterial('lv' + l, LV[l].pal) : null;
const lvChestMat = l => LV[l] && LV[l].pal ? palMaterial('lvc' + l, { ...LV[l].pal, '7,3': LV[l].chest }) : null;
function ownMats(obj) { obj.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.userData.baseColor = o.material.color.clone(); } }); return obj; }

/* ---------------- WORLD BUILD ---------------- */
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function placeOn(I, grp, obj, lx, lz, ry = 0, dy = 0) { obj.position.set(lx, islandH(I, lx, lz) + dy, lz); obj.rotation.y = ry; grp.add(obj); return obj; }
const coinGeo = new THREE.CylinderGeometry(.34, .34, .08, 16);
const goldMat = new THREE.MeshStandardMaterial({ color: '#ffc63a', metalness: 1, roughness: .22, emissive: '#7a4300', emissiveIntensity: .55 });
function coinPile(n, R, H, seed = 1) {
  const r0 = mulberry(seed * 999);
  const im = new THREE.InstancedMesh(coinGeo, goldMat, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new V3(), s = new V3(1, 1, 1);
  for (let i = 0; i < n; i++) {
    const r = R * Math.sqrt(r0()), a = r0() * 6.28, h = H * Math.pow(1 - r / R, 1.2) * (.55 + .45 * r0());
    p.set(Math.cos(a) * r, h + .04, Math.sin(a) * r); e.set((r0() - .5) * 1.2, r0() * 6, (r0() - .5) * 1.2); q.setFromEuler(e); m.compose(p, q, s); im.setMatrixAt(i, m);
  }
  im.castShadow = true; im.receiveShadow = true; return im;
}
const shipNames = { pirate: ['ship-pirate-small', 'ship-pirate-medium', 'ship-pirate-large'], royal: ['ship-small', 'ship-medium', 'ship-large'] };
function shipMat(id, part) { const sk = SKINS[id]; if (!sk || !sk.pal) return null; return palMaterial(`ship:${id}:${part}`, { ...sk.pal, ...(sk[part] || {}) }); }
/* chaque niveau du Quai = un NOUVEAU navire : plus grand, nouvelles couleurs, nouveaux équipements */
const SHIPLV = [null,
  { name: 'Chaloupe', s: .46, tier: 1, col: '#c98a4b', pal: null },
  { name: 'Brigantin Rouge', s: .6, tier: 2, col: '#e0483a', pal: { '5,3': { c: '#d32f2f', k: .7 }, '9,3': { c: '#f2e2b8' } } },
  { name: 'Frégate Azur', s: .72, tier: 3, col: '#3d8bff', pal: { '5,3': { c: '#f6f3ea', k: .45 }, '9,3': { c: '#2f6fd8' }, '13,3': { c: '#1f3f7a' }, '7,3': { c: '#e0b040', m: .9, r: .3 }, '3,3': { c: '#e0b040', m: .9, r: .3 } } },
  { name: 'Galion de Guerre', s: .84, tier: 3, col: '#a24bff', pal: { '11,3': { c: '#3a2433' }, '13,3': { c: '#1a0e1a' }, '5,3': { c: '#8a3fe0', k: .6, e: .14 }, '9,3': { c: '#ffcc4d', m: 1, r: .3, e: .15 }, '7,3': { c: '#ffcc4d', m: 1, r: .3 }, '3,3': { c: '#ffcc4d', m: 1, r: .3 }, '1,3': { c: '#160a18' } } },
  { name: "Vaisseau Royal d'Or", s: .96, tier: 3, col: '#ffc83a', pal: { '11,3': { c: '#ffcf3a', m: 1, r: .22, e: .06 }, '13,3': { c: '#8c1f2c' }, '5,3': { c: '#c8102e', k: .6, e: .08 }, '9,3': { c: '#ffe17a', m: 1, r: .2, e: .4 }, '3,3': { c: '#ffd76a', m: 1, r: .25 }, '7,3': { c: '#ffd76a', m: 1, r: .25 }, '1,3': { c: '#3a0e18' } } },
];
const SHIP_DECK = 2.0; // hauteur du pont (coordonnées du modèle)
function makeShip(tier, skinId = S.skin, scale = .62, lvl = 0) {
  const sk = SKINS[skinId] || SKINS.classique; tier = clamp(tier, 1, 3);
  let name = shipNames.pirate[tier - 1];
  if (sk.model === 'ship-ghost') name = 'ship-ghost';
  if (sk.model === 'royal') name = shipNames.royal[tier - 1];
  const inner = M(name, scale);
  const LP = lvl && !sk.pal && SHIPLV[lvl] && SHIPLV[lvl].pal; // skin classique : la couleur dépend du niveau
  if (sk.pal || LP) inner.traverse(o => { if (!o.isMesh || !o.material.map) return; const part = /flag/.test(o.name) ? 'flag' : /sail/.test(o.name) ? 'sail' : 'hull'; const m = LP ? palMaterial(`shiplv:${lvl}`, LP) : shipMat(skinId, part); if (m) o.material = m; });
  ownMats(inner);
  const g = new THREE.Group(); inner.position.y = -.45; g.add(inner);
  g.userData = { inner, skin: skinId, phase: Math.random() * 6, noPal: true };
  if (lvl) shipDecor(g, inner, name, lvl);
  return g;
}
/* navire du joueur selon le niveau du Quai */
function makeLevelShip(l, skinId = S.skin, mul = 1) { const L = SHIPLV[clamp(l, 1, 5)]; return makeShip(L.tier, skinId, L.s * mul, l); }
const SHIP_LEN = { 'ship-pirate-small': 4.3, 'ship-pirate-medium': 5.3, 'ship-pirate-large': 6.55, 'ship-small': 4.3, 'ship-medium': 5.3, 'ship-large': 6.55, 'ship-ghost': 5.3 };
function glowSprite(col, sc = 1.5, k = 1.5) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(col).multiplyScalar(k), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.scale.setScalar(sc); return s; }
function goldCrown(r = 1) {
  const g = new THREE.Group(), gm = pm('crownG', { color: '#ffd23f', metalness: 1, roughness: .2, emissive: '#b37400', emissiveIntensity: .9 });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(r, r * .92, r * .55, 16, 1, true), gm); band.material.side = THREE.DoubleSide; g.add(band);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, sp = new THREE.Mesh(new THREE.ConeGeometry(r * .22, r * .7, 6), gm); sp.position.set(Math.cos(a) * r * .92, r * .6, Math.sin(a) * r * .92); g.add(sp);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(r * .13), pm('crownR' + (i % 2), { color: i % 2 ? '#2f8bff' : '#ff2244', emissive: i % 2 ? '#2f8bff' : '#ff2244', emissiveIntensity: 1.5 })); gem.position.set(Math.cos(a) * r * 1.0, 0, Math.sin(a) * r * 1.0); g.add(gem); }
  g.add(glowSprite('#ffd23f', r * 5, 1.2)); return g;
}
/* équipements du navire, visibles de loin : lanternes, canons, figure de proue, hublots lumineux, couronne */
function shipDecor(g, inner, name, l) {
  const len = SHIP_LEN[name] || 5.3, D = SHIP_DECK, col = SHIPLV[l].col, add = (o) => { o.userData.noPal = true; inner.add(o); return o; };
  // fanaux de poupe
  if (l >= 2) [-1.3, 1.3].forEach(x => { const L = lantern(l >= 5 ? '#ffd23f' : l >= 4 ? '#c88bff' : '#ffb347'); L.scale.setScalar(1.3); L.position.set(x, D + .2, -len * .86); add(L); });
  // canons sur les flancs
  if (l >= 3) { const n = l === 3 ? 2 : l === 4 ? 3 : 4; for (let i = 0; i < n; i++) { const z = -len * .45 + i * (len * .9 / Math.max(1, n - 1)) * (n > 1 ? 1 : 0); for (const sgn of [-1, 1]) { const c = M('cannon', .9); c.position.set(sgn * 1.75, D - .1, z * .8); c.rotation.y = sgn * Math.PI / 2; add(c); } } }
  // figure de proue dorée
  if (l >= 3) { const fg = new THREE.Group(); const gm = goldTrim(); const b = new THREE.Mesh(new THREE.SphereGeometry(.45, 12, 10), gm); b.scale.set(1, 1.3, 1); fg.add(b); const sp = new THREE.Mesh(new THREE.ConeGeometry(.3, 1.6, 8), gm); sp.rotation.x = Math.PI / 2; sp.position.z = .9; fg.add(sp); fg.position.set(0, D + .3, len + .2); add(fg); }
  // hublots lumineux
  if (l >= 4) { const pg = new THREE.SphereGeometry(.17, 8, 6), pmat = pm('port' + l, { color: col, emissive: col, emissiveIntensity: 2.4 }); for (let i = 0; i < 7; i++) for (const sgn of [-1, 1]) { const m = new THREE.Mesh(pg, pmat); m.position.set(sgn * 2.3, 1.1, -len * .7 + i * len * 1.4 / 6); m.scale.set(.5, 1, 1); add(m); } }
  // bannières supplémentaires
  if (l >= 4) { const f = M(l >= 5 ? 'flag-pirate-high-pennant' : 'flag-pirate-pennant', 1.3); f.position.set(0, D, -len * .95); add(f); }
  // couronne flottante + halo
  if (l >= 5) { const cr = goldCrown(.9); cr.position.set(0, 11.4, 0); add(cr); cr.onBeforeRender = () => { cr.rotation.y = performance.now() * .0012; }; cr.children.forEach(ch => ch.onBeforeRender = () => { cr.rotation.y = performance.now() * .0012; cr.position.y = 11.4 + Math.sin(performance.now() * .002) * .25; }); }
  // aura sur l'eau (niv. 4-5)
  if (l >= 4) { const ring = new THREE.Mesh(new THREE.RingGeometry(1, 1.25, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(.9), transparent: true, opacity: .4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.scale.set(inner.scale.x * 3.6, inner.scale.x * (len + 2.5), 1); ring.position.y = .06; ring.userData.noPal = true; g.add(ring); ring.onBeforeRender = () => { ring.material.opacity = .25 + Math.sin(performance.now() * .003) * .12; }; }
}

/* HOME ISLAND */
const bobbers = [];   // floating objects
const swayers = [];
function decorate(I, grp, seed, avoid) {
  const r = mulberry(seed);
  const palms = ['palm-detailed-bend', 'palm-detailed-straight', 'palm-bend', 'palm-straight'];
  let placed = 0, tries = 0;
  while (placed < 22 && tries++ < 400) {
    const a = r() * 6.28, rn = .5 + r() * .38, R = shoreR(I, a) * rn, x = Math.cos(a) * R, z = Math.sin(a) * R;
    if (avoid.some(v => Math.hypot(v[0] - x, v[1] - z) < v[2])) continue;
    const p = M(palms[Math.floor(r() * 4)], .9 + r() * .55); placeOn(I, grp, p, x, z, r() * 6.28, -.1);
    p.userData.sw = r() * 6; swayers.push(p); avoid.push([x, z, 2.6]); placed++;
  }
  // shoreline rocks
  for (let i = 0; i < 9; i++) {
    const a = r() * 6.28, R = shoreR(I, a) * (.95 + r() * .1), x = Math.cos(a) * R, z = Math.sin(a) * R;
    if (avoid.some(v => Math.hypot(v[0] - x, v[1] - z) < v[2] + 2)) continue;
    const k = M(['rocks-sand-a', 'rocks-sand-b', 'rocks-sand-c', 'rocks-a', 'rocks-c'][Math.floor(r() * 5)], .6 + r() * .6);
    placeOn(I, grp, k, x, z, r() * 6.28, -.5);
  }
  // grass on plateau
  for (let i = 0; i < 40; i++) {
    const a = r() * 6.28, rn = r() * .52, R = shoreR(I, a) * rn, x = Math.cos(a) * R, z = Math.sin(a) * R;
    if (avoid.some(v => Math.hypot(v[0] - x, v[1] - z) < v[2] * .8)) continue;
    placeOn(I, grp, M(r() < .5 ? 'grass-plant' : 'grass-patch', 1 + r() * 1.2), x, z, r() * 6.28, -.05);
  }
  // sand foliage on beach
  for (let i = 0; i < 12; i++) {
    const a = r() * 6.28, rn = .7 + r() * .15, R = shoreR(I, a) * rn, x = Math.cos(a) * R, z = Math.sin(a) * R;
    if (avoid.some(v => Math.hypot(v[0] - x, v[1] - z) < v[2])) continue;
    placeOn(I, grp, M('grass', 1.5 + r()), x, z, r() * 6.28, -.05);
  }
}
const DOCK_A = 0.5;
const SLOTS = { tresor: [-2, -6], canon: [-7.5, 5.5] };
const dockStart = shoreR(HOME, DOCK_A) * .8;
const quaiPos = [Math.cos(DOCK_A) * dockStart, Math.sin(DOCK_A) * dockStart];
// chemins de terre entre les bâtiments
const HUB = [1.5, 1];
const HOME_PATHS = [[HUB[0], HUB[1], quaiPos[0] - 1, quaiPos[1] - 1], [HUB[0], HUB[1], SLOTS.tresor[0], SLOTS.tresor[1] + 3], [HUB[0], HUB[1], SLOTS.canon[0] + 2, SLOTS.canon[1] - 1.5],
  [HUB[0], HUB[1], 6, -5], [HUB[0], HUB[1], -8.6, -9.4], [HUB[0], HUB[1], 3, 7]];
const homeGrp = makeIsland(HOME, { paths: HOME_PATHS });
let enemyGrp = null;
/* végétation dense (instanciée) : touffes d'herbe qui ondulent, fleurs, buissons */
const windU = { value: 0 };
let tuftGeo = null;
function getTuftGeo() {
  if (tuftGeo) return tuftGeo;
  const parts = [];
  for (let i = 0; i < 5; i++) { const c = new THREE.ConeGeometry(.07, .75 + i % 3 * .18, 3, 1); c.translate(0, .38, 0); c.rotateZ((i % 2 ? 1 : -1) * (.18 + i * .05)); c.rotateY(i * 1.26); parts.push(c); }
  tuftGeo = mergeGeometries(parts); return tuftGeo;
}
function windMat(color, rough = .85) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough });
  m.onBeforeCompile = sh => {
    sh.uniforms.uWind = windU;
    sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      #else
      vec3 ip = vec3(0.);
      #endif
      float sw = sin(uWind*1.8 + ip.x*.35 + ip.z*.27) * .16 * max(position.y, 0.);
      transformed.x += sw; transformed.z += sw * .6;`);
  };
  return m;
}
function lush(I, grp, seed, avoid, nTuft = 650, nFlower = 160, nBush = 26) {
  const r = mulberry(seed), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new V3(), sc = new V3(), c = new THREE.Color();
  const free = (x, z, k = 1) => !avoid.some(v => Math.hypot(v[0] - x, v[1] - z) < v[2] * k) && !(I === HOME && HOME_PATHS.some(s => segDist(x, z, s[0], s[1], s[2], s[3]) < 1.4));
  const spot = (rMin, rMax) => { for (let t = 0; t < 30; t++) { const a = r() * 6.28, rn = rMin + r() * (rMax - rMin), R = shoreR(I, a) * rn, x = Math.cos(a) * R, z = Math.sin(a) * R; if (free(x, z, .85)) return [x, z]; } return null; };
  // herbe
  const tufts = new THREE.InstancedMesh(getTuftGeo(), windMat('#ffffff'), nTuft); let n = 0;
  const greens = ['#5cb83a', '#6cc23f', '#7ccc45', '#4fae34', '#8fd14f'];
  for (let i = 0; i < nTuft; i++) {
    const s0 = spot(0, .6); if (!s0) continue; const [x, z] = s0;
    p.set(x, islandH(I, x, z) - .05, z); e.set(0, r() * 6.28, 0); q.setFromEuler(e); const k = .7 + r() * .9; sc.set(k, k * (.8 + r() * .6), k);
    m4.compose(p, q, sc); tufts.setMatrixAt(n, m4); tufts.setColorAt(n, c.set(greens[Math.floor(r() * greens.length)]).multiplyScalar(.85 + r() * .3)); n++;
  }
  tufts.count = n; tufts.receiveShadow = true; grp.add(tufts);
  // fleurs
  const flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.16, 0), new THREE.MeshStandardMaterial({ roughness: .6, emissive: '#221100', emissiveIntensity: .2 }), nFlower); n = 0;
  const fcols = ['#fff6e0', '#ffd23f', '#ff6fa8', '#ff4d4d', '#c38bff', '#ffffff'];
  for (let i = 0; i < nFlower; i++) {
    const s0 = spot(0, .56); if (!s0) continue; const [x, z] = s0;
    p.set(x, islandH(I, x, z) + .35 + r() * .25, z); sc.setScalar(.7 + r() * .7); m4.compose(p, q.identity(), sc); flowers.setMatrixAt(n, m4); flowers.setColorAt(n, c.set(fcols[Math.floor(r() * fcols.length)])); n++;
  }
  flowers.count = n; grp.add(flowers);
  // buissons
  const bush = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), windMat('#ffffff', .9), nBush * 3); n = 0;
  bush.material.flatShading = true;
  for (let i = 0; i < nBush; i++) {
    const s0 = spot(.3, .62); if (!s0) continue; const [x, z] = s0; const y = islandH(I, x, z);
    const base = c.set(['#2f8f2a', '#3fa233', '#2a7a2a', '#4cb03a'][Math.floor(r() * 4)]).clone();
    for (let j = 0; j < 3; j++) {
      const k = (j === 0 ? 1.1 : .75) * (.7 + r() * .6);
      p.set(x + (j ? (r() - .5) * 1.6 : 0), y + k * .45, z + (j ? (r() - .5) * 1.6 : 0)); e.set(r(), r() * 6, r()); q.setFromEuler(e); sc.set(k, k * .78, k);
      m4.compose(p, q, sc); bush.setMatrixAt(n, m4); bush.setColorAt(n, base.clone().multiplyScalar(.85 + j * .12)); n++;
    }
    avoid.push([x, z, 1.6]);
  }
  bush.count = n; bush.castShadow = true; bush.receiveShadow = true; grp.add(bush);
}
/* torches enflammées */
const torches = [];
const woodMat = new THREE.MeshStandardMaterial({ color: '#5a3a1e', roughness: .9 });
const ironMat = new THREE.MeshStandardMaterial({ color: '#2a2a30', roughness: .5, metalness: .7 });
function torch(I, grp, x, z, h = 2.4) {
  const g = new THREE.Group(); const y = islandH(I, x, z) - .1;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.08, .12, h, 6), woodMat); post.position.y = h / 2; post.castShadow = true; g.add(post);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(.3, .14, .32, 8), ironMat); bowl.position.y = h + .1; g.add(bowl);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(1.6, .8, .22), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.position.y = h + .5; glow.scale.setScalar(1.3); g.add(glow);
  g.position.set(x, y, z); grp.add(g);
  torches.push({ g, glow, top: new V3(I.x + x, y + h + .35, I.z + z), ph: Math.random() * 6 });
}
// extra non-interactive structures on home island
function homeExtras() {
  const I = HOME, g = homeGrp;
  const hut = new THREE.Group(); hut.add(M('structure', 1.25)); const rf = M('structure-roof', 1.3); hut.add(rf);
  placeOn(I, g, hut, 7, -7, -.4);
  placeOn(I, g, M('crate-bottles', 1.2), 9.6, -4.6, .3); placeOn(I, g, M('barrel', 1.1), 5, -3.8, 0);
  const watch = M('tower-watch', 1.05); placeOn(I, g, watch, 3, 8.5, .3);
  placeOn(I, g, M('flag-pirate-high', 1.1), 3, 8.5, .3, 2.6);
  placeOn(I, g, M('crate', 1.1), quaiPos[0] - 2.5, quaiPos[1] - 2.2, .4); placeOn(I, g, M('barrel', 1), quaiPos[0] - 1.2, quaiPos[1] - 4, 0);
  placeOn(I, g, M('barrel', 1), quaiPos[0] - 3.2, quaiPos[1] - 3.6, 0);
  placeOn(I, g, M('tool-shovel' in MODELS ? 'tool-shovel' : 'bottle-large', 1), -4, 7, .5);
  const wall1 = M('castle-wall', .95), wall2 = M('castle-gate', .95), wall3 = M('castle-window', .95);
  placeOn(I, g, wall1, -13.5, -6.5, 1.1); placeOn(I, g, wall2, -9.6, -10.6, .75); placeOn(I, g, wall3, -5, -13.2, .35);
  const avoidH = [[SLOTS.tresor[0], SLOTS.tresor[1], 7.4], [SLOTS.canon[0], SLOTS.canon[1], 5], [quaiPos[0], quaiPos[1], 6], [7, -7, 3.5], [3, 8.5, 3], [-9.5, -10, 5.5], [-14, -6, 3], [-5, -13, 3]];
  // torches le long des chemins
  [[HUB[0] + 2.2, HUB[1] - 1.6], [SLOTS.tresor[0] + 4, SLOTS.tresor[1] + 3.6], [SLOTS.canon[0] + 3.6, SLOTS.canon[1] - 3.2], [quaiPos[0] - 3.6, quaiPos[1] + .6], [-6.8, -8.2], [5.2, 5.6]].forEach(([x, z]) => { torch(I, g, x, z); avoidH.push([x, z, 1.2]); });
  decorate(I, g, 77, avoidH);
  lush(I, g, 4242, avoidH.concat([[HUB[0], HUB[1], 2.5]]));
  // sea decor
  const wreck = M('ship-wreck', .7); wreck.position.set(-48, -1.2, 26); wreck.rotation.set(.12, 1.2, -.18); scene.add(wreck);
  const rb = M('boat-row-small', 1.2); rb.position.set(quaiPos[0] + 2, -.15, quaiPos[1] + 8); rb.rotation.y = 1.9; scene.add(rb); bobbers.push({ o: rb, y: -.15, ph: 1 });
  const islets = [[-72, -50, 3.2], [62, 70, 2.6], [-75, 18, 2.4], [80, 10, 2.8], [210, -10, 3], [190, -150, 3.4], [80, -110, 2.4], [-60, 95, 2], [-190, -10, 3], [60, 200, 2.6], [-120, -170, 3]];
  islets.filter(([x, z]) => RSLOTS.every(I => Math.hypot(I.x - x, I.z - z) > I.R * 1.42 + 45)).forEach(([x, z, s], i) => { const k = M(['rocks-b', 'rocks-sand-a', 'rocks-a', 'rocks-sand-b'][i % 4], s); k.position.set(x, -1.2, z); k.rotation.y = i * 1.7; scene.add(k); if (i % 2 === 0) { const p = M('palm-detailed-bend', 1.2); p.position.set(x + 1.5, s * 1.4, z); scene.add(p); } });
}

/* buildings — chaque niveau change couleur, taille, socle et ornements */
const PLINTH_MATS = {};
function pm(key, o) { return PLINTH_MATS[key] || (PLINTH_MATS[key] = new THREE.MeshStandardMaterial(o)); }
const goldTrim = () => pm('gold', { color: '#ffc93c', metalness: 1, roughness: .22, emissive: '#7a4a00', emissiveIntensity: .35 });
function crystal(col, h = 1.4) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(.42, 0), pm('cr' + col, { color: col, emissive: col, emissiveIntensity: 1.4, roughness: .15, metalness: .2, flatShading: true }));
  m.scale.set(.8, 1.7, .8); m.position.y = h; g.add(m); m.onBeforeRender = () => { m.rotation.y = performance.now() * .0012; };
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.18, .28, h - .3, 6), goldTrim()); post.position.y = (h - .3) / 2; g.add(post);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(col).multiplyScalar(1.6), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.scale.setScalar(2.2); glow.position.y = h; g.add(glow);
  return g;
}
function lantern(col) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.07, .1, 1.6, 6), woodMat); post.position.y = .8; post.castShadow = true; g.add(post);
  const box = new THREE.Mesh(new THREE.BoxGeometry(.32, .38, .32), pm('lan' + col, { color: col, emissive: col, emissiveIntensity: 1.6 })); box.position.y = 1.75; g.add(box);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(col).multiplyScalar(1.4), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.scale.setScalar(1.6); glow.position.y = 1.75; g.add(glow); return g;
}
/* socle : bois (2) → pierre azur (3) → pierre + or + cristaux (4) → marbre royal + or + obélisques lumineux (5) */
function plinth(l, R, nOrn = 4) {
  const g = new THREE.Group(); let top = 0;
  if (l < 2) return { g, top };
  const add = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  if (l === 2) {
    add(new THREE.CylinderGeometry(R, R * 1.05, .5, 20), pm('p2', { color: '#9a6236', roughness: .85 }), 0); top = .25;
    add(new THREE.TorusGeometry(R * 1.0, .09, 6, 32).rotateX(Math.PI / 2), pm('p2r', { color: '#c0392b', roughness: .6 }), .26);
  } else if (l === 3) {
    add(new THREE.CylinderGeometry(R, R * 1.1, .8, 8), pm('p3', { color: '#cfd6e0', roughness: .8, flatShading: true }), .05); top = .45;
    add(new THREE.TorusGeometry(R * .97, .12, 6, 8).rotateX(Math.PI / 2).rotateY(Math.PI / 8), pm('p3r', { color: '#2f6fd8', roughness: .4, metalness: .3, emissive: '#0a2a70', emissiveIntensity: .4 }), .46);
  } else {
    const st = l === 4 ? pm('p4', { color: '#ece6f5', roughness: .6, flatShading: true }) : pm('p5', { color: '#fffaf0', roughness: .35, metalness: .05, flatShading: true });
    add(new THREE.CylinderGeometry(R * 1.04, R * 1.14, .7, 8), st, 0);
    add(new THREE.CylinderGeometry(R * .9, R * .98, .5, 8), st, .55); top = .8;
    add(new THREE.TorusGeometry(R * 1.05, .1, 6, 8).rotateX(Math.PI / 2).rotateY(Math.PI / 8), goldTrim(), .36);
    add(new THREE.TorusGeometry(R * .9, .09, 6, 8).rotateX(Math.PI / 2).rotateY(Math.PI / 8), goldTrim(), .81);
    if (l === 5) { const ring = add(new THREE.TorusGeometry(R * 1.2, .07, 6, 48).rotateX(Math.PI / 2), pm('p5g', { color: '#ffd54a', emissive: '#ffb000', emissiveIntensity: 2.2 }), .08); ring.castShadow = false; }
  }
  if (l >= 4) for (let i = 0; i < nOrn; i++) { const a = Math.PI / 4 + i * Math.PI * 2 / nOrn, c = crystal(l === 5 ? '#ffd23f' : '#b06bff', l === 5 ? 2.2 : 1.5); c.position.set(Math.cos(a) * R * 1.02, .7, Math.sin(a) * R * 1.02); g.add(c); }
  else if (l === 3) for (let i = 0; i < nOrn; i++) { const a = Math.PI / 4 + i * Math.PI * 2 / nOrn, c = lantern('#5fb0ff'); c.position.set(Math.cos(a) * R * .98, .4, Math.sin(a) * R * .98); g.add(c); }
  else if (l === 2) for (let i = 0; i < 2; i++) { const a = Math.PI * .75 + i * Math.PI, c = lantern('#ff8a3a'); c.position.set(Math.cos(a) * R * .95, .2, Math.sin(a) * R * .95); g.add(c); }
  g.userData.noPal = true;
  return { g, top };
}
function finishLevel(g, c, l, top) { c.position.y = top; applyPal(c, lvMat(l), lvChestMat(l)); g.add(c); g.userData.labelY = (c.userData.labelY || 4) + top; g.userData.gun = c.userData.gun; g.userData.labelX = c.userData.labelX; g.userData.lvl = l; return g; }
function buildTresor(l) {
  const g = new THREE.Group(), c = new THREE.Group();
  const P = plinth(l, l >= 3 ? 5.3 : 4.1); g.add(P.g);
  const base = M('platform', 2.4); c.add(base);
  const chest = M('chest', 2.1 + (l - 1) * .12); chest.position.set(0, .5, 0); chest.rotation.y = .5; chest.userData.chest = true; c.add(chest);
  const piles = [[1.9, 1.3, 1.5, .9], [-1.7, 1.5, 1.2, .7], [.6, -2, 1.1, .6], [-1.3, -1.4, 1, .5]];
  const n = [0, 2, 3, 4, 4, 4][l];
  for (let i = 0; i < n; i++) { const [x, z, R, H] = piles[i]; const cp = coinPile(Math.round(60 + l * 30), R + l * .12, H + l * .18, i + l); cp.position.set(x, .5, z); c.add(cp); }
  if (l >= 2) { const roof = M('structure-roof', 1.85); c.add(roof); }
  if (l >= 3) { const tw = M('tower-complete-large', .62); tw.position.set(-4.3, 0, -3.4); c.add(tw); }
  if (l >= 4) { const f1 = M('flag-pirate-high', 1); f1.position.set(3.4, 0, -2.6); c.add(f1); const f2 = M('flag-pirate-high', 1); f2.position.set(-2.8, 0, 3.2); c.add(f2); }
  if (l >= 5) { const tw2 = M('tower-complete-small', .62); tw2.position.set(4.3, 0, -3.6); c.add(tw2); const gp = coinPile(140, 1.6, 1.4, 99); gp.position.set(0, 2.9, 0); c.add(gp); }
  c.add(at(M('barrel', .9), 3.5, 0, 1.5));
  c.add(at(M('crate', .9), -3.6, 0, .6));
  c.userData.labelY = l >= 3 ? 9 : l >= 2 ? 7.5 : 4.2;
  return finishLevel(g, c, l, P.top);
}
function buildCanon(l) {
  const g = new THREE.Group(), c = new THREE.Group(); let top;
  const P = plinth(l, 3.2); g.add(P.g);
  if (l === 1) { c.add(M('platform', 1.9)); top = .45; }
  else { c.add(M('tower-base', 1.25)); top = 2.5; if (l >= 3) { const mid = M(l >= 5 ? 'tower-middle-windows' : 'tower-middle', 1.25); mid.position.y = 2.5; c.add(mid); top = 5; } if (l >= 5) { const mid2 = M('tower-middle', 1.25); mid2.position.y = 5; c.add(mid2); top = 7.5; } }
  const gun = new THREE.Group(); gun.position.y = top; c.add(gun);
  const cn = M('cannon', 1.65 + (l - 1) * .12); gun.add(cn);
  if (l >= 3) { const c2 = M('cannon', 1.45 + (l - 3) * .1); c2.position.set(.95, 0, .1); c2.rotation.y = .12; gun.add(c2); cn.position.x = -.8; }
  c.userData.gun = gun;
  for (let i = 0; i < 3 + (l >= 3 ? 2 : 0); i++) { const b = M('cannon-ball', .75); b.position.set(2.6 + (i % 2) * .5, .25 + (i === 2 ? .4 : 0), -1.4 + (i === 1 ? .5 : 0) + (i === 2 ? .25 : 0) + (i > 2 ? 1.2 : 0)); c.add(b); }
  if (l >= 2) c.add(at(M('barrel', .9), -2.6, 0, 1.6));
  if (l >= 4) { const f = M('flag-pirate-pennant', 1.1); f.position.set(1.3, top, -1.3); c.add(f); }
  if (l >= 5) { const cm = M('cannon-mobile', 1.4); cm.position.set(-3, 0, -2); cm.rotation.y = .6; c.add(cm); }
  c.userData.labelY = top + 3.6;
  return finishLevel(g, c, l, P.top);
}
let homeShip = null;
/* ---- décor du quai : cordages, bittes d'amarrage, sacs, grue, passerelle, matelots… ---- */
const ropeMat = new THREE.MeshStandardMaterial({ color: '#c9a26a', roughness: .95 });
function rope(a, b, sag = .5, r = .05) {
  const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12, p = new V3().lerpVectors(a, b, t); p.y -= Math.sin(t * Math.PI) * sag; pts.push(p); }
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, r, 5), ropeMat); m.castShadow = true; return m;
}
function bollard() { const g = new THREE.Group(); const p = new THREE.Mesh(new THREE.CylinderGeometry(.22, .26, .7, 8), pm('boll', { color: '#3b2a1c', roughness: .8 })); p.position.y = .35; p.castShadow = true; g.add(p); const cap = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .12, 8), ironMat); cap.position.y = .72; g.add(cap); const coil = new THREE.Mesh(new THREE.TorusGeometry(.3, .07, 5, 14), ropeMat); coil.rotation.x = Math.PI / 2; coil.position.y = .5; g.add(coil); return g; }
function ropeCoil() { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(.42 - i * .07, .07, 5, 16), ropeMat); t.rotation.x = Math.PI / 2; t.position.y = .07 + i * .12; t.castShadow = true; g.add(t); } return g; }
function sack(k = 1) { const m = new THREE.Mesh(new THREE.SphereGeometry(.42, 10, 8), pm('sack', { color: '#cdb27a', roughness: 1 })); m.scale.set(k, .8 * k, .85 * k); m.position.y = .3 * k; m.castShadow = true; const g = new THREE.Group(); g.add(m); const tie = new THREE.Mesh(new THREE.CylinderGeometry(.08, .14, .22, 6), pm('sackT', { color: '#8a6a3a' })); tie.position.y = .62 * k; g.add(tie); return g; }
function banner(col, h = 3.4) {
  const g = new THREE.Group(); const pole = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, h, 6), woodMat); pole.position.y = h / 2; pole.castShadow = true; g.add(pole);
  const top = new THREE.Mesh(new THREE.SphereGeometry(.14, 8, 6), goldTrim()); top.position.y = h + .1; g.add(top);
  const cl = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.7, 6, 4), pm('ban' + col, { color: col, roughness: .7, side: THREE.DoubleSide, emissive: col, emissiveIntensity: .15 }));
  const pos = cl.geometry.attributes.position, base = Float32Array.from(pos.array); cl.position.set(.6, h - 1, 0); cl.castShadow = true; g.add(cl);
  cl.onBeforeRender = () => { const t = performance.now() * .004; for (let i = 0; i < pos.count; i++) { const x = base[i * 3] + .55; pos.array[i * 3 + 2] = Math.sin(x * 3 - t) * .12 * x; } pos.needsUpdate = true; };
  const trim = new THREE.Mesh(new THREE.BoxGeometry(1.15, .1, .06), goldTrim()); trim.position.set(.6, h - .12, 0); g.add(trim);
  return g;
}
/* matelots animés */
const SKIN_C = ['#f1c27d', '#d9a066', '#a86b3c', '#7a4a2a'];
function pirateNPC(i, opt = {}) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const shirt = opt.shirt || ['#e8e2d0', '#c0392b', '#2f6fd8', '#f2f2f2', '#2e8b57'][i % 5];
  const mk = (geo, col, x, y, z, o = {}) => { const m = new THREE.Mesh(geo, pm('npc' + col, { color: col, roughness: .8, ...o })); m.position.set(x, y, z); m.castShadow = true; body.add(m); return m; };
  mk(new THREE.CylinderGeometry(.16, .2, .6, 8), '#3b2f2a', -.13, .3, 0); mk(new THREE.CylinderGeometry(.16, .2, .6, 8), '#3b2f2a', .13, .3, 0); // jambes
  mk(new THREE.CapsuleGeometry(.32, .45, 4, 10), shirt, 0, .95, 0); // torse
  if (i % 2 === 0) mk(new THREE.TorusGeometry(.31, .05, 5, 16).rotateX(Math.PI / 2), '#c0392b', 0, .9, 0); // rayure / ceinture
  mk(new THREE.CylinderGeometry(.34, .34, .1, 12), '#2a1a10', 0, .72, 0); // ceinture
  const armL = mk(new THREE.CapsuleGeometry(.1, .45, 3, 6), shirt, -.42, 1.0, 0), armR = mk(new THREE.CapsuleGeometry(.1, .45, 3, 6), shirt, .42, 1.0, 0);
  armL.rotation.z = .25; armR.rotation.z = -.25;
  const sk = SKIN_C[i % 4]; mk(new THREE.SphereGeometry(.27, 12, 10), sk, 0, 1.62, 0);
  mk(new THREE.SphereGeometry(.05, 6, 4), '#111', -.09, 1.66, .24); mk(new THREE.SphereGeometry(.05, 6, 4), '#111', .09, 1.66, .24);
  if (i % 3 === 1) mk(new THREE.CylinderGeometry(.13, .1, .12, 8), '#111', .1, 1.67, .2).rotation.x = Math.PI / 2; // bandeau d'œil
  const hat = opt.hat || ['bandana', 'tricorne', 'bandana', 'none', 'tricorne'][i % 5];
  if (hat === 'bandana') { mk(new THREE.SphereGeometry(.29, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), ['#d32f2f', '#1f4fa8', '#f2c12e'][i % 3], 0, 1.66, 0); }
  if (hat === 'tricorne' || hat === 'captain') { const c = hat === 'captain'; const brim = mk(new THREE.CylinderGeometry(.5, .5, .06, 3), c ? '#1a1a2e' : '#1c1410', 0, 1.86, 0); brim.rotation.y = Math.PI / 6; mk(new THREE.CylinderGeometry(.22, .28, .3, 10), c ? '#1a1a2e' : '#1c1410', 0, 2.0, 0); if (c) { const t = new THREE.Mesh(new THREE.TorusGeometry(.27, .04, 5, 14), goldTrim()); t.rotation.x = Math.PI / 2; t.position.y = 1.9; body.add(t); const f = new THREE.Mesh(new THREE.ConeGeometry(.06, .5, 5), pm('plume', { color: '#ffffff' })); f.position.set(.15, 2.25, -.05); f.rotation.z = -.5; body.add(f); } }
  if (opt.cargo) { const c = M('crate', .45); c.position.set(0, 1.25, .35); body.add(c); armL.rotation.x = armR.rotation.x = -1.2; }
  const ph = i * 1.7, walk = opt.walk;
  body.children[0].onBeforeRender = () => {
    const t = performance.now() * .001 + ph;
    if (walk) { const u = (Math.sin(t * .35) + 1) / 2; g.position.x = walk[0] + (walk[1] - walk[0]) * u; g.rotation.y = Math.cos(t * .35) > 0 ? Math.PI / 2 : -Math.PI / 2; body.position.y = Math.abs(Math.sin(t * 6)) * .08; if (!opt.cargo) { armL.rotation.x = Math.sin(t * 6) * .6; armR.rotation.x = -Math.sin(t * 6) * .6; } }
    else { body.position.y = Math.sin(t * 2) * .03; if (opt.wave) armR.rotation.z = -2.4 + Math.sin(t * 6) * .4; body.rotation.y = Math.sin(t * .5) * .4; }
  };
  g.scale.setScalar(opt.k || 1); return g;
}
/* grue de chargement avec caisse qui se balance */
function crane() {
  const g = new THREE.Group(), add = (geo, x, y, z, m = woodMat) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  add(new THREE.BoxGeometry(.35, 4.2, .35), 0, 2.1, 0); add(new THREE.BoxGeometry(.6, .3, .6), 0, .15, 0, ironMat);
  const arm = add(new THREE.BoxGeometry(3.4, .26, .26), 1.4, 4.05, 0); const brace = add(new THREE.BoxGeometry(.18, 1.9, .18), .65, 3.3, 0); brace.rotation.z = -.75;
  const piv = new THREE.Group(); piv.position.set(2.9, 3.95, 0); g.add(piv);
  const ln = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 1.8, 4), ropeMat); ln.position.y = -.9; piv.add(ln);
  const cr = M('crate', .7); cr.position.y = -2.25; piv.add(cr);
  ln.onBeforeRender = () => { const t = performance.now() * .001; piv.rotation.z = Math.sin(t * 1.3) * .12; piv.rotation.x = Math.sin(t * .9) * .08; };
  return g;
}
function shipNameFor(l) { return SHIPLV[clamp(l, 1, 5)].name; }
const QUAI_NEW = [null, '', 'Brigantin Rouge (plus grand), lanternes, tonneaux, sacs, rambarde en cordage, 2 matelots',
  'Frégate Azur avec canons et figure de proue dorée, ponton en T, grue de chargement, passerelle, drapeaux',
  "Galion de Guerre violet avec hublots lumineux, entrepôt, canot, bannières, canon de quai, navire d'escorte",
  "Vaisseau Royal d'Or couronné, phare, arche dorée, tapis royal, trésor sur le quai, 2 navires d'escorte"];
function buildQuai(l) {
  const g = new THREE.Group(), c = new THREE.Group(), P = 3.25, DY = 1.35;
  const nP = [0, 3, 4, 5, 5, 6][l], end = (nP - 1) * P;
  const put = (o, x, y, z, ry = 0) => { o.position.set(x, y, z); o.rotation.y = ry; c.add(o); return o; };
  const deck = (o, x, z, ry = 0) => put(o, x, DY, z, ry);
  for (let i = 0; i < nP; i++) put(M('structure-platform-dock', 1.3), i * P, -.35, 0);
  // ponton en T et jetée latérale (côté opposé au navire)
  if (l >= 3) put(M('structure-platform-dock', 1.3), end, -.35, -P);
  if (l >= 4) { put(M('structure-platform-dock', 1.3), end, -.35, -2 * P); put(M('structure-platform-dock', 1.3), end - P, -.35, -P); }
  if (l >= 5) { put(M('structure-platform-dock', 1.3), end - P, -.35, -2 * P); put(M('structure-platform-dock', 1.3), end + P, -.35, 0); }
  // --- navire ---
  const L = SHIPLV[l], ship = makeLevelShip(l); const shipX = Math.max(5.5, end * .55 + 1.5), shipZ = 1.7 + .5 + 2.4 * L.s;
  ship.position.set(shipX, 0, shipZ); ship.rotation.y = Math.PI / 2; c.add(ship);
  const shipDeckY = -.45 + SHIP_DECK * L.s;
  // bittes d'amarrage + amarres vers le navire
  const len = (SHIP_LEN[ship.userData.inner.name] || 5.3) * L.s;
  [shipX - len * .7, shipX + len * .7].forEach((x, i) => { deck(bollard(), x, 1.3); c.add(rope(new V3(x, DY + .55, 1.3), new V3(shipX + (i ? 1 : -1) * len * .55, shipDeckY + .2, shipZ - 1.9 * L.s), .5)); });
  // de base : tonneau, caisse, rouleau de cordage, 1 matelot
  deck(M('barrel', .8), 1.4, -.9); deck(M('crate', .85), 2.6, -1.0, .3); deck(ropeCoil(), 4.2, -1.0);
  deck(pirateNPC(0, { wave: true }), 3.3, .2, .6);
  if (l >= 2) {
    // rambarde en cordage côté mer
    const posts = []; for (let x = 0; x <= end + .1; x += 1.6) { const pst = deck(new THREE.Mesh(new THREE.CylinderGeometry(.08, .1, 1.1, 6), woodMat), x - 1, -1.5); pst.position.y = DY + .55; pst.castShadow = true; posts.push(x - 1); }
    for (let i = 0; i < posts.length - 1; i++) c.add(rope(new V3(posts[i], DY + 1.0, -1.5), new V3(posts[i + 1], DY + 1.0, -1.5), .22, .035));
    // lanternes
    const lc = l >= 5 ? '#ffd23f' : l >= 4 ? '#c88bff' : l >= 3 ? '#5fb0ff' : '#ff8a3a';
    for (let x = .2, k = 0; x <= end + .1 && k < l + 1; x += P * .9, k++) { const Ln = lantern(lc); Ln.scale.setScalar(1.15); deck(Ln, x, 1.45); }
    // pile de tonneaux + caisses + sacs
    deck(M('barrel', .75), -.2, -.6); deck(M('barrel', .75), .5, -1.1); const b3 = deck(M('barrel', .7), .15, -.85); b3.position.y = DY + .95;
    deck(M('crate', .8), 5.6, -1.0, .1); const c2 = deck(M('crate', .7), 5.6, -1.0, .5); c2.position.y = DY + .65; deck(M('crate', .75), 6.6, -.9, -.2);
    deck(sack(), 7.6, -1.0); deck(sack(.85), 8.2, -.6); deck(sack(.9), 7.9, -1.1).position.y = DY + .35;
    deck(pirateNPC(1, { walk: [1, end - .5], cargo: true }), 2, .3);
    deck(M('flag-pennant', 1), end + 1.3, -1.3);
  }
  if (l >= 3) {
    // grue, passerelle vers le navire, drapeaux, bouteilles, boulets
    deck(crane(), end - .3, -P - .9, Math.PI);
    const gw = new THREE.Group(); const gl = Math.hypot(shipZ - 1.9 * L.s - 1.5, DY - shipDeckY - .1) + .4;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(1.3, .12, gl), pm('gway', { color: '#8a5a34', roughness: .85 })); plank.castShadow = true; plank.receiveShadow = true; gw.add(plank);
    for (let i = 0; i < 6; i++) { const sl = new THREE.Mesh(new THREE.BoxGeometry(1.3, .08, .1), woodMat); sl.position.set(0, .09, -gl / 2 + .3 + i * (gl - .6) / 5); gw.add(sl); }
    [-.62, .62].forEach(x => gw.add(rope(new V3(x, .8, -gl / 2), new V3(x, .8, gl / 2), .15, .035)));
    if (l >= 5) { const cp = new THREE.Mesh(new THREE.BoxGeometry(.9, .03, gl), pm('carpet', { color: '#b0102a', roughness: .9 })); cp.position.y = .08; gw.add(cp); }
    const z0 = 1.5, z1 = shipZ - 1.9 * L.s; gw.position.set(shipX, (DY + shipDeckY + .2) / 2, (z0 + z1) / 2); gw.rotation.x = Math.atan2(DY - shipDeckY - .2, z1 - z0); c.add(gw);
    deck(M('flag-high-pennant', 1), end + 1.1, -P - 1.1); deck(M('flag-pirate', 1), -.6, 1.3);
    deck(M('crate-bottles', .8), end - .6, -P + .6, .4);
    for (let i = 0; i < 6; i++) { const b = M('cannon-ball', .7); deck(b, end - 2.2 + (i % 3) * .38, -P + .9 + Math.floor(i / 3) * .38); if (i === 5) b.position.y = DY + .25; }
    deck(pirateNPC(2), end - 1.3, -P - .3, 2.2); deck(ropeCoil(), end + .9, -P + .4);
  }
  if (l >= 4) {
    // entrepôt, canot, bannières, canon de quai, escorte
    const wh = new THREE.Group(); wh.add(M('structure', 1.15)); wh.add(M('structure-roof', 1.2)); deck(wh, end, -2 * P - .2, Math.PI);
    put(M('boat-row-large', 1.1), end - 2 * P + .4, -.2, -2 * P - .4, .4);
    [[.6, -1.6], [end + .4, 1.4], [end - P, -P - 1.4]].forEach(([x, z]) => deck(banner(l >= 5 ? '#c8102e' : '#6a2bd0'), x, z));
    const dc = M('cannon', 1.2); deck(dc, end + 1.2, .2, Math.PI / 2);
    const esc = makeShip(1, S.skin, .42, Math.min(l - 1, 4)); esc.position.set(end + 7, 0, -2 * P - 2); esc.rotation.y = .3; c.add(esc); g.userData.esc = [esc];
    deck(pirateNPC(3, { hat: 'tricorne' }), end - P + .4, -2 * P + .6, -.8);
  }
  if (l >= 5) {
    // phare, arche dorée, trésor, capitaine
    const lh = M('tower-complete-small', .7); deck(lh, end + P + .2, -.4); const cr = crystal('#ffd23f', 1); cr.position.set(end + P + .2, DY + 6.4, -.4); c.add(cr);
    const arch = new THREE.Group(), st = pm('p5', { color: '#fffaf0', roughness: .35, metalness: .05, flatShading: true });
    [-1.7, 1.7].forEach(z => { const pl = new THREE.Mesh(new THREE.BoxGeometry(.5, 3.6, .5), st); pl.position.set(0, 1.8, z); pl.castShadow = true; arch.add(pl); const cap = new THREE.Mesh(new THREE.BoxGeometry(.66, .2, .66), goldTrim()); cap.position.set(0, 3.65, z); arch.add(cap); });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(.55, .45, 4.0), goldTrim()); beam.position.y = 3.9; arch.add(beam); const ac = goldCrown(.45); ac.position.y = 4.55; arch.add(ac);
    deck(arch, -.9, 0);
    const cp = new THREE.Mesh(new THREE.BoxGeometry(end + 1.5, .03, .9), pm('carpet', { color: '#b0102a', roughness: .9 })); cp.position.set(end / 2 - .2, DY + .02, .3); c.add(cp);
    const ch = M('chest', 1.1); deck(ch, end - P + .3, -2 * P + .3, .6); const cpile = coinPile(70, .9, .6, 7); cpile.position.set(end - P - .9, DY, -2 * P + .9); c.add(cpile);
    deck(pirateNPC(4, { hat: 'captain', shirt: '#7a1020', k: 1.15 }), shipX - 1, .9, Math.PI);
    const esc2 = makeShip(1, S.skin, .42, 3); esc2.position.set(end + 9, 0, 5); esc2.rotation.y = -.4; c.add(esc2); g.userData.esc.push(esc2);
  }
  c.userData.labelY = Math.max(5, 9.5 * L.s); c.userData.labelX = shipX;
  finishLevel(g, c, l, 0); g.userData.ship = ship; return g;
}
const BUILDERS = { tresor: buildTresor, canon: buildCanon, quai: buildQuai };
const homeB = {};
function placeBuilding(key, anim) {
  if (homeB[key]) { homeGrp.remove(homeB[key]); }
  const l = S.b[key], inner = BUILDERS[key](l), sc = LV[l].scale;
  const g = new THREE.Group(); inner.scale.setScalar(sc); g.add(inner);
  if (key === 'quai') homeShip = inner.userData.ship;
  g.userData = { key, labelY: inner.userData.labelY * sc, labelX: (inner.userData.labelX || 0) * sc, gun: inner.userData.gun, lvl: l };
  if (key === 'quai') { g.position.set(quaiPos[0], 0, quaiPos[1]); g.rotation.y = -DOCK_A; }
  else { const [x, z] = SLOTS[key]; g.position.set(x, islandH(HOME, x, z) - .05, z); g.rotation.y = key === 'canon' ? .9 : .2; }
  g.traverse(o => { if (o.isMesh) o.userData.bkey = key; });
  homeGrp.add(g); homeB[key] = g;
  if (anim) {
    g.scale.setScalar(.01);
    tween(.8, k => g.scale.setScalar(Math.max(.01, easeOutBack(k))));
    const wp = g.getWorldPosition(new V3());
    FX.dust(wp, 6 * sc); FX.sparkle(wp.clone().setY(wp.y + 3), 60, 4 * sc);
    const col = new THREE.Color(LV[l].col);
    for (let i = 0; i < 70; i++) { const a = rand(0, 6.28), sp = rand(4, 11); fire.emit(wp.x, wp.y + 1.5, wp.z, Math.cos(a) * sp, rand(4, 14), Math.sin(a) * sp, rand(.7, 1.4), rand(.8, 1.6), .2, [col.r * 5, col.g * 5, col.b * 5], [col.r * 2, col.g * 2, col.b * 2], 1, .5, 6); }
    flashLight(wp, 1.2);
  }
}

/* seagulls */
const gulls = [];
(function () {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, .3, -1.6, .35, -.2, 0, 0, -.3, 0, 0, .3, 1.6, .35, -.2, 0, 0, -.3], 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: '#f4f6fa', side: THREE.DoubleSide, roughness: .8 });
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(geo.clone(), mat); m.userData = { r: rand(25, 45), h: rand(16, 26), sp: rand(.15, .3) * (i % 2 ? 1 : -1), ph: rand(0, 6), c: i < 4 ? HOME : ENEMY }; m.scale.setScalar(.8); scene.add(m); gulls.push(m); }
})();
let npcShip = null;
const fleets = [];

/* enemy island static decor */
const EWALLS = [[-12, -8, 1.0, 'castle-wall'], [-6, -13.5, .45, 'castle-gate'], [1, -15, 0, 'castle-window'], [8, -13, -.5, 'castle-wall']];
function enemyDecor(seed = 1234) {
  const I = ENEMY, g = enemyGrp, k = I.R / 22;
  decorate(I, g, seed, [[0, 0, 13 * k]]);
  EWALLS.forEach(([x, z, r, n]) => placeOn(I, g, M(n, .9), x * k, z * k, r));
  const wreckDock = M('structure-platform-dock', 1.3); wreckDock.position.set(-shoreR(I, 2.6) * .9 * Math.cos(.5), -.35, 0); g.add(wreckDock);
  lush(I, g, seed + 7, [[ESL.tresor[0] * k, ESL.tresor[1] * k, 5.5], ...ESL.tours.map(t => [t[0] * k, t[1] * k, 3]), ...ESL.huts.map(t => [t[0] * k, t[1] * k, 3.5]), [ESL.vigie[0][0] * k, ESL.vigie[0][1] * k, 3]], 500, 90, 14);
}

/* ---------------- LABELS ---------------- */
const labels = [];
const labelsEl = $('#labels');
function addLabel(el, getPos) { labelsEl.appendChild(el); const L = { el, getPos }; labels.push(L); return L; }
function removeLabel(L) { if (!L) return; L.el.remove(); const i = labels.indexOf(L); if (i >= 0) labels.splice(i, 1); }
const _p = new V3(), _w = new V3();
function toScreen(v) { _p.copy(v).project(camera); return { x: (_p.x * .5 + .5) * innerWidth, y: (-_p.y * .5 + .5) * innerHeight, vis: _p.z < 1 }; }
function updateLabels() {
  for (const L of labels) {
    const p = L.getPos(); if (!p) { L.el.style.display = 'none'; continue; }
    const s = toScreen(p);
    if (!s.vis) { L.el.style.display = 'none'; continue; }
    L.el.style.display = '';
    L.el.style.transform = `translate(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px) translate(-50%,-100%)`;
  }
}
const homeLabels = {};
function buildingAnchor(key) { const g = homeB[key]; if (!g) return null; const v = new V3(g.userData.labelX || 0, g.userData.labelY, 0); return g.localToWorld(v); }
function makeHomeLabels() {
  for (const k of Object.keys(BUILD)) {
    const el = document.createElement('div'); el.className = 'blabel';
    el.innerHTML = `<div class="bl-name"><span class="bl-lv">${S.b[k]}</span>${BUILD[k].name.split(' ')[0] === 'Batterie' ? 'Canons' : BUILD[k].name.split(' ')[0] === 'Quai' ? 'Quai' : 'Trésor'}</div><div class="bl-up"></div>`;
    el.addEventListener('click', e => { e.stopPropagation(); openUpgrade(k); });
    homeLabels[k] = addLabel(el, () => mode === 'home' ? buildingAnchor(k) : null);
  }
  const bub = document.createElement('div'); bub.className = 'bubble'; bub.innerHTML = `<svg><use href="#i-coin"/></svg><span>0</span>`;
  bub.addEventListener('click', e => { e.stopPropagation(); collect(); });
  homeLabels.bubble = addLabel(bub, () => (mode === 'home' && S.stored >= 40) ? buildingAnchor('tresor').add(new V3(0, 2.5, 0)) : null);
}
function refreshHomeLabels() {
  for (const k of Object.keys(BUILD)) {
    const L = homeLabels[k]; if (!L) continue; const l = S.b[k];
    const lv = L.el.querySelector('.bl-lv'); lv.textContent = l; lv.style.background = `radial-gradient(circle at 35% 30%,#fff,${LV[l].col} 55%,#1a1030)`; L.el.querySelector('.bl-name').style.boxShadow = `0 0 0 2px ${LV[l].col},0 0 12px ${LV[l].col}88,0 4px 10px rgba(0,0,0,.5)`;
    if (k === 'quai') { let sn = L.el.querySelector('.bl-ship'); if (!sn) { sn = document.createElement('div'); sn.className = 'bl-ship'; L.el.insertBefore(sn, L.el.querySelector('.bl-up')); } sn.textContent = '⛵ ' + shipNameFor(l); sn.style.borderColor = SHIPLV[l].col; }
    const up = L.el.querySelector('.bl-up');
    up.textContent = l < 5 && S.gold >= BUILD[k].cost[l + 1] ? '▲ Amélioration dispo' : '';
  }
}

/* ---------------- TWEENS / CAMERA / INPUT ---------------- */
const tweens = [];
function tween(dur, fn, done) { tweens.push({ t: 0, dur, fn, done }); }
function updTweens(dt) { for (let i = tweens.length - 1; i >= 0; i--) { const w = tweens[i]; w.t += dt; const k = Math.min(1, w.t / w.dur); w.fn(k); if (k >= 1) { tweens.splice(i, 1); w.done && w.done(); } } }
const wait = s => new Promise(r => tween(s, () => { }, r));

let mode = 'loading';
const HOME_T = new V3(5, 2, 3.5); // centre de vue : île + quai/navire
const camState = { target: new V3(0, 2, 0), az: .62, pol: .96, dist: 100 };
const camGoal = { target: new V3(0, 2, 0), az: .62, pol: .96, dist: 100 };
let cine = null;
// distance de base : l'île entière tient confortablement à l'écran (portrait ou paysage)
function baseDist() { const a = innerWidth / innerHeight; return a < 1 ? 66 / Math.max(.45, a * 1.2) : 74; }
const zMin = () => baseDist() * ZMIN, zMax = () => baseDist() * ZMAX;
// plus on dézoome, plus la caméra bascule vers une vue « carte » (plongeante)
function effPol(c) { const z = c.dist / baseDist(); return clamp(c.pol - Math.max(0, z - 1) * .1, .58, 1.25); }
function camPosFrom(c, out = new V3()) { const pol = effPol(c), sp = Math.sin(pol); return out.set(c.target.x + sp * Math.sin(c.az) * c.dist, c.target.y + Math.cos(pol) * c.dist, c.target.z + sp * Math.cos(c.az) * c.dist); }
function applyCam() { camPosFrom(camState, camera.position); camera.lookAt(camState.target); }
function setCamNow(target, az, pol, dist) { for (const c of [camState, camGoal]) { c.target.copy(target); c.az = az; c.pol = pol; c.dist = dist; } }
function zoomBy(f) { camGoal.dist = clamp(camGoal.dist * f, zMin(), zMax()); }
let panCenter = null, panRadius = 200;
function clampTarget() {
  const c = panCenter || new V3(0, 2, 0); const dx = camGoal.target.x - c.x, dz = camGoal.target.z - c.z, L = Math.hypot(dx, dz);
  if (L > panRadius) { camGoal.target.x = c.x + dx / L * panRadius; camGoal.target.z = c.z + dz / L * panRadius; }
}
function panBy(dx, dy) {
  const k = 2 * camState.dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / innerHeight;
  const s = Math.sin(camState.az), c = Math.cos(camState.az), tilt = 1 / Math.max(.45, Math.cos(effPol(camState)) + .25);
  camGoal.target.x -= (c * dx) * k; camGoal.target.z -= (-s * dx) * k;
  camGoal.target.x -= s * dy * k * tilt; camGoal.target.z -= c * dy * k * tilt;
  clampTarget(); userMoved = performance.now();
}
let userMoved = 0;

const ptrs = new Map(); let pinch0 = 0, ang0 = 0, tapStart = null, rotDrag = false;
const dist2 = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
const ang2 = () => { const [a, b] = [...ptrs.values()]; return Math.atan2(b.y - a.y, b.x - a.x); };
const ctlOn = () => mode === 'home' || mode === 'raid';
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  rotDrag = e.button === 2 || e.shiftKey;
  if (ptrs.size === 1) tapStart = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
  if (ptrs.size === 2) { pinch0 = dist2(); ang0 = ang2(); tapStart = null; }
});
canvas.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (tapStart && Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) > 9) tapStart.moved = true;
  if (!ctlOn()) return;
  if (ptrs.size === 1) {
    if (rotDrag) { camGoal.az -= dx * .0055; camGoal.pol = clamp(camGoal.pol - dy * .003, .5, 1.2); }
    else if (tapStart && tapStart.moved) panBy(dx, dy);
  } else if (ptrs.size === 2) {
    const d = dist2(), a = ang2();
    if (pinch0 > 0) camGoal.dist = clamp(camGoal.dist * pinch0 / d, zMin(), zMax());
    let da = a - ang0; da = Math.atan2(Math.sin(da), Math.cos(da)); camGoal.az -= da;
    pinch0 = d; ang0 = a; userMoved = performance.now();
  }
});
const endPtr = e => {
  ptrs.delete(e.pointerId);
  if (tapStart && !tapStart.moved && performance.now() - tapStart.t < 450 && e.type === 'pointerup') onTap(e.clientX, e.clientY);
  if (ptrs.size === 0) tapStart = null;
  if (ptrs.size === 2) { pinch0 = dist2(); ang0 = ang2(); }
};
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('wheel', e => { if (ctlOn()) { zoomBy(1 + e.deltaY * .0012); userMoved = performance.now(); } }, { passive: true });
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function onTap(x, y) {
  ndc.set(x / innerWidth * 2 - 1, -y / innerHeight * 2 + 1); ray.setFromCamera(ndc, camera);
  if (mode === 'home') {
    const hits = ray.intersectObjects(Object.values(homeB), true);
    if (hits.length) { const k = hits[0].object.userData.bkey; if (k) { SFX.click(); openUpgrade(k); return; } }
    const rh = ray.intersectObjects(rivalGrps.filter(Boolean), true);
    if (rh.length) { let o = rh[0].object; while (o && o.userData.rival === undefined) o = o.parent; if (o) { SFX.click(); openSeaMap(o.userData.rival); } }
  } else if (mode === 'raid' && R) {
    const objs = R.blds.filter(b => !b.dead).map(b => b.g);
    const hits = ray.intersectObjects(objs, true);
    if (hits.length) { const b = hits[0].object.userData.eb; if (b && !b.dead) { R.target = b; SFX.click(); $('#rHint').style.opacity = 0; } }
  }
}
function flyTo(x, z, dist) { camGoal.target.set(x, 2, z); if (dist) camGoal.dist = clamp(dist, zMin(), zMax()); userMoved = performance.now(); }

/* ---------------- PROJECTILES ---------------- */
const ballGeo = new THREE.SphereGeometry(.42, 14, 10);
const ballMat = new THREE.MeshStandardMaterial({ color: '#202228', metalness: .7, roughness: .35 });
const shots = [];
function fireShot(from, to, dur, arc, onHit, big = false) {
  let m;
  if (big) { m = M('barrel', 1.0); m.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.emissive = new THREE.Color('#ff5a00'); o.material.emissiveIntensity = .25; } }); }
  else m = new THREE.Mesh(ballGeo, ballMat);
  m.position.copy(from); scene.add(m);
  shots.push({ m, from: from.clone(), to: to.clone(), t: 0, dur, arc, onHit, big });
}
function updShots(dt) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i]; s.t += dt; const k = Math.min(1, s.t / s.dur);
    s.m.position.lerpVectors(s.from, s.to, k); s.m.position.y += s.arc * 4 * k * (1 - k);
    const p = s.m.position;
    smoke.emit(p.x, p.y, p.z, rand(-.3, .3), rand(0, .6), rand(-.3, .3), s.big ? 1.6 : .8, s.big ? 2 : .9, s.big ? 6 : 2.6, [.92, .9, .9], [.7, .7, .74], s.big ? .9 : .55, .5, -.3);
    if (s.big) { s.m.rotation.x += dt * 8; s.m.rotation.z += dt * 5; fire.emit(p.x, p.y, p.z, rand(-1, 1), rand(0, 2), rand(-1, 1), .4, 2.5, 1, [7, 3, .6], [2, .4, .05], 1, .3, 0); }
    if (k >= 1) { scene.remove(s.m); shots.splice(i, 1); s.onHit && s.onHit(s.to.clone()); }
  }
}

/* ---------------- RIVAUX (autres joueurs — simulés pour le prototype) ---------------- */
const EN_NAMES = ['Barbe-Grise', 'Dame Écarlate', 'Le Kraken Noir', 'Jack Sans-Dents', 'Reine des Brumes', 'Morgane la Rousse', 'Capitaine Corbeau', 'Le Baron Salé', 'Anne Tempête', 'Long John Rhum', 'Lady Sabre', 'Œil-de-Lynx', 'Bosco Tonnerre', 'La Veuve Grise', 'Hector Mille-Sabords', 'Rackham le Fou'];
const RCLANS = ['Les Requins', "Crânes d'Or", 'Marée Noire', 'Kraken Club', 'Pavillon Rouge', 'Les Corsaires', 'Frères de la Côte'];
const RCOLS = ['#e5384f', '#2f8fe0', '#9a5cff', '#2fbf6a', '#f39c1e', '#ff6bd0'];
function genRival(i, gen = 0) {
  const used = (S.rivals || []).filter((r, j) => r && j !== i).map(r => r.name);
  const pool = EN_NAMES.filter(n => !used.includes(n));
  const lvl = Math.max(1, S.lvl + Math.floor(rand(-1, 3)));
  return {
    i, gen, name: pool[Math.floor(Math.random() * pool.length)], clan: RCLANS[Math.floor(Math.random() * RCLANS.length)], col: RCOLS[i % RCOLS.length],
    lvl, tro: Math.max(0, S.tro + Math.floor(rand(-40, 90))), loot: Math.round((1600 + lvl * 900) * rand(.8, 1.45) / 10) * 10,
    gems: Math.random() < .45 ? Math.floor(rand(5, 25)) : 0, towers: lvl <= 1 ? 1 : lvl <= 3 ? 2 : 3, win: 18 + lvl * 2 + Math.floor(rand(0, 8)),
    online: Math.random() < .45, seen: Math.floor(rand(1, 20)), shield: 0,
  };
}
function ensureRivals() {
  if (Array.isArray(S.rivals) && S.rivals.length === RSLOTS.length && S.rivals.every(Boolean)) return;
  S.rivals = []; RSLOTS.forEach((_, i) => S.rivals[i] = genRival(i));
  S.rivals[4].shield = Date.now() + 72 * 60e3;
  S.defLog = [{ r: 1, gold: 840, ago: '2 h', stars: 2 }, { r: 3, gold: 1260, ago: '5 h', stars: 1 }];
  save();
}
const rivalShield = rv => Math.max(0, (rv.shield || 0) - Date.now());
const fmtDur = ms => { const m = Math.ceil(ms / 6e4); return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m} min`; };
const fmtK = n => n >= 10000 ? (n / 1000).toFixed(1).replace('.', ',') + ' k' : fmt(n);
function diffOf(rv) { const d = (rv.towers * 1.4 + rv.lvl) - (S.b.canon + S.b.quai + S.lvl); return d < 0 ? ['Facile', 'easy'] : d < 3 ? ['Équilibré', 'mid'] : ['Difficile', 'hard']; }
const rivalGrps = [], rivalLabels = [];
function disposeIsland(g) { g.traverse(o => { if (o.isInstancedMesh) { if (o.geometry !== tuftGeo) o.geometry.dispose(); o.dispose(); } }); if (g.userData.ground) g.userData.ground.geometry.dispose(); }
function removeSwayersIn(grp) { for (let i = swayers.length - 1; i >= 0; i--) { let o = swayers[i]; while (o && o !== grp) o = o.parent; if (o === grp) swayers.splice(i, 1); } }
function buildRivalIsland(i) {
  if (rivalGrps[i]) { scene.remove(rivalGrps[i]); disposeIsland(rivalGrps[i]); }
  const I = RSLOTS[i], rv = S.rivals[i], k = I.R / 22, r = mulberry(31 + i * 97 + (rv.gen || 0) * 13);
  const g = makeIsland(I, { rings: 44, seg: 120 });
  const put = (o, x, z, ry) => placeOn(I, g, o, x * k, z * k, ry ?? r() * 6.28, -.05);
  put(buildTresor(clamp(1 + Math.floor(rv.lvl / 2), 1, 5)), ESL.tresor[0], ESL.tresor[1], .3);
  for (let t = 0; t < rv.towers; t++) put(towerModel(), ESL.tours[t][0], ESL.tours[t][1]);
  ESL.huts.forEach(p => put(hutModel(), p[0], p[1]));
  put(vigieModel(), ESL.vigie[0][0], ESL.vigie[0][1]);
  EWALLS.forEach(([x, z, ry, n]) => put(M(n, .9), x, z, ry));
  const avoid = [[ESL.tresor[0] * k, ESL.tresor[1] * k, 6], ...ESL.tours.map(t => [t[0] * k, t[1] * k, 3.2]), ...ESL.huts.map(t => [t[0] * k, t[1] * k, 3.6]), [ESL.vigie[0][0] * k, ESL.vigie[0][1] * k, 3]];
  const palms = ['palm-detailed-bend', 'palm-detailed-straight', 'palm-bend', 'palm-straight'];
  for (let n = 0, tries = 0; n < 11 && tries < 200; tries++) {
    const a = r() * 6.28, R = shoreR(I, a) * (.55 + r() * .33), x = Math.cos(a) * R, z = Math.sin(a) * R;
    if (avoid.some(v => Math.hypot(v[0] - x, v[1] - z) < v[2])) continue;
    placeOn(I, g, M(palms[Math.floor(r() * 4)], .9 + r() * .5), x, z, r() * 6.28, -.1); avoid.push([x, z, 2.4]); n++;
  }
  for (let n = 0; n < 5; n++) { const a = r() * 6.28, R = shoreR(I, a) * (.95 + r() * .1); placeOn(I, g, M(['rocks-sand-a', 'rocks-sand-b', 'rocks-a', 'rocks-c'][n % 4], .6 + r() * .5), Math.cos(a) * R, Math.sin(a) * R, r() * 6.28, -.5); }
  lush(I, g, 500 + i * 11 + (rv.gen || 0), avoid, 260, 50, 6);
  g.userData.rival = i; rivalGrps[i] = g;
  if (raidRival === i) g.visible = false;
}
function rivalLabelHTML(i) {
  const rv = S.rivals[i], sh = rivalShield(rv);
  return `<div class="rl-card${sh ? ' shield' : ''}"><div class="rl-name"><i style="background:${rv.col}"></i><span>${rv.name}</span><b>${rv.lvl}</b></div>
   <div class="rl-loot">${ic('i-coin')}${fmtK(rv.loot)}${sh ? `<em>🛡 ${fmtDur(sh)}</em>` : ''}</div></div>${sh ? '' : `<button class="rl-go">${ic('i-swords')}Attaquer</button>`}`;
}
function refreshRivalLabels() { rivalLabels.forEach((L, i) => { if (L) { L.el.innerHTML = rivalLabelHTML(i); } }); }
function buildRivals() {
  ensureRivals();
  RSLOTS.forEach((I, i) => {
    buildRivalIsland(i);
    if (!rivalLabels[i]) {
      const el = document.createElement('div'); el.className = 'blabel rlabel';
      el.addEventListener('click', e => { e.stopPropagation(); SFX.click(); if (e.target.closest('.rl-go')) attackRival(i); else openSeaMap(i); });
      rivalLabels[i] = addLabel(el, () => mode === 'home' && rivalGrps[i] && rivalGrps[i].visible ? new V3(I.x, 14 + I.R * .2, I.z) : null);
    }
  });
  refreshRivalLabels();
}
function attackRival(i, revenge = false) {
  const rv = S.rivals[i]; if (!rv) return;
  if (!revenge && rivalShield(rv)) { toast(`🛡 ${rv.name} est sous bouclier (${fmtDur(rivalShield(rv))})`, true); return; }
  startRaid(rv);
}
let raidRival = -1;
function prepareRaidIsland(en) {
  cleanupRaidIsland();
  Object.assign(ENEMY, RSLOTS[en.i]);
  enemyGrp = makeIsland(ENEMY); enemyDecor(1000 + en.i * 77 + (en.gen || 0) * 5);
  raidRival = en.i; if (rivalGrps[en.i]) rivalGrps[en.i].visible = false;
}
function cleanupRaidIsland() {
  if (enemyGrp) { removeSwayersIn(enemyGrp); scene.remove(enemyGrp); disposeIsland(enemyGrp); enemyGrp = null; }
  if (raidRival >= 0 && rivalGrps[raidRival]) rivalGrps[raidRival].visible = true;
  raidRival = -1;
}

/* ---------------- RAID ---------------- */
let R = null;
const ESL = { tresor: [0, -1.5], tours: [[-8.5, 5], [8.5, 4.5], [-1, -11]], huts: [[-8, -6.5], [7.5, -7]], vigie: [[0.5, 9.5]] };
function towerModel() { const g = new THREE.Group(); g.add(M('tower-base', 1.2)); const mid = M('tower-middle', 1.2); mid.position.y = 2.4; g.add(mid); const gun = M('cannon', 1.5); gun.position.y = 4.8; g.add(gun); const f = M('flag-pirate-pennant', 1); f.position.set(1.2, 4.8, -1.2); g.add(f); g.userData.gun = gun; return g; }
function hutModel() { const g = new THREE.Group(); g.add(M('structure', 1.2)); g.add(M('structure-roof', 1.25)); g.add(at(M('crate', .8), 2, 0, 1.4)); return g; }
function vigieModel() { const g = new THREE.Group(); g.add(M('tower-watch', 1.05)); const f = M('flag-pirate-high', 1); f.position.y = 2.6; g.add(f); return g; }
function enemyBuilding(type, pos, k) {
  let g, hp, label, h, muzzleY = 0, gun = null, fires = false;
  if (type === 'tresor') { g = buildTresor(raidTL); hp = 1100 * k; label = 'Trésor'; h = 4; }
  else if (type === 'tour') { g = towerModel(); gun = g.userData.gun; hp = 700 * k; label = 'Tour'; h = 6; muzzleY = 5.6; fires = true; }
  else if (type === 'hutte') { g = hutModel(); hp = 420 * k; label = 'Cabane'; h = 3.5; }
  else { g = vigieModel(); hp = 500 * k; label = 'Vigie'; h = 4; }
  ownMats(g);
  const sk = ENEMY.R / 22, x = pos[0] * sk, z = pos[1] * sk; g.position.set(x, islandH(ENEMY, x, z) - .05, z); g.rotation.y = rand(0, 6.28);
  if (gun) gun.parent.rotation.y = 0;
  enemyGrp.add(g);
  const b = { type, g, hp, max: hp, h, label, gun, fires, muzzleY, dead: false, ft: rand(1.5, 3), burn: 0 };
  g.traverse(o => { if (o.isMesh) o.userData.eb = b; });
  const el = document.createElement('div'); el.className = 'blabel enemy';
  el.innerHTML = `<div class="bl-name">${label}</div><div class="hpbar"><i></i></div>`;
  b.L = addLabel(el, () => (mode === 'raid' || mode === 'intro') && !b.dead ? g.localToWorld(new V3(0, h + 1.5, 0)) : null);
  return b;
}
function wpos(o) { return o.getWorldPosition(new V3()); }
function angLerp(a, b, t) { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; }
let raidTL = 3;
function buildRaid(en) {
  const k = 1 + (en.lvl - 1) * .2; raidTL = clamp(1 + Math.floor(en.lvl / 2), 1, 5);
  const blds = [enemyBuilding('tresor', ESL.tresor, k)];
  for (let i = 0; i < en.towers; i++) blds.push(enemyBuilding('tour', ESL.tours[i], k));
  ESL.huts.forEach(p => blds.push(enemyBuilding('hutte', p, k)));
  blds.push(enemyBuilding('vigie', ESL.vigie[0], k));
  const n = SHIPS[S.b.quai], tier = Math.min(3, S.b.quai);
  const a0 = Math.atan2(HOME.z - ENEMY.z, HOME.x - ENEMY.x);
  const ships = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + (i - (n - 1) / 2) * .36, r = ENEMY.R + 14;
    const end = new V3(ENEMY.x + Math.cos(a) * r, 0, ENEMY.z + Math.sin(a) * r);
    const off = clamp(Math.hypot(ENEMY.x, ENEMY.z) - ENEMY.R - 70, 28, 70);
    const start = end.clone().add(new V3(Math.cos(a0), 0, Math.sin(a0)).multiplyScalar(off + i * 6));
    const sh = makeLevelShip(S.b.quai, S.skin, (.62 + S.b.quai * .04) / SHIPLV[clamp(S.b.quai, 1, 5)].s); sh.position.copy(start);
    const head = Math.atan2(-Math.cos(a0), -Math.sin(a0));
    let tang = Math.atan2(-Math.sin(a), Math.cos(a)); if (Math.abs(angLerp(head, tang, 1) - head) > Math.PI / 2) tang += Math.PI;
    sh.rotation.y = head; scene.add(sh);
    const s = { g: sh, start, end, head, tang, hp: SHIPHP[S.b.quai], max: SHIPHP[S.b.quai], dead: false, ft: rand(.3, 1.5), kick: 0, burn: 0 };
    const el = document.createElement('div'); el.className = 'blabel'; el.innerHTML = `<div class="hpbar ally"><i></i></div>`;
    s.L = addLabel(el, () => mode === 'raid' && !s.dead ? sh.localToWorld(new V3(0, 8.5, 0)) : null);
    ships.push(s);
  }
  R = { en, blds, ships, a0, time: 60, target: null, cdV: 0, cdVmax: 9, barrels: 1 + S.barrels, usedBarrels: 0, over: false, stars: 0, pct: 0, treasureDown: false };
  const fl = $('#rFleet'); fl.innerHTML = ''; ships.forEach((s, i) => { const d = document.createElement('div'); d.className = 'fs'; d.innerHTML = `Navire ${i + 1}<div class="hpbar ally" style="width:100%;margin-top:2px"><i></i></div>`; fl.appendChild(d); s.fs = d; });
}
function fleetCenter() { const c = new V3(); let n = 0; for (const s of R.ships) { c.add(s.g.position); n++; } return n ? c.multiplyScalar(1 / n) : c.set(ENEMY.x, 0, ENEMY.z); }
async function startRaid(en) {
  closeModal(); mode = 'intro'; $('#hud').classList.add('hidden'); $('#letterbox').classList.add('on');
  prepareRaidIsland(en);
  buildRaid(en);
  showBanner('RAID', "À L'ABORDAGE !"); SFX.horn(); MUS.intense = true;
  // phase 1 : push in to the docked ship
  const p0 = camera.position.clone(), l0 = camState.target.clone();
  const hs = wpos(homeShip), p1 = hs.clone().add(new V3(-14, 9, 16)), l1 = hs.clone().add(new V3(6, 3, -6));
  cine = () => { };
  if (l0.length() < 70) await new Promise(r => tween(1.1, k => { const e = easeInOut(k); camera.position.lerpVectors(p0, p1, e); camera.lookAt(new V3().lerpVectors(l0, l1, e)); }, r));
  SFX.whoosh(); await flashTo(1, .25);
  { const sc = sun.shadow.camera; sc.left = sc.bottom = -48; sc.right = sc.top = 48; sc.far = 300; sc.updateProjectionMatrix(); }
  sunFocus(ENEMY.x, ENEMY.z);
  const c = new V3(ENEMY.x + Math.cos(R.a0) * 19, 2, ENEMY.z + Math.sin(R.a0) * 19);
  const azB = Math.atan2(Math.cos(R.a0), Math.sin(R.a0)), dB = baseDist() * .92;
  const goal = { target: c, az: azB + .3, pol: .92, dist: dB };
  const gPos = camPosFrom(goal);
  const fwd = new V3(-Math.cos(R.a0), 0, -Math.sin(R.a0));
  const dur = 5;
  cine = () => { };
  flashTo(0, .5);
  await new Promise(r => tween(dur, k => {
    const e = easeOut(k);
    for (const s of R.ships) {
      s.g.position.lerpVectors(s.start, s.end, e);
      s.g.rotation.y = angLerp(s.head, s.tang, ss(.55, 1, k));
      if (Math.random() < .6 && k < .9) { const b = s.g.localToWorld(new V3(0, 0, 4.5)); smoke.emit(b.x, .3, b.z, rand(-2, 2), rand(1, 3), rand(-2, 2), .9, 1.5, 4, [1.3, 1.35, 1.4], [1, 1, 1], .8, .5, 4); }
    }
    const fc = fleetCenter();
    const chase = fc.clone().addScaledVector(fwd, -26).add(new V3(0, 8, 0)).addScaledVector(new V3(fwd.z, 0, -fwd.x), 10);
    const look = fc.clone().addScaledVector(fwd, 18).add(new V3(0, 3, 0));
    const ce = easeInOut(ss(.25, 1, k));
    camera.position.lerpVectors(chase, gPos, ce);
    camera.lookAt(new V3().lerpVectors(look, c, ce));
  }, r));
  setCamNow(c, goal.az, goal.pol, goal.dist);
  panCenter = c.clone(); panRadius = 48; sunKey = '';
  cine = null; mode = 'raid';
  $('#letterbox').classList.remove('on');
  $('#rhud').classList.remove('hidden'); $('#rHint').style.opacity = 1;
  $('#rName').textContent = `${en.name} · Niv. ${en.lvl}`;
  updRaidHUD();
  setTimeout(() => { if (R) $('#rHint').style.opacity = 0; }, 4500);
}
function aliveB() { return R.blds.filter(b => !b.dead); }
function pickTarget(from) {
  if (R.target && !R.target.dead) return R.target;
  let best = null, bd = 1e9; for (const b of aliveB()) { const d = wpos(b.g).distanceTo(from) - (b.fires ? 8 : 0); if (d < bd) { bd = d; best = b; } } return best;
}
function shipFire(s, b, delay = 0) {
  const doIt = () => {
    if (!R || R.over || s.dead || b.dead && !b) return;
    const bp = wpos(b.g); const from = s.g.position.clone().add(new V3(0, 2.4, 0));
    const dir = bp.clone().sub(from).setY(0).normalize(); from.addScaledVector(dir, 2.6);
    const miss = Math.random() < .08;
    const to = miss ? bp.clone().addScaledVector(dir, -rand(8, 12)).setY(0) : bp.clone().add(new V3(rand(-1.2, 1.2), b.h * rand(.25, .7), rand(-1.2, 1.2)));
    const d = from.distanceTo(to);
    FX.muzzle(from, dir); SFX.boom(.55); s.kick = 1;
    fireShot(from, to, .85 + d * .009, 3 + d * .1, p => {
      if (!R) return;
      if (miss) { FX.splash(p); return; }
      const crit = Math.random() < .15; let dm = DMG[S.b.canon] * rand(.85, 1.15) * (crit ? 1.8 : 1);
      damage(b, dm, crit, p);
    });
  };
  delay ? setTimeout(doIt, delay * 1000) : doIt();
}
function damage(b, dm, crit, p) {
  if (b.dead) { FX.hitSmall(p); return; }
  b.hp -= dm; FX.hitSmall(p); dmgText(p, Math.round(dm), crit);
  const pc = clamp(b.hp / b.max, 0, 1); const bar = b.L.el.querySelector('.hpbar'); bar.querySelector('i').style.width = (pc * 100) + '%'; bar.classList.toggle('low', pc < .35);
  if (b.hp <= 0) destroyB(b);
  updRaidHUD();
}
function destroyB(b) {
  b.dead = true; b.burn = 14; const p = wpos(b.g);
  FX.explosion(p.clone().setY(p.y + b.h * .4), b.type === 'tresor' ? 2 : 1.4);
  for (let i = 0; i < 14; i++) { const d = new THREE.Mesh(new THREE.BoxGeometry(rand(.3, .8), rand(.2, .5), rand(.3, 1)), new THREE.MeshStandardMaterial({ color: Math.random() < .5 ? '#6b4a2b' : '#8d8f99', roughness: .9 })); d.position.copy(p).add(new V3(0, b.h * .5, 0)); d.castShadow = true; scene.add(d); const v = new V3(rand(-9, 9), rand(8, 18), rand(-9, 9)); const rv = new V3(rand(-8, 8), rand(-8, 8), rand(-8, 8)); let t = 0; tween(2.2, k => { const dt = 1 / 60; t += dt; v.y -= 30 * dt; d.position.addScaledVector(v, dt); if (d.position.y < .2) { d.position.y = .2; v.multiplyScalar(.5); v.y = Math.abs(v.y) * .3; } d.rotation.x += rv.x * dt; d.rotation.y += rv.y * dt; }, () => scene.remove(d)); }
  b.g.traverse(o => { if (o.isMesh) { o.material.color.multiplyScalar(.28); if (o.material.emissive) o.material.emissiveIntensity = 0; } });
  const y0 = b.g.position.y, rz = rand(-.3, .3), rx = rand(-.25, .25);
  tween(1.4, k => { b.g.position.y = y0 - easeOut(k) * b.h * .3; b.g.rotation.z = rz * easeOut(k); b.g.rotation.x = rx * easeOut(k); b.g.scale.y = 1 - .35 * easeOut(k); });
  if (R.target === b) R.target = null;
  if (b.type === 'tresor') { R.treasureDown = true; FX.sparkle(p.clone().setY(p.y + 2), 80, 5); SFX.coins(); }
  b.L.el.style.display = 'none';
  updRaidHUD();
  if (aliveB().length === 0) endRaid();
}
function towerFire(b) {
  const alive = R.ships.filter(s => !s.dead); if (!alive.length) return;
  const s = alive[Math.floor(Math.random() * alive.length)];
  const from = b.g.localToWorld(new V3(0, b.muzzleY, 0));
  const sp = s.g.position.clone(); const dir = sp.clone().sub(from).setY(0).normalize(); from.addScaledVector(dir, 1.8);
  const miss = Math.random() < .14;
  const to = miss ? sp.clone().add(new V3(rand(-6, 6), 0, rand(-6, 6))).setY(0) : sp.clone().add(new V3(rand(-1.5, 1.5), rand(1.5, 4), rand(-1.5, 1.5)));
  FX.muzzle(from, dir); SFX.boom(.4);
  const d = from.distanceTo(to);
  fireShot(from, to, .9 + d * .01, 3 + d * .08, p => {
    if (!R) return;
    if (miss || s.dead) { FX.splash(p); return; }
    const dm = (34 + R.en.lvl * 9) * rand(.85, 1.15); s.hp -= dm; FX.hitSmall(p); dmgText(p, Math.round(dm), false, true);
    const pc = clamp(s.hp / s.max, 0, 1); s.L.el.querySelector('i').style.width = pc * 100 + '%'; s.fs.querySelector('i').style.width = pc * 100 + '%';
    if (s.hp <= 0) sinkShip(s);
  });
}
function sinkShip(s) {
  s.dead = true; s.burn = 6; s.fs.classList.add('dead'); s.L.el.style.display = 'none';
  FX.explosion(s.g.position.clone().setY(2), 1.5);
  const inner = s.g.userData.inner; const y0 = inner.position.y;
  tween(4, k => { inner.rotation.x = easeOut(k) * .45; inner.rotation.z = easeOut(k) * .3; inner.position.y = y0 - easeInOut(k) * 9; }, () => { s.g.visible = false; });
  if (R.ships.every(x => x.dead)) setTimeout(() => endRaid(), 1600);
}
function updRaidHUD() {
  if (!R) return;
  let lost = 0, tot = 0; for (const b of R.blds) { tot += b.max; lost += b.max - Math.max(0, b.hp); }
  R.pct = Math.round(lost / tot * 100);
  if (aliveB().length === 0) R.pct = 100;
  R.stars = (R.pct >= 50 ? 1 : 0) + (R.treasureDown ? 1 : 0) + (R.pct >= 100 ? 1 : 0);
  $('#rPct').textContent = R.pct + '%';
  const st = [R.pct >= 50, R.treasureDown, R.pct >= 100];
  $('#rStars').querySelectorAll('svg').forEach((e, i) => e.classList.toggle('on', st[i]));
  $('#rLoot').textContent = fmt(R.en.loot * (1 - R.pct / 100));
  $('#barrelN').textContent = R.barrels - R.usedBarrels;
  $('#abBarrel').classList.toggle('off', R.barrels - R.usedBarrels <= 0);
}
function updRaid(dt) {
  if (!R || mode !== 'raid') return;
  if (!R.over) {
    R.time -= dt; if (R.time <= 0) { R.time = 0; endRaid(); }
    const tt = Math.ceil(R.time); const te = $('#rTimer'); te.textContent = `${Math.floor(tt / 60)}:${String(tt % 60).padStart(2, '0')}`; te.classList.toggle('warn', R.time < 10);
    R.cdV = Math.max(0, R.cdV - dt); $('#abVolley').style.setProperty('--cd', (R.cdV / R.cdVmax).toFixed(3)); $('#abVolley').classList.toggle('off', R.cdV > 0);
    for (const s of R.ships) {
      if (s.dead) continue;
      s.ft -= dt; if (s.ft <= 0) { s.ft = rand(1.6, 2.3); const t = pickTarget(s.g.position); if (t) shipFire(s, t); }
    }
    for (const b of R.blds) {
      if (b.dead || !b.fires) continue;
      const alive = R.ships.filter(s => !s.dead); if (alive.length && b.gun) { const sp = alive[0].g.position, bp = wpos(b.g); const want = Math.atan2(sp.x - bp.x, sp.z - bp.z) - b.g.rotation.y; b.gun.rotation.y = angLerp(b.gun.rotation.y, want, Math.min(1, dt * 3)); }
      b.ft -= dt; if (b.ft <= 0) { b.ft = rand(2.4, 3.4); towerFire(b); }
    }
  }
  for (const s of R.ships) {
    s.kick = Math.max(0, s.kick - dt * 3);
    if (s.burn > 0) { s.burn -= dt; const p = s.g.position; if (Math.random() < .5) smoke.emit(p.x + rand(-2, 2), 2, p.z + rand(-2, 2), 0, rand(2, 4), 0, 2.5, 3, 9, [.15, .14, .14], [.4, .4, .42], .8, .6, -1.2); }
  }
  for (const b of R.blds) if (b.dead && b.burn > 0) {
    b.burn -= dt; const p = wpos(b.g);
    if (Math.random() < .7) smoke.emit(p.x + rand(-1.5, 1.5), p.y + 1, p.z + rand(-1.5, 1.5), rand(-.5, .5), rand(3, 5), rand(-.5, .5), rand(2.5, 4), 3, 12, [.12, .11, .1], [.45, .45, .48], .85, .7, -1.5);
    if (Math.random() < .6) fire.emit(p.x + rand(-1.5, 1.5), p.y + rand(.5, 2), p.z + rand(-1.5, 1.5), rand(-.5, .5), rand(2, 4), rand(-.5, .5), rand(.4, .8), 2.5, 1, [6, 2.6, .5], [2, .4, .05], 1, .5, -2);
  }
}
function volley() {
  if (!R || R.over || R.cdV > 0) return;
  R.cdV = R.cdVmax; SFX.horn(.5);
  R.ships.filter(s => !s.dead).forEach((s, i) => { const alive = aliveB(); for (let j = 0; j < 3; j++) { const t = R.target && !R.target.dead ? R.target : alive[Math.floor(Math.random() * alive.length)]; if (t) shipFire(s, t, i * .12 + j * .22); } });
}
function barrel() {
  if (!R || R.over || R.usedBarrels >= R.barrels) return;
  const t = pickTarget(fleetCenter()); if (!t) return;
  R.usedBarrels++; if (R.usedBarrels > 1) { S.barrels = Math.max(0, S.barrels - 1); save(); }
  updRaidHUD();
  const s = R.ships.find(x => !x.dead) || R.ships[0];
  const from = s.g.position.clone().add(new V3(0, 4, 0)), to = wpos(t.g).add(new V3(0, 1, 0));
  SFX.whoosh();
  fireShot(from, to, 1.6, 26, p => {
    if (!R) return;
    FX.explosion(p, 2.6); shake(.8); timeScale = .25; tween(.9, k => timeScale = lerp(.25, 1, k * k));
    for (const b of aliveB()) { const d = wpos(b.g).distanceTo(p); if (d < 11) damage(b, (560 + S.b.canon * 70) * (1 - d / 16), false, wpos(b.g).add(new V3(0, b.h * .5, 0))); }
  }, true);
}
async function endRaid() {
  if (!R || R.over) return; R.over = true;
  updRaidHUD();
  timeScale = .3; tween(1.6, k => timeScale = lerp(.3, 1, k));
  const win = R.stars > 0;
  showBanner(win ? 'RAID TERMINÉ' : 'RETRAITE', win ? 'VICTOIRE !' : 'DÉFAITE');
  win ? SFX.fanfare() : SFX.lose();
  await wait(2.2);
  const gold = Math.round(R.en.loot * R.pct / 100);
  const tro = win ? Math.round(R.en.win * R.stars / 3) : -Math.round(R.en.win * .35);
  const xp = 25 + R.stars * 35, gems = R.stars === 3 ? R.en.gems : 0;
  const chest = R.stars === 3 ? 'or' : R.stars === 2 ? 'argent' : R.stars === 1 ? 'bois' : null;
  R.rew = { gold, tro, xp, gems, chest };
  showResults(win, R.stars, R.rew, R.pct);
}
async function returnHome() {
  const rew = R ? R.rew : null, en = R ? R.en : null;
  closeModal(); SFX.whoosh(); await flashTo(1, .3);
  if (R) {
    for (const b of R.blds) { enemyGrp.remove(b.g); removeLabel(b.L); }
    for (const s of R.ships) { scene.remove(s.g); removeLabel(s.L); }
    for (const sh of shots) scene.remove(sh.m); shots.length = 0;
  }
  R = null; smoke.n = 0; fire.n = 0; MUS.intense = false;
  cleanupRaidIsland(); panCenter = null; panRadius = 200; sunKey = '';
  if (en && rew && S.rivals && S.rivals[en.i] === en) {
    en.loot = Math.max(800, Math.round((en.loot - rew.gold) / 10) * 10); en.tro = Math.max(0, en.tro - Math.max(0, rew.tro));
    if (rew.tro > 0) en.shield = Date.now() + 30 * 60e3;
    save(); refreshRivalLabels();
  }
  $('#rhud').classList.add('hidden'); $('#letterbox').classList.remove('on');
  setCamNow(HOME_T, .62, .96, baseDist()); applyCam();
  mode = 'home'; $('#hud').classList.remove('hidden');
  await flashTo(0, .5);
  if (rew) {
    S.gold += rew.gold; S.gems += rew.gems; S.tro = Math.max(0, S.tro + rew.tro); addXP(rew.xp); save();
    if (rew.gold > 0) flyCoins(innerWidth / 2, innerHeight / 2, '#pillGold', Math.min(16, 4 + rew.gold / 300));
    if (rew.gems > 0) flyCoins(innerWidth / 2, innerHeight / 2, '#pillGem', 6, 'i-gem');
    if (rew.chest) setTimeout(() => openChest(rew.chest), 1300);
  }
}

/* ---------------- UI HELPERS ---------------- */
const fxLayer = $('#fx-layer');
function dmgText(p, n, crit, ally) { const s = toScreen(p); if (!s.vis) return; const d = document.createElement('div'); d.className = 'dmg' + (crit ? ' crit' : ''); if (ally) d.style.color = '#ffb3b3'; d.textContent = (crit ? 'CRITIQUE ' : '-') + n; d.style.left = s.x + 'px'; d.style.top = s.y + 'px'; fxLayer.appendChild(d); setTimeout(() => d.remove(), 1000); }
function showBanner(sub, title) { const b = $('#banner'); $('#bnSub').textContent = sub; $('#bnTitle').textContent = title; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }
function flashTo(o, d) { const f = $('#flash'); f.style.transition = `opacity ${d}s`; f.style.background = o ? '#eaf6ff' : f.style.background; f.style.opacity = o; return wait(d); }
let toastT;
function toast(msg, err) { const t = $('#toast'); t.innerHTML = msg; t.classList.toggle('err', !!err); t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200); if (err) SFX.err(); }
function flyCoins(x, y, pillSel, n = 10, icon = 'i-coin') {
  const pill = $(pillSel); if (!pill) return; const r = pill.getBoundingClientRect(); const tx = r.left + 14, ty = r.top + r.height / 2;
  for (let i = 0; i < n; i++) {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); c.setAttribute('class', 'flycoin'); c.innerHTML = `<use href="#${icon}"/>`;
    fxLayer.appendChild(c);
    const sx = x + rand(-40, 40), sy = y + rand(-30, 30), mx = lerp(sx, tx, .3) + rand(-80, 80), my = Math.min(sy, ty) - rand(40, 120);
    const anim = c.animate([
      { transform: `translate(${x}px,${y}px) scale(.3)`, opacity: 0 },
      { transform: `translate(${sx}px,${sy}px) scale(1.2)`, opacity: 1, offset: .2 },
      { transform: `translate(${mx}px,${my}px) scale(1)`, opacity: 1, offset: .6 },
      { transform: `translate(${tx}px,${ty}px) scale(.7)`, opacity: .9 }], { duration: 900 + i * 45, easing: 'cubic-bezier(.5,0,.6,1)', fill: 'forwards' });
    anim.onfinish = () => { c.remove(); pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump'); SFX.coin(); };
  }
}
function addXP(n) { S.xp += n; while (S.xp >= xpNeed(S.lvl)) { S.xp -= xpNeed(S.lvl); S.lvl++; setTimeout(() => { toast(`⭐ Niveau ${S.lvl} atteint !`); SFX.fanfare(); }, 900); } }
const shown = { gold: S.gold, gems: S.gems, tro: S.tro };
function updHUD(dt) {
  for (const k of ['gold', 'gems', 'tro']) {
    const tgt = S[k]; if (Math.abs(shown[k] - tgt) < 1) shown[k] = tgt; else shown[k] += (tgt - shown[k]) * Math.min(1, dt * 5);
  }
  $('#vGold').textContent = fmt(shown.gold); $('#vGem').textContent = fmt(shown.gems); $('#vTro').textContent = fmt(shown.tro);
  $('#pLvl').textContent = S.lvl; const xn = xpNeed(S.lvl); $('#xpFill').style.width = (S.xp / xn * 100) + '%'; $('#xpTxt').textContent = `${S.xp} / ${xn}`;
  const st = Math.floor(S.stored); $('#collectAmt').textContent = fmt(st); $('#collectBtn').classList.toggle('full', st >= CAP[S.b.tresor]);
  if (homeLabels.bubble) homeLabels.bubble.el.querySelector('span').textContent = fmt(st);
  $('#wheelBadge').style.display = S.lastSpin === today() ? 'none' : '';
}
function collect() {
  const amt = Math.floor(S.stored); if (amt < 1) { toast('Le trésor est vide, reviens plus tard !'); return; }
  S.stored -= amt; S.gold += amt; save();
  const a = buildingAnchor('tresor'); const s = a ? toScreen(a) : { x: innerWidth / 2, y: innerHeight / 2 };
  flyCoins(s.x, s.y, '#pillGold', Math.min(14, 4 + amt / 150)); FX.sparkle(a || new V3(), 30, 3); SFX.coins();
  refreshHomeLabels();
}

/* ---------------- MODALS ---------------- */
const modal = $('#modal'), mWrap = $('#mWrap');
function openModal(html, cls = '') {
  mWrap.innerHTML = `<div class="panel ${cls}">${html}</div>`; modal.classList.remove('hidden');
  mWrap.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => { SFX.click(); closeModal(); }));
  SFX.open();
  return mWrap;
}
function closeModal() { modal.classList.add('hidden'); mWrap.innerHTML = ''; wheelState.anim = false; }
modal.querySelector('.m-back').addEventListener('click', () => { if (!modal.dataset.lock) closeModal(); });
const closeBtn = `<button class="p-close" data-close><svg><use href="#i-close"/></svg></button>`;
const ic = (id, cls = '') => `<svg class="${cls}"><use href="#${id}"/></svg>`;

/* thumbnails */
let thumbR = null, thumbScene, thumbCam;
function thumb(obj, w = 300, h = 260, az = .75, el = .32, fixRad = 0) {
  if (!thumbR) {
    thumbR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    thumbR.toneMapping = THREE.ACESFilmicToneMapping; thumbR.toneMappingExposure = .92;
    thumbScene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(thumbR); thumbScene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; thumbScene.environmentIntensity = .7;
    thumbScene.add(new THREE.HemisphereLight('#dceeff', '#e0b88a', 1.4));
    const d = new THREE.DirectionalLight('#fff0d8', 3); d.position.set(5, 8, 6); thumbScene.add(d);
    thumbCam = new THREE.PerspectiveCamera(28, 1, .1, 500);
  }
  thumbR.setSize(w, h); thumbCam.aspect = w / h; thumbCam.updateProjectionMatrix();
  const holder = new THREE.Group(); holder.add(obj); thumbScene.add(holder);
  const box = new THREE.Box3().setFromObject(holder), c = box.getCenter(new V3()), sz = box.getSize(new V3());
  const rad = fixRad || sz.length() * .5, dist = rad / Math.sin(THREE.MathUtils.degToRad(14)) * .92;
  thumbCam.position.set(c.x + Math.sin(az) * Math.cos(el) * dist, c.y + Math.sin(el) * dist, c.z + Math.cos(az) * Math.cos(el) * dist); thumbCam.lookAt(c);
  thumbR.render(thumbScene, thumbCam);
  const url = thumbR.domElement.toDataURL('image/png');
  thumbScene.remove(holder);
  return url;
}
/* ---- VITRINE 3D des navires : vraie scène (ciel, mer, reflets, lueur, bloom) ---- */
const RARBG = { com: ['#3b6fb8', '#0d2550', '#8fb8ff'], rare: ['#2a8cff', '#071d48', '#7cc4ff'], epic: ['#9b4dff', '#1a0a40', '#d6a8ff'], leg: ['#ffb22e', '#3a1404', '#ffe39a'] };
let artR = null, artComp = null, artPass = null, artBloom = null;
const artWaterVS = `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`;
const artWaterFS = `uniform float uTime; uniform vec3 uDeep,uShal,uBg,uGlow; uniform vec2 uHull; varying vec3 vW;
 float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);} float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);}
 float fb(vec2 p){return n(p)*.55+n(p*2.1)*.3+n(p*4.3)*.15;}
 void main(){ vec2 p=vW.xz; float r=length(p);
  vec3 c=mix(uShal,uDeep,smoothstep(1.5,10.,r));
  float w1=fb(p*.9+vec2(uTime*.25,-uTime*.18)), w2=fb(p*2.2-vec2(uTime*.32,uTime*.21));
  c+=vec3(.55,.85,1.)*smoothstep(.58,.8,w1)*.22+vec3(1.)*smoothstep(.72,.9,w2)*.18;
  c+=uGlow*exp(-r*.28)*.35;
  vec2 q=vec2(p.x/uHull.x,p.y/uHull.y); float e=length(q);
  float foam=(1.-smoothstep(.95,1.35+.25*w1,e))*step(.85,e)*smoothstep(.35,.6,w2+.2);
  c=mix(c,vec3(1.),clamp(foam,0.,1.)*.85);
  c=mix(c,uBg,smoothstep(9.,24.,r));
  gl_FragColor=vec4(c,1.); }`;
function bgTex(rar) {
  const [a, b, gl] = RARBG[rar] || RARBG.com;
  return canvasTex(256, (g, s) => {
    const lg = g.createLinearGradient(0, 0, 0, s); lg.addColorStop(0, b); lg.addColorStop(.62, a); lg.addColorStop(1, b); g.fillStyle = lg; g.fillRect(0, 0, s, s);
    const rg = g.createRadialGradient(s * .5, s * .42, 0, s * .5, s * .42, s * .55); rg.addColorStop(0, gl + '88'); rg.addColorStop(.35, gl + '30'); rg.addColorStop(1, gl + '00'); g.fillStyle = rg; g.fillRect(0, 0, s, s);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) { const ang = -Math.PI / 2 + (i - 7) * .2; g.fillStyle = `rgba(255,255,255,${.025 + Math.random() * .03})`; g.beginPath(); g.moveTo(s * .5, s * .4); g.lineTo(s * .5 + Math.cos(ang - .05) * s, s * .4 + Math.sin(ang - .05) * s); g.lineTo(s * .5 + Math.cos(ang + .05) * s, s * .4 + Math.sin(ang + .05) * s); g.fill(); }
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * .7})`; g.beginPath(); g.arc(Math.random() * s, Math.random() * s * .55, Math.random() * 1.3, 0, 7); g.fill(); }
  });
}
function showcase(id) {
  const sk = SKINS[id] || SKINS.classique, [, bot, gl] = RARBG[sk.rar] || RARBG.com;
  artInit(); const sc = new THREE.Scene(); sc.background = bgTex(sk.rar);
  if (!artR.__env) { const pmr = new THREE.PMREMGenerator(artR); artR.__env = pmr.fromScene(new RoomEnvironment(), .04).texture; }
  sc.environment = artR.__env; sc.environmentIntensity = .45;
  sc.add(new THREE.HemisphereLight('#e6f2ff', '#3a6a8a', .7));
  const key = new THREE.DirectionalLight('#fff0d8', 2.6); key.position.set(6, 9, 7); sc.add(key);
  const rim = new THREE.DirectionalLight(new THREE.Color(sk.glow || gl), 3.5); rim.position.set(-6, 5, -9); sc.add(rim);
  const fill = new THREE.PointLight(new THREE.Color(sk.glow || gl), 10, 30, 1.5); fill.position.set(0, 2, 4); sc.add(fill);
  const ship = makeShip(3, id, 1); ship.userData.inner.position.y = -.35;
  const holder = new THREE.Group(); holder.add(ship); sc.add(holder);
  const box = new THREE.Box3().setFromObject(ship), sz = box.getSize(new V3()), ctr = box.getCenter(new V3());
  ship.position.x -= ctr.x; ship.position.z -= ctr.z;
  const len = Math.max(sz.x, sz.z), along = sz.x > sz.z;
  const wu = { uTime: { value: 0 }, uDeep: { value: new THREE.Color('#063a74') }, uShal: { value: new THREE.Color('#1fb8d4') }, uBg: { value: new THREE.Color(bot).lerp(new THREE.Color('#0a3a6a'), .5) }, uGlow: { value: new THREE.Color(sk.glow || gl) }, uHull: { value: new THREE.Vector2(along ? sz.x * .52 : sz.z * .22, along ? sz.z * .22 : sz.z * .52) } };
  wu.uHull.value.set(along ? sz.x * .5 : sz.x * .55, along ? sz.z * .55 : sz.z * .5);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(80, 80, 1, 1).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ uniforms: wu, vertexShader: artWaterVS, fragmentShader: artWaterFS }));
  water.position.y = 0; sc.add(water);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(sk.glow || gl).multiplyScalar(.9), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .3 }));
  halo.scale.setScalar(len * 1.6); halo.position.set(0, sz.y * .55, -len * .6); sc.add(halo);
  const sparks = [];
  if (sk.rar === 'leg' || sk.rar === 'epic') for (let i = 0; i < (sk.rar === 'leg' ? 26 : 14); i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(sk.glow || gl).multiplyScalar(2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    sp.userData = { a: rand(0, 6.28), r: rand(len * .35, len * .75), y: rand(.3, sz.y * 1.1), s: rand(.12, .32), sp: rand(.2, .6) }; sc.add(sp); sparks.push(sp);
  }
  const cam = new THREE.PerspectiveCamera(30, 1.15, .1, 400);
  const dist = Math.max(len, sz.y * 1.25) * 1.42 + sz.y * .3;
  const az = along ? .62 : 2.2;
  const place = (azi, t) => { cam.position.set(Math.sin(azi) * dist, sz.y * .62 + dist * .2, Math.cos(azi) * dist); cam.lookAt(0, sz.y * .38, 0); };
  place(az);
  const update = t => {
    wu.uTime.value = t; ship.userData.inner.rotation.z = Math.sin(t * 1.1) * .03; ship.userData.inner.rotation.x = Math.sin(t * .8) * .02; ship.userData.inner.position.y = -.35 + Math.sin(t * 1.3) * .06;
    for (const p of sparks) { const u = p.userData; const a = u.a + t * u.sp; p.position.set(Math.cos(a) * u.r, u.y + Math.sin(t * 2 + u.a) * .3, Math.sin(a) * u.r); p.scale.setScalar(u.s * (1 + .5 * Math.sin(t * 4 + u.a * 3))); }
  };
  update(.8);
  return { sc, cam, holder, update, place, az, dispose() { sc.traverse(o => { if (o.geometry && o !== ship) o.geometry.dispose?.(); }); sc.background.dispose(); } };
}
function artInit(w = 460, h = 400) {
  if (!artR) {
    artR = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    artR.toneMapping = THREE.ACESFilmicToneMapping; artR.toneMappingExposure = .82; artR.setPixelRatio(1);
    artComp = new EffectComposer(artR); artPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera()); artComp.addPass(artPass);
    artBloom = new UnrealBloomPass(new THREE.Vector2(w, h), .42, .45, .92); artComp.addPass(artBloom); artComp.addPass(new OutputPass());
  }
}
function artRender(w, h, show) {
  artInit(w, h);
  if (artR.domElement.width !== w || artR.domElement.height !== h) { artR.setSize(w, h, false); artComp.setSize(w, h); }
  show.cam.aspect = w / h; show.cam.updateProjectionMatrix();
  artPass.scene = show.sc; artPass.camera = show.cam; artComp.render();
}
let skinView = null;
const SHIP_THUMB = {}, SHIP_ART = {};
function shipArt(id) {
  if (!SHIP_ART[id]) { if (skinView) return shipThumb(id); const sh = showcase(id); artRender(460, 400, sh); SHIP_ART[id] = artR.domElement.toDataURL('image/jpeg', .9); sh.dispose(); }
  return SHIP_ART[id];
}
function shipThumb(id) { if (!SHIP_THUMB[id]) { const s = makeShip(3, id, 1); SHIP_THUMB[id] = thumb(s, 360, 300, 2.25, .3); } return SHIP_THUMB[id]; }
/* aperçu 3D en direct (rotation) */
function openSkinView(id) {
  const s = SKINS[id]; if (!s) return;
  const own = S.owned.includes(id), eq = S.skin === id;
  const btn = eq ? `<button class="btn btn-blue wide dis">Équipé</button>` : own ? `<button class="btn btn-green wide" data-equip="${id}">Équiper</button>` : s.cur === 'eur' ? `<button class="btn btn-gold wide" data-buy="skin:${id}">Acheter ${eur(s.price)}</button>` : `<button class="btn btn-blue wide" data-gbuy="skin:${id}">${ic('i-gem')} ${s.price}</button>`;
  openModal(`${closeBtn}<div class="p-head"><h2>${s.name}</h2><p class="rar-t ${s.rar}">${RAR[s.rar]}</p></div><div class="p-body"><div class="sv-stage ${s.rar}" id="svStage"></div>
   <div class="sv-hint">⟲ Glisse pour tourner le navire</div><div class="sv-desc">${s.desc || ''}</div>
   <ul class="sv-perks"><li>Skin appliqué à toute ta flotte de raid</li><li>Visible par les autres joueurs sur la Carte des Mers</li>${s.rar === 'leg' ? '<li>Effets lumineux légendaires</li>' : ''}</ul>${btn}
   <div style="height:8px"></div><button class="btn btn-blue wide" id="svBack">Retour aux skins</button></div>`, 'skinview');
  const stage = $('#svStage'); const show = showcase(id); skinView = show;
  const W = Math.min(720, Math.round(stage.clientWidth * Math.min(2, devicePixelRatio || 1))), H = Math.round(W * .78);
  artRender(W, H, show); stage.appendChild(artR.domElement); artR.domElement.className = 'sv-canvas';
  let az = show.az, drag = null, last = performance.now(), t0 = last;
  stage.addEventListener('pointerdown', e => { drag = e.clientX; stage.setPointerCapture(e.pointerId); });
  stage.addEventListener('pointermove', e => { if (drag != null) { az -= (e.clientX - drag) * .012; drag = e.clientX; } });
  stage.addEventListener('pointerup', () => drag = null); stage.addEventListener('pointercancel', () => drag = null);
  const loop = now => {
    if (skinView !== show || !artR.domElement.isConnected) { if (skinView === show) skinView = null; show.dispose(); return; }
    const dt = Math.min(.05, (now - last) / 1000); last = now; if (drag == null) az += dt * .35;
    show.place(az); show.update((now - t0) / 1000); artRender(W, H, show); requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  mWrap.querySelectorAll('[data-equip]').forEach(b => b.addEventListener('click', () => { skinView = null; equip(b.dataset.equip); }));
  mWrap.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => { skinView = null; buyEur(b.dataset.buy); }));
  mWrap.querySelectorAll('[data-gbuy]').forEach(b => b.addEventListener('click', () => { skinView = null; buyGems(b.dataset.gbuy); }));
  $('#svBack').addEventListener('click', () => { SFX.click(); skinView = null; openShop('skins'); });
}

/* upgrade */
const SHIP_IMG = {};
function shipLvImg(l) { const k = l + ':' + S.skin; if (!SHIP_IMG[k]) { const sh = makeLevelShip(l); sh.rotation.y = -.5; SHIP_IMG[k] = thumb(sh, 300, 260, 1.9, .28, 8); } return SHIP_IMG[k]; }
function shipCmpHTML(l, max) {
  const a = SHIPLV[l], b = SHIPLV[Math.min(5, l + 1)];
  return `<div class="ship-cmp-h">⛵ TON NAVIRE</div><div class="up-cmp ship"><div class="up-side"><div class="up-img" style="--lc:${a.col}"><img src="${shipLvImg(l)}"></div><div class="up-tag" style="--lc:${a.col}">${a.name}<small>taille ×${(a.s / SHIPLV[1].s).toFixed(1)}</small></div></div>
   ${max ? '' : `<div class="up-arrow">➜</div><div class="up-side nxt"><div class="up-img" style="--lc:${b.col}"><img src="${shipLvImg(l + 1)}"><i class="up-new">NOUVEAU NAVIRE</i></div><div class="up-tag" style="--lc:${b.col}">${b.name}<small>taille ×${(b.s / SHIPLV[1].s).toFixed(1)}</small></div></div>`}</div><div class="ship-cmp-h">⚓ TON QUAI</div>`;
}
function openUpgrade(key) {
  const B = BUILD[key], l = S.b[key], max = l >= 5;
  const img = thumb(BUILDERS[key](l), 260, 260, .8, .45), nimg = l < 5 ? thumb(BUILDERS[key](l + 1), 260, 260, .8, .45) : null;
  const cur = LV[l], nx = LV[Math.min(5, l + 1)];
  const stats = B.stats(l).map(([n, cur, nxt, top]) => `<div class="stat"><div class="stat-top"><span>${n}</span><span>${fmt(cur)}${!max ? ` <b>+${fmt(nxt - cur)}</b>` : ''}</span></div><div class="sbar">${!max ? `<div class="nxt" style="width:${nxt / top * 100}%"></div>` : ''}<div class="cur" style="width:${cur / top * 100}%"></div></div></div>`).join('');
  const cost = B.cost[l + 1];
  openModal(`${closeBtn}<div class="p-head"><h2>${B.name}</h2><p>Niveau ${l} / 5</p></div><div class="p-body">
   ${key === 'quai' ? shipCmpHTML(l, max) : ''}<div class="up-cmp"><div class="up-side"><div class="up-img" style="--lc:${cur.col}"><img src="${img}" style="transform:scale(${(cur.scale / nx.scale * .92).toFixed(3)})"></div><div class="up-tag" style="--lc:${cur.col}">Niv. ${l}<small>${cur.name}</small></div></div>
    ${max ? '' : `<div class="up-arrow">➜</div><div class="up-side nxt"><div class="up-img" style="--lc:${nx.col}"><img src="${nimg}"><i class="up-new">NOUVEAU LOOK</i></div><div class="up-tag" style="--lc:${nx.col}">Niv. ${l + 1}<small>${nx.name}</small></div></div>`}</div>
   <div class="up-desc">${B.desc}${max ? '' : key === 'quai' ? ` <b style="color:${nx.col}">Niveau ${l + 1} : ${QUAI_NEW[l + 1]}.</b>` : ` <b style="color:${nx.col}">Niveau ${l + 1} : nouvelles couleurs, bâtiment plus grand et nouveaux ornements.</b>`}</div>
   ${stats}<div class="lvl-dots">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= l ? 'on' : ''}"></i>`).join('')}</div>
   ${max ? `<div class="maxed">Niveau maximum atteint 👑</div>` : `<button class="btn btn-green wide" id="upGo">${ic('i-hammer')} Améliorer &nbsp;${ic('i-coin')} ${fmt(cost)}</button>`}
   ${key === 'tresor' ? `<div style="height:10px"></div><button class="btn btn-gold wide" id="upCol">${ic('i-coin')} Récolter ${fmt(Math.floor(S.stored))}</button>` : ''}
  </div>`);
  const go = $('#upGo'); if (go) go.addEventListener('click', () => {
    if (S.gold < cost) { toast(`Il te manque ${fmt(cost - S.gold)} pièces d'or`, true); return; }
    S.gold -= cost; S.b[key]++; addXP(40 * S.b[key]); save(); closeModal();
    placeBuilding(key, true); SFX.upgrade(); refreshHomeLabels();
    const nl = S.b[key];
    toast(key === 'quai' ? `⛵ Nouveau navire : <b>${shipNameFor(nl)}</b> + quai agrandi !` : `${B.name} — niveau ${nl} : ${LV[nl].name} !`);
    showBanner(`NIVEAU ${nl}`, key === 'quai' ? shipNameFor(nl).toUpperCase() : LV[nl].name.toUpperCase());
    focusBuilding(key, 3.6);
  });
  if (QS.has('upgo') && go) setTimeout(() => go.click(), 800);
  const col = $('#upCol'); if (col) col.addEventListener('click', () => { closeModal(); collect(); });
}

function focusBuilding(key, hold = 3.4) {
  const o = key === 'quai' && homeShip ? homeShip : homeB[key]; if (!o) return; const w = wpos(o);
  const prev = camGoal.dist; camGoal.target.set(w.x, 3, w.z); camGoal.dist = clamp(baseDist() * (key === 'quai' ? .46 + S.b.quai * .05 : .46), zMin(), zMax()); userMoved = performance.now() + hold * 1000;
  setTimeout(() => { camGoal.target.copy(HOME_T); camGoal.dist = Math.max(prev, baseDist() * .9); }, hold * 1000);
}
/* ---------------- CARTE DES MERS : choisir l'île à attaquer ---------------- */
let mapSel = 0;
function islandPathD(I, R) { let d = ''; for (let j = 0; j <= 56; j++) { const a = j / 56 * Math.PI * 2, r = shoreR({ ...I, R }, a); d += (j ? 'L' : 'M') + (I.x + Math.cos(a) * r).toFixed(1) + ' ' + (I.z + Math.sin(a) * r).toFixed(1); } return d + 'Z'; }
function smCardHTML(i) {
  const rv = S.rivals[i], sh = rivalShield(rv), [dl, dc] = diffOf(rv);
  return `<div class="enemy-card rvc"><div class="enemy-av" style="background:radial-gradient(circle at 50% 35%,${rv.col},#12081a 85%);box-shadow:0 0 0 2px ${rv.col}">${ic('i-flag')}</div>
   <div style="flex:1;min-width:0"><div class="e-name">${rv.name}</div><div class="e-sub">${rv.clan} · Niveau ${rv.lvl} · 🏆 ${rv.tro}</div>
   <div class="e-sub"><span class="dot${rv.online ? ' on' : ''}"></span>${rv.online ? 'En ligne' : `Vu il y a ${rv.seen} h`} · ${rv.towers} tour${rv.towers > 1 ? 's' : ''} de défense</div>
   <div class="e-loot"><span>${ic('i-coin')}${fmt(rv.loot)}</span>${rv.gems ? `<span>${ic('i-gem')}${rv.gems}</span>` : ''}<span>${ic('i-trophy')}+${rv.win}</span></div></div><div class="diff ${dc}">${dl}</div></div>
   <div class="row"><button class="btn btn-blue" id="smView">Voir l'île</button>${sh ? `<button class="btn btn-red dis">🛡 ${fmtDur(sh)}</button>` : `<button class="btn btn-red" id="smGo">${ic('i-swords')} Attaquer</button>`}</div>`;
}
function openSeaMap(sel) {
  ensureRivals();
  if (sel != null) mapSel = sel;
  else if (rivalShield(S.rivals[mapSel])) { const f = S.rivals.findIndex(r => !rivalShield(r)); if (f >= 0) mapSel = f; }
  const E = 200, pc = v => ((v + E) / (2 * E) * 100).toFixed(2) + '%', pcx = v => clamp((v + E) / (2 * E) * 100, 17, 83).toFixed(2) + '%', VS = 1.45;
  const isl = ISL.map((I, n) => {
    const rv = n ? S.rivals[n - 1] : null, R = I.R * VS, sh = rv && rivalShield(rv);
    let deco = '';
    const rr = mulberry(n * 17 + 3); for (let j = 0; j < 5; j++) { const a = rr() * 6.28, d = R * (.25 + rr() * .3); deco += `<circle cx="${(I.x + Math.cos(a) * d).toFixed(1)}" cy="${(I.z + Math.sin(a) * d).toFixed(1)}" r="${(2.6 + rr() * 2).toFixed(1)}" fill="#2f8a26"/>`; }
    const tw = n ? rv.towers : S.b.canon > 1 ? 2 : 1; for (let j = 0; j < tw; j++) { const a = j * 2.1 + .6, d = R * .3; deco += `<rect x="${(I.x + Math.cos(a) * d - 3).toFixed(1)}" y="${(I.z + Math.sin(a) * d - 3).toFixed(1)}" width="6" height="6" rx="1" fill="#8d8f99" stroke="#3a3a44" stroke-width="1"/>`; }
    return `<g class="smi${n ? '' : ' home'}${sh ? ' sh' : ''}" data-r="${n - 1}"><path d="${islandPathD(I, R * 1.45)}" fill="#3be6d4" opacity=".3"/><path d="${islandPathD(I, R * 1.13)}" fill="#f0cd88" stroke="#fff6d8" stroke-opacity=".7" stroke-width="2"/><path d="${islandPathD(I, R * .66)}" fill="${n ? '#4aa83a' : '#5cc04a'}"/>${deco}
     ${sh ? `<circle cx="${I.x}" cy="${I.z}" r="${(R * 1.35).toFixed(1)}" fill="rgba(110,190,255,.18)" stroke="#8fd6ff" stroke-width="2" stroke-dasharray="5 4"/>` : ''}</g>`;
  }).join('');
  const pins = S.rivals.map((rv, i) => { const I = RSLOTS[i], sh = rivalShield(rv); return `<button class="sm-pin${sh ? ' sh' : ''}${i === mapSel ? ' on' : ''}" data-r="${i}" style="left:${pcx(I.x)};top:${pc(I.z + I.R * VS * .95)}"><div class="sm-tag"><b>${rv.lvl}</b>${rv.name}</div><div class="sm-loot">${sh ? '🛡 ' + fmtDur(sh) : ic('i-coin') + fmtK(rv.loot)}</div></button>`; }).join('');
  const rows = S.rivals.map((rv, i) => { const [dl, dc] = diffOf(rv), sh = rivalShield(rv); return `<button class="sm-row${i === mapSel ? ' on' : ''}" data-r="${i}"><i class="fl" style="background:${rv.col}"></i><div class="nm"><b>${rv.name}</b><small>${rv.online ? '<span class="dot on"></span>' : ''}${rv.clan} · niv. ${rv.lvl}</small></div><div class="lt">${sh ? '🛡' : ic('i-coin') + fmtK(rv.loot)}</div><span class="df ${dc}">${dl}</span></button>`; }).join('');
  const logs = (S.defLog || []).map((L, j) => { const rv = S.rivals[L.r]; if (!rv || L.used) return ''; return `<div class="sm-row log"><i class="fl" style="background:${rv.col}"></i><div class="nm"><b>${rv.name} t'a pillé</b><small>il y a ${L.ago} · −${fmt(L.gold)} or · ${'★'.repeat(L.stars)}</small></div><button class="btn btn-red sm" data-rev="${j}">Revanche</button></div>`; }).join('');
  openModal(`${closeBtn}<div class="p-head"><h2>Carte des Mers</h2><p>Choisis l'île d'un joueur à piller</p></div><div class="p-body">
   <div class="smap"><svg viewBox="${-E} ${-E} ${2 * E} ${2 * E}" preserveAspectRatio="xMidYMid slice">
     <defs><radialGradient id="smSea" cx="50%" cy="50%" r="70%"><stop offset="0" stop-color="#1f7cc4"/><stop offset=".6" stop-color="#0e4f92"/><stop offset="1" stop-color="#062a58"/></radialGradient>
     <pattern id="smW" width="34" height="18" patternUnits="userSpaceOnUse"><path d="M2 12q7-7 14 0t14 0" stroke="#bfe6ff" stroke-opacity=".22" fill="none" stroke-width="1.6"/></pattern></defs>
     <rect x="${-E}" y="${-E}" width="${2 * E}" height="${2 * E}" fill="url(#smSea)"/><rect x="${-E}" y="${-E}" width="${2 * E}" height="${2 * E}" fill="url(#smW)"/>
     <circle r="80" fill="none" stroke="#bfe6ff" stroke-opacity=".18" stroke-dasharray="4 8"/><circle r="150" fill="none" stroke="#bfe6ff" stroke-opacity=".14" stroke-dasharray="4 8"/>
     ${isl}
     <line id="smRoute" x1="0" y1="0" x2="0" y2="0" stroke="#ffd54a" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="8 8" class="route" style="filter:drop-shadow(0 0 3px #ff5a1a)"/>
     <g transform="translate(${E - 28} ${-E + 28}) scale(.75)" opacity=".85"><circle r="28" fill="rgba(5,20,45,.55)" stroke="#f3c64d" stroke-width="2"/><path d="M0-24L6 0 0 24-6 0z" fill="#f3c64d"/><path d="M0-24L6 0H-6z" fill="#e5384f"/><path d="M-24 0L0 5 24 0 0-5z" fill="#f3c64d" opacity=".6"/><text y="-30" text-anchor="middle" font-size="13" fill="#fff" font-family="Lilita One">N</text></g>
   </svg>
   <div class="sm-pin home" style="left:${pc(0)};top:${pc(HOME.R * VS * .95)}"><div class="sm-tag me"><b>${S.lvl}</b>Ton île</div></div>
   ${pins}</div>
   <div id="smCard"></div>
   <div class="sm-fleet">${ic('i-swords')} Ta flotte : <b>${SHIPS[S.b.quai]} navires</b> · ${SHIPHP[S.b.quai]} PV · ${DMG[S.b.canon]} dégâts</div>
   <div class="section-t">RIVAUX À PORTÉE</div><div class="sm-list">${rows}</div>
   ${logs ? `<div class="section-t">JOURNAL DE DÉFENSE</div><div class="sm-list">${logs}</div>` : ''}
   <button class="btn btn-blue wide" id="smNew" style="margin-top:14px">🔄 Chercher de nouveaux rivaux · ${ic('i-coin')} 100</button>
   <div class="note">Prototype : les autres joueurs sont simulés. En ligne, ce seront de vrais joueurs.</div>
  </div>`, 'seamap');
  const selectR = i => {
    mapSel = i; const I = RSLOTS[i];
    mWrap.querySelectorAll('.sm-pin[data-r],.sm-row[data-r]').forEach(b => b.classList.toggle('on', +b.dataset.r === i));
    const rl = $('#smRoute'), L = Math.hypot(I.x, I.z), ux = I.x / L, uz = I.z / L; rl.setAttribute('x1', ux * 34); rl.setAttribute('y1', uz * 34); rl.setAttribute('x2', I.x - ux * I.R * VS * 1.2); rl.setAttribute('y2', I.z - uz * I.R * VS * 1.2);
    $('#smCard').innerHTML = smCardHTML(i);
    $('#smView').addEventListener('click', () => { closeModal(); SFX.whoosh(); flyTo(I.x, I.z, baseDist() * 1.05); });
    const go = $('#smGo'); if (go) go.addEventListener('click', () => attackRival(i));
  };
  mWrap.querySelectorAll('.sm-pin[data-r],.sm-row[data-r]').forEach(b => b.addEventListener('click', () => { SFX.click(); selectR(+b.dataset.r); if (b.classList.contains('sm-row')) $('#smCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }));
  mWrap.querySelectorAll('.smi[data-r]').forEach(g => { if (+g.dataset.r >= 0) g.addEventListener('click', () => { SFX.click(); selectR(+g.dataset.r); }); });
  mWrap.querySelectorAll('[data-rev]').forEach(b => b.addEventListener('click', () => { const L = S.defLog[+b.dataset.rev]; L.used = true; save(); attackRival(L.r, true); }));
  $('#smNew').addEventListener('click', () => {
    if (S.gold < 100) return toast("Pas assez d'or", true);
    S.gold -= 100;
    S.rivals.forEach((rv, i) => { if (!rivalShield(rv)) { S.rivals[i] = genRival(i, (rv.gen || 0) + 1); buildRivalIsland(i); if (S.defLog) S.defLog.forEach(L => { if (L.r === i) L.used = true; }); } });
    save(); refreshRivalLabels(); SFX.whoosh(); toast('Nouveaux rivaux repérés !'); openSeaMap();
  });
  selectR(mapSel);
}

function showResults(win, stars, rew, pct) {
  modal.dataset.lock = '1';
  openModal(`<div class="p-body" style="padding-top:18px"><div class="res-banner"><div class="res-title ${win ? '' : 'lose'}">${win ? 'Victoire' : 'Défaite'}</div><div class="e-sub">${pct}% de destruction</div></div>
   <div class="res-stars">${[0, 1, 2].map(i => `<svg class="${i < stars ? 'on' : ''}" style="animation-delay:${.2 + i * .35}s"><use href="#i-star"/></svg>`).join('')}</div>
   <div class="rew"><div>${ic('i-coin')}<b>+${fmt(rew.gold)}</b><small>Or pillé</small></div><div>${ic('i-trophy')}<b>${rew.tro >= 0 ? '+' : ''}${rew.tro}</b><small>Trophées</small></div>${rew.gems ? `<div>${ic('i-gem')}<b>+${rew.gems}</b><small>Gemmes</small></div>` : `<div><b style="color:#7fd8ff">+${rew.xp}</b><small>XP</small></div>`}</div>
   ${rew.chest ? `<div class="enemy-card" style="justify-content:center;box-shadow:inset 0 0 0 1.5px rgba(243,198,77,.5)"><div style="width:70px">${chestSVG(rew.chest)}</div><div><div class="e-name" style="color:#ffe48a">${CHESTS[rew.chest].name}</div><div class="e-sub">gagné ! Ouverture au port</div></div></div>` : ''}
   <button class="btn btn-green wide" id="resGo">Retour au port</button></div>`);
  [0, 1, 2].forEach(i => i < stars && setTimeout(() => SFX.star(i), 250 + i * 350));
  $('#resGo').addEventListener('click', () => { delete modal.dataset.lock; returnHome(); });
}

/* ---------------- WHEEL ---------------- */
const WHEEL = [{ t: 'gold', v: 500, l: '500' }, { t: 'gems', v: 15, l: '15' }, { t: 'gold', v: 1500, l: '1 500' }, { t: 'chest', v: 0, l: 'COFFRE' }, { t: 'gold', v: 800, l: '800' }, { t: 'gems', v: 50, l: '50' }, { t: 'gold', v: 3000, l: '3 000' }, { t: 'jack', v: 10000, l: 'JACKPOT' }];
const WW = [22, 18, 14, 10, 20, 6, 7, 3];
const wheelState = { rot: 0, spinning: false, anim: false };
function cCoin(g, x, y, r) {
  g.save(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = r * .4; g.shadowOffsetY = r * .15;
  let gr = g.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r); gr.addColorStop(0, '#fff6c8'); gr.addColorStop(.4, '#ffd54a'); gr.addColorStop(.85, '#d48a12'); gr.addColorStop(1, '#7a4806');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.restore();
  g.strokeStyle = 'rgba(160,95,10,.9)'; g.lineWidth = r * .1; g.beginPath(); g.arc(x, y, r * .74, 0, 7); g.stroke();
  g.fillStyle = '#fff1a8'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .24 : r * .52; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill();
}
function cGem(g, x, y, r) {
  g.save(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = r * .4; g.shadowOffsetY = r * .15;
  const gr = g.createLinearGradient(x - r, y - r, x + r, y + r); gr.addColorStop(0, '#e8fdff'); gr.addColorStop(.35, '#59f0ff'); gr.addColorStop(.7, '#1c8de0'); gr.addColorStop(1, '#4b2bc8');
  g.fillStyle = gr; g.beginPath(); g.moveTo(x - r, y - r * .3); g.lineTo(x - r * .55, y - r * .85); g.lineTo(x + r * .55, y - r * .85); g.lineTo(x + r, y - r * .3); g.lineTo(x, y + r); g.closePath(); g.fill(); g.restore();
  g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.moveTo(x - r * .55, y - r * .85); g.lineTo(x - r * .15, y - r * .3); g.lineTo(x - r, y - r * .3); g.fill();
  g.fillStyle = 'rgba(20,60,160,.35)'; g.beginPath(); g.moveTo(x - r, y - r * .3); g.lineTo(x + r, y - r * .3); g.lineTo(x, y + r); g.fill();
}
function cChest(g, x, y, r) {
  g.save(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = r * .4; g.shadowOffsetY = r * .15;
  g.fillStyle = '#8a4a1c'; g.fillRect(x - r, y - r * .1, r * 2, r * .95); g.restore();
  const gr = g.createLinearGradient(x, y - r * .9, x, y); gr.addColorStop(0, '#d4823a'); gr.addColorStop(1, '#9a5420');
  g.fillStyle = gr; g.beginPath(); g.moveTo(x - r, y - r * .1); g.quadraticCurveTo(x, y - r * 1.2, x + r, y - r * .1); g.fill();
  const gg = g.createLinearGradient(x, y - r, x, y + r); gg.addColorStop(0, '#fff0b0'); gg.addColorStop(1, '#c8861e'); g.fillStyle = gg;
  g.fillRect(x - r, y - r * .15, r * 2, r * .2); g.fillRect(x - r * .75, y - r * .75, r * .2, r * 1.6); g.fillRect(x + r * .55, y - r * .75, r * .2, r * 1.6); g.fillRect(x - r * .18, y - r * .1, r * .36, r * .45);
}
function cCrown(g, x, y, r) {
  g.save(); g.shadowColor = 'rgba(255,180,40,.9)'; g.shadowBlur = r * .8;
  const gr = g.createLinearGradient(x, y - r, x, y + r); gr.addColorStop(0, '#fffbe0'); gr.addColorStop(.5, '#ffd54a'); gr.addColorStop(1, '#b8741a'); g.fillStyle = gr;
  g.beginPath(); g.moveTo(x - r, y + r * .6); g.lineTo(x - r, y - r * .4); g.lineTo(x - r * .5, y + r * .05); g.lineTo(x, y - r * .8); g.lineTo(x + r * .5, y + r * .05); g.lineTo(x + r, y - r * .4); g.lineTo(x + r, y + r * .6); g.closePath(); g.fill(); g.restore();
  g.fillStyle = '#e5384f'; g.beginPath(); g.arc(x, y + r * .25, r * .17, 0, 7); g.fill(); g.fillStyle = '#39c6ff'; g.beginPath(); g.arc(x - r * .6, y + r * .3, r * .12, 0, 7); g.arc(x + r * .6, y + r * .3, r * .12, 0, 7); g.fill();
}
function drawWheel(cv) {
  const g = cv.getContext('2d'), W = cv.width, c = W / 2, R = c * .9, n = WHEEL.length, seg = Math.PI * 2 / n;
  g.clearRect(0, 0, W, W);
  for (let i = 0; i < n; i++) {
    const a0 = -Math.PI / 2 - seg / 2 + i * seg, w = WHEEL[i];
    const cols = w.t === 'jack' ? ['#ff5a4a', '#8a0f18'] : w.t === 'chest' ? ['#9a5cff', '#3a1580'] : w.t === 'gems' ? ['#2fb8ff', '#0b3a8a'] : (i % 2 ? ['#235aa8', '#0a2350'] : ['#1a447f', '#071a3c']);
    const gr = g.createRadialGradient(c, c, R * .15, c, c, R); gr.addColorStop(0, cols[0]); gr.addColorStop(1, cols[1]);
    g.fillStyle = gr; g.beginPath(); g.moveTo(c, c); g.arc(c, c, R, a0, a0 + seg); g.closePath(); g.fill();
    g.save(); g.translate(c, c); g.rotate(a0 + seg / 2 + Math.PI / 2);
    const ir = R * .15;
    if (w.t === 'gold') { cCoin(g, -ir * .35, -R * .66, ir * .8); cCoin(g, ir * .45, -R * .7, ir * .9); }
    else if (w.t === 'gems') cGem(g, 0, -R * .68, ir);
    else if (w.t === 'chest') cChest(g, 0, -R * .66, ir * 1.05);
    else cCrown(g, 0, -R * .68, ir * 1.1);
    g.font = `${R * (w.l.length > 5 ? .085 : .11)}px "Lilita One", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = R * .03; g.strokeStyle = '#120a02'; g.strokeText(w.l, 0, -R * .43); g.fillStyle = w.t === 'jack' ? '#ffe14a' : '#fff'; g.fillText(w.l, 0, -R * .43);
    g.restore();
  }
  g.strokeStyle = '#f3c64d'; g.lineWidth = R * .022;
  for (let i = 0; i < n; i++) { const a = -Math.PI / 2 - seg / 2 + i * seg; g.beginPath(); g.moveTo(c + Math.cos(a) * R * .2, c + Math.sin(a) * R * .2); g.lineTo(c + Math.cos(a) * R, c + Math.sin(a) * R); g.stroke(); }
  const sh = g.createRadialGradient(c, c, R * .6, c, c, R); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.35)'); g.fillStyle = sh; g.beginPath(); g.arc(c, c, R, 0, 7); g.fill();
  const hl = g.createLinearGradient(0, 0, 0, W); hl.addColorStop(0, 'rgba(255,255,255,.18)'); hl.addColorStop(.5, 'rgba(255,255,255,0)'); g.fillStyle = hl; g.beginPath(); g.arc(c, c, R, 0, 7); g.fill();
}
function drawRim(cv, phase) {
  const g = cv.getContext('2d'), W = cv.width, c = W / 2, R = c * .9;
  g.clearRect(0, 0, W, W);
  const gr = g.createLinearGradient(0, 0, W, W); gr.addColorStop(0, '#fff1b8'); gr.addColorStop(.3, '#f3c64d'); gr.addColorStop(.55, '#8a5a12'); gr.addColorStop(.8, '#f3c64d'); gr.addColorStop(1, '#fff1b8');
  g.lineWidth = c * .13; g.strokeStyle = '#2a1803'; g.beginPath(); g.arc(c, c, R + c * .045, 0, 7); g.stroke();
  g.lineWidth = c * .1; g.strokeStyle = gr; g.beginPath(); g.arc(c, c, R + c * .045, 0, 7); g.stroke();
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2, x = c + Math.cos(a) * (R + c * .045), y = c + Math.sin(a) * (R + c * .045), on = (i + phase) % 2 === 0;
    const bg = g.createRadialGradient(x, y, 0, x, y, c * .05); bg.addColorStop(0, on ? '#fffbe6' : '#8a6a3a'); bg.addColorStop(.5, on ? '#ffd54a' : '#5a3a12'); bg.addColorStop(1, on ? 'rgba(255,200,60,0)' : 'rgba(60,30,5,0)');
    g.fillStyle = bg; g.beginPath(); g.arc(x, y, c * (on ? .05 : .03), 0, 7); g.fill();
  }
}
function openWheel() {
  const free = S.lastSpin !== today();
  openModal(`${closeBtn}<div class="p-head"><h2>Roue de la Fortune</h2><p>Un tour gratuit chaque jour</p></div><div class="p-body">
   <div class="wheel-wrap"><div class="wheel-glow"></div><canvas id="wCv" width="660" height="660" style="position:absolute;inset:0"></canvas><canvas id="wRim" width="660" height="660" style="position:absolute;inset:0"></canvas>
   <svg class="wheel-ptr" id="wPtr" viewBox="0 0 42 56"><defs><linearGradient id="gp" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff1b8"/><stop offset=".5" stop-color="#f3c64d"/><stop offset="1" stop-color="#8a5a12"/></linearGradient></defs><path d="M21 56L4 18A18 18 0 1 1 38 18z" fill="#2a1803"/><path d="M21 50L7 18A15 15 0 1 1 35 18z" fill="url(#gp)"/><circle cx="21" cy="16" r="6" fill="#e5384f"/><circle cx="19" cy="14" r="2" fill="#fff" opacity=".7"/></svg>
   <div class="wheel-hub"><img src="icon-192.png"></div></div>
   <div class="w-info" id="wInfo">${free ? 'Ton tour gratuit est prêt !' : 'Prochain tour gratuit dans <b id="wCd"></b>'}</div>
   <div class="w-actions">${free ? `<button class="btn btn-green wide" id="wSpin">TOURNER GRATUITEMENT</button>` : `<button class="btn btn-gold wide" id="wSpin">Tourner encore · ${ic('i-gem')} 25</button>`}</div>
  </div>`);
  const cv = $('#wCv'), rim = $('#wRim'); drawWheel(cv); cv.style.transform = `rotate(${wheelState.rot}rad)`;
  wheelState.anim = true; let ph = 0, lastPh = 0;
  const rimLoop = t => { if (!wheelState.anim) return; const p = Math.floor(t / (wheelState.spinning ? 120 : 500)); if (p !== lastPh) { lastPh = p; ph = p % 2; drawRim(rim, ph); } const cd = $('#wCd'); if (cd) { const m = new Date(); const ms = new Date(m.getFullYear(), m.getMonth(), m.getDate() + 1) - m; const h = Math.floor(ms / 3.6e6), mi = Math.floor(ms / 6e4) % 60, se = Math.floor(ms / 1000) % 60; cd.textContent = `${h}h ${String(mi).padStart(2, '0')}m ${String(se).padStart(2, '0')}s`; } requestAnimationFrame(rimLoop); };
  drawRim(rim, 0); requestAnimationFrame(rimLoop);
  $('#wSpin').addEventListener('click', () => {
    if (wheelState.spinning) return;
    const isFree = S.lastSpin !== today();
    if (!isFree) { if (S.gems < 25) return toast('Pas assez de gemmes', true); S.gems -= 25; }
    else S.lastSpin = today();
    save(); spinWheel(cv);
  });
}
function spinWheel(cv) {
  wheelState.spinning = true; $('#wSpin').classList.add('dis');
  const tot = WW.reduce((a, b) => a + b, 0); let r = Math.random() * tot, idx = 0; for (; idx < WW.length; idx++) { r -= WW[idx]; if (r < 0) break; }
  const n = WHEEL.length, seg = Math.PI * 2 / n, cur = wheelState.rot;
  const base = (((-idx * seg - cur) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const final = cur + Math.PI * 2 * 6 + base + rand(-.35, .35) * seg;
  const t0 = performance.now(), dur = 5200; let lastTick = Math.floor((cur + seg / 2) / seg);
  const ptr = $('#wPtr');
  SFX.whoosh();
  const step = t => {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4);
    wheelState.rot = cur + (final - cur) * e; cv.style.transform = `rotate(${wheelState.rot}rad)`;
    const tk = Math.floor((wheelState.rot + seg / 2) / seg);
    if (tk !== lastTick) { lastTick = tk; SFX.tick(); ptr.classList.remove('tick'); void ptr.offsetWidth; ptr.classList.add('tick'); }
    if (k < 1 && wheelState.anim) requestAnimationFrame(step); else { wheelState.spinning = false; if (wheelState.anim) grantWheel(WHEEL[idx]); }
  };
  requestAnimationFrame(step);
}
function grantWheel(w) {
  let msg, gold = 0, gems = 0;
  if (w.t === 'gold') { gold = w.v; msg = `+${fmt(gold)} pièces d'or !`; }
  else if (w.t === 'gems') { gems = w.v; msg = `+${gems} gemmes !`; }
  else if (w.t === 'chest') { msg = `Coffre d'Argent gagné !`; setTimeout(() => { closeModal(); openChest('argent'); }, 1100); }
  else { gold = w.v; gems = 100; msg = `💥 JACKPOT ! +${fmt(gold)} or & +100 gemmes !`; }
  S.gold += gold; S.gems += gems; save(); SFX.fanfare();
  const r = $('#wCv').getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  if (gold) flyCoins(cx, cy, '#pillGold', 14); if (gems) flyCoins(cx, cy, '#pillGem', 8, 'i-gem');
  confetti(cx, cy);
  $('#wInfo').innerHTML = `<span style="font-family:'Lilita One';font-size:20px;color:#ffe48a">${msg}</span>`;
  const b = $('#wSpin'); b.classList.remove('dis'); b.className = 'btn btn-gold wide'; b.innerHTML = `Tourner encore · ${ic('i-gem')} 25`;
}
function confetti(x, y) {
  const cols = ['#ffd54a', '#ff6b6b', '#59f0ff', '#8ef06c', '#c27bff', '#fff'];
  for (let i = 0; i < 60; i++) {
    const d = document.createElement('div'); d.style.cssText = `position:absolute;left:0;top:0;width:${rand(6, 11)}px;height:${rand(10, 16)}px;background:${cols[i % 6]};border-radius:2px`;
    fxLayer.appendChild(d); const a = rand(0, 6.28), v = rand(120, 320), dx = Math.cos(a) * v, dy = Math.sin(a) * v - 150;
    d.animate([{ transform: `translate(${x}px,${y}px) rotate(0)`, opacity: 1 }, { transform: `translate(${x + dx}px,${y + dy}px) rotate(${rand(200, 700)}deg)`, opacity: 1, offset: .4 }, { transform: `translate(${x + dx * 1.3}px,${y + dy + 500}px) rotate(${rand(700, 1400)}deg)`, opacity: 0 }], { duration: rand(1400, 2200), easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' }).onfinish = () => d.remove();
  }
}


/* ---------------- COFFRES AU TRÉSOR ---------------- */
const CHESTS = {
  bois: { name: 'Coffre en Bois', wood: ['#b8652a', '#6b3412'], band: ['#ffe1a0', '#c98a3a', '#7a4a14'], glow: 'rgba(255,190,90,.55)', bg: '#5a3418', ray: 'rgba(255,200,120,.12)', t: '#ffcf7a' },
  argent: { name: "Coffre d'Argent", wood: ['#3a6fc0', '#163a78'], band: ['#ffffff', '#b9c8dc', '#5d6f88'], glow: 'rgba(140,210,255,.6)', bg: '#1a3f80', ray: 'rgba(160,220,255,.14)', t: '#cfeaff' },
  or: { name: "Coffre d'Or", wood: ['#b0302a', '#5e0f12'], band: ['#fff4c0', '#f3c64d', '#9a6514'], glow: 'rgba(255,200,60,.7)', bg: '#6a3a08', ray: 'rgba(255,215,120,.16)', t: '#ffd75a' },
  legendaire: { name: 'Coffre Légendaire', wood: ['#7a3ae0', '#2a0e6a'], band: ['#fff4c0', '#f3c64d', '#9a6514'], glow: 'rgba(200,120,255,.75)', bg: '#3a1a80', ray: 'rgba(210,150,255,.18)', t: '#f0c8ff', gems: true },
};
function chestSVG(type) {
  const c = CHESTS[type], id = 'c' + type;
  return `<svg viewBox="0 0 200 190"><defs>
   <linearGradient id="${id}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.wood[0]}"/><stop offset="1" stop-color="${c.wood[1]}"/></linearGradient>
   <linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.band[0]}"/><stop offset=".45" stop-color="${c.band[1]}"/><stop offset="1" stop-color="${c.band[2]}"/></linearGradient>
   <radialGradient id="${id}g" cx="50%" cy="60%" r="60%"><stop offset="0" stop-color="#fffbe0"/><stop offset=".5" stop-color="#ffd54a"/><stop offset="1" stop-color="#c8861e"/></radialGradient></defs>
   <ellipse cx="100" cy="178" rx="78" ry="10" fill="rgba(0,0,0,.35)"/>
   <ellipse cx="100" cy="90" rx="74" ry="16" fill="url(#${id}g)"/>
   <g fill="#ffe27a" stroke="#b8730e" stroke-width="1.5"><circle cx="70" cy="86" r="9"/><circle cx="92" cy="80" r="9"/><circle cx="118" cy="84" r="9"/><circle cx="136" cy="90" r="8"/><circle cx="104" cy="92" r="8"/></g>
   ${c.gems ? '<path d="M78 76l8-10h10l8 10-13 16z" fill="#59f0ff" stroke="#1c5fc0" stroke-width="2"/><path d="M120 74l6-8h8l6 8-10 12z" fill="#ff6bd0" stroke="#8a1a6a" stroke-width="2"/>' : ''}
   <g class="body"><rect x="22" y="88" width="156" height="86" rx="10" fill="url(#${id}w)" stroke="#1a0d04" stroke-width="4"/>
   <path d="M26 112h148M26 140h148" stroke="rgba(0,0,0,.25)" stroke-width="3"/>
   <rect x="22" y="88" width="156" height="14" fill="url(#${id}b)" stroke="#1a0d04" stroke-width="3"/>
   <rect x="38" y="88" width="18" height="86" fill="url(#${id}b)" stroke="#1a0d04" stroke-width="3"/><rect x="144" y="88" width="18" height="86" fill="url(#${id}b)" stroke="#1a0d04" stroke-width="3"/>
   <rect x="84" y="98" width="32" height="38" rx="5" fill="url(#${id}b)" stroke="#1a0d04" stroke-width="3"/><path d="M100 110a5 5 0 0 1 3 9l2 9h-10l2-9a5 5 0 0 1 3-9z" fill="#1a0d04"/>
   <g fill="#1a0d04"><circle cx="47" cy="160" r="3"/><circle cx="153" cy="160" r="3"/><circle cx="47" cy="120" r="3"/><circle cx="153" cy="120" r="3"/></g></g>
   <g class="lid"><path d="M18 92V70C18 38 56 22 100 22s82 16 82 48v22z" fill="url(#${id}w)" stroke="#1a0d04" stroke-width="4"/>
   <path d="M30 58c20-20 120-20 140 0" stroke="rgba(255,255,255,.25)" stroke-width="4" fill="none"/>
   <rect x="18" y="80" width="164" height="14" fill="url(#${id}b)" stroke="#1a0d04" stroke-width="3"/>
   <path d="M38 92V46c4-8 12-13 18-15v61zM144 92V31c6 2 14 7 18 15v46z" fill="url(#${id}b)" stroke="#1a0d04" stroke-width="3"/>
   ${c.gems ? '<circle cx="100" cy="52" r="10" fill="#e5384f" stroke="#fff4c0" stroke-width="4"/><circle cx="97" cy="49" r="3" fill="#fff" opacity=".8"/>' : '<circle cx="100" cy="54" r="7" fill="url(#' + id + 'b)" stroke="#1a0d04" stroke-width="3"/>'}</g>
  </svg>`;
}
function rollChest(type) {
  const r = { gold: 0, gems: 0, barrels: 0, skin: null };
  if (type === 'bois') { r.gold = Math.round(rand(800, 1500) / 10) * 10; r.gems = Math.random() < .5 ? Math.floor(rand(2, 6)) : 0; }
  else if (type === 'argent') { r.gold = Math.round(rand(2000, 3600) / 10) * 10; r.gems = Math.floor(rand(10, 21)); r.barrels = Math.random() < .4 ? 1 : 0; }
  else if (type === 'or') { r.gold = Math.round(rand(5000, 8200) / 10) * 10; r.gems = Math.floor(rand(30, 51)); r.barrels = 2; }
  else { r.gold = Math.round(rand(15000, 21000) / 100) * 100; r.gems = Math.floor(rand(100, 151)); r.barrels = 3; const lock = Object.keys(SKINS).filter(k => !S.owned.includes(k)); if (lock.length) r.skin = lock[Math.floor(Math.random() * lock.length)]; else r.gems += 200; }
  return r;
}
/* ---- VFX coffre : canvas plein écran (pluie d'or, feux d'artifice, étincelles, rayons, onde de choc) ---- */
function mkSprite(sz, draw) { const c = document.createElement('canvas'); c.width = c.height = sz; draw(c.getContext('2d'), sz); return c; }
const CF_COIN = mkSprite(64, (g, s) => { const r = s / 2 - 2; const gr = g.createRadialGradient(s * .38, s * .35, 2, s / 2, s / 2, r); gr.addColorStop(0, '#fffbe0'); gr.addColorStop(.35, '#ffd84a'); gr.addColorStop(.85, '#d18a12'); gr.addColorStop(1, '#7a4a06'); g.fillStyle = gr; g.beginPath(); g.arc(s / 2, s / 2, r, 0, 7); g.fill(); g.strokeStyle = '#8a5508'; g.lineWidth = 3; g.beginPath(); g.arc(s / 2, s / 2, r * .7, 0, 7); g.stroke(); g.fillStyle = '#9a6008'; g.font = `bold ${s * .42}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$', s / 2, s / 2 + 2); });
const CF_GEMS = ['#59f0ff', '#ff5fd0', '#8eff6a', '#c27bff'].map(col => mkSprite(64, (g, s) => { g.fillStyle = col; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(s * .2, s * .38); g.lineTo(s * .35, s * .18); g.lineTo(s * .65, s * .18); g.lineTo(s * .8, s * .38); g.lineTo(s * .5, s * .85); g.closePath(); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,.65)'; g.beginPath(); g.moveTo(s * .35, s * .2); g.lineTo(s * .5, s * .38); g.lineTo(s * .25, s * .38); g.fill(); }));
const CF_SPARK = mkSprite(64, (g, s) => { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.2, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); });
const CF_STAR = mkSprite(64, (g, s) => { g.translate(s / 2, s / 2); g.fillStyle = '#fff'; g.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? s * .08 : s * .48, a = i * Math.PI / 4; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.fill(); });
const tintCache = {};
function tinted(img, col) { const k = col; if (tintCache[k]) return tintCache[k]; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.drawImage(img, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = col; g.fillRect(0, 0, 64, 64); g.globalCompositeOperation = 'destination-in'; g.drawImage(img, 0, 0); return tintCache[k] = c; }
function chestVFX(host, power = 1) {
  const cv = document.createElement('canvas'); cv.className = 'cf-cv'; host.appendChild(cv);
  const dpr = Math.min(1.5, devicePixelRatio || 1); let W = innerWidth, H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; const g = cv.getContext('2d'); g.scale(dpr, dpr);
  const P = [], rings = [], beams = []; let run = true, t0 = performance.now(), rainUntil = 0, rainRate = 0, last = t0, shake = 0;
  const add = o => { if (P.length < 1400) P.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, g: 600, life: 1, age: 0, sz: 10, rot: 0, vr: 0, add: true, drag: .985, img: CF_SPARK, spin: 0 }, o)); };
  const api = {
    burst(x, y, n = 120, cols = ['#ffd54a', '#fff2b0', '#ffae2e']) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = rand(200, 900) * power; add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 250, g: 700, life: rand(.7, 1.6), sz: rand(6, 16), img: tinted(CF_SPARK, cols[i % cols.length]), trail: true }); } },
    coins(x, y, n = 40) { for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + rand(-1.1, 1.1), v = rand(500, 1200) * power; add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 1500, life: rand(1.6, 2.6), sz: rand(22, 38), img: CF_COIN, add: false, spin: rand(6, 14), rot: Math.random() * 6, drag: .995 }); } },
    gems(x, y, n = 18) { for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + rand(-1.3, 1.3), v = rand(500, 1100) * power; add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 1300, life: rand(1.6, 2.4), sz: rand(22, 34), img: CF_GEMS[i % 4], add: false, vr: rand(-6, 6), drag: .995 }); } },
    rain(dur, rate) { rainUntil = performance.now() + dur * 1000; rainRate = rate; },
    firework(x, y, col) { rings.push({ x, y, r: 0, vr: 700, life: .4, age: 0, col, w: 5 }); for (let i = 0; i < 70; i++) { const a = i / 70 * 6.283, v = rand(260, 420) * (.8 + power * .25); add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 220, life: rand(1, 1.5), sz: rand(8, 13), img: tinted(CF_SPARK, col), drag: .975, trail: true, twinkle: true }); } SFX.firework && SFX.firework(); },
    rocket(col, delay = 0) { setTimeout(() => { if (!run) return; const x = rand(W * .15, W * .85), ty = rand(H * .12, H * .4); add({ x, y: H + 10, vx: rand(-60, 60), vy: -(H + 10 - ty) * 1.9, g: 0, life: .55, sz: 12, img: tinted(CF_SPARK, '#fff3c0'), trail: true, drag: 1, onDie: p => api.firework(p.x, p.y, col) }); }, delay); },
    shock(x, y, col = '#fff6c8') { rings.push({ x, y, r: 10, vr: 1900, life: .55, age: 0, col, w: 26 }); },
    beams(x, y, col, n = 9) { for (let i = 0; i < n; i++) beams.push({ x, y, a: i / n * 6.283, w: rand(.08, .16), col, len: Math.hypot(W, H) }); },
    shake(v) { shake = Math.max(shake, v); },
    stop() { run = false; cv.remove(); }
  };
  function frame(now) {
    if (!run) return; const dt = Math.min(.05, (now - last) / 1000); last = now;
    g.clearRect(0, 0, W, H);
    // rayons divins
    if (beams.length) { g.save(); g.globalCompositeOperation = 'lighter'; const T = now * .00025; for (const b of beams) { const a = b.a + T; g.save(); g.translate(b.x, b.y); g.rotate(a); const gr = g.createLinearGradient(0, 0, b.len, 0); gr.addColorStop(0, b.col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.globalAlpha = .35 + .15 * Math.sin(now * .003 + b.a * 3); g.beginPath(); g.moveTo(0, 0); g.lineTo(b.len, -b.len * b.w); g.lineTo(b.len, b.len * b.w); g.closePath(); g.fill(); g.restore(); } g.restore(); }
    if (now < rainUntil) for (let i = 0; i < rainRate * dt; i++) { const gem = Math.random() < .15 * power; add({ x: rand(0, W), y: -40, vx: rand(-40, 40), vy: rand(150, 400), g: 900, life: 2.6, sz: rand(20, 34), img: gem ? CF_GEMS[i % 4] : CF_COIN, add: false, spin: gem ? 0 : rand(6, 14), vr: gem ? rand(-4, 4) : 0, rot: Math.random() * 6, drag: 1 }); }
    for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.age += dt; r.r += r.vr * dt; const k = 1 - r.age / r.life; if (k <= 0) { rings.splice(i, 1); continue; } g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = r.col; g.globalAlpha = k; g.lineWidth = (r.w || 10) * k; g.beginPath(); g.arc(r.x, r.y, r.r, 0, 7); g.stroke(); g.restore(); }
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i]; p.age += dt; if (p.age >= p.life || p.y > H + 80) { P.splice(i, 1); p.onDie && p.onDie(p); continue; }
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.g * dt; const ox = p.x, oy = p.y; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += (p.vr || 0) * dt;
      const k = 1 - p.age / p.life, al = p.add ? Math.min(1, k * 1.6) * (p.twinkle ? (.5 + .5 * Math.sin(p.age * 40 + i)) : 1) : Math.min(1, k * 3);
      g.globalCompositeOperation = p.add ? 'lighter' : 'source-over'; g.globalAlpha = al;
      if (p.trail) { g.strokeStyle = 'rgba(255,220,140,.5)'; g.lineWidth = p.sz * .25; g.beginPath(); g.moveTo(ox - p.vx * .04, oy - p.vy * .04); g.lineTo(p.x, p.y); g.stroke(); }
      const s = p.sz; g.save(); g.translate(p.x, p.y); g.rotate(p.rot); if (p.spin) g.scale(Math.abs(Math.cos(p.age * p.spin)) * .9 + .1, 1); g.drawImage(p.img, -s / 2, -s / 2, s, s); g.restore();
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    if (shake > .2) { host.style.transform = `translate(${rand(-shake, shake)}px,${rand(-shake, shake)}px) rotate(${rand(-shake, shake) * .04}deg)`; shake *= Math.pow(.02, dt); } else if (host.style.transform) host.style.transform = '';
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return api;
}
let chestBusy = false;
function openChest(type, onDone) {
  if (chestBusy) return; chestBusy = true;
  const c = CHESTS[type]; const rew = rollChest(type);
  const el = document.createElement('div'); el.id = 'chestFx';
  el.style.cssText = `--cg1:${c.bg};--cray:${c.ray};--cglow:${c.glow};--ct:${c.t}`;
  el.innerHTML = `<div class="cf-rays"></div><div class="cf-flash"></div><div class="cf-title">${c.name}</div><div class="cf-sub" id="cfSub">Touche le coffre pour l'ouvrir</div>
   <div class="cf-stage"><div class="cf-glow"></div><div class="cf-beam"></div><div class="cf-chest" id="cfChest">${chestSVG(type)}</div></div>
   <div class="cf-rew" id="cfRew"></div><button class="btn btn-green cf-btn" id="cfOk">Récupérer</button>`;
  document.body.appendChild(el);
  musicDuck(.12); SFX.chestAppear();
  const ch = el.querySelector('#cfChest');
  let opened = false;
  const power = { bois: .8, argent: 1, or: 1.25, legendaire: 1.6 }[type] || 1, beamCol = { bois: 'rgba(255,190,90,.55)', argent: 'rgba(150,215,255,.6)', or: 'rgba(255,215,90,.7)', legendaire: 'rgba(210,140,255,.75)' }[type];
  const fx = chestVFX(el, power); el._fx = fx;
  const fwCols = type === 'legendaire' ? ['#d38bff', '#59f0ff', '#ff5fd0', '#ffd54a'] : type === 'argent' ? ['#9ad8ff', '#ffffff', '#59f0ff', '#ffd54a'] : ['#ffd54a', '#ff7a3a', '#fff2b0', '#ff4d6d'];
  // avant ouverture : étincelles qui tournent autour du coffre
  const idle = setInterval(() => { if (opened) return; const r = ch.getBoundingClientRect(); const a = Math.random() * 6.28; fx.burst(r.left + r.width / 2 + Math.cos(a) * r.width * .45, r.top + r.height * .55 + Math.sin(a) * r.height * .3, 3, fwCols); }, 120);
  ch.addEventListener('click', async () => {
    if (opened) return; opened = true; clearInterval(idle);
    el.querySelector('#cfSub').textContent = '…';
    const rr0 = ch.getBoundingClientRect(), cx = rr0.left + rr0.width / 2, cy = rr0.top + rr0.height * .45;
    ch.classList.add('shake'); SFX.drumroll(1.3); fx.shake(4);
    const charge = setInterval(() => { fx.burst(cx + rand(-60, 60), cy + rand(-20, 60), 6, fwCols); fx.shake(5 * power); }, 90);
    await new Promise(r => setTimeout(r, 650)); ch.classList.replace('shake', 'shake2'); fx.shake(9 * power);
    el.querySelector('.cf-glow').style.transform = 'scale(1.9)';
    await new Promise(r => setTimeout(r, 650)); clearInterval(charge);
    ch.classList.remove('shake2'); ch.classList.add('open');
    el.querySelector('.cf-flash').classList.add('go'); el.querySelector('.cf-beam').classList.add('on'); el.classList.add('opened');
    SFX.chestOpen(); SFX.boom && SFX.boom();
    fx.shake(22 * power); fx.shock(cx, cy); setTimeout(() => fx.shock(cx, cy, beamCol), 120);
    fx.beams(cx, cy, beamCol, type === 'legendaire' ? 14 : 10);
    fx.burst(cx, cy, Math.round(220 * power), fwCols); fx.coins(cx, cy, Math.round(45 * power)); if (rew.gems || type !== 'bois') fx.gems(cx, cy, Math.round(14 * power));
    fx.rain(type === 'bois' ? 2.5 : 4.5, 40 * power);
    const nR = type === 'legendaire' ? 9 : type === 'or' ? 7 : type === 'argent' ? 5 : 3; for (let i = 0; i < nR; i++) fx.rocket(fwCols[i % fwCols.length], 250 + i * 330);
    confetti(cx, cy); setTimeout(() => confetti(cx, cy), 250); setTimeout(() => SFX.coinRain && SFX.coinRain(), 200); setTimeout(() => SFX.fanfare(), 350);
    el.querySelector('#cfSub').textContent = type === 'legendaire' ? '✨ BUTIN LÉGENDAIRE ! ✨' : 'Butin récupéré !';
    const cards = [];
    if (rew.gold) cards.push(`<div class="cf-card">${ic('i-coin')}<b>+${fmt(rew.gold)}</b><small>Or</small></div>`);
    if (rew.gems) cards.push(`<div class="cf-card gem">${ic('i-gem')}<b>+${rew.gems}</b><small>Gemmes</small></div>`);
    if (rew.barrels) cards.push(`<div class="cf-card">${ic('i-barrel')}<b>×${rew.barrels}</b><small>Barils</small></div>`);
    if (rew.skin) cards.push(`<div class="cf-card leg"><img src="${shipThumb(rew.skin)}"><b style="font-size:13px">${SKINS[rew.skin].name}</b><small>Skin légendaire</small></div>`);
    const box = el.querySelector('#cfRew');
    for (let i = 0; i < cards.length; i++) { await new Promise(r => setTimeout(r, 420)); box.insertAdjacentHTML('beforeend', cards[i]); SFX.star(i); const cd = box.lastElementChild.getBoundingClientRect(); fx.burst(cd.left + cd.width / 2, cd.top + cd.height / 2, 60, fwCols); fx.shake(6); }
    el.querySelector('#cfOk').classList.add('on');
  });
  if (QS.has('copen')) setTimeout(() => ch.click(), 500);
  el.querySelector('#cfOk').addEventListener('click', () => {
    if (!el.querySelector('#cfOk').classList.contains('on')) return;
    S.gold += rew.gold; S.gems += rew.gems; S.barrels += rew.barrels; if (rew.skin && !S.owned.includes(rew.skin)) S.owned.push(rew.skin); save();
    if (rew.gold) flyCoins(innerWidth / 2, innerHeight / 2, '#pillGold', 14); if (rew.gems) flyCoins(innerWidth / 2, innerHeight / 2, '#pillGem', 8, 'i-gem');
    el.style.transition = 'opacity .35s'; el.style.opacity = 0; setTimeout(() => { el._fx && el._fx.stop(); el.remove(); }, 360);
    musicDuck(.55, 1.2); chestBusy = false; SFX.click(); updChestBadge();
    if (rew.skin) toast(`Nouveau skin : ${SKINS[rew.skin].name} !`);
    onDone && onDone();
  });
}
function updChestBadge() { const n = S.chests.length; const b = $('#chestBadge'); if (b) { b.textContent = n; b.style.display = n ? '' : 'none'; } }
function openNextChest() { if (!S.chests.length) { toast('Aucun coffre — gagne des raids pour en obtenir !'); return; } const t = S.chests.shift(); save(); openChest(t, () => { if (S.chests.length) setTimeout(openNextChest, 300); }); }

/* ---------------- SHOP ---------------- */
let shopTab = 'offres';
const eur = v => v.toFixed(2).replace('.', ',') + ' €';
function gemPile(n) { const pos = [[32, 34, 1.2], [14, 44, .8], [50, 44, .8], [24, 20, .7], [44, 22, .7], [6, 28, .6], [58, 28, .6], [32, 10, .65]].slice(0, n); return `<svg viewBox="-4 -4 72 68">${pos.map(([x, y, s]) => `<use href="#i-gem" x="${x - 16 * s}" y="${y - 16 * s}" width="${32 * s}" height="${32 * s}"/>`).join('')}</svg>`; }
function coinPileSvg(n) { const pos = [[32, 36, 1.1], [16, 44, .8], [48, 44, .8], [24, 22, .75], [42, 24, .75], [32, 10, .65], [6, 30, .6], [58, 30, .6]].slice(0, n); return `<svg viewBox="-4 -4 72 68">${pos.map(([x, y, s]) => `<use href="#i-coin" x="${x - 16 * s}" y="${y - 16 * s}" width="${32 * s}" height="${32 * s}"/>`).join('')}</svg>`; }
const GEMPACKS = [[80, .99, 1, ''], [500, 4.99, 2, '+10%'], [1200, 9.99, 4, 'POPULAIRE'], [2500, 19.99, 5, '+20%'], [6500, 49.99, 7, '+30%'], [14000, 99.99, 8, 'MEILLEURE OFFRE']];
const GOLDPACKS = [[5000, 40, 3], [25000, 180, 5], [100000, 650, 8]];
function midnightLeft() { const m = new Date(); const ms = new Date(m.getFullYear(), m.getMonth(), m.getDate() + 1) - m; return `${Math.floor(ms / 3.6e6)}h ${String(Math.floor(ms / 6e4) % 60).padStart(2, '0')}m`; }
function openShop(tab = shopTab) {
  shopTab = tab;
  const tabs = [['offres', 'Offres'], ['skins', 'Skins'], ['gemmes', 'Gemmes'], ['or', 'Or']];
  let body = '';
  if (tab === 'offres') {
    body = `<div class="hero-offer"><div class="ribbon">-70%</div><div class="ho-tag">OFFRE LÉGENDAIRE</div><div class="ho-title">Pack du<br>Roi Pirate</div>
      <img class="ho-img" src="${shipThumb('dore')}"><ul class="ho-list"><li>${ic('i-flag')}Skin Galion Doré</li><li>${ic('i-gem')}1 200 gemmes</li><li>${ic('i-coin')}50 000 or</li><li>${ic('i-barrel')}5 barils de poudre</li></ul>
      <div class="ho-timer">⏳ Se termine dans ${midnightLeft()}</div><button class="btn btn-gold" data-buy="roi" style="min-width:60%"><span class="price-old">34,99 €</span>9,99 €</button></div>
      <div class="section-t">OFFRES DU JOUR</div><div class="grid">
      <div class="card epic"><div class="rar">DÉBUTANT</div><div class="bonus">x5</div><div class="thumb art" data-view="pourpre"><img src="${shipArt('pourpre')}"></div><div class="cname">Pack Corsaire</div><button class="btn btn-gold" data-buy="debutant">1,99 €</button></div>
      <div class="card rare"><div class="rar">ARSENAL</div><div class="thumb">${ic('i-barrel')}</div><div class="cname">3 Barils de poudre</div><button class="btn btn-blue" data-gbuy="barils">${ic('i-gem')} 60</button></div>
      <div class="card leg"><div class="rar">LÉGENDAIRE</div><div class="thumb">${chestSVG('legendaire')}</div><div class="cname">Coffre de l'Amiral</div><button class="btn btn-gold" data-buy="amiral">4,99 €</button></div>
      <div class="card epic"><div class="rar">COFFRE</div><div class="thumb">${chestSVG('or')}</div><div class="cname">Coffre d'Or</div><button class="btn btn-blue" data-gbuy="coffre:or">${ic('i-gem')} 120</button></div>
      <div class="card rare"><div class="rar">COFFRE</div><div class="thumb">${chestSVG('argent')}</div><div class="cname">Coffre d'Argent</div><button class="btn btn-blue" data-gbuy="coffre:argent">${ic('i-gem')} 45</button></div>
      <div class="card com"><div class="rar">GRATUIT</div><div class="thumb">${ic('i-wheel', 'spin-slow')}</div><div class="cname">Roue quotidienne</div><button class="btn btn-green" data-goto="wheel">Ouvrir</button></div></div>`;
  } else if (tab === 'skins') {
    body = `<div class="grid">${Object.entries(SKINS).map(([id, s]) => {
      const own = S.owned.includes(id), eq = S.skin === id;
      const btn = eq ? `<button class="btn btn-blue dis">Équipé</button>` : own ? `<button class="btn btn-green" data-equip="${id}">Équiper</button>` : s.cur === 'eur' ? `<button class="btn btn-gold" data-buy="skin:${id}">${eur(s.price)}</button>` : `<button class="btn btn-blue" data-gbuy="skin:${id}">${ic('i-gem')} ${s.price}</button>`;
      return `<div class="card skin ${s.rar}${eq ? ' equipped' : ''}"><div class="rar">${RAR[s.rar]}</div>${s.isNew && !own ? '<div class="bonus new">NOUVEAU</div>' : ''}<div class="thumb art" data-view="${id}"><img src="${shipArt(id)}"><span class="eye">👁 3D</span></div><div class="cname">${s.name}</div>${btn}</div>`;
    }).join('')}</div>`;
  } else if (tab === 'gemmes') {
    body = `<div class="grid">${GEMPACKS.map(([n, p, k, tag], i) => `<div class="card ${i >= 4 ? 'leg' : i >= 2 ? 'epic' : 'rare'}"><div class="rar">${fmt(n)} GEMMES</div>${tag ? `<div class="bonus">${tag}</div>` : ''}<div class="thumb">${gemPile(k)}</div><div class="cname">${['Poignée', 'Bourse', 'Sac', 'Coffret', 'Coffre', 'Trésor'][i]} de gemmes</div><button class="btn btn-gold" data-buy="gems:${i}">${eur(p)}</button></div>`).join('')}</div>`;
  } else {
    body = `<div class="grid">${GOLDPACKS.map(([n, c, k], i) => `<div class="card ${['rare', 'epic', 'leg'][i]}"><div class="rar">${fmt(n)} OR</div><div class="thumb">${coinPileSvg(k)}</div><div class="cname">${['Bourse', 'Coffre', 'Cale pleine'][i]} d'or</div><button class="btn btn-blue" data-gbuy="gold:${i}">${ic('i-gem')} ${c}</button></div>`).join('')}
     <div class="card com"><div class="rar">ARSENAL</div><div class="thumb">${ic('i-barrel')}</div><div class="cname">3 Barils de poudre</div><button class="btn btn-blue" data-gbuy="barils">${ic('i-gem')} 60</button></div></div>`;
  }
  openModal(`${closeBtn}<div class="p-head"><h2>Boutique</h2><p>Prototype : paiements simulés, aucun débit réel</p></div>
   <div class="tabs">${tabs.map(([k, l]) => `<button class="tab ${k === tab ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
   <div class="p-body">${body}<div class="note">Les achats réels passeront par Google Play / App Store.</div></div>`);
  mWrap.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => { SFX.click(); openShop(b.dataset.tab); }));
  mWrap.querySelectorAll('[data-equip]').forEach(b => b.addEventListener('click', () => equip(b.dataset.equip)));
  mWrap.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => buyEur(b.dataset.buy)));
  mWrap.querySelectorAll('[data-gbuy]').forEach(b => b.addEventListener('click', () => buyGems(b.dataset.gbuy)));
  mWrap.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => openWheel()));
  mWrap.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { SFX.click(); openSkinView(b.dataset.view); }));
}
function equip(id) { S.skin = id; save(); placeBuilding('quai', true); SFX.upgrade(); toast(`${SKINS[id].name} équipé !`); openShop('skins'); }
function grant(what) {
  const [k, v] = what.split(':');
  let g = 0, gm = 0;
  if (k === 'roi') { if (!S.owned.includes('dore')) S.owned.push('dore'); gm = 1200; g = 50000; S.barrels += 5; }
  else if (k === 'debutant') { if (!S.owned.includes('pourpre')) S.owned.push('pourpre'); gm = 500; }
  else if (k === 'amiral') { setTimeout(() => { closeModal(); openChest('legendaire'); }, 300); }
  else if (k === 'coffre') { setTimeout(() => { closeModal(); openChest(v); }, 300); }
  else if (k === 'gems') gm = GEMPACKS[+v][0];
  else if (k === 'gold') g = GOLDPACKS[+v][0];
  else if (k === 'barils') S.barrels += 3;
  else if (k === 'skin') { if (!S.owned.includes(v)) S.owned.push(v); }
  S.gold += g; S.gems += gm; save();
  const cx = innerWidth / 2, cy = innerHeight / 2;
  if (g) flyCoins(cx, cy, '#pillGold', 14); if (gm) flyCoins(cx, cy, '#pillGem', 10, 'i-gem');
  confetti(cx, cy); SFX.fanfare();
}
function itemInfo(what) {
  const [k, v] = what.split(':');
  if (k === 'roi') return ['Pack du Roi Pirate', 9.99, `<img src="${shipThumb('dore')}">`];
  if (k === 'debutant') return ['Pack Corsaire', 1.99, `<img src="${shipThumb('pourpre')}">`];
  if (k === 'amiral') return ["Coffre de l'Amiral", 4.99, chestSVG('legendaire')];
  if (k === 'gems') return [`${fmt(GEMPACKS[+v][0])} gemmes`, GEMPACKS[+v][1], gemPile(GEMPACKS[+v][2])];
  if (k === 'skin') return [SKINS[v].name, SKINS[v].price, `<img class="art-img" src="${shipArt(v)}">`];
  return ['Objet', 0, ''];
}
function buyEur(what) {
  const [name, price, img] = itemInfo(what); const back = shopTab;
  openModal(`${closeBtn}<div class="p-body buy-box" style="padding-top:22px"><div class="bimg">${img}</div><h3>${name}</h3><p>Confirme ton achat</p>
   <div class="paysim">● PAIEMENT SIMULÉ — prototype, aucun débit</div><button class="btn btn-green wide" id="payGo">Payer ${eur(price)}</button></div>`);
  $('#payGo').addEventListener('click', async () => {
    const b = $('#payGo'); b.classList.add('dis'); b.textContent = 'Traitement…'; await wait(.9);
    grant(what); toast(`Achat réussi : ${name}`);
    if (what.startsWith('skin:')) { const id = what.split(':')[1]; S.skin = id; save(); placeBuilding('quai', true); }
    openShop(what.startsWith('skin') ? 'skins' : back);
  });
}
function buyGems(what) {
  const [k, v] = what.split(':');
  const cost = k === 'skin' ? SKINS[v].price : k === 'gold' ? GOLDPACKS[+v][1] : k === 'coffre' ? (v === 'or' ? 120 : 45) : 60;
  if (S.gems < cost) { toast('Gemmes insuffisantes', true); openShop('gemmes'); return; }
  S.gems -= cost; grant(what);
  if (k === 'skin') { S.skin = v; save(); placeBuilding('quai', true); toast(`${SKINS[v].name} débloqué !`); }
  else toast('Achat réussi !');
  if (k !== 'coffre') openShop(shopTab);
}

/* ---------------- AUDIO (synthétisé) ---------------- */
let ac = null, master = null, noiseBuf = null;
function initAudio() {
  if (ac) return; try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  master = ac.createGain(); master.gain.value = S.sound ? .8 : 0; master.connect(ac.destination);
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // ambiance océan
  const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
  const g = ac.createGain(); g.gain.value = .05;
  const lfo = ac.createOscillator(); lfo.frequency.value = .13; const lg = ac.createGain(); lg.gain.value = .035; lfo.connect(lg); lg.connect(g.gain); lfo.start();
  src.connect(lp); lp.connect(g); g.connect(master); src.start();
}
function nz(dur, f0, f1, gain, type = 'lowpass', q = 1, delay = 0) {
  if (!ac) return; const t = ac.currentTime + delay;
  const s = ac.createBufferSource(); s.buffer = noiseBuf; const f = ac.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t, rand(0, 1)); s.stop(t + dur + .05);
}
function tone(freq, dur, gain, type = 'sine', delay = 0, f1) {
  if (!ac) return; const t = ac.currentTime + delay; const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .05);
}
const SFX = {
  boom: (p = 1) => { nz(.7, 900, 60, .5 * p); tone(90, .5, .45 * p, 'sine', 0, 35); },
  explo: (p = 1) => { nz(1.6, 1400, 40, .7 * Math.min(1.3, p)); tone(70, 1.1, .6, 'sine', 0, 25); nz(.3, 4000, 800, .2, 'bandpass', .7, .02); },
  splash: () => { nz(.6, 2500, 400, .18, 'bandpass', .6); },
  coin: () => { tone(1760 + rand(-60, 60), .12, .08, 'triangle'); tone(2640, .18, .05, 'triangle', .05); },
  coins: () => { for (let i = 0; i < 6; i++) tone(1500 + i * 180 + rand(-50, 50), .15, .06, 'triangle', i * .05); },
  click: () => { tone(520, .06, .12, 'triangle', 0, 380); },
  open: () => { nz(.25, 600, 3000, .06, 'bandpass', 1.2); tone(660, .12, .05, 'triangle', .02); },
  tick: () => { tone(1100, .03, .09, 'square'); },
  whoosh: () => { nz(.7, 300, 3000, .22, 'bandpass', 1.5); },
  err: () => { tone(220, .18, .12, 'square', 0, 160); },
  horn: (p = 1) => { [196, 247, 294].forEach((f, i) => { tone(f, 1.1, .07 * p, 'sawtooth', i * .02); }); nz(.8, 300, 120, .1 * p); },
  upgrade: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, .35, .09, 'triangle', i * .08)); nz(.6, 500, 100, .2); },
  fanfare: () => { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => { tone(f, .4, .08, 'triangle', i * .11); tone(f / 2, .4, .05, 'sawtooth', i * .11); }); },
  lose: () => { [392, 330, 262, 196].forEach((f, i) => tone(f, .5, .09, 'triangle', i * .18)); },
  chestAppear: () => { nz(.5, 200, 2000, .15, 'bandpass', 1); tone(392, .3, .07, 'triangle'); tone(587, .4, .06, 'triangle', .1); },
  drumroll: d => { if (!ac) return; let t = 0, gap = .11; while (t < d) { nz(.08, 1800, 300, .12 + t * .12, 'bandpass', .8, t); tone(140, .07, .08 + t * .05, 'sine', t, 70); t += gap; gap = Math.max(.035, gap * .9); } },
  boom: () => { nz(1.4, 900, 40, .55); tone(48, 1.2, .5, 'sine', 0, 28); tone(96, .5, .2, 'triangle', 0, 50); },
  firework: () => { nz(.5, 2500, 300, .12, 'highpass'); tone(rand(900, 1400), .25, .03, 'sine', 0, rand(200, 400)); },
  coinRain: () => { for (let i = 0; i < 26; i++) tone(rand(1800, 3200), .09, .035, 'triangle', i * .07 + Math.random() * .04); },
  chestOpen: () => { nz(1.2, 3000, 200, .35); tone(65, 1, .4, 'sine', 0, 40);
    [[523, 659, 784], [587, 740, 880], [659, 831, 988], [784, 988, 1175]].forEach((ch, i) => ch.forEach(f => { tone(f, i === 3 ? 1.6 : .3, .06, 'sawtooth', .05 + i * .14); tone(f, i === 3 ? 1.8 : .35, .07, 'triangle', .05 + i * .14); }));
    for (let i = 0; i < 14; i++) tone(1568 + i * 140 + rand(-40, 40), .25, .04, 'sine', .7 + i * .045); },
  star: i => { tone(880 + i * 220, .5, .1, 'triangle'); tone(1320 + i * 330, .5, .06, 'sine', .05); },
};

/* ---------------- MUSIQUE PIRATE (boucle procédurale) ---------------- */
const MUS = { on: false, next: 0, step: 0, gain: null, timer: null, intense: false };
// D minor shanty, 6/8, 16 mesures. notes en demi-tons depuis D4 (0). null = silence
const MEL = [
  0,null,3, 5,null,7, 8,null,7, 5,null,3, 2,null,0, -2,null,0, 2,null,3, 5,null,null,
  0,null,3, 5,null,7, 8,null,10, 12,null,10, 8,null,7, 5,null,3, 2,null,-2, 0,null,null,
  12,null,10, 8,null,7, 8,null,10, 12,null,15, 12,null,10, 8,null,7, 5,null,7, 8,null,null,
  7,null,5, 3,null,2, 3,null,5, 7,null,8, 7,null,5, 3,null,2, 0,null,-2, 0,null,null];
const CHORDS = [[0, 3, 7], [0, 3, 7], [-2, 2, 5], [-2, 2, 5], [-4, 0, 3], [-4, 0, 3], [-5, -2, 2], [-5, -1, 2],
  [0, 3, 7], [0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -2, 2], [-5, -1, 2], [0, 3, 7], [0, 3, 7]];
const D4 = 293.66, nf = n => D4 * Math.pow(2, n / 12);
function musNote(freq, t, dur, gain, type, dest, attack = .01) {
  const o = ac.createOscillator(); o.type = type; o.frequency.value = freq;
  const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + .05); return o;
}
function musSchedule() {
  if (!ac || !MUS.on) return;
  const bpmEighth = MUS.intense ? .16 : .19;
  while (MUS.next < ac.currentTime + .25) {
    const t = MUS.next, i = MUS.step % 96, bar = Math.floor(i / 6), beat = i % 6;
    const m = MEL[i];
    if (m !== null) {
      const fr = nf(m + 12 * (MUS.intense ? 0 : 0));
      musNote(fr, t, bpmEighth * 1.9, .06, 'triangle', MUS.gain);          // fiddle-ish lead
      musNote(fr * 2.005, t, bpmEighth * 1.2, .015, 'sawtooth', MUS.lp);   // brightness
    }
    const ch = CHORDS[bar];
    if (beat === 0 || beat === 3) {                                           // accordion stabs
      for (const n of ch) musNote(nf(n - 12), t, bpmEighth * 2.4, .022, 'sawtooth', MUS.lp, .03);
      musNote(nf(ch[0] - 24), t, bpmEighth * 2.8, .11, 'sine', MUS.gain);   // bass
    }
    if (beat === 0 || beat === 3) {                                           // kick / drum
      const o = ac.createOscillator(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(45, t + .15);
      const g = ac.createGain(); g.gain.setValueAtTime(MUS.intense ? .22 : .14, t); g.gain.exponentialRampToValueAtTime(.0001, t + .25); o.connect(g); g.connect(MUS.gain); o.start(t); o.stop(t + .3);
    }
    if (beat === 2 || beat === 5 || (MUS.intense && beat === 4)) {          // tambourine
      const sN = ac.createBufferSource(); sN.buffer = noiseBuf; const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
      const g = ac.createGain(); g.gain.setValueAtTime(.05, t); g.gain.exponentialRampToValueAtTime(.0001, t + .08); sN.connect(f); f.connect(g); g.connect(MUS.gain); sN.start(t, rand(0, 1)); sN.stop(t + .1);
    }
    MUS.next += bpmEighth; MUS.step++;
  }
}
function startMusic() {
  if (!ac || MUS.on) return;
  MUS.gain = ac.createGain(); MUS.gain.gain.value = .55; MUS.gain.connect(master);
  MUS.lp = ac.createBiquadFilter(); MUS.lp.type = 'lowpass'; MUS.lp.frequency.value = 1800; MUS.lp.connect(MUS.gain);
  MUS.on = true; MUS.next = ac.currentTime + .1; MUS.timer = setInterval(musSchedule, 60);
}
function musicDuck(v, d = .4) { if (MUS.gain && ac) { MUS.gain.gain.cancelScheduledValues(ac.currentTime); MUS.gain.gain.linearRampToValueAtTime(v, ac.currentTime + d); } }
document.addEventListener('visibilitychange', () => { if (!ac) return; document.hidden ? ac.suspend() : ac.resume(); });

function setSound(on) { S.sound = on; save(); if (master) master.gain.value = on ? .8 : 0; $('#btnSound use').setAttribute('href', on ? '#i-sound' : '#i-mute'); }

/* ---------------- LOOP ---------------- */
let timeScale = 1, T = 0, ecoAcc = 0, frameN = 0, lblAcc = 0;
const camCtl = $('#camctl');
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h); composer.setSize(w, h); bloom.setSize(w * DPR, h * DPR);
  camera.aspect = w / h; camera.fov = w / h < 1 ? 44 : 38; camera.updateProjectionMatrix(); setParticleScale();
  gradePass.uniforms.uAsp.value = w / h;
  if (mode === 'home' || mode === 'raid') { camGoal.dist = clamp(camGoal.dist, zMin(), zMax()); }
}
addEventListener('resize', resize);
const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const rdt = Math.min(clock.getDelta(), .05), dt = rdt * timeScale; T += dt;
  oceanU.uTime.value = T; windU.value = T;
  updTweens(rdt);
  if (!cine) {
    const k = QS.has('snap') ? 1 : 1 - Math.exp(-rdt * 4.5);
    camState.az = lerp(camState.az, camGoal.az, k); camState.pol = lerp(camState.pol, camGoal.pol, k); camState.dist = lerp(camState.dist, camGoal.dist, k); camState.target.lerp(camGoal.target, k);
    applyCam();
  }
  if (mode === 'home' && performance.now() - userMoved > 7000) camGoal.az += rdt * .006;
  if (!cine) updSun();
  { const fn = 160 + camState.dist * 1.4, ff = 760 + camState.dist * 4.2; scene.fog.near = fn; scene.fog.far = ff; oceanU.uFogNear.value = fn; oceanU.uFogFar.value = ff; }
  if ((frameN++ & 7) === 0) {
    const show = (mode === 'home' || mode === 'raid') && modal.classList.contains('hidden'); camCtl.classList.toggle('hidden', !show);
  }
  rivalLabels.forEach((L, i) => { if (!L) return; const I = RSLOTS[i]; L.el.classList.toggle('near', Math.hypot(camState.target.x - I.x, camState.target.z - I.z) < 60); });
  if (shakeAmt > 0) { camera.position.x += rand(-1, 1) * shakeAmt; camera.position.y += rand(-1, 1) * shakeAmt * .6; camera.position.z += rand(-1, 1) * shakeAmt; shakeAmt = Math.max(0, shakeAmt - rdt * 2.4); }
  sky.position.copy(camera.position);
  // ambient animation
  for (const b of bobbers) { b.o.position.y = b.y + waveH(b.o.position.x, b.o.position.z, T) * .7; b.o.rotation.z = Math.sin(T * 1.1 + b.ph) * .05; }
  if (homeShip) { const inn = homeShip.userData.inner, wp = homeShip.getWorldPosition(_p); inn.position.y = -.45 + waveH(wp.x, wp.z, T) * .6; inn.rotation.z = Math.sin(T * .9) * .035; inn.rotation.x = Math.sin(T * .7 + 1) * .02; }
  if (R) for (const s of R.ships) if (!s.dead) { const inn = s.g.userData.inner; inn.position.y = -.45 + waveH(s.g.position.x, s.g.position.z, T) * .6; inn.rotation.z = Math.sin(T * .9 + s.g.userData.phase) * .04 + s.kick * .08; }
  for (const p of swayers) p.rotation.z = Math.sin(T * 1.3 + p.userData.sw) * .02;
  if (homeB.canon && homeB.canon.userData.gun) homeB.canon.userData.gun.rotation.y = Math.sin(T * .35) * .7;
  if (mode === 'home' && homeB.tresor && Math.random() < rdt * (1 + S.b.tresor)) { const a = buildingAnchor('tresor'); if (a) FX.sparkle(a.add(new V3(0, -2.5, 0)), 2, 2.4); }
  for (const g of gulls) { const u = g.userData, a = T * u.sp + u.ph; g.position.set(u.c.x + Math.cos(a) * u.r, u.h + Math.sin(T * .7 + u.ph) * 2, u.c.z + Math.sin(a) * u.r); g.rotation.y = -a + (u.sp > 0 ? Math.PI : 0); const f = Math.sin(T * 9 + u.ph) * .5; const p = g.geometry.attributes.position; p.setY(1, .35 + f); p.setY(4, .35 + f); p.needsUpdate = true; }
  for (const c of clouds) { c.userData.a += rdt * .002; c.position.x = Math.cos(c.userData.a) * c.userData.r; c.position.z = Math.sin(c.userData.a) * c.userData.r; }
  if (npcShip) { const a = T * .03; npcShip.position.set(Math.cos(a) * 66, 0, Math.sin(a) * 66); npcShip.rotation.y = -a + Math.PI; npcShip.userData.inner.position.y = -.45 + waveH(npcShip.position.x, npcShip.position.z, T) * .6; }
  for (const f of fleets) {
    const a = T * f.sp + f.ph, p = f.sh.position; p.set(f.cx + Math.cos(a) * f.r, 0, f.cz + Math.sin(a) * f.r);
    f.sh.rotation.y = -a + (f.sp > 0 ? Math.PI : 0); const inn = f.sh.userData.inner; inn.position.y = -.45 + waveH(p.x, p.z, T) * .6; inn.rotation.z = Math.sin(T * .9 + f.ph) * .04;
    if (p.distanceToSquared(camera.position) < 160000 && Math.random() < .5) { const b = f.sh.localToWorld(_w.set(0, 0, 3.6)); smoke.emit(b.x + rand(-.5, .5), .25, b.z + rand(-.5, .5), rand(-.8, .8), rand(.2, .8), rand(-.8, .8), 1.8, 1.4, 4.5, [1.25, 1.3, 1.35], [1, 1.05, 1.1], .55, .6, 0); }
  }
  // torches : flamme vacillante + braises
  const nearHome = camState.target.length() < 140;
  for (const t of torches) {
    const fl = .85 + Math.sin(T * 13 + t.ph) * .08 + Math.sin(T * 23 + t.ph * 2) * .06; t.glow.scale.setScalar(1.35 * fl);
    if (nearHome && Math.random() < .55) fire.emit(t.top.x + rand(-.12, .12), t.top.y, t.top.z + rand(-.12, .12), rand(-.2, .2), rand(1.2, 2.4), rand(-.2, .2), rand(.35, .6), .9, .25, [6, 3.2, .8], [2.2, .5, .05], 1, .4, -1.5);
  }
  // poussières dorées / pollen dans la lumière du soleil
  if (mode === 'home' && nearHome && Math.random() < rdt * 14) { const a = rand(0, 6.28), r = rand(0, 22); fire.emit(Math.cos(a) * r, rand(1, 7), Math.sin(a) * r, rand(-.3, .3), rand(.1, .4), rand(-.3, .3), rand(3, 5), .32, .12, [2.4, 2, 1.1], [1.6, 1.2, .5], .8, .9, -.05); }
  for (const l of flashLights) if (l.intensity > 0) l.intensity = Math.max(0, l.intensity - rdt * 2600 * (l.userData.p || 1));
  updRaid(dt); updShots(dt);
  smoke.update(dt); fire.update(dt);
  // economy
  const cap = CAP[S.b.tresor]; S.stored = Math.min(cap, S.stored + PROD[S.b.tresor] * rdt);
  ecoAcc += rdt; if (ecoAcc > 2) { ecoAcc = 0; S.lastTick = Date.now(); save(); refreshHomeLabels(); }
  lblAcc += rdt; if (lblAcc > 20) { lblAcc = 0; refreshRivalLabels(); }
  composer.render();
  updateLabels(); updHUD(rdt);
}

/* ---------------- BOOT ---------------- */
const TIPS = ['Hissez les voiles, capitaine…', 'Améliore ton Trésor pour produire plus d’or', 'Le Baril de poudre détruit tout dans un large rayon', 'Détruis le Trésor ennemi pour une étoile bonus', 'Tourne la Roue de la Fortune chaque jour !', 'Équipe des skins légendaires pour ta flotte', 'Choisis ta cible sur la Carte des Mers', 'Pince pour zoomer, glisse pour te déplacer'];
async function boot() {
  let ti = 0; const tipT = setInterval(() => { $('#ldTip').textContent = TIPS[++ti % TIPS.length]; }, 2200);
  const setP = p => { $('#ldFill').style.width = (p * 100).toFixed(0) + '%'; $('#ldPct').textContent = (p * 100).toFixed(0) + '%'; };
  await loadModels(p => setP(p * .9));
  homeExtras(); buildRivals();
  for (const k of Object.keys(BUILD)) placeBuilding(k);
  npcShip = makeShip(2, 'royal', .5); scene.add(npcShip);
  [[0, 0, 192, -.014, 'pourpre', 3], [0, 0, 236, .011, 'abysse', 2], [RSLOTS[0].x, RSLOTS[0].z, 46, .05, 'classique', 2], [RSLOTS[2].x, RSLOTS[2].z, 42, -.055, 'royal', 1], [0, 0, 300, -.008, 'fantome', 3]].forEach(([cx, cz, r, sp, sk, t], i) => {
    const sh = makeShip(t, sk, .55); scene.add(sh); fleets.push({ sh, cx, cz, r, sp, ph: i * 1.7 });
  });
  makeHomeLabels(); refreshHomeLabels(); updChestBadge();
  // gains hors-ligne
  const off = Math.max(0, (Date.now() - (S.lastTick || Date.now())) / 1000); S.stored = Math.min(CAP[S.b.tresor], S.stored + off * PROD[S.b.tresor]); S.lastTick = Date.now();
  resize();
  setCamNow(new V3(0, 2, 0), .62 + 1.4, .62, baseDist() * 1.9); applyCam();
  camGoal.az = .62; camGoal.pol = .96; camGoal.dist = baseDist(); camGoal.target.copy(HOME_T);
  composer.render();
  setP(.95);
  await new Promise(r => setTimeout(r, 50));
  ['dore', S.skin].forEach(shipThumb); ['pourpre', 'dore'].forEach(shipArt);
  setP(1); clearInterval(tipT);
  $('#ldTip').textContent = 'Ton île t’attend, capitaine !';
  $('#ldPlay').style.display = 'block';
  mode = 'ready'; clock.getDelta(); loop();
  const play = () => {
    initAudio(); setSound(S.sound); startMusic();
    $('#loading').classList.add('out'); setTimeout(() => $('#loading').remove(), 900);
    $('#hud').classList.remove('hidden'); mode = 'home';
    if (QS.get('auto') === 'raid') setTimeout(() => attackRival(Math.max(0, S.rivals.findIndex(r => !rivalShield(r)))), 1500);
    if (QS.get('auto') === 'map') setTimeout(() => openSeaMap(QS.has('r') ? +QS.get('r') : null), 1500);
    if (QS.get('auto') === 'view') setTimeout(() => { const I = RSLOTS[+(QS.get('r') || 0)]; flyTo(I.x, I.z, baseDist()); }, 600);
    if (QS.has('focus')) setTimeout(() => focusBuilding(QS.get('focus'), 999), 300);
    if (QS.has('zoom')) { camGoal.dist = clamp(baseDist() * +QS.get('zoom'), zMin(), zMax()); }
    if (QS.get('auto') === 'shop') setTimeout(() => openShop('offres'), 1500);
    if (QS.get('auto') === 'skins') setTimeout(() => openShop('skins'), 1500);
    if (QS.get('auto') === 'wheel') setTimeout(() => openWheel(), 1500);
    if (QS.get('auto') === 'chest') setTimeout(() => openChest(QS.get('t') || 'or'), 1500);
    if (QS.get('auto') === 'up') setTimeout(() => openUpgrade(QS.get('k') || 'tresor'), 1500);
    if (QS.get('auto') === 'skinview') setTimeout(() => openSkinView(QS.get('s') || 'dore'), 1500);
  };
  $('#ldPlay').addEventListener('click', play, { once: true });
  if (QS.has('auto')) play();
}
// UI bindings
document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => {
  SFX.click(); const o = b.dataset.open;
  if (o === 'wheel') openWheel(); else if (o === 'shop') openShop(b.dataset.tab || 'offres'); else if (o === 'skins') openShop('skins');
}));
$('#raidBtn').addEventListener('click', () => { SFX.click(); openSeaMap(); });
$('#zIn').addEventListener('click', () => { SFX.click(); zoomBy(.72); userMoved = performance.now(); });
$('#zOut').addEventListener('click', () => { SFX.click(); zoomBy(1.38); userMoved = performance.now(); });
$('#zHome').addEventListener('click', () => { SFX.click(); if (mode === 'raid' && panCenter) camGoal.target.copy(panCenter); else { camGoal.target.copy(HOME_T); camGoal.dist = baseDist(); } });
$('#zMap').addEventListener('click', () => { SFX.click(); camGoal.target.set(0, 2, 0); camGoal.dist = zMax(); userMoved = performance.now(); });
$('#collectBtn').addEventListener('click', collect);
$('#sideChest').addEventListener('click', () => { SFX.click(); openNextChest(); });
$('#btnSound').addEventListener('click', () => setSound(!S.sound));
$('#abVolley').addEventListener('click', volley);
$('#abBarrel').addEventListener('click', barrel);
$('#rRetreat').addEventListener('click', () => endRaid());
document.addEventListener('gesturestart', e => e.preventDefault());
boot().catch(e => { console.error(e); $('#ldTip').textContent = 'Erreur de chargement : ' + e.message; });
