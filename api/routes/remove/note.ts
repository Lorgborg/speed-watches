import { Router } from "express"
import { sql } from "../../util/services.ts"
const router = Router()
import z from "zod"
import { getQueries } from "../../util/inputValidation.ts"
import { classifyQueryFields, buildWhereClause } from "../../util/querryClassifier.ts"

const note = z.object({

})

router.delete('/remove/note', async (req, res) => {
  const parsed = getQueries(req.query, note)
  const { where } = classifyQueryFields(note.shape, parsed)

  const whereClause = buildWhereClause(where)

  const query = `select `
})

export default router