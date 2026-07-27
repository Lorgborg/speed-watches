import Router from "express"
import { sql } from "../../util/services.ts"
import { checkDiscordId, checkPuuid, getQueries } from "../../util/inputValidation.ts"
const router = Router()
import z from "zod"

const userSchema = z.object({
    puuid: z.string().optional(),
    discordId: z.string().optional(),
    username: z.string().optional()
})

router.get('/get/user', async (req, res) => {
    console.log("calling get/user")
    const { discordId, puuid, username} = getQueries(req.query, userSchema)
    let querryValue; 
    if(username) {
        querryValue = await sql`select * from users where username=${username}`
        console.log("getting through username")
    } else if (puuid) {
        if (await checkPuuid(puuid)) {
            res.status(401).send("Error: puuid is not a valid id")
        }
        querryValue = await sql`select * from users where puuid=${puuid}`
    } else if (discordId) {
        if(checkDiscordId(discordId)) {
            res.status(401).send("Error: Discord Id is not a valid format")
        }
        querryValue = await sql`select * from users where discordId=${discordId}`
    }

    res.send(querryValue)
})

export default router