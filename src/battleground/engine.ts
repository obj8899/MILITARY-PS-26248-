// Three.js engine for the SILENT RIDGE battleground.
// It draws whatever SimState it is handed. It never computes truth itself: the
// enemy meshes and the jam dome only exist while state.truthEnemies / state.jam
// are present (Instructor, or everyone once the exercise is over).

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import * as milNs from "milsymbol";
import {
  PLACES, RIVER, TRACKS, WATER_LEVEL, WORLD_D, WORLD_W, dist, forestDensity, metres, mulberry32,
  riverDistance, terrainHeight, trackDistance, fbm, type XZ,
} from "./world";
import type { Friendly, SimState, Track } from "./sim";

export type Quality = "full" | "reduced" | "off";
export type Theme = "light" | "dark";
export type CamMode = "free" | "follow" | "tactical";
export interface Layers { truth: boolean; gap: boolean; jam: boolean }
export interface PingMark { id: string; pos: XZ; t0: number; owner: string }
export interface EngineUi { selectedId: string; layers: Layers; pings: PingMark[]; highlightTrack?: string; viewerSeat: string }

const AMBER = 0xf5b942, DANGER = 0xe5484d, TRUTH = 0x5eead4, FRIEND = 0x7db6ff;

// milsymbol ships as UMD in some bundler paths, so resolve the constructor defensively.
type SymCtor = new (code: string, opts: Record<string, unknown>) => { asSVG(): string };
const MilSymbol: SymCtor | undefined = ((milNs as unknown as { Symbol?: SymCtor }).Symbol
  ?? (milNs as unknown as { default?: { Symbol?: SymCtor } }).default?.Symbol);
const svgCache = new Map<string, string>();
function svgFor(code: string, size = 26): string {
  const key = code + size;
  const hit = svgCache.get(key); if (hit !== undefined) return hit;
  let out = "";
  try { out = MilSymbol ? new MilSymbol(code, { size, outlineWidth: 2, outlineColor: "#050a08" }).asSVG() : ""; } catch { out = ""; }
  svgCache.set(key, out); return out;
}

interface Label { el: HTMLDivElement; pos: THREE.Vector3; last: string; maxDist: number }

export class Engine {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(52, 1, 0.5, 1800);
  readonly renderer: THREE.WebGLRenderer;
  private composer?: EffectComposer;
  private bloom?: UnrealBloomPass;
  private sun = new THREE.DirectionalLight(0xfff0d6, 2.6);
  private hemi!: THREE.HemisphereLight;
  private skyMat!: THREE.ShaderMaterial;
  private clock = 0;
  private labels = new Map<string, Label>();
  private friendlyObjs = new Map<string, { group: THREE.Group; ring: THREE.Mesh; bars: THREE.Object3D[]; rotors: THREE.Object3D[]; cone?: THREE.Mesh; angle: number; target: THREE.Vector3; init: boolean; soldiers: THREE.Group[] }>();
  private ghostObjs = new Map<string, { group: THREE.Group; core: THREE.Mesh; ring: THREE.Mesh; disc: THREE.Mesh; pillar: THREE.Mesh }>();
  private truthGroup?: THREE.Group;
  private truthVeh: THREE.Group[] = [];
  private gapLines = new Map<string, THREE.Line>();
  private jamDome?: THREE.Group;
  private spoofMark?: THREE.Group;
  private pingObjs = new Map<string, THREE.Group>();
  private selRing: THREE.Mesh;
  private waterTex!: THREE.CanvasTexture;
  private dust!: THREE.Points;
  private beams: THREE.Mesh[] = [];
  private disposed = false;
  private labelLayer: HTMLElement;
  private container: HTMLElement;
  private quality: Quality;
  private frameCb?: (dt: number) => void;

  // camera rig
  mode: CamMode = "free";
  private tgt = new THREE.Vector3(PLACES.ford[0] - 10, 0, PLACES.ford[1] + 8);
  private tgtGoal = this.tgt.clone();
  private yaw = 0.7; private pitch = 0.62; private distCam = 78;
  private yawGoal = this.yaw; private pitchGoal = this.pitch; private distGoal = this.distCam;
  private keys = new Set<string>();
  private drag: { x: number; y: number; moved: number; button: number } | null = null;
  private followId = "t1";
  private dropT = -1; private dropDur = 6;
  private orbitIdle = false;
  onPick?: (p: XZ, clientX: number, clientY: number) => void;
  onDropProgress?: (altitudeM: number, done: boolean) => void;
  private cleanup: (() => void)[] = [];
  private tmp = new THREE.Vector3();

