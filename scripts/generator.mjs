/**
 * Map generator. A theme, a size and a code (seed) always give the same map, so the preview
 * matches the created board and a GM can share a map by its code.
 * Pure code, no Foundry calls (like rules.mjs).
 *
 * Steps: elevation and moisture noise -> sea and land terrains -> rivers -> settlements ->
 * roads (sea lanes in the archipelago) -> starting village -> camps, dungeons, ruins, treasure.
 * The themes of 1.3.0 then "dress" the map with their own places (see the end of this file);
 * the metropolis and the dungeon crawl have their own builders.
 */
import { defaultConfig, defaultTravel, revealAround } from "./rules.mjs";

const K = "CARDATLAS.";

export const THEMES = ["continent", "archipelago", "desert", "frozen", "wilds", "kingdom", "wonders", "journey", "mystic", "machines", "metropolis", "dungeonCrawl"];
/** Themes as the "New map" window groups them. */
export const THEME_GROUPS = {
  classic: ["continent", "archipelago", "desert", "frozen", "wilds"],
  places: ["kingdom", "wonders", "journey", "mystic", "machines", "metropolis", "dungeonCrawl"]
};
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
  mountain: 9, volcano: 60,
  vastPlains: 1, flowerFields: 1.2, fairyGrove: 2, enchantedForest: 3, darkForest: 3.4, canyon: 2.8, poisonSwamp: 4.5,
  snowyMountains: 12, astralPlane: 1.2, dreamDimension: 1.6, petrifiedForest: 3, realmOfDead: 3.5, invertedWorld: 5
};
const SEA_LANE_COST = 3.2;
const ROAD_OVER = new Set(["plains", "woods", "hills", "desert", "tundra", "forest", "swamp", "jungle",
  "vastPlains", "flowerFields", "fairyGrove", "enchantedForest", "darkForest", "canyon",
  "astralPlane", "dreamDimension", "petrifiedForest", "realmOfDead", "invertedWorld"]);
const SETTLEMENT_SCORE = { plains: 3, woods: 2, hills: 1.5, tundra: 0.8, jungle: 0.8, desert: 0.6, forest: 0.5,
  vastPlains: 3, flowerFields: 2.6, fairyGrove: 1.2, enchantedForest: 0.6, darkForest: 0.3, canyon: 0.5,
  astralPlane: 2.5, dreamDimension: 2, petrifiedForest: 0.6, realmOfDead: 0.3, invertedWorld: 0.4 };
const WILD = new Set(["mountain", "hills", "forest", "swamp", "jungle", "tundra", "desert", "woods",
  "enchantedForest", "darkForest", "fairyGrove", "canyon", "poisonSwamp", "snowyMountains"]);
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
  if ( theme === "metropolis" ) return generateMetropolis({ cols, rows, seed, id, name, start: startOption });
  if ( theme === "dungeonCrawl" ) return generateDungeon({ cols, rows, seed, id, name, start: startOption });
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

  // 8b. The themes of 1.3.0 put their own places on the map, with a random stream of their own.
  let named = [];
  if ( T.dress ) {
    named = T.dress({
      G, terrain, passable, elev, eRank, mRank, land, mainland, towns, city, villages, start, cols, rows,
      dist: distFromStart, far, reach, dungeons, treasures, ruins,
      rng: makeRng(`${theme}|${cols}x${rows}|${seed}|dress`)
    }) ?? [];
  }

  // 9. Cards, names and arrival texts.
  const cells = all.map(i => {
    const cell = { terrain: terrain[i] };
    if ( passable[i] !== null ) cell.passable = passable[i];
    return cell;
  });
  const nameOf = makeNamer(rng);
  for ( const i of [...towns, ...named] ) cells[i].label = nameOf();
  const texts = (type, list) => {
    const variants = rng.shuffle([1, 2, 3]);
    list.forEach((i, n) => { cells[i].text = `${K}Gen.${type}${variants[n % 3]}`; });
  };
  texts("dungeon", dungeons.filter(i => terrain[i] === "dungeon"));
  texts("treasure", treasures.filter(i => terrain[i] === "treasure"));
  texts("ruins", ruins.filter(i => terrain[i] === "ruins"));

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

/* ============================================================================================ */
/*  Themes of 1.3.0                                                                              */
/* ============================================================================================ */

/*
 * The overland themes (kingdom, wonders, mystic, machines, journey) are built by the classic
 * pipeline and then "dressed": settlements get their kind, and the theme's places are put on the
 * map by distance from the start and by what is around them. The dress has its own random stream.
 * metropolis and dungeonCrawl have their own builders (streets and blocks; rooms and corridors).
 */

const WATER = new Set(["sea", "starSea"]);

