// utils/riotTokens.ts
import "dotenv/config"
import connection from "./redisConnection.ts"

export function getRiotTokens(): string[] {
    const tokens: string[] = []
    for (let i = 1; i <= 4; i++) {
        const key = process.env[`leagueApi${i}`]
        if (key) tokens.push(key)
    }
    if (tokens.length === 0) {
        throw new Error("No leagueApi1..leagueApi4 tokens found in .env")
    }
    return tokens
}

/** Assigns a brand-new user to a token, round-robin, persisted in Redis. */
export async function pickTokenIndexForNewUser(): Promise<number> {
    const tokenCount = getRiotTokens().length
    const next = await connection.incr("riot:next-token-assignment")
    return (next - 1) % tokenCount
}