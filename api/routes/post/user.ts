import { Router } from "express"
import { checkDiscordId, checkPuuid } from "../../util/inputValidation"
import { riot, sql } from "../../util/services.ts"
const router = Router()

router.post('/post/user', async (req, res) => {
    let finalPuuid
    try {
        const { username, discordId, puuid, summonerName } = req.body
        if(checkDiscordId(discordId)) {
            res.status(401).send("Error: Discord Id is not a valid format")
        } else if (await checkPuuid(puuid) && !summonerName) {
            res.status(401).send("Error: puuid is not a valid id")
        }
        if(summonerName){
            finalPuuid = (await riot.summonerNameToId(summonerName)).data.puuid
        } else {
            finalPuuid = puuid
        }
        const save = await sql`
        insert into users (username, discordId, puuid) values (${username}, ${discordId}, ${finalPuuid})
        `
        res.send("successfully saved")
    } catch (e: any) {
        console.log(e)
        switch(e.code){
            case "UNDEFINED_VALUE": {
                res.status(401).send("Error: Value is undefined, check if values username, discordId and puuid is filled")
                break;
            }
            default: {
                res.status(401).send("Error: " + e)
            }
        }
        
    }
})

export default router