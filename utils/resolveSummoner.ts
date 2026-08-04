import riotApi from "./riot.ts"
import { callRiot } from "./riotQueue.ts"
import { pickTokenIndexForNewUser } from "./riotTokens.ts"

export async function resolveSummoner(name: string, tag?: string) {
    const tokenIndex = await pickTokenIndexForNewUser()
    const data = await callRiot(tokenIndex, riotApi.prototype.summonerNameToId, name, tag)
    return { puuid: data.puuid, tokenIndex }
}