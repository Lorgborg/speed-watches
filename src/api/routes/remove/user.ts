// api/routes/remove/user.ts
import { Router } from "express"
import { sql } from "../../../config/services.ts"
const router = Router()
import z from "zod"
import { getQueries } from "../../query/inputValidation.ts"

const userQuery = z.object({
  discordId: z.string().optional(),
  puuid: z.string().optional(),
})

router.delete('/remove/user', async (req, res) => {
  let parsed: z.infer<typeof userQuery>
  try {
    parsed = getQueries(req.query, userQuery)
  } catch (e) {
    res.status(400).send(e instanceof Error ? e.message : "Invalid query parameters")
    return
  }

  if (parsed.discordId === undefined) {
    res.status(400).send("Either puuid or discordId must be supplied to identify the user")
    return
  }

  try {
    const discordId = parsed.discordId
    if(discordId == undefined) {
      throw new Error("Must include a discord id")
    }
    const [user] = await sql`
      SELECT puuid FROM users
      WHERE ${parsed.puuid ? sql`puuid = ${parsed.puuid}` : sql`discord_id = ${discordId}`}
    `

    if (!user) {
      res.status(404).send("No matching user found")
      return
    }

    // Manual cleanup in a transaction, since we don't know whether
    // games/notes have ON DELETE CASCADE set up on their FK to users.
    await sql.begin(async (tx) => {
      await tx`DELETE FROM notes WHERE puuid = ${user.puuid}`
      await tx`DELETE FROM games WHERE puuid = ${user.puuid}`
      await tx`DELETE FROM users WHERE puuid = ${user.puuid}`
    })

    res.status(200).send(`user ${user.puuid} and associated data deleted`)
  } catch (e) {
    console.error(e)
    res.status(500).send("Unexpected server error")
  }
})

export default router