class Dress {
  constructor(ctx) {
    Object.assign(this, ctx);
    this.used = new Set([...ctx.towns, ctx.start]);
    this.reachSet = new Set(ctx.reach);
    this.named = [];
  }

  /** Distance from the start, 0-1 (unreachable cards count as the farthest). */
  d(i) {
    return Number.isFinite(this.dist[i]) ? this.dist[i] / this.far : 1;
  }

  near(i, types) {
    return this.G.around(i).some(j => types.includes(this.terrain[j]));
  }

  count(i, types) {
    return this.G.around(i).filter(j => types.includes(this.terrain[j])).length;
  }

  /** A card the dress may still change: not water, road, river, a point of interest or taken. */
  isOpen(i) {
    const t = this.terrain[i];
    return !this.used.has(i) && !POI.has(t) && !WATER.has(t) && t !== "road" && t !== "river";
  }

  spaced(i, gap) {
    for ( const j of this.used ) if ( this.G.dist(i, j) < gap ) return false;
    return true;
  }

  set(i, type) {
    this.terrain[i] = type;
    this.used.add(i);
    return i;
  }

  /**
   * Put `type` on the best open card of `cells` (default: the reachable land).
   * score(i, d) rates a card; `need(i)` filters. The spacing shrinks when nothing fits.
   */
  place(type, score, { gap = 2, cells = this.reach, need = () => true } = {}) {
    for ( let g = gap; g >= 0; g-- ) {
      let best = null;
      let bestScore = -Infinity;
      for ( const i of cells ) {
        if ( !this.isOpen(i) || !need(i) || (g && !this.spaced(i, g)) ) continue;
        const s = score(i, this.d(i)) + (this.rng() * 0.05);
        if ( s > bestScore ) {
          bestScore = s;
          best = i;
        }
      }
      if ( best !== null ) return this.set(best, type);
    }
    return null;
  }

  /** Score that prefers cards whose distance from the start is between lo and hi. */
  band(lo, hi) {
    return d => ((d >= lo && d <= hi) ? 2 : -Math.min(Math.abs(d - lo), Math.abs(d - hi)) * 5);
  }

  /**
   * The dungeons of the classic pipeline become places that fit their surroundings
   * (mountain: mine; desert: buried city; swamp: graveyard; jungle: temple; else a castle, a tower...).
   */
  typeDungeons(list, fallback = ["monsterCastle", "wizardTower", "catacombs", "ancientRuins"]) {
    const rest = [...fallback];
    const seen = new Set();
    for ( const i of list ) {
      if ( this.terrain[i] !== "dungeon" ) continue;
      const pick = [
        ["abandonedMine", ["mountain", "hills", "snowyMountains", "canyon"]],
        ["buriedCity", ["desert"]],
        ["cursedGraveyard", ["swamp", "poisonSwamp", "darkForest"]],
        ["forgottenTemple", ["jungle", "forest", "enchantedForest"]]
      ].find(([type, around]) => !seen.has(type) && (around.includes(this.terrain[i]) || this.near(i, around)));
      const type = pick?.[0] ?? rest.shift() ?? "ancientRuins";
      seen.add(type);
      this.terrain[i] = type;
    }
  }

  /** Settlements by what is around them (coast: fishing; wild woods: tribal; else rural). */
  plainTowns() {
    for ( const i of this.villages ) {
      if ( this.near(i, ["sea"]) ) this.terrain[i] = "fishingVillage";
      else if ( this.near(i, ["jungle", "forest", "enchantedForest", "darkForest"]) && this.rng.chance(0.5) ) this.terrain[i] = "tribalVillage";
      else this.terrain[i] = "ruralVillage";
    }
  }

  /** Land masses (4-neighbour) that are not the mainland. */
  islands() {
    const seen = new Set();
    const out = [];
    for ( const i of this.land ) {
      if ( seen.has(i) || this.mainland.has(i) || WATER.has(this.terrain[i]) ) continue;
      const group = [i];
      seen.add(i);
      for ( let q = 0; q < group.length; q++ ) {
        for ( const j of this.G.around(group[q]) ) {
          if ( seen.has(j) || WATER.has(this.terrain[j]) ) continue;
          seen.add(j);
          group.push(j);
        }
      }
      out.push(group);
    }
    return out;
  }

  /** Bodies of water that do not touch the border of the map. */
  lakes() {
    const seen = new Set();
    const out = [];
    for ( let i = 0; i < this.terrain.length; i++ ) {
      if ( seen.has(i) || this.terrain[i] !== "sea" ) continue;
      const group = [i];
      seen.add(i);
      let border = false;
      for ( let q = 0; q < group.length; q++ ) {
        const { x, y } = this.G.xy(group[q]);
        if ( x === 0 || y === 0 || x === this.cols - 1 || y === this.rows - 1 ) border = true;
        for ( const j of this.G.around(group[q]) ) {
          if ( seen.has(j) || this.terrain[j] !== "sea" ) continue;
          seen.add(j);
          group.push(j);
        }
      }
      if ( !border ) out.push(group);
    }
    return out;
  }

