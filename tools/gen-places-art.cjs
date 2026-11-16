// Draws the art of the places added in 1.3.0 (assets/terrain/<id>.svg), in the style of the 1.0 cards:
// 200 x 280, flat shapes with gradients and a soft vignette. Not shipped in the module zip.
// node tools/gen-places-art.cjs [module-root]   (default: the folder above tools/)
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = process.argv[2] ?? path.join(__dirname, "..");
const W = 200, H = 280;
const f = n => Math.round(n * 10) / 10;

function rng(seed) {
  let a = 0;
  for ( const ch of String(seed) ) a = (Math.imul(a ^ ch.charCodeAt(0), 2654435761) + 0x9E3779B9) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/*  Scene: collects gradients and shapes                               */
/* ------------------------------------------------------------------ */

class Scene {
  constructor(id) {
    this.defs = [];
    this.body = [];
    this.n = 0;
    this.r = rng(id);
  }
  lin(stops, x2 = 0, y2 = 1) {
    const id = `g${++this.n}`;
    this.defs.push(`<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map((c, i) => stop(c, i, stops.length)).join("")}</linearGradient>`);
    return `url(#${id})`;
  }
  rad(stops, cx = 0.5, cy = 0.5, r = 0.6) {
    const id = `g${++this.n}`;
    this.defs.push(`<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map((c, i) => stop(c, i, stops.length)).join("")}</radialGradient>`);
    return `url(#${id})`;
  }
  add(...parts) {
    this.body.push(...parts);
    return this;
  }
  svg() {
    const vig = this.rad([["#000", 0, 0.55], ["#000", 0.28, 1]], 0.5, 0.5, 0.75);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><defs>${this.defs.join("")}</defs>${this.body.join("")}<rect width="${W}" height="${H}" fill="${vig}"/></svg>\n`;
  }
}

/** A stop: "#hex", or [color, opacity], or [color, opacity, offset]. */
function stop(c, i, n) {
  const [color, op, off] = Array.isArray(c) ? c : [c, undefined, undefined];
  const o = off ?? (n === 1 ? 0 : i / (n - 1));
  return `<stop offset="${f(o)}" stop-color="${color}"${op !== undefined ? ` stop-opacity="${op}"` : ""}/>`;
}

/* ------------------------------------------------------------------ */
/*  Backgrounds                                                        */
/* ------------------------------------------------------------------ */

const SKY = {
  day: ["#a9cfe6", "#e8f2f4"],
  bright: ["#6fb2e6", "#d7eefb"],
  dusk: ["#41355c", "#b46a5d", "#f0b46b"],
  night: ["#0b1430", "#26355e"],
  storm: ["#4a4f5c", "#8a8f99"],
  magic: ["#2a1d4f", "#6a4a9a", "#c79ad8"],
  dream: ["#f6c6e0", "#c8b6f2", "#a8e0f0"],
  hell: ["#1a0606", "#5a1410", "#b8361e"],
  space: ["#04040e", "#141836"],
  gold: ["#f6e6b0", "#fff8e0"],
  toxic: ["#2c2a3e", "#5a4a6a", "#7a8a5a"],
  ice: ["#cfe4f2", "#f4f9fc"],
  desert: ["#f0c88a", "#fbe6c0"],
  grey: ["#8a8c94", "#c4c6cc"],
  mars: ["#6a2a2a", "#c8643a", "#f0a060"]
};

function sky(S, kind) {
  return `<rect width="${W}" height="${H}" fill="${S.lin(SKY[kind] ?? kind)}"/>`;
}
function ground(S, y, top, bottom, curve = 0) {
  const fill = S.lin([top, bottom]);
  if ( !curve ) return `<rect y="${y}" width="${W}" height="${H - y}" fill="${fill}"/>`;
  return `<path d="M0 ${y} Q 100 ${y - curve} 200 ${y} L200 ${H} L0 ${H} Z" fill="${fill}"/>`;
}
function band(y, color, amp = 10, op = 1, seed = 0) {
  return `<path d="M0 ${y} C 40 ${y - amp - seed}, 80 ${y + amp}, 120 ${y - amp * 0.4} S 180 ${y - amp}, 200 ${y + amp * 0.3} L200 ${H} L0 ${H} Z" fill="${color}" opacity="${op}"/>`;
}
function stars(S, n, area = [0, 0, W, 150], color = "#fff") {
  let s = "";
  for ( let i = 0; i < n; i++ ) s += `<circle cx="${f(area[0] + S.r() * area[2])}" cy="${f(area[1] + S.r() * area[3])}" r="${f(0.5 + S.r() * 1.1)}" fill="${color}" opacity="${f(0.5 + S.r() * 0.5)}"/>`;
  return s;
}
function cloud(x, y, s = 1, color = "#fff", op = 0.85) {
  return `<g fill="${color}" opacity="${op}"><ellipse cx="${x}" cy="${y}" rx="${18 * s}" ry="${8 * s}"/><ellipse cx="${f(x + 12 * s)}" cy="${f(y - 5 * s)}" rx="${12 * s}" ry="${8 * s}"/><ellipse cx="${f(x - 12 * s)}" cy="${f(y - 2 * s)}" rx="${10 * s}" ry="${6 * s}"/></g>`;
}
function orb(S, x, y, r, color, glow = true) {
  return (glow ? `<circle cx="${x}" cy="${y}" r="${r * 2.6}" fill="${S.rad([[color, 0.45], [color, 0]])}"/>` : "") + `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`;
}
function glow(S, x, y, rx, ry, color, op = 0.55) {
  return `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${S.rad([[color, op], [color, 0]])}"/>`;
}
function water(S, y, top = "#3f86b8", bottom = "#1f4f7a", waves = 6) {
  let w = `<rect y="${y}" width="${W}" height="${H - y}" fill="${S.lin([top, bottom])}"/>`;
  for ( let i = 0; i < waves; i++ ) {
    const wy = y + 10 + (i * (H - y - 10)) / waves;
    const wx = 10 + S.r() * 150;
    w += `<path d="M${f(wx)} ${f(wy)} q 8 -6 16 0 q 6 4 12 0" stroke="#d9f0fb" stroke-width="2" fill="none" opacity="0.6" stroke-linecap="round"/>`;
  }
  return w;
}
function peak(x, base, w, h, light, dark, snow = null) {
  let s = `<path d="M${x - w} ${base} L${x} ${base - h} L${x + w} ${base} Z" fill="${dark}"/><path d="M${x - w} ${base} L${x} ${base - h} L${f(x + w * 0.15)} ${base} Z" fill="${light}"/>`;
  if ( snow ) s += `<path d="M${x} ${base - h} L${f(x - w * 0.32)} ${f(base - h * 0.68)} L${f(x - w * 0.12)} ${f(base - h * 0.74)} L${f(x + w * 0.02)} ${f(base - h * 0.64)} L${f(x + w * 0.16)} ${f(base - h * 0.72)} L${f(x + w * 0.3)} ${f(base - h * 0.7)} Z" fill="${snow}"/>`;
  return s;
}
function bricks(S, x, y, w, h, color, mortar, bw = 26, bh = 13) {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}"/>`;
  for ( let row = 0, yy = y; yy < y + h; row++, yy += bh ) {
    s += `<path d="M${x} ${yy} H${x + w}" stroke="${mortar}" stroke-width="1.2"/>`;
    for ( let xx = x + (row % 2 ? bw / 2 : 0); xx < x + w; xx += bw ) s += `<path d="M${f(xx)} ${yy} V${Math.min(y + h, yy + bh)}" stroke="${mortar}" stroke-width="1.2"/>`;
  }
  return s;
}
function floor(S, y, color, line) {
  let s = `<path d="M0 ${H} L0 ${y + 20} L200 ${y + 20} L200 ${H} Z" fill="${color}"/><path d="M0 ${y + 20} L200 ${y + 20}" stroke="${line}" stroke-width="1.5"/>`;
  for ( let i = -4; i <= 4; i++ ) s += `<path d="M${100 + i * 14} ${y + 20} L${100 + i * 60} ${H}" stroke="${line}" stroke-width="1" opacity="0.6"/>`;
  for ( let k = 1; k < 5; k++ ) {
    const yy = y + 20 + ((H - y - 20) * (k * k)) / 25;
    s += `<path d="M0 ${f(yy)} H200" stroke="${line}" stroke-width="1" opacity="0.5"/>`;
  }
  return s;
}

/* ------------------------------------------------------------------ */
/*  Nature                                                             */
/* ------------------------------------------------------------------ */

function roundTree(x, y, s = 1, leaf = "#3f7a35", light = "#6fae4f") {
  return `<rect x="${f(x - 2 * s)}" y="${y}" width="${f(4 * s)}" height="${f(12 * s)}" fill="#5a3b22"/><circle cx="${x}" cy="${f(y - 4 * s)}" r="${f(12 * s)}" fill="${leaf}"/><circle cx="${f(x - 4 * s)}" cy="${f(y - 8 * s)}" r="${f(6 * s)}" fill="${light}" opacity="0.6"/>`;
}
function pine(x, base, h, color, snow = null) {
  const w = h * 0.42;
  let d = "";
  for ( let t = 0; t < 3; t++ ) {
    const top = base - h + t * h * 0.24, bot = base - h * 0.28 + t * h * 0.28, ww = w * (0.55 + t * 0.25);
    d += `M${f(x)} ${f(top)} L${f(x + ww)} ${f(bot)} L${f(x - ww)} ${f(bot)} Z `;
  }
  let s = `<path d="${d}" fill="${color}"/><rect x="${f(x - 2)}" y="${f(base - 4)}" width="4" height="8" fill="#3b2a1a"/>`;
  if ( snow ) s += `<path d="M${f(x)} ${f(base - h)} L${f(x + w * 0.3)} ${f(base - h * 0.78)} L${f(x - w * 0.3)} ${f(base - h * 0.78)} Z" fill="${snow}"/>`;
  return s;
}
function palm(x, base, h, lean = 1) {
  const tx = x + lean * h * 0.25, ty = base - h;
  let s = `<path d="M${x} ${base} Q ${f(x + lean * h * 0.05)} ${f(base - h * 0.5)} ${f(tx)} ${f(ty)}" stroke="#7a5230" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  for ( const a of [-150, -110, -60, -20, 20] ) {
    const r = (a * Math.PI) / 180, L = h * 0.42;
    s += `<path d="M${f(tx)} ${f(ty)} Q ${f(tx + Math.cos(r) * L * 0.6)} ${f(ty + Math.sin(r) * L * 0.6 - 8)} ${f(tx + Math.cos(r) * L)} ${f(ty + Math.sin(r) * L + 6)}" stroke="#3f8a3a" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  }
  return s;
}
function deadTree(x, base, h, color = "#3a2e28") {
  return `<path d="M${x} ${base} L${x} ${base - h} M${x} ${f(base - h * 0.6)} L${f(x - h * 0.3)} ${f(base - h * 0.85)} M${x} ${f(base - h * 0.45)} L${f(x + h * 0.32)} ${f(base - h * 0.75)} M${f(x + h * 0.18)} ${f(base - h * 0.62)} L${f(x + h * 0.3)} ${f(base - h * 0.95)} M${x} ${f(base - h * 0.85)} L${f(x - h * 0.12)} ${f(base - h * 1.05)}" stroke="${color}" stroke-width="${f(h * 0.06)}" stroke-linecap="round" fill="none"/>`;
}
function mushroom(x, base, s, cap = "#d8483a", dots = "#fff") {
  return `<rect x="${f(x - 3 * s)}" y="${f(base - 10 * s)}" width="${f(6 * s)}" height="${f(10 * s)}" rx="${f(2 * s)}" fill="#f2e6cc"/><path d="M${f(x - 11 * s)} ${f(base - 9 * s)} Q ${x} ${f(base - 24 * s)} ${f(x + 11 * s)} ${f(base - 9 * s)} Z" fill="${cap}"/><circle cx="${f(x - 4 * s)}" cy="${f(base - 14 * s)}" r="${f(1.6 * s)}" fill="${dots}"/><circle cx="${f(x + 4 * s)}" cy="${f(base - 15 * s)}" r="${f(1.3 * s)}" fill="${dots}"/>`;
}
function flowers(S, n, area, colors) {
  let s = "";
  for ( let i = 0; i < n; i++ ) {
    const x = area[0] + S.r() * area[2], y = area[1] + S.r() * area[3], c = colors[i % colors.length];
    s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(1.6 + S.r() * 1.6)}" fill="${c}"/>`;
  }
  return s;
}
function tufts(S, n, area, color) {
  let s = "";
  for ( let i = 0; i < n; i++ ) {
    const x = area[0] + S.r() * area[2], y = area[1] + S.r() * area[3];
    s += `<path d="M${f(x - 3)} ${f(y)} l1.5 -5 M${f(x)} ${f(y)} l0.4 -7 M${f(x + 3)} ${f(y)} l-1 -5" stroke="${color}" stroke-width="1.2" stroke-linecap="round" fill="none"/>`;
  }
  return s;
}
function crystal(x, base, w, h, color, light = "#fff") {
  return `<path d="M${f(x - w / 2)} ${base} L${f(x - w / 2)} ${f(base - h * 0.7)} L${x} ${base - h} L${f(x + w / 2)} ${f(base - h * 0.7)} L${f(x + w / 2)} ${base} Z" fill="${color}"/><path d="M${x} ${base - h} L${f(x + w / 2)} ${f(base - h * 0.7)} L${f(x + w / 2)} ${base} L${x} ${base} Z" fill="#000" opacity="0.18"/><path d="M${f(x - w / 4)} ${f(base - h * 0.65)} L${f(x - w / 4)} ${f(base - h * 0.15)}" stroke="${light}" stroke-width="${f(Math.max(1, w * 0.12))}" opacity="0.55" stroke-linecap="round"/>`;
}
function rock(x, y, s, color = "#6a6a70") {
  return `<path d="M${f(x - 10 * s)} ${y} L${f(x - 6 * s)} ${f(y - 8 * s)} L${f(x + 4 * s)} ${f(y - 10 * s)} L${f(x + 11 * s)} ${f(y - 2 * s)} L${f(x + 9 * s)} ${y} Z" fill="${color}"/><path d="M${f(x - 6 * s)} ${f(y - 8 * s)} L${f(x + 4 * s)} ${f(y - 10 * s)} L${f(x + 2 * s)} ${f(y - 4 * s)} Z" fill="#fff" opacity="0.18"/>`;
}
function dragon(x, y, s, color = "#2a1a1a") {
  return `<g transform="translate(${x} ${y}) scale(${s})" fill="${color}"><path d="M-30 0 Q -10 -4 0 0 Q 12 4 28 -2 L36 -6 L32 0 L38 2 L28 3 Q 12 8 0 6 Q -14 4 -30 0 Z"/><path d="M-4 0 L-26 -26 L-12 -6 L-18 -30 L0 -4 Z"/><path d="M6 2 L16 -22 L14 -4 L26 -20 L12 4 Z" opacity="0.8"/><path d="M-30 0 Q -40 2 -46 -4" stroke="${color}" stroke-width="3" fill="none"/></g>`;
}
function bird(x, y, s, color = "#2a2a2a") {
  return `<path d="M${f(x - 6 * s)} ${y} Q ${f(x - 3 * s)} ${f(y - 4 * s)} ${x} ${y} Q ${f(x + 3 * s)} ${f(y - 4 * s)} ${f(x + 6 * s)} ${y}" stroke="${color}" stroke-width="${f(1.4 * s)}" fill="none"/>`;
}

/* ------------------------------------------------------------------ */
/*  Buildings                                                          */
/* ------------------------------------------------------------------ */

