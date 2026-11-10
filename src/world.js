// world.js — 校园场景：纹理、建筑、道路、植被、碰撞体
import * as THREE from 'three';

export const colliders = [];   // {x0,x1,y0,y1,z0,z1,noRay}
export const mapShapes = [];   // 小地图图形
export const FONT = '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC","Source Han Sans SC","WenQuanYi Zen Hei",sans-serif';
const KAI = 'STXingkai,"Xingkai SC","华文行楷",KaiTi,STKaiti,"楷体",' + FONT;

let seed = 20261110;
export function rnd() { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
const rr = (a, b) => a + (b - a) * rnd();

// ---------------------------------------------------------------- 纹理
// 纹理按 K 倍超采样绘制（桌面 4×，触屏 2×），保证近看清晰
const K = (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches) ? 2 : 4;
function ctex(w, h, draw, repeat = true) {
  const k = repeat ? K : Math.min(K, 2), c = document.createElement('canvas'); c.width = w * k; c.height = h * k;
  const g = c.getContext('2d'); g.scale(k, k); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 16; return t;
}
function speckle(g, w, h, n, alpha, size = 2) {
  for (let i = 0, m = n * K * 2; i < m; i++) {
    g.fillStyle = `rgba(${rnd() < .5 ? '0,0,0' : '255,255,255'},${(alpha * rnd()).toFixed(3)})`;
    g.fillRect(rnd() * w, rnd() * h, (.5 + rnd() * size) / K * 1.6, (.5 + rnd() * size) / K * 1.6);
  }
}
function bricks(g, w, h, rows, cols, hue, sat, lig, mortar, jit = 6) {
  g.fillStyle = mortar; g.fillRect(0, 0, w, h);
  const bh = h / rows, bw = w / cols;
  for (let r = 0; r < rows; r++) for (let c = -1; c <= cols; c++) {
    g.fillStyle = `hsl(${hue + rr(-3, 3)},${sat + rr(-5, 5)}%,${lig + rr(-jit, jit)}%)`;
    g.fillRect((c + (r % 2) * .5) * bw + .6, r * bh + .6, bw - 1.2, bh - 1.2);
  }
}
function glass(g, x, y, w, h, a = '#1c2c3c', b = '#587a96') {
  const gr = g.createLinearGradient(x, y, x + w * .4, y + h); gr.addColorStop(0, b); gr.addColorStop(.45, a); gr.addColorStop(1, '#121a24');
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(255,255,255,.10)'; g.beginPath(); g.moveTo(x, y + h * .5); g.lineTo(x + w * .55, y); g.lineTo(x + w * .8, y); g.lineTo(x, y + h * .85); g.fill();
}

const T = {};
function makeTextures() {
  T.grass = ctex(256, 256, (g, w, h) => { g.fillStyle = '#58803a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 9000 * K; i++) { g.fillStyle = `hsl(${rr(75, 112)},${rr(30, 55)}%,${rr(20, 42)}%)`; g.fillRect(rnd() * w, rnd() * h, .5, rr(1, 3.5)); } });
  T.asphalt = ctex(256, 256, (g, w, h) => { g.fillStyle = '#54565a'; g.fillRect(0, 0, w, h); speckle(g, w, h, 7000, .16); });
  T.paver = ctex(256, 256, (g, w, h) => { // 广场地砖 (2m)
    g.fillStyle = '#8f8683'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { g.fillStyle = `hsl(${rr(8, 22)},${rr(8, 16)}%,${rr(58, 68)}%)`; g.fillRect(c * 64 + 1, r * 64 + 1, 62, 62); }
    speckle(g, w, h, 4000, .09);
  });
  T.walk = ctex(256, 256, (g, w, h) => { bricks(g, w, h, 16, 8, 14, 22, 52, '#77706c', 5); speckle(g, w, h, 2500, .08); });
  T.brick = ctex(256, 256, (g, w, h) => { bricks(g, w, h, 28, 8, 8, 40, 33, '#5a4a45'); speckle(g, w, h, 2500, .08); });
  T.brickWin = ctex(256, 256, (g, w, h) => { // 4m × 3.3m 一个开间
    bricks(g, w, h, 44, 16, 8, 40, 33, '#5a4a45');
    g.fillStyle = '#d9d4cb'; g.fillRect(74, 62, 108, 124);
    glass(g, 80, 68, 96, 112);
    g.fillStyle = '#d9d4cb'; g.fillRect(126, 68, 4, 112); g.fillRect(80, 104, 96, 4);
    g.fillStyle = '#b9b2a8'; g.fillRect(68, 186, 120, 7);
  });
  T.curtain = ctex(256, 256, (g, w, h) => { // 深色玻璃幕墙
    glass(g, 0, 0, w, h, '#16222e', '#3d5a72');
    g.fillStyle = '#2a3138'; for (let i = 0; i <= 4; i++) { g.fillRect(i * 64 - 2, 0, 4, h); g.fillRect(0, i * 64 - 2, w, 4); }
  });
  T.libTile = ctex(256, 256, (g, w, h) => { // 图书馆粉色小面砖
    g.fillStyle = '#957468'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 32; r++) for (let c = 0; c < 16; c++) { g.fillStyle = `hsl(${rr(11, 15)},${rr(26, 32)}%,${rr(63, 68)}%)`; g.fillRect(c * 16 + .5, r * 8 + .5, 15, 7); }
  });
  T.libWin = ctex(256, 256, (g, w, h) => { // 图书馆底部楼层 4m×3m
    g.fillStyle = '#c3a498'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 32; r++) for (let c = 0; c < 16; c++) { g.fillStyle = `hsl(${rr(11, 15)},${rr(24, 30)}%,${rr(63, 68)}%)`; g.fillRect(c * 16 + .5, r * 8 + .5, 15, 7); }
    glass(g, 8, 40, 240, 130, '#141c24', '#3b5266');
    g.fillStyle = '#6d6058'; for (let i = 0; i <= 3; i++) g.fillRect(8 + i * 78, 40, 5, 130);
    g.fillStyle = '#a58a80'; g.fillRect(0, 176, w, 12);
  });
  T.granite = ctex(256, 256, (g, w, h) => { // 红色花岗岩柱 (1.2m 分块)
    g.fillStyle = '#a8705c'; g.fillRect(0, 0, w, h); speckle(g, w, h, 9000, .2, 1);
    g.fillStyle = 'rgba(60,30,24,.55)'; g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h);
    g.fillStyle = 'rgba(255,220,200,.15)'; g.fillRect(0, 3, w, 2);
  });
  T.stone = ctex(256, 256, (g, w, h) => { g.fillStyle = '#a9a39a'; g.fillRect(0, 0, w, h); speckle(g, w, h, 12000, .22, 1); });
  T.orange = ctex(256, 256, (g, w, h) => { // 少年班橙色面砖
    g.fillStyle = '#b9552c'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 16; r++) for (let c = 0; c < 4; c++) { g.fillStyle = `hsl(${rr(15, 20)},${rr(60, 68)}%,${rr(46, 52)}%)`; g.fillRect(c * 64 + .5, r * 16 + .5, 63, 15); }
  });
  T.orangeWin = ctex(256, 256, (g, w, h) => {
    g.fillStyle = '#b9552c'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 16; r++) for (let c = 0; c < 4; c++) { g.fillStyle = `hsl(${rr(15, 20)},${rr(60, 68)}%,${rr(46, 52)}%)`; g.fillRect(c * 64 + .5, r * 16 + .5, 63, 15); }
    g.fillStyle = '#e8e2d8'; g.fillRect(0, 196, w, 10);
    glass(g, 84, 56, 88, 120, '#1a242e', '#4a6478'); g.fillStyle = '#3b3f44'; g.fillRect(126, 56, 4, 120);
  });
  T.panel = ctex(256, 256, (g, w, h) => { // 灰色铝板
    g.fillStyle = '#b4b6b8'; g.fillRect(0, 0, w, h); speckle(g, w, h, 1500, .05);
    g.fillStyle = 'rgba(40,44,50,.5)'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h); g.fillRect(127, 0, 2, h);
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(0, 2, w, 2);
  });
  T.tallGlass = ctex(256, 512, (g, w, h) => { // 少年班大玻璃窗：倒映冬树
    glass(g, 0, 0, w, h, '#1d2a3a', '#7d9cc0');
    g.strokeStyle = 'rgba(10,12,16,.75)';
    for (let i = 0; i < 26; i++) { let x = rr(20, 236), y = h; g.lineWidth = rr(1, 4); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 9; k++) { x += rr(-22, 22); y -= rr(20, 60); g.lineTo(x, y); g.lineWidth *= .8; } g.stroke(); }
    g.fillStyle = '#23272c'; g.fillRect(0, 0, 6, h); g.fillRect(w - 6, 0, 6, h); g.fillRect(124, 0, 8, h); g.fillRect(0, 300, w, 8); g.fillRect(0, 0, w, 6);
  }, false);
  T.concrete = ctex(512, 512, (g, w, h) => { // 校史馆清水混凝土 + 枯藤
    g.fillStyle = '#9a9a96'; g.fillRect(0, 0, w, h); speckle(g, w, h, 16000, .13);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(40,40,38,${rr(.03, .1)})`; g.fillRect(rnd() * w, 0, rr(4, 26), h); }
    g.strokeStyle = 'rgba(92,70,52,.8)';
    for (let i = 0; i < 70; i++) { let x = rnd() * w, y = rnd() * h; g.lineWidth = rr(.6, 1.8); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 14; k++) { x += rr(-14, 14); y += rr(-22, 6); g.lineTo(x, y); } g.stroke(); }
  });
  T.histWin = ctex(256, 256, (g, w, h) => { // 校史馆窗 3m×3.2m：暗红窗框
    g.fillStyle = '#93938f'; g.fillRect(0, 0, w, h); speckle(g, w, h, 4000, .12);
    g.strokeStyle = 'rgba(92,70,52,.7)';
    for (let i = 0; i < 16; i++) { let x = rnd() * w, y = rr(180, 256); g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += rr(-10, 10); y -= rr(4, 18); g.lineTo(x, y); } g.stroke(); }
    g.fillStyle = '#5e1a22'; g.fillRect(48, 44, 160, 142);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) glass(g, 54 + c * 77, 50 + r * 45, 71, 40, '#1a2026', '#56646c');
  });
  T.histDoor = ctex(1024, 384, (g, w, h) => { // 校史馆底层：暗红门 + 牌匾
    g.fillStyle = '#8b8b87'; g.fillRect(0, 0, w, h); speckle(g, w, h, 9000, .12);
    const door = (x, dw) => { g.fillStyle = '#5a1620'; g.fillRect(x, 70, dw, 314); g.fillStyle = '#6c1f2a'; const n = Math.round(dw / 110); for (let i = 0; i < n; i++) { const px = x + i * dw / n + 8, pw = dw / n - 16; g.fillRect(px, 96, pw, 120); g.fillRect(px, 232, pw, 140); g.fillStyle = '#c9c4b8'; g.fillRect(px + pw - 10, 190, 4, 70); g.fillStyle = '#6c1f2a'; } glass(g, x + 6, 74, dw - 12, 18, '#20262c', '#59656c'); };
    door(40, 110); door(874, 110); door(292, 440);
    g.fillStyle = '#0d0d0d'; g.fillRect(392, 4, 240, 62);
    g.fillStyle = '#d9b24a'; g.font = `bold 50px ${KAI}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('校 史 馆', 512, 37);
  }, false);
  T.gateText = ctex(2048, 160, (g, w, h) => {
    g.fillStyle = '#ece8df'; g.fillRect(0, 0, w, h); speckle(g, w, h, 5000, .05);
    g.fillStyle = '#b3162c'; g.font = `bold 104px ${KAI}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    '中国科学技术大学'.split('').forEach((ch, i) => g.fillText(ch, 290 + i * 210, 84));
  }, false);
  T.sgySign = ctex(1024, 128, (g, w, h) => {
    g.fillStyle = '#e4e5e6'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#d0202c'; g.font = `bold 92px ${KAI}`; g.textBaseline = 'middle'; g.textAlign = 'right'; g.fillText('少年班', 500, 66);
    g.fillStyle = '#1f6fb5'; g.font = `600 36px ${FONT}`; g.textAlign = 'left'; g.fillText('School of', 524, 42); g.fillText('the Gifted Young', 524, 88);
  }, false);
  T.libSign = ctex(512, 96, (g, w, h) => { g.fillStyle = '#3a2a26'; g.fillRect(0, 0, w, h); g.fillStyle = '#e2c98c'; g.font = `bold 60px ${KAI}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('图 书 馆', 256, 50); }, false);
  T.fence = ctex(64, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(190,196,200,.9)'; g.lineWidth = 2; for (let i = -64; i < 128; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke(); g.beginPath(); g.moveTo(i + 64, 0); g.lineTo(i, 64); g.stroke(); } });
  T.bark = ctex(64, 128, (g, w, h) => { g.fillStyle = '#b9b39f'; g.fillRect(0, 0, w, h); for (let i = 0; i < 60; i++) { g.fillStyle = `hsl(${rr(40, 80)},${rr(10, 25)}%,${rr(40, 75)}%)`; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, rr(3, 9), rr(5, 14), rnd(), 0, 7); g.fill(); } });
}