  /** Sea cards next to reachable land (for platforms and floating cities). */
  shore() {
    return this.terrain.map((t, i) => i).filter(i => this.terrain[i] === "sea" && this.passable[i] !== true
      && this.G.around(i).some(j => this.reachSet.has(j) && !WATER.has(this.terrain[j])));
  }

  /** A sea card becomes a walkable place (its card is passable). */
  placeOnSea(type, score) {
    let best = null;
    let bestScore = -Infinity;
    for ( const i of this.shore() ) {
      if ( this.used.has(i) || !this.spaced(i, 2) ) continue;
      const s = score(i) + (this.rng() * 0.05);
      if ( s > bestScore ) {
        bestScore = s;
        best = i;
      }
    }
    if ( best === null ) return null;
    this.passable[best] = true;
    return this.set(best, type);
  }
}

/** Natural terrains of the wonders and the hero's journey. */
function wondersLand(e, m, lat) {
  if ( e > 0.94 ) return "snowyMountains";
  if ( e > 0.87 ) return "mountain";
  if ( e > 0.75 ) return m < 0.32 ? "canyon" : "hills";
  if ( e < 0.12 && m > 0.6 ) return m > 0.85 ? "poisonSwamp" : "swamp";
  if ( m > 0.84 ) return lat > 0.62 ? "jungle" : (e > 0.45 ? "darkForest" : "enchantedForest");
  if ( m > 0.66 ) return "forest";
  if ( m > 0.5 ) return "woods";
  if ( m < 0.08 && lat > 0.5 ) return "desert";
  if ( m < 0.24 ) return "flowerFields";
  return "vastPlains";
}

