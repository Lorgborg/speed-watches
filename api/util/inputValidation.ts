import type { AxiosResponse } from "axios";
import riotApi from "../../utils/riot.ts";
import "dotenv/config"

const { leagueApi } = process.env

if(leagueApi == undefined) {
    throw Error("league api in api checker.ts is undefined. Where is your .env file?")
}

const riot = new riotApi(leagueApi)

export function checkDiscordId(discordId: string): boolean {
    return !/^\d{17,19}$/.test(discordId);
}

export async function checkPuuid(puuid: string): Promise<AxiosResponse | undefined> {
    try {
        return await riot.idToSummoner(puuid)
    } catch (e: any) {
        if(e.code == "ERR_BAD_REQUEST") {
            return undefined
        }
    }
}

export function getQueries<T extends Record<string, unknown>>(
    query: T
): { [K in keyof T]: string | undefined } {
    const result = {} as { [K in keyof T]: string | undefined } 
    for (const key in query) {
        const value = query[key]
        result[key] = typeof value === "string" ? value : undefined
    }
    return result
}