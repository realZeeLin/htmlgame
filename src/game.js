// game.js — 大蜀山小龙虾 · 校园行动（第一人称射击）
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildWorld, colliders, mapShapes, addCollider, WORLD, FONT, rnd } from './world.js';

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const R = (a, b) => a + (b - a) * Math.random();
const V3 = THREE.Vector3;
const boot = (p, msg) => { $('#boot-fill').style.width = p + '%'; if (msg) $('#boot-msg').textContent = msg; };
const nextFrame = () => new Promise(r => setTimeout(r, 30));

// ================================================================ 渲染器与场景
const canvas = $('#view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const settings = { vol: .7, sens: 1, q: 'high' };
const COARSE = matchMedia('(pointer: coarse)').matches;
const pxRatio = () => settings.q === 'low' ? Math.min(window.devicePixelRatio || 1, 1.25) : Math.min(window.devicePixelRatio || 1, COARSE ? 1.75 : 2);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .78;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfe3f5, 110, 560);
const camera = new THREE.PerspectiveCamera(72, 1, .06, 1400);
camera.rotation.order = 'YXZ'; scene.add(camera);

const sunDir = new V3(.5, .62, .6).normalize();
const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { sun: { value: sunDir } },
  vertexShader: 'varying vec3 d; void main(){ d = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `varying vec3 d; uniform vec3 sun;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
    void main(){ vec3 n = normalize(d); float h = max(n.y, 0.);
      vec3 c = mix(vec3(.60, .77, .93), vec3(.06, .24, .70), pow(h, .5));
      float s = max(dot(n, sun), 0.); c += vec3(1., .9, .7) * (pow(s, 400.) * 4. + pow(s, 10.) * .16);
      vec2 q = n.xz / (h + .12) * 1.6; float cl = vn(q) * .55 + vn(q * 2.3 + 7.) * .3 + vn(q * 5.1) * .15;
      c = mix(c, vec3(1.), smoothstep(.62, .85, cl) * .75 * smoothstep(.02, .3, h));
      c = mix(c, vec3(.62, .78, .92), smoothstep(.02, -.1, n.y));
      gl_FragColor = vec4(c, 1.);
      #include <colorspace_fragment>
    }` }));
sky.frustumCulled = false;
{
  const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene(); es.add(sky);
  scene.environment = pm.fromScene(es, 0, .1, 1200).texture; scene.environmentIntensity = .45; pm.dispose();
}
scene.add(sky);
const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x6b6a4a, .7); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d8, 3.4);
sun.castShadow = true; sun.shadow.mapSize.setScalar(COARSE ? 2048 : 4096); sun.shadow.bias = -.0004; sun.shadow.normalBias = .06;
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 320 }); sun.shadow.camera.updateProjectionMatrix();
scene.add(sun, sun.target);
// 后期处理：MSAA + 泛光 + 色调映射 + 锐化 / 暗角 / 胶片颗粒
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(4, 4), .3, .55, 1.0));
composer.addPass(new OutputPass());
const finish = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, px: { value: new THREE.Vector2() }, time: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 px; uniform float time; varying vec2 vUv;
    void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb;
      vec3 n = texture2D(tDiffuse, vUv + vec2(px.x, 0.)).rgb + texture2D(tDiffuse, vUv - vec2(px.x, 0.)).rgb + texture2D(tDiffuse, vUv + vec2(0., px.y)).rgb + texture2D(tDiffuse, vUv - vec2(0., px.y)).rgb;
      c = clamp(c + (c - n * .25) * .6, 0., 1.);
      c *= mix(.8, 1., smoothstep(.9, .35, length(vUv - .5)));
      c += (fract(sin(dot(vUv + fract(time), vec2(12.9898, 78.233))) * 43758.5453) - .5) * .014;
      gl_FragColor = vec4(c, 1.); }` });
composer.addPass(finish);
function resize() { const w = window.innerWidth, h = window.innerHeight, r = pxRatio(); renderer.setPixelRatio(r); renderer.setSize(w, h, false); composer.setPixelRatio(r); composer.setSize(w, h); finish.uniforms.px.value.set(1 / (w * r), 1 / (h * r)); camera.aspect = w / h; camera.updateProjectionMatrix(); }
window.addEventListener('resize', resize);

// ================================================================ 音频（合成）
resize();
let AC = null, master = null, noiseBuf = null;
function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = settings.vol; master.connect(AC.destination);
    noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = AC.createBufferSource(); src.buffer = noiseBuf; src.loop = true; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380; const g = AC.createGain(); g.gain.value = .035; src.connect(f).connect(g).connect(master); src.start(); // 风声
  } catch (e) { AC = null; }
}
function sNoise(dur, freq, gain, type = 'lowpass', q = 1) {
  if (!AC) return; const t = AC.currentTime, s = AC.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = R(.8, 1.2);
  const f = AC.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = AC.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  s.connect(f).connect(g).connect(master); s.start(t, Math.random() * .5, dur + .05);
}
function sTone(f0, f1, dur, gain, type = 'sine', delay = 0) {
  if (!AC) return; const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g).connect(master); o.start(t); o.stop(t + dur + .02);
}
const SFX = {
  shot() { sNoise(.16, 2400, .5); sTone(160, 50, .12, .5, 'triangle'); sNoise(.05, 6000, .25, 'highpass'); },
  dry() { sTone(900, 700, .04, .15, 'square'); },
  reload() { sNoise(.05, 3000, .2, 'bandpass', 4); setTimeout(() => sNoise(.06, 1800, .25, 'bandpass', 4), 700); setTimeout(() => { sTone(500, 300, .05, .15, 'square'); sNoise(.05, 4000, .2, 'highpass'); }, 1350); },
  hit() { sTone(1500, 900, .05, .16, 'square'); }, weak() { sTone(2200, 1200, .09, .2, 'square'); },
  zap(v) { sTone(900, 200, .2, .14 * v, 'sawtooth'); },
  boom(v) { sNoise(.6, 700, .7 * v); sTone(110, 30, .45, .6 * v, 'sine'); },
  hurt() { sNoise(.18, 500, .5); sTone(140, 70, .2, .4, 'sawtooth'); },
  bark(v) { sTone(260, 120, .12, .2 * v, 'sawtooth'); sNoise(.1, 900, .15 * v, 'bandpass', 3); },
  step() { sNoise(.07, R(280, 420), .09); },
  pick() { sTone(700, 1100, .1, .2, 'triangle'); sTone(1100, 1500, .12, .16, 'triangle', .08); },
  relay() { sTone(320, 60, .9, .4, 'sawtooth'); sNoise(.5, 3000, .3, 'highpass'); sTone(880, 1320, .25, .2, 'triangle', .5); },
  radio() { sNoise(.09, 2600, .12, 'bandpass', 6); sTone(1250, 1250, .06, .08, 'square', .08); },
  win() { [523, 659, 784, 1047].forEach((f, i) => sTone(f, f, .5, .22, 'triangle', i * .14)); },
  tick() { sTone(1000, 1000, .03, .07, 'square'); },
};

// ================================================================ 碰撞与导航
const PR = .4;
function supportY(x, z, feet) { let h = 0; for (const c of colliders) if (x >= c.x0 - 1e-6 && x <= c.x1 + 1e-6 && z >= c.z0 - 1e-6 && z <= c.z1 + 1e-6 && c.y1 <= feet + .62 && c.y1 > h && !c.noRay) h = c.y1; return h; }
function collide(p, r, feet, height) {
  for (let it = 0; it < 2; it++) for (const c of colliders) {
    if (c.y0 >= feet + height || c.y1 <= feet + .62) continue;
    const cx = clamp(p.x, c.x0, c.x1), cz = clamp(p.z, c.z0, c.z1); let dx = p.x - cx, dz = p.z - cz; const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
    else { const l = p.x - c.x0, rr = c.x1 - p.x, n = p.z - c.z0, f = c.z1 - p.z, m = Math.min(l, rr, n, f); if (m === l) p.x = c.x0 - r; else if (m === rr) p.x = c.x1 + r; else if (m === n) p.z = c.z0 - r; else p.z = c.z1 + r; }
  }
}
/** 射线与所有盒体求交，返回最近距离（含地面） */
function rayWorld(o, d, max, hitNoRay = false) {
  let best = max; if (d.y < -1e-5) { const t = -o.y / d.y; if (t > 0 && t < best) best = t; }
  for (const c of colliders) {
    if (c.noRay && !hitNoRay) continue;
    let t0 = 0, t1 = best, ok = true;
    for (const [a, lo, hi] of [[0, c.x0, c.x1], [1, c.y0, c.y1], [2, c.z0, c.z1]]) {
      const oo = a === 0 ? o.x : a === 1 ? o.y : o.z, dd = a === 0 ? d.x : a === 1 ? d.y : d.z;
      if (Math.abs(dd) < 1e-9) { if (oo < lo || oo > hi) { ok = false; break; } continue; }
      let ta = (lo - oo) / dd, tb = (hi - oo) / dd; if (ta > tb) { const s = ta; ta = tb; tb = s; }
      if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) { ok = false; break; }
    }
    if (ok && t0 < best) best = t0;
  }
  return best;
}
const _d = new V3();
function los(a, b) { _d.subVectors(b, a); const L = _d.length(); _d.multiplyScalar(1 / L); return rayWorld(a, _d, L) >= L - .05; }

