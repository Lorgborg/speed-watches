import { Router } from "express"
import { sql } from "../../util/services.ts"
const router = Router()
import z from "zod"
import { getQueries } from "../../util/inputValidation.ts"
import { classifyQueryFields, buildWhereClause } from "../../util/querryClassifier.ts"

const gameNote = z.object({
  discordId: z.string().optional().describe("where"),
  puuid: z.string().optional().describe("where"),
  notes: z.preprocess(
    (val) => {
      // If it's a string, wrap it in an array
      if (typeof val === 'string') return [val];
      // If it's already an array, return as is
      if (Array.isArray(val)) return val;
      // If undefined or missing, return an empty array (or undefined)
      return [];
    },
    z.array(z.string())
  ).describe("value"),
  championFighting: z.string().describe("where"),
  championPlayed: z.string().describe("where")
})

router.post('/post/matchupNote', async (req, res) => {
  const parsed = getQueries(req.query, gameNote)
  const { where, values } = classifyQueryFields(gameNote.shape, parsed)

  const whereClause = buildWhereClause(where)
  const query = await sql`
      UPDATE notes
      SET notes = notes || ${values.notes}
      FROM users
      WHERE ${whereClause}
  `

  console.log(query)
  res.status(200).send("note updated")
})

export default router