function house(x, y, w, h, roof, wall = "#f1e3c4", lit = "#ffd77a") {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${wall}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#000" opacity="0.06"/>`
    + `<path d="M${x - 5} ${y + 2} L${f(x + w / 2)} ${f(y - h * 0.7)} L${x + w + 5} ${y + 2} Z" fill="${roof}"/><path d="M${f(x + w / 2)} ${f(y - h * 0.7)} L${x + w + 5} ${y + 2} L${f(x + w / 2)} ${y + 2} Z" fill="#000" opacity="0.15"/>`
    + `<rect x="${f(x + w * 0.4)}" y="${f(y + h * 0.45)}" width="${f(w * 0.22)}" height="${f(h * 0.55)}" fill="#6b4226"/><rect x="${f(x + w * 0.1)}" y="${f(y + h * 0.22)}" width="${f(w * 0.18)}" height="${f(h * 0.2)}" fill="${lit}"/><rect x="${f(x + w * 0.72)}" y="${f(y + h * 0.22)}" width="${f(w * 0.18)}" height="${f(h * 0.2)}" fill="${lit}"/>`;
}
function tower(x, y, w, h, wall, roof, flag = "#e04a3a") {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${wall}"/><rect x="${f(x + w * 0.55)}" y="${y}" width="${f(w * 0.45)}" height="${h}" fill="#000" opacity="0.12"/>`
    + `<path d="M${x - 4} ${y} L${f(x + w / 2)} ${f(y - w * 1.3)} L${x + w + 4} ${y} Z" fill="${roof}"/><rect x="${f(x + w * 0.35)}" y="${y + 12}" width="${f(w * 0.3)}" height="10" rx="4" fill="#3b3a4a"/>`
    + (flag ? `<path d="M${f(x + w / 2)} ${f(y - w * 1.3)} l0 -12 l10 4 l-10 4" stroke="#5a3b22" fill="${flag}"/>` : "");
}
function crenels(x1, x2, y, color, step = 14) {
  let s = "";
  for ( let x = x1; x < x2; x += step ) s += `<rect x="${x}" y="${y - 8}" width="${f(step * 0.6)}" height="9" fill="${color}"/>`;
  return s;
}
function wall(S, y, h, color, mortar = "#8d8578") {
  return crenels(4, 200, y, color, 16) + bricks(S, 0, y, W, h, color, mortar, 22, 11);
}
function gate(x, base, w, h, frame = "#6a6470", hole = "#1a1620") {
  return `<path d="M${x - w / 2} ${base} L${x - w / 2} ${base - h + w / 2} Q ${x} ${base - h - w * 0.15} ${x + w / 2} ${base - h + w / 2} L${x + w / 2} ${base} Z" fill="${frame}"/><path d="M${f(x - w * 0.36)} ${base} L${f(x - w * 0.36)} ${f(base - h + w * 0.48)} Q ${x} ${f(base - h + w * 0.05)} ${f(x + w * 0.36)} ${f(base - h + w * 0.48)} L${f(x + w * 0.36)} ${base} Z" fill="${hole}"/>`;
}
function column(x, y, h, color = "#d6d0c4", broken = false) {
  return `<rect x="${x}" y="${y}" width="16" height="${h}" fill="${color}"/><rect x="${x + 10}" y="${y}" width="6" height="${h}" fill="#000" opacity="0.13"/><path d="M${x + 4} ${y} V${y + h} M${x + 8} ${y} V${y + h}" stroke="#000" stroke-opacity="0.12" stroke-width="1.2"/>`
    + (broken ? `<path d="M${x - 2} ${y} L${x + 4} ${y - 7} L${x + 10} ${y - 2} L${x + 18} ${y - 9} L${x + 18} ${y} Z" fill="${color}"/>` : `<rect x="${x - 4}" y="${y - 7}" width="24" height="8" fill="${color}"/>`)
    + `<rect x="${x - 4}" y="${y + h}" width="24" height="7" fill="${color}"/><rect x="${x - 4}" y="${y + h}" width="24" height="7" fill="#000" opacity="0.1"/>`;
}
function temple(x, base, w, h, color = "#e2ddd2", roofColor = "#c4bdae") {
  const cols = 4;
  let s = `<path d="M${x - w / 2 - 6} ${base - h} L${x} ${base - h - w * 0.28} L${x + w / 2 + 6} ${base - h} Z" fill="${roofColor}"/><rect x="${x - w / 2 - 6}" y="${base - h}" width="${w + 12}" height="8" fill="${color}"/>`;
  for ( let i = 0; i < cols; i++ ) s += `<rect x="${f(x - w / 2 + i * (w - 10) / (cols - 1))}" y="${base - h + 8}" width="10" height="${h - 14}" fill="${color}"/><rect x="${f(x - w / 2 + i * (w - 10) / (cols - 1) + 6)}" y="${base - h + 8}" width="4" height="${h - 14}" fill="#000" opacity="0.12"/>`;
  return s + `<rect x="${x - w / 2 - 8}" y="${base - 6}" width="${w + 16}" height="6" fill="${roofColor}"/>`;
}
function dome(x, base, w, h, color, top = "#e6b73c") {
  return `<path d="M${x - w / 2} ${base} L${x - w / 2} ${base - h * 0.5} Q ${x - w / 2} ${base - h} ${x} ${base - h} Q ${x + w / 2} ${base - h} ${x + w / 2} ${base - h * 0.5} L${x + w / 2} ${base} Z" fill="${color}"/><path d="M${x} ${base - h} Q ${x + w / 2} ${base - h} ${x + w / 2} ${base - h * 0.5} L${x + w / 2} ${base} L${x} ${base} Z" fill="#000" opacity="0.12"/><rect x="${x - 1.5}" y="${base - h - 12}" width="3" height="12" fill="${top}"/><circle cx="${x}" cy="${base - h - 13}" r="3" fill="${top}"/>`;
}
function spire(x, base, w, h, color, roof) {
  return `<rect x="${x - w / 2}" y="${base - h * 0.55}" width="${w}" height="${h * 0.55}" fill="${color}"/><path d="M${x - w / 2 - 2} ${base - h * 0.55} L${x} ${base - h} L${x + w / 2 + 2} ${base - h * 0.55} Z" fill="${roof}"/><circle cx="${x}" cy="${f(base - h * 0.38)}" r="${f(w * 0.22)}" fill="#7fc1e8" stroke="#e6b73c" stroke-width="1.5"/>`;
}
function pyramid(x, base, w, h, color = "#d8b878") {
  let s = `<path d="M${x - w / 2} ${base} L${x} ${base - h} L${x + w / 2} ${base} Z" fill="${color}"/><path d="M${x} ${base - h} L${x + w / 2} ${base} L${x} ${base} Z" fill="#000" opacity="0.18"/>`;
  for ( let k = 1; k < 5; k++ ) {
    const yy = base - (h * k) / 5, half = (w / 2) * (1 - k / 5);
    s += `<path d="M${f(x - half)} ${f(yy)} H${f(x + half)}" stroke="#000" stroke-opacity="0.15" stroke-width="1.2"/>`;
  }
  return s;
}
function hut(x, base, w, h, color = "#b8864a", roof = "#8a6a3a") {
  return `<rect x="${x - w / 2}" y="${base - h * 0.45}" width="${w}" height="${h * 0.45}" fill="${color}"/><path d="M${x - w / 2 - 6} ${f(base - h * 0.4)} L${x} ${base - h} L${x + w / 2 + 6} ${f(base - h * 0.4)} Z" fill="${roof}"/><path d="M${x} ${base - h} l-4 -6 M${x} ${base - h} l4 -6" stroke="${roof}" stroke-width="2"/><path d="M${x - 4} ${base} L${x - 4} ${base - h * 0.28} Q ${x} ${base - h * 0.36} ${x + 4} ${base - h * 0.28} L${x + 4} ${base} Z" fill="#3a2414"/>`;
}
function factory(x, base, w, h, color = "#8a6a5a") {
  let s = `<rect x="${x}" y="${base - h}" width="${w}" height="${h}" fill="${color}"/>`;
  const teeth = 3;
  for ( let i = 0; i < teeth; i++ ) {
    const tx = x + (i * w) / teeth;
    s += `<path d="M${f(tx)} ${base - h} L${f(tx + w / teeth)} ${base - h - 14} L${f(tx + w / teeth)} ${base - h} Z" fill="${color}"/><path d="M${f(tx + w / teeth - 3)} ${base - h - 12} L${f(tx + w / teeth)} ${base - h - 14} L${f(tx + w / teeth)} ${base - h} L${f(tx + w / teeth - 3)} ${base - h} Z" fill="#9fd0ff" opacity="0.5"/>`;
  }
  for ( let i = 0; i < 4; i++ ) s += `<rect x="${f(x + 6 + i * (w - 12) / 4)}" y="${base - h * 0.55}" width="${f((w - 12) / 4 - 4)}" height="8" fill="#ffd77a" opacity="0.8"/>`;
  return s;
}
function chimney(S, x, base, w, h, color = "#6a4a3a", smoke = "#8a8a8a") {
  let s = `<rect x="${x}" y="${base - h}" width="${w}" height="${h}" fill="${color}"/><rect x="${x - 2}" y="${base - h}" width="${w + 4}" height="5" fill="#000" opacity="0.25"/>`;
  for ( let i = 0; i < 5; i++ ) s += `<circle cx="${f(x + w / 2 + i * 5 + S.r() * 6)}" cy="${f(base - h - 8 - i * 11)}" r="${f(6 + i * 2.2)}" fill="${smoke}" opacity="${f(0.6 - i * 0.09)}"/>`;
  return s;
}
function skyscraper(S, x, base, w, h, color = "#2a2440", lit = "#ff4ae0") {
  let s = `<rect x="${x}" y="${base - h}" width="${w}" height="${h}" fill="${color}"/>`;
  for ( let yy = base - h + 6; yy < base - 6; yy += 9 ) {
    for ( let xx = x + 4; xx < x + w - 5; xx += 7 ) if ( S.r() < 0.55 ) s += `<rect x="${xx}" y="${yy}" width="4" height="5" fill="${S.r() < 0.5 ? lit : "#4af0ff"}" opacity="${f(0.55 + S.r() * 0.45)}"/>`;
  }
  return s;
}
function gear(cx, cy, r, color, teeth = 8) {
  let d = "";
  for ( let i = 0; i < teeth * 2; i++ ) {
    const a = (i * Math.PI) / teeth, rr = i % 2 ? r : r * 1.22;
    const a1 = a - Math.PI / (teeth * 2.4), a2 = a + Math.PI / (teeth * 2.4);
    d += `${i ? "L" : "M"}${f(cx + Math.cos(a1) * rr)} ${f(cy + Math.sin(a1) * rr)} L${f(cx + Math.cos(a2) * rr)} ${f(cy + Math.sin(a2) * rr)} `;
  }
  return `<path d="${d}Z" fill="${color}"/><circle cx="${cx}" cy="${cy}" r="${f(r * 0.38)}" fill="#000" opacity="0.35"/>`;
}
function rails(y, color = "#5a4a3a") {
  let s = `<path d="M0 ${y} H200 M0 ${y + 10} H200" stroke="#9aa0aa" stroke-width="2.5"/>`;
  for ( let x = 4; x < 200; x += 12 ) s += `<rect x="${x}" y="${y - 2}" width="5" height="14" fill="${color}"/>`;
  return s;
}
function train(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="0" y="-22" width="44" height="20" rx="3" fill="#3a3a44"/><rect x="34" y="-34" width="12" height="12" fill="#3a3a44"/><rect x="6" y="-34" width="7" height="12" fill="#2a2a30"/><circle cx="8" cy="0" r="5" fill="#1a1a1e"/><circle cx="22" cy="0" r="5" fill="#1a1a1e"/><circle cx="36" cy="0" r="5" fill="#1a1a1e"/><rect x="36" y="-31" width="7" height="6" fill="#ffd77a"/><path d="M46 -14 L52 -4 L44 -4 Z" fill="#b5452f"/><circle cx="9" cy="-40" r="5" fill="#bbb" opacity="0.7"/><circle cx="2" cy="-50" r="7" fill="#bbb" opacity="0.5"/></g>`;
}
function boat(x, y, s = 1, sail = "#f4ecd8") {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-18 0 L18 0 L12 8 L-12 8 Z" fill="#7a4a2a"/><path d="M0 0 L0 -26" stroke="#4a3220" stroke-width="2"/><path d="M1 -24 L16 -4 L1 -4 Z" fill="${sail}"/></g>`;
}
function ship(x, y, s = 1, sail = "#f4ecd8") {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-34 0 L34 0 L26 12 L-26 12 Z" fill="#6a3a22"/><rect x="-34" y="-3" width="68" height="4" fill="#4a2a18"/><path d="M-8 0 V-44 M14 0 V-36" stroke="#3a2614" stroke-width="2.5"/><path d="M-6 -42 Q 10 -30 -6 -14 Z M16 -34 Q 30 -24 16 -12 Z" fill="${sail}"/><path d="M-8 -44 l10 3 l-10 3 Z" fill="#c6402c"/></g>`;
}
function tombstone(x, base, s = 1, color = "#8a8a90") {
  return `<path d="M${f(x - 7 * s)} ${base} L${f(x - 7 * s)} ${f(base - 14 * s)} Q ${x} ${f(base - 22 * s)} ${f(x + 7 * s)} ${f(base - 14 * s)} L${f(x + 7 * s)} ${base} Z" fill="${color}"/><path d="M${x} ${f(base - 15 * s)} V${f(base - 7 * s)} M${f(x - 3 * s)} ${f(base - 12 * s)} H${f(x + 3 * s)}" stroke="#000" stroke-opacity="0.35" stroke-width="${f(1.4 * s)}"/>`;
}
function bars(x, y, w, h, color = "#3a3a40") {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${color}" stroke-width="5"/>`;
  for ( let xx = x + 10; xx < x + w; xx += 12 ) s += `<rect x="${xx - 2}" y="${y}" width="4" height="${h}" fill="${color}"/>`;
  return s + `<rect x="${x}" y="${y + h * 0.45}" width="${w}" height="4" fill="${color}"/>`;
}
function bookshelf(S, x, y, w, h) {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#4a2a1a"/>`;
  const colors = ["#8a2a2a", "#2a4a8a", "#2a6a3a", "#8a6a2a", "#5a2a6a", "#c8a85a"];
  for ( let yy = y + 4; yy < y + h - 10; yy += 22 ) {
    s += `<rect x="${x + 3}" y="${yy + 16}" width="${w - 6}" height="3" fill="#2a160c"/>`;
    for ( let xx = x + 4; xx < x + w - 8; ) {
      const bw = 4 + S.r() * 4;
      s += `<rect x="${f(xx)}" y="${f(yy + 3 + S.r() * 3)}" width="${f(bw)}" height="${f(13 - S.r() * 3)}" fill="${colors[Math.floor(S.r() * colors.length)]}"/>`;
      xx += bw + 1;
    }
  }
  return s;
}
function flask(x, base, s, liquid) {
  return `<path d="M${f(x - 3 * s)} ${f(base - 22 * s)} L${f(x - 3 * s)} ${f(base - 14 * s)} L${f(x - 10 * s)} ${base} L${f(x + 10 * s)} ${base} L${f(x + 3 * s)} ${f(base - 14 * s)} L${f(x + 3 * s)} ${f(base - 22 * s)} Z" fill="#d8eef4" opacity="0.6"/><path d="M${f(x - 7 * s)} ${f(base - 6 * s)} L${f(x - 10 * s)} ${base} L${f(x + 10 * s)} ${base} L${f(x + 7 * s)} ${f(base - 6 * s)} Z" fill="${liquid}"/><circle cx="${f(x + 2 * s)}" cy="${f(base - 26 * s)}" r="${f(2 * s)}" fill="${liquid}" opacity="0.7"/>`;
}
function torch(S, x, y) {
  return `<rect x="${x - 2}" y="${y}" width="4" height="14" fill="#5a3b22"/>${glow(S, x, y - 4, 16, 16, "#ffb347")}<path d="M${x} ${y} C ${x - 6} ${y - 8}, ${x - 1} ${y - 14}, ${x} ${y - 20} C ${x + 2} ${y - 14}, ${x + 7} ${y - 8}, ${x} ${y} Z" fill="#ffb347"/>`;
}
function flame(x, base, s, outer = "#ff8a33", inner = "#ffd36e") {
  return `<path d="M${x} ${base} C ${f(x - 12 * s)} ${f(base - 12 * s)}, ${f(x - 4 * s)} ${f(base - 22 * s)}, ${x} ${f(base - 34 * s)} C ${f(x + 4 * s)} ${f(base - 22 * s)}, ${f(x + 13 * s)} ${f(base - 12 * s)}, ${x} ${base} Z" fill="${outer}"/><path d="M${x} ${base} C ${f(x - 6 * s)} ${f(base - 8 * s)}, ${f(x - 2 * s)} ${f(base - 14 * s)}, ${x} ${f(base - 20 * s)} C ${f(x + 2 * s)} ${f(base - 14 * s)}, ${f(x + 7 * s)} ${f(base - 8 * s)}, ${x} ${base} Z" fill="${inner}"/>`;
}
function portal(S, cx, cy, r, color, inner = "#140a2a") {
  return `${glow(S, cx, cy, r * 1.7, r * 1.7, color, 0.6)}<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${f(r * 1.25)}" fill="${S.rad([["#ffffff", 0.9], [color, 1, 0.35], [inner, 1]])}"/><ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${f(r * 1.25)}" fill="none" stroke="#c8b8e8" stroke-width="5"/><ellipse cx="${cx}" cy="${cy}" rx="${r + 5}" ry="${f(r * 1.25 + 5)}" fill="none" stroke="#6a6470" stroke-width="4" stroke-dasharray="6 5"/>`;
}
function sparkle(x, y, s, color = "#fff3b0") {
  return `<path d="M${x} ${f(y - 6 * s)} L${f(x + 1.5 * s)} ${f(y - 1.5 * s)} L${f(x + 6 * s)} ${y} L${f(x + 1.5 * s)} ${f(y + 1.5 * s)} L${x} ${f(y + 6 * s)} L${f(x - 1.5 * s)} ${f(y + 1.5 * s)} L${f(x - 6 * s)} ${y} L${f(x - 1.5 * s)} ${f(y - 1.5 * s)} Z" fill="${color}"/>`;
}
function sparkles(S, n, area, color) {
  let s = "";
  for ( let i = 0; i < n; i++ ) s += sparkle(f(area[0] + S.r() * area[2]), f(area[1] + S.r() * area[3]), 0.5 + S.r() * 0.7, color);
  return s;
}
function skull(x, y, s = 1, color = "#e8e0cc") {
  return `<g transform="translate(${x} ${y}) scale(${s})"><ellipse rx="10" ry="9" fill="${color}"/><rect x="-6" y="5" width="12" height="7" rx="2" fill="${color}"/><circle cx="-4" cy="0" r="3" fill="#1a1612"/><circle cx="4" cy="0" r="3" fill="#1a1612"/><path d="M0 3 l-1.5 3 h3 Z" fill="#1a1612"/></g>`;
}
function banner(x, y, color, h = 24) {
  return `<rect x="${x - 1}" y="${y}" width="2" height="${h + 10}" fill="#5a3b22"/><path d="M${x + 1} ${y + 2} H${x + 15} V${y + h} L${x + 8} ${y + h - 6} L${x + 1} ${y + h} Z" fill="${color}"/>`;
}
function steam(S, x, y, n = 4, color = "#ffffff") {
  let s = "";
  for ( let i = 0; i < n; i++ ) s += `<path d="M${f(x + i * 8)} ${y} q -6 -10 0 -20 q 6 -10 0 -20" stroke="${color}" stroke-width="3" fill="none" opacity="0.55" stroke-linecap="round"/>`;
  return s;
}

/* ------------------------------------------------------------------ */
/*  Emblems (signs, crests, dungeon marks)                             */
/* ------------------------------------------------------------------ */