const NG = 120, CELL = 2, navH = new Float32Array(NG * NG).fill(-1), navD = new Int16Array(NG * NG);
const cellOf = (x, z) => { const i = Math.floor((x + 120) / CELL), j = Math.floor((z + 120) / CELL); return i < 0 || j < 0 || i >= NG || j >= NG ? -1 : j * NG + i; };
const cellX = (c) => (c % NG) * CELL - 120 + 1, cellZ = (c) => Math.floor(c / NG) * CELL - 120 + 1;
function navBlocked(x, z, h) { for (const c of colliders) if (c.y0 < h + 1.3 && c.y1 > h + .62 && x > c.x0 - .55 && x < c.x1 + .55 && z > c.z0 - .55 && z < c.z1 + .55) return true; return false; }
const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const navE = new Uint8Array(NG * NG); // 每格 8 个方向的可通行位
function buildNav() { // 从出生点洪泛，记录每格可行走高度；相邻格之间的中点也必须畅通（防止穿过栏杆等薄障碍）
  const q = [cellOf(0, 90)]; navH[q[0]] = 0;
  for (let k = 0; k < q.length; k++) {
    const c = q[k], i = c % NG, j = (c / NG) | 0, h = navH[c];
    for (let n = 0; n < 4; n++) { const a = i + NB[n][0], b = j + NB[n][1]; if (a < 0 || b < 0 || a >= NG || b >= NG) continue; const m = b * NG + a; if (navH[m] >= 0) continue; const x = cellX(m), z = cellZ(m), nh = supportY(x, z, h); if (Math.abs(nh - h) > .75 || navBlocked(x, z, nh) || navBlocked((x + cellX(c)) / 2, (z + cellZ(c)) / 2, Math.max(h, nh))) continue; navH[m] = nh; q.push(m); }
  }
  const ok = (c, i, j, n) => { const a = i + NB[n][0], b = j + NB[n][1]; if (a < 0 || b < 0 || a >= NG || b >= NG) return false; const m = b * NG + a; return navH[m] >= 0 && Math.abs(navH[m] - navH[c]) <= .75 && !navBlocked((cellX(m) + cellX(c)) / 2, (cellZ(m) + cellZ(c)) / 2, Math.max(navH[m], navH[c])); };
  for (let c = 0; c < NG * NG; c++) { if (navH[c] < 0) continue; const i = c % NG, j = (c / NG) | 0; let bits = 0; for (let n = 0; n < 4; n++) if (ok(c, i, j, n)) bits |= 1 << n; navE[c] = bits; }
  for (let c = 0; c < NG * NG; c++) { if (navH[c] < 0) continue; const i = c % NG, j = (c / NG) | 0; for (let n = 4; n < 8; n++) { const dx = NB[n][0], dz = NB[n][1], bx = dx > 0 ? 0 : 1, bz = dz > 0 ? 2 : 3; if ((navE[c] >> bx & 1) && (navE[c] >> bz & 1) && (navE[c + dx] >> bz & 1) && (navE[c + dz * NG] >> bx & 1) && ok(c, i, j, n)) navE[c] |= 1 << n; } }
}
const navQ = new Int32Array(NG * NG);
function flow(px, pz) {
  let s = cellOf(px, pz); if (s < 0) return;
  if (navH[s] < 0 || Math.abs(navH[s] - P.pos.y) > 1.2) { let best = -1, bd = 1e9; for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) { const m = s + dj * NG + di; if (m >= 0 && m < NG * NG && navH[m] >= 0) { const d = di * di + dj * dj + Math.abs(navH[m] - P.pos.y) * 4; if (d < bd) { bd = d; best = m; } } } if (best < 0) return; s = best; }
  navD.fill(32000); navD[s] = 0; let head = 0, tail = 0; navQ[tail++] = s;
  while (head < tail) { const c = navQ[head++], d = navD[c] + 1, e = navE[c]; for (let n = 0; n < 4; n++) { if (!(e >> n & 1)) continue; const m = c + NB[n][1] * NG + NB[n][0]; if (navD[m] <= d) continue; navD[m] = d; navQ[tail++] = m; } }
}

// ================================================================ 粒子 / 特效池
function makePoints(n, size, color, blending = THREE.AdditiveBlending) {
  const g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3).fill(-999); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ size, color, transparent: true, depthWrite: false, blending, sizeAttenuation: true, fog: false });
  const p = new THREE.Points(g, m); p.frustumCulled = false; scene.add(p);
  return { p, pos, vel: new Float32Array(n * 3), life: new Float32Array(n), n, i: 0 };
}
const sparks = makePoints(500, .07, 0xffc070), smoke = makePoints(260, .7, 0x555555, THREE.NormalBlending); smoke.p.material.opacity = .5;
const dust = makePoints(200, .16, 0xd8d0c0, THREE.NormalBlending);
function emit(ps, x, y, z, n, speed, life, up = 0) { for (let k = 0; k < n; k++) { const i = ps.i = (ps.i + 1) % ps.n; ps.pos[i * 3] = x; ps.pos[i * 3 + 1] = y; ps.pos[i * 3 + 2] = z; const a = Math.random() * 6.283, b = Math.acos(R(-1, 1)), s = speed * R(.3, 1); ps.vel[i * 3] = Math.sin(b) * Math.cos(a) * s; ps.vel[i * 3 + 1] = Math.cos(b) * s + up; ps.vel[i * 3 + 2] = Math.sin(b) * Math.sin(a) * s; ps.life[i] = life * R(.5, 1); } }
function stepPoints(ps, dt, grav, drag) { for (let i = 0; i < ps.n; i++) { if (ps.life[i] <= 0) continue; ps.life[i] -= dt; if (ps.life[i] <= 0) { ps.pos[i * 3 + 1] = -999; continue; } ps.vel[i * 3 + 1] -= grav * dt; const k = 1 - drag * dt; for (let a = 0; a < 3; a++) { ps.vel[i * 3 + a] *= k; ps.pos[i * 3 + a] += ps.vel[i * 3 + a] * dt; } if (ps.pos[i * 3 + 1] < .03 && grav > 0) { ps.pos[i * 3 + 1] = .03; ps.vel[i * 3 + 1] *= -.3; } } ps.p.geometry.attributes.position.needsUpdate = true; }
// 樱花花瓣（校门附近飘落）
const petals = makePoints(420, .07, 0xffc4dc, THREE.NormalBlending); petals.p.material.opacity = .95;
for (let i = 0; i < petals.n; i++) { petals.pos[i * 3] = R(-34, 34); petals.pos[i * 3 + 1] = R(0, 9); petals.pos[i * 3 + 2] = R(78, 116); petals.life[i] = Math.random() * 6.28; }
function stepPetals(dt, t) { for (let i = 0; i < petals.n; i++) { const ph = petals.life[i]; petals.pos[i * 3] += (Math.sin(t * .9 + ph) * .7 + .35) * dt; petals.pos[i * 3 + 2] += Math.cos(t * .7 + ph * 2) * .5 * dt; petals.pos[i * 3 + 1] -= (.55 + (ph % 1) * .5) * dt; if (petals.pos[i * 3 + 1] < .02) { petals.pos[i * 3] = R(-34, 34); petals.pos[i * 3 + 1] = R(5, 9); petals.pos[i * 3 + 2] = R(78, 116); } } petals.p.geometry.attributes.position.needsUpdate = true; }

