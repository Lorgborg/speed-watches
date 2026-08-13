import { Router } from "express"
const router = Router()
import z from "zod"
import { getQueries } from "../../query/inputValidation.ts"
import { buildWhereClause, classifyQueryFields } from "../../query/queryClassifier.ts"
import { sql } from "../../../config/services.ts"

const gameQuerySchema = z.object({
  puuid: z.string().optional().describe("where:users.puuid"),
  discordId: z.string().describe("where"),
  matchId: z.string().optional().describe("where"),
  championFighting: z.string().optional().describe("where"),
  championPlayed: z.string().optional().describe("where"),
  limit: z.string().optional().default("10").describe("limit")
})

router.get("/get/game", async (req, res) => {
  let parsed: z.infer<typeof gameQuerySchema>
  try {
    parsed = getQueries(req.query, gameQuerySchema)
  } catch (e: unknown) {
    res.status(400).send(e instanceof Error ? e.message : "Invalid query parameters")
    return
  }

  try {
    const { where } = classifyQueryFields(gameQuerySchema.shape, parsed)
    const whereClause = buildWhereClause(where)

    const query = await sql`
      select username, g.puuid, match_id, champion_played, champion_fighting, role, kda, is_win, game_length, champ_composition, laning, team_fighting, pushing
      from games as g
      join users on g.puuid=users.puuid
      where ${whereClause}
      ORDER BY g.game_creation DESC
      LIMIT ${parsed.limit}
    `
    res.json(query)
  } catch (e) {
    console.error(e)
    res.status(500).send("Unexpected server error")
  }
})

export default router