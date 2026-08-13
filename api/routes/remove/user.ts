import { Router } from "express"
import { sql } from "../../util/services.ts"
const router = Router()
import z from "zod"
import { getQueries } from "../../util/inputValidation.ts"
import { classifyQueryFields, buildWhereClause } from "../../util/querryClassifier.ts"

const user = z.object({

})

router.delete('/remove/user', async (req, res) => {
  const parsed = getQueries(req.query, user)
  const { where } = classifyQueryFields(user.shape, parsed)
  const whereClause = buildWhereClause(where)
})

export default router