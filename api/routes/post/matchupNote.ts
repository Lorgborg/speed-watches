import { Router } from "express"
import { sql, riot } from "../../util/services.ts"
const router = Router()
import z from "zod"
import { getQueries } from "../../util/inputValidation.ts"


const noteModel = z.object({
    matchId: z.string().optional(),
    championPlayed: z.string().optional(),
    champiionFighting: z.string().optional(),
    puuid: z.string().optional(),
    note: z.string(),

})

router.get('post/matchupNote', async (req, res) => {
    const { matchId, puuid, note, champiionFighting, championPlayed } = getQueries(req.query, noteModel)
    const conditions = []

    if(matchId !== undefined) conditions.push(sql`matchIds=${matchId}`)

    const whereClause = conditions.reduce((acc, cur) => sql`${acc} AND ${cur}`)
    sql`update notes set notes=array_append(${note}) where=${whereClause}`
})

export default router