/** 由颜色贴图的明暗推导法线贴图，让砖缝、地砖、混凝土在阳光下有凹凸感 */
function normalFrom(tex, strength = 2) {
  const src = tex.image, w = src.width, h = src.height, d = src.getContext('2d').getImageData(0, 0, w, h).data;
  const H = new Float32Array(w * h); for (let i = 0; i < w * h; i++) H[i] = (d[i * 4] * .3 + d[i * 4 + 1] * .59 + d[i * 4 + 2] * .11) / 255;
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), out = g.createImageData(w, h), o = out.data;
  for (let y = 0; y < h; y++) { const y0 = ((y - 1 + h) % h) * w, y1 = ((y + 1) % h) * w; for (let x = 0; x < w; x++) { const x0 = (x - 1 + w) % w, x1 = (x + 1) % w, dx = (H[y * w + x0] - H[y * w + x1]) * strength, dy = (H[y1 + x] - H[y0 + x]) * strength, l = 1 / Math.sqrt(dx * dx + dy * dy + 1), i = (y * w + x) * 4; o[i] = (dx * l * .5 + .5) * 255; o[i + 1] = (dy * l * .5 + .5) * 255; o[i + 2] = (l * .5 + .5) * 255; o[i + 3] = 255; } }
  g.putImageData(out, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16; return t;
}
const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: .85, metalness: 0 }, o));
export const M = {};
function makeMaterials() {
  makeTextures();
  M.grass = std({ map: T.grass, roughness: 1 }); M.asphalt = std({ map: T.asphalt, roughness: .95 });
  M.paver = std({ map: T.paver, roughness: .55 }); M.walk = std({ map: T.walk, roughness: .8 });
  M.brick = std({ map: T.brick }); M.brickWin = std({ map: T.brickWin, roughness: .7 });
  M.curtain = std({ map: T.curtain, roughness: .15, metalness: .6 });
  M.libTile = std({ map: T.libTile, roughness: .7 }); M.libWin = std({ map: T.libWin, roughness: .5 });
  M.granite = std({ map: T.granite, roughness: .45 }); M.stone = std({ map: T.stone, roughness: .7 });
  M.orange = std({ map: T.orange, roughness: .6 }); M.orangeWin = std({ map: T.orangeWin, roughness: .55 });
  M.panel = std({ map: T.panel, roughness: .4, metalness: .35 });
  M.tallGlass = std({ map: T.tallGlass, roughness: .08, metalness: .7 });
  M.concrete = std({ map: T.concrete, roughness: .95 }); M.histWin = std({ map: T.histWin, roughness: .8 });
  M.white = std({ color: 0xece8df, roughness: .8 }); M.roof = std({ color: 0x8a8a88, roughness: 1 });
  M.metal = std({ color: 0x8b9096, roughness: .35, metalness: .8 }); M.dark = std({ color: 0x22262b, roughness: .5, metalness: .5 });
  M.hedge = std({ color: 0x3f6b2c, roughness: 1 }); M.redShrub = std({ color: 0x7a2530, roughness: 1 });
  M.flower = std({ color: 0xd9a03a, roughness: 1 }); M.wood = std({ color: 0x7a5636, roughness: .9 });
  M.glassDoor = std({ color: 0x4f6f86, roughness: .05, metalness: .8, transparent: true, opacity: .78 });
  M.vase = std({ color: 0x5b2a6e, roughness: .15, metalness: .3 });
  M.fence = std({ map: T.fence, transparent: true, alphaTest: .4, side: THREE.DoubleSide, metalness: .6, roughness: .4 });
  M.bark = std({ map: T.bark, roughness: 1 }); M.barkDark = std({ color: 0x4a3a30, roughness: 1 });
  for (const [k, st] of [['brick', 3], ['brickWin', 3], ['walk', 2.5], ['paver', 2], ['libTile', 2.5], ['libWin', 2], ['granite', 1.5], ['stone', 1.2], ['orange', 2.5], ['orangeWin', 2.5], ['concrete', 2], ['histWin', 2], ['asphalt', 1.6], ['panel', 1.5], ['grass', 1.2]]) M[k].normalMap = normalFrom(M[k].map, st);
  M.lamp = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d0, emissiveIntensity: .5, roughness: .3 });
}