const tracers = []; { const g = new THREE.BoxGeometry(.025, .025, 1); g.translate(0, 0, .5); for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); m.visible = false; scene.add(m); tracers.push({ m, t: 0 }); } }
let tracerI = 0;
function tracer(a, b) { const tr = tracers[tracerI = (tracerI + 1) % tracers.length]; tr.m.position.copy(a); tr.m.lookAt(b); tr.m.scale.z = a.distanceTo(b); tr.m.visible = true; tr.t = .07; }
const flashLight = new THREE.PointLight(0xffb060, 0, 14, 2); scene.add(flashLight);
const boomLight = new THREE.PointLight(0xff8040, 0, 26, 2); scene.add(boomLight);
function explode(p, big = 1) { emit(sparks, p.x, p.y, p.z, 46 * big, 9, .8, 2); emit(smoke, p.x, p.y, p.z, 14 * big, 2.2, 1.6, 1.2); boomLight.position.copy(p); boomLight.intensity = 60; const d = p.distanceTo(camera.position); SFX.boom(clamp(1.4 - d / 50, .15, 1)); if (d < 14) shake = Math.max(shake, .35 * (1 - d / 14)); }

// ================================================================ 武器模型
const gun = new THREE.Group(); camera.add(gun);
const muzzle = new THREE.Object3D(); let flashMesh;
{
  const dk = new THREE.MeshStandardMaterial({ color: 0x23272b, roughness: .45, metalness: .7 }), poly = new THREE.MeshStandardMaterial({ color: 0x3a3f36, roughness: .75, metalness: .1 }), acc = new THREE.MeshStandardMaterial({ color: 0xc9682a, roughness: .5 });
  const add = (geo, mat, x, y, z, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.x = rx; gun.add(m); return m; };
  add(new THREE.BoxGeometry(.055, .085, .34), dk, 0, 0, 0);                       // 机匣
  add(new THREE.BoxGeometry(.06, .07, .3), poly, 0, -.005, -.31);                 // 护木
  add(new THREE.CylinderGeometry(.013, .013, .3, 10), dk, 0, .008, -.58, Math.PI / 2); // 枪管
  add(new THREE.CylinderGeometry(.02, .02, .08, 10), dk, 0, .008, -.74, Math.PI / 2);  // 消焰器
  add(new THREE.BoxGeometry(.04, .17, .065), dk, 0, -.12, -.06, .22);             // 弹匣
  add(new THREE.BoxGeometry(.04, .11, .05), poly, 0, -.09, .12, -.3);             // 握把
  add(new THREE.BoxGeometry(.05, .075, .26), poly, 0, -.012, .3);                 // 枪托
  add(new THREE.BoxGeometry(.035, .02, .3), dk, 0, .052, -.05);                   // 导轨
  add(new THREE.BoxGeometry(.05, .012, .05), acc, 0, .04, -.4);
  const ring = add(new THREE.TorusGeometry(.024, .005, 8, 20), dk, 0, .092, -.02); ring.scale.z = 4;
  add(new THREE.BoxGeometry(.012, .03, .05), dk, 0, .064, -.02);
  const dot = add(new THREE.CircleGeometry(.0028, 10), new THREE.MeshBasicMaterial({ color: 0xff3020, fog: false }), 0, .092, -.03);
  dot.material.depthTest = false; dot.renderOrder = 10;
  muzzle.position.set(0, .008, -.8); gun.add(muzzle);
  const ft = document.createElement('canvas'); ft.width = ft.height = 64; const fg = ft.getContext('2d'); const gr = fg.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, '#fff'); gr.addColorStop(.3, 'rgba(255,200,90,.9)'); gr.addColorStop(1, 'rgba(255,120,20,0)'); fg.fillStyle = gr; fg.fillRect(0, 0, 64, 64);
  flashMesh = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(ft), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false })); flashMesh.scale.setScalar(.22); flashMesh.visible = false; muzzle.add(flashMesh);
  gun.traverse(o => { if (o.isMesh) o.frustumCulled = false; }); gun.scale.setScalar(.6);
}
const HIP = new V3(.11, -.105, -.32), ADS = new V3(0, -.0552, -.15);

// ================================================================ 游戏状态
const P = { pos: new V3(0, 0, 90), vy: 0, yaw: 0, pitch: 0, hp: 100, ground: true, crouch: 0, eye: 1.65, lastHurt: -99, mag: 30, reserve: 150, reload: 0, cool: 0, ads: 0, recoil: 0, bob: 0, stepT: 0, kick: new THREE.Vector2() };
const G = { state: 'boot', t: 0, time: 0, shots: 0, hits: 0, kills: 0, cut: 0, evac: false, retries: 0 };
let shake = 0, lastFlow = 0;
const keys = {}, input = { fire: false, ads: false, use: false, mx: 0, mz: 0, sprint: false, jump: false, crouch: false };
const enemies = [], bolts = [], pickups = [], relays = [];
const eyePos = new V3(), fwd = new V3(), tmp = new V3(), tmp2 = new V3();

