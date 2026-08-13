import { Router } from "express"
import { sql } from "../../../config/services.ts"
import { getQueries } from "../../query/inputValidation.ts"
import { classifyQueryFields, buildWhereClause } from "../../query/queryClassifier.ts"
const router = Router()
import z from "zod"

const userQuerySchema = z.object({
  puuid: z.string().optional().describe("where"),
  discordId: z.string().optional().describe("where"),
  username: z.string().optional().describe("where")
})

router.get('/get/user', async (req, res) => {
  let parsed: z.infer<typeof userQuerySchema>
  try {
    parsed = getQueries(req.query, userQuerySchema)
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
  const { where } = classifyQueryFields(userQuerySchema.shape, parsed)
  const whereClause = buildWhereClause(where)
  const query = await sql`select * from users where ${whereClause}`
  res.send(query)
})

export default router