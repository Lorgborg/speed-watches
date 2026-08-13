import { Router } from "express"
import { sql } from "../../util/services.ts"
const router = Router()
import z from "zod"
import { getQueries } from "../../util/inputValidation.ts"
import { classifyQueryFields, buildWhereClause, buildValueClause } from "../../util/querryClassifier.ts"

const gameScore = z.object({
  discordId: z.string().optional().describe("where"),
  puuid: z.string().optional().describe("where"),
  matchId: z.string().optional().describe("where"),
  pushing: z.string().optional().describe("value"),
  laning: z.string().optional().describe("value"),
  teamFighting: z.string().optional().describe("value")
})

router.post('/post/gameScore', async (req, res) => {
  let parsed = getQueries(req.query, gameScore)
  const { where, values } = classifyQueryFields(gameScore.shape, parsed)

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
  const valueClause = buildValueClause(values)
  const query = await sql`
      UPDATE games
      SET ${valueClause}
      FROM users
      WHERE games.puuid=users.puuid and ${whereClause}
  `
  console.log(whereClause)
  res.send(true)
})

export default router