import { Router } from "express"
import { sql, riot } from "../../util/services.ts"
const router = Router()

router.get('post/matchupNote', async (req, res) => {
    const { matchId, puuid, note } = req.body
    sql`update notes set notes=array_append(${note})`
})

export default router