// ---------------------------------------------------------------- 几何工具
let scene;
function boxGeo(w, h, d, su, sv) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (su) {
    const uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / su, uv.getY(k) * dims[f][1] / (sv || su)); }
  }
  return g;
}
export function addCollider(x0, x1, y0, y1, z0, z1, noRay = false) { colliders.push({ x0, x1, y0, y1, z0, z1, noRay }); }
/** 以包围范围创建盒体。o: {tex:[su,sv], collide, shadow, map:'#color'} */
function B(x0, x1, y0, y1, z0, z1, mat, o = {}) {
  const w = x1 - x0, h = y1 - y0, d = z1 - z0, tx = o.tex === undefined ? [2, 2] : o.tex;
  const m = new THREE.Mesh(boxGeo(w, h, d, tx && tx[0], tx && tx[1]), mat);
  m.position.set(x0 + w / 2, y0 + h / 2, z0 + d / 2);
  m.castShadow = o.shadow !== false; m.receiveShadow = true; scene.add(m);
  if (o.collide !== false) addCollider(x0, x1, y0, y1, z0, z1);
  if (o.map) mapShapes.push({ x0, x1, z0, z1, c: o.map });
  return m;
}
const sides = (side, top) => [side, side, top || M.roof, top || M.roof, side, side];
function flat(x0, x1, z0, z1, mat, y, s = 2, mapC) {
  const w = x1 - x0, d = z1 - z0, g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / s, uv.getY(i) * d / s);
  const m = new THREE.Mesh(g, mat); m.position.set(x0 + w / 2, y, z0 + d / 2); m.receiveShadow = true; scene.add(m);
  if (mapC) mapShapes.push({ x0, x1, z0, z1, c: mapC });
  return m;
}
function sign(tex, w, h, x, y, z, ry) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std({ map: tex, roughness: .6 }));
  m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); return m;
}
function cyl(r0, r1, h, x, y, z, mat, seg = 16, collide = false) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat); m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; scene.add(m);
  if (collide) addCollider(x - r1, x + r1, y, y + h, z - r1, z + r1);
  return m;
}

