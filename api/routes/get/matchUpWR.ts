import { Router } from "express"
const router = Router()
import { sql } from "../../util/services"
import { getQueries } from "../../util/inputValidation"

import { z } from "zod"

const strictBoolean = z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional()

const MatchUpWRQuerySchema = z.object({
    championPlayed: z.string().optional(),
    puuid: z.string().optional(),
    championFighting: z.string().optional(),
    role: z.string().optional(),
    isWinFirst: strictBoolean,
    discordId: z.string().optional(),
})

router.get("/get/matchupWR", async(req, res) => {
    try {
        const { championPlayed, puuid, championFighting, role, isWinFirst, discordId } = getQueries(req.query, MatchUpWRQuerySchema)
        if(puuid == undefined && discordId == undefined) {
            res.status(404).send("either puuid or discordId must be filled")
            return
        }
        const conditions = []
        if (championPlayed !== undefined) conditions.push(sql`champion_played = ${championPlayed}`);
        if (puuid !== undefined) conditions.push(sql`games.puuid = ${puuid}`);
        if (championFighting !== undefined) conditions.push(sql`champion_fighting = ${championFighting}`);
        if (role !== undefined) conditions.push(sql`role = ${role}`);
        if (discordId !== undefined) conditions.push(sql`discordId = ${discordId}`);
        let ordered = (isWinFirst) ? sql`wins` : sql`loss`
        console.log(isWinFirst)

        const whereClause = conditions.reduce((acc, cond) => sql`${acc} AND ${cond}`)

        const querry = await sql`
            select champion_played, champion_fighting, role,
                COUNT(*) FILTER (WHERE is_win = true) AS wins,
                COUNT(*) FILTER (WHERE is_win = false) AS loss
            from games
            join users on games.puuid = users.puuid
            where ${whereClause}
            group by champion_fighting, champion_played, role
            order by ${ordered} desc;
        `
        let totalWins: number = 0;
        let totalLoss: number = 0;
        let withWinRate = querry.map((item) => {
            const wins = parseFloat(item.wins)
            const loses = parseFloat(item.loss)
            totalWins += wins;
            totalLoss += loses
            const winRate = wins / (wins + loses)
            return { ...item, winRate }
        })
        const wr = Math.round((totalWins/(totalWins+totalLoss))*100)

        res.send({withWinRate, wr, totalWins, totalLoss})
    } catch(e: any) {
        if (e instanceof z.ZodError) {
            const messages = e.issues.map((issue) => `Error: ${issue.message}`)
            // e.g. ['Invalid option: expected one of "true"|"false"']
            res.status(409).send(messages)
        } else {
            res.status(409).send(e)
        }
    }
})

export default router