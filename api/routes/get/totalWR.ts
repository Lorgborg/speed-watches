import { Router } from "express"
const router = Router()
import { sql } from "../../util/services"
import { getQueries } from "../../util/inputValidation"
import { classifyQueryFields, buildWhereClause } from "../../util/querryClassifier"

import { z } from "zod"

const strictBoolean = z
  .enum(["true", "false"])
  .transform((v) => v === "true")
  .optional()

const MatchUpWRQuerySchema = z.object({
  championPlayed: z.string().optional().describe("where"),
  puuid: z.string().optional().describe("where:games.puuid"),
  championFighting: z.string().optional().describe("where"),
  role: z.string().optional().describe("where"),
  isWinFirst: strictBoolean,
  discordId: z.string().optional().describe("where:users.discord_id"),
})

router.get("/get/totalWR", async (req, res) => {
  try {
    const parsed = getQueries(req.query, MatchUpWRQuerySchema)
    const { puuid, discordId, isWinFirst } = parsed

    if (puuid === undefined && discordId === undefined) {
      res.status(400).send("either puuid or discordId must be filled")
      return
    }

    const { where } = classifyQueryFields(MatchUpWRQuerySchema.shape, parsed)
    const whereClause = buildWhereClause(where)

    const orderColumn = isWinFirst ? sql`wins` : sql`loss`

    const querry = await sql`
      select champion_played, champion_fighting, role,
        COUNT(*) FILTER (WHERE is_win = true) AS wins,
        COUNT(*) FILTER (WHERE is_win = false) AS loss
      from games
      join users on games.puuid = users.puuid
      where ${whereClause}
      group by champion_fighting, champion_played, role
      order by ${orderColumn} desc;
    `

    let totalWins: number = 0
    let totalLoss: number = 0
    let withWinRate = querry.map((item) => {
      const wins = parseFloat(item.wins)
      const loses = parseFloat(item.loss)
      totalWins += wins
      totalLoss += loses
      const winRate = wins / (wins + loses)
      return { ...item, winRate }
    })
    const wr = Math.round((totalWins / (totalWins + totalLoss)) * 100)

    res.send({ withWinRate, wr, totalWins, totalLoss })
  } catch (e: any) {
      if (e instanceof z.ZodError) {
        const messages = e.issues.map((issue) => `Error: ${issue.message}`)
        res.status(400).send(messages)
      } else {
        res.status(500).send(e)
      }
  }
})

export default router