  constructor(container: HTMLElement, labelLayer: HTMLElement, quality: Quality, theme: Theme = "dark") {
    this.container = container; this.labelLayer = labelLayer; this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ antialias: quality !== "off", powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = quality !== "off";
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === "full" ? 1.5 : 1));
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.className = "bg-canvas";

    this.scene.background = new THREE.Color(0xa9b8b0);
    this.scene.fog = new THREE.FogExp2(0xb7c4b8, 0.0032);

    this.buildSky(); this.buildLights(); this.buildTerrain(); this.buildWater(); this.buildTracks();
    this.buildForest(); this.buildLandmarks(); this.buildBoundary(); this.buildDust();
    this.selRing = this.makeRing(3.4, 3.9, AMBER, 0.9); this.selRing.visible = false; this.scene.add(this.selRing);

    if (quality === "full") {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.42, 0.55, 0.88);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }
    this.setTheme(theme);
    this.bindInput();
    this.resize();
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(container);
    this.cleanup.push(() => ro.disconnect());
  }

  // ------------------------------------------------------------------ build
  private buildSky() {
    const geo = new THREE.SphereGeometry(1200, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x4f7ea8) }, mid: { value: new THREE.Color(0xc9d6cf) }, bot: { value: new THREE.Color(0xd8cdb0) }, sunDir: { value: new THREE.Vector3(-0.5, 0.45, 0.6).normalize() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 sunDir;
        void main(){ float h = clamp(vP.y,-0.2,1.0);
          vec3 c = mix(bot, mid, smoothstep(-0.05,0.18,h)); c = mix(c, top, smoothstep(0.12,0.75,h));
          float s = max(dot(normalize(vP), sunDir),0.0); c += vec3(1.0,0.82,0.55)*(pow(s,40.0)*0.55 + pow(s,600.0)*2.0);
          gl_FragColor = vec4(c,1.0); }`,
    });
    this.skyMat = mat;
    this.scene.add(new THREE.Mesh(geo, mat));
  }

  private buildLights() {
    this.hemi = new THREE.HemisphereLight(0xcfe0ff, 0x5a5b3c, 0.95);
    this.scene.add(this.hemi);
    this.sun.position.set(-90, 120, 110);
    this.sun.castShadow = this.quality !== "off";
    const s = this.sun.shadow;
    s.mapSize.set(this.quality === "full" ? 2048 : 1024, this.quality === "full" ? 2048 : 1024);
    s.camera.left = -85; s.camera.right = 85; s.camera.top = 85; s.camera.bottom = -85; s.camera.near = 10; s.camera.far = 400;
    s.bias = -0.0005; s.normalBias = 0.5;
    this.scene.add(this.sun, this.sun.target);
  }

  private buildTerrain() {
    const pad = 70;
    const w = WORLD_W + pad, d = WORLD_D + pad;
    const sx = this.quality === "off" ? 150 : 250, sz = this.quality === "off" ? 130 : 215;
    const geo = new THREE.PlaneGeometry(w, d, sx, sz);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
    geo.computeVertexNormals();
    const nor = geo.attributes.normal as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    const grassA = new THREE.Color(0x5f7a3a), grassB = new THREE.Color(0x3f5a2b), dry = new THREE.Color(0x8a8a4c);
    const sand = new THREE.Color(0xb8a778), rock = new THREE.Color(0x7d7a70), dark = new THREE.Color(0x2c4222), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const slope = 1 - nor.getY(i);
      const n = fbm(x * 0.09, z * 0.09, 3), n2 = fbm(x * 0.4 + 9, z * 0.4, 2);
      c.copy(grassA).lerp(grassB, fbm(x * 0.05 + 3, z * 0.05, 3)).lerp(dry, Math.max(0, n - 0.55) * 1.6);
      c.lerp(dark, Math.max(0, forestDensity(x, z) - 0.5) * 1.4);
      const rd = riverDistance(x, z);
      c.lerp(sand, Math.max(0, 1 - Math.max(0, rd - 3) / 5) * 0.9);
      c.lerp(rock, Math.min(1, Math.max(0, (slope - 0.16) * 4.5, (y - 15) / 8)));
      const td = trackDistance(x, z);
      if (td < 2.2) c.lerp(new THREE.Color(0x8d7a56), (1 - td / 2.2) * 0.8);
      c.multiplyScalar(0.86 + n2 * 0.26);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 }));
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    // far-field skirt so the map does not read as a floating tile; fog melts it into the horizon
    const skirt = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshStandardMaterial({ color: 0x55703a, roughness: 1 }));
    skirt.rotation.x = -Math.PI / 2; skirt.position.y = 1.2; this.scene.add(skirt);
  }

  private ribbon(line: XZ[], width: (i: number) => number, y: (x: number, z: number) => number): THREE.BufferGeometry {
    const verts: number[] = [], uvs: number[] = [], idx: number[] = [];
    let acc = 0;
    for (let i = 0; i < line.length; i++) {
      const p = line[i], a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
      let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const nx = -tz, nz = tx, hw = width(i) / 2;
      if (i > 0) acc += dist(p, line[i - 1]);
      verts.push(p[0] + nx * hw, y(p[0] + nx * hw, p[1] + nz * hw), p[1] + nz * hw, p[0] - nx * hw, y(p[0] - nx * hw, p[1] - nz * hw), p[1] - nz * hw);
      uvs.push(0, acc / 6, 1, acc / 6);
      if (i < line.length - 1) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }

  private buildWater() {
    const cv = document.createElement("canvas"); cv.width = cv.height = 256;
    const g = cv.getContext("2d")!; const rnd = mulberry32(5);
    g.fillStyle = "#000"; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 160; i++) {
      g.strokeStyle = `rgba(255,255,255,${0.1 + rnd() * 0.35})`; g.lineWidth = 1 + rnd() * 2;
      const x = rnd() * 256, y = rnd() * 256; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 6, y + 14 + rnd() * 30); g.stroke();
    }
    this.waterTex = new THREE.CanvasTexture(cv); this.waterTex.wrapS = this.waterTex.wrapT = THREE.RepeatWrapping; this.waterTex.colorSpace = THREE.SRGBColorSpace;
    const widthFn = (i: number) => { const p = RIVER[i]; const f = Math.hypot(p[0] - PLACES.ford[0], p[1] - PLACES.ford[1]); return 7.5 + 4 * Math.exp(-(f * f) / 400); };
    const water = new THREE.Mesh(this.ribbon(RIVER, widthFn, () => WATER_LEVEL), new THREE.MeshStandardMaterial({ color: 0x2b7f98, roughness: 0.12, metalness: 0.25, transparent: true, opacity: 0.8, depthWrite: false }));
    water.renderOrder = 2;
    const flow = new THREE.Mesh(this.ribbon(RIVER, widthFn, () => WATER_LEVEL + 0.04), new THREE.MeshBasicMaterial({ map: this.waterTex, color: 0xcfeeff, transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false }));
    flow.renderOrder = 3;
    this.scene.add(water, flow);
  }

  private buildTracks() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x9b8a62, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    for (const t of TRACKS) {
      const m = new THREE.Mesh(this.ribbon(t, () => 2.3, (x, z) => terrainHeight(x, z) + 0.06), mat);
      m.receiveShadow = true; this.scene.add(m);
    }
  }

  private buildForest() {
    const rnd = mulberry32(2026);
    const maxTrees = this.quality === "off" ? 700 : 1900;
    const spots: { x: number; z: number; s: number; h: number }[] = [];
    const avoid: XZ[] = [PLACES.hq, PLACES.hawk2, PLACES.hawk3, PLACES.fup, PLACES.ford, PLACES.bridge];
    let tries = 0;
    while (spots.length < maxTrees && tries++ < 16000) {
      const x = (rnd() - 0.5) * (WORLD_W + 40), z = (rnd() - 0.5) * (WORLD_D + 40);
      if (forestDensity(x, z) < 0.46 + rnd() * 0.12) continue;
      if (riverDistance(x, z) < 8 || trackDistance(x, z) < 3.4) continue;
      if (avoid.some((p) => dist(p, [x, z]) < 10)) continue;
      const y = terrainHeight(x, z);
      if (y > 17) continue;
      spots.push({ x, z, s: 0.8 + rnd() * 0.9, h: y });
    }
    const foliage = new THREE.InstancedMesh(new THREE.ConeGeometry(1.9, 5.4, 7), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), spots.length);
    const upper = new THREE.InstancedMesh(new THREE.ConeGeometry(1.4, 4, 7), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), spots.length);
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.3, 1.6, 5), new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 1 }), spots.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
    spots.forEach((t, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28);
      sc.set(t.s, t.s * (0.9 + rnd() * 0.5), t.s);
      m.compose(p.set(t.x, t.h + 0.8 * t.s + 2.7 * sc.y, t.z), q, sc); foliage.setMatrixAt(i, m);
      m.compose(p.set(t.x, t.h + 0.8 * t.s + 5.3 * sc.y, t.z), q, sc); upper.setMatrixAt(i, m);
      m.compose(p.set(t.x, t.h + 0.8 * t.s, t.z), q, sc); trunk.setMatrixAt(i, m);
      col.setHSL(0.27 + rnd() * 0.06, 0.38 + rnd() * 0.15, 0.2 + rnd() * 0.1); foliage.setColorAt(i, col); upper.setColorAt(i, col.offsetHSL(0, 0, 0.03));
    });
    foliage.castShadow = upper.castShadow = this.quality !== "off";
    this.scene.add(foliage, upper, trunk);

    // boulders on the ridge
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1.3, 0), new THREE.MeshStandardMaterial({ color: 0x8b887c, roughness: 1, flatShading: true }), 160);
    for (let i = 0; i < 160; i++) {
      const a = PLACES.ridge, x = a[0] + (rnd() - 0.5) * 80, z = a[1] + (rnd() - 0.5) * 60;
      const y = terrainHeight(x, z), s = 0.35 + rnd() * 0.9;
      m.compose(p.set(x, y + s * 0.3, z), q.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3)), sc.set(s, s * 0.7, s));
      rocks.setMatrixAt(i, m);
    }
    rocks.castShadow = true; this.scene.add(rocks);
  }

  private makeGradientTex(): THREE.CanvasTexture {
    const cv = document.createElement("canvas"); cv.width = 4; cv.height = 128;
    const g = cv.getContext("2d")!; const gr = g.createLinearGradient(0, 128, 0, 0);
    gr.addColorStop(0, "rgba(255,255,255,0.9)"); gr.addColorStop(0.7, "rgba(255,255,255,0.18)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
    return new THREE.CanvasTexture(cv);
  }

  private beam(at: XZ, color: number, h: number, r: number): THREE.Mesh {
    const y = terrainHeight(at[0], at[1]);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.6, h, 16, 1, true), new THREE.MeshBasicMaterial({ color, map: this.gradTex ??= this.makeGradientTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    mesh.position.set(at[0], y + h / 2, at[1]);
    this.scene.add(mesh); this.beams.push(mesh);
    return mesh;
  }
  private gradTex?: THREE.CanvasTexture;

  private makeRing(inner: number, outer: number, color: number, opacity: number): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    m.rotation.x = -Math.PI / 2; m.renderOrder = 5;
    return m;
  }

  private buildLandmarks() {
    // objective beams (PUBG-flare style)
    this.beam(PLACES.ford, AMBER, 70, 0.5);
    this.beam(PLACES.bridge, 0xffffff, 45, 0.28);
    this.beam(PLACES.ridge, 0xffffff, 45, 0.28);
    this.beam(PLACES.fup, 0xffffff, 40, 0.28);
    // ford ring + stepping stones
    const fr = this.makeRing(7.2, 7.7, AMBER, 0.85); fr.position.set(PLACES.ford[0], WATER_LEVEL + 0.35, PLACES.ford[1]); fr.name = "fordRing"; this.scene.add(fr);
    const stones = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.5, 0), new THREE.MeshStandardMaterial({ color: 0x9a9a92, flatShading: true }), 18);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 18; i++) { m.makeTranslation(PLACES.ford[0] - 7 + i * 0.85, WATER_LEVEL + 0.1, PLACES.ford[1] + Math.sin(i * 1.7) * 0.7); stones.setMatrixAt(i, m); }
    this.scene.add(stones);

    // bridge across the river at N BRIDGE
    const bp = PLACES.bridge;
    const near = RIVER.reduce((best, p) => dist(p, bp) < dist(best, bp) ? p : best, RIVER[0]);
    const i0 = RIVER.indexOf(near), a = RIVER[Math.max(0, i0 - 2)], b = RIVER[Math.min(RIVER.length - 1, i0 + 2)];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const bridge = new THREE.Group();
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x77705f, roughness: 0.9 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.35, 17), deckMat); deck.castShadow = deck.receiveShadow = true;
    const rail = new THREE.BoxGeometry(0.12, 0.7, 17);
    const r1 = new THREE.Mesh(rail, deckMat), r2 = new THREE.Mesh(rail, deckMat); r1.position.set(1.35, 0.5, 0); r2.position.set(-1.35, 0.5, 0);
    for (const z of [-6, -2, 2, 6]) { const pier = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6, 0.5), deckMat); pier.position.set(0, -1.3, z); bridge.add(pier); }
    bridge.add(deck, r1, r2);
    bridge.position.set(bp[0], 1.55, bp[1]); bridge.rotation.y = -ang; // river tangent is the bridge's perpendicular
    bridge.rotation.y = -ang + Math.PI / 2 + Math.PI / 2;
    this.scene.add(bridge);

    // camp props at HQ and FUP: tents + crates + camo net
    const tentMat = new THREE.MeshStandardMaterial({ color: 0x5b6a3c, roughness: 1, flatShading: true });
    const addTent = (p: XZ, rot: number, s = 1) => {
      const t = new THREE.Mesh(new THREE.ConeGeometry(2.2 * s, 2 * s, 4), tentMat); t.rotation.y = rot + Math.PI / 4; t.position.set(p[0], terrainHeight(p[0], p[1]) + s, p[1]); t.castShadow = true; this.scene.add(t);
    };
    addTent([PLACES.hq[0] - 5, PLACES.hq[1] + 3], 0.2); addTent([PLACES.hq[0] + 4, PLACES.hq[1] + 5], 0.9, 0.8);
    addTent([PLACES.fup[0] + 5, PLACES.fup[1] + 6], 0.4); addTent([PLACES.fup[0] - 6, PLACES.fup[1] + 4], 1.1, 0.9);
    const crate = new THREE.MeshStandardMaterial({ color: 0x6b5a3a, roughness: 1 });
    for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), crate); const px = PLACES.hq[0] + 1.5 + (i % 3) * 1.1, pz = PLACES.hq[1] - 3 + Math.floor(i / 3) * 1.1; c.position.set(px, terrainHeight(px, pz) + 0.35, pz); c.castShadow = true; this.scene.add(c); }
    // ridge OP: a small tower on SILENT RIDGE
    const tw = new THREE.Group(); const legMat = new THREE.MeshStandardMaterial({ color: 0x4d4a3f });
    for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.18, 5, 0.18), legMat); l.position.set(dx, 2.5, dz); tw.add(l); }
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 2.2), legMat); cab.position.y = 5.4; tw.add(cab);
    tw.position.set(PLACES.ridge[0], terrainHeight(PLACES.ridge[0], PLACES.ridge[1]), PLACES.ridge[1]); tw.traverse((o) => { o.castShadow = true; }); this.scene.add(tw);
  }

  private buildBoundary() {
    const hx = WORLD_W / 2 - 1.5, hz = WORLD_D / 2 - 1.5, pts: XZ[] = [];
    const seg = 90;
    for (let i = 0; i <= seg; i++) pts.push([-hx + (2 * hx * i) / seg, -hz]);
    for (let i = 1; i <= seg; i++) pts.push([hx, -hz + (2 * hz * i) / seg]);
    for (let i = 1; i <= seg; i++) pts.push([hx - (2 * hx * i) / seg, hz]);
    for (let i = 1; i < seg; i++) pts.push([-hx, hz - (2 * hz * i) / seg]);
    pts.push(pts[0]);
    const verts: number[] = [], uv: number[] = [], idx: number[] = [];
    pts.forEach((p, i) => {
      const y = terrainHeight(p[0], p[1]);
      verts.push(p[0], y - 1, p[1], p[0], y + 26, p[1]); uv.push(i / 8, 0, i / 8, 1);
      if (i < pts.length - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    const wall = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: AMBER, map: this.gradTex ??= this.makeGradientTex(), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    this.scene.add(wall);
  }

  private buildDust() {
    const n = 260, pos = new Float32Array(n * 3), rnd = mulberry32(7);
    for (let i = 0; i < n; i++) { pos[i * 3] = (rnd() - 0.5) * 120; pos[i * 3 + 1] = rnd() * 30; pos[i * 3 + 2] = (rnd() - 0.5) * 120; }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xfff1c7, size: 0.28, transparent: true, opacity: 0.45, depthWrite: false, sizeAttenuation: true }));
    this.scene.add(this.dust);
  }

  // ------------------------------------------------------------------ actors
  private soldier(color: number): THREE.Group {
    const g = new THREE.Group();
    const body = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc89b72, roughness: 1 });
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.9, 0.34), body); legs.position.y = 0.45;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.8, 0.42), body); torso.position.y = 1.3;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin); head.position.y = 1.9;
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3d4a2c, roughness: 0.8 })); helm.position.y = 1.95;
    const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 1.1), new THREE.MeshStandardMaterial({ color: 0x1b1b1b })); rifle.position.set(0.32, 1.25, 0.35);
    g.add(legs, torso, head, helm, rifle);
    g.traverse((o) => { o.castShadow = true; });
    g.scale.setScalar(1.15);
    return g;
  }

  private truck(color: number): THREE.Group {
    const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.5, 1.5), m); cab.position.set(0, 1.2, 1.8);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.6, 3.4), new THREE.MeshStandardMaterial({ color: 0x55603a, roughness: 1 })); bed.position.set(0, 1.4, -0.7);
    const wm = new THREE.MeshStandardMaterial({ color: 0x151515 });
    for (const [x, z] of [[-0.95, 1.8], [0.95, 1.8], [-0.95, -1.4], [0.95, -1.4]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.4, 12), wm); w.rotation.z = Math.PI / 2; w.position.set(x, 0.5, z); g.add(w); }
    g.add(cab, bed); g.traverse((o) => { o.castShadow = true; }); return g;
  }

  private tank(): THREE.Group {
    const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: 0x4a4b3a, roughness: 0.7, metalness: 0.2 });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 3.8), m); hull.position.y = 0.8;
    const tur = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.65, 1.7), m); tur.position.set(0, 1.55, -0.1);
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 8), new THREE.MeshStandardMaterial({ color: 0x25261f })); gun.rotation.x = Math.PI / 2; gun.position.set(0, 1.6, 1.7);
    const tm = new THREE.MeshStandardMaterial({ color: 0x1c1c18 });
    for (const x of [-1.15, 1.15]) { const tr = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.7, 4.0), tm); tr.position.set(x, 0.4, 0); g.add(tr); }
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.5), new THREE.MeshBasicMaterial({ color: DANGER })); mark.position.set(0, 1.92, -0.1);
    g.add(hull, tur, gun, mark); g.traverse((o) => { o.castShadow = true; }); return g;
  }

  private drone(): { g: THREE.Group; rotors: THREE.Object3D[] } {
    const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: 0xdfe6e0, roughness: 0.5, metalness: 0.3 });
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 2.2), m));
    const rotors: THREE.Object3D[] = [];
    for (const [x, z] of [[-1.4, -1.2], [1.4, -1.2], [-1.4, 1.2], [1.4, 1.2]]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x) * 1.0, 0.1, 0.12), m); arm.position.set(x / 2, 0, z / 2); arm.rotation.y = Math.atan2(-z, x) * 0.0; g.add(arm);
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.04, 20), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, fog: false })); r.position.set(x, 0.18, z); g.add(r); rotors.push(r);
    }
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), new THREE.MeshBasicMaterial({ color: AMBER, fog: false })); led.position.set(0, -0.1, 1.2); g.add(led);
    g.scale.setScalar(1.0);
    return { g, rotors };
  }

  private buildFriendly(f: Friendly) {
    const g = new THREE.Group(); const soldiers: THREE.Group[] = []; let rotors: THREE.Object3D[] = []; let cone: THREE.Mesh | undefined;
    const col = f.kind === "uas" ? 0xffffff : 0x56673a;
    if (f.kind === "hq") {
      const t = this.truck(0x66744a); t.position.set(-2.2, 0, -1); g.add(t);
      for (let i = 0; i < 4; i++) { const s = this.soldier(col); s.position.set(1.6 + (i % 2) * 1.2, 0, -1 + Math.floor(i / 2) * 1.4); soldiers.push(s); g.add(s); }
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 6, 6), new THREE.MeshStandardMaterial({ color: 0xcccccc })); pole.position.set(0.5, 3, 1.8); g.add(pole);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), new THREE.MeshBasicMaterial({ color: FRIEND, side: THREE.DoubleSide })); flag.position.set(1.4, 5.4, 1.8); g.add(flag);
    } else if (f.kind === "platoon") {
      for (let i = 0; i < 6; i++) { const s = this.soldier(col); s.position.set((i - 2.5) * 1.35, 0, (i % 2) * 1.0); soldiers.push(s); g.add(s); }
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.5, 6), new THREE.MeshStandardMaterial({ color: 0xcccccc })); pole.position.set(0, 2.25, -1.4); g.add(pole);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.8), new THREE.MeshBasicMaterial({ color: FRIEND, side: THREE.DoubleSide })); flag.position.set(0.7, 4.0, -1.4); g.add(flag);
    } else if (f.kind === "reserve") {
      const a = this.truck(0x66744a), b = this.truck(0x66744a); a.position.set(-2, 0, 0); b.position.set(2, 0, 0); g.add(a, b);
      for (let i = 0; i < 6; i++) { const s = this.soldier(col); s.position.set(-3 + i * 1.2, 0, 3.2); soldiers.push(s); g.add(s); }
    } else {
      const d = this.drone(); g.add(d.g); rotors = d.rotors;
      cone = new THREE.Mesh(new THREE.ConeGeometry(5, 25, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      cone.position.y = -13; g.add(cone);
    }
    const ring = this.makeRing(f.kind === "uas" ? 2.6 : 4.4, f.kind === "uas" ? 2.9 : 4.7, FRIEND, 0.75); ring.position.y = 0.2;
    if (f.kind !== "uas") g.add(ring);
    const scn = this.scene; scn.add(g);
    this.friendlyObjs.set(f.id, { group: g, ring, bars: [], rotors, cone, angle: Math.random() * 6, target: new THREE.Vector3(), init: false, soldiers });
  }

  private ghost(id: string): { group: THREE.Group; core: THREE.Mesh; ring: THREE.Mesh; disc: THREE.Mesh; pillar: THREE.Mesh } {
    const group = new THREE.Group();
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(1.3), new THREE.MeshBasicMaterial({ color: DANGER, wireframe: true, transparent: true, fog: false }));
    core.position.y = 5.5;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 10, 6, 1, true), new THREE.MeshBasicMaterial({ color: DANGER, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    pillar.position.y = 5;
    const ring = this.makeRing(0.94, 1, DANGER, 0.9);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: DANGER, transparent: true, opacity: 0.1, depthWrite: false, fog: false }));
    disc.rotation.x = -Math.PI / 2; disc.renderOrder = 4;
    group.add(core, pillar, ring, disc);
    this.scene.add(group);
    void id;
    return { group, core, ring, disc, pillar };
  }

  // ------------------------------------------------------------------ labels
  private label(key: string, className: string, html: string, pos: THREE.Vector3, maxDist = 400) {
    let l = this.labels.get(key);
    if (!l) {
      const el = document.createElement("div"); el.className = "bg-label " + className; this.labelLayer.appendChild(el);
      l = { el, pos: new THREE.Vector3(), last: "", maxDist }; this.labels.set(key, l);
    }
    if (l.last !== html) { l.el.innerHTML = html; l.last = html; }
    l.pos.copy(pos); l.maxDist = maxDist; (l as Label & { seen?: number }).seen = this.clock;
  }

  private projectLabels() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    for (const [key, l] of this.labels) {
      if ((l as Label & { seen?: number }).seen !== this.clock) { l.el.remove(); this.labels.delete(key); continue; }
      const d = this.camera.position.distanceTo(l.pos);
      this.tmp.copy(l.pos).project(this.camera);
      const vis = this.tmp.z < 1 && this.tmp.z > -1 && d < l.maxDist && Math.abs(this.tmp.x) < 1.1 && Math.abs(this.tmp.y) < 1.1;
      l.el.style.display = vis ? "" : "none";
      if (vis) {
        l.el.style.transform = `translate(${((this.tmp.x + 1) / 2) * w}px, ${((1 - this.tmp.y) / 2) * h}px) translate(-50%, -100%)`;
        l.el.style.opacity = String(Math.max(0.35, Math.min(1, 1.25 - d / l.maxDist)));
      }
    }
  }

  // ------------------------------------------------------------------ per-frame sync
  private linkBar(q: number): string {
    const n = Math.max(0, Math.min(4, Math.round(q * 4)));
    const cls = q > 0.7 ? "ok" : q > 0.35 ? "warn" : "bad";
    return `<span class="lk ${cls}">${[0, 1, 2, 3].map((i) => `<i class="${i < n ? "on" : ""}"></i>`).join("")}</span>`;
  }

  private syncFriendlies(state: SimState, ui: EngineUi, dt: number, now: number) {
    for (const f of state.friendlies) {
      if (!this.friendlyObjs.has(f.id)) this.buildFriendly(f);
      const o = this.friendlyObjs.get(f.id)!;
      let gx = f.pos[0], gz = f.pos[1], gy: number;
      if (f.kind === "uas" && f.orbit) {
        o.angle += dt * 0.35;
        gx = f.orbit.center[0] + Math.cos(o.angle) * f.orbit.radius; gz = f.orbit.center[1] + Math.sin(o.angle) * f.orbit.radius;
        gy = terrainHeight(gx, gz) + 26;
        o.rotors.forEach((r) => { r.rotation.y += dt * 40; });
        if (o.cone) o.cone.scale.set(Math.max(0.45, f.orbit.radius / 16), 1, Math.max(0.45, f.orbit.radius / 16));
      } else gy = terrainHeight(gx, gz);
      o.target.set(gx, gy, gz);
      if (!o.init || o.group.position.distanceTo(o.target) > 40) { o.group.position.copy(o.target); o.init = true; }
      const prev = o.group.position.clone();
      o.group.position.lerp(o.target, 1 - Math.exp(-dt * 4));
      const mv = o.group.position.clone().sub(prev);
      if (mv.lengthSq() > 1e-6) o.group.rotation.y = Math.atan2(mv.x, mv.z); else if (f.kind !== "uas" && !o.group.userData.set) { o.group.rotation.y = f.heading; o.group.userData.set = true; }
      if (f.kind === "uas" && mv.lengthSq() > 1e-6) o.group.rotation.y = Math.atan2(mv.x, mv.z);
      o.soldiers.forEach((s, i) => { s.position.y = Math.abs(Math.sin(now * 2 + i)) * 0.03; });
      const sel = ui.selectedId === f.id;
      if (sel) { this.selRing.visible = true; this.selRing.position.set(o.group.position.x, terrainHeight(o.group.position.x, o.group.position.z) + 0.3, o.group.position.z); this.selRing.scale.setScalar(1 + Math.sin(now * 4) * 0.06); }
      const lp = o.group.position.clone(); lp.y += f.kind === "uas" ? 3.2 : 7.2;
      const sym = svgFor(f.kind === "uas" ? "SFAPMFQ---*****" : "SFGPUCI---*****", 24);
      this.label("f-" + f.id, "friend" + (sel ? " sel" : ""), `<div class="lbl-sym">${sym}</div><div class="lbl-txt"><b>${f.callsign}</b><small>${f.role}</small>${this.linkBar(f.linkQ)}</div>`, lp, 330);
    }
    if (!state.friendlies.some((f) => f.id === ui.selectedId)) this.selRing.visible = false;
  }

  private syncTracks(state: SimState, ui: EngineUi, now: number) {
    const alive = new Set<string>();
    const showTruthDetail = state.truthEnemies !== undefined;
    for (const t of state.tracks) {
      alive.add(t.id);
      let g = this.ghostObjs.get(t.id);
      if (!g) { g = this.ghost(t.id); this.ghostObjs.set(t.id, g); }
      const y = terrainHeight(t.pos[0], t.pos[1]);
      g.group.position.set(t.pos[0], y, t.pos[1]);
      const hl = ui.highlightTrack === t.reportId ? 1 + Math.sin(now * 9) * 0.25 : 1;
      g.ring.scale.setScalar(t.radius * hl); g.disc.scale.setScalar(t.radius * hl);
      g.core.rotation.y = now * 1.4; g.core.position.y = 5.5 + Math.sin(now * 2 + t.pos[0]) * 0.4;
      const op = t.opacity;
      (g.core.material as THREE.MeshBasicMaterial).opacity = op; (g.ring.material as THREE.MeshBasicMaterial).opacity = op * 0.9;
      (g.disc.material as THREE.MeshBasicMaterial).opacity = op * 0.12; (g.pillar.material as THREE.MeshBasicMaterial).opacity = op * 0.5;
      const lp = new THREE.Vector3(t.pos[0], y + 8.6, t.pos[1]);
      const ageTxt = t.age < 1 ? "now" : `${Math.floor(t.age)} min old`;
      const fab = showTruthDetail && t.fabricated ? `<em class="fab">FABRICATED</em>` : "";
      this.label("g-" + t.id, "foe" + (t.age > 8 ? " stale" : ""), `<div class="lbl-sym">${svgFor("SHGPUCA---*****", 24)}</div><div class="lbl-txt"><b>${t.precedence === "FLASH" ? "⚡ " : ""}CONTACT · ${t.label}</b><small>Grade ${t.grade} · Cred ${t.credibility} · <u>${ageTxt}</u></small>${fab}</div>`, lp, 360);
      // picture gap line (instructor / review)
      const gapKey = "gap-" + t.id;
      if (ui.layers.gap && t.truthPos) {
        let ln = this.gapLines.get(gapKey);
        if (!ln) {
          ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: TRUTH, dashSize: 1.2, gapSize: 0.8, transparent: true, opacity: 0.95, fog: false }));
          this.scene.add(ln); this.gapLines.set(gapKey, ln);
        }
        const a = new THREE.Vector3(t.pos[0], y + 1.2, t.pos[1]), b = new THREE.Vector3(t.truthPos[0], terrainHeight(t.truthPos[0], t.truthPos[1]) + 1.2, t.truthPos[1]);
        ln.geometry.setFromPoints([a, b]); ln.computeLineDistances(); ln.visible = true;
        const mid = a.clone().lerp(b, 0.5); mid.y += 4.5;
        this.label(gapKey, "gap", `PICTURE GAP · ${metres(t.gapUnits ?? 0)} m`, mid, 300);
      } else { const ln = this.gapLines.get(gapKey); if (ln) ln.visible = false; }
    }
    for (const [id, g] of this.ghostObjs) if (!alive.has(id)) { this.scene.remove(g.group); g.group.traverse(disposeObj); this.ghostObjs.delete(id); }
    for (const [k, ln] of this.gapLines) if (!ln.visible && !state.tracks.some((t) => "gap-" + t.id === k)) { this.scene.remove(ln); ln.geometry.dispose(); this.gapLines.delete(k); }
  }

  private syncTruth(state: SimState, ui: EngineUi, dt: number, now: number) {
    const has = !!state.truthEnemies && ui.layers.truth;
    if (!has) { if (this.truthGroup) { this.scene.remove(this.truthGroup); this.truthGroup.traverse(disposeObj); this.truthGroup = undefined; this.truthVeh = []; } }
    else {
      if (!this.truthGroup) {
        this.truthGroup = new THREE.Group();
        for (let i = 0; i < state.truthEnemies!.length; i++) {
          const v = this.tank(); v.userData.init = false; this.truthVeh.push(v); this.truthGroup.add(v);
          const ring = this.makeRing(2.7, 3.0, TRUTH, 0.85); ring.position.y = 0.3; v.add(ring);
        }
        this.scene.add(this.truthGroup);
      }
      state.truthEnemies!.forEach((e, i) => {
        const v = this.truthVeh[i]; if (!v) return;
        const tgt = new THREE.Vector3(e.pos[0], terrainHeight(e.pos[0], e.pos[1]), e.pos[1]);
        if (!v.userData.init || v.position.distanceTo(tgt) > 30) { v.position.copy(tgt); v.userData.init = true; }
        const prev = v.position.clone(); v.position.lerp(tgt, 1 - Math.exp(-dt * 3));
        const mv = v.position.clone().sub(prev); v.rotation.y = mv.lengthSq() > 1e-5 ? Math.atan2(mv.x, mv.z) : v.userData.h ?? e.heading; v.userData.h = v.rotation.y;
      });
      const c = this.truthVeh[0]?.position;
      if (c) this.label("truth-lbl", "tru", `<div class="lbl-txt"><b>TRUTH · HOSTILE ×${state.truthEnemies!.length}</b><small>What is really there — Instructor / review only</small></div>`, new THREE.Vector3(c.x, c.y + 13, c.z), 420);
    }
    // jam dome (EW zone) — truth only
    const wantJam = !!state.jam && state.jam.active && ui.layers.jam;
    if (wantJam && !this.jamDome) {
      const grp = new THREE.Group();
      const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
        uniforms: { uTime: { value: 0 } },
        vertexShader: "varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix*normal); vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} ",
        fragmentShader: `varying vec3 vN; varying vec3 vP; uniform float uTime;
          void main(){ float fres = pow(1.0-abs(vN.z),2.2); float scan = smoothstep(0.45,0.5,abs(sin(vP.y*26.0 - uTime*2.5)));
            float a = fres*0.75 + scan*0.1 + 0.05; gl_FragColor = vec4(1.0,0.2,0.22,a*0.8);} `,
      }));
      dome.name = "dome"; grp.add(dome);
      const ground = this.makeRing(0.97, 1, DANGER, 0.95); ground.name = "gring"; grp.add(ground);
      this.jamDome = grp; this.scene.add(grp);
    } else if (!wantJam && this.jamDome) { this.scene.remove(this.jamDome); this.jamDome.traverse(disposeObj); this.jamDome = undefined; }
    if (this.jamDome && state.jam) {
      const r = state.jam.radius, cy = terrainHeight(state.jam.center[0], state.jam.center[1]);
      this.jamDome.position.set(state.jam.center[0], cy, state.jam.center[1]);
      (this.jamDome.getObjectByName("dome") as THREE.Mesh).scale.set(r, r * 0.5, r);
      const gr = this.jamDome.getObjectByName("gring") as THREE.Mesh; gr.scale.set(r, r, r); gr.position.y = 0.4;
      ((this.jamDome.getObjectByName("dome") as THREE.Mesh).material as THREE.ShaderMaterial).uniforms.uTime.value = now;
      this.label("jam-lbl", "jam", `<div class="lbl-txt"><b>ELECTRONIC INTERFERENCE ZONE</b><small>Scripted Jam Net · HAWK 2 → TIGER 1 · shrinking</small></div>`, new THREE.Vector3(state.jam.center[0], cy + r * 0.5 + 3, state.jam.center[1]), 600);
    }
    // spoof marker
    const wantSpoof = !!state.spoofAt && state.truthEnemies !== undefined;
    if (wantSpoof && !this.spoofMark) {
      const g = new THREE.Group();
      g.add(this.makeRing(3.5, 3.9, 0xd96bff, 0.9));
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.7, 7, 4), new THREE.MeshBasicMaterial({ color: 0xd96bff, wireframe: true, fog: false })); spike.position.y = 4; g.add(spike);
      this.spoofMark = g; this.scene.add(g);
    } else if (!wantSpoof && this.spoofMark) { this.scene.remove(this.spoofMark); this.spoofMark.traverse(disposeObj); this.spoofMark = undefined; }
    if (this.spoofMark && state.spoofAt) {
      const y = terrainHeight(state.spoofAt[0], state.spoofAt[1]); this.spoofMark.position.set(state.spoofAt[0], y + 0.3, state.spoofAt[1]); this.spoofMark.rotation.y = now;
      this.label("spoof-lbl", "spoof", `<div class="lbl-txt"><b>SPOOF SOURCE</b><small>No hostile formation is at N BRIDGE</small></div>`, new THREE.Vector3(state.spoofAt[0], y + 9, state.spoofAt[1]), 500);
    }
  }

  private syncPings(ui: EngineUi, now: number) {
    const alive = new Set(ui.pings.map((p) => p.id));
    for (const p of ui.pings) {
      let g = this.pingObjs.get(p.id);
      if (!g) {
        g = new THREE.Group(); g.add(this.makeRing(1.2, 1.5, AMBER, 1));
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 14, 8, 1, true), new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); b.position.y = 7; g.add(b);
        this.scene.add(g); this.pingObjs.set(p.id, g);
      }
      const y = terrainHeight(p.pos[0], p.pos[1]);
      g.position.set(p.pos[0], y + 0.3, p.pos[1]);
      g.children[0].scale.setScalar(1 + ((now - p.t0) % 1.4) * 1.6);
      const sel = this.friendlyObjs.get(ui.selectedId)?.group.position;
      const dm = sel ? metres(dist([sel.x, sel.z], p.pos)) : 0;
      this.label("ping-" + p.id, "ping", `<div class="lbl-txt"><b>▼ ${p.owner} PING</b><small>${dm} m</small></div>`, new THREE.Vector3(p.pos[0], y + 15, p.pos[1]), 700);
    }
    for (const [id, g] of this.pingObjs) if (!alive.has(id)) { this.scene.remove(g); g.traverse(disposeObj); this.pingObjs.delete(id); }
  }

  private syncStatic() {
    const o = (name: string, pos: XZ, cls: string, dist2 = 700) => this.label("pl-" + name, cls, `<div class="lbl-txt"><b>${name}</b></div>`, new THREE.Vector3(pos[0], terrainHeight(pos[0], pos[1]) + (cls === "place-ford" ? 22 : 15), pos[1]), dist2);
    o("FORD", PLACES.ford, "place place-ford"); o("N BRIDGE", PLACES.bridge, "place"); o("SILENT RIDGE", PLACES.ridge, "place"); o("FUP ORCHID", PLACES.fup, "place");
  }

  // ------------------------------------------------------------------ camera
  private bindInput() {
    const el = this.renderer.domElement;
    const kd = (e: KeyboardEvent) => { const t = e.target as HTMLElement; if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return; this.keys.add(e.key.toLowerCase()); };
    const ku = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
    const blur = () => this.keys.clear();
    const pd = (e: PointerEvent) => { el.setPointerCapture(e.pointerId); this.drag = { x: e.clientX, y: e.clientY, moved: 0, button: e.button }; this.orbitIdle = false; };
    const pm = (e: PointerEvent) => {
      if (!this.drag) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y; this.drag.x = e.clientX; this.drag.y = e.clientY; this.drag.moved += Math.abs(dx) + Math.abs(dy);
      if (this.dropT >= 0) return;
      if (e.shiftKey || this.drag.button === 1) { // pan
        const k = this.distGoal * 0.0016; const s = Math.sin(this.yawGoal), c = Math.cos(this.yawGoal);
        this.tgtGoal.x += (-dx * c - dy * s) * k; this.tgtGoal.z += (dx * s - dy * c) * k;
      } else { this.yawGoal -= dx * 0.0052; this.pitchGoal = Math.max(0.14, Math.min(1.5, this.pitchGoal + dy * 0.0042)); }
    };
    const pu = (e: PointerEvent) => {
      if (this.drag && this.drag.moved < 5 && this.drag.button === 0) {
        const p = this.pickGround(e.clientX, e.clientY); if (p) this.onPick?.(p, e.clientX, e.clientY);
      }
      this.drag = null; try { el.releasePointerCapture(e.pointerId); } catch { /* not captured */ }
    };
    const wh = (e: WheelEvent) => { e.preventDefault(); if (this.dropT >= 0) return; this.distGoal = Math.max(9, Math.min(250, this.distGoal * Math.exp(e.deltaY * 0.0012))); };
    const cm = (e: Event) => e.preventDefault();
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku); window.addEventListener("blur", blur);
    el.addEventListener("pointerdown", pd); el.addEventListener("pointermove", pm); el.addEventListener("pointerup", pu); el.addEventListener("wheel", wh, { passive: false }); el.addEventListener("contextmenu", cm);
    this.cleanup.push(() => {
      window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); window.removeEventListener("blur", blur);
      el.removeEventListener("pointerdown", pd); el.removeEventListener("pointermove", pm); el.removeEventListener("pointerup", pu); el.removeEventListener("wheel", wh); el.removeEventListener("contextmenu", cm);
    });
  }

  pickGround(clientX: number, clientY: number): XZ | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, this.camera);
    // march along the ray against the analytic terrain (cheap & exact enough)
    const o = ray.ray.origin, d = ray.ray.direction;
    let prev = 0;
    for (let s = 2; s < 700; s += 2) {
      const x = o.x + d.x * s, y = o.y + d.y * s, z = o.z + d.z * s;
      if (y < terrainHeight(x, z)) {
        let lo = prev, hi = s;
        for (let k = 0; k < 8; k++) { const mid = (lo + hi) / 2; if (o.y + d.y * mid < terrainHeight(o.x + d.x * mid, o.z + d.z * mid)) hi = mid; else lo = mid; }
        const f = (lo + hi) / 2; return [o.x + d.x * f, o.z + d.z * f];
      }
      prev = s;
    }
    return null;
  }

  /** light = bright day; dark = dusk. Same terrain, different sky, fog and light. */
  setTheme(t: Theme) {
    const L = t === "light", u = this.skyMat.uniforms;
    u.top.value.set(L ? 0x4f7ea8 : 0x0d1830); u.mid.value.set(L ? 0xc9d6cf : 0x36465c); u.bot.value.set(L ? 0xd8cdb0 : 0x8a6a58);
    const fog = this.scene.fog as THREE.FogExp2; fog.color.set(L ? 0xb7c4b8 : 0x2a3544); fog.density = L ? 0.0032 : 0.0042;
    (this.scene.background as THREE.Color).set(L ? 0xa9b8b0 : 0x1a2330);
    this.hemi.color.set(L ? 0xcfe0ff : 0x7f94c4); this.hemi.groundColor.set(L ? 0x5a5b3c : 0x2a2d22); this.hemi.intensity = L ? 0.95 : 0.7;
    this.sun.color.set(L ? 0xfff0d6 : 0xffb07a); this.sun.intensity = L ? 2.6 : 1.7;
    this.renderer.toneMappingExposure = L ? 1.05 : 1.1;
    if (this.bloom) this.bloom.strength = L ? 0.4 : 0.7;
  }
  setMode(m: CamMode) { this.mode = m; if (m === "tactical") { this.pitchGoal = 1.38; this.distGoal = Math.max(this.distGoal, 140); } if (m === "free" && this.pitchGoal > 1.2) { this.pitchGoal = 0.62; this.distGoal = 80; } }
  follow(id: string) { this.followId = id; this.setMode("follow"); this.distGoal = Math.min(this.distGoal, 38); this.pitchGoal = Math.min(this.pitchGoal, 0.5); }
  focus(p: XZ, dist2 = 55) { this.mode = this.mode === "follow" ? "free" : this.mode; this.tgtGoal.set(p[0], 0, p[1]); this.distGoal = dist2; }
  setOrbitIdle(on: boolean) { this.orbitIdle = on; }
  startDrop(duration = 6) { this.dropT = 0; this.dropDur = duration; }
  get dropping() { return this.dropT >= 0; }
  endDrop() { this.dropT = -1; this.distGoal = this.distCam = 78; this.pitchGoal = this.pitch = 0.62; }
  setQualityBloom(on: boolean) { if (this.bloom) this.bloom.enabled = on; }
  setFrameCallback(cb: (dt: number) => void) { this.frameCb = cb; }

  private updateCamera(dt: number) {
    if (this.dropT >= 0) {
      this.dropT += dt; const k = Math.min(1, this.dropT / this.dropDur), e = 1 - Math.pow(1 - k, 3);
      this.distGoal = this.distCam = 78 + (1 - e) * 250; this.pitchGoal = this.pitch = 0.62 + (1 - e) * 0.7; this.yawGoal = this.yaw = 0.7 + (1 - e) * 2.4;
      this.tgt.copy(this.tgtGoal);
      this.onDropProgress?.(Math.round((1 - e) * 3200 + 40), k >= 1);
      if (k >= 1) { this.dropT = -1; }
    } else {
      if (this.orbitIdle) this.yawGoal += dt * 0.07;
      const sp = this.distGoal * 0.85 * (this.keys.has("shift") ? 2.4 : 1) * dt, s = Math.sin(this.yawGoal), c = Math.cos(this.yawGoal);
      let mx = 0, mz = 0;
      if (this.keys.has("w") || this.keys.has("arrowup")) { mx -= s; mz -= c; }
      if (this.keys.has("s") || this.keys.has("arrowdown")) { mx += s; mz += c; }
      if (this.keys.has("a") || this.keys.has("arrowleft")) { mx -= c; mz += s; }
      if (this.keys.has("d") || this.keys.has("arrowright")) { mx += c; mz -= s; }
      if (mx || mz) { this.tgtGoal.x += mx * sp; this.tgtGoal.z += mz * sp; if (this.mode === "follow") this.mode = "free"; }
      if (this.keys.has("q")) this.yawGoal += dt * 1.4; if (this.keys.has("e")) this.yawGoal -= dt * 1.4;
      if (this.keys.has("r") === false && this.keys.has("pageup")) this.distGoal = Math.max(9, this.distGoal - dt * 90);
      if (this.keys.has("pagedown")) this.distGoal = Math.min(250, this.distGoal + dt * 90);
      if (this.mode === "follow") { const o = this.friendlyObjs.get(this.followId); if (o) this.tgtGoal.set(o.group.position.x, 0, o.group.position.z); }
      this.tgtGoal.x = Math.max(-WORLD_W / 2, Math.min(WORLD_W / 2, this.tgtGoal.x)); this.tgtGoal.z = Math.max(-WORLD_D / 2, Math.min(WORLD_D / 2, this.tgtGoal.z));
      const k = 1 - Math.exp(-dt * 7);
      this.tgt.lerp(this.tgtGoal, k); this.yaw += (this.yawGoal - this.yaw) * k; this.pitch += (this.pitchGoal - this.pitch) * k; this.distCam += (this.distGoal - this.distCam) * k;
    }
    const ty = terrainHeight(this.tgt.x, this.tgt.z) + 2;
    const cp = Math.cos(this.pitch), sp2 = Math.sin(this.pitch);
    this.camera.position.set(this.tgt.x + Math.sin(this.yaw) * cp * this.distCam, ty + sp2 * this.distCam, this.tgt.z + Math.cos(this.yaw) * cp * this.distCam);
    const floor = terrainHeight(this.camera.position.x, this.camera.position.z) + 2.2;
    if (this.camera.position.y < floor) this.camera.position.y = floor;
    this.camera.lookAt(this.tgt.x, ty, this.tgt.z);
    // keep the shadow frustum on what we are looking at
    this.sun.target.position.set(this.tgt.x, 0, this.tgt.z);
    this.sun.position.set(this.tgt.x - 90, 120, this.tgt.z + 110);
    this.dust.position.set(this.tgt.x, 0, this.tgt.z);
  }

  get cameraInfo() { return { target: [this.tgt.x, this.tgt.z] as XZ, yaw: this.yaw, pitch: this.pitch, dist: this.distCam, bearing: (((-this.yaw * 180) / Math.PI) % 360 + 360) % 360 }; }

  // ------------------------------------------------------------------ public frame
  render(state: SimState, ui: EngineUi, dt: number) {
    if (this.disposed) return;
    this.clock += dt; const now = this.clock;
    this.waterTex.offset.y -= dt * 0.25;
    const fr = this.scene.getObjectByName("fordRing"); if (fr) fr.scale.setScalar(1 + Math.sin(now * 2.2) * 0.04);
    this.beams.forEach((b, i) => { (b.material as THREE.MeshBasicMaterial).opacity = 0.75 + Math.sin(now * 1.5 + i) * 0.15; });
    this.syncFriendlies(state, ui, dt, now); this.syncTracks(state, ui, now); this.syncTruth(state, ui, dt, now); this.syncPings(ui, now); this.syncStatic();
    this.updateCamera(dt);
    this.projectLabels();
    if (this.composer) this.composer.render(dt); else this.renderer.render(this.scene, this.camera);
    this.frameCb?.(dt);
  }

  resize() {
    const w = Math.max(2, this.container.clientWidth), h = Math.max(2, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = "100%"; this.renderer.domElement.style.height = "100%";
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.composer?.setSize(w, h); this.bloom?.resolution.set(w, h);
  }

  dispose() {
    this.disposed = true;
    this.cleanup.forEach((f) => f());
    this.labels.forEach((l) => l.el.remove()); this.labels.clear();
    this.scene.traverse(disposeObj);
    this.composer?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

function disposeObj(o: THREE.Object3D) {
  const m = o as THREE.Mesh;
  if (m.geometry) m.geometry.dispose();
  const mat = m.material as THREE.Material | THREE.Material[] | undefined;
  if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose?.();
}

export type { Track };