// ---------------------------------------------------------------- 信号中继
const RELAY_DEF = [{ n: '甲', name: '图书馆', x: 0, y: 0, z: -78.5 }, { n: '乙', name: '少年班学院', x: -77.4, y: 3.6, z: -15 }, { n: '丙', name: '校史馆', x: -73.5, y: 0, z: 45 }];
const EVAC = new V3(0, 0, 103);
let evacBeam;
function buildRelays() {
  const dk = new THREE.MeshStandardMaterial({ color: 0x2b3036, roughness: .4, metalness: .7 }), ye = new THREE.MeshStandardMaterial({ color: 0xd9a020, roughness: .5 });
  for (const d of RELAY_DEF) {
    const g = new THREE.Group(); g.position.set(d.x, d.y, d.z); scene.add(g);
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
    add(new THREE.BoxGeometry(.9, 1.3, .6), dk, 0, .65, 0); add(new THREE.BoxGeometry(.94, .12, .64), ye, 0, 1.1, 0); add(new THREE.CylinderGeometry(.04, .05, 2.4, 8), dk, 0, 2.5, 0);
    const dish = add(new THREE.SphereGeometry(.42, 16, 8, 0, 6.283, 0, 1.1), dk, 0, 3.6, 0); dish.rotation.x = Math.PI * .62;
    const led = add(new THREE.BoxGeometry(.5, .16, .02), new THREE.MeshBasicMaterial({ color: 0xff7a20 }), 0, .8, .31);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 60, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xff8a30, transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); beam.position.y = 33.6; g.add(beam);
    const light = new THREE.PointLight(0xff8030, 8, 9, 2); light.position.y = 1.6; g.add(light);
    addCollider(d.x - .5, d.x + .5, d.y, d.y + 1.3, d.z - .35, d.z + .35);
    relays.push({ d, g, dish, led, beam, light, cut: false, prog: 0, pos: new V3(d.x, d.y + 1, d.z) });
  }
  evacBeam = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 30, 28, 1, true), new THREE.MeshBasicMaterial({ color: 0x50ff90, transparent: true, opacity: .1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  evacBeam.position.set(EVAC.x, 15, EVAC.z); evacBeam.visible = false; scene.add(evacBeam);
}

// ---------------------------------------------------------------- 敌人
const EM = {};
function enemyAssets() {
  EM.hull = new THREE.MeshStandardMaterial({ color: 0x30353b, roughness: .35, metalness: .8 }); EM.warn = new THREE.MeshStandardMaterial({ color: 0xd9741e, roughness: .5, metalness: .3 });
  EM.eye = new THREE.MeshBasicMaterial({ fog: false }); EM.eye.color.setRGB(5, .35, .2); EM.rotor = new THREE.MeshBasicMaterial({ color: 0x9aa4ae, transparent: true, opacity: .35, depthWrite: false });
  EM.bolt = new THREE.MeshBasicMaterial({ fog: false }); EM.bolt.color.setRGB(6, 1.2, .5);
  EM.gBody = new THREE.SphereGeometry(.42, 16, 10); EM.gEye = new THREE.SphereGeometry(.12, 10, 8); EM.gArm = new THREE.BoxGeometry(1.5, .05, .08); EM.gRotor = new THREE.CylinderGeometry(.34, .34, .02, 16); EM.gBarrel = new THREE.CylinderGeometry(.04, .04, .4, 8);
  EM.gTorso = new THREE.BoxGeometry(.46, .42, 1.1); EM.gHead = new THREE.BoxGeometry(.3, .28, .42); EM.gLeg = new THREE.BoxGeometry(.11, .62, .13); EM.gVisor = new THREE.BoxGeometry(.24, .07, .03); EM.gBolt = new THREE.SphereGeometry(.13, 8, 6);
}
function spawnEnemy(type, x, z, alert = false) {
  const g = new THREE.Group(), e = { type, g, hp: type === 'drone' ? 45 : 80, pos: new V3(x, 0, z), vel: new V3(), alert, home: new V3(x, 0, z), t: Math.random() * 10, fire: R(1, 2.5), parts: [], wander: new V3(x, 0, z), alive: true, hitT: 0, orbit: Math.random() * 6.28, dir: Math.random() < .5 ? 1 : -1 };
  const add = (geo, mat, px, py, pz, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = true; parent.add(m); return m; };
  if (type === 'drone') {
    add(EM.gBody, EM.hull, 0, 0, 0).scale.set(1, .55, 1.15); add(EM.gEye, EM.eye, 0, -.02, .43); add(EM.gBarrel, EM.hull, 0, -.22, .25).rotation.x = Math.PI / 2; add(EM.gBody, EM.warn, 0, .12, -.1).scale.set(.6, .3, .7);
    for (const r of [.785, -.785]) add(EM.gArm, EM.hull, 0, .05, 0).rotation.y = r;
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) e.parts.push(add(EM.gRotor, EM.rotor, sx * .53, .12, sz * .53));
    e.pos.y = supportY(x, z, 50) + R(5, 7); e.r = .62;
  } else {
    add(EM.gTorso, EM.hull, 0, .78, 0); add(new THREE.BoxGeometry(.48, .1, .5), EM.warn, 0, 1.0, -.1); add(EM.gHead, EM.hull, 0, .95, .68); add(EM.gVisor, EM.eye, 0, .98, .9);
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { const leg = new THREE.Group(); leg.position.set(sx * .22, .62, sz * .4); g.add(leg); add(EM.gLeg, EM.hull, 0, -.31, 0, leg); e.parts.push(leg); }
    e.r = .6;
  }
  g.position.copy(e.pos); scene.add(g); enemies.push(e); return e;
}
const SPAWNS = [[0, -36], [50, -15], [-50, -15], [-40, 45], [0, 40], [0, 70], [60, 20], [40, -50], [-40, -50], [-56, 20], [30, 60], [-30, 80], [66, -40], [0, 0]];
function wave(nd, ng) {
  const pts = SPAWNS.map(s => ({ s, d: Math.hypot(s[0] - P.pos.x, s[1] - P.pos.z) })).filter(o => o.d > 34 && o.d < 120).sort((a, b) => a.d - b.d).slice(0, 5);
  for (let i = 0; i < nd + ng; i++) { const s = pts[i % pts.length].s; spawnEnemy(i < nd ? 'drone' : 'dog', s[0] + R(-3, 3), s[1] + R(-3, 3), true); }
  for (const e of enemies) e.alert = true;
  $('#warn').textContent = `发现敌情 · 机械守卫 ×${nd + ng}`; $('#warn').classList.add('on'); setTimeout(() => $('#warn').classList.remove('on'), 3500);
}
function damageEnemy(e, dmg, at) {
  e.hp -= dmg; e.alert = true; e.hitT = .12; emit(sparks, at.x, at.y, at.z, 7, 5, .35);
  for (const o of enemies) if (o.pos.distanceToSquared(e.pos) < 900) o.alert = true;
  if (e.hp <= 0 && e.alive) {
    e.alive = false; scene.remove(e.g); enemies.splice(enemies.indexOf(e), 1); G.kills++;
    tmp.copy(e.pos); if (e.type === 'dog') tmp.y += .7; explode(tmp);
    feed(e.type === 'drone' ? '机械无人机 已摧毁' : '机械巡逻犬 已摧毁');
    const r = Math.random(); if (r < .4) spawnPickup('ammo', e.pos.x, supportY(e.pos.x, e.pos.z, e.pos.y + .5), e.pos.z, 30); else if (r < .58) spawnPickup('med', e.pos.x, supportY(e.pos.x, e.pos.z, e.pos.y + .5), e.pos.z, 30);
  }
}
function hurt(dmg, from) {
  if (G.state !== 'play') return;
  P.hp -= dmg; P.lastHurt = G.t; shake = Math.max(shake, .25); SFX.hurt();
  const el = $('#dmg'); if (from) { const a = Math.atan2(from.x - P.pos.x, -(from.z - P.pos.z)) - (-P.yaw); el.style.transform = `rotate(${a}rad)`; } el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  if (P.hp <= 0) { P.hp = 0; endGame(false); }
}
function fireBolt(e) {
  tmp.set(0, -.2, .3).applyQuaternion(e.g.quaternion).add(e.pos);
  const dist = tmp.distanceTo(eyePos), lead = dist / 30;
  tmp2.copy(eyePos); tmp2.y -= .35; tmp2.x += pvel.x * lead * .6 + R(-1, 1) * dist * .045; tmp2.z += pvel.z * lead * .6 + R(-1, 1) * dist * .045; tmp2.y += R(-1, 1) * dist * .02;
  const m = new THREE.Mesh(EM.gBolt, EM.bolt); m.position.copy(tmp); scene.add(m);
  bolts.push({ m, v: tmp2.sub(tmp).normalize().multiplyScalar(30), life: 3 }); SFX.zap(clamp(1.3 - dist / 45, .1, 1));
}
const pvel = new V3();
function updateEnemies(dt) {
  for (let k = enemies.length - 1; k >= 0; k--) {
    const e = enemies[k]; e.t += dt; if (e.hitT > 0) e.hitT -= dt;
    const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z, dist = Math.hypot(dx, dz);
    if (!e.alert && dist < 34 && (dist < 9 || los(tmp.copy(e.pos).setY(e.pos.y + (e.type === 'dog' ? .9 : 0)), eyePos))) { e.alert = true; for (const o of enemies) if (o.pos.distanceToSquared(e.pos) < 500) o.alert = true; }
    if (e.type === 'drone') {
      for (const r of e.parts) r.rotation.y += dt * 50;
      let tx, ty, tz;
      if (e.alert) { e.orbit += dt * .35 * e.dir; const rad = 11 + Math.sin(e.t * .7) * 3; tx = P.pos.x + Math.cos(e.orbit) * rad; tz = P.pos.z + Math.sin(e.orbit) * rad; ty = P.pos.y + 4.2 + Math.sin(e.t * 1.3) * 1.2; }
      else { tx = e.home.x + Math.cos(e.t * .4) * 6; tz = e.home.z + Math.sin(e.t * .4) * 6; ty = e.pos.y + Math.sin(e.t) * .02; }
      const gh = supportY(e.pos.x, e.pos.z, 99); if (ty < gh + 2.5) ty = gh + 2.5;
      tmp.set(tx - e.pos.x, ty - e.pos.y, tz - e.pos.z); const L = tmp.length(); if (L > .01) tmp.multiplyScalar(Math.min(L, 1) / L * (e.alert ? 9 : 2.5));
      e.vel.lerp(tmp, 1 - Math.exp(-2.2 * dt));
      for (const o of enemies) if (o !== e && o.type === 'drone') { const d2 = o.pos.distanceToSquared(e.pos); if (d2 < 9 && d2 > .01) e.vel.addScaledVector(tmp2.subVectors(e.pos, o.pos), dt * 3 / d2); }
      e.pos.addScaledVector(e.vel, dt); e.pos.x = clamp(e.pos.x, -WORLD, WORLD); e.pos.z = clamp(e.pos.z, -WORLD, 112);
      e.g.position.copy(e.pos); e.g.position.y += Math.sin(e.t * 3) * .08;
      if (e.alert) { e.g.lookAt(eyePos); e.fire -= dt; if (e.fire <= 0 && dist < 46) { if (los(e.pos, eyePos)) { fireBolt(e); e.fire = R(1.8, 3.2); } else e.fire = .4; } }
      else e.g.rotation.y = Math.atan2(e.vel.x, e.vel.z);
      e.g.rotation.z = -e.vel.x * .02;
    } else {
      let mx = 0, mz = 0, speed = 0;
      if (e.alert) {
        speed = 6.4;
        const c = cellOf(e.pos.x, e.pos.z), dy = Math.abs(P.pos.y - e.pos.y);
        if (dist < 5 && dy < 1.2 || c < 0 || navH[c] < 0) { mx = dx; mz = dz; }
        else { let bd = navD[c], bc = -1; for (let n = 0; n < 8; n++) { if (!(navE[c] >> n & 1)) continue; const m = c + NB[n][1] * NG + NB[n][0]; if (navD[m] < bd) { bd = navD[m]; bc = m; } } if (bc >= 0) { mx = cellX(bc) - e.pos.x; mz = cellZ(bc) - e.pos.z; } else { mx = dx; mz = dz; } }
        if (dist < 1.7 && Math.abs(P.pos.y - e.pos.y) < 1.5) { speed = 0; e.fire -= dt; if (e.fire <= 0) { e.fire = .9; hurt(10, e.pos); SFX.bark(1); e.lunge = .25; } } else if (e.fire > .5) e.fire = .5;
        if (Math.random() < dt * .25) SFX.bark(clamp(1 - dist / 40, 0, .7));
      } else { if (e.wander.distanceToSquared(e.pos) < 2 || Math.random() < dt * .1) e.wander.set(e.home.x + R(-8, 8), 0, e.home.z + R(-8, 8)); mx = e.wander.x - e.pos.x; mz = e.wander.z - e.pos.z; speed = 1.6; }
      const L = Math.hypot(mx, mz) || 1; tmp.set(mx / L * speed, 0, mz / L * speed); e.vel.lerp(tmp, 1 - Math.exp(-8 * dt));
      for (const o of enemies) if (o !== e && o.type === 'dog') { const ox = e.pos.x - o.pos.x, oz = e.pos.z - o.pos.z, d2 = ox * ox + oz * oz; if (d2 < 1.6 && d2 > .001) { e.vel.x += ox / d2 * dt * 8; e.vel.z += oz / d2 * dt * 8; } }
      e.pos.x += e.vel.x * dt; e.pos.z += e.vel.z * dt; collide(e.pos, .45, e.pos.y, 1.1);
      const gy = supportY(e.pos.x, e.pos.z, e.pos.y); e.pos.y = gy > e.pos.y ? gy : Math.max(gy, e.pos.y - 12 * dt);
      const sp = Math.hypot(e.vel.x, e.vel.z); e.g.position.copy(e.pos);
      if (sp > .2) { const want = Math.atan2(e.vel.x, e.vel.z); let d = want - e.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); e.g.rotation.y += d * Math.min(1, dt * 10); }
      const ph = e.t * (2 + sp * 2.2); e.parts.forEach((leg, i) => leg.rotation.x = Math.sin(ph + (i === 0 || i === 3 ? 0 : Math.PI)) * Math.min(.9, sp * .16));
      if (e.lunge > 0) { e.lunge -= dt; e.g.position.y += Math.sin(e.lunge * 12.5) * .25; }
    }
    e.g.scale.setScalar(e.hitT > 0 ? 1.08 : 1);
  }
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i], step = b.v.length() * dt; tmp.copy(b.v).normalize(); b.life -= dt;
    const tw = rayWorld(b.m.position, tmp, step);
    tmp2.set(P.pos.x, P.pos.y + P.eye * .6, P.pos.z).sub(b.m.position); const along = clamp(tmp2.dot(tmp), 0, step), d2 = tmp2.addScaledVector(tmp, -along).lengthSq();
    let dead = b.life <= 0;
    if (d2 < .5 && along <= tw) { hurt(7, b.m.position); dead = true; }
    else if (tw < step) { b.m.position.addScaledVector(tmp, tw); emit(sparks, b.m.position.x, b.m.position.y, b.m.position.z, 6, 4, .3); dead = true; }
    else b.m.position.addScaledVector(tmp, step);
    if (dead) { scene.remove(b.m); bolts.splice(i, 1); }
  }
}