function emblem(kind, cx, cy, s, c = "#3a2414") {
  const k = s / 10;
  const P = (d, extra = "") => `<path transform="translate(${cx} ${cy}) scale(${f(k)})" d="${d}" fill="${c}"${extra}/>`;
  const L = d => `<path transform="translate(${cx} ${cy}) scale(${f(k)})" d="${d}" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  switch ( kind ) {
    case "mug": return P("M-6 -7 H5 V7 H-6 Z M5 -4 H8 Q10 -4 10 -1 V2 Q10 5 8 5 H5 V3 H7 V-2 H5 Z") + P("M-6 -9 H5 V-6 H-6 Z", ` opacity="0.6"`);
    case "bed": return P("M-9 2 H9 V6 H7 V4 H-7 V6 H-9 Z M-9 -5 H-6 V2 H-9 Z M-5 -2 H8 V2 H-5 Z M-5 -5 H0 V-2 H-5 Z");
    case "plate": return L("M-8 -8 V8 M-10 -8 V-2 Q-8 0 -6 -2 V-8 M2 -8 Q8 -4 4 1 V8") + `<circle cx="${cx}" cy="${cy}" r="${f(6 * k)}" fill="none" stroke="${c}" stroke-width="${f(1.6 * k)}"/>`;
    case "dice": return P("M-8 -8 H8 V8 H-8 Z", ` fill-opacity="0.15" stroke="${c}" stroke-width="1.6"`) + P("M-5 -5 m-1.5 0 a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0 -3 0 M5 5 m-1.5 0 a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0 -3 0 M0 0 m-1.5 0 a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0 -3 0 M5 -5 m-1.5 0 a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0 -3 0 M-5 5 m-1.5 0 a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0 -3 0");
    case "masks": return P("M-10 -6 Q-5 -9 0 -6 V1 Q-5 8 -10 1 Z M0 -4 Q5 -7 10 -4 V3 Q5 10 0 3 Z", ` fill-opacity="0.9"`) + L("M-7 -2 h2 M-3 -2 h1 M3 0 h2 M7 0 h1 M-7 3 Q-5 1 -3 3 M3 6 Q5 4 7 6");
    case "swordShield": return P("M-8 -8 H2 V0 Q2 7 -3 9 Q-8 7 -8 0 Z", ` fill-opacity="0.85"`) + L("M9 -10 L-1 8 M3 2 L7 5");
    case "scales": return L("M0 -9 V8 M-6 8 H6 M-9 -5 H9 M-9 -5 L-12 2 H-6 Z M9 -5 L6 2 H12 Z");
    case "star": return P("M0 -10 L2.9 -3.1 L9.5 -3.1 L4.3 1.5 L6.1 8.5 L0 4.5 L-6.1 8.5 L-4.3 1.5 L-9.5 -3.1 L-2.9 -3.1 Z");
    case "book": return P("M-9 -7 Q-4 -9 0 -6 Q4 -9 9 -7 V7 Q4 5 0 8 Q-4 5 -9 7 Z", ` fill-opacity="0.9"`) + L("M0 -6 V8");
    case "swords": return L("M-9 -9 L9 9 M9 -9 L-9 9 M-6 4 L-3 7 M6 4 L3 7");
    case "sun": return `<circle cx="${cx}" cy="${cy}" r="${f(4.5 * k)}" fill="${c}"/>` + L("M0 -10 V-7 M0 7 V10 M-10 0 H-7 M7 0 H10 M-7 -7 L-5 -5 M5 5 L7 7 M7 -7 L5 -5 M-5 5 L-7 7");
    case "drop": return P("M0 -10 Q8 0 6 4 Q4 9 0 9 Q-4 9 -6 4 Q-8 0 0 -10 Z");
    case "leaf": return P("M-8 8 Q-10 -6 8 -8 Q8 6 -8 8 Z") + L("M-8 8 L4 -4");
    case "snow": return L("M0 -10 V10 M-9 -5 L9 5 M9 -5 L-9 5 M-2 -8 L0 -6 L2 -8 M-2 8 L0 6 L2 8");
    case "flame": return P("M0 10 C-8 4 -6 -2 0 -10 C1 -4 6 -2 5 2 C7 0 7 -3 6 -5 C10 0 8 7 0 10 Z");
    case "eye": return P("M-10 0 Q0 -9 10 0 Q0 9 -10 0 Z", ` fill-opacity="0.25" stroke="${c}" stroke-width="1.6"`) + `<circle cx="${cx}" cy="${cy}" r="${f(3.5 * k)}" fill="${c}"/>`;
    case "coin": return `<circle cx="${cx}" cy="${cy}" r="${f(9 * k)}" fill="${c}"/><circle cx="${cx}" cy="${cy}" r="${f(6 * k)}" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="${f(1.4 * k)}"/>`;
    case "wave": return L("M-10 -2 Q-6 -7 -2 -2 T6 -2 T14 -2 M-10 5 Q-6 0 -2 5 T6 5 T14 5");
    case "mountain": return P("M-10 8 L-3 -6 L1 0 L4 -4 L10 8 Z");
    case "wind": return L("M-10 -4 H4 Q8 -4 8 -8 Q8 -11 5 -10 M-10 2 H8 Q11 2 11 6 Q11 9 8 8 M-6 7 H2");
    case "skull": return P("M0 -9 Q9 -9 9 0 Q9 4 5 6 V9 H-5 V6 Q-9 4 -9 0 Q-9 -9 0 -9 Z") + `<circle cx="${f(cx - 3.5 * k)}" cy="${f(cy - 0.5 * k)}" r="${f(2.4 * k)}" fill="#fff" fill-opacity="0.7"/><circle cx="${f(cx + 3.5 * k)}" cy="${f(cy - 0.5 * k)}" r="${f(2.4 * k)}" fill="#fff" fill-opacity="0.7"/>`;
    case "moon": return P("M3 -10 Q-9 -8 -8 2 Q-6 10 4 9 Q-3 5 -3 -1 Q-3 -7 3 -10 Z");
    case "lightning": return P("M2 -10 L-6 1 H0 L-3 10 L7 -2 H1 Z");
    case "cross": return P("M-2 -10 H2 V-4 H8 V0 H2 V10 H-2 V0 H-8 V-4 H-2 Z");
    case "gear": return gear(cx, cy, 7 * k, c, 8);
    case "hammer": return P("M-9 -8 H3 V-2 H-9 Z M-2 -2 H1 V10 H-2 Z");
    case "potion": return P("M-2 -10 H2 V-5 Q8 -2 7 4 Q6 9 0 9 Q-6 9 -7 4 Q-8 -2 -2 -5 Z");
    case "yin": return `<circle cx="${cx}" cy="${cy}" r="${f(9 * k)}" fill="#f4ecd8" stroke="${c}" stroke-width="${f(1.4 * k)}"/>` + P("M0 -9 A9 9 0 0 1 0 9 A4.5 4.5 0 0 1 0 0 A4.5 4.5 0 0 0 0 -9 Z");
    case "tower": return P("M-5 10 V-4 H-7 V-9 H-4 V-6 H-1 V-9 H1 V-6 H4 V-9 H7 V-4 H5 V10 Z");
    case "maze": return L("M-9 -9 H9 V9 H-9 V-5 M-5 -5 H5 V5 H-1 M-5 -1 V5");
    case "crown": return P("M-10 6 L-9 -6 L-4 0 L0 -9 L4 0 L9 -6 L10 6 Z");
    case "key": return `<circle cx="${f(cx - 4 * k)}" cy="${cy}" r="${f(4 * k)}" fill="none" stroke="${c}" stroke-width="${f(2 * k)}"/>` + L("M0 0 H10 M6 0 V4 M9 0 V3");
    default: return `<circle cx="${cx}" cy="${cy}" r="${f(6 * k)}" fill="${c}"/>`;
  }
}
/** A hanging sign with an emblem (shops, guilds). */
function sign(x, y, kind, board = "#c8a26a", ink = "#3a2414", s = 1) {
  return `<path d="M${x - 16 * s} ${y - 14 * s} H${x + 2 * s}" stroke="#2a1a10" stroke-width="${2.4 * s}"/><path d="M${x - 10 * s} ${y - 14 * s} V${y - 10 * s} M${x - 2 * s} ${y - 14 * s} V${y - 10 * s}" stroke="#2a1a10" stroke-width="${1.2 * s}"/><rect x="${x - 17 * s}" y="${y - 10 * s}" width="${22 * s}" height="${20 * s}" rx="${3 * s}" fill="${board}" stroke="#2a1a10" stroke-width="${1.5 * s}"/>${emblem(kind, x - 6 * s, y, 8 * s, ink)}`;
}
/** A round crest on a wall. */
function crest(x, y, kind, ring = "#e6b73c", fill = "#7a2a2a", ink = "#f4e6c0", r = 14) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${ring}" stroke-width="3"/>${emblem(kind, x, y, r * 0.75, ink)}`;
}

/* ------------------------------------------------------------------ */
/*  Shared compositions                                                */
/* ------------------------------------------------------------------ */

/** A day landscape with gentle hills. */
function meadow(S, kind = "day", g = ["#8db35a", "#5f8c3a"], y = 160) {
  return sky(S, kind) + cloud(48, 40, 1) + cloud(150, 64, 0.8) + band(y - 10, g[0], 8, 0.8) + ground(S, y, g[0], g[1]);
}
/** A building front used by shops and halls: wall, roof, door, windows, optional sign. */
function facade(S, { x = 30, w = 140, base = 230, h = 100, wall = "#e8dcc0", roof = "#8a3a2a", door = "#5a3418", roofKind = "gable", windows = 2, lit = "#ffd77a", trim = null } = {}) {
  let s = `<rect x="${x}" y="${base - h}" width="${w}" height="${h}" fill="${wall}"/><rect x="${x + w * 0.6}" y="${base - h}" width="${w * 0.4}" height="${h}" fill="#000" opacity="0.08"/>`;
  if ( roofKind === "gable" ) s += `<path d="M${x - 8} ${base - h + 2} L${x + w / 2} ${base - h - w * 0.32} L${x + w + 8} ${base - h + 2} Z" fill="${roof}"/><path d="M${x + w / 2} ${base - h - w * 0.32} L${x + w + 8} ${base - h + 2} L${x + w / 2} ${base - h + 2} Z" fill="#000" opacity="0.15"/>`;
  if ( roofKind === "flat" ) s += `<rect x="${x - 6}" y="${base - h - 10}" width="${w + 12}" height="12" fill="${roof}"/>`;
  if ( roofKind === "pediment" ) s += `<path d="M${x - 8} ${base - h} L${x + w / 2} ${base - h - 30} L${x + w + 8} ${base - h} Z" fill="${roof}"/><rect x="${x - 8}" y="${base - h - 2}" width="${w + 16}" height="7" fill="${trim ?? roof}"/>`;
  s += `<path d="M${x + w / 2 - 14} ${base} V${base - 34} Q ${x + w / 2} ${base - 46} ${x + w / 2 + 14} ${base - 34} V${base} Z" fill="${door}"/>`;
  for ( let i = 0; i < windows; i++ ) {
    const wx = x + 12 + (i * (w - 42)) / Math.max(1, windows - 1);
    s += `<rect x="${f(wx)}" y="${base - h + 18}" width="18" height="22" rx="2" fill="${lit}"/><path d="M${f(wx + 9)} ${base - h + 18} V${base - h + 40} M${f(wx)} ${base - h + 29} H${f(wx + 18)}" stroke="#5a3b22" stroke-width="1.5"/>`;
  }
  return s;
}
/** A street in front of a building. */
function street(S, y = 230, color = "#b8a888") {
  let s = `<rect y="${y}" width="${W}" height="${H - y}" fill="${color}"/>`;
  for ( let x = -10; x < W; x += 24 ) s += `<rect x="${x + (S.r() * 6)}" y="${y + 10 + S.r() * 30}" width="18" height="8" rx="3" fill="#000" opacity="0.08"/>`;
  return s;
}
/** Interior of a dungeon: brick wall and a floor. */
function dungeonRoom(S, wallColor = "#4e4856", mortar = "#3a3540", floorColor = "#3a3540", line = "#2a2630", y = 180) {
  return bricks(S, 0, 0, W, y + 20, wallColor, mortar, 30, 16) + floor(S, y, floorColor, line);
}
/** A dark cave entrance in a slope (dungeon-ish places). */
function caveMouth(S, x, base, w, h, rockColor = "#6a6470") {
  return `<path d="M${x - w} ${base} Q ${x - w * 0.9} ${base - h * 1.1} ${x} ${base - h * 1.2} Q ${x + w * 0.9} ${base - h * 1.1} ${x + w} ${base} Z" fill="${rockColor}"/><path d="M${f(x - w * 0.55)} ${base} Q ${f(x - w * 0.5)} ${f(base - h * 0.8)} ${x} ${f(base - h * 0.85)} Q ${f(x + w * 0.5)} ${f(base - h * 0.8)} ${f(x + w * 0.55)} ${base} Z" fill="${S.lin(["#1a1620", "#05040a"])}"/>`;
}

/* ------------------------------------------------------------------ */
/*  The places                                                         */
/* ------------------------------------------------------------------ */

const A = {};

/* ---------- Cities and inhabited areas ---------- */
A.capital = S => S.add(sky(S, "bright"), cloud(40, 34, 0.9), cloud(160, 56, 1),
  tower(84, 66, 32, 110, "#d6cfc0", "#7a4f9a", "#e6b73c"), tower(30, 98, 26, 84, "#d6cfc0", "#4c5fa8"), tower(144, 92, 28, 88, "#d6cfc0", "#4c5fa8"),
  dome(100, 120, 44, 40, "#e8e0d0"), wall(S, 164, 46, "#d8d0c2"), gate(100, 210, 30, 40, "#a89c88"), crest(100, 182, "crown", "#e6b73c", "#5a3a8a", "#f4e6c0", 9),
  banner(18, 130, "#5a3a8a"), banner(172, 130, "#5a3a8a"), ground(S, 210, "#8db35a", "#5f8c3a"), `<path d="M88 280 L92 210 L108 210 L112 280 Z" fill="#d9bf8a"/>`);
A.ruralVillage = S => S.add(meadow(S), `<path d="M90 280 C 95 230, 110 210, 104 175" stroke="#d9bf8a" stroke-width="16" fill="none"/>`,
  house(26, 170, 46, 34, "#b5452f"), house(128, 164, 48, 36, "#c8823a"),
  `<g transform="translate(76 118)"><rect x="0" y="0" width="18" height="40" fill="#e8dcc0"/><path d="M-2 0 L9 -12 L20 0 Z" fill="#8a5a3a"/><g stroke="#6b4226" stroke-width="3"><path d="M9 6 L-12 -14 M9 6 L30 26 M9 6 L29 -14 M9 6 L-11 26"/></g></g>`,
  roundTree(184, 150, 1.1), `<path d="M0 230 Q 50 222 100 232 T 200 226" stroke="#c8a85a" stroke-width="2" fill="none" stroke-dasharray="4 4"/>`, tufts(S, 20, [0, 200, 200, 70], "#4f7a2c"));
A.portCity = S => S.add(sky(S, "day"), cloud(140, 40, 1), house(10, 120, 36, 34, "#4a6aa8", "#e8dcc0"), house(52, 106, 40, 48, "#b5452f"), tower(104, 92, 22, 62, "#d6cfc0", "#4a6aa8"), house(140, 116, 44, 38, "#4a6aa8"),
  `<rect y="154" width="200" height="16" fill="#8a6a4a"/>`, water(S, 170, "#3f86b8", "#1f4f7a", 5), `<g fill="#5a3b22"><rect x="20" y="168" width="4" height="30"/><rect x="60" y="168" width="4" height="30"/><rect x="100" y="168" width="4" height="30"/></g>`,
  ship(70, 222, 1.1), boat(160, 246, 0.9));
A.merchantCity = S => S.add(sky(S, "day"), cloud(60, 36, 0.9), house(8, 116, 50, 44, "#b8893a"), house(76, 104, 48, 56, "#8a3a2a"), house(140, 116, 52, 44, "#b8893a"), street(S, 160, "#c8b088"),
  ...[[20, "#c6402c"], [80, "#e6b73c"], [140, "#4a7ea8"]].map(([x, c]) => `<rect x="${x}" y="184" width="44" height="30" fill="#8a6a4a"/><path d="M${x - 4} 186 L${x + 22} 170 L${x + 48} 186 Z" fill="${c}"/><path d="M${x - 4} 186 h52" stroke="#fff" stroke-width="2" stroke-dasharray="6 6" opacity="0.7"/><rect x="${x + 4}" y="192" width="10" height="8" fill="#e8c86a"/><circle cx="${x + 28}" cy="196" r="5" fill="#c6402c"/>`),
  emblem("coin", 100, 245, 12, "#e6b73c"), emblem("scales", 40, 248, 9, "#5a3b22"), emblem("coin", 160, 252, 8, "#e6b73c"));
A.undergroundCity = S => S.add(`<rect width="200" height="280" fill="${S.lin(["#2a2420", "#4a3e34"])}"/>`, `<path d="M0 0 H200 V60 Q 150 90 100 70 Q 50 50 0 80 Z" fill="#1a1612"/>`,
  ...[[20, 150, 40, 60], [70, 120, 60, 90], [140, 140, 44, 70]].map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#7a6a58"/><rect x="${x + 6}" y="${y + 10}" width="10" height="12" fill="#ffb347"/><rect x="${x + w - 16}" y="${y + 10}" width="10" height="12" fill="#ffb347"/>`),
  crystal(30, 70, 10, 30, "#6ac8e8"), crystal(176, 64, 12, 34, "#6ac8e8"), glow(S, 100, 200, 90, 40, "#ffb347", 0.35), ground(S, 230, "#3a3028", "#1a1612"), `<path d="M80 280 L94 230 L106 230 L120 280 Z" fill="#5a4a3a"/>`, torch(S, 60, 214), torch(S, 140, 214));
