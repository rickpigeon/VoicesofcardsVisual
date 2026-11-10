/**
 * Default content: terrain library, travel options (the players' hand) and the sample map.
 * Names and texts are i18n keys, resolved at display time, so they follow the user's language
 * until the GM edits them.
 */
import { PATH } from "./constants.mjs";
import { defaultConfig, defaultTravel, revealAround } from "./rules.mjs";

const K = "CARDATLAS.";

function terrain(id, threat, extra = {}) {
  return {
    id,
    name: `${K}Terrain.${id}`,
    img: `${PATH}/assets/terrain/${id}.svg`,
    threat,
    passable: true,
    banner: false,
    color: "#6b7a3a",
    description: `${K}TerrainDesc.${id}`,
    ...extra
  };
}

/** Example areas from the threat table (Livro Básico p. 107) plus points of interest. */
export function defaultTerrains() {
  return [
    terrain("village", "minimal", { banner: true, color: "#9c6b3c" }),
    terrain("city", "minimal", { banner: true, color: "#7b5a8a" }),
    terrain("camp", "minimal", { banner: true, color: "#b4733a" }),
    terrain("road", "low", { color: "#a86b4c" }),
    terrain("plains", "low", { color: "#7fa046" }),
    terrain("woods", "medium", { color: "#4f8a3f" }),
    terrain("hills", "medium", { color: "#8a9a4a" }),
    terrain("river", "medium", { color: "#4a8db0" }),
    terrain("forest", "high", { color: "#2f5d3a" }),
    terrain("mountain", "high", { color: "#7d7f86" }),
    terrain("sea", "high", { passable: false, color: "#1f4f7a" }),
    terrain("swamp", "high", { color: "#556b4a" }),
    terrain("desert", "veryHigh", { color: "#d2a65a" }),
    terrain("tundra", "veryHigh", { color: "#a9c4d6" }),
    terrain("jungle", "veryHigh", { color: "#2c6b3f" }),
    terrain("volcano", "veryHigh", { color: "#7a2e22" }),
    terrain("ruins", "medium", { banner: true, color: "#8b8172" }),
    terrain("dungeon", "high", { banner: true, color: "#4b4552" }),
    terrain("treasure", "low", { banner: true, color: "#b5452f" })
  ];
}

function option(id, data) {
  return {
    id,
    name: `${K}Opt.${id}.name`,
    description: `${K}Opt.${id}.desc`,
    source: "",
    icon: "fa-solid fa-star",
    img: "",
    cost: "",
    action: "chat",
    value: "",
    step: false,
    gmOnly: false,
    enabled: true,
    confirm: true,
    prompt: "",
    choices: [],
    ...data
  };
}

function choice(optionId, key, cost = "") {
  return { label: `${K}Opt.${optionId}.${key}`, cost, text: `${K}Opt.${optionId}.${key}Text` };
}

