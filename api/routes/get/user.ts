import Router from "express"
import { sql } from "../../util/services.ts"
import { checkDiscordId, checkPuuid } from "../../util/inputValidation.ts"
const router = Router()

router.get('/get/user', async (req, res) => {
    const { discordId, puuid, username} = req.body ?? {}
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