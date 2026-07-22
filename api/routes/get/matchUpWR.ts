import { Router } from "express"
const router = Router()
import { sql } from "../../util/services"

router.get("get/matchUpWR", async(req, res) => {
    const { championPlayed, puuid } = req.body()
    const querry = await sql`select champion_played, champion_fighting, role, COUNT(*) FILTER (WHERE is_win = true) AS wins, COUNT(*) FILTER (WHERE is_win = false) AS lose from games join users on games.puuid=users.puuid where puuid=${puuid} and champion_played='${championPlayed}' group by champion_fighting, champion_played, role order by wins desc;`
    res.send(querry)
})

export default router