// ---------------------------------------------------------------- 植被（实例化）
const trunks = [], blobs = [], footprints = [];
function tree(x, z, kind = 'plane', s = 1) {
  if (kind === 'pine') {
    trunks.push({ x, z, h: 2 * s, r: .22 * s, dark: 1 });
    for (let i = 0; i < 3; i++) blobs.push({ x, y: (2.6 + i * 2.1) * s, z, sx: (2.3 - i * .6) * s, sy: 2.6 * s, sz: (2.3 - i * .6) * s, c: new THREE.Color().setHSL(.33, .35, rr(.16, .22)), cone: 1 });
  } else {
    const h = (kind === 'cherry' ? 2.4 : 5.5) * s, R = (kind === 'cherry' ? 2.6 : 3.4) * s;
    trunks.push({ x, z, h, r: (kind === 'cherry' ? .18 : .32) * s, dark: kind === 'cherry' });
    const n = kind === 'cherry' ? 8 : 10;
    for (let i = 0; i < n; i++) {
      const a = rnd() * 6.28, d = i === 0 ? 0 : rr(.4, 1) * R * .75, c = new THREE.Color();
      if (kind === 'cherry') c.setHSL(rr(.88, .93), rr(.5, .7), rr(.68, .8));
      else if (kind === 'autumn') c.setHSL(rr(.1, .16), rr(.7, .85), rr(.3, .4));
      else c.setHSL(rr(.22, .31), rr(.5, .65), rr(.15, .24));
      const r = rr(.42, .68) * R;
      blobs.push({ x: x + Math.cos(a) * d, y: h + rr(.2, .9) * R, z: z + Math.sin(a) * d, sx: r, sy: r * rr(.65, .85), sz: r, c });
    }
  }
  addCollider(x - .35, x + .35, 0, 4, z - .35, z + .35);
}
function buildTrees() {
  const d = new THREE.Object3D();
  for (const dark of [0, 1]) {
    const list = trunks.filter(t => !!t.dark === !!dark); if (!list.length) continue;
    const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(.75, 1, 1, 8), dark ? M.barkDark : M.bark, list.length);
    list.forEach((t, i) => { d.position.set(t.x, t.h / 2, t.z); d.scale.set(t.r, t.h * 1.25, t.r); d.rotation.set(0, 0, 0); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
    im.castShadow = true; im.receiveShadow = true; scene.add(im);
  }
  const ico = new THREE.SphereGeometry(1, 10, 7), p = ico.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 1 + .16 * Math.sin(p.getX(i) * 5.1 + p.getY(i) * 3.3) * Math.cos(p.getZ(i) * 4.7); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); }
  ico.computeVertexNormals();
  const leafM = std({ color: 0xffffff, roughness: .95 });
  for (const cone of [0, 1]) {
    const list = blobs.filter(b => !!b.cone === !!cone); if (!list.length) continue;
    const im = new THREE.InstancedMesh(cone ? new THREE.ConeGeometry(1, 1, 9) : ico, leafM, list.length);
    list.forEach((b, i) => { d.position.set(b.x, b.y, b.z); d.scale.set(b.sx, b.sy, b.sz); d.rotation.set(0, rnd() * 6, 0); d.updateMatrix(); im.setMatrixAt(i, d.matrix); im.setColorAt(i, b.c); });
    im.castShadow = true; im.receiveShadow = true; scene.add(im);
  }
}
function hedge(x0, x1, z0, z1, h = .9, mat = M.hedge) { B(x0, x1, 0, h, z0, z1, mat, { tex: false }); }
function lamp(x, z) {
  cyl(.07, .1, 4.2, x, 0, z, M.dark, 8); addCollider(x - .15, x + .15, 0, 4, z - .15, z + .15);
  for (let i = 0; i < 5; i++) { const a = i * 1.257, r = i === 4 ? 0 : .45; const m = new THREE.Mesh(new THREE.SphereGeometry(.2, 10, 8), M.lamp); m.position.set(x + Math.cos(a) * r, i === 4 ? 4.5 : 4.1, z + Math.sin(a) * r); scene.add(m); }
}
function bench(x, z, ry = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  const add = (w, h, d, px, py, pz, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(px, py, pz); m.castShadow = m.receiveShadow = true; g.add(m); };
  add(1.8, .08, .5, 0, .45, 0, M.wood); add(1.8, .5, .06, 0, .75, -.25, M.wood); add(.08, .45, .5, -.8, .22, 0, M.dark); add(.08, .45, .5, .8, .22, 0, M.dark);
  const s = Math.abs(Math.sin(ry)) > .5; addCollider(x - (s ? .3 : .9), x + (s ? .3 : .9), 0, .9, z - (s ? .9 : .3), z + (s ? .9 : .3));
}
function car(x, z, color, ry = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  const paint = std({ color, roughness: .25, metalness: .6 });
  const add = (geo, mat, px, py, pz) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  add(new THREE.BoxGeometry(1.8, .6, 4.3), paint, 0, .62, 0); add(new THREE.BoxGeometry(1.6, .55, 2.2), M.curtain, 0, 1.18, -.2); add(new THREE.BoxGeometry(1.62, .06, 2.1), paint, 0, 1.47, -.2);
  for (const sx of [-.85, .85]) for (const sz of [-1.35, 1.35]) add(new THREE.CylinderGeometry(.33, .33, .22, 14), M.dark, sx, .33, sz).rotation.z = Math.PI / 2;
  const s = Math.abs(Math.sin(ry)) > .5; addCollider(x - (s ? 2.15 : .9), x + (s ? 2.15 : .9), 0, 1.5, z - (s ? .9 : 2.15), z + (s ? .9 : 2.15));
}
function scooter(x, z, color, ry) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g); const p = std({ color, roughness: .4 });
  const add = (geo, mat, px, py, pz) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = true; g.add(m); return m; };
  add(new THREE.BoxGeometry(.3, .25, 1.1), p, 0, .42, 0); add(new THREE.BoxGeometry(.32, .12, .5), M.dark, 0, .72, -.25); add(new THREE.BoxGeometry(.1, .7, .1), p, 0, .75, .5); add(new THREE.BoxGeometry(.6, .05, .05), M.dark, 0, 1.1, .5);
  for (const sz of [-.55, .6]) add(new THREE.CylinderGeometry(.22, .22, .1, 12), M.dark, 0, .22, sz).rotation.z = Math.PI / 2;
}
function wedge(x, z, r, a0, len, h, mat) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 28, 1, false, a0, len), mat); m.position.set(x, h / 2, z); m.castShadow = m.receiveShadow = true; scene.add(m); }

