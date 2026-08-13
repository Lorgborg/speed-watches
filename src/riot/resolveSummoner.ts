import riotApi from "./riot.ts"
import { callRiot } from "./riotQueue.ts"
import { MAIN_TOKEN_INDEX } from "./riotTokens.ts"

export async function resolveSummoner(name: string, tag?: string) {
  const data = await callRiot(MAIN_TOKEN_INDEX, riotApi.prototype.summonerNameToId, name, tag)
  return { puuid: data.puuid, tokenIndex: MAIN_TOKEN_INDEX }
}