// ---------------------------------------------------------------- 补给
const PKM = {};
function spawnPickup(kind, x, y, z, amount) {
  if (!PKM.g) { PKM.g = new THREE.BoxGeometry(.5, .32, .34); PKM.ammo = new THREE.MeshStandardMaterial({ color: 0x4a5a34, roughness: .6, emissive: 0xd9a020, emissiveIntensity: .35 }); PKM.med = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: .5, emissive: 0xff3030, emissiveIntensity: .45 }); }
  const m = new THREE.Mesh(PKM.g, PKM[kind]); m.position.set(x, y + .5, z); m.castShadow = true; scene.add(m); pickups.push({ kind, m, amount, y: y + .5 });
}
function updatePickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i]; p.m.rotation.y += dt * 1.5; p.m.position.y = p.y + Math.sin(G.t * 3 + i) * .08;
    if (Math.hypot(p.m.position.x - P.pos.x, p.m.position.z - P.pos.z) < 1.4 && Math.abs(p.y - P.pos.y) < 2) {
      if (p.kind === 'ammo') { if (P.reserve >= 300) continue; P.reserve = Math.min(300, P.reserve + p.amount); msg(`弹药 +${p.amount}`); } else { if (P.hp >= 100) continue; P.hp = Math.min(100, P.hp + p.amount); msg(`生命 +${p.amount}`); }
      SFX.pick(); scene.remove(p.m); pickups.splice(i, 1);
    }
  }
}

