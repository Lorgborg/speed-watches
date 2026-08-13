import { Router } from "express"
const router = Router()
import z from "zod"
import { getQueries } from "../../util/inputValidation"
import { buildWhereClause, classifyQueryFields } from "../../util/querryClassifier"
import { sql } from "../../util/services"

const gameQuerySchema = z.object({
    puuid: z.string().optional().describe("where:users.puuid"),
    discordId: z.string().describe("where"),
    matchId: z.string().optional().describe("where"),
    championFighting: z.string().optional().describe("where"),
    championPlayed: z.string().optional().describe("where"),
    limit: z.string().optional().default("20").describe("limit")
})

router.get("/get/game", async(req, res) => {
    const parsed = getQueries(req.query, gameQuerySchema)
    const { where } = classifyQueryFields(gameQuerySchema.shape, parsed)

    if(parsed.matchId == null) {
      const latest = buildWhereClause(where)
      const latestGame = await sql`
      SELECT
        g.match_id,
        g.game_creation,
        g.champion_played,
        g.champion_fighting,
        g.role,
        g.kda,
        g.is_win,
        COALESCE(
            json_agg(
                json_build_object(
                    'champion_fighting', n.champion_fighting,
                    'notes', n.notes
                )
            ) FILTER (WHERE n.puuid IS NOT NULL),
            '[]'::json
        ) AS notes_applicable
      FROM games g
      JOIN users u ON g.puuid = u.puuid
      LEFT JOIN notes n
          ON g.puuid = n.puuid
          AND g.match_id = ANY(n.matchids)
      WHERE ${latest}
      GROUP BY u.discord_id, u.summoner_name, g.match_id, g.game_creation, 
              g.champion_played, g.role, g.kda, g.is_win, g.champion_fighting
      ORDER BY g.game_creation DESC
      LIMIT 1;`
      parsed.matchId = latestGame[0].match_id
    }

    const whereClause = buildWhereClause(where)
    
    const query = await sql`
        select username, games.puuid, match_id, champion_played, champion_fighting, role, kda, is_win, game_length, champ_composition, laning, team_fighting
        from games
        join users on games.puuid=users.puuid
        where ${whereClause}
        LIMIT ${parsed.limit}
    `
    
    res.json(query)
})

export default router