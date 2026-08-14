import { Router } from "express"
import { sql } from "../../../config/services.ts"
const router = Router()
import z from "zod"
import { getQueries } from "../../query/inputValidation.ts"
import { classifyQueryFields, buildWhereClause } from "../../query/queryClassifier.ts"
import { latestService } from "../../services/latestService.ts"

const gameNote = z.object({
  discordId: z.string().optional().describe("where:users.discord_id"),
  puuid: z.string().optional().describe("where:notes.puuid"),
  notes: z.preprocess(
    (val) => {
      if (typeof val === 'string') return [val]
      if (Array.isArray(val)) return val
      return []
    },
    z.array(z.string())
  ).describe("value"),
  championFighting: z.string().describe("where:notes.champion_fighting").optional(),
  championPlayed: z.string().describe("where:notes.champion_played").optional()
})

router.post('/post/matchupNote', async (req, res) => {
  let parsed: z.infer<typeof gameNote>
  try {
    parsed = getQueries(req.query, gameNote)
  } catch (e) {
    res.status(400).send(e instanceof Error ? e.message : "Invalid query parameters")
    return
  }

  if (parsed.discordId === undefined && parsed.puuid === undefined) {
    res.status(400).send("Either puuid or discordId must be supplied to identify the user")
    return
  }

  try {
    await latestService(gameNote.shape, parsed)
    const { where, values } = classifyQueryFields(gameNote.shape, parsed)
    if(parsed.championFighting === undefined || parsed.championPlayed === undefined) {
      res.status(404).send("Hey notes will affect multiple rows")
    }
    const whereClause = buildWhereClause(where)

    const query = await sql`
      UPDATE notes
      SET notes = notes || ${values.notes}
      FROM users
      WHERE notes.puuid = users.puuid AND ${whereClause}
    `

    if (query.count === 0) {
      res.status(404).send("No matching matchup note found")
      return
    }

    res.status(200).send("note updated")
  } catch (e) {
    console.error(e)
    res.status(500).send("Unexpected server error")
  }
})

export default router