// api/routes/remove/note.ts
import { Router } from "express"
import { sql } from "../../util/services.ts"
const router = Router()
import z from "zod"
import { getQueries } from "../../util/inputValidation.ts"
import { classifyQueryFields, buildWhereClause } from "../../util/querryClassifier.ts"

const noteQuery = z.object({
  discordId: z.string().optional().describe("where:users.discord_id"),
  puuid: z.string().optional().describe("where:notes.puuid"),
  championFighting: z.string().describe("where:notes.champion_fighting"),
  championPlayed: z.string().describe("where:notes.champion_played"),
  role: z.string().optional().describe("where:notes.role")
})

router.delete('/remove/note', async (req, res) => {
  let parsed: z.infer<typeof noteQuery>
  try {
    parsed = getQueries(req.query, noteQuery)
  } catch (e) {
    res.status(400).send(e instanceof Error ? e.message : "Invalid query parameters")
    return
  }

  if (parsed.discordId === undefined && parsed.puuid === undefined) {
    res.status(400).send("Either puuid or discordId must be supplied to identify the user")
    return
  }

  try {
    const { where } = classifyQueryFields(noteQuery.shape, parsed)
    const whereClause = buildWhereClause(where)

    const query = await sql`
      DELETE FROM notes
      USING users
      WHERE notes.puuid = users.puuid AND ${whereClause}
    `

    if (query.count === 0) {
      res.status(404).send("No matching matchup note found")
      return
    }

    res.status(200).send(`${query.count} note row(s) deleted`)
  } catch (e) {
      console.error(e)
      res.status(500).send("Unexpected server error")
  }
})

export default router