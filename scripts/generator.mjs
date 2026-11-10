/**
 * Map generator. A theme, a size and a code (seed) always give the same map, so the preview
 * matches the created board and a GM can share a map by its code.
 * Pure code, no Foundry calls (like rules.mjs).
 *
 * Steps: elevation and moisture noise -> sea and land terrains -> rivers -> settlements ->
 * roads (sea lanes in the archipelago) -> starting village -> camps, dungeons, ruins, treasure.
 */
import { defaultConfig, defaultTravel, revealAround } from "./rules.mjs";

const K = "CARDATLAS.";

export const THEMES = ["continent", "archipelago", "desert", "frozen", "wilds"];
export const SIZES = { small: [12, 8], medium: [16, 10], large: [22, 14], huge: [30, 18] };
export const LIMITS = { min: 6, max: 40 };

/* -------------------------------------------- */
/*  Themes                                       */
/* -------------------------------------------- */

/*
 * sea: share of the map under water; edge: how strongly the borders sink (0 = no effect);
 * north: sea along the top edge; scale: size of the noise blobs relative to the map;
 * rivers: rivers per 160 land cards; towns: settlement density; volcano: chance of one.
 * land(e, m, lat): terrain for a land card from its elevation rank, moisture rank (0-1 among
 * land cards) and latitude (0 = top row).
 */
const THEME = {
  continent: {
    sea: 0.3, edge: 0.45, scale: 0.42, rivers: 2, towns: 1, volcano: 0.3,
    land(e, m, lat) {
      if ( e > 0.9 ) return "mountain";
      if ( e > 0.76 ) return lat < 0.2 ? "tundra" : "hills";
      if ( e < 0.1 && m > 0.6 ) return "swamp";
      if ( m > 0.8 ) return "forest";
      if ( m > 0.56 ) return "woods";
      if ( m < 0.08 && lat > 0.55 ) return "desert";
      return "plains";
    }
  },
  archipelago: {
    sea: 0.56, edge: 0.3, scale: 0.26, rivers: 0.6, towns: 1.1, volcano: 0.7, lanes: true,
    land(e, m) {
      if ( e > 0.9 ) return "mountain";
      if ( e > 0.75 ) return "hills";
      if ( e < 0.12 && m > 0.6 ) return "swamp";
      if ( m > 0.74 ) return "jungle";
      if ( m > 0.5 ) return "woods";
      return "plains";
    }
  },
  desert: {
    sea: 0, edge: 0, scale: 0.4, rivers: 1, towns: 0.65, volcano: 0.35,
    land(e, m) {
      if ( e > 0.9 ) return "mountain";
      if ( e > 0.74 ) return "hills";
      if ( m > 0.92 ) return "plains";
      return "desert";
    }
  },
  frozen: {
    sea: 0.18, edge: 0, north: 0.4, scale: 0.4, rivers: 1, towns: 0.7, volcano: 0.2,
    land(e, m, lat) {
      if ( e > 0.86 ) return "mountain";
      if ( e > 0.72 ) return "hills";
      if ( m > 0.74 ) return "forest";
      if ( m > 0.56 ) return "woods";
      if ( lat > 0.72 && m > 0.3 ) return "plains";
      return "tundra";
    }
  },
  wilds: {
    sea: 0, edge: 0, scale: 0.36, rivers: 2.5, towns: 0.6, volcano: 0.15,
    land(e, m, lat) {
      if ( e > 0.93 ) return "mountain";
      if ( e > 0.82 ) return "hills";
      if ( e < 0.16 && m > 0.45 ) return "swamp";
      if ( lat > 0.55 && m > 0.4 ) return "jungle";
      if ( m > 0.3 ) return "forest";
      if ( m > 0.12 ) return "woods";
      return "plains";
    }
  }
};