// ================================================================ HUD
let msgT = 0; function msg(s) { const el = $('#msg'); el.textContent = s; el.classList.add('on'); msgT = 2.2; }
function feed(s) { const el = document.createElement('div'); el.textContent = s; $('#feed').prepend(el); while ($('#feed').children.length > 4) $('#feed').lastChild.remove(); setTimeout(() => el.remove(), 3500); }
const radioQ = []; let radioT = 0;
function radio(s) { radioQ.push(s); }
function updateRadio(dt) { radioT -= dt; const el = $('#radio'); if (radioT <= 0) { if (radioQ.length) { el.querySelector('p').textContent = radioQ.shift(); el.classList.add('on'); radioT = 6; SFX.radio(); } else el.classList.remove('on'); } }
function objective() { $('#obj-text').textContent = G.evac ? '前往南门撤离点' : `关闭校园内三处信号中继`; $('#obj-pips').innerHTML = relays.map(r => `<i class="${r.cut ? 'done' : ''}">${r.d.n} · ${r.d.name}</i>`).join('') + (G.evac ? '<i class="go">撤离 · 南门</i>' : ''); }
const marks = [];
function buildMarks() { for (let i = 0; i < 4; i++) { const el = document.createElement('div'); el.className = 'mark'; el.innerHTML = '<b></b><span></span>'; $('#marks').appendChild(el); marks.push(el); } }
function updateMarks() {
  const W = window.innerWidth, H = window.innerHeight;
  marks.forEach((el, i) => {
    const r = relays[i], on = i < 3 ? !r.cut && !G.evac : G.evac; if (!on) { el.style.display = 'none'; return; }
    tmp.copy(i < 3 ? r.pos : EVAC); tmp.y += i < 3 ? 2.2 : 3; const dist = tmp.distanceTo(camera.position); tmp.project(camera);
    let x = (tmp.x * .5 + .5) * W, y = (-tmp.y * .5 + .5) * H; const behind = tmp.z > 1;
    if (behind) { x = W - x; y = H - 60; } x = clamp(x, 40, W - 40); y = clamp(y, 70, H - 110);
    el.style.display = ''; el.style.transform = `translate(${x}px,${y}px)`; el.classList.toggle('go', i === 3); el.lastChild.textContent = `${i < 3 ? r.d.name : '撤离点'} ${Math.round(dist)}米`;
  });
}
// 小地图
const mapBase = document.createElement('canvas'), MS = 2, mm = $('#minimap'), mctx = mm.getContext('2d');
function buildMap() {
  mapBase.width = mapBase.height = 256 * MS; const g = mapBase.getContext('2d'); g.fillStyle = '#2f3b2a'; g.fillRect(0, 0, 512, 512);
  const X = (x) => (x + 128) * MS;
  for (const s of mapShapes) if (!s.label) { g.fillStyle = s.c; g.fillRect(X(s.x0), X(s.z0), (s.x1 - s.x0) * MS, (s.z1 - s.z0) * MS); }
  g.fillStyle = '#b3a9a2'; g.beginPath(); g.arc(X(0), X(-15), 12, 0, 7); g.fill(); g.fillStyle = '#4f7a36'; g.beginPath(); g.arc(X(0), X(-15), 8, 0, 7); g.fill();
  g.font = `bold 15px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.7)'; g.fillStyle = '#fff';
  for (const s of mapShapes) if (s.label) { g.strokeText(s.label, X(s.x), X(s.z)); g.fillText(s.label, X(s.x), X(s.z)); }
}
function drawMap() {
  const S = mm.width, c = S / 2, k = S / 150; // 显示半径 75 米
  mctx.save(); mctx.clearRect(0, 0, S, S); mctx.beginPath(); mctx.arc(c, c, c - 1, 0, 7); mctx.clip();
  mctx.translate(c, c); mctx.rotate(P.yaw); mctx.scale(k, k); mctx.translate(-P.pos.x, -P.pos.z);
  mctx.drawImage(mapBase, -128, -128, 256, 256);
  const dotAt = (x, z, r, col) => { mctx.fillStyle = col; mctx.beginPath(); mctx.arc(x, z, r, 0, 7); mctx.fill(); };
  for (const r of relays) if (!r.cut) { dotAt(r.d.x, r.d.z, 4 + Math.sin(G.t * 5), 'rgba(255,150,40,.35)'); dotAt(r.d.x, r.d.z, 2.4, '#ffa030'); }
  if (G.evac) { dotAt(EVAC.x, EVAC.z, 5 + Math.sin(G.t * 5), 'rgba(80,255,144,.35)'); dotAt(EVAC.x, EVAC.z, 2.6, '#50ff90'); }
  for (const p of pickups) dotAt(p.m.position.x, p.m.position.z, 1.3, p.kind === 'ammo' ? '#e8d27a' : '#fff');
  for (const e of enemies) if (e.alert) dotAt(e.pos.x, e.pos.z, 1.9, '#ff4030');
  mctx.restore(); mctx.fillStyle = '#fff'; mctx.beginPath(); mctx.moveTo(c, c - 7); mctx.lineTo(c + 5, c + 5); mctx.lineTo(c, c + 2); mctx.lineTo(c - 5, c + 5); mctx.fill();
}
function hud() {
  $('#ammo-n').textContent = P.mag; $('#ammo-r').textContent = P.reserve; $('#ammo').classList.toggle('low', P.mag <= 6);
  $('#ammo-s').textContent = P.reload > 0 ? '换弹中' : P.mag === 0 ? (P.reserve ? 'R · 换弹' : '弹药耗尽') : '校园制式步枪';
  $('#hp-fill').style.width = P.hp + '%'; $('#hp').classList.toggle('low', P.hp < 35); $('#hp-n').textContent = Math.ceil(P.hp);
  $('#vig').style.opacity = clamp((60 - P.hp) / 60, 0, 1) * .9;
  const m = Math.floor(G.time / 60), s = Math.floor(G.time % 60); $('#clock').textContent = `${m}:${String(s).padStart(2, '0')}`;
}

// ================================================================ 射击与玩家
function shoot() {
  if (P.reload > 0 || P.cool > 0) return;
  if (P.mag <= 0) { SFX.dry(); P.cool = .25; if (P.reserve > 0) reload(); return; }
  P.mag--; P.cool = .1; G.shots++; SFX.shot();
  const spread = lerp(.022, .003, P.ads) + (P.ground ? 0 : .03) + Math.min(P.recoil, 1) * .012;
  fwd.set(R(-1, 1) * spread, R(-1, 1) * spread, -1).normalize().applyQuaternion(camera.quaternion);
  let best = rayWorld(eyePos, fwd, 300), hitE = null, weak = false;
  for (const e of enemies) {
    const cy = e.type === 'dog' ? e.pos.y + .8 : e.pos.y;
    tmp.set(e.pos.x - eyePos.x, cy - eyePos.y, e.pos.z - eyePos.z); const t = tmp.dot(fwd); if (t < 0 || t > best + e.r) continue;
    const d2 = tmp.lengthSq() - t * t; if (d2 < e.r * e.r) { const th = t - Math.sqrt(e.r * e.r - d2); if (th < best) { best = th; hitE = e; weak = false; } }
    if (e.type === 'dog') { tmp2.set(0, .95, .7).applyQuaternion(e.g.quaternion).add(e.pos).sub(eyePos); const t2 = tmp2.dot(fwd), dd = tmp2.lengthSq() - t2 * t2; if (t2 > 0 && dd < .075 && t2 - .2 < best) { best = t2 - .2; hitE = e; weak = true; } }
    else if (d2 < .03 && hitE === e) weak = true;
  }
  const end = tmp.copy(eyePos).addScaledVector(fwd, best).clone();
  muzzle.getWorldPosition(tmp2); tracer(tmp2, end);
  flashMesh.visible = true; flashMesh.material.rotation = Math.random() * 6; flashMesh.scale.setScalar(R(.16, .26)); flashLight.position.copy(tmp2); flashLight.intensity = 30;
  if (hitE) { G.hits++; damageEnemy(hitE, weak ? 44 : 22, end); const h = $('#hitm'); h.classList.remove('on', 'weak'); void h.offsetWidth; h.classList.add('on'); if (weak) { h.classList.add('weak'); SFX.weak(); } else SFX.hit(); if (!hitE.alive) h.classList.add('weak'); }
  else if (best < 300) { emit(sparks, end.x, end.y, end.z, 5, 4, .25); emit(dust, end.x, end.y, end.z, 5, 1.5, .7, .8); }
  P.recoil += 1; P.kick.x += lerp(.016, .009, P.ads); P.kick.y += R(-1, 1) * .006;
}
function reload() { if (P.reload > 0 || P.mag >= 30 || P.reserve <= 0 || G.state !== 'play') return; P.reload = 1.7; SFX.reload(); }
let useHeld = 0;
function updatePlayer(dt) {
  // 视角后坐
  const kx = P.kick.x * Math.min(1, dt * 18), ky = P.kick.y * Math.min(1, dt * 18); P.pitch += kx; P.yaw += ky; P.kick.x -= kx; P.kick.y -= ky; P.recoil = Math.max(0, P.recoil - dt * 6);
  P.pitch = clamp(P.pitch, -1.5, 1.5);
  // 移动
  let ix = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + input.mx, iz = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) + input.mz; const il = Math.hypot(ix, iz); if (il > 1) { ix /= il; iz /= il; }
  const crouch = keys.KeyC || keys.ControlLeft || input.crouch; P.crouch = lerp(P.crouch, crouch ? 1 : 0, Math.min(1, dt * 10));
  const sprint = (keys.ShiftLeft || keys.ShiftRight || input.sprint) && iz > .5 && !crouch && P.ads < .3;
  const sp = crouch ? 2.6 : sprint ? 7.6 : lerp(5, 3, P.ads), s = Math.sin(P.yaw), c = Math.cos(P.yaw);
  const wx = (ix * c - iz * s) * sp, wz = (-ix * s - iz * c) * sp, acc = P.ground ? 12 : 2.5;
  pvel.x = lerp(pvel.x, wx, Math.min(1, dt * acc)); pvel.z = lerp(pvel.z, wz, Math.min(1, dt * acc));
  if ((keys.Space || input.jump) && P.ground) { P.vy = 5.4; P.ground = false; input.jump = false; }
  P.pos.x += pvel.x * dt; P.pos.z += pvel.z * dt; collide(P.pos, PR, P.pos.y, 1.75);
  P.pos.x = clamp(P.pos.x, -WORLD + 1, WORLD - 1); P.pos.z = clamp(P.pos.z, -WORLD + 1, 107.5);
  const gy = supportY(P.pos.x, P.pos.z, P.pos.y);
  if (P.ground) { if (gy >= P.pos.y - .65) P.pos.y = gy; else { P.ground = false; P.vy = 0; } }
  if (!P.ground) { P.vy -= 16 * dt; P.pos.y += P.vy * dt; const g2 = supportY(P.pos.x, P.pos.z, P.pos.y + .3); if (P.pos.y <= g2 && P.vy <= 0) { P.pos.y = g2; P.ground = true; if (P.vy < -6) { shake = Math.max(shake, .15); SFX.step(); } P.vy = 0; } }
  const hs = Math.hypot(pvel.x, pvel.z);
  if (P.ground && hs > 1) { P.bob += dt * hs * 1.5; P.stepT -= dt * hs; if (P.stepT <= 0) { P.stepT = 2.6; SFX.step(); } }
  // 武器
  P.cool -= dt; P.ads = lerp(P.ads, (input.ads && P.reload <= 0 && !sprint) ? 1 : 0, Math.min(1, dt * 14));
  if (P.reload > 0) { P.reload -= dt; if (P.reload <= 0) { const n = Math.min(30 - P.mag, P.reserve); P.mag += n; P.reserve -= n; } }
  if (input.fire && !sprint) shoot();
  if (G.t - P.lastHurt > 5 && P.hp < 100) P.hp = Math.min(100, P.hp + dt * 9);
  // 摄像机
  const eh = lerp(1.65, 1.05, P.crouch); P.eye = lerp(P.eye, eh, Math.min(1, dt * 12));
  smoothY = lerp(smoothY, P.pos.y, Math.min(1, dt * 14)); if (Math.abs(smoothY - P.pos.y) > 1.5) smoothY = P.pos.y;
  const bobY = Math.sin(P.bob * 2) * .035 * Math.min(1, hs / 5) * (1 - P.ads * .7);
  camera.position.set(P.pos.x, smoothY + P.eye + bobY, P.pos.z);
  shake = Math.max(0, shake - dt * 1.6);
  camera.rotation.set(P.pitch + R(-1, 1) * shake * .05, P.yaw + R(-1, 1) * shake * .05, R(-1, 1) * shake * .04);
  camera.fov = lerp(camera.fov, lerp(sprint ? 78 : 72, 48, P.ads), Math.min(1, dt * 12)); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  eyePos.copy(camera.position);
  // 枪模
  gun.position.lerpVectors(HIP, ADS, P.ads); gun.position.x += Math.cos(P.bob) * .006 * (1 - P.ads); gun.position.y += bobY * .25 - P.crouch * .01; gun.position.z += Math.min(P.recoil, 3) * .012;
  const rl = P.reload > 0 ? Math.sin(Math.min(1, (1.7 - P.reload) / 1.7) * Math.PI) : 0, run = sprint ? 1 : 0;
  gun.rotation.set(Math.min(P.recoil, 3) * .012 - rl * .5 - run * .25, run * .5, rl * .5); gun.position.y -= rl * .08 + run * .03;
  // 交互：信号中继
  let near = null; for (const r of relays) if (!r.cut && Math.hypot(r.d.x - P.pos.x, r.d.z - P.pos.z) < 3 && Math.abs(r.d.y - P.pos.y) < 2) near = r;
  const pr = $('#prompt');
  if (near) {
    pr.classList.add('on'); const holding = keys.KeyE || input.use;
    if (holding) { near.prog += dt / 2.4; if ((useHeld += dt) > .12) { useHeld = 0; SFX.tick(); } } else near.prog = Math.max(0, near.prog - dt);
    $('#prompt-fill').style.width = near.prog * 100 + '%';
    if (near.prog >= 1) cutRelay(near);
  } else pr.classList.remove('on');
  if (G.evac && Math.hypot(P.pos.x - EVAC.x, P.pos.z - EVAC.z) < 3.4) endGame(true);
}
let smoothY = 0;
function cutRelay(r) {
  r.cut = true; G.cut++; r.beam.visible = false; r.light.color.set(0x40ff80); r.light.intensity = 3; r.led.material = new THREE.MeshBasicMaterial({ color: 0x40ff80 }); SFX.relay(); emit(sparks, r.d.x, r.d.y + 1.2, r.d.z, 40, 6, .7, 2);
  feed(`${r.d.n}号中继 · ${r.d.name} 已关闭`);
  if (G.cut === 1) { radio('第一处中继已关闭。失控的安保系统察觉到你了，机械守卫正在赶来。'); wave(3, 3); }
  else if (G.cut === 2) { radio('第二处中继已关闭。它们正全力围堵，注意利用树木和车辆做掩体。'); wave(4, 4); }
  else { G.evac = true; evacBeam.visible = true; radio('三处中继全部关闭！回到南门，穿过校门就安全了，快撤！'); wave(5, 5); }
  objective();
}

// ================================================================ 流程
function resetGame() {
  for (const e of enemies) scene.remove(e.g); enemies.length = 0; for (const b of bolts) scene.remove(b.m); bolts.length = 0; for (const p of pickups) scene.remove(p.m); pickups.length = 0;
  for (const r of relays) { r.cut = false; r.prog = 0; r.beam.visible = true; r.light.color.set(0xff8030); r.light.intensity = 8; r.led.material = new THREE.MeshBasicMaterial({ color: 0xff7a20 }); }
  Object.assign(P, { vy: 0, yaw: 0, pitch: 0, hp: 100, ground: true, mag: 30, reserve: 150, reload: 0, cool: 0, recoil: 0, lastHurt: -99 }); P.pos.set(0, 0, 92); pvel.set(0, 0, 0); smoothY = 0;
  Object.assign(G, { time: 0, shots: 0, hits: 0, kills: 0, cut: 0, evac: false }); evacBeam.visible = false; radioQ.length = 0; radioT = 0;
  // 各中继的守卫
  spawnEnemy('drone', -6, -66); spawnEnemy('drone', 8, -60); spawnEnemy('dog', 0, -58); spawnEnemy('dog', -14, -50);
  spawnEnemy('drone', -60, -22); spawnEnemy('drone', -58, -8); spawnEnemy('dog', -52, -15);
  spawnEnemy('drone', -62, 40); spawnEnemy('dog', -58, 46); spawnEnemy('dog', -50, 44);
  spawnEnemy('dog', 64, -8); spawnEnemy('drone', 60, -22); spawnEnemy('dog', 0, 30); spawnEnemy('drone', 3, 10);
  // 补给箱
  for (const [k, x, y, z, n] of [['ammo', 70, 0, -22, 60], ['med', 70, 0, -8, 40], ['ammo', 28, 0, -46, 60], ['med', -28, 0, -46, 40], ['ammo', -62, 0, 52, 60], ['ammo', -8, 0, 60, 30], ['med', 8, 0, 30, 30], ['ammo', -78, 3.6, -10, 60], ['med', 40, 0, 60, 40], ['ammo', -40, 0, -6, 30]]) spawnPickup(k, x, y, z, n);
  objective(); flow(P.pos.x, P.pos.z);
}
function show(id) { for (const el of document.querySelectorAll('.screen')) el.classList.toggle('on', el.id === id); $('#hud').classList.toggle('on', !id); document.body.classList.toggle('playing', !id); }
function startGame() {
  audioInit(); resetGame(); G.state = 'play'; show(null); lock();
  radio('小龙虾，这里是大蜀山指挥部。校园安保系统失控，三处信号中继在图书馆、少年班学院和校史馆。逐一关闭它们。');
}
function pause() { if (G.state !== 'play') return; G.state = 'pause'; show('pause'); if (document.pointerLockElement) document.exitPointerLock(); }
function resume() { if (G.state !== 'pause') return; G.state = 'play'; show(null); lock(); audioInit(); }
function endGame(win) {
  if (G.state !== 'play') return; G.state = win ? 'win' : 'dead'; if (document.pointerLockElement) document.exitPointerLock(); input.fire = false;
  const acc = G.shots ? Math.round(G.hits / G.shots * 100) : 0, m = Math.floor(G.time / 60), s = String(Math.floor(G.time % 60)).padStart(2, '0');
  if (win) {
    SFX.win(); const score = acc + G.kills * 2 - G.retries * 15 - Math.max(0, G.time - 300) / 12;
    $('#rank').textContent = score > 95 ? '完美突击' : score > 75 ? '干净利落' : score > 55 ? '稳扎稳打' : '险象环生';
    $('#stats').innerHTML = `<div><b>${m}:${s}</b>用时</div><div><b>${acc}%</b>命中率</div><div><b>${G.kills}</b>摧毁机械</div><div><b>${G.retries}</b>重试次数</div>`; G.retries = 0; show('win');
  } else { $('#dead-info').textContent = `已关闭中继 ${G.cut}/3 · 摧毁机械 ${G.kills} · 生存 ${m}:${s}`; G.retries++; show('dead'); }
}

// ================================================================ 输入
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
function lock() { if (!isTouch && canvas.requestPointerLock) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (e) { } } }
function look(dx, dy, k = 1) { const s = .0022 * settings.sens * k * lerp(1, .55, P.ads); P.yaw -= dx * s; P.pitch = clamp(P.pitch - dy * s, -1.5, 1.5); }
addEventListener('keydown', (e) => { if (e.repeat) return; keys[e.code] = true; if (G.state === 'play') { if (e.code === 'KeyR') reload(); if (e.code === 'KeyP' || e.code === 'Escape') pause(); if (['Space', 'Tab'].includes(e.code)) e.preventDefault(); } else if (G.state === 'pause' && e.code === 'KeyP') resume(); });
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; input.fire = false; });
let dragging = false;
canvas.addEventListener('mousedown', (e) => { if (G.state !== 'play' || isTouch) return; audioInit(); if (!document.pointerLockElement) { lock(); dragging = true; } if (e.button === 0) input.fire = true; if (e.button === 2) input.ads = true; });
addEventListener('mouseup', (e) => { if (isTouch) return; dragging = false; if (e.button === 0) input.fire = false; if (e.button === 2) input.ads = false; });
addEventListener('mousemove', (e) => { if (G.state === 'play' && (document.pointerLockElement === canvas || dragging)) look(e.movementX, e.movementY); });
addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && G.state === 'play' && !isTouch && lockedOnce) pause(); if (document.pointerLockElement) lockedOnce = true; });
let lockedOnce = false;
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
// 触屏
if (isTouch) {
  document.body.classList.add('touch'); let moveId = null, lookId = null, mo = null, lp = null; const stick = $('#stick'), knob = $('#stick i');
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); audioInit(); for (const t of e.changedTouches) { if (t.clientX < innerWidth * .42 && moveId === null) { moveId = t.identifier; mo = { x: t.clientX, y: t.clientY }; stick.style.cssText = `display:block;left:${mo.x}px;top:${mo.y}px`; } else if (lookId === null) { lookId = t.identifier; lp = { x: t.clientX, y: t.clientY }; } } }, { passive: false });
  canvas.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) { if (t.identifier === moveId) { let dx = (t.clientX - mo.x) / 55, dy = (t.clientY - mo.y) / 55; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } input.mx = dx; input.mz = -dy; input.sprint = l > 1.5 && dy < -.7; knob.style.transform = `translate(${dx * 34}px,${dy * 34}px)`; } else if (t.identifier === lookId) { look(t.clientX - lp.x, t.clientY - lp.y, 2.2); lp = { x: t.clientX, y: t.clientY }; } } }, { passive: false });
  const end = (e) => { for (const t of e.changedTouches) { if (t.identifier === moveId) { moveId = null; input.mx = input.mz = 0; input.sprint = false; stick.style.display = 'none'; knob.style.transform = ''; } if (t.identifier === lookId) lookId = null; } };
  canvas.addEventListener('touchend', end); canvas.addEventListener('touchcancel', end);
  const btn = (id, down, up, drag) => { const el = $(id); let lpb = null; el.addEventListener('touchstart', (e) => { e.preventDefault(); audioInit(); el.classList.add('on'); lpb = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }; down(); }, { passive: false }); el.addEventListener('touchmove', (e) => { e.preventDefault(); if (drag && lpb) { const t = e.changedTouches[0]; look(t.clientX - lpb.x, t.clientY - lpb.y, 2.2); lpb = { x: t.clientX, y: t.clientY }; } }, { passive: false }); const u = (e) => { e.preventDefault(); if (up) { up(); el.classList.remove('on'); } }; el.addEventListener('touchend', u); el.addEventListener('touchcancel', u); };
  btn('#t-fire', () => input.fire = true, () => input.fire = false, true); btn('#t-ads', () => { input.ads = !input.ads; $('#t-ads').classList.toggle('on', input.ads); });
  btn('#t-reload', reload, () => { }); btn('#t-jump', () => input.jump = true, () => input.jump = false); btn('#t-use', () => input.use = true, () => input.use = false); btn('#t-pause', pause, () => { });
}
// 菜单按钮
for (const b of document.querySelectorAll('[data-act]')) b.addEventListener('click', () => { audioInit(); const a = b.dataset.act; if (a === 'start' || a === 'retry') startGame(); else if (a === 'resume') resume(); else if (a === 'title') { G.state = 'title'; G.retries = 0; show('title'); } else if (a === 'fs') { const d = document.documentElement; if (document.fullscreenElement) document.exitFullscreen(); else if (d.requestFullscreen) d.requestFullscreen().catch(() => { }); } });
$('#set-vol').addEventListener('input', (e) => { settings.vol = +e.target.value; if (master) master.gain.value = settings.vol; });
$('#set-q').addEventListener('change', (e) => setQuality(e.target.value));
$('#set-sens').addEventListener('input', (e) => { settings.sens = +e.target.value; });

// ================================================================ 主循环
let last = performance.now(), slowT = 0;
function setQuality(q) { settings.q = q; slowT = 0; $('#set-q').value = q; sun.shadow.mapSize.setScalar(q === "high" && !COARSE ? 4096 : 2048); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } resize(); }
function tick(dt) { // 一步游戏模拟
  G.time += dt; updatePlayer(dt); if (G.state !== 'play') return;
  if (G.t - lastFlow > .35) { lastFlow = G.t; flow(P.pos.x, P.pos.z); }
  updateEnemies(dt); updatePickups(dt); updateRadio(dt); if (msgT > 0 && (msgT -= dt) <= 0) $('#msg').classList.remove('on');
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000); last = now; G.t += dt;
  if (G.state === 'play') { tick(dt); if (G.state === 'play') { hud(); updateMarks(); drawMap(); } }
  else if (G.state === 'title') { // 校门外缓慢摇移的片头镜头
    const a = G.t * .07; camera.fov = 55; camera.updateProjectionMatrix(); camera.position.set(Math.sin(a) * 15 - 6, 2.2 + Math.sin(a * 1.3) * .5, 121 + Math.cos(a) * 3); camera.lookAt(2, 5.2, 100);
  } else if (G.state === 'dead') { camera.position.y = Math.max(smoothY + .35, camera.position.y - dt * 1.6); camera.rotation.z = Math.min(.9, camera.rotation.z + dt * 1.2); }
  gun.visible = G.state === 'play' || G.state === 'pause';
  for (const r of relays) { r.dish.rotation.y += dt * (r.cut ? 0 : 1.2); if (!r.cut) r.beam.material.opacity = .28 + Math.sin(G.t * 4) * .08; }
  if (evacBeam.visible) evacBeam.material.opacity = .09 + Math.sin(G.t * 3) * .03;
  for (const tr of tracers) if (tr.m.visible && (tr.t -= dt) <= 0) tr.m.visible = false;
  if (G.state !== 'pause') { stepPoints(sparks, dt, 12, .8); stepPoints(smoke, dt, -1.2, 1.2); stepPoints(dust, dt, 2, 2); stepPetals(dt, G.t); flashLight.intensity *= Math.exp(-dt * 40); boomLight.intensity *= Math.exp(-dt * 7); if (flashMesh.visible && P.cool < .06) flashMesh.visible = false; }
  // 阴影跟随
  const cx = Math.round(camera.position.x / 4) * 4, cz = Math.round(camera.position.z / 4) * 4; sun.target.position.set(cx, 0, cz); sun.position.set(cx, 0, cz).addScaledVector(sunDir, 160); sun.target.updateMatrixWorld();
  sky.position.copy(camera.position);
  if (settings.q === 'high') { finish.uniforms.time.value = G.t; composer.render(dt); } else renderer.render(scene, camera);
  // 帧率过低时自动降低画质
  if (settings.q === 'high' && G.state === 'play' && !window.__noAutoQ) { slowT = dt > .045 ? slowT + dt : Math.max(0, slowT - dt * 2); if (slowT > 4) { setQuality('low'); msg('帧率偏低，已自动切换为流畅画质'); } }
}

(async function main() {
  try {
    boot(15, '正在铺设校园道路'); await nextFrame();
    buildWorld(scene); boot(55, '正在栽种梧桐与樱花'); await nextFrame();
    enemyAssets(); buildRelays(); buildNav(); boot(75, '正在部署信号中继'); await nextFrame();
    buildMap(); buildMarks(); resetGame(); boot(90, '正在准备首帧画面'); await nextFrame();
    renderer.compile(scene, camera); composer.render(0); G.state = 'title'; show('title'); requestAnimationFrame(frame);
    boot(100); setTimeout(() => $('#boot').classList.add('done'), 350);
    window.__game = { G, P, enemies, relays, startGame, cutRelay, endGame, renderer, sun, navH, navD, navE, cellOf, keys, input, pickups, sim(sec) { for (let i = 0, n = Math.round(sec * 60); i < n && G.state === 'play'; i++) { G.t += 1 / 60; tick(1 / 60); } } };
  } catch (err) { console.error(err); $('#boot-msg').textContent = '启动失败：' + (err && err.message || err); }
})();
