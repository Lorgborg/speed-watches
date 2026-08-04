import { Router } from "express"
const router = Router()
import z from "zod"
import { getQueries } from "../../util/inputValidation"
import { buildWhereClause, classifyQueryFields } from "../../util/querryClassifier"
import { sql } from "../../util/services"

const gameQuerySchema = z.object({
    puuid: z.string().optional().describe("where:users.puuid"),
    discordId: z.string().describe("where"),
    matchId: z.string().optional().describe("where"),
    championFighting: z.string().optional().describe("where"),
    championPlayed: z.string().optional().describe("where")
})

// extremely slow to get so make sure to limit calls to small amounts of data
router.get("/get/gameInfo", async(req, res) => {
    const parsed = getQueries(req.query, gameQuerySchema)
    const { where } = classifyQueryFields(gameQuerySchema.shape, parsed)
    const whereClause = buildWhereClause(where)
    
    const query = sql`
        select username, puuid, match_id, champion_played, champion_fighting, role, kda, is_win, game_length, champ_composition, info
        join users on games.puuid=users.puuid
        where ${whereClause}
    `
    
    return(query)
})

export default router