/** Cost of building a road through each terrain (Infinity = never). */
const ROAD_COST = {
  road: 0.6, plains: 1, village: 1, city: 1, camp: 1.5, ruins: 2, treasure: 2, dungeon: 3,
  woods: 2, hills: 2.6, desert: 2.6, tundra: 2.6, river: 3, forest: 3.2, swamp: 4, jungle: 4,
  mountain: 9, volcano: 60
};
const SEA_LANE_COST = 3.2;
const ROAD_OVER = new Set(["plains", "woods", "hills", "desert", "tundra", "forest", "swamp", "jungle"]);
const SETTLEMENT_SCORE = { plains: 3, woods: 2, hills: 1.5, tundra: 0.8, jungle: 0.8, desert: 0.6, forest: 0.5 };
const WILD = new Set(["mountain", "hills", "forest", "swamp", "jungle", "tundra", "desert", "woods"]);
const POI = new Set(["village", "city", "camp", "ruins", "dungeon", "treasure", "volcano"]);

/* -------------------------------------------- */
/*  Random numbers and noise                     */
/* -------------------------------------------- */

/** A short code people can read aloud and type back. */
export function randomSeed() {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for ( let i = 0; i < 5; i++ ) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

function hashText(text) {
  let h = 1779033703 ^ text.length;
  for ( let i = 0; i < text.length; i++ ) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

function makeRng(text) {
  let a = hashText(text);
  const rng = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.int = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
  rng.pick = list => list[Math.floor(rng() * list.length)];
  rng.chance = p => rng() < p;
  rng.shuffle = list => {
    for ( let i = list.length - 1; i > 0; i-- ) {
      const j = Math.floor(rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };
  return rng;
}

/** Random values on a coarse lattice, smoothly interpolated. */
function valueNoise(rng, cols, rows, cell) {
  const gw = Math.ceil(cols / cell) + 2;
  const gh = Math.ceil(rows / cell) + 2;
  const grid = Array.from({ length: gw * gh }, () => rng());
  const ox = rng() * cell;
  const oy = rng() * cell;
  const smooth = t => t * t * (3 - (2 * t));
  const g = (gx, gy) => grid[(gy * gw) + gx];
  const out = new Array(cols * rows);
  for ( let y = 0; y < rows; y++ ) {
    for ( let x = 0; x < cols; x++ ) {
      const fx = (x + ox) / cell;
      const fy = (y + oy) / cell;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = smooth(fx - x0);
      const ty = smooth(fy - y0);
      const top = g(x0, y0) + ((g(x0 + 1, y0) - g(x0, y0)) * tx);
      const bottom = g(x0, y0 + 1) + ((g(x0 + 1, y0 + 1) - g(x0, y0 + 1)) * tx);
      out[(y * cols) + x] = top + ((bottom - top) * ty);
    }
  }
  return out;
}

function fractalNoise(rng, cols, rows, cell) {
  const a = valueNoise(rng, cols, rows, cell);
  const b = valueNoise(rng, cols, rows, Math.max(1.6, cell / 2.2));
  return a.map((v, i) => (v * 0.68) + (b[i] * 0.32));
}

/** Rank of each value inside `idx` (0 = lowest, 1 = highest). */
function ranks(values, idx) {
  const out = new Map();
  const sorted = [...idx].sort((p, q) => values[p] - values[q]);
  const n = Math.max(1, sorted.length - 1);
  sorted.forEach((i, r) => out.set(i, r / n));
  return out;
}

/* -------------------------------------------- */
/*  Grid helpers                                 */
/* -------------------------------------------- */

function grid(cols, rows) {
  const at = (x, y) => ((x < 0 || y < 0 || x >= cols || y >= rows) ? -1 : (y * cols) + x);
  const xy = i => ({ x: i % cols, y: Math.floor(i / cols) });
  const around = i => {
    const { x, y } = xy(i);
    return [at(x, y - 1), at(x + 1, y), at(x, y + 1), at(x - 1, y)].filter(j => j >= 0);
  };
  const dist = (i, j) => {
    const a = xy(i);
    const b = xy(j);
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  };
  return { at, xy, around, dist };
}

/** Minimal binary heap for Dijkstra. */
class Heap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  push(item) {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while ( i > 0 ) {
      const p = (i - 1) >> 1;
      if ( a[p][0] <= a[i][0] ) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if ( a.length ) {
      a[0] = last;
      let i = 0;
      for ( ;; ) {
        const l = (2 * i) + 1;
        const r = l + 1;
        let m = i;
        if ( l < a.length && a[l][0] < a[m][0] ) m = l;
        if ( r < a.length && a[r][0] < a[m][0] ) m = r;
        if ( m === i ) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

/* -------------------------------------------- */
/*  Names                                        */
/* -------------------------------------------- */

const NAME_START = ["Bel", "Cor", "Dal", "Esm", "Fen", "Gal", "Hal", "Ir", "Jor", "Kel", "Lun", "Mar", "Nor", "Ost",
  "Pel", "Ros", "Sel", "Tor", "Ul", "Val", "Ys", "Zan", "Alb", "Bri", "Cal", "Dun", "Eld", "Lir", "Mor", "Tal"];
const NAME_MID = ["a", "e", "i", "o", "ar", "en", "or", "ia", "el", "an"];
const NAME_END = ["dor", "mar", "val", "rim", "nor", "lis", "bra", "ten", "gar", "mir", "ros", "zan", "del", "ria",
  "ena", "tal", "mon", "ven"];

function makeNamer(rng) {
  const used = new Set();
  return () => {
    for ( let tries = 0; tries < 40; tries++ ) {
      const mid = rng.chance(0.4) ? rng.pick(NAME_MID) : "";
      const name = rng.pick(NAME_START) + mid + rng.pick(NAME_END);
      if ( name.length <= 10 && !used.has(name) ) {
        used.add(name);
        return name;
      }
    }
    return rng.pick(NAME_START) + rng.int(2, 99);
  };
}

/* -------------------------------------------- */
/*  Generator                                    */
/* -------------------------------------------- */

/**
 * Build a board.
 * @param {object} p
 * @param {string} p.theme   one of THEMES
 * @param {number} p.cols
 * @param {number} p.rows
 * @param {string} p.seed    any text; the same text gives the same map
 * @param {string} [p.id]
 * @param {string} [p.name]
 * @param {object} [p.start]  where the group starts: {mode: "village"} (a random village, the
 *   default), {mode: "city"}, or {mode: "pick", x, y, village} (that card, or the nearest land
 *   the group can walk from; `village: false` keeps its terrain instead of founding a village)
 */
export function generateBoard({ theme = "continent", cols = 16, rows = 10, seed = "atlas", id = "", name = "", start: startOption = null } = {}) {
  const T = THEME[theme] ?? THEME.continent;
  cols = Math.max(LIMITS.min, Math.min(LIMITS.max, Math.floor(Number(cols) || 16)));
  rows = Math.max(LIMITS.min, Math.min(LIMITS.max, Math.floor(Number(rows) || 10)));
  const rng = makeRng(`${theme}|${cols}x${rows}|${seed}`);
  const G = grid(cols, rows);
  const N = cols * rows;
  const all = Array.from({ length: N }, (_, i) => i);
  const terrain = new Array(N).fill("plains");
  const passable = new Array(N).fill(null);
  const cellSize = Math.max(2.2, Math.min(cols, rows) * T.scale);

  // 1. Elevation (with sunken borders or a northern sea) and moisture.
  const elev = fractalNoise(rng, cols, rows, cellSize);
  const moist = fractalNoise(rng, cols, rows, cellSize * 0.9);
  for ( const i of all ) {
    const { x, y } = G.xy(i);
    if ( T.edge ) {
      const d = Math.min(x + 0.5, cols - x - 0.5, y + 0.5, rows - y - 0.5) / (Math.min(cols, rows) / 2);
      const f = Math.min(1, d * 1.6);
      elev[i] = (elev[i] * (1 - T.edge)) + ((f * f * (3 - (2 * f))) * T.edge);
    }
    if ( T.north ) elev[i] = (elev[i] * (1 - T.north)) + ((y / Math.max(1, rows - 1)) * T.north);
  }

  // 2. Sea, then land terrains by rank so every map keeps the theme's proportions.
  const byElev = [...all].sort((a, b) => elev[a] - elev[b]);
  const seaCount = Math.round(N * T.sea);
  const isSea = new Array(N).fill(false);
  for ( let k = 0; k < seaCount; k++ ) isSea[byElev[k]] = true;
  const land = all.filter(i => !isSea[i]);
  const eRank = ranks(elev, land);
  const mRank = ranks(moist, land);
  for ( const i of all ) {
    if ( isSea[i] ) { terrain[i] = "sea"; continue; }
    const lat = G.xy(i).y / Math.max(1, rows - 1);
    terrain[i] = T.land(eRank.get(i), mRank.get(i), lat);
  }

  // Land reachable without boats: the largest connected land mass (archipelago: all islands).
  const mainland = T.lanes ? new Set(land) : largestLandMass(land, G, terrain);

  // 3. Rivers flow downhill from high ground to the sea, the border or another river.
  const riverCount = Math.round(T.rivers * (land.length / 160) + (rng() * 0.6));
  for ( let r = 0; r < riverCount; r++ ) carveRiver(rng, G, terrain, elev, eRank, land, cols, rows);

  // 4. Settlements: one city, then villages spread over the land. A start picked by the GM
  //    comes first (moved to the nearest walkable land when it falls in the sea).
  let forced = null;
  if ( startOption?.mode === "pick" && Number.isFinite(Number(startOption.x)) && Number.isFinite(Number(startOption.y)) ) {
    const px = Math.max(0, Math.min(cols - 1, Math.floor(Number(startOption.x))));
    const py = Math.max(0, Math.min(rows - 1, Math.floor(Number(startOption.y))));
    forced = nearestIn(mainland, G.at(px, py), G);
  }
  const foundVillage = forced !== null && startOption.village !== false;
  const placed = foundVillage ? [forced] : [];
  const candidates = [...mainland].filter(i => SETTLEMENT_SCORE[terrain[i]] !== undefined);
  const score = new Map(candidates.map(i => {
    const near = G.around(i).map(j => terrain[j]);
    const water = (near.includes("river") ? 2 : 0) + (near.includes("sea") ? 1.5 : 0);
    return [i, SETTLEMENT_SCORE[terrain[i]] + water + (rng() * 1.5)];
  }));
  const ordered = [...candidates].sort((a, b) => score.get(b) - score.get(a));
  const landCount = mainland.size;
  const villageCount = Math.max(2, Math.min(8, Math.round((landCount / 38) * T.towns)));
  const wanted = villageCount + (landCount >= 45 ? 1 : 0);
  let spacing = Math.max(3, Math.floor(Math.sqrt(landCount / (wanted + 1)) * 0.95));
  while ( placed.length < wanted && spacing >= 2 ) {
    for ( const i of ordered ) {
      if ( placed.length >= wanted ) break;
      if ( placed.includes(i) ) continue;
      if ( placed.every(j => G.dist(i, j) >= spacing) ) placed.push(i);
    }
    spacing--;
  }
  if ( !placed.length ) placed.push(ordered[0] ?? [...mainland][0] ?? 0);
  // The village founded at a picked start never becomes the city.
  const city = landCount >= 45 ? (placed.find(i => !(foundVillage && i === forced)) ?? null) : null;
  const villages = placed.filter(i => i !== city);
  if ( city !== null ) terrain[city] = "city";
  for ( const i of villages ) terrain[i] = "village";

  // 5. Roads join the settlements (a minimum spanning tree); at sea they become lanes.
  const towns = city !== null ? [city, ...villages] : villages;
  for ( const [a, b] of spanningTree(towns, G) ) {
    const path = cheapestPath(a, b, G, terrain, T.lanes);
    for ( const i of path ?? [] ) {
      if ( terrain[i] === "sea" ) passable[i] = true;
      else if ( ROAD_OVER.has(terrain[i]) ) terrain[i] = "road";
    }
  }

  // 6. The group starts in a village (or where the GM chose).
  let start;
  if ( forced !== null ) start = forced;
  else if ( startOption?.mode === "city" && city !== null ) start = city;
  else start = villages.length ? rng.pick(villages) : towns[0];
  if ( forced === null && !POI.has(terrain[start]) ) terrain[start] = "village";
  const distFromStart = walkDistances(start, G, terrain, passable);
  const reach = all.filter(i => Number.isFinite(distFromStart[i]));
  const far = Math.max(1, ...reach.map(i => distFromStart[i]));

  // 7. Points of interest on reachable land, away from each other and from the towns.
  const taken = new Set([...towns, start]);
  const free = i => !taken.has(i) && !POI.has(terrain[i]) && !["road", "river", "sea"].includes(terrain[i])
    && [...taken].every(j => G.dist(i, j) >= 2);
  const placeSome = (count, type, rate) => {
    const out = [];
    const list = reach.filter(free).map(i => [rate(i, distFromStart[i] / far), i]).sort((p, q) => q[0] - p[0]);
    for ( const [, i] of list ) {
      if ( out.length >= count ) break;
      if ( !free(i) ) continue;
      terrain[i] = type;
      taken.add(i);
      out.push(i);
    }
    return out;
  };
  placeSome(landCount > 150 ? 2 : 1, "camp",
    (i, d) => (WILD.has(terrain[i]) ? 1 : 0.4) - Math.abs(d - 0.55) + (rng() * 0.5));
  const dungeons = placeSome(clampInt(landCount / 80, 1, 3), "dungeon",
    (i, d) => d + (["mountain", "hills", "forest", "swamp", "jungle"].includes(terrain[i]) ? 0.6 : 0) + (rng() * 0.5));
  const treasures = placeSome(clampInt(landCount / 70, 1, 3), "treasure",
    (i, d) => d + (WILD.has(terrain[i]) ? 0.4 : 0) + (rng() * 0.6));
  const ruins = placeSome(clampInt((landCount / 60) + (theme === "desert" ? 1 : 0), 1, 4), "ruins",
    (i, d) => (d * 0.5) + (rng() * 0.9));

  // 8. Sometimes a volcano on the highest peak.
  if ( rng.chance(T.volcano) ) {
    const peaks = land.filter(i => terrain[i] === "mountain").sort((a, b) => elev[b] - elev[a]);
    if ( peaks.length ) terrain[peaks[0]] = "volcano";
  }

  // 9. Cards, names and arrival texts.
  const cells = all.map(i => {
    const cell = { terrain: terrain[i] };
    if ( passable[i] !== null ) cell.passable = passable[i];
    return cell;
  });
  const nameOf = makeNamer(rng);
  for ( const i of towns ) cells[i].label = nameOf();
  const texts = (type, list) => {
    const variants = rng.shuffle([1, 2, 3]);
    list.forEach((i, n) => { cells[i].text = `${K}Gen.${type}${variants[n % 3]}`; });
  };
  texts("dungeon", dungeons);
  texts("treasure", treasures);
  texts("ruins", ruins);

  const s = G.xy(start);
  const board = {
    id: String(id || ""),
    name: name || seed,
    cols,
    rows,
    cells,
    party: { x: s.x, y: s.y },
    config: defaultConfig(),
    travel: defaultTravel()
  };
  cells[start].visited = true;
  revealAround(board, s.x, s.y, board.config.revealRadius);
  return board;
}

/** Counts by terrain and the starting place, for the preview caption. */
export function summarizeBoard(board) {
  const counts = {};
  for ( const c of board?.cells ?? [] ) if ( c ) counts[c.terrain] = (counts[c.terrain] ?? 0) + 1;
  const p = board?.party;
  const start = p ? board.cells[(p.y * board.cols) + p.x] : null;
  return { counts, start: start?.label ?? "" };
}

/* -------------------------------------------- */
/*  Steps                                        */
/* -------------------------------------------- */

function clampInt(v, lo, hi) {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

/** The cell of `set` closest to `i` (ties: the lower index), or `i` itself if it is in the set. */
function nearestIn(set, i, G) {
  if ( set.has(i) ) return i;
  let best = null;
  let bestD = Infinity;
  for ( const j of set ) {
    const d = G.dist(i, j);
    if ( d < bestD || (d === bestD && j < best) ) {
      best = j;
      bestD = d;
    }
  }
  return best ?? i;
}

function largestLandMass(land, G, terrain) {
  const seen = new Set();
  let best = new Set();
  for ( const i of land ) {
    if ( seen.has(i) ) continue;
    const group = new Set([i]);
    const stack = [i];
    seen.add(i);
    while ( stack.length ) {
      const c = stack.pop();
      for ( const j of G.around(c) ) {
        if ( seen.has(j) || terrain[j] === "sea" ) continue;
        seen.add(j);
        group.add(j);
        stack.push(j);
      }
    }
    if ( group.size > best.size ) best = group;
  }
  return best;
}

function carveRiver(rng, G, terrain, elev, eRank, land, cols, rows) {
  const sources = land.filter(i => eRank.get(i) > 0.7 && terrain[i] !== "river");
  if ( !sources.length ) return;
  let at = rng.pick(sources);
  const seen = new Set([at]);
  const maxLength = cols + rows;
  for ( let step = 0; step < maxLength; step++ ) {
    if ( terrain[at] !== "mountain" ) terrain[at] = "river";
    const { x, y } = G.xy(at);
    if ( x === 0 || y === 0 || x === cols - 1 || y === rows - 1 ) return;
    const next = G.around(at).filter(j => !seen.has(j));
    if ( !next.length ) return;
    if ( next.some(j => terrain[j] === "sea") ) return;
    const joins = next.find(j => terrain[j] === "river");
    if ( joins !== undefined && step > 1 ) return;
    next.sort((a, b) => (elev[a] + (rng() * 0.06)) - (elev[b] + (rng() * 0.06)));
    at = next[0];
    seen.add(at);
  }
}

/** Prim's algorithm on straight-line distance. */
function spanningTree(nodes, G) {
  if ( nodes.length < 2 ) return [];
  const inTree = new Set([nodes[0]]);
  const edges = [];
  while ( inTree.size < nodes.length ) {
    let best = null;
    for ( const a of inTree ) {
      for ( const b of nodes ) {
        if ( inTree.has(b) ) continue;
        const d = G.dist(a, b);
        if ( !best || d < best[2] ) best = [a, b, d];
      }
    }
    inTree.add(best[1]);
    edges.push([best[0], best[1]]);
  }
  return edges;
}

function cheapestPath(from, to, G, terrain, lanes) {
  const cost = i => (terrain[i] === "sea" ? (lanes ? SEA_LANE_COST : Infinity) : (ROAD_COST[terrain[i]] ?? 2));
  const best = new Map([[from, 0]]);
  const prev = new Map();
  const heap = new Heap();
  heap.push([0, from]);
  while ( heap.size ) {
    const [d, i] = heap.pop();
    if ( i === to ) break;
    if ( d > (best.get(i) ?? Infinity) ) continue;
    for ( const j of G.around(i) ) {
      const c = cost(j);
      if ( !Number.isFinite(c) ) continue;
      const nd = d + c;
      if ( nd < (best.get(j) ?? Infinity) ) {
        best.set(j, nd);
        prev.set(j, i);
        heap.push([nd, j]);
      }
    }
  }
  if ( !prev.has(to) ) return null;
  const path = [];
  for ( let i = prev.get(to); i !== undefined && i !== from; i = prev.get(i) ) path.push(i);
  return path;
}

/** Steps from the start over passable cards (sea only where a lane was opened). */
function walkDistances(start, G, terrain, passable) {
  const dist = new Array(terrain.length).fill(Infinity);
  dist[start] = 0;
  const queue = [start];
  for ( let q = 0; q < queue.length; q++ ) {
    const i = queue[q];
    for ( const j of G.around(i) ) {
      if ( Number.isFinite(dist[j]) ) continue;
      const open = passable[j] ?? (terrain[j] !== "sea");
      if ( !open ) continue;
      dist[j] = dist[i] + 1;
      queue.push(j);
    }
  }
  return dist;
}
