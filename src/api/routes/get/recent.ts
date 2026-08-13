import { Router } from "express"
const router = Router()

import { sql } from "../../../config/services.ts"
import { getQueries } from "../../query/inputValidation.ts"
import { classifyQueryFields, buildWhereClause } from "../../query/queryClassifier.ts"
import { z } from "zod"

const recentQuery = z.object({
  championPlayed: z.string().optional().describe("where"),
  championFighting: z.string().optional().describe("where"),
  discordId: z.string().optional().describe("where:u.discord_id"),
  limit: z.string().optional().default("1").describe("limit")
})

router.get('/get/recent', async (req, res) => {
  let parsed: z.infer<typeof recentQuery>
  try {
    parsed = getQueries(req.query, recentQuery)
  } catch (e: unknown) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        issues: e.issues.map(i => ({ path: i.path.join('.'), message: i.message }))
      })
    }
    console.error('Query parsing failed:', e)
    return res.status(500).json({ error: 'Unexpected query parsing error' })
  }

  const { where } = classifyQueryFields(recentQuery.shape, parsed)
  const whereClause = buildWhereClause(where)

  const query = await sql`
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
  WHERE ${whereClause}
  GROUP BY u.discord_id, u.summoner_name, g.match_id, g.game_creation,
    g.champion_played, g.role, g.kda, g.is_win, g.champion_fighting
  ORDER BY g.game_creation DESC
  LIMIT ${parsed.limit};
  `
  res.json(query)
})

export default router