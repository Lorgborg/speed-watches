// api/routes/remove/matchupNote.ts
import { Router } from "express"
import { sql } from "../../../config/services.ts"
const router = Router()
import z from "zod"
import { getQueries } from "../../query/inputValidation.ts"
import { classifyQueryFields, buildWhereClause } from "../../query/queryClassifier.ts"

const gameNote = z.object({
  discordId: z.string().optional().describe("where:users.discord_id"),
  puuid: z.string().optional().describe("where:notes.puuid"),
  championFighting: z.string().describe("where:notes.champion_fighting").optional(),
  championPlayed: z.string().describe("where:notes.champion_played").optional(),
  index: z.preprocess(
    (val) => Number(val),
    z.number().refine((n) => !isNaN(n))
  )
})

router.delete('/remove/matchupNote', async (req, res) => {
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
    const { where } = classifyQueryFields(gameNote.shape, parsed)
    const whereClause = buildWhereClause(where)

    // Rebuilds the notes array with any string matching an entry in
    // `values.notes` filtered out, instead of appending. `<> ALL(...)`
    // on an empty array is vacuously true, so passing no notes is a
    // safe no-op rather than deleting everything.
    const query = await sql`
      UPDATE notes
      SET notes = 
        notes[1:${parsed.index - 1}] || 
        notes[${parsed.index + 1}:array_length(notes, 1)]
      from users
      where users.puuid=notes.puuid and ${whereClause}
    `

    if (query.count === 0) {
      res.status(404).send("No matching matchup note found")
      return
    }

    res.status(200).send("note removed")
  } catch (e) {
    console.error(e)
    res.status(500).send("Unexpected server error")
  }
})

export default router