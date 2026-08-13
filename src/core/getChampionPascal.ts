function toPascalCase(str: string): string {
  return str
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}

function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const pascalCaseExceptions: Record<string, string> = {
  // Bel'Veth — apostrophe doesn't split into a new capital
  belveth: "Belveth",
  bel: "Belveth",

  // Cho'Gath — apostrophe doesn't split into a new capital
  chogath: "Chogath",
  cho: "Chogath",

  // Kai'Sa — apostrophe doesn't split into a new capital
  kaisa: "Kaisa",
  kai: "Kaisa",

  // Kha'Zix — apostrophe doesn't split into a new capital
  khazix: "Khazix",
  kha: "Khazix",

  // Nunu & Willump — commonly just "Nunu"
  nunuwillump: "Nunu",
  nunu: "Nunu",

  // Renata Glasc — commonly just "Renata"
  renataglasc: "Renata",
  renata: "Renata",

  // Wukong — real name and nickname both resolve to "MonkeyKing"
  wukong: "MonkeyKing",
  wu: "MonkeyKing",
  monkeyking: "MonkeyKing",

  // --- Other common nicknames (standard PascalCase rule works fine for
  // these once resolved, they just need the name expanded first) ---
  asol: "AurelionSol",
  drmundo: "DrMundo",
  mundo: "DrMundo",
  gp: "Gangplank",
  heimer: "Heimerdinger",
  j4: "JarvanIV",
  jarvan: "JarvanIV",
  ksante: "KSante",
  kog: "KogMaw",
  leb: "LeBlanc",
  leesin: "LeeSin",
  lee: "LeeSin",
  masteryi: "MasterYi",
  yi: "MasterYi",
  mf: "MissFortune",
  missfortune: "MissFortune",
  reksai: "RekSai",
  rek: "RekSai",
  tahmkench: "TahmKench",
  tahm: "TahmKench",
  kench: "TahmKench",
  tf: "TwistedFate",
  twistedfate: "TwistedFate",
  velkoz: "VelKoz",
  vel: "VelKoz",
  ww: "Warwick",
  xinzhao: "XinZhao",
  xin: "XinZhao",
};

function getChampionPascalCase(input: string): string {
  const key = normalize(input);
  return pascalCaseExceptions[key] ?? toPascalCase(input);
}

export { getChampionPascalCase };