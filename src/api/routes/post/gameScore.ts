// api/routes/post/gameScore.ts
import { Router } from "express"
import { sql } from "../../../config/services.ts"
const router = Router()
import z from "zod"
import { getQueries } from "../../query/inputValidation.ts"
import { classifyQueryFields, buildWhereClause, buildValueClause } from "../../query/queryClassifier.ts"

const gameScore = z.object({
  discordId: z.string().optional().describe("where"),
  puuid: z.string().optional().describe("where"),
  matchId: z.string().optional().describe("where"),
  pushing: z.string().optional().describe("value"),
  laning: z.string().optional().describe("value"),
  teamFighting: z.string().optional().describe("value")
})

router.post('/post/gameScore', async (req, res) => {
  let parsed: z.infer<typeof gameScore>
  try {
    parsed = getQueries(req.query, gameScore)
  } catch (e) {
    res.status(400).send(e instanceof Error ? e.message : "Invalid query parameters")
    return
  }

  try {
    if (parsed.matchId == null) {
      const { where: latestWhere } = classifyQueryFields(gameScore.shape, parsed)
      const latestWhereClause = buildWhereClause(latestWhere)

      const latestGame = await sql`
        SELECT
          g.match_id,
          g.game_creation,
          g.champion_played,
          g.champion_fighting,
          g.role,
          g.kda,
          g.is_win
        FROM games g
        JOIN users u ON g.puuid = u.puuid
        WHERE ${latestWhereClause}
        ORDER BY g.game_creation DESC
      `

      if (latestGame.length === 0) {
        res.status(404).send("No matching game found")
        return
      }
      parsed.matchId = latestGame[0].match_id
    }

    // Same fix as /get/game: re-classify after matchId is set so it's
    // actually part of the WHERE clause used below.
    const { where, values } = classifyQueryFields(gameScore.shape, parsed)

    if (Object.keys(values).length === 0) {
      res.status(400).send("At least one of pushing, laning, or teamFighting must be supplied")
      return
    }

    const whereClause = buildWhereClause(where)
    const valueClause = buildValueClause(values)

    const query = await sql`
    UPDATE games
    SET ${valueClause}
    FROM users
    WHERE games.puuid=users.puuid and ${whereClause}
  `

    // Previously this always sent `true`, even if nothing matched.
    if (query.count === 0) {
      res.status(404).send("No matching game found to update")
      return
    }

    res.send(true)
  } catch (e) {
    console.error(e)
    res.status(500).send("Unexpected server error")
  }
})

export default router