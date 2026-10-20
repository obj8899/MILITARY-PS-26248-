import { PLACES, RIVER, TRACKS, WORLD_D, WORLD_W, terrainHeight, type XZ } from "./world";
import type { SimState } from "./sim";
import type { PingMark } from "./engine";

let base: HTMLCanvasElement | null = null;
const MW = 300, MH = Math.round((300 * WORLD_D) / WORLD_W);

export const toMap = (p: XZ, w = MW, h = MH): [number, number] => [(p[0] / WORLD_W + 0.5) * w, (p[1] / WORLD_D + 0.5) * h];
export const fromMap = (px: number, py: number, w: number, h: number): XZ => [(px / w - 0.5) * WORLD_W, (py / h - 0.5) * WORLD_D];

/** Hill-shaded terrain, river and tracks, rendered once. */
function buildBase(): HTMLCanvasElement {
  if (base) return base;
  const cv = document.createElement("canvas"); cv.width = MW; cv.height = MH;
  const g = cv.getContext("2d")!; const img = g.createImageData(MW, MH);
  const H = (x: number, y: number) => { const p = fromMap(x, y, MW, MH); return terrainHeight(p[0], p[1]); };
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const h = H(x, y), shade = (H(x - 1, y - 1) - H(x + 1, y + 1)) * 0.9;
    const k = Math.max(0, Math.min(1, (h + 1) / 30));
    const r = 36 + k * 90 + shade * 11, gr = 62 + k * 70 + shade * 11, b = 40 + k * 55 + shade * 9;
    const i = (y * MW + x) * 4;
    img.data[i] = r; img.data[i + 1] = gr; img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.strokeStyle = "rgba(60,150,185,0.95)"; g.lineWidth = 3.2; g.lineJoin = "round"; g.beginPath();
  RIVER.forEach((p, i) => { const [x, y] = toMap(p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
  g.strokeStyle = "rgba(210,190,140,0.65)"; g.lineWidth = 1.2;
  for (const t of TRACKS) { g.beginPath(); t.forEach((p, i) => { const [x, y] = toMap(p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); }
  base = cv; return cv;
}

export function drawMinimap(canvas: HTMLCanvasElement, state: SimState, opts: { cam: { target: XZ; yaw: number; dist: number }; pings: PingMark[]; showTruth: boolean; selectedId: string }) {
  const g = canvas.getContext("2d"); if (!g) return;
  const w = canvas.width, h = canvas.height;
  g.clearRect(0, 0, w, h); g.drawImage(buildBase(), 0, 0, w, h);
  const P = (p: XZ) => toMap(p, w, h);

  // objectives
  g.font = "bold 9px Bahnschrift, Arial Narrow, sans-serif"; g.textAlign = "center";
  const obj: [string, XZ, string][] = [["FORD", PLACES.ford, "#f5b942"], ["N BRIDGE", PLACES.bridge, "#e8efe6"], ["RIDGE", PLACES.ridge, "#e8efe6"], ["FUP", PLACES.fup, "#e8efe6"]];
  for (const [n, p, c] of obj) {
    const [x, y] = P(p); g.strokeStyle = c; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, n === "FORD" ? 6 : 4, 0, 6.3); g.stroke();
    g.fillStyle = "rgba(5,10,8,0.7)"; g.fillText(n, x + 1, y - 8.5); g.fillStyle = c; g.fillText(n, x, y - 9.5);
  }

  // jam zone (truth only)
  if (state.jam?.active && opts.showTruth) {
    const [x, y] = P(state.jam.center); const r = (state.jam.radius / WORLD_W) * w;
    g.fillStyle = "rgba(229,72,77,0.18)"; g.strokeStyle = "#e5484d"; g.lineWidth = 1.6; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); g.stroke();
  }
  // perceived tracks
  for (const t of state.tracks) {
    const [x, y] = P(t.pos); const r = Math.max(5, (t.radius / WORLD_W) * w);
    g.fillStyle = `rgba(229,72,77,${0.12 * t.opacity})`; g.strokeStyle = `rgba(229,72,77,${0.85 * t.opacity})`; g.lineWidth = 1.2;
    g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); g.stroke();
    g.fillStyle = `rgba(229,72,77,${t.opacity})`; g.beginPath(); g.moveTo(x, y - 4.5); g.lineTo(x + 4.5, y); g.lineTo(x, y + 4.5); g.lineTo(x - 4.5, y); g.closePath(); g.fill();
    if (opts.showTruth && t.truthPos) { const [tx, ty] = P(t.truthPos); g.strokeStyle = "#5eead4"; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(x, y); g.lineTo(tx, ty); g.stroke(); g.setLineDash([]); }
  }
  // truth enemies
  if (opts.showTruth && state.truthEnemies) for (const e of state.truthEnemies) {
    const [x, y] = P(e.pos); g.strokeStyle = "#5eead4"; g.lineWidth = 1.6; g.strokeRect(x - 3.5, y - 3.5, 7, 7);
  }
  // friendlies
  for (const f of state.friendlies) {
    const [x, y] = P(f.pos); const sel = f.id === opts.selectedId;
    g.fillStyle = "#7db6ff"; g.strokeStyle = sel ? "#f5b942" : "#04120d"; g.lineWidth = sel ? 2 : 1;
    if (f.kind === "uas") { g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x + 5, y + 4); g.lineTo(x - 5, y + 4); g.closePath(); } else g.rect(x - 4, y - 4, 8, 8);
    g.fill(); g.stroke();
  }
  // pings
  for (const p of opts.pings) { const [x, y] = P(p.pos); g.strokeStyle = "#f5b942"; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, 6, 0, 6.3); g.stroke(); g.fillStyle = "#f5b942"; g.fillText("▼", x, y - 8); }

  // camera view cone
  const [cx, cy] = P(opts.cam.target); const fov = 0.8, len = Math.min(70, 18 + opts.cam.dist * 0.28) * (w / WORLD_W);
  const dir = Math.atan2(-Math.cos(opts.cam.yaw), -Math.sin(opts.cam.yaw));
  g.fillStyle = "rgba(255,255,255,0.14)"; g.strokeStyle = "rgba(255,255,255,0.7)"; g.lineWidth = 1;
  g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, len, dir - fov / 2, dir + fov / 2); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = "#fff"; g.beginPath(); g.arc(cx, cy, 2.4, 0, 6.3); g.fill();
  // grid
  g.strokeStyle = "rgba(232,239,230,0.12)"; g.lineWidth = 1; g.beginPath();
  for (let i = 1; i < 6; i++) { g.moveTo((w / 6) * i, 0); g.lineTo((w / 6) * i, h); g.moveTo(0, (h / 6) * i); g.lineTo(w, (h / 6) * i); } g.stroke();
}