A.floatingCity = S => S.add(sky(S, "bright"), cloud(30, 200, 1.2, "#fff", 0.7), cloud(170, 230, 1.4, "#fff", 0.7), water(S, 240, "#4a96c8", "#2a6a98", 3),
  `<path d="M30 150 L170 150 L140 186 L100 200 L60 186 Z" fill="#7a6a58"/><path d="M60 186 L100 200 L140 186 L120 210 L100 230 L80 210 Z" fill="#5a4a3a"/>`,
  tower(54, 90, 22, 60, "#e8e0d0", "#4a96c8"), dome(100, 150, 50, 56, "#f4ecd8", "#e6b73c"), tower(128, 100, 20, 50, "#e8e0d0", "#4a96c8"),
  `<path d="M60 186 L50 250 M140 186 L150 250" stroke="#5a5a64" stroke-width="2" stroke-dasharray="4 3"/>`, sparkles(S, 6, [30, 90, 140, 60], "#fff8c8"));
A.fishingVillage = S => S.add(sky(S, "dusk"), `<circle cx="150" cy="96" r="20" fill="#ffd27a" opacity="0.9"/>`, water(S, 150, "#e8a06a", "#3a4a6a", 4), `<rect y="190" width="200" height="90" fill="${S.lin(["#e8d09a", "#c8a86a"])}"/>`,
  house(16, 156, 38, 34, "#5a8aa0", "#d8c8a8"), house(140, 160, 40, 30, "#8a5a3a", "#d8c8a8"), boat(80, 214, 1.2, "#e8dcc0"), boat(126, 232, 0.9, "#f4ecd8"),
  `<path d="M20 240 L70 230 M20 250 L64 240" stroke="#6a4a2a" stroke-width="1.2"/><g stroke="#8a7a5a" stroke-width="0.8" opacity="0.8"><path d="M24 228 L30 252 M34 226 L40 250 M44 224 L50 248 M54 222 L60 246"/></g>`);
A.tribalVillage = S => S.add(sky(S, "dusk"), band(150, "#3a5a2a", 10), ground(S, 170, "#6a8a3a", "#3a5a22"), hut(40, 200, 40, 56), hut(150, 204, 44, 60), hut(96, 176, 30, 44, "#a8764a"),
  `<g transform="translate(176 140)"><rect x="-5" y="0" width="10" height="70" fill="#8a5a2a"/><path d="M-12 6 H12 M-10 22 H10" stroke="#c6402c" stroke-width="4"/><circle cx="0" cy="-4" r="9" fill="#e8c86a"/><circle cx="-3" cy="-5" r="2" fill="#3a2414"/><circle cx="3" cy="-5" r="2" fill="#3a2414"/></g>`,
  glow(S, 96, 238, 40, 22, "#ffb347", 0.6), flame(96, 244, 0.7), `<path d="M80 248 L112 240 M82 240 L110 250" stroke="#5a3b22" stroke-width="4" stroke-linecap="round"/>`);
A.industrialCity = S => S.add(sky(S, "storm"), chimney(S, 30, 150, 14, 80), chimney(S, 150, 140, 16, 96, "#5a3a2a"), factory(10, 210, 90, 60, "#7a5a4a"), factory(104, 214, 90, 70, "#6a5a5a"),
  gear(170, 236, 14, "#4a4a50"), gear(146, 252, 9, "#5a5a60"), ground(S, 214, "#5a5450", "#3a3430"), rails(240), `<rect x="0" y="214" width="200" height="3" fill="#2a2420"/>`);
A.academicCity = S => S.add(sky(S, "night"), stars(S, 40), `<circle cx="160" cy="40" r="10" fill="#f4ecc8"/>`,
  dome(60, 150, 56, 50, "#e8e0d0", "#e6b73c"), `<rect x="78" y="80" width="10" height="26" fill="#9aa0aa" transform="rotate(-30 83 93)"/>`, tower(122, 96, 30, 120, "#d6cfc0", "#3a4a8a", null),
  house(10, 180, 44, 40, "#3a4a8a", "#e8dcc0"), house(150, 182, 42, 38, "#5a3a6a", "#e8dcc0"), ground(S, 218, "#5a6a4a", "#2a3a2a"), emblem("book", 136, 150, 10, "#e6b73c"));
A.holyCity = S => S.add(sky(S, "gold"), glow(S, 100, 60, 120, 80, "#fff2b0", 0.7), spire(100, 200, 50, 170, "#f4ecd8", "#d8c070"), spire(52, 210, 26, 100, "#f4ecd8", "#d8c070"), spire(148, 210, 26, 100, "#f4ecd8", "#d8c070"),
  house(6, 196, 34, 30, "#d8c070", "#f4ecd8"), house(162, 196, 32, 30, "#d8c070", "#f4ecd8"), ground(S, 226, "#e8dcb0", "#c8b880"), emblem("sun", 100, 50, 12, "#c8a040"),
  `<g fill="#8a7a6a"><circle cx="70" cy="246" r="4"/><rect x="67" y="250" width="6" height="12"/><circle cx="130" cy="250" r="4"/><rect x="127" y="254" width="6" height="12"/></g>`);
A.abandonedCity = S => S.add(sky(S, "grey"), `<g opacity="0.95">${house(16, 150, 44, 46, "#5a5450", "#8a847a", "#2a2624")}${house(120, 140, 52, 56, "#5a5450", "#8a847a", "#2a2624")}</g>`,
  tower(76, 104, 26, 92, "#8a847a", "#4a4440", null), `<path d="M78 104 L86 96 L94 108 L100 98 L102 104 Z" fill="#5a5a60"/>`, ground(S, 196, "#7a7a5a", "#4a4a3a"),
  `<path d="M30 160 C 36 190, 24 200, 34 230 M150 150 C 160 180, 140 200, 154 230" stroke="#4e6a3d" stroke-width="3" fill="none"/>`, tufts(S, 26, [0, 200, 200, 70], "#5a6a3a"),
  bird(60, 60, 1.4, "#2a2a2a"), bird(80, 50, 1, "#2a2a2a"), `<rect x="70" y="236" width="30" height="14" rx="3" fill="#7a746a" transform="rotate(-12 85 243)"/>`);
A.nobleDistrict = S => S.add(sky(S, "bright"), facade(S, { x: 24, w: 152, base: 200, h: 96, wall: "#f4ecd8", roof: "#5a3a8a", roofKind: "pediment", windows: 3, lit: "#bfe0f4", door: "#3a2a4a", trim: "#e6b73c" }),
  ...[30, 166].map(x => column(x, 120, 74, "#e8e0d0")), crest(100, 92, "crown", "#e6b73c", "#5a3a8a", "#f4e6c0", 10),
  `<rect y="200" width="200" height="80" fill="${S.lin(["#7aa64a", "#4f7a2c"])}"/>`, `<path d="M84 280 L92 200 L108 200 L116 280 Z" fill="#e8dcc0"/>`, `<ellipse cx="40" cy="236" rx="22" ry="8" fill="#4a96c8" stroke="#e8dcc0" stroke-width="3"/>`,
  roundTree(170, 226, 1, "#2f6a35"), flowers(S, 18, [10, 246, 180, 30], ["#f6b6c8", "#fff7d6", "#c8a0e8"]));
A.slums = S => S.add(sky(S, "storm"), ...[[0, 150, 54, "#7a6650"], [48, 136, 50, "#6a5a4a"], [94, 156, 46, "#8a6a50"], [136, 140, 64, "#5a4a3a"]].map(([x, y, w, c]) => `<rect x="${x}" y="${y}" width="${w}" height="${280 - y}" fill="${c}"/><path d="M${x - 4} ${y} L${x + w + 4} ${y - 8} L${x + w + 4} ${y + 4} L${x - 4} ${y + 8} Z" fill="#4a4a50"/><rect x="${x + 8}" y="${y + 20}" width="12" height="12" fill="#ffd77a" opacity="0.7"/><rect x="${x + w - 22}" y="${y + 40}" width="10" height="16" fill="#2a2420"/>`),
  `<path d="M0 120 Q 60 140 120 118 T 200 126" stroke="#2a2420" stroke-width="1.4" fill="none"/>`, `<g fill="#c6402c" opacity="0.8"><rect x="40" y="122" width="8" height="10"/><rect x="70" y="126" width="6" height="12" fill="#4a7ea8"/><rect x="104" y="120" width="8" height="10" fill="#e8c86a"/></g>`,
  `<rect y="240" width="200" height="40" fill="#4a3e34"/>`, `<path d="M40 252 h20 M120 262 h30" stroke="#2a2420" stroke-width="3"/>`);
A.ruinCity = S => S.add(sky(S, "day"), cloud(150, 40, 0.9), pyramid(100, 176, 180, 90, "#c8b888"), column(20, 130, 60, "#d6d0c4", true), column(164, 140, 50, "#d6d0c4", true),
  house(40, 150, 40, 30, "#b5452f"), house(116, 144, 44, 34, "#c8823a"), house(78, 120, 36, 28, "#4a6aa8"), ground(S, 190, "#9ab062", "#6a8a3e"), `<path d="M90 280 L96 190 L104 190 L110 280 Z" fill="#d9bf8a"/>`,
  emblem("eye", 100, 105, 8, "#8a7a5a"));
A.walledVillage = S => S.add(meadow(S, "day", ["#8db35a", "#5f8c3a"], 220), house(40, 112, 40, 30, "#b5452f"), house(116, 104, 44, 36, "#c8823a"), tower(10, 120, 26, 100, "#b8ac98", "#6a4a3a"), tower(164, 120, 26, 100, "#b8ac98", "#6a4a3a"),
  crenels(30, 166, 156, "#c8bca8", 14), bricks(S, 30, 156, 136, 64, "#c8bca8", "#9a8e7a", 22, 11), gate(100, 220, 34, 50, "#9a8e7a", "#3a2414"), `<path d="M84 186 h32 M84 194 h32 M84 202 h32 M84 210 h32" stroke="#5a3b22" stroke-width="2"/>`);

/* ---------- Natural areas ---------- */
A.enchantedForest = S => {
  S.add(`<rect width="200" height="280" fill="${S.lin(["#1d3a4a", "#2a5a5a", "#3a7a5a"])}"/>`);
  for ( const [x, b, h] of [[20, 220, 150], [70, 250, 190], [130, 230, 170], [180, 260, 200]] ) S.add(`<path d="M${x - 5} ${b} C ${x - 6} ${b - h * 0.5}, ${x + 6} ${b - h * 0.6}, ${x} ${b - h}" stroke="#2a3a2a" stroke-width="10" fill="none"/>`, `<circle cx="${x}" cy="${b - h}" r="${h * 0.22}" fill="#2f6a55"/><circle cx="${x - 10}" cy="${b - h + 10}" r="${h * 0.14}" fill="#4a9a7a" opacity="0.7"/>`);
  S.add(ground(S, 250, "#3a6a4a", "#1f3a2a"), ...Array.from({ length: 12 }, () => orb(S, f(10 + S.r() * 180), f(60 + S.r() * 180), f(1.5 + S.r() * 2), S.r() < 0.5 ? "#9af0d8" : "#e8f0a0")), mushroom(40, 262, 0.9, "#4ac8d8", "#fff"), mushroom(150, 268, 0.7, "#c84ad8", "#fff"));
};
A.darkForest = S => {
  S.add(`<rect width="200" height="280" fill="${S.lin(["#0d1410", "#18241c", "#202c22"])}"/>`, `<circle cx="150" cy="40" r="14" fill="#c8d0c8" opacity="0.5"/>`);
  for ( let i = 0; i < 7; i++ ) S.add(deadTree(10 + i * 30 + S.r() * 10, 280, 160 + S.r() * 80, "#0a100c"));
  S.add(`<rect y="200" width="200" height="80" fill="#cfd8d0" opacity="0.1"/>`, `<g fill="#f0d040"><circle cx="70" cy="180" r="2.5"/><circle cx="78" cy="180" r="2.5"/><circle cx="140" cy="210" r="2"/><circle cx="146" cy="210" r="2"/></g>`, ground(S, 262, "#141c16", "#0a0e0a"));
};
A.fairyGrove = S => S.add(sky(S, "dream"), band(150, "#6ab07a", 8, 0.8), ground(S, 170, "#7ac08a", "#4a8a5a"), roundTree(30, 140, 1.8, "#4a9a6a", "#8ad8a0"), roundTree(176, 150, 1.6, "#4a9a6a", "#8ad8a0"),
  ...[[70, 230], [100, 220], [130, 230], [86, 248], [116, 248]].map(([x, y]) => mushroom(x, y, 0.8, "#f06aa0", "#fff")), glow(S, 100, 220, 60, 30, "#fff0a0", 0.5),
  ...Array.from({ length: 9 }, () => `<g transform="translate(${f(30 + S.r() * 140)} ${f(80 + S.r() * 120)})"><ellipse cx="-3" cy="0" rx="4" ry="2.5" fill="#fff" opacity="0.8"/><ellipse cx="3" cy="0" rx="4" ry="2.5" fill="#fff" opacity="0.8"/><circle r="1.6" fill="#fff8a0"/></g>`),
  flowers(S, 20, [0, 180, 200, 90], ["#f6b6c8", "#fff7d6", "#c8a0e8"]));
A.vastPlains = S => S.add(sky(S, "bright"), cloud(40, 50, 1.2), cloud(130, 30, 0.9), cloud(170, 80, 0.7), `<path d="M0 150 Q 100 146 200 150 L200 280 L0 280 Z" fill="${S.lin(["#b8cc72", "#8aa84a"])}"/>`,
  `<path d="M0 150 H200" stroke="#7a9a5a" stroke-width="1" opacity="0.6"/>`, ...[0, 1, 2, 3].map(i => `<path d="M-10 ${170 + i * 26} Q 100 ${160 + i * 26} 210 ${172 + i * 26}" stroke="#d8e6a0" stroke-width="2" opacity="0.5" fill="none"/>`),
  tufts(S, 40, [0, 160, 200, 120], "#6a8a3a"), roundTree(160, 150, 0.4), bird(60, 90, 1), bird(72, 84, 0.8));
A.flowerFields = S => S.add(sky(S, "day"), cloud(60, 44, 1), band(150, "#8ab85a", 6), ground(S, 160, "#9ac060", "#6a9a3e"),
  ...[0, 1, 2, 3, 4].map(i => `<path d="M-10 ${172 + i * 22} Q 100 ${160 + i * 22} 210 ${174 + i * 22} L210 ${188 + i * 22} Q 100 ${176 + i * 22} -10 ${186 + i * 22} Z" fill="${["#e86a9a", "#f4d04a", "#a86ae8", "#f4f0e8", "#e8784a"][i]}" opacity="0.75"/>`),
  flowers(S, 60, [0, 160, 200, 120], ["#e86a9a", "#f4d04a", "#a86ae8", "#fff"]), roundTree(30, 150, 0.6), roundTree(176, 146, 0.7));
A.poisonSwamp = S => {
  S.add(`<rect width="200" height="280" fill="${S.lin(["#2a2438", "#3a3448", "#4a4a3a"])}"/>`, deadTree(30, 200, 120, "#1e1a24"), deadTree(170, 210, 100, "#1e1a24"));
  S.add(`<rect y="190" width="200" height="90" fill="${S.lin(["#5a3a6a", "#3a2a4a"])}"/>`);
  for ( let i = 0; i < 14; i++ ) S.add(`<circle cx="${f(10 + S.r() * 180)}" cy="${f(200 + S.r() * 70)}" r="${f(2 + S.r() * 5)}" fill="none" stroke="#c88ae8" stroke-width="1.4" opacity="0.8"/>`);
  S.add(`<rect y="150" width="200" height="60" fill="#9ae86a" opacity="0.12"/>`, ...[0, 1, 2].map(i => `<ellipse cx="${50 + i * 50}" cy="${180 + i * 6}" rx="70" ry="10" fill="#a8e87a" opacity="0.15"/>`), skull(150, 250, 0.8, "#d8d0c0"));
};
A.oasis = S => S.add(sky(S, "desert"), `<circle cx="160" cy="50" r="18" fill="#fff4c8"/>`, `<rect y="150" width="200" height="130" fill="${S.lin(["#ebc983", "#d6a65c"])}"/>`,
  `<path d="M-10 160 C 40 140, 90 150, 130 160 S 190 170, 210 156" stroke="#fbe2a8" stroke-width="3" fill="none" opacity="0.8"/>`,
  `<ellipse cx="100" cy="220" rx="70" ry="24" fill="#6ab07a"/><ellipse cx="100" cy="222" rx="54" ry="16" fill="${S.lin(["#4ab8c8", "#2a7a98"])}"/>`,
  palm(50, 214, 80, -1), palm(150, 212, 90, 1), palm(118, 200, 60, 1), tufts(S, 10, [40, 200, 120, 40], "#3f7a35"));
A.snowyMountains = S => S.add(sky(S, "ice"), peak(150, 180, 80, 140, "#e8eef4", "#a8b8c8", "#ffffff"), peak(55, 196, 85, 150, "#e0e8f0", "#98a8b8", "#ffffff"),
  `<rect y="180" width="200" height="100" fill="${S.lin(["#e8f0f6", "#c6d9e5"])}"/>`, peak(120, 290, 95, 130, "#d8e2ec", "#8a9aaa", "#ffffff"),
  pine(20, 270, 40, "#2a4a3a", "#f4f9fc"), pine(176, 268, 46, "#2a4a3a", "#f4f9fc"), ...Array.from({ length: 22 }, () => `<circle cx="${f(S.r() * 200)}" cy="${f(S.r() * 280)}" r="1.4" fill="#fff"/>`));