// ---------------------------------------------------------------- 地标建筑
function library() { // 图一：巨柱托起的方盒子，前有大广场
  footprints.push([-36, 36, -100, -72]);
  B(-17, 17, 9, 30, -97, -73, sides(M.libTile), { map: '#c9a79a' });                // 悬浮主体
  B(-15, 15, 0, 9, -97, -84, sides(M.libWin), { tex: [4, 3] });                      // 退后的底部
  for (const s of [-1, 1]) {
    B(s > 0 ? 17 : -33, s > 0 ? 33 : -17, 7, 20, -95, -77, sides(M.libTile), { map: '#c9a79a' }); // 两翼
    B(s > 0 ? 15 : -29, s > 0 ? 29 : -15, 0, 7, -97, -86, sides(M.libWin), { tex: [4, 3.5] });
    for (const z of [-75.2, -82.5]) column(s * 15.6, z, 9);
    for (const z of [-78.8, -88]) column(s * 31.4, z, 7);
    // 屋顶白色构架
    B(s > 0 ? 18 : -32, s > 0 ? 32 : -18, 22.4, 22.9, -95, -77.2, M.white, { collide: false, tex: false });
    for (const x of [18.4, 25, 31.6]) B(s * x - .25, s * x + .25, 20, 22.4, -77.7, -77.2, M.white, { collide: false, tex: false });
    B(s > 0 ? 17 : -33, s > 0 ? 33 : -17, 20, 21.2, -95, -94.6, M.libTile, { collide: false });
    // 两侧阳台
    for (const y of [3, 6]) B(s > 0 ? 9 : -15, s > 0 ? 15 : -9, y, y + 1.1, -84, -82.2, M.libTile, { collide: false });
  }
  for (let i = 0; i < 3; i++) B(-8.5 + i * 6.2, -3.9 + i * 6.2, 30, 30.9, -74.6, -72.4, M.white, { collide: false, tex: false }); // 顶部白色挑檐
  B(-13, 13, 8.3, 9, -83.9, -74, M.white, { collide: false, tex: false });           // 门廊吊顶
  B(-9, 9, 0, 3.2, -84.3, -84, M.glassDoor, { collide: false, tex: false, shadow: false });
  sign(T.libSign, 6, 1.1, 0, 4.2, -83.92, 0);
  for (let i = 0; i < 3; i++) B(-12, 12, 0, .15 * (3 - i), -84 + i * .4, -83.6 + i * .4, M.stone, { collide: i === 0 });
  flat(-46, 46, -100, -40, M.paver, .03, 2, '#b8aca6');
  for (const x of [-38, 38]) { hedge(x - 5, x + 5, -68, -66.6); bench(x, -62); }
  for (const x of [-22, 22]) for (const z of [-48, -60]) { B(x - 1.6, x + 1.6, 0, .55, z - 1.6, z + 1.6, M.stone, { tex: [1, 1] }); B(x - 1.35, x + 1.35, .55, 1.15, z - 1.35, z + 1.35, M.hedge, { tex: false }); }
}
function column(x, z, h) {
  B(x - 1.5, x + 1.5, 0, .7, z - 1.5, z + 1.5, std({ color: 0x6d4034, roughness: .4 }), { tex: false });
  B(x - 1.2, x + 1.2, .7, h - .5, z - 1.2, z + 1.2, M.granite, { tex: [1.2, 1.2] });
  B(x - 1.45, x + 1.45, h - .5, h, z - 1.45, z + 1.45, M.granite, { tex: [1.2, 1.2], collide: false });
}
function teaching() { // 图二：红砖教学楼 + 塔楼
  footprints.push([58, 100, -58, 40]);
  B(78, 96, 0, 19.8, -55, 25, sides(M.brickWin), { tex: [4, 3.3], map: '#8e4a3c' });
  B(77.6, 78, 0, 19.8, -22, -10, M.curtain, { tex: [3, 3.3], collide: false });       // 玻璃幕墙段
  B(77.2, 78, 19.8, 20.5, -55, 25, M.white, { collide: false, tex: false });
  B(76, 84, 0, 27, 25, 33, sides(M.brick), { map: '#7c3f33' });                       // 塔楼
  B(77.5, 82.5, 27, 28.6, 26.5, 31.5, M.white, { collide: false, tex: false });
  B(74.8, 85.2, 28.6, 30, 23.8, 34.2, M.stone, { collide: false });                   // 塔顶挑板
  B(75.7, 76, 3, 25, 27.6, 31.4, M.curtain, { tex: [3.8, 3.3], collide: false });
  B(77, 78, 0, 3.4, -20, -12, M.glassDoor, { collide: false, tex: false, shadow: false });
  B(73, 78, 3.5, 3.9, -21, -11, M.white, { collide: false, tex: false });
  for (const z of [-20.5, -11.5]) cyl(.25, .25, 3.5, 73.6, 0, z, M.white, 12, true);
  flat(60, 78, -56, 34, M.paver, .03, 2, '#b8aca6');
  // 弧形花坛（绿篱 + 红叶石楠）与草地
  for (const [x, z, a] of [[50, -34, 0], [50, 6, Math.PI]]) {
    wedge(x, z, 9, a - .2, 3.5, .55, M.hedge); wedge(x, z, 6.6, a, 3.1, .75, M.redShrub);
    addCollider(x - 5.5, x + 5.5, 0, .75, z - 5.5, z + 5.5);
  }
  B(60.5, 77, 0, .4, -52, -24, M.stone, { tex: [1, 1], collide: false }); hedge(61, 76.5, -51.5, -24.5, .9, M.redShrub);
  hedge(61, 76.5, -6, 18);
  for (const [x, z] of [[58, -22], [58, -8], [40, -22], [40, -8], [22, -22], [22, -8]]) lamp(x, z);
  car(66, -15, 0x111418, Math.PI / 2); car(52, -14, 0xe8e8e6, Math.PI / 2 + .25); car(36, -13.2, 0x2b2f38, Math.PI / 2);
  // 后侧附属楼（远景）
  B(100, 114, 0, 12, -100, -70, sides(M.brickWin), { tex: [4, 3.3], map: '#8e4a3c' }); footprints.push([98, 116, -102, -68]);
}
function gifted() { // 图三：少年班学院 — 大台阶、灰色门廊、橙色面砖
  footprints.push([-102, -60, -32, 2]);
  B(-100, -80, 0, 24, -30, 0, sides(M.orangeWin), { tex: [4, 3.4], map: '#c8643a' });
  B(-80, -75.6, 7, 21, -23, -7, sides(M.panel), { tex: [1.6, 1.6], collide: false });     // 前凸灰色体块
  addCollider(-80, -75.6, 7, 21, -23, -7);
  for (let i = 0; i < 4; i++) { const m = sign(T.tallGlass, 3, 7.4, -75.55, 13.4, -20.4 + i * 3.6, Math.PI / 2); m.material = M.tallGlass; }
  sign(T.sgySign, 14.4, 1.8, -75.55, 8.1, -15, Math.PI / 2);
  B(-80, -74, 0, 3.6, -22, -8, M.stone, { tex: [1, 1] });                                  // 平台
  B(-80.2, -80, 3.6, 6.8, -19, -11, M.glassDoor, { collide: false, tex: false, shadow: false });
  for (let i = 0; i < 20; i++) B(-62.6 - i * .6, -62 - i * .6, 0, (i + 1) * .18, -20, -10, M.stone, { tex: [1, 1], shadow: false }); // 台阶
  const slope = Math.atan2(3.6, 12), len = Math.hypot(12, 3.6);
  for (const z of [-20.15, -9.85]) {
    for (let k = 0; k < 4; k++) addCollider(-65 - k * 3, -62 - k * 3, 0, (k + 1) * .9 + 1, z - .15, z + .15, true);
    for (let b = 0; b < 5; b++) { const m = new THREE.Mesh(new THREE.BoxGeometry(len, .06, .06), M.metal); m.position.set(-68, 1.8 + .25 + b * .2, z); m.rotation.z = -slope; m.castShadow = true; scene.add(m); }
    for (let k = 0; k <= 4; k++) B(-62 - k * 3 - .04, -62 - k * 3 + .04, k * .9, k * .9 + 1.15, z - .04, z + .04, M.metal, { collide: false, tex: false });
    B(-80, -74, 3.6, 4.7, z < -15 ? -22 : -8.15, z < -15 ? -21.85 : -8, M.metal, { tex: false, shadow: false });
  }
  B(-74.15, -74, 3.6, 4.7, -22, -20.2, M.metal, { tex: false, shadow: false }); B(-74.15, -74, 3.6, 4.7, -9.8, -8, M.metal, { tex: false, shadow: false });
  B(-61.2, -60, 0, .4, -19.7, -10.3, M.stone, { collide: false, tex: [1, 1] });
  flat(-64, -56, -24, -6, M.paver, .03, 2, '#b8aca6');
  for (const z of [-25, -5]) { tree(-66, z, 'plane', .9); hedge(-73, -62, z - 1.6, z - .6); }
}
function history() { // 图四：校史馆 — 清水混凝土竖肋、暗红门窗、枯藤
  footprints.push([-100, -64, 30, 60]);
  B(-98, -80, 0, 13.2, 33, 57, sides(M.concrete), { tex: [6, 6], map: '#8f8f8a' });
  B(-80, -79.9, 3.6, 13.2, 33, 57, M.histWin, { tex: [3, 3.2], collide: false });
  for (let i = 0; i <= 8; i++) { const z = 33 + i * 3; B(-80, -78.9, i > 2 && i < 6 ? 3.4 : 0, 13.2, z - .45, z + .45, M.concrete, { tex: [6, 6], collide: i < 3 || i > 5 }); }
  B(-80, -78.5, 3.4, 3.9, 33, 57, M.concrete, { tex: [6, 6], collide: false });
  sign(T.histDoor, 17.1, 3.4, -79.92, 1.7, 45, Math.PI / 2);
  for (const z of [41.6, 48.4]) { cyl(.2, .26, .25, -77.6, .3, z, M.dark, 12); const v = new THREE.Mesh(new THREE.LatheGeometry([[.16, 0], [.34, .25], [.42, .7], [.3, 1.2], [.16, 1.55], [.24, 1.75]].map(p => new THREE.Vector2(p[0], p[1])), 16), M.vase); v.position.set(-77.6, .55, z); v.castShadow = true; scene.add(v); addCollider(-78, -77.2, 0, 2.2, z - .4, z + .4); }
  B(-78.9, -76.6, 0, .3, 38, 52, M.stone, { tex: [1, 1], collide: false });
  flat(-80, -64, 34, 56, M.asphalt, .03, 2, '#9c9c9c');
  hedge(-72, -64.6, 51, 56); hedge(-72, -64.6, 34, 39);
  tree(-70, 31, 'plane', .8); tree(-66, 59, 'plane', .9);
}
function gate() { // 图五：白色门楼、红字校名、樱花
  B(-13, 13, 6, 7.7, 98.6, 101.4, M.white, { tex: false, map: '#ece8df' });
  B(-12.6, 12.6, 7.7, 8, 98.9, 101.1, M.hedge, { collide: false, tex: false });
  for (const x of [-10.2, -3.6, 3.6, 10.2]) B(x - 1.3, x + 1.3, 0, 6, 98.8, 101.2, M.white, { tex: false });
  sign(T.gateText, 22, 1.5, 0, 6.85, 101.42, 0); sign(T.gateText, 22, 1.5, 0, 6.85, 98.58, Math.PI);
  for (const s of [-1, 1]) { // 两侧小门的铁丝网
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), M.fence); m.geometry.attributes.uv.array.forEach((v, i, a) => a[i] = v * (i % 2 ? 6 : 8)); m.position.set(s * 6.9, 1.5, 100); scene.add(m);
    addCollider(Math.min(s * 4.9, s * 8.9), Math.max(s * 4.9, s * 8.9), 0, 3, 99.9, 100.1);
  }
  for (const [x, z, s] of [[-17, 93, 1.1], [18, 91, 1], [-23, 86, .9], [24, 97, 1], [-16, 108, 1.2], [19, 110, 1], [-27, 104, .9], [28, 88, .8]]) tree(x, z, 'cherry', s);
  scooter(7.5, 104, 0xd94a8c, .3); scooter(8.6, 104.3, 0x2f8f6a, .1); scooter(-8, 96, 0xc33a2f, 2.6); scooter(9.6, 95.5, 0x3d6fb5, -2.4);
}

