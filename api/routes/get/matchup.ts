import { Router } from "express"
const router = Router()
import { sql, riot } from "../../util/services.ts"
import { getQueries } from "../../util/inputValidation.ts"
import { z } from "zod"

const MatchUpWRQuerySchema = z.object({
    championPlayed: z.string().optional(),
    puuid: z.string().optional(),
    championFighting: z.string().optional(),
    role: z.string().optional(),
    summonerName: z.string().optional(),
    discordId: z.string().optional(),
    username: z.string().optional()
})

router.get('/get/matchup', async (req, res) => {
    const { championFighting, championPlayed, username, discordId, puuid, summonerName } = getQueries(req.query, MatchUpWRQuerySchema) ?? {}

    const conditions = []

    // only add a condition if the field was actually provided
    if (championFighting !== undefined) conditions.push(sql`notes.champion_fighting = ${championFighting}`)
    if (championPlayed !== undefined) conditions.push(sql`notes.champion_played = ${championPlayed}`,)
    if (username !== undefined) conditions.push(sql`users.username = ${username}`)
    if (discordId !== undefined) conditions.push(sql`users.discordid = ${discordId}`)
    if (puuid !== undefined) conditions.push(sql`games.puuid = ${puuid}`)
    if (summonerName !== undefined){
        const puuid = (await riot.summonerNameToId(summonerName)).data.puuid
        // error handling on incorrect name
        conditions.push(sql`puuid=${puuid}`)
    }

    // combine fragments with AND — this is the standard postgres.js composition trick
    const whereClause = conditions.reduce((acc, cur) => sql`${acc} AND ${cur}`)

    try {
        const rows = await sql`
            select users.username, users.puuid, notes.champion_played, notes.champion_fighting, notes.role, notes.notes,
                count(*) filter (where is_win = true) as wins,
                count(*) filter (where is_win = false) as lose
            from games
            join users on games.puuid = users.puuid
            join notes on notes.champion_fighting = games.champion_fighting
                    and notes.champion_played = games.champion_played
                    and notes.role = games.role
            and notes.puuid = games.puuid 
            where ${whereClause}
            group by notes.champion_fighting, notes.champion_played, notes.role, notes.notes, users.puuid, users.username
            order by wins desc;
            `
        if (rows.length === 0) {
            return res.status(404).json({ error: 'No matching notes found' })
        }

        res.json(rows)
    } catch (e: any) {
        console.error('Query failed:', e)

        // postgres.js attaches the Postgres error code to e.code
        switch (e.code) {
            case '22P02': // invalid_text_representation, e.g. bad UUID/int cast
                return res.status(400).json({ error: 'Invalid value format' })
            case '42703': // undefined_column
                return res.status(500).json({ error: 'Server query error (bad column)' })
            case '23505': // unique_violation (not relevant here, but common elsewhere)
                return res.status(409).json({ error: 'Conflict' })
            default:
                return res.status(500).json({ error: 'Unexpected database error' })
        }
    }
})

export default router