A.canyon = S => S.add(sky(S, "desert"), `<path d="M0 0 H70 L60 60 L76 120 L56 190 L70 280 H0 Z" fill="${S.lin(["#c8643a", "#8a3a22"], 1, 0)}"/><path d="M200 0 H130 L142 70 L124 130 L146 200 L128 280 H200 Z" fill="${S.lin(["#8a3a22", "#c8643a"], 1, 0)}"/>`,
  ...[60, 110, 170, 230].map(y => `<path d="M0 ${y} L66 ${y + 6} M134 ${y + 4} L200 ${y - 2}" stroke="#e88a5a" stroke-width="2" opacity="0.5"/>`),
  `<path d="M90 120 Q 100 200 96 280 L104 280 Q 108 200 110 120 Z" fill="#4a96c8"/>`, `<path d="M70 120 Q 100 150 130 120" stroke="#e8a06a" stroke-width="2" fill="none" opacity="0.6"/>`, bird(100, 70, 1.6, "#3a2a20"));
A.waterfalls = S => S.add(sky(S, "bright"), `<path d="M0 60 L60 70 L60 280 L0 280 Z M200 50 L140 66 L140 280 L200 280 Z" fill="#7a7a6a"/>`, `<path d="M0 60 L60 70 L60 80 L0 72 Z M140 66 L200 50 L200 62 L140 78 Z" fill="#4a8a3a"/>`,
  `<rect x="60" y="70" width="80" height="170" fill="${S.lin(["#bfe6f8", "#6ab8e0"])}"/>`, ...[70, 86, 102, 118, 132].map(x => `<path d="M${x} 72 V236" stroke="#fff" stroke-width="2" opacity="0.6"/>`),
  water(S, 236, "#4a96c8", "#2a6a98", 2), `<ellipse cx="100" cy="240" rx="60" ry="12" fill="#fff" opacity="0.7"/>`,
  `<path d="M40 150 A 70 70 0 0 1 160 150" stroke="#f4a0a0" stroke-width="3" fill="none" opacity="0.45"/><path d="M44 154 A 66 66 0 0 1 156 154" stroke="#f4e08a" stroke-width="3" fill="none" opacity="0.45"/><path d="M48 158 A 62 62 0 0 1 152 158" stroke="#8ac8f4" stroke-width="3" fill="none" opacity="0.45"/>`,
  roundTree(20, 70, 0.9), roundTree(180, 60, 1));
A.crystalLake = S => S.add(sky(S, "bright"), peak(60, 150, 70, 90, "#a8b8c8", "#7a8a9a", "#fff"), peak(150, 150, 70, 100, "#a8b8c8", "#7a8a9a", "#fff"), band(150, "#5a8a4a", 6),
  `<ellipse cx="100" cy="210" rx="100" ry="50" fill="${S.lin(["#8ae0f0", "#2a8ab8"])}"/>`, `<ellipse cx="100" cy="210" rx="100" ry="50" fill="none" stroke="#e8f8ff" stroke-width="2" opacity="0.6"/>`,
  crystal(96, 236, 12, 26, "#c8f0ff"), crystal(112, 238, 8, 18, "#c8f0ff"), sparkles(S, 7, [30, 180, 140, 60], "#ffffff"), pine(20, 180, 40, "#2a5a3a"), pine(184, 184, 36, "#2a5a3a"));
A.tropicalBeach = S => S.add(sky(S, "bright"), `<circle cx="160" cy="44" r="16" fill="#fff4c8"/>`, water(S, 130, "#3ac8d8", "#1a8ab8", 4), `<path d="M0 190 Q 100 170 200 196 L200 280 L0 280 Z" fill="${S.lin(["#f4e4b0", "#e8d08a"])}"/>`,
  `<path d="M0 190 Q 100 170 200 196" stroke="#fff" stroke-width="4" opacity="0.8" fill="none"/>`, palm(40, 250, 110, 1), palm(170, 260, 90, -1), `<path d="M110 236 L124 220 L138 236 Z" fill="#e86a4a"/><path d="M124 220 V250" stroke="#8a5a3a" stroke-width="1.5"/>`, `<ellipse cx="80" cy="256" rx="6" ry="3" fill="#f0a0a0"/>`);
A.isolatedIsland = S => S.add(sky(S, "day"), cloud(50, 40, 1), water(S, 120, "#3a96c8", "#1a4f7a", 8), `<ellipse cx="100" cy="196" rx="70" ry="26" fill="#e8d08a"/><ellipse cx="100" cy="186" rx="52" ry="18" fill="#6aa060"/>`,
  peak(100, 186, 34, 46, "#8aa86a", "#5a7a4a"), palm(70, 186, 50, -1), palm(132, 186, 44, 1), boat(170, 250, 0.7), bird(150, 80, 1), bird(160, 74, 0.8));
A.crystalCave = S => S.add(`<rect width="200" height="280" fill="${S.lin(["#1a1630", "#2a2048"])}"/>`, `<path d="M0 0 H200 V40 L170 70 L150 40 L120 80 L96 40 L70 76 L44 44 L20 70 L0 50 Z" fill="#120e22"/>`,
  crystal(40, 250, 26, 110, "#8a6ae8"), crystal(76, 260, 18, 70, "#6ac8e8"), crystal(120, 256, 30, 140, "#b86ae8"), crystal(166, 262, 22, 90, "#6ae8c8"), crystal(20, 270, 12, 40, "#e86ab8"),
  glow(S, 120, 160, 80, 90, "#b86ae8", 0.35), ground(S, 256, "#2a2040", "#140e22"), sparkles(S, 10, [10, 80, 180, 160], "#e8d8ff"));
A.dragonValley = S => S.add(sky(S, "dusk"), peak(30, 200, 70, 150, "#6a5a5a", "#4a3a3a"), peak(170, 200, 70, 160, "#6a5a5a", "#4a3a3a"), band(190, "#5a4a3a", 8), ground(S, 200, "#6a5a3a", "#3a2a1a"),
  dragon(100, 90, 1.5, "#2a1414"), dragon(150, 50, 0.6, "#3a1a1a"), `<path d="M40 240 Q 50 226 70 236 Q 76 248 60 252 Z M120 250 Q 140 236 160 250" stroke="#e8dcc0" stroke-width="4" fill="none"/>`, skull(100, 246, 0.9, "#e8dcc0"), `<ellipse cx="160" cy="232" rx="10" ry="7" fill="#c8a86a"/><ellipse cx="172" cy="234" rx="8" ry="6" fill="#d8b878"/>`);

/* ---------- Dungeons and places to explore ---------- */
A.dungeonWing = S => S.add(dungeonRoom(S), ...[22, 162].map(x => column(x, 90, 110, "#7a7480")), `<path d="M38 90 Q 100 30 162 90" stroke="#7a7480" stroke-width="10" fill="none"/>`,
  torch(S, 70, 120), torch(S, 130, 120), `<rect x="76" y="160" width="48" height="40" fill="#1a1620"/>`, `<path d="M76 160 Q 100 140 124 160" fill="#1a1620"/>`, `<ellipse cx="100" cy="250" rx="40" ry="8" fill="#000" opacity="0.25"/>`);
A.dungeonCell = S => S.add(dungeonRoom(S, "#4a4450", "#36303c", "#34303a", "#24202a"), `<path d="M60 150 L60 200 M140 150 L140 200" stroke="#2a2630" stroke-width="2"/>`,
  `<path d="M70 100 Q 60 120 74 130 M130 100 Q 140 120 126 130" stroke="#6a6470" stroke-width="3" fill="none"/><circle cx="74" cy="132" r="5" fill="none" stroke="#6a6470" stroke-width="3"/><circle cx="126" cy="132" r="5" fill="none" stroke="#6a6470" stroke-width="3"/>`,
  `<path d="M30 60 v12 M36 60 v12 M42 60 v12 M48 60 v12 M30 66 h22" stroke="#d8d0c0" stroke-width="1.4" opacity="0.6"/>`, skull(150, 236, 0.7), bars(10, 40, 180, 200, "#2a2830"));
A.dungeonCorridor = S => {
  S.add(`<rect width="200" height="280" fill="#1a1620"/>`, `<path d="M0 0 L80 110 L80 170 L0 280 Z" fill="#4e4856"/><path d="M200 0 L120 110 L120 170 L200 280 Z" fill="#433d4a"/><path d="M80 110 H120 V170 H80 Z" fill="#0a080e"/><path d="M0 280 L80 170 H120 L200 280 Z" fill="#3a3540"/>`);
  for ( let k = 0; k < 5; k++ ) {
    const t = k / 5;
    S.add(`<path d="M${f(80 * t)} ${f(110 * t)} V${f(280 - 110 * t)} M${f(200 - 80 * t)} ${f(110 * t)} V${f(280 - 110 * t)}" stroke="#2a2630" stroke-width="2" opacity="0.7"/>`);
  }
  S.add(torch(S, 40, 110), torch(S, 160, 110), `<path d="M92 230 l6 -4 l6 4 l-6 4 Z" fill="#8a8494" opacity="0.6"/><circle cx="60" cy="250" r="3" fill="#5a5460"/><circle cx="140" cy="250" r="3" fill="#5a5460"/>`);
};
A.abandonedMine = S => S.add(sky(S, "storm"), `<path d="M0 100 L60 60 L120 90 L170 50 L200 70 L200 280 L0 280 Z" fill="#6a5a48"/>`, caveMouth(S, 100, 230, 56, 110, "#7a6a58"),
  `<path d="M52 230 V128 H148 V230" stroke="#7a5230" stroke-width="10" fill="none"/><path d="M48 128 H152" stroke="#5a3a20" stroke-width="12"/>`, rails(244, "#4a3a2a"),
  `<g transform="translate(140 222)"><path d="M0 0 L36 0 L30 18 L6 18 Z" fill="#5a5a60"/><circle cx="10" cy="20" r="4" fill="#2a2a2a"/><circle cx="26" cy="20" r="4" fill="#2a2a2a"/><path d="M4 0 L10 -8 L20 -4 L30 -9 L34 0 Z" fill="#8a7a6a"/></g>`, emblem("hammer", 100, 116, 8, "#e8dcc0"));
A.catacombs = S => {
  S.add(`<rect width="200" height="280" fill="${S.lin(["#5a5248", "#3a342e"])}"/>`);
  for ( let row = 0; row < 4; row++ ) for ( let col = 0; col < 4; col++ ) {
    const x = 14 + col * 46, y = 24 + row * 52;
    S.add(`<path d="M${x} ${y + 34} V${y + 10} Q ${x + 16} ${y - 4} ${x + 32} ${y + 10} V${y + 34} Z" fill="#1e1a16"/>`, S.r() < 0.7 ? skull(x + 16, y + 24, 0.7) : "");
  }
  S.add(floor(S, 210, "#4a443c", "#2e2a24"), torch(S, 100, 216));
};
A.royalCrypt = S => S.add(dungeonRoom(S, "#3e3448", "#2c2434", "#2e2636", "#1e1824", 170), ...[20, 164].map(x => column(x, 70, 120, "#6a5a7a")),
  `<rect x="50" y="170" width="100" height="40" rx="6" fill="#7a6a8a"/><rect x="50" y="160" width="100" height="16" rx="6" fill="#8a7a9a"/><path d="M70 168 Q 100 150 130 168" fill="#9a8aaa"/>`,
  `<path d="M90 156 L94 146 L100 152 L106 146 L110 156 Z" fill="#e6b73c"/>`, crest(100, 100, "crown", "#e6b73c", "#3a2a4a", "#e6b73c", 18), torch(S, 54, 120), torch(S, 146, 120), emblem("coin", 60, 230, 6, "#e6b73c"), emblem("coin", 140, 236, 7, "#e6b73c"));
A.ancientRuins = S => S.add(sky(S, "desert"), `<circle cx="40" cy="50" r="16" fill="#fff4c8"/>`, pyramid(120, 200, 150, 120, "#d8b878"), pyramid(40, 210, 70, 50, "#c8a868"), ground(S, 200, "#e0c088", "#c8a060"),
  column(150, 170, 40, "#d6c8a8", true), column(20, 186, 30, "#d6c8a8", true), emblem("eye", 120, 140, 10, "#8a6a3a"), `<path d="M100 200 L106 186 H134 L140 200 Z" fill="#2a2018"/>`);
A.forgottenTemple = S => S.add(`<rect width="200" height="280" fill="${S.lin(["#3a6a4a", "#5a8a5a"])}"/>`, temple(100, 210, 140, 100, "#b8b8a0", "#9a9a80"), `<rect x="86" y="160" width="28" height="44" fill="#1a1a14"/>`,
  `<path d="M20 110 C 40 150, 20 180, 40 210 M170 100 C 160 140, 186 170, 170 210 M60 108 C 70 130, 56 150, 66 170" stroke="#2f6a35" stroke-width="4" fill="none"/>`, ground(S, 210, "#4a7a3a", "#2a4a22"),
  `<path d="M0 30 Q 40 60 80 30 Q 120 0 200 40" stroke="#2f6a35" stroke-width="18" fill="none" opacity="0.8"/>`, emblem("sun", 100, 92, 10, "#7a7a60"));
A.wizardTower = S => S.add(sky(S, "magic"), stars(S, 30), `<circle cx="40" cy="50" r="12" fill="#f4ecc8"/>`, `<path d="M70 240 L76 110 L124 110 L130 240 Z" fill="#6a5a8a" transform="rotate(4 100 240)"/>`,
  `<path d="M64 112 L100 20 L136 112 Z" fill="#3a2a6a" transform="rotate(4 100 240)"/>`, `<g transform="rotate(4 100 240)"><rect x="90" y="140" width="20" height="24" rx="10" fill="#ffd77a"/><rect x="92" y="190" width="16" height="20" rx="8" fill="#9ae8ff"/></g>`,
  emblem("star", 104, 60, 7, "#e6b73c"), sparkles(S, 8, [40, 30, 120, 120], "#c8b8ff"), ground(S, 236, "#3a3a5a", "#1a1a2a"), orb(S, 150, 90, 5, "#9ae8ff"));
A.monsterCastle = S => S.add(sky(S, "hell"), tower(20, 96, 30, 140, "#4a3a3a", "#2a1a1a", "#5a1a1a"), tower(150, 86, 32, 150, "#4a3a3a", "#2a1a1a", "#5a1a1a"), tower(80, 60, 40, 170, "#5a4848", "#2a1a1a", "#5a1a1a"),
  crenels(0, 200, 180, "#4a3a3a"), `<rect y="180" width="200" height="60" fill="#3a2a2a"/>`, gate(100, 240, 36, 52, "#2a1a1a", "#0a0404"), `<path d="M88 210 l4 4 M96 206 l2 6 M108 208 l-3 5" stroke="#c83a2a" stroke-width="2"/>`,
  `<g fill="#ff4a2a"><circle cx="94" cy="226" r="2"/><circle cx="104" cy="226" r="2"/></g>`, bird(60, 70, 1.8, "#1a0a0a"), bird(140, 50, 1.4, "#1a0a0a"), ground(S, 240, "#2a1a1a", "#120808"));
A.undergroundPrison = S => S.add(dungeonRoom(S, "#4a4a52", "#38383e", "#34343a", "#24242a", 170), bars(30, 60, 60, 120), bars(110, 60, 60, 120), `<rect x="30" y="60" width="60" height="120" fill="#000" opacity="0.4"/><rect x="110" y="60" width="60" height="120" fill="#000" opacity="0.4"/>`,
  `<g fill="#f0d040" opacity="0.8"><circle cx="54" cy="120" r="2"/><circle cx="62" cy="120" r="2"/></g>`, emblem("key", 100, 230, 12, "#c8b070"), torch(S, 100, 90));
A.alchemyLab = S => S.add(bricks(S, 0, 0, 200, 190, "#4a5a4a", "#34403a", 26, 13), `<rect y="190" width="200" height="90" fill="#3a2a1a"/><rect y="180" width="200" height="14" fill="#6a4a2a"/>`,
  flask(40, 180, 1.2, "#6ae86a"), flask(80, 180, 1.6, "#e86ae8"), flask(124, 180, 1, "#e8c86a"), flask(160, 180, 1.4, "#6ac8e8"),
  ...[0, 1, 2, 3].map(i => `<circle cx="${f(80 + i * 4)}" cy="${f(130 - i * 14)}" r="${f(3 + i)}" fill="#e86ae8" opacity="${f(0.5 - i * 0.1)}"/>`), glow(S, 80, 160, 40, 30, "#e86ae8", 0.4),
  `<rect x="20" y="40" width="160" height="6" fill="#6a4a2a"/>`, `<g fill="#c8a86a"><rect x="30" y="20" width="10" height="20"/><rect x="50" y="26" width="12" height="14"/><circle cx="140" cy="32" r="8"/></g>`);
A.forbiddenLibrary = S => S.add(`<rect width="200" height="280" fill="#2a1a1a"/>`, bookshelf(S, 6, 20, 60, 220), bookshelf(S, 134, 20, 60, 220), bookshelf(S, 70, 40, 60, 160),
  `<path d="M6 60 L66 120 M66 60 L6 120 M134 80 L194 140 M194 80 L134 140" stroke="#8a8a90" stroke-width="2.5"/>`, glow(S, 100, 230, 50, 30, "#c86ae8", 0.5),
  `<g transform="translate(100 226)"><path d="M-22 0 Q-10 -6 0 -2 Q10 -6 22 0 V8 Q10 4 0 8 Q-10 4 -22 8 Z" fill="#5a2a4a"/>${emblem("eye", 0, -12, 7, "#e8b8ff")}</g>`, `<rect y="250" width="200" height="30" fill="#1a1010"/>`);
A.elementalShrine = S => S.add(sky(S, "night"), stars(S, 24), temple(100, 220, 120, 90, "#a8b0c0", "#8a92a2"), `<rect x="80" y="170" width="40" height="44" fill="#1a1a28"/>`,
  orb(S, 100, 188, 8, "#ffffff"), emblem("flame", 40, 80, 9, "#ff7a2f"), emblem("drop", 160, 80, 9, "#4ab8e8"), emblem("mountain", 40, 260, 9, "#c8a060"), emblem("wind", 160, 260, 9, "#9ae8c4"),
  `<circle cx="100" cy="170" r="74" fill="none" stroke="#c8d0e8" stroke-width="1.2" stroke-dasharray="4 6" opacity="0.6"/>`, ground(S, 220, "#4a5068", "#2a2e40"));