// ---------------------------------------------------------------- 入口
export const WORLD = 118;
export function buildWorld(sc) {
  scene = sc; makeMaterials();
  const ground = flat(-400, 400, -400, 400, M.grass, 0, 4); ground.material.map.anisotropy = 4;
  mapShapes.push({ x0: -WORLD, x1: WORLD, z0: -WORLD, z1: WORLD, c: '#5d8442' });
  // 道路与人行道
  flat(-9.5, 9.5, -40, 180, M.walk, .02, 2, '#b3a9a2'); flat(-6, 6, -40, 180, M.asphalt, .04, 3, '#70747a');
  flat(-64, 62, -22, -8, M.walk, .025, 2, '#b3a9a2'); flat(-64, 62, -19, -11, M.asphalt, .045, 3, '#70747a');
  flat(-66, -6, 40, 50, M.walk, .025, 2, '#b3a9a2'); flat(-66, -6, 42, 48, M.asphalt, .045, 3, '#70747a');
  flat(-200, 200, 112, 124, M.asphalt, .035, 3);                       // 校外马路
  library(); teaching(); gifted(); history(); gate();
  // 中央环岛与校训石
  wedge(0, -15, 4.4, 0, 6.283, .45, M.stone); wedge(0, -15, 4, 0, 6.283, .7, M.hedge); wedge(0, -15, 2.6, 0, 6.283, .85, M.flower);
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5, 1), M.stone); rock.scale.set(1.5, 1, .7); rock.position.set(0, 1.9, -15); rock.castShadow = true; scene.add(rock);
  addCollider(-3.6, 3.6, 0, .85, -18.6, -11.4); addCollider(-2, 2, 0, 3.2, -16, -14);
  // 围墙
  const wall = (x0, x1, z0, z1) => { B(x0, x1, 0, .8, z0, z1, M.brick, { collide: false }); B(x0, x1, .8, 2.6, z0, z1, M.fence, { collide: false, tex: [.5, .5], shadow: false }); addCollider(x0, x1, 0, 12, z0, z1, true); };
  wall(-WORLD, -13, 99.8, 100.2); wall(13, WORLD, 99.8, 100.2); wall(-WORLD, WORLD, -WORLD - .2, -WORLD + .2); wall(-WORLD - .2, -WORLD + .2, -WORLD, 100); wall(WORLD - .2, WORLD + .2, -WORLD, 100);
  addCollider(-14, 14, 0, 12, 108, 108.5, true);
  // 行道树：法国梧桐
  for (let z = -34; z <= 92; z += 9) for (const s of [-1, 1]) {
    if (Math.abs(z + 15) < 9 || (s < 0 && Math.abs(z - 45) < 7) || z > 84) continue;
    tree(s * 11.4, z + rr(-.6, .6), rnd() < .45 ? 'autumn' : 'plane', rr(.95, 1.2));
  }
  for (let x = -54; x <= 54; x += 12) { if (Math.abs(x) < 14) continue; for (const z of [-24.5, -5.5]) tree(x + rr(-1, 1), z, rnd() < .5 ? 'autumn' : 'plane', rr(.85, 1.05)); }
  for (let x = -58; x <= -16; x += 10) for (const z of [38, 52]) tree(x, z, 'plane', .9);
  // 长椅、路灯、宣传栏
  for (const z of [70, 52, 25, 5]) { bench(8.2, z, -Math.PI / 2); bench(-8.2, z + 4, Math.PI / 2); lamp(7.2, z - 6); lamp(-7.2, z - 2); }
  for (const [x, z] of [[14, 62], [-15, 20], [15, -30]]) { B(x - 2, x + 2, .6, 2.4, z - .1, z + .1, M.dark, { tex: false }); B(x - 1.85, x + 1.85, .75, 2.25, z - .13, z + .13, std({ color: [0xb33a2a, 0x2e6a9c, 0xd9a03a][Math.abs(x) % 3], roughness: .6 }), { tex: false, collide: false }); }
  // 草地散植 + 灌木掩体
  const blocked = (x, z, m = 5) => footprints.some(f => x > f[0] - m && x < f[1] + m && z > f[2] - m && z < f[3] + m) || Math.abs(x) < 14 || (Math.abs(z + 15) < 12 && Math.abs(x) < 66) || (Math.abs(z - 45) < 10 && x < 0 && x > -70) || (x > -48 && x < 48 && z < -38);
  for (let i = 0, n = 0; i < 900 && n < 64; i++) { const x = rr(-110, 110), z = rr(-110, 94); if (blocked(x, z)) continue; tree(x, z, ['plane', 'autumn', 'plane', 'pine'][n % 4], rr(.8, 1.25)); n++; }
  for (let i = 0, n = 0; i < 400 && n < 16; i++) { const x = rr(-100, 100), z = rr(-100, 90); if (blocked(x, z, 7)) continue; const w = rr(2, 5), d = rr(.8, 1.4), f = rnd() < .5; hedge(x - (f ? w : d), x + (f ? w : d), z - (f ? d : w), z + (f ? d : w), rr(.9, 1.3), rnd() < .3 ? M.redShrub : M.hedge); n++; }
  for (let x = -112; x <= 112; x += 9) { tree(x, -113, 'pine', rr(1, 1.5)); if (Math.abs(x) > 34) tree(x + 3, 110 + rr(-2, 2), 'pine', rr(1, 1.4)); }
  for (let z = -104; z <= 92; z += 10) { tree(-113, z, 'pine', rr(1, 1.5)); tree(113, z, 'pine', rr(1, 1.5)); }
  // 校外远景楼
  for (const [x, z, w, h] of [[-70, 150, 30, 18], [60, 155, 40, 24], [-150, 60, 24, 30], [160, -30, 26, 36], [-40, -160, 50, 22], [70, -165, 36, 30], [-165, -80, 24, 26]]) B(x - w / 2, x + w / 2, 0, h, z - 8, z + 8, sides(M.brickWin), { tex: [4, 3.3], collide: false });
  buildTrees();
  mapShapes.push({ label: '图书馆', x: 0, z: -86 }, { label: '教学楼', x: 87, z: -15 }, { label: '少年班', x: -90, z: -15 }, { label: '校史馆', x: -89, z: 45 }, { label: '南门', x: 0, z: 104 });
}