/** The players' hand of travel options. */
export function defaultOptions() {
  return [
    option("rest", {
      icon: "fa-solid fa-campground",
      source: "LB p. 90-91, 125",
      choices: [
        choice("rest", "tent", `${K}Cost.ip4`),
        choice("rest", "hosp"),
        choice("rest", "safe"),
        choice("rest", "inn1", `${K}Cost.z5`),
        choice("rest", "inn2", `${K}Cost.z10`),
        choice("rest", "inn3", `${K}Cost.z20`)
      ]
    }),
    option("item", {
      icon: "fa-solid fa-flask",
      source: "LB p. 104",
      choices: [
        choice("item", "elixir", `${K}Cost.ip3`),
        choice("item", "remedy", `${K}Cost.ip3`),
        choice("item", "tonic", `${K}Cost.ip2`),
        choice("item", "shard", `${K}Cost.ip2`),
        choice("item", "tent", `${K}Cost.ip4`)
      ]
    }),
    option("restock", {
      icon: "fa-solid fa-basket-shopping",
      source: "LB p. 105",
      cost: `${K}Cost.z10ip`,
      prompt: `${K}Opt.restock.prompt`
    }),
    option("services", {
      icon: "fa-solid fa-sailboat",
      source: "LB p. 124-125",
      choices: [
        choice("services", "land", `${K}Cost.z10`),
        choice("services", "water", `${K}Cost.z20`),
        choice("services", "air", `${K}Cost.z40`)
      ]
    }),
    option("newPlace", {
      icon: "fa-solid fa-map-location-dot",
      source: "LB p. 98, 108",
      cost: `${K}Cost.fp1`,
      prompt: `${K}Opt.newPlace.prompt`
    }),
    option("explore", {
      icon: "fa-solid fa-binoculars",
      source: `${K}Source.house`,
      action: "reveal",
      value: "2",
      step: true,
      enabled: false
    }),
    option("cartography", {
      icon: "fa-solid fa-compass-drafting",
      source: "Atlas Natural Fantasy p. 130",
      action: "reroll",
      enabled: false
    }),
    option("camp", {
      icon: "fa-solid fa-fire",
      source: "Atlas Natural Fantasy p. 130-133",
      enabled: false,
      choices: [
        "combat", "magic", "carto", "harvest", "owl", "daydream", "exercise", "scout",
        "forge", "massage", "pep", "plan", "double", "sleep", "martial"
      ].map(k => choice("camp", k))
    })
  ];
}

/**
 * Sample map, 16 x 10. Legend:
 * v village, c city, k camp, r road, p plains, w woods, h hills, R river, f forest, m mountain,
 * s sea, S swamp, d desert, t tundra, j jungle, V volcano, u ruins, D dungeon, T treasure, . no card
 */
const SAMPLE_LEGEND = {
  v: "village", c: "city", k: "camp", r: "road", p: "plains", w: "woods", h: "hills", R: "river",
  f: "forest", m: "mountain", s: "sea", S: "swamp", d: "desert", t: "tundra", j: "jungle",
  V: "volcano", u: "ruins", D: "dungeon", T: "treasure"
};

const SAMPLE_MAP = [
  "mmmttmmffffpssss",
  "mDmmtmffTfppps..",
  "hmhhmffffwprppss",
  "hhhwwfufwwprpcss",
  "phwwppwwpprrppps",
  "ppprrrrrrrrpRRps",
  "SSprppwppRRRpsss",
  "SSSrvpppRppppsss",
  "jSSppkpRpddppsss",
  "jjSpppRRddVd.sss"
];

export function createBoard({ id, name, cols = 12, rows = 8, fill = "plains" } = {}) {
  const board = {
    id: id ?? foundry.utils.randomID(),
    name: name || "?",
    cols,
    rows,
    cells: Array.from({ length: cols * rows }, () => ({ terrain: fill })),
    party: { x: Math.floor(cols / 2), y: Math.floor(rows / 2) },
    config: defaultConfig(),
    travel: defaultTravel()
  };
  revealAround(board, board.party.x, board.party.y, board.config.revealRadius);
  board.cells[(board.party.y * cols) + board.party.x].visited = true;
  return board;
}

export function createSampleBoard({ id, name } = {}) {
  const rows = SAMPLE_MAP.length;
  const cols = SAMPLE_MAP[0].length;
  const board = createBoard({ id, name, cols, rows });
  board.cells = [];
  for ( const line of SAMPLE_MAP ) {
    for ( const ch of line ) board.cells.push(SAMPLE_LEGEND[ch] ? { terrain: SAMPLE_LEGEND[ch] } : null);
  }
  const at = (x, y) => board.cells[(y * cols) + x];
  board.party = { x: 4, y: 7 };
  at(4, 7).label = "Vila do Poço";
  at(4, 7).visited = true;
  at(13, 3).label = "Porto Alto";
  at(8, 1).text = `${K}Sample.chest`;
  at(1, 1).text = `${K}Sample.dungeon`;
  at(6, 3).text = `${K}Sample.ruins`;
  revealAround(board, 4, 7, board.config.revealRadius);
  return board;
}