const PLACE_THEMES = {
  kingdom: {
    sea: 0.28, edge: 0.45, scale: 0.42, rivers: 2.2, towns: 1.6, volcano: 0.15,
    land: THEME.continent.land,
    dress(c) {
      const D = new Dress(c);
      const T = c.terrain;
      if ( c.city !== null ) {
        T[c.city] = "capital";
        const ring = c.G.around(c.city).filter(j => D.isOpen(j)).sort((a, b) => c.elev[b] - c.elev[a]);
        if ( ring.length ) D.set(ring[0], "nobleDistrict");
        if ( ring.length > 1 ) D.set(ring.at(-1), "slums");
      }
      const quota = { portCity: 1, fishingVillage: 2, merchantCity: 2, undergroundCity: 1, tribalVillage: 1, walledVillage: 2 };
      const take = k => ((quota[k] ?? 0) > 0 ? ((quota[k] -= 1), k) : null);
      const plain = [];
      for ( const i of c.rng.shuffle([...c.villages]) ) {
        let t = null;
        if ( D.near(i, ["sea"]) ) t = take("portCity") ?? take("fishingVillage");
        else if ( D.near(i, ["mountain"]) && c.rng.chance(0.6) ) t = take("undergroundCity");
        if ( !t && D.near(i, ["jungle", "forest", "swamp"]) ) t = take("tribalVillage");
        if ( !t && D.near(i, ["river"]) ) t = take("merchantCity");
        if ( !t && D.d(i) > 0.7 ) t = take("walledVillage");
        if ( t ) T[i] = t;
        else plain.push(i);
      }
      const special = c.rng.shuffle(["academicCity", "holyCity", "industrialCity", "ruinCity"]);
      plain.forEach((i, n) => {
        T[i] = (n < special.length && n < plain.length - Math.floor(plain.length / 3)) ? special[n] : "ruralVillage";
      });
      const ruin = c.ruins.find(i => T[i] === "ruins");
      if ( ruin !== undefined ) T[ruin] = "abandonedCity";
      D.typeDungeons(c.dungeons);
      D.place("militaryFortress", (i, d) => d + (D.near(i, ["mountain", "hills"]) ? 1 : 0), { gap: 3, need: i => D.d(i) > 0.55 });
      const floating = D.placeOnSea("floatingCity", i => D.d(i));
      if ( floating !== null ) D.named.push(floating);
      for ( const i of c.reach ) {
        if ( D.isOpen(i) && ["plains", "woods"].includes(T[i]) && D.near(i, ["sea"]) && c.rng.chance(0.3) ) T[i] = "tropicalBeach";
      }
      return D.named;
    }
  },

  wonders: {
    sea: 0.24, edge: 0.4, scale: 0.38, rivers: 2.4, towns: 0.55, volcano: 0.6,
    land: wondersLand,
    dress(c) {
      const D = new Dress(c);
      const T = c.terrain;
      D.plainTowns();
      for ( const lake of D.lakes() ) if ( lake.length <= 8 ) for ( const i of lake ) T[i] = "crystalLake";
      for ( let n = T.filter(t => t === "crystalLake").length ? 1 : 0; n < 2; n++ ) {
        D.place("crystalLake", i => -c.elev[i], { gap: 4, need: i => !D.near(i, ["sea", "river"]) && !["desert", "snowyMountains", "mountain"].includes(T[i]) });
      }
      D.typeDungeons(c.dungeons, ["ancientRuins", "forgottenTemple"]);
      for ( const isle of D.islands() ) {
        if ( isle.length > 6 ) continue;
        const top = [...isle].sort((a, b) => c.elev[b] - c.elev[a])[0];
        for ( const i of isle ) T[i] = i === top ? "isolatedIsland" : "tropicalBeach";
      }
      const falls = c.reach.filter(i => T[i] === "river" && D.near(i, ["mountain", "hills", "snowyMountains", "canyon"]));
      for ( const i of c.rng.shuffle(falls) ) {
        if ( [...D.used].filter(j => T[j] === "waterfalls").length >= 3 ) break;
        if ( D.spaced(i, 3) ) D.set(i, "waterfalls");
      }
      for ( const i of c.reach ) {
        const lat = c.G.xy(i).y / Math.max(1, c.rows - 1);
        if ( D.isOpen(i) && lat > 0.35 && ["vastPlains", "flowerFields", "woods"].includes(T[i]) && D.near(i, ["sea"]) && c.rng.chance(0.45) ) T[i] = "tropicalBeach";
      }
      for ( let n = 0; n < 2; n++ ) D.place("oasis", (i, d) => d, { gap: 3, need: i => T[i] === "desert" && !D.near(i, ["sea"]) });
      for ( let n = 0; n < 2; n++ ) D.place("fairyGrove", () => c.rng(), { gap: 3, need: i => ["woods", "enchantedForest"].includes(T[i]) });
      D.place("crystalCave", (i, d) => d, { gap: 3, need: i => ["mountain", "hills", "snowyMountains", "canyon"].includes(T[i]) });
      D.place("dragonValley", (i, d) => d + D.count(i, ["mountain", "snowyMountains"]), { gap: 3, need: i => ["hills", "canyon", "vastPlains"].includes(T[i]) && D.count(i, ["mountain", "snowyMountains", "hills"]) >= 2 });
      return D.named;
    }
  },

  mystic: {
    sea: 0.34, edge: 0.35, scale: 0.34, rivers: 0, towns: 0.5, volcano: 0, lanes: true,
    land(e, m) {
      if ( e > 0.9 ) return "invertedWorld";
      if ( e > 0.76 ) return "petrifiedForest";
      if ( m > 0.8 ) return "enchantedForest";
      if ( m > 0.62 ) return "fairyGrove";
      if ( m < 0.14 ) return "realmOfDead";
      if ( m < 0.36 ) return "astralPlane";
      return "dreamDimension";
    },
    dress(c) {
      const D = new Dress(c);
      const T = c.terrain;
      if ( c.city !== null ) T[c.city] = "fairyRealm";
      c.villages.forEach((i, n) => { T[i] = (i === c.start || n % 2 === 0) ? "spiritSanctuary" : "celestialGarden"; });
      for ( let i = 0; i < T.length; i++ ) if ( T[i] === "camp" ) T[i] = "spiritSanctuary";
      const first = c.dungeons.find(i => T[i] === "dungeon");
      if ( first !== undefined ) T[first] = "dimensionalDungeon";
      D.place("colossalTree", (i, d) => D.count(i, ["enchantedForest"]) - Math.abs(d - 0.5), { gap: 3, need: i => T[i] === "enchantedForest" });
      D.place("demonAbyss", (i, d) => (d * 3) + (T[i] === "realmOfDead" ? 1 : 0));
      D.place("primordialCrystal", (i, d) => d + (["invertedWorld", "petrifiedForest"].includes(T[i]) ? 1 : 0), { gap: 3 });
      D.place("dimensionPortal", D.band(0.35, 0.6), { gap: 3 });
      D.place("dimensionPortal", D.band(0.7, 0.95), { gap: 3 });
      D.place("timeIsland", (i, d) => D.count(i, ["sea"]) + d, { gap: 3, need: i => D.count(i, ["sea"]) >= 2 });
      for ( let i = 0; i < T.length; i++ ) if ( T[i] === "sea" ) T[i] = "starSea";
      return D.named;
    }
  },

  machines: {
    sea: 0.22, edge: 0.4, scale: 0.4, rivers: 1.4, towns: 1.3, volcano: 0.1,
    land: THEME.continent.land,
    dress(c) {
      const D = new Dress(c);
      const T = c.terrain;
      if ( c.city !== null ) T[c.city] = "steampunkCity";
      const byFar = [...c.villages].sort((a, b) => D.d(b) - D.d(a));
      byFar.forEach((i, n) => {
        if ( n === 0 && byFar.length > 2 ) T[i] = "cyberpunkCity";
        else if ( D.near(i, ["hills", "mountain"]) && n % 2 ) T[i] = "industrialCity";
        else if ( n % 3 === 1 ) T[i] = "trainStation";
        else T[i] = n % 3 === 2 ? "industrialCity" : "ruralVillage";
      });
      if ( c.start !== c.city && !["ruralVillage", "trainStation"].includes(T[c.start]) ) T[c.start] = "trainStation";
      c.dungeons.filter(i => T[i] === "dungeon").forEach((i, n) => { T[i] = ["derelictShip", "militaryFortress", "abandonedMine"][n] ?? "derelictShip"; });
      D.place("planetColony", (i, d) => d * 4);
      D.place("spaceBase", (i, d) => d * 2 + (["plains", "desert", "tundra"].includes(T[i]) ? 1 : 0), { gap: 3 });
      D.place("magicWeaponsFacility", D.band(0.65, 0.9));
      D.place("militaryComplex", D.band(0.55, 0.85));
      D.place("researchLab", D.band(0.25, 0.55));
      D.place("powerPlant", (i, d) => (D.near(i, ["river"]) ? 2 : 0) + (D.near(i, ["mountain"]) ? 1 : 0) - Math.abs(d - 0.4));
      D.place("autoFactory", (i, d) => (D.near(i, ["road"]) ? 1 : 0) + (T[i] === "hills" ? 0.5 : 0) - Math.abs(d - 0.3));
      D.place("autoFactory", (i, d) => (D.near(i, ["road"]) ? 1 : 0) - Math.abs(d - 0.6));
      D.place("junkyard", (i, d) => (["desert", "plains", "tundra"].includes(T[i]) ? 1 : 0) - Math.abs(d - 0.5));
      D.placeOnSea("oilPlatform", i => -Math.abs(D.d(i) - 0.5));
      return D.named;
    }
  },

  journey: {
    sea: 0.28, edge: 0.42, scale: 0.4, rivers: 2, towns: 1, volcano: 0.9,
    land: wondersLand,
    dress(c) {
      const D = new Dress(c);
      const T = c.terrain;
      D.plainTowns();
      if ( c.city !== null ) T[c.city] = "capital";
      D.typeDungeons(c.dungeons, ["forgottenTemple", "wizardTower", "ancientRuins"]);
      const has = types => i => (types.includes(T[i]) ? 1 : 0);
      const by = types => i => (D.near(i, types) ? 1 : 0);
      D.place("lastDungeon", (i, d) => d * 10);
      D.place("villainFortress", (i, d) => D.band(0.88, 1)(d) + by(["mountain", "snowyMountains", "volcano"])(i) * 0.5);
      D.place("finalLabyrinth", D.band(0.82, 0.95));
      D.place("challengeTower", (i, d) => D.band(0.6, 0.85)(d) + has(["hills", "vastPlains"])(i) * 0.3);
      D.place("lightDungeon", (i, d) => D.band(0.66, 0.88)(d) + has(["vastPlains", "flowerFields", "plains"])(i) * 0.6);
      D.place("darkDungeon", (i, d) => D.band(0.66, 0.88)(d) + has(["darkForest", "swamp", "poisonSwamp"])(i) * 0.8);
      D.place("iceDungeon", (i, d) => D.band(0.52, 0.8)(d) + has(["snowyMountains", "tundra", "mountain"])(i) + by(["snowyMountains"])(i));
      D.place("poisonDungeon", (i, d) => D.band(0.52, 0.8)(d) + has(["swamp", "poisonSwamp", "jungle"])(i) + by(["poisonSwamp", "swamp"])(i) * 0.5);
      D.place("fireDungeon", (i, d) => D.band(0.32, 0.65)(d) + by(["volcano"])(i) * 1.5 + has(["desert", "canyon"])(i) * 0.8);
      D.place("waterDungeon", (i, d) => D.band(0.32, 0.65)(d) + by(["sea", "river", "crystalLake"])(i));
      D.place("earthDungeon", (i, d) => D.band(0.32, 0.65)(d) + has(["mountain", "hills", "canyon"])(i) * 0.8);
      D.place("airDungeon", (i, d) => D.band(0.32, 0.7)(d) + (c.eRank.get(i) ?? 0));
      D.place("firstDungeon", (i, d) => D.band(0.1, 0.3)(d) + has(["hills", "woods", "forest"])(i) * 0.5);
      return D.named;
    }
  }
};
Object.assign(THEME, PLACE_THEMES);

/* -------------------------------------------- */
/*  Metropolis: streets and city blocks          */
/* -------------------------------------------- */

const METRO_PLACES = [
  ["centralMarket", (s) => s.center * 3 + s.roads * 0.4],
  ["religiousOrder", (s) => s.center * 2 + s.wealth],
  ["merchantsGuild", (s) => s.center + s.nearMarket * 2],
  ["museum", (s) => s.wealth * 2 + s.center],
  ["theater", (s) => s.wealth + s.center],
  ["university", (s) => s.center + s.rand],
  ["magicAcademy", (s) => s.wealth * 0.5 + s.rand * 1.5],
  ["casino", (s) => s.wealth * 2 + s.rand * 0.3],
  ["restaurant", (s) => s.wealth + s.center * 0.5],
  ["thermalBaths", (s) => s.water * 2 + s.rand],
  ["colosseum", (s) => (1 - Math.abs(s.center - 0.5)) + s.rand],
  ["combatArena", (s) => (1 - s.center) * 1.5 + s.rand * 0.5],
  ["barracks", (s) => (1 - s.center) * 2],
  ["adventurersGuild", (s) => (1 - s.center) + s.rand * 0.5],
  ["tavern", (s) => (1 - s.wealth) + s.rand],
  ["tavern", (s) => (1 - s.wealth) + s.rand],
  ["inn", (s) => (1 - s.center) * 1.5 + s.rand * 0.3],
  ["inn", (s) => (1 - s.center) + s.rand * 0.6],
  ["tavern", (s) => (1 - s.wealth) * 0.5 + s.rand]
];

