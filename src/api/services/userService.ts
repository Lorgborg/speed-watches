import { callRiot } from "../../riot/riotQueue.ts"
import { idToChampion } from "../../core/idToChampion.ts"
import { callRiotForSummoner } from "../../riot/resolvePuuidForTokens.ts"
import riotApi from "../../riot/riot.ts"
import { MAIN_TOKEN_INDEX, pickWorkerTokenIndex } from "../../riot/riotTokens.ts"

export type ResolvedPlayer = {
  summonerName: string
  puuid: string
  username: string
}

// Identity resolution ONLY — always the main token. The resulting puuid is
// the canonical one stored in the users table and used for all existence
// checks/comparisons against the DB.
export async function resolvePlayer(parsed: {
  summonerName?: string
  puuid?: string
  username?: string
}): Promise<ResolvedPlayer | null> {
  const { summonerName, puuid, username } = parsed;
  const parsedUsername = username ?? "none";

  if (summonerName !== undefined && puuid === undefined) {
    const resolvedPuuid = (await callRiot(MAIN_TOKEN_INDEX, riotApi.prototype.summonerNameToId, summonerName)).puuid;
    return { summonerName, puuid: resolvedPuuid, username: parsedUsername };
  } else if (puuid !== undefined && summonerName === undefined) {
    const resolvedName = (await callRiot(MAIN_TOKEN_INDEX, riotApi.prototype.idToSummoner, puuid)).summonerName;
    return { summonerName: resolvedName, puuid, username: parsedUsername };
  } else if (summonerName !== undefined && puuid !== undefined) {
    return { summonerName, puuid, username: parsedUsername };
  } else {
    return null;
  }
}

// Enrichment — needs its OWN token-scoped puuid, resolved (and cached) via
// summonerName, since the main-token puuid isn't portable.
export async function enrichSummoner(summonerName: string) {
  const enrichTokenIndex = await pickWorkerTokenIndex()

  const [highestMastery, accountDetails, rank] = await Promise.all([
    callRiotForSummoner(enrichTokenIndex, summonerName, riotApi.prototype.idToHighestMastery),
    callRiotForSummoner(enrichTokenIndex, summonerName, riotApi.prototype.idToSummoner),
    callRiotForSummoner(enrichTokenIndex, summonerName, riotApi.prototype.idToRank),
  ]);

  await Promise.all(
    highestMastery.map(async (mastery: { championId: number; championName?: string }) => {
      mastery.championName = await idToChampion(mastery.championId);
    })
  );

  return { highestMastery, accountDetails, rank }
}
