import { Router } from "express"
const router = Router()
import { sql, riot } from "../../util/services.ts"
import { getQueries } from "../../util/inputValidation.ts"
import { classifyQueryFields, buildWhereClause } from "../../util/querryClassifier"
import { z } from "zod"

const MatchUpWRQuerySchema = z.object({
    championPlayed: z.string().optional().describe("where:notes.champion_played"),
    puuid: z.string().optional().describe("where:games.puuid"),
    championFighting: z.string().optional().describe("where:notes.champion_fighting"),
    role: z.string().optional().describe("where:notes.role"),
    // intentionally not described because it's like puuid
    summonerName: z.string().optional(),
    discordId: z.string().optional().describe("where:users.discord_id"),
    username: z.string().optional().describe("where:users.username"),
})

router.get('/get/matchup', async (req, res) => {
    let parsed: z.infer<typeof MatchUpWRQuerySchema>

    try {
        parsed = getQueries(req.query, MatchUpWRQuerySchema)
    } catch (e: any) {
        if (e instanceof z.ZodError) {
            return res.status(400).json({
                error: 'Invalid query parameters',
                issues: e.issues.map(i => ({ path: i.path.join('.'), message: i.message }))
            })
        }
        console.error('Query parsing failed:', e)
        return res.status(500).json({ error: 'Unexpected query parsing error' })
    }

    // kinda like unique constraint
    const identifierFields = {
        puuid: parsed.puuid,
        summonerName: parsed.summonerName,
        discordId: parsed.discordId,
    }
    const suppliedIdentifiers = Object.entries(identifierFields)
        .filter(([, value]) => value !== undefined)
        .map(([key]) => key)

    if (suppliedIdentifiers.length > 1) {
        return res.status(400).json({
            error: 'Only one of puuid, summonerName, or discordId may be supplied at a time',
            received: suppliedIdentifiers,
        })
    }

    const { where } = classifyQueryFields(MatchUpWRQuerySchema.shape, parsed)

    // summonerName needs an async Riot lookup before it can become a condition,
    // and it resolves to games.puuid rather than its own column — handled
    // separately from the schema-driven classifier.
    if (parsed.summonerName !== undefined) {
        try {
            const resolvedPuuid = (await riot.summonerNameToId(parsed.summonerName)).data.puuid
            where.push(sql`games.puuid = ${resolvedPuuid}`)
        } catch (e: any) {
            console.error('Riot summoner lookup failed:', e)
            return res.status(502).json({ error: 'Failed to resolve summoner name' })
        }
    }

    const whereClause = buildWhereClause(where)

    try {
        const rows = await sql`
            select users.summoner_name, users.discord_id, notes.champion_played, notes.champion_fighting, notes.role, notes.notes,
                count(*) filter (where is_win = true) as wins,
                count(*) filter (where is_win = false) as lose
            from games
            join users on games.puuid = users.puuid
            join notes on notes.champion_fighting = games.champion_fighting
                    and notes.champion_played = games.champion_played
                    and notes.role = games.role
                    and notes.puuid = games.puuid
            where ${whereClause}
            group by notes.champion_fighting, notes.champion_played, notes.role, notes.notes, users.summoner_name, users.discord_id, games.game_creation
            order by game_creation asc;
            `
        if (rows.length === 0) {
            return res.status(404).json({ error: 'No matching notes found' })
        }

        res.json(rows)
    } catch (e: any) {
        console.error('Query failed:', e)

        switch (e.code) {
            case '22P02':
                return res.status(400).json({ error: 'Invalid value format' })
            case '42703':
                return res.status(500).json({ error: 'Server query error (bad column)' })
            case '23505':
                return res.status(409).json({ error: 'Conflict' })
            default:
                return res.status(500).json({ error: 'Unexpected database error' })
        }
    }
})

export default router