function generateMetropolis({ cols, rows, seed, id, name, start: startOption }) {
  const rng = makeRng(`metropolis|${cols}x${rows}|${seed}`);
  const G = grid(cols, rows);
  const N = cols * rows;
  const all = Array.from({ length: N }, (_, i) => i);
  const T = new Array(N).fill("city");
  const passable = new Array(N).fill(null);

  // 1. A coast along one side, sometimes.
  const coast = rng.chance(0.45) ? rng.pick(["bottom", "right", "left", "top"]) : null;
  const depth = coast === "bottom" || coast === "top" ? (rows >= 10 ? 2 : 1) : (cols >= 16 ? 2 : 1);
  for ( const i of all ) {
    const { x, y } = G.xy(i);
    if ( (coast === "bottom" && y >= rows - depth) || (coast === "top" && y < depth)
      || (coast === "right" && x >= cols - depth) || (coast === "left" && x < depth) ) T[i] = "sea";
  }

  // 2. Avenues every three or four cards.
  const xs = [];
  for ( let x = rng.int(1, 2); x < cols - 1; x += rng.int(3, 4) ) xs.push(x);
  const ys = [];
  for ( let y = rng.int(1, 2); y < rows - 1; y += 3 ) ys.push(y);
  for ( const i of all ) {
    const { x, y } = G.xy(i);
    if ( T[i] !== "sea" && (xs.includes(x) || ys.includes(y)) ) T[i] = "road";
  }

  // 3. A river across the city (bridges where it meets a street), sometimes.
  if ( rng.chance(0.5) ) {
    const vertical = rng.chance(0.5);
    let p = vertical ? rng.int(2, cols - 3) : rng.int(2, rows - 3);
    const len = vertical ? rows : cols;
    for ( let k = 0; k < len; k++ ) {
      const i = vertical ? G.at(p, k) : G.at(k, p);
      if ( T[i] === "city" ) T[i] = "river";
      if ( rng.chance(0.3) ) p = Math.max(1, Math.min((vertical ? cols : rows) - 2, p + (rng.chance(0.5) ? 1 : -1)));
    }
  }

  // 4. Rich centre, poor outskirts.
  const noise = fractalNoise(rng, cols, rows, Math.max(2.2, Math.min(cols, rows) * 0.4));
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  const centre = i => {
    const { x, y } = G.xy(i);
    return 1 - Math.min(1, Math.hypot((x - cx) / (cols / 2), (y - cy) / (rows / 2)));
  };
  const wealth = new Map(all.map(i => [i, (noise[i] * 0.5) + (centre(i) * 0.5)]));
  const blocks = all.filter(i => T[i] === "city");
  const byWealth = [...blocks].sort((a, b) => wealth.get(a) - wealth.get(b));
  const fifth = Math.max(1, Math.round(blocks.length * 0.2));
  for ( const i of byWealth.slice(0, fifth) ) T[i] = "slums";
  for ( const i of byWealth.slice(-fifth) ) T[i] = "nobleDistrict";

  // 5. Landmarks on blocks that open onto a street.
  const used = new Set();
  const spaced = (i, g) => [...used].every(j => G.dist(i, j) >= g);
  const onStreet = i => G.around(i).some(j => T[j] === "road");
  let market = null;
  const placeLandmark = (type, rate) => {
    for ( let g = 2; g >= 1; g-- ) {
      let best = null;
      let bestScore = -Infinity;
      for ( const i of all ) {
        if ( used.has(i) || !["city", "slums", "nobleDistrict"].includes(T[i]) || !onStreet(i) || !spaced(i, g) ) continue;
        const s = rate({
          center: centre(i), wealth: wealth.get(i), rand: rng(),
          roads: G.around(i).filter(j => T[j] === "road").length,
          water: G.around(i).some(j => ["river", "sea"].includes(T[j])) ? 1 : 0,
          nearMarket: market === null ? 0 : 1 / (1 + G.dist(i, market))
        });
        if ( s > bestScore ) {
          bestScore = s;
          best = i;
        }
      }
      if ( best !== null ) {
        T[best] = type;
        used.add(best);
        return best;
      }
    }
    return null;
  };
  if ( coast ) {
    const docks = all.filter(i => !used.has(i) && ["city", "slums", "nobleDistrict"].includes(T[i]) && G.around(i).some(j => T[j] === "sea"));
    if ( docks.length ) {
      const i = docks[Math.floor(docks.length / 2)];
      T[i] = "portCity";
      used.add(i);
    }
  }
  const places = [];
  for ( const [type, rate] of METRO_PLACES ) {
    const i = placeLandmark(type, rate);
    if ( i === null ) continue;
    if ( type === "centralMarket" ) market = i;
    places.push(i);
  }

  // 6. Where the group starts: an inn (or the market for "city", or the picked card).
  let start = null;
  if ( startOption?.mode === "pick" && Number.isFinite(Number(startOption.x)) && Number.isFinite(Number(startOption.y)) ) {
    const land = new Set(all.filter(i => T[i] !== "sea"));
    start = nearestIn(land, G.at(Math.max(0, Math.min(cols - 1, Math.floor(startOption.x))), Math.max(0, Math.min(rows - 1, Math.floor(startOption.y)))), G);
  }
  else if ( startOption?.mode === "city" && market !== null ) start = market;
  else start = places.find(i => T[i] === "inn") ?? market ?? all.find(i => T[i] === "road") ?? 0;

  // 7. Cards and names (taverns, inns and the market get one).
  const cells = all.map(i => {
    const cell = { terrain: T[i] };
    if ( passable[i] !== null ) cell.passable = passable[i];
    return cell;
  });
  const nameOf = makeNamer(rng);
  for ( const i of places ) if ( ["tavern", "inn", "centralMarket", "colosseum"].includes(T[i]) ) cells[i].label = nameOf();
  return finishBoard({ id, name, seed, cols, rows, cells, start });
}

/* -------------------------------------------- */
/*  Dungeon crawl: rooms and corridors           */
/* -------------------------------------------- */

function generateDungeon({ cols, rows, seed, id, name, start: startOption }) {
  const rng = makeRng(`dungeonCrawl|${cols}x${rows}|${seed}`);
  const G = grid(cols, rows);
  const N = cols * rows;
  const T = new Array(N).fill(null);

  // 1. Rooms (wings) that never touch each other.
  const rooms = [];
  const wanted = Math.max(4, Math.round(N / 15));
  for ( let tries = 0; tries < wanted * 40 && rooms.length < wanted; tries++ ) {
    const w = rng.int(1, 3);
    const h = rng.int(1, 2);
    const x = rng.int(0, cols - w);
    const y = rng.int(0, rows - h);
    if ( rooms.some(r => x < r.x + r.w + 1 && x + w + 1 > r.x && y < r.y + r.h + 1 && y + h + 1 > r.y) ) continue;
    rooms.push({ x, y, w, h });
  }
  for ( const r of rooms ) for ( let y = r.y; y < r.y + r.h; y++ ) for ( let x = r.x; x < r.x + r.w; x++ ) T[G.at(x, y)] = "dungeonWing";
  const centre = r => G.at(r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2));
  const centres = rooms.map(centre);

  // 2. Corridors: a spanning tree between the rooms plus a few loops.
  const carve = (a, b) => {
    let { x, y } = G.xy(a);
    const to = G.xy(b);
    const horizontalFirst = rng.chance(0.5);
    const stepX = () => { while ( x !== to.x ) { x += Math.sign(to.x - x); const i = G.at(x, y); if ( T[i] === null ) T[i] = "dungeonCorridor"; } };
    const stepY = () => { while ( y !== to.y ) { y += Math.sign(to.y - y); const i = G.at(x, y); if ( T[i] === null ) T[i] = "dungeonCorridor"; } };
    if ( horizontalFirst ) { stepX(); stepY(); }
    else { stepY(); stepX(); }
  };
  for ( const [a, b] of spanningTree(centres, G) ) carve(a, b);
  for ( let k = 0; k < Math.floor(rooms.length / 4); k++ ) {
    const a = rng.pick(centres);
    const others = centres.filter(b => b !== a).sort((p, q) => G.dist(a, p) - G.dist(a, q));
    if ( others[1] !== undefined ) carve(a, others[1]);
  }

  // 3. Prison cells: small pockets off the corridors.
  const corridors = rng.shuffle(T.map((t, i) => i).filter(i => T[i] === "dungeonCorridor"));
  let cellsMade = 0;
  for ( const i of corridors ) {
    if ( cellsMade >= Math.max(2, Math.floor(rooms.length / 2)) ) break;
    const holes = G.around(i).filter(j => T[j] === null && G.around(j).filter(k => T[k] !== null).length === 1);
    if ( !holes.length ) continue;
    T[rng.pick(holes)] = "dungeonCell";
    cellsMade++;
  }

  // 4. The entrance: the card nearest the bottom edge (or the one picked).
  const cards = T.map((t, i) => i).filter(i => T[i] !== null);
  let start;
  if ( startOption?.mode === "pick" && Number.isFinite(Number(startOption.x)) && Number.isFinite(Number(startOption.y)) ) {
    start = nearestIn(new Set(cards), G.at(Math.max(0, Math.min(cols - 1, Math.floor(startOption.x))), Math.max(0, Math.min(rows - 1, Math.floor(startOption.y)))), G);
  }
  else {
    start = [...cards].sort((a, b) => (G.xy(b).y - G.xy(a).y) || (Math.abs(G.xy(a).x - (cols / 2)) - Math.abs(G.xy(b).x - (cols / 2))))[0];
  }
  T[start] = "dungeon";

  // 5. Special rooms by depth (steps from the entrance), the royal crypt the deepest.
  const dist = new Array(N).fill(Infinity);
  dist[start] = 0;
  const queue = [start];
  for ( let q = 0; q < queue.length; q++ ) {
    for ( const j of G.around(queue[q]) ) {
      if ( T[j] === null || Number.isFinite(dist[j]) ) continue;
      dist[j] = dist[queue[q]] + 1;
      queue.push(j);
    }
  }
  const far = Math.max(1, ...cards.map(i => (Number.isFinite(dist[i]) ? dist[i] : 0)));
  const depth = i => (Number.isFinite(dist[i]) ? dist[i] / far : 0);
  const free = centres.filter(i => T[i] === "dungeonWing" && Number.isFinite(dist[i]));
  const claim = (type, score) => {
    let best = null;
    let bestScore = -Infinity;
    for ( const i of free ) {
      if ( T[i] !== "dungeonWing" ) continue;
      const s = score(depth(i), i) + (rng() * 0.05);
      if ( s > bestScore ) {
        bestScore = s;
        best = i;
      }
    }
    if ( best !== null ) T[best] = type;
    return best;
  };
  const band = (lo, hi) => d => ((d >= lo && d <= hi) ? 2 : -Math.min(Math.abs(d - lo), Math.abs(d - hi)) * 5);
  claim("royalCrypt", d => d * 10);
  if ( free.length >= 8 ) claim("dimensionalDungeon", band(0.75, 0.95));
  claim("elementalShrine", band(0.6, 0.9));
  claim("forbiddenLibrary", band(0.5, 0.85));
  claim("alchemyLab", band(0.4, 0.75));
  claim("undergroundPrison", (d, i) => G.around(i).filter(j => T[j] === "dungeonCell").length + band(0.2, 0.6)(d));
  claim("catacombs", band(0.25, 0.55));

  // 6. Treasure in dead ends.
  const deadEnds = cards.filter(i => ["dungeonCorridor", "dungeonCell"].includes(T[i]) && G.around(i).filter(j => T[j] !== null).length === 1 && i !== start)
    .sort((a, b) => depth(b) - depth(a));
  for ( const i of deadEnds.slice(0, clampInt(rooms.length / 4, 1, 3)) ) T[i] = "treasure";

  const cells = T.map(t => (t ? { terrain: t } : null));
  return finishBoard({ id, name, seed, cols, rows, cells, start });
}

/** Common end of the builders: party, rules, revealed cards around the start. */
function finishBoard({ id, name, seed, cols, rows, cells, start }) {
  const s = { x: start % cols, y: Math.floor(start / cols) };
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
