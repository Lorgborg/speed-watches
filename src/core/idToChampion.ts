// championData.ts
interface ChampionDataEntry {
  key: string; // numeric champion id, as a string e.g. "103"
  id: string;  // champion name used by Riot, e.g. "Ahri"
  name: string; // display name, e.g. "Ahri"
}

interface ChampionJsonResponse {
  data: Record<string, ChampionDataEntry>;
}

let idToChampionMap: Map<number, string> | null = null;

async function getLatestDdragonVersion(): Promise<string> {
  const res = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
  if (!res.ok) throw new Error(`Failed to fetch ddragon versions: ${res.status}`);
  const versions: string[] = await res.json();
  return versions[0]; // first entry is always the latest
}

async function buildIdToChampionMap(): Promise<Map<number, string>> {
  const version = await getLatestDdragonVersion();
  const res = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`
  );
  if (!res.ok) throw new Error(`Failed to fetch champion.json: ${res.status}`);

  const json: ChampionJsonResponse = await res.json();

  const map = new Map<number, string>();
  for (const champ of Object.values(json.data)) {
    map.set(Number(champ.key), champ.name);
  }
  return map;
}

export async function idToChampion(championId: number): Promise<string> {
  if (!idToChampionMap) {
    idToChampionMap = await buildIdToChampionMap();
  }

  const name = idToChampionMap.get(championId);
  if (!name) {
    throw new Error(`Unknown championId: ${championId}`);
  }
  return name;
}