A.dimensionalDungeon = S => S.add(`<rect width="200" height="280" fill="${S.lin(["#140a2a", "#3a1a5a"])}"/>`, `<g transform="rotate(-8 100 140)">${bricks(S, 20, 30, 70, 90, "#4a3a6a", "#2a1a4a", 20, 10)}</g>`, `<g transform="rotate(10 140 200)">${bricks(S, 110, 170, 70, 80, "#4a3a6a", "#2a1a4a", 20, 10)}</g>`,
  portal(S, 100, 140, 40, "#8a4ae8"), `<path d="M20 230 H80 V250 H20 Z M130 60 H180 V74 H130 Z" fill="#5a4a7a"/>`, sparkles(S, 12, [0, 0, 200, 280], "#d8b8ff"), `<rect x="150" y="100" width="22" height="34" fill="#1a0a2a" transform="rotate(18 160 117)"/>`);
A.derelictShip = S => S.add(sky(S, "storm"), ground(S, 200, "#6a6450", "#3a3628"), `<path d="M10 200 L40 130 L170 110 L196 150 L180 200 Z" fill="#7a8494"/><path d="M40 130 L170 110 L176 124 L46 146 Z" fill="#9aa4b4"/>`,
  `<path d="M60 150 L100 144 M110 142 L150 136" stroke="#4a5464" stroke-width="3"/><g fill="#ff4a4a"><circle cx="70" cy="170" r="3"/><circle cx="130" cy="160" r="3" fill="#4af0ff"/></g>`, `<path d="M150 200 L160 170 L176 200 Z" fill="#1a1a20"/>`,
  `<path d="M0 214 Q 60 196 120 214" stroke="#3a3628" stroke-width="6" fill="none"/>`, ...[0, 1, 2].map(i => `<circle cx="${180 + i * 3}" cy="${110 - i * 16}" r="${6 + i * 3}" fill="#5a5a60" opacity="${0.5 - i * 0.12}"/>`), rock(40, 230, 1.4, "#5a5440"));
A.militaryFortress = S => S.add(sky(S, "storm"), `<path d="M10 240 L30 140 H170 L190 240 Z" fill="#6a6a5a"/>`, crenels(30, 170, 140, "#7a7a6a", 12), tower(16, 120, 30, 120, "#7a7a6a", "#4a4a3a", "#3a5a3a"), tower(154, 120, 30, 120, "#7a7a6a", "#4a4a3a", "#3a5a3a"),
  gate(100, 240, 34, 56, "#5a5a4a", "#1a1a14"), `<rect x="60" y="150" width="30" height="8" fill="#2a2a24"/><rect x="88" y="152" width="18" height="4" fill="#2a2a24"/><rect x="120" y="150" width="30" height="8" fill="#2a2a24"/>`, banner(100, 96, "#3a5a3a"), ground(S, 240, "#5a5a4a", "#3a3a2a"));
A.cursedGraveyard = S => S.add(sky(S, "night"), `<circle cx="150" cy="50" r="18" fill="#d8e8c8" opacity="0.8"/>`, deadTree(40, 200, 110, "#141a14"), ground(S, 190, "#2a3a2a", "#141e14"),
  ...[[60, 220], [100, 210], [140, 226], [80, 252], [130, 260], [170, 240]].map(([x, y], i) => tombstone(x, y, 1.2 - (i % 3) * 0.15, "#7a8278")), `<rect x="0" y="180" width="200" height="40" fill="#b8e8a8" opacity="0.15"/>`,
  `<path d="M100 190 Q 96 170 104 160 Q 112 170 106 190 Z" fill="#c8f0c8" opacity="0.5"/>`, `<g fill="#f0f8e0"><circle cx="100" cy="168" r="1.6"/><circle cx="106" cy="168" r="1.6"/></g>`, bird(160, 90, 1.2, "#0a0e0a"));
A.buriedCity = S => S.add(sky(S, "desert"), dome(60, 200, 70, 70, "#c8a878", "#e6b73c"), tower(124, 140, 30, 64, "#c8a878", "#a8885a", null), `<rect y="190" width="200" height="90" fill="${S.lin(["#e8c88a", "#c8a060"])}"/>`,
  `<path d="M-10 196 C 40 176, 90 190, 130 186 S 190 196, 210 180 L210 210 L-10 210 Z" fill="#e8c88a"/>`, `<rect x="44" y="176" width="14" height="14" fill="#2a2018"/>`, column(160, 200, 20, "#d8c098", true), `<path d="M20 230 C 60 220, 100 236, 160 226" stroke="#fbe2a8" stroke-width="2.5" fill="none"/>`);

/* ---------- Magical and supernatural areas ---------- */
A.fairyRealm = S => S.add(sky(S, "dream"), cloud(40, 40, 1, "#fff", 0.7), `<path d="M0 170 Q 100 150 200 172 L200 280 L0 280 Z" fill="${S.lin(["#a8e0a0", "#6ab07a"])}"/>`,
  tower(70, 100, 24, 80, "#f8d8f0", "#c86ae8", "#f4b8e0"), tower(108, 80, 28, 100, "#f8d8f0", "#e86aa8", "#c8e8ff"), mushroom(40, 200, 2.2, "#e86ae8", "#fff"), mushroom(166, 196, 1.8, "#6ac8e8", "#fff"),
  ...Array.from({ length: 8 }, () => `<g transform="translate(${f(20 + S.r() * 160)} ${f(60 + S.r() * 140)})"><ellipse cx="-3" cy="0" rx="4" ry="2.5" fill="#fff" opacity="0.85"/><ellipse cx="3" cy="0" rx="4" ry="2.5" fill="#fff" opacity="0.85"/><circle r="1.6" fill="#ffe8a0"/></g>`),
  flowers(S, 24, [0, 190, 200, 80], ["#f6b6c8", "#fff7d6", "#c8a0e8", "#a0e0f8"]));
A.astralPlane = S => S.add(`<rect width="200" height="280" fill="${S.lin(["#0a0a2a", "#2a2a6a", "#5a4a9a"])}"/>`, stars(S, 70, [0, 0, 200, 280]),
  ...[[50, 90, 1], [150, 150, 1.2], [90, 220, 0.9]].map(([x, y, s]) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-30 0 H30 L16 18 L4 30 L-10 20 Z" fill="#5a5a8a"/><path d="M-30 0 H30 V-4 H-30 Z" fill="#9a9ad8"/><rect x="-6" y="-24" width="12" height="20" fill="#c8c8f0"/></g>`),
  `<path d="M20 280 C 60 200, 140 200, 180 120" stroke="#c8c8ff" stroke-width="1.4" fill="none" stroke-dasharray="3 5" opacity="0.7"/>`, orb(S, 160, 50, 10, "#c8d8ff"));
A.dreamDimension = S => S.add(sky(S, "dream"), ...[[40, 60, "#fff"], [150, 90, "#f8e0f8"]].map(([x, y, c]) => cloud(x, y, 1.4, c, 0.8)),
  `<g transform="rotate(-20 100 160)"><rect x="40" y="150" width="120" height="10" fill="#c8a0e8"/>${[0, 1, 2, 3, 4].map(i => `<rect x="${50 + i * 22}" y="${130 - i * 14}" width="22" height="${20 + i * 14}" fill="${["#f0b0d8", "#c8b8f8", "#a8e0f0", "#f8e0a0", "#b8f0c8"][i]}"/>`).join("")}</g>`,
  `<circle cx="60" cy="210" r="24" fill="#f8d870" opacity="0.8"/><circle cx="150" cy="230" r="14" fill="#a0d0f8" opacity="0.8"/>`, `<path d="M120 40 h20 v20 h-20 Z" fill="none" stroke="#fff" stroke-width="2" transform="rotate(30 130 50)"/>`,
  `<g transform="translate(100 250)"><circle r="16" fill="#fff" stroke="#c8a0e8" stroke-width="2"/><path d="M0 -10 V0 L6 4" stroke="#7a6a9a" stroke-width="2" fill="none"/></g>`);
A.petrifiedForest = S => {
  S.add(sky(S, "grey"));
  for ( const [x, b, h] of [[30, 260, 170], [90, 280, 200], [150, 250, 160], [190, 270, 120]] ) S.add(`<path d="M${x - 6} ${b} L${x - 4} ${b - h} L${x + 4} ${b - h} L${x + 6} ${b} Z" fill="#8a8478"/>`, deadTree(x, b - h + 40, 60, "#8a8478"), crystal(x - 14, b - h + 26, 6, 14, "#c8e0e8"), crystal(x + 16, b - h + 20, 5, 12, "#c8e0e8"));
  S.add(ground(S, 250, "#9a9488", "#6a6458"), rock(60, 262, 1.2, "#7a7468"), rock(140, 270, 0.9, "#7a7468"));
};
A.starSea = S => {
  S.add(`<rect width="200" height="280" fill="${S.lin(["#05051a", "#1a1a4a"])}"/>`, stars(S, 60, [0, 0, 200, 130]));
  for ( let i = 0; i < 9; i++ ) S.add(`<path d="M${f(S.r() * 160)} ${f(140 + i * 15)} q 10 -5 20 0 q 8 4 16 0" stroke="#8ab8ff" stroke-width="1.6" fill="none" opacity="0.6"/>`);
  S.add(`<rect y="130" width="200" height="150" fill="#4a4ab8" opacity="0.15"/>`, stars(S, 50, [0, 140, 200, 140], "#c8d8ff"), `<path d="M60 200 Q 100 190 140 200 L130 214 H70 Z" fill="#c8b8e8"/><path d="M100 200 V160" stroke="#e8e0f8" stroke-width="2"/><path d="M100 162 L124 194 L100 194 Z" fill="#f8f0ff" opacity="0.9"/>`, orb(S, 40, 60, 8, "#e8e0ff"));
};
A.realmOfDead = S => S.add(sky(S, ["#2a2a34", "#4a4a58"]), `<circle cx="100" cy="70" r="30" fill="#c8c8d8" opacity="0.4"/>`, ground(S, 170, "#5a5a64", "#2a2a34"),
  `<path d="M0 220 Q 60 200 120 222 T 200 214 L200 240 Q 140 236 100 244 T 0 244 Z" fill="#3a4a5a"/>`, `<path d="M70 226 L130 222 L120 232 H80 Z" fill="#4a3a2a"/><path d="M100 224 V200" stroke="#3a2a1a" stroke-width="2"/>`,
  ...Array.from({ length: 6 }, () => { const x = f(20 + S.r() * 160), y = f(110 + S.r() * 60); return `<path d="M${x} ${y} q -6 -12 0 -22 q 6 10 0 22 Z" fill="#d8e8f0" opacity="0.45"/><circle cx="${x}" cy="${f(y - 14)}" r="5" fill="#e8f0f8" opacity="0.5"/>`; }),
  tombstone(30, 200, 1, "#6a6a72"), tombstone(170, 196, 1.2, "#6a6a72"));
A.colossalTree = S => S.add(sky(S, "bright"), cloud(30, 200, 1.4, "#fff", 0.6), `<path d="M70 280 C 80 200, 74 140, 90 100 L110 100 C 126 140, 120 200, 130 280 Z" fill="#6a4a2a"/>`,
  `<circle cx="100" cy="80" r="80" fill="#2f6a35"/><circle cx="60" cy="60" r="44" fill="#3f8a45"/><circle cx="140" cy="70" r="46" fill="#3f8a45"/><circle cx="100" cy="30" r="40" fill="#4f9a55"/>`,
  `<path d="M70 280 C 40 270, 20 280, 0 274 M130 280 C 160 270, 180 278, 200 272" stroke="#6a4a2a" stroke-width="8" fill="none"/>`,
  house(84, 150, 14, 12, "#b5452f"), `<rect x="70" y="100" width="12" height="10" fill="#ffd77a"/><rect x="118" y="90" width="12" height="10" fill="#ffd77a"/>`, bird(30, 120, 1), bird(170, 140, 1.2), house(40, 262, 20, 16, "#c8823a"));
A.celestialGarden = S => S.add(sky(S, "gold"), glow(S, 100, 40, 120, 80, "#ffffff", 0.7), cloud(40, 230, 1.6, "#fff", 0.9), cloud(170, 240, 1.4, "#fff", 0.9), `<rect y="210" width="200" height="70" fill="#fff" opacity="0.6"/>`,
  `<rect x="70" y="150" width="60" height="10" rx="5" fill="#f4e0a0"/><rect x="92" y="110" width="16" height="44" fill="#f8ecc0"/><path d="M80 116 Q 100 90 120 116" fill="#f8ecc0"/>`, steam(S, 92, 108, 3, "#9ae0ff"),
  ...[[40, 190], [160, 186], [70, 200], [130, 204]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="10" fill="#fff8d0"/><circle cx="${x}" cy="${y}" r="4" fill="#f4c040"/>`), sparkles(S, 10, [10, 30, 180, 150], "#fff8c0"));
A.demonAbyss = S => S.add(sky(S, "hell"), `<path d="M0 120 L60 140 L80 280 H0 Z M200 110 L140 140 L120 280 H200 Z" fill="#2a0a0a"/>`, glow(S, 100, 230, 80, 80, "#ff4a1a", 0.8),
  `<path d="M60 140 L80 280 H120 L140 140 Q 100 160 60 140 Z" fill="${S.lin(["#ff8a2a", "#a81a0a", "#2a0404"])}"/>`, ...[[50, 150], [150, 150], [90, 200], [120, 220]].map(([x, y]) => flame(x, y, 0.6, "#ff4a1a", "#ffb84a")),
  `<g transform="translate(100 90)" fill="#1a0404"><path d="M-30 0 Q -40 -30 -20 -40 Q -26 -20 -12 -12 Z M30 0 Q 40 -30 20 -40 Q 26 -20 12 -12 Z"/><ellipse rx="18" ry="14"/><circle cx="-6" cy="-2" r="3" fill="#ff4a1a"/><circle cx="6" cy="-2" r="3" fill="#ff4a1a"/></g>`);
A.invertedWorld = S => S.add(sky(S, ["#5a7a8a", "#a8c8d8"]), `<g transform="translate(0 280) scale(1 -1)">${peak(60, 150, 70, 90, "#7a8a7a", "#4a5a4a")}${peak(150, 140, 60, 80, "#7a8a7a", "#4a5a4a")}<rect y="150" width="200" height="130" fill="#4a7a4a"/>${roundTree(40, 150, 1)}${roundTree(160, 150, 0.9)}</g>`,
  `<path d="M100 210 C 96 180, 104 150, 100 130" stroke="#6ab8e0" stroke-width="10" fill="none"/>`, ground(S, 220, "#6a8a6a", "#3a5a3a"), roundTree(30, 220, 1), house(120, 196, 34, 26, "#b5452f"),
  `<path d="M100 130 l-6 8 h12 Z" fill="#6ab8e0"/>`, ...[0, 1, 2].map(i => `<circle cx="${80 + i * 20}" cy="${140 - i * 10}" r="3" fill="#9ae0f8"/>`));
A.timeIsland = S => S.add(sky(S, "dusk"), water(S, 180, "#5a6a9a", "#2a3a6a", 4), `<ellipse cx="100" cy="190" rx="70" ry="20" fill="#a08a5a"/>`, column(60, 120, 64, "#d6d0c4", true), tower(120, 110, 24, 76, "#c8b898", "#7a5a3a", null),
  `<g transform="translate(100 70)"><circle r="34" fill="#f4ecd8" stroke="#a08a5a" stroke-width="5"/><path d="M0 -24 V0 L16 10" stroke="#3a2a1a" stroke-width="3" fill="none"/>${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => `<circle cx="${f(Math.cos(i * Math.PI / 6) * 28)}" cy="${f(Math.sin(i * Math.PI / 6) * 28)}" r="1.6" fill="#3a2a1a"/>`).join("")}</g>`,
  `<path d="M150 200 L160 220 H140 Z M150 240 L160 220 H140 Z" fill="#e8d8a0" stroke="#8a6a3a" stroke-width="2"/>`);
A.primordialCrystal = S => S.add(sky(S, "night"), stars(S, 40), glow(S, 100, 140, 100, 120, "#6ae8f8", 0.55), crystal(100, 230, 60, 200, "#6ad8f0", "#ffffff"), crystal(56, 236, 20, 70, "#8ab8f0"), crystal(146, 238, 24, 84, "#8ab8f0"),
  ground(S, 230, "#3a4a5a", "#1a2a3a"), `<circle cx="100" cy="130" r="80" fill="none" stroke="#9af0ff" stroke-width="1.4" stroke-dasharray="3 6"/>`, sparkles(S, 10, [20, 40, 160, 180], "#e0faff"));
A.spiritSanctuary = S => S.add(sky(S, "dusk"), `<path d="M50 240 V100 M150 240 V100" stroke="#c8402c" stroke-width="12"/><path d="M34 100 H166 L160 112 H40 Z" fill="#c8402c"/><path d="M30 92 Q 100 80 170 92 L174 100 H26 Z" fill="#3a2a2a"/><rect x="46" y="124" width="108" height="8" fill="#c8402c"/>`,
  ground(S, 236, "#5a6a4a", "#3a4a2a"), `<path d="M80 280 L94 236 H106 L120 280 Z" fill="#c8b898"/>`, ...[[30, 200], [170, 204]].map(([x, y]) => `<rect x="${x - 6}" y="${y}" width="12" height="18" fill="#8a7a6a"/><rect x="${x - 9}" y="${y - 12}" width="18" height="14" fill="#f4e0a0"/>${glow(S, x, y - 5, 18, 16, "#ffd77a", 0.6)}`),
  ...Array.from({ length: 5 }, () => orb(S, f(40 + S.r() * 120), f(140 + S.r() * 70), 3, "#b8f0e0")));
A.dimensionPortal = S => S.add(sky(S, "magic"), stars(S, 30), ground(S, 230, "#4a4a5a", "#2a2a3a"), portal(S, 100, 150, 46, "#a86ae8"), `<rect x="46" y="200" width="108" height="30" fill="#6a6470"/><rect x="54" y="190" width="92" height="12" fill="#7a7480"/>`,
  ...[0, 1, 2, 3, 4, 5].map(i => { const x = f(100 + Math.cos(i * 1.05) * 60), y = f(150 + Math.sin(i * 1.05) * 72); return `<path d="M${x - 4} ${y + 5} L${x} ${y - 5} L${x + 4} ${y + 5} M${x - 3} ${y + 1} H${x + 3}" stroke="#e8d8ff" stroke-width="1.6" fill="none"/>`; }), sparkles(S, 8, [40, 60, 120, 160], "#f0e0ff"));

/* ---------- Technological and industrial areas ---------- */
A.autoFactory = S => S.add(bricks(S, 0, 0, 200, 170, "#6a6a6a", "#4a4a4a", 30, 15), `<rect y="170" width="200" height="110" fill="#3a3a40"/>`, `<rect x="0" y="196" width="200" height="22" fill="#2a2a30"/>`,
  ...[10, 50, 90, 130, 170].map(x => `<circle cx="${x}" cy="207" r="8" fill="#5a5a60"/><rect x="${x - 8}" y="190" width="16" height="10" fill="#c8a040"/>`),
  `<g stroke="#9aa0aa" stroke-width="6" fill="none" stroke-linecap="round"><path d="M50 60 L70 120 L60 168"/><path d="M150 60 L130 120 L140 168"/></g>`, gear(40, 60, 18, "#5a5a60"), gear(160, 64, 14, "#5a5a60"), gear(100, 40, 22, "#7a7a80"),
  `<g fill="#ff8a33"><circle cx="64" cy="170" r="3"/><circle cx="136" cy="170" r="3"/></g>`);
A.steampunkCity = S => S.add(sky(S, "dusk"), `<g transform="translate(130 50)"><ellipse rx="44" ry="16" fill="#a8743a"/><path d="M-20 14 H20 L14 26 H-14 Z" fill="#5a3a20"/><path d="M-40 0 H40" stroke="#5a3a20" stroke-width="2"/></g>`,
  chimney(S, 20, 140, 12, 60, "#5a3a2a", "#c8b8a8"), tower(70, 90, 30, 140, "#b8946a", "#7a4a2a", null), dome(146, 200, 60, 70, "#a8743a", "#e6b73c"), house(10, 190, 50, 40, "#7a4a2a", "#c8a87a"),
  gear(86, 120, 12, "#e6b73c"), gear(170, 150, 8, "#e6b73c"), ground(S, 226, "#5a4a3a", "#3a2a1a"), `<path d="M0 214 H200" stroke="#a8743a" stroke-width="4"/>`, steam(S, 150, 120, 3, "#fff"));
A.trainStation = S => S.add(sky(S, "day"), facade(S, { x: 20, w: 160, base: 200, h: 80, wall: "#c8a07a", roof: "#5a3a2a", roofKind: "gable", windows: 3 }),
  `<g transform="translate(100 120)"><circle r="12" fill="#f4ecd8" stroke="#5a3a2a" stroke-width="3"/><path d="M0 -7 V0 L5 3" stroke="#3a2a1a" stroke-width="2" fill="none"/></g>`, `<rect y="200" width="200" height="16" fill="#9a8a7a"/>`, rails(230), train(20, 236, 1.2), ground(S, 252, "#7a6a5a", "#5a4a3a"));
A.researchLab = S => S.add(`<rect width="200" height="280" fill="${S.lin(["#dfe8ee", "#b8c8d4"])}"/>`, `<rect x="0" y="180" width="200" height="100" fill="#8a9aa8"/><rect x="10" y="150" width="180" height="34" rx="3" fill="#e8eef2" stroke="#9aaab8" stroke-width="2"/>`,
  ...[[30, "#4af0ff"], [90, "#6ae86a"], [150, "#ff6ae8"]].map(([x, c]) => `<rect x="${x}" y="40" width="44" height="60" rx="4" fill="#1a2a3a" stroke="#5a6a7a" stroke-width="3"/><path d="M${x + 4} 80 L${x + 14} 66 L${x + 24} 74 L${x + 40} 50" stroke="${c}" stroke-width="2" fill="none"/>`),
  flask(50, 150, 1, "#4af0ff"), flask(90, 150, 1.3, "#6ae86a"), flask(150, 150, 1.1, "#ff6ae8"), `<rect x="120" y="120" width="16" height="30" fill="#9aa8b8"/><circle cx="128" cy="116" r="8" fill="#5a6a7a"/>`);
A.powerPlant = S => S.add(sky(S, "storm"), `<path d="M30 230 Q 40 160 30 100 H90 Q 80 160 90 230 Z" fill="#c8c8c0"/><path d="M110 230 Q 120 170 110 120 H160 Q 150 170 160 230 Z" fill="#b8b8b0"/>`, steam(S, 44, 96, 4), steam(S, 120, 116, 3),
  `<path d="M170 60 L176 230 M196 60 L190 230 M170 100 L196 100 M172 150 L194 150" stroke="#4a4a50" stroke-width="3"/>`, `<path d="M0 70 Q 90 90 183 60" stroke="#2a2a2a" stroke-width="1.4" fill="none"/>`, emblem("lightning", 60, 180, 14, "#f0d040"), ground(S, 230, "#6a6a5a", "#4a4a3a"));
A.militaryComplex = S => S.add(sky(S, "grey"), `<path d="M10 220 Q 60 140 110 220 Z" fill="#5a6a4a"/><path d="M90 220 Q 140 150 190 220 Z" fill="#4a5a3a"/>`, `<rect x="30" y="196" width="40" height="24" fill="#2a2a24"/><rect x="110" y="196" width="40" height="24" fill="#2a2a24"/>`,
  `<path d="M160 120 V150 M146 112 Q 160 100 174 112" stroke="#4a4a50" stroke-width="3" fill="none"/><ellipse cx="160" cy="108" rx="16" ry="6" fill="#9aa0aa" transform="rotate(-20 160 108)"/>`, ground(S, 220, "#6a6a5a", "#4a4a3a"),
  `<path d="M0 240 H200 M0 256 H200" stroke="#9a9a8a" stroke-width="1.5"/>${Array.from({ length: 11 }, (_, i) => `<path d="M${i * 20} 236 V262" stroke="#9a9a8a" stroke-width="1.5"/>`).join("")}`, banner(40, 120, "#3a5a3a"));
A.oilPlatform = S => S.add(sky(S, "dusk"), water(S, 200, "#3a5a7a", "#1a2a4a", 5), `<path d="M50 200 V250 M150 200 V250 M80 200 V260 M120 200 V260" stroke="#4a4a50" stroke-width="5"/>`, `<rect x="36" y="170" width="128" height="30" fill="#6a6a70"/>`,
  `<path d="M70 170 L100 60 L130 170 M80 130 H120 M88 100 H112" stroke="#8a8a90" stroke-width="3" fill="none"/>`, `<rect x="134" y="120" width="8" height="50" fill="#5a5a60"/>`, flame(138, 120, 0.6), house(44, 150, 30, 20, "#c8402c", "#e8e8e8"));
A.junkyard = S => S.add(sky(S, "grey"), ground(S, 170, "#7a6a5a", "#4a3a2a"), `<path d="M0 200 L40 130 L90 180 L120 120 L170 170 L200 140 V280 H0 Z" fill="#6a5a4a"/>`,
  gear(50, 160, 16, "#8a7a6a"), gear(140, 140, 20, "#7a6a5a"), `<rect x="70" y="150" width="30" height="20" fill="#9a6a3a" transform="rotate(-20 85 160)"/><circle cx="110" cy="190" r="10" fill="#3a3a3a"/><circle cx="110" cy="190" r="4" fill="#7a7a7a"/>`,
  `<g transform="translate(150 210)"><rect x="-14" y="-16" width="28" height="24" rx="4" fill="#8a9aa8"/><circle cx="-5" cy="-6" r="3" fill="#ff4a4a"/><circle cx="5" cy="-6" r="3" fill="#2a2a2a"/><rect x="-10" y="8" width="20" height="14" fill="#6a7a88"/></g>`, `<path d="M20 230 L60 220 L64 240 Z" fill="#5a6a7a"/>`);
A.cyberpunkCity = S => S.add(sky(S, ["#0a0418", "#2a0a3a", "#4a1a5a"]), skyscraper(S, 4, 280, 40, 210), skyscraper(S, 50, 280, 34, 250), skyscraper(S, 90, 280, 46, 190), skyscraper(S, 142, 280, 54, 230, "#24203a", "#4af0ff"),
  `<rect x="96" y="120" width="34" height="14" rx="2" fill="#ff4ae0" opacity="0.9"/><rect x="10" y="100" width="28" height="10" rx="2" fill="#4af0ff" opacity="0.9"/>`, glow(S, 100, 280, 120, 40, "#ff4ae0", 0.45),
  ...Array.from({ length: 14 }, () => `<path d="M${f(S.r() * 200)} ${f(S.r() * 200)} l-3 12" stroke="#8ab8ff" stroke-width="1" opacity="0.5"/>`), `<path d="M0 60 L60 40" stroke="#4af0ff" stroke-width="1.5" opacity="0.6"/>`);
A.spaceBase = S => S.add(sky(S, "space"), stars(S, 60, [0, 0, 200, 180]), `<circle cx="160" cy="50" r="22" fill="#c8d8f0"/><circle cx="154" cy="44" r="6" fill="#a8b8d0"/>`, ground(S, 220, "#8a8a9a", "#5a5a6a"),
  `<path d="M60 220 V100 Q 70 70 80 100 V220 Z" fill="#e8e8f0"/><path d="M60 180 L46 220 H60 Z M80 180 L94 220 H80 Z" fill="#c8402c"/><circle cx="70" cy="130" r="5" fill="#4af0ff"/>`,
  `<rect x="100" y="176" width="80" height="44" rx="6" fill="#9aa4b4"/><path d="M110 176 Q 140 140 170 176" fill="#b8c8d8"/><ellipse cx="160" cy="150" rx="14" ry="6" fill="#c8d0dc" transform="rotate(-30 160 150)"/><path d="M160 156 V176" stroke="#5a5a6a" stroke-width="2"/>`, `<rect x="40" y="216" width="60" height="8" fill="#4a4a5a"/>`);
A.planetColony = S => S.add(sky(S, "mars"), `<circle cx="40" cy="50" r="12" fill="#f8e0c0"/><circle cx="70" cy="70" r="7" fill="#e8c8a0"/>`, peak(150, 180, 70, 70, "#a84a2a", "#7a2a1a"), ground(S, 180, "#c8643a", "#8a3a22"),
  ...[[60, 210, 40], [130, 220, 30], [170, 214, 22]].map(([x, y, r]) => `<path d="M${x - r} ${y} A ${r} ${r} 0 0 1 ${x + r} ${y} Z" fill="#c8e8f8" opacity="0.8" stroke="#8aa8b8" stroke-width="2"/><rect x="${x - 6}" y="${y - r * 0.4}" width="12" height="${r * 0.4}" fill="#6ab07a" opacity="0.8"/>`),
  `<path d="M60 210 H130" stroke="#9aa8b8" stroke-width="4"/>`, rock(30, 250, 1.4, "#8a3a22"));
A.magicWeaponsFacility = S => S.add(bricks(S, 0, 0, 200, 190, "#4a3a5a", "#34283e", 30, 15), `<rect y="190" width="200" height="90" fill="#2a2234"/>`, crystal(100, 170, 34, 110, "#b86ae8", "#fff"), glow(S, 100, 120, 70, 70, "#b86ae8", 0.5),
  `<path d="M40 190 V140 L100 110 M160 190 V140 L100 110" stroke="#8a8a9a" stroke-width="4" fill="none"/>`, `<g transform="translate(150 230)"><rect x="-30" y="-10" width="60" height="20" rx="4" fill="#5a5a6a"/><rect x="10" y="-6" width="40" height="8" fill="#7a7a8a"/><circle cx="-10" cy="12" r="6" fill="#2a2a2a"/><circle cx="12" cy="12" r="6" fill="#2a2a2a"/></g>`,
  `<path d="M20 260 L40 240 M30 266 L50 246" stroke="#f0d040" stroke-width="3"/>`, emblem("lightning", 40, 60, 10, "#e8c8ff"));

/* ---------- Social and service places ---------- */
const shop = (S, o) => S.add(sky(S, o.sky ?? "day"), cloud(40, 40, 0.8), facade(S, o), street(S, o.base ?? 230), ...(o.extra ?? []));
A.adventurersGuild = S => shop(S, { wall: "#c8a07a", roof: "#5a3a2a", windows: 2, extra: [sign(176, 120, "swordShield", "#c8a26a"), `<rect x="36" y="196" width="34" height="26" fill="#8a6a4a" stroke="#4a3220" stroke-width="2"/><rect x="40" y="200" width="12" height="9" fill="#f4ecd8"/><rect x="54" y="204" width="12" height="10" fill="#f4ecd8"/>`, banner(150, 160, "#b5452f")] });
A.merchantsGuild = S => shop(S, { wall: "#e8d8b0", roof: "#b8943a", roofKind: "pediment", trim: "#e6b73c", windows: 3, extra: [crest(100, 110, "scales", "#e6b73c", "#8a6a2a", "#f4e6c0", 14), emblem("coin", 44, 250, 7, "#e6b73c"), emblem("coin", 150, 256, 8, "#e6b73c")] });
A.magicAcademy = S => S.add(sky(S, "magic"), stars(S, 30), tower(40, 90, 30, 150, "#d0c8e8", "#3a2a8a", "#e6b73c"), tower(130, 70, 34, 170, "#d0c8e8", "#3a2a8a", "#e6b73c"), facade(S, { x: 60, w: 80, base: 240, h: 70, wall: "#e0d8f0", roof: "#3a2a8a", windows: 1, lit: "#9ae8ff" }),
  emblem("star", 100, 150, 10, "#e6b73c"), sparkles(S, 8, [20, 30, 160, 100], "#f0e0ff"), ground(S, 240, "#4a4a6a", "#2a2a4a"));
A.university = S => S.add(sky(S, "day"), dome(100, 130, 70, 60, "#e8e0d0", "#e6b73c"), facade(S, { x: 20, w: 160, base: 220, h: 90, wall: "#e8dcc4", roof: "#8a7a6a", roofKind: "pediment", windows: 3 }), ...[24, 160].map(x => column(x, 140, 72, "#e8e0d0")),
  crest(100, 112, "book", "#e6b73c", "#3a4a8a", "#f4e6c0", 11), `<rect y="220" width="200" height="60" fill="${S.lin(["#7aa64a", "#4f7a2c"])}"/>`, `<path d="M86 280 L92 220 H108 L114 280 Z" fill="#e8dcc0"/>`);
A.barracks = S => S.add(sky(S, "day"), `<rect x="10" y="120" width="180" height="100" fill="#8a8a70"/>`, crenels(10, 190, 120, "#8a8a70", 14), gate(100, 220, 34, 56, "#6a6a54", "#2a2a1e"), ...[30, 140].map(x => `<rect x="${x}" y="150" width="28" height="18" fill="#3a3a2e"/>`),
  banner(30, 80, "#3a5a8a"), banner(170, 80, "#3a5a8a"), crest(100, 146, "swords", "#c8c8c0", "#3a5a8a", "#f4f4ec", 10), ground(S, 220, "#a89a7a", "#7a6a50"),
  `<g fill="#5a5a6a"><rect x="40" y="236" width="6" height="16"/><circle cx="43" cy="232" r="4"/><rect x="60" y="236" width="6" height="16"/><circle cx="63" cy="232" r="4"/><rect x="80" y="236" width="6" height="16"/><circle cx="83" cy="232" r="4"/></g>`);
A.combatArena = S => S.add(sky(S, "bright"), cloud(40, 40, 0.9), ground(S, 176, "#9ab062", "#6a8a3e"), `<ellipse cx="100" cy="190" rx="100" ry="60" fill="#a85a3a"/><ellipse cx="100" cy="200" rx="80" ry="40" fill="#d8c08a"/>`,
  ...[0, 1, 2].map(i => `<path d="M${10 + i * 6} ${168 - i * 10} Q 100 ${130 - i * 14} ${190 - i * 6} ${168 - i * 10}" stroke="#7a3a22" stroke-width="2" fill="none"/>`), `<g fill="#3a2a2a">${Array.from({ length: 16 }, (_, i) => `<circle cx="${20 + i * 10}" cy="${150 + Math.abs(i - 7.5) * 2}" r="3"/>`).join("")}</g>`,
  `<g transform="translate(80 204)"><path d="M0 0 L-6 -20 M0 0 L6 -18" stroke="#5a5a6a" stroke-width="3"/><circle cy="-26" r="5" fill="#8a8a9a"/></g><g transform="translate(122 204)"><path d="M0 0 L-6 -18 M0 0 L6 -20" stroke="#6a3a2a" stroke-width="3"/><circle cy="-26" r="5" fill="#8a5a3a"/></g>`, emblem("swords", 100, 176, 9, "#5a5a6a"));
A.colosseum = S => S.add(sky(S, "bright"), cloud(150, 40, 1), `<path d="M10 230 V120 Q 100 80 190 120 V230 Z" fill="#d8c8a0"/><path d="M10 120 Q 100 80 190 120" stroke="#b8a880" stroke-width="6" fill="none"/>`,
  ...[0, 1, 2].map(row => Array.from({ length: 7 }, (_, i) => `<path d="M${18 + i * 25} ${226 - row * 34} V${206 - row * 34} Q ${28 + i * 25} ${194 - row * 34} ${38 + i * 25} ${206 - row * 34} V${226 - row * 34} Z" fill="#7a6a4a"/>`).join("")), ground(S, 230, "#c8b888", "#a8986a"), `<path d="M150 120 L170 104 L190 120" fill="#c8b890"/>`);
A.centralMarket = S => S.add(sky(S, "day"), house(10, 110, 50, 40, "#b5452f"), house(140, 110, 50, 40, "#4a6aa8"), street(S, 150, "#c8b898"),
  ...[[10, "#c6402c", 160], [74, "#e6b73c", 150], [138, "#4a7ea8", 160], [40, "#6a9a4a", 214], [110, "#a84a8a", 220]].map(([x, c, y]) => `<rect x="${x}" y="${y + 20}" width="52" height="28" fill="#8a6a4a"/><path d="M${x - 4} ${y + 22} L${x + 26} ${y} L${x + 56} ${y + 22} Z" fill="${c}"/><path d="M${x - 4} ${y + 22} h60" stroke="#fff" stroke-width="2" stroke-dasharray="6 6" opacity="0.7"/><circle cx="${x + 12}" cy="${y + 30}" r="5" fill="#e86a4a"/><circle cx="${x + 26}" cy="${y + 31}" r="5" fill="#f4d04a"/><circle cx="${x + 40}" cy="${y + 30}" r="5" fill="#6ae86a"/>`),
  emblem("coin", 100, 264, 6, "#e6b73c"));
A.tavern = S => shop(S, { sky: "dusk", wall: "#a8784a", roof: "#5a3a2a", windows: 2, lit: "#ffb347", door: "#3a2414", extra: [sign(178, 116, "mug", "#c8a26a"), glow(S, 100, 200, 70, 40, "#ffb347", 0.35), `<rect x="28" y="214" width="22" height="16" rx="4" fill="#7a4a2a"/><path d="M28 218 h22 M28 226 h22" stroke="#4a2a14" stroke-width="1.5"/>`] });
A.inn = S => shop(S, { sky: "night", h: 120, base: 236, wall: "#c8a07a", roof: "#4a3a5a", windows: 3, lit: "#ffd77a", extra: [stars(S, 20, [0, 0, 200, 60]), sign(178, 104, "bed", "#c8a26a"), `<rect x="40" y="132" width="18" height="22" rx="2" fill="#ffd77a"/><rect x="142" y="132" width="18" height="22" rx="2" fill="#ffd77a"/>`, glow(S, 100, 214, 60, 30, "#ffd77a", 0.35)] });
A.restaurant = S => shop(S, { wall: "#f4ecd8", roof: "#b84a3a", roofKind: "flat", windows: 2, lit: "#ffe8b0", extra: [`<path d="M30 152 H170 L160 168 H40 Z" fill="#b84a3a"/><path d="M40 168 Q 50 176 60 168 Q 70 176 80 168 Q 90 176 100 168 Q 110 176 120 168 Q 130 176 140 168 Q 150 176 160 168" fill="#b84a3a"/>`, sign(178, 110, "plate", "#f4ecd8"), `<g fill="#f4ecd8"><ellipse cx="40" cy="250" rx="14" ry="5"/><ellipse cx="160" cy="252" rx="14" ry="5"/></g>`] });
A.casino = S => S.add(sky(S, "night"), stars(S, 20, [0, 0, 200, 60]), facade(S, { x: 20, w: 160, base: 230, h: 120, wall: "#2a6a4a", roof: "#e6b73c", roofKind: "flat", windows: 3, lit: "#ffe8a0", door: "#1a2a1a" }),
  `<rect x="40" y="94" width="120" height="24" rx="4" fill="#1a1a1a" stroke="#e6b73c" stroke-width="2"/>${Array.from({ length: 10 }, (_, i) => `<circle cx="${48 + i * 12}" cy="106" r="3" fill="${i % 2 ? "#ff4a4a" : "#ffe08a"}"/>`).join("")}`,
  emblem("dice", 60, 200, 9, "#f4f4f4"), emblem("coin", 140, 200, 8, "#e6b73c"), street(S, 230, "#3a3a3a"), glow(S, 100, 120, 90, 50, "#ffe08a", 0.3));
A.theater = S => S.add(sky(S, "dusk"), facade(S, { x: 20, w: 160, base: 230, h: 110, wall: "#e8d8c0", roof: "#8a2a3a", roofKind: "pediment", trim: "#e6b73c", windows: 0, door: "#5a1a2a" }),
  `<path d="M40 130 Q 50 200 40 226 H70 Q 60 180 70 130 Z M160 130 Q 150 200 160 226 H130 Q 140 180 130 130 Z" fill="#a82a3a"/>`, crest(100, 100, "masks", "#e6b73c", "#8a2a3a", "#f4e6c0", 14), street(S, 230, "#b8a888"),
  `<path d="M20 140 V226 M180 140 V226" stroke="#e6b73c" stroke-width="3"/>`);
A.museum = S => S.add(sky(S, "day"), temple(100, 226, 160, 110, "#e8e4dc", "#c8c0b0"), `<rect x="80" y="170" width="40" height="50" fill="#5a4a3a"/>`, crest(100, 100, "eye", "#a8a090", "#e8e4dc", "#6a5a4a", 10),
  `<rect y="226" width="200" height="54" fill="#d8d0c0"/>`, ...[0, 1, 2].map(i => `<rect x="${40 + i * 50}" y="${236 + i * 4}" width="${120 - i * 100}" height="4" fill="#c8c0b0"/>`), `<g transform="translate(40 250)"><rect x="-6" y="0" width="12" height="20" fill="#c8c0b0"/><path d="M-8 0 Q 0 -16 8 0 Z" fill="#a8a090"/></g>`);
A.thermalBaths = S => S.add(sky(S, "dusk"), peak(40, 150, 60, 70, "#7a7a6a", "#5a5a4a", "#fff"), peak(160, 150, 60, 80, "#7a7a6a", "#5a5a4a", "#fff"), `<rect y="150" width="200" height="130" fill="#8a7a6a"/>`,
  ...[[60, 196, 50], [140, 216, 44], [80, 248, 60]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.3}" fill="#c8b8a8"/><ellipse cx="${x}" cy="${y}" rx="${r - 6}" ry="${r * 0.3 - 4}" fill="${S.lin(["#8ae0f0", "#4ab0c8"])}"/>`),
  steam(S, 46, 186, 4), steam(S, 126, 206, 3), steam(S, 66, 238, 4), `<path d="M170 120 V170 M196 120 V170 M164 120 H200 L196 110 H168 Z" fill="#c8402c" stroke="#c8402c" stroke-width="5"/>`);
A.religiousOrder = S => S.add(sky(S, "gold"), spire(100, 230, 70, 210, "#f0e8d8", "#a8a090"), spire(40, 230, 30, 120, "#f0e8d8", "#a8a090"), spire(160, 230, 30, 120, "#f0e8d8", "#a8a090"),
  gate(100, 230, 28, 44, "#d8d0c0", "#5a4a3a"), emblem("cross", 100, 30, 9, "#e6b73c"), banner(20, 170, "#c8b880"), banner(176, 170, "#c8b880"), ground(S, 230, "#d8d0b8", "#b8b098"),
  `<g fill="#6a5a7a"><circle cx="60" cy="246" r="4"/><path d="M54 270 L60 250 L66 270 Z"/><circle cx="140" cy="250" r="4"/><path d="M134 274 L140 254 L146 274 Z"/></g>`);

/* ---------- Hero's journey ---------- */
const dungeonDoor = (S, o) => S.add(sky(S, o.sky), ...(o.back ?? []), caveMouth(S, 100, 236, 60, 120, o.rock), ...(o.extra ?? []), ground(S, 236, o.g[0], o.g[1]), crest(100, 112, o.mark, o.ring ?? "#e6b73c", o.crest, o.ink ?? "#ffffff", 14));
A.firstDungeon = S => dungeonDoor(S, { sky: "day", rock: "#8a8a7a", g: ["#7aa64a", "#4f7a2c"], mark: "star", crest: "#5a7a4a", back: [cloud(40, 40, 0.9), band(150, "#6a9a4a", 8)], extra: [roundTree(30, 220, 1), roundTree(176, 216, 1.1), `<path d="M96 280 L100 236 L104 280 Z" fill="#d9bf8a"/>`] });
A.fireDungeon = S => dungeonDoor(S, { sky: "hell", rock: "#4a2a22", g: ["#5a2a1a", "#2a0a04"], mark: "flame", crest: "#b83a2a", extra: [glow(S, 100, 200, 60, 60, "#ff6a1a", 0.7), flame(40, 236, 0.9), flame(162, 236, 1)] });
A.waterDungeon = S => dungeonDoor(S, { sky: ["#1a3a6a", "#4a8ac8"], rock: "#3a5a7a", g: ["#2a6a98", "#1a3a5a"], mark: "drop", crest: "#2a6ab8", extra: [water(S, 220, "#3a86b8", "#1a4f7a", 3), `<path d="M60 236 Q 100 220 140 236" stroke="#9ae0ff" stroke-width="3" fill="none"/>`, ...[0, 1, 2, 3].map(i => `<circle cx="${70 + i * 20}" cy="${190 - i * 16}" r="${3 + i}" fill="none" stroke="#c8f0ff" stroke-width="1.4"/>`)] });
A.earthDungeon = S => dungeonDoor(S, { sky: "storm", rock: "#7a5a3a", g: ["#6a4a2a", "#3a2a14"], mark: "mountain", crest: "#8a6a3a", back: [peak(40, 160, 60, 90, "#8a7a5a", "#5a4a3a"), peak(170, 160, 50, 80, "#8a7a5a", "#5a4a3a")], extra: [rock(30, 236, 1.6, "#6a5a4a"), rock(170, 232, 1.4, "#6a5a4a"), `<path d="M40 140 C 60 160, 50 190, 70 220 M160 140 C 140 170, 150 196, 130 222" stroke="#4a3a20" stroke-width="5" fill="none"/>`] });
A.airDungeon = S => S.add(sky(S, "bright"), cloud(40, 220, 1.6, "#fff", 0.95), cloud(160, 236, 1.4, "#fff", 0.95), `<path d="M30 200 H170 L140 230 H60 Z" fill="#8a8a7a"/>`, tower(80, 80, 40, 120, "#e8f0f0", "#6ab8a0", "#c8f0e0"),
  ...[0, 1, 2].map(i => `<path d="M${20 + i * 50} ${70 + i * 30} q 20 -10 40 0 q 10 6 4 12" stroke="#fff" stroke-width="2.5" fill="none" opacity="0.8"/>`), crest(100, 150, "wind", "#e6b73c", "#6ab8a0", "#ffffff", 14), bird(30, 120, 1.2), bird(170, 100, 1));
A.iceDungeon = S => dungeonDoor(S, { sky: "ice", rock: "#a8c8e0", g: ["#e8f0f6", "#b8d0e0"], mark: "snow", crest: "#6ab0d8", back: [peak(40, 160, 60, 100, "#e8eef4", "#a8b8c8", "#fff"), peak(170, 160, 50, 90, "#e8eef4", "#a8b8c8", "#fff")], extra: [crystal(30, 236, 16, 50, "#c8e8f8"), crystal(172, 236, 18, 60, "#c8e8f8"), `<path d="M48 120 v14 M62 112 v20 M138 112 v18 M152 120 v14" stroke="#e8f8ff" stroke-width="4" stroke-linecap="round"/>`] });
A.poisonDungeon = S => dungeonDoor(S, { sky: "toxic", rock: "#5a4a5a", g: ["#5a3a6a", "#2a1a3a"], mark: "skull", crest: "#8a4a8a", ink: "#c8f0a0", extra: [glow(S, 100, 210, 70, 50, "#9ae86a", 0.4), ...[0, 1, 2, 3, 4].map(i => `<circle cx="${30 + i * 36}" cy="${244 + (i % 2) * 8}" r="${4 + (i % 3) * 2}" fill="none" stroke="#c88ae8" stroke-width="1.6"/>`), mushroom(30, 240, 1, "#9ae86a", "#5a3a6a"), mushroom(172, 244, 0.9, "#c84ae8", "#fff")] });
A.lightDungeon = S => S.add(sky(S, "gold"), glow(S, 100, 120, 100, 120, "#ffffff", 0.7), temple(100, 236, 140, 110, "#f8f0d8", "#e8d8a8"), `<rect x="80" y="176" width="40" height="54" fill="#fff8d0"/>`,
  ...[0, 1, 2, 3, 4, 5].map(i => `<path d="M100 120 L${f(100 + Math.cos(i * 1.05 - 1.57) * 120)} ${f(120 + Math.sin(i * 1.05 - 1.57) * 120)}" stroke="#fff8c0" stroke-width="6" opacity="0.35"/>`), crest(100, 100, "sun", "#e6b73c", "#f8e8a0", "#c8a040", 14), ground(S, 236, "#f4ecd0", "#d8c8a0"));
A.darkDungeon = S => dungeonDoor(S, { sky: ["#05040a", "#1a1028"], rock: "#2a2034", g: ["#1a1424", "#05040a"], mark: "moon", crest: "#3a2a5a", ink: "#c8b8ff", extra: [glow(S, 100, 190, 60, 60, "#6a3ae8", 0.5), `<g fill="#c8b8ff"><circle cx="90" cy="190" r="2.5"/><circle cx="110" cy="190" r="2.5"/></g>`, ...Array.from({ length: 5 }, (_, i) => `<path d="M${20 + i * 40} 236 q -10 -30 6 -50" stroke="#1a1028" stroke-width="10" fill="none" stroke-linecap="round"/>`)] });
A.challengeTower = S => S.add(sky(S, "dusk"), `<path d="M60 250 L70 40 H130 L140 250 Z" fill="#7a6a8a"/>`, ...[0, 1, 2, 3, 4, 5, 6].map(i => `<rect x="${f(64 + i * 1.4)}" y="${230 - i * 28}" width="${f(72 - i * 2.8)}" height="5" fill="#4a3a5a"/><rect x="${f(92)}" y="${210 - i * 28}" width="16" height="14" rx="6" fill="${i % 2 ? "#ffd77a" : "#1a1424"}"/>`),
  `<path d="M64 40 L100 6 L136 40 Z" fill="#3a2a4a"/>`, crest(100, 66, "tower", "#e6b73c", "#5a4a7a", "#ffffff", 11), ground(S, 250, "#5a5a4a", "#3a3a2a"), banner(46, 190, "#c8402c"), banner(150, 190, "#4a6aa8"));
A.finalLabyrinth = S => {
  S.add(sky(S, "storm"), `<rect x="10" y="110" width="180" height="150" fill="#4a4a3a"/>`);
  const walls = [[10, 110, 180, 8], [10, 110, 8, 150], [182, 110, 8, 150], [10, 252, 80, 8], [110, 252, 80, 8], [36, 136, 8, 90], [36, 136, 110, 8], [146, 136, 8, 70], [64, 164, 60, 8], [64, 164, 8, 60], [64, 218, 90, 8], [120, 190, 8, 30], [92, 190, 36, 8]];
  for ( const [x, y, w, h] of walls ) S.add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#8a8a6a"/><rect x="${x}" y="${y}" width="${w}" height="3" fill="#b8b890"/>`);
  S.add(orb(S, 100, 204, 5, "#ffd77a"), crest(100, 66, "maze", "#e6b73c", "#4a4a3a", "#f4ecd8", 16));
};
A.villainFortress = S => S.add(sky(S, "hell"), peak(30, 200, 60, 140, "#3a1a1a", "#1a0808"), peak(170, 200, 60, 150, "#3a1a1a", "#1a0808"), `<path d="M50 230 L60 110 L80 110 L80 80 L100 30 L120 80 L120 110 L140 110 L150 230 Z" fill="#2a1418"/>`,
  `<g fill="#ff4a1a"><rect x="94" y="96" width="12" height="16" rx="6"/><rect x="66" y="140" width="8" height="12"/><rect x="126" y="140" width="8" height="12"/></g>`, gate(100, 230, 26, 40, "#1a0a0c", "#ff4a1a"), crest(100, 66, "skull", "#c8402c", "#2a0a0e", "#e8d8c8", 11),
  glow(S, 100, 250, 100, 30, "#ff4a1a", 0.6), ground(S, 236, "#2a0a0a", "#120404"), bird(40, 60, 1.4, "#0a0404"), bird(160, 50, 1.2, "#0a0404"));
A.lastDungeon = S => S.add(`<rect width="200" height="280" fill="${S.lin(["#05020a", "#2a0a3a", "#5a1a4a"])}"/>`, stars(S, 30, [0, 0, 200, 120], "#e8b8ff"), `<path d="M20 280 L40 120 L70 140 L100 20 L130 140 L160 120 L180 280 Z" fill="#14081c"/>`,
  `<path d="M100 20 L130 140 L160 120 L180 280 H100 Z" fill="#000" opacity="0.35"/>`, portal(S, 100, 210, 26, "#e84ae8", "#05020a"), crest(100, 100, "eye", "#c8402c", "#1a0a24", "#ff4ae0", 12),
  ...[0, 1, 2, 3].map(i => `<path d="M${30 + i * 46} 280 L${36 + i * 46} 250 L${42 + i * 46} 280 Z" fill="#2a0a3a"/>`), glow(S, 100, 210, 80, 60, "#e84ae8", 0.35));

/* ------------------------------------------------------------------ */

const outDir = path.join(ROOT, "assets", "terrain");
fs.mkdirSync(outDir, { recursive: true });
let n = 0;
const only = process.argv[3] ? new Set(process.argv[3].split(",")) : null;
for ( const [id, draw] of Object.entries(A) ) {
  if ( only && !only.has(id) ) continue;
  const S = new Scene(id);
  draw(S);
  fs.writeFileSync(path.join(outDir, `${id}.svg`), S.svg());
  n++;
}
console.log(`places drawn: ${n}`);
module.exports = { A };
