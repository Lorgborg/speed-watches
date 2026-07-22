import { Router } from "express"
const router = Router()
import { sql, riot } from "../../util/services.ts"

router.get('/get/matchup', async (req, res) => {
    const { championFighting, championPlayed, username, discordId, puuid, summonerName } = req.body ?? {}

    if (!championFighting || !championPlayed) {
        return res.status(400).json({ error: 'championFighting and championPlayed are required' })
    }

    // base conditions that are always present
    const conditions = [
        sql`champion_fighting = ${championFighting}`,
        sql`champion_played = ${championPlayed}`,
    ]

    // only add a condition if the field was actually provided
    if (username !== undefined) conditions.push(sql`username = ${username}`)
    if (discordId !== undefined) conditions.push(sql`discordid = ${discordId}`)
    if (puuid !== undefined) conditions.push(sql`puuid = ${puuid}`)
    if (summonerName !== undefined){
        const puuid = (await riot.summonerNameToId(summonerName)).data.puuid
        // error handling on incorrect name
        conditions.push(sql`puuid=${puuid}`)
    }

    // combine fragments with AND — this is the standard postgres.js composition trick
    const whereClause = conditions.reduce((acc, cur) => sql`${acc} AND ${cur}`)

    try {
        const rows = await sql`select * from notes join users on notes.puuid=users.puuid where ${whereClause}`

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