/**
 * The places added in 1.3.0: cities, natural wonders, dungeons, magical realms, machines,
 * social places and the hero's journey dungeons. Each becomes a terrain of the library
 * (name and description are i18n keys, art in assets/terrain/<id>.svg) and the new map themes
 * place them. Pure data, no Foundry calls.
 *
 * [id, group, threat, color, banner, passable = true]
 */
export const GROUPS = ["basic", "city", "nature", "dungeon", "magic", "tech", "social", "progress"];

const P = [
  /* Cities and inhabited areas */
  ["capital", "city", "minimal", "#8a5aa8", true],
  ["ruralVillage", "city", "minimal", "#a8794a", true],
  ["portCity", "city", "minimal", "#4a7ea8", true],
  ["merchantCity", "city", "minimal", "#b8893a", true],
  ["undergroundCity", "city", "low", "#6a5a4a", true],
  ["floatingCity", "city", "low", "#7ab0d8", true],
  ["fishingVillage", "city", "minimal", "#5a8aa0", true],
  ["tribalVillage", "city", "low", "#9a6a3a", true],
  ["industrialCity", "city", "low", "#6a6a70", true],
  ["academicCity", "city", "minimal", "#5a6aa8", true],
  ["holyCity", "city", "minimal", "#d8c070", true],
  ["abandonedCity", "city", "medium", "#7a7468", true],
  ["nobleDistrict", "city", "minimal", "#9a6ab0", true],
  ["slums", "city", "low", "#7a6650", true],
  ["ruinCity", "city", "low", "#8a8070", true],
  ["walledVillage", "city", "minimal", "#8a7a60", true],

  /* Natural areas (desert, volcano and jungle already exist) */
  ["enchantedForest", "nature", "medium", "#3a7a6a", false],
  ["darkForest", "nature", "high", "#1f3a2a", false],
  ["fairyGrove", "nature", "low", "#5aa070", false],
  ["vastPlains", "nature", "low", "#9ab85a", false],
  ["flowerFields", "nature", "low", "#b8a0c8", false],
  ["poisonSwamp", "nature", "veryHigh", "#6a5a7a", false],
  ["oasis", "nature", "low", "#4aa88a", true],
  ["snowyMountains", "nature", "veryHigh", "#c8d4e0", false],
  ["canyon", "nature", "high", "#b8643a", false],
  ["waterfalls", "nature", "medium", "#4a9ac0", false],
  ["crystalLake", "nature", "medium", "#5ab8d8", false],
  ["tropicalBeach", "nature", "low", "#e8d08a", false],
  ["isolatedIsland", "nature", "medium", "#6aa060", true],
  ["crystalCave", "nature", "high", "#7a6ab0", true],
  ["dragonValley", "nature", "veryHigh", "#8a4a3a", true],

  /* Dungeons and places to explore */
  ["dungeonWing", "dungeon", "high", "#5a5260", false],
  ["dungeonCell", "dungeon", "high", "#4a4450", false],
  ["dungeonCorridor", "dungeon", "medium", "#5e5864", false],
  ["abandonedMine", "dungeon", "high", "#6a5440", true],
  ["catacombs", "dungeon", "high", "#5a5248", true],
  ["royalCrypt", "dungeon", "veryHigh", "#4a3a5a", true],
  ["ancientRuins", "dungeon", "high", "#8a7a5a", true],
  ["forgottenTemple", "dungeon", "high", "#6a7a5a", true],
  ["wizardTower", "dungeon", "high", "#5a4a8a", true],
  ["monsterCastle", "dungeon", "veryHigh", "#4a3a3a", true],
  ["undergroundPrison", "dungeon", "high", "#4a4a52", true],
  ["alchemyLab", "dungeon", "high", "#4a7a5a", true],
  ["forbiddenLibrary", "dungeon", "high", "#5a3a3a", true],
  ["elementalShrine", "dungeon", "high", "#4a6a8a", true],
  ["dimensionalDungeon", "dungeon", "veryHigh", "#5a3a8a", true],
  ["derelictShip", "dungeon", "veryHigh", "#4a5a6a", true],
  ["militaryFortress", "dungeon", "high", "#5a5a4a", true],
  ["cursedGraveyard", "dungeon", "high", "#3a4a3a", true],
  ["buriedCity", "dungeon", "high", "#8a6a4a", true],

  /* Magical and supernatural areas */
  ["fairyRealm", "magic", "medium", "#b080c8", true],
  ["astralPlane", "magic", "high", "#3a3a7a", false],
  ["dreamDimension", "magic", "medium", "#c8a0d8", false],
  ["petrifiedForest", "magic", "high", "#8a8478", false],
  ["starSea", "magic", "high", "#1a1a4a", false, false],
  ["realmOfDead", "magic", "veryHigh", "#3a3a4a", false],
  ["colossalTree", "magic", "medium", "#3a6a3a", true],
  ["celestialGarden", "magic", "low", "#e0d090", true],
  ["demonAbyss", "magic", "veryHigh", "#6a1a1a", true],
  ["invertedWorld", "magic", "high", "#5a7a8a", false],
  ["timeIsland", "magic", "high", "#a08a5a", true],
  ["primordialCrystal", "magic", "high", "#6ab8d8", true],
  ["spiritSanctuary", "magic", "minimal", "#8ac0b0", true],
  ["dimensionPortal", "magic", "high", "#8a4ac8", true],

  /* Technological and industrial areas */
  ["autoFactory", "tech", "medium", "#6a6a6a", true],
  ["steampunkCity", "tech", "minimal", "#a8743a", true],
  ["trainStation", "tech", "minimal", "#7a5a4a", true],
  ["researchLab", "tech", "medium", "#5a8aa0", true],
  ["powerPlant", "tech", "medium", "#8a8a3a", true],
  ["militaryComplex", "tech", "high", "#4a5a3a", true],
  ["oilPlatform", "tech", "medium", "#5a5a6a", true],
  ["junkyard", "tech", "medium", "#7a6a5a", true],
  ["cyberpunkCity", "tech", "low", "#3a2a5a", true],
  ["spaceBase", "tech", "medium", "#6a7a9a", true],
  ["planetColony", "tech", "medium", "#b86a4a", true],
  ["magicWeaponsFacility", "tech", "high", "#6a4a8a", true],

  /* Social and service places */
  ["adventurersGuild", "social", "minimal", "#8a5a3a", true],
  ["merchantsGuild", "social", "minimal", "#b8943a", true],
  ["magicAcademy", "social", "minimal", "#5a4aa8", true],
  ["university", "social", "minimal", "#6a5a4a", true],
  ["barracks", "social", "minimal", "#6a6a4a", true],
  ["combatArena", "social", "low", "#a85a3a", true],
  ["colosseum", "social", "low", "#c8a878", true],
  ["centralMarket", "social", "minimal", "#c8784a", true],
  ["tavern", "social", "minimal", "#8a5a2a", true],
  ["inn", "social", "minimal", "#9a6a3a", true],
  ["restaurant", "social", "minimal", "#b84a3a", true],
  ["casino", "social", "minimal", "#2a6a4a", true],
  ["theater", "social", "minimal", "#8a2a3a", true],
  ["museum", "social", "minimal", "#a8a090", true],
  ["thermalBaths", "social", "minimal", "#5aa0b0", true],
  ["religiousOrder", "social", "minimal", "#c8b880", true],

  /* Hero's journey: progression dungeons */
  ["firstDungeon", "progress", "medium", "#6a7a5a", true],
  ["fireDungeon", "progress", "high", "#b83a2a", true],
  ["waterDungeon", "progress", "high", "#2a6ab8", true],
  ["earthDungeon", "progress", "high", "#8a6a3a", true],
  ["airDungeon", "progress", "high", "#6ab8a0", true],
  ["iceDungeon", "progress", "high", "#8ab8d8", true],
  ["poisonDungeon", "progress", "high", "#8a4a8a", true],
  ["lightDungeon", "progress", "veryHigh", "#d8c868", true],
  ["darkDungeon", "progress", "veryHigh", "#3a2a5a", true],
  ["challengeTower", "progress", "veryHigh", "#6a5a7a", true],
  ["finalLabyrinth", "progress", "veryHigh", "#4a4a3a", true],
  ["villainFortress", "progress", "veryHigh", "#3a1a2a", true],
  ["lastDungeon", "progress", "veryHigh", "#2a1a3a", true]
];

export const PLACES = P.map(([id, group, threat, color, banner, passable = true]) => ({ id, group, threat, color, banner, passable }));

/** The group of every built-in terrain (the 19 of 1.0 are "basic"). */
export const BASIC_TERRAINS = ["village", "city", "camp", "road", "plains", "woods", "hills", "river", "forest", "mountain",
  "sea", "swamp", "desert", "tundra", "jungle", "volcano", "ruins", "dungeon", "treasure"];
const GROUP_OF = new Map([...BASIC_TERRAINS.map(id => [id, "basic"]), ...PLACES.map(p => [p.id, p.group])]);

/** Group of a terrain: its own field, else the built-in one with that id, else "custom". */
export function groupOf(terrain) {
  if ( GROUPS.includes(terrain?.group) ) return terrain.group;
  return GROUP_OF.get(terrain?.id) ?? "custom";
}
