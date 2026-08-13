import { Router } from "express"
import { checkDiscordId, getQueries } from "../../query/inputValidation.ts"
import { sql } from "../../../config/services.ts"
import z from "zod"
import { onboardGames } from "../../../scripts/immigrant-scum.ts"
import { resolvePlayer, enrichSummoner } from "../../services/userService.ts"

const router = Router()

const user = z.object({
  discordId: z.string().describe("value"),
  puuid: z.string().describe("value").optional(),
  summonerName: z.string().optional(),
  username: z.string().describe("value").optional()
})

router.post('/post/user', async (req, res) => {
  try {
    let parsed;
    try {
      parsed = getQueries(req.query, user);
    } catch (e) {
      return res.status(400).send(e instanceof Error ? e.message : "Invalid query parameters");
    }

    if (!checkDiscordId(parsed.discordId)) {
      return res.status(400).send("discord id is not valid");
    }
    const discordId = parsed.discordId;

    // identity — main token, this puuid is what gets stored as canonical
    const resolved = await resolvePlayer(parsed);
    if (resolved == null) {
      return res.status(400).send("Please supply either summoner name or puuid");
    }
    const { puuid, summonerName } = resolved;

    const existing = await sql`
            SELECT puuid, discord_id FROM users
            WHERE puuid = ${puuid} OR discord_id = ${discordId}
        `;
    if (existing.some(u => u.puuid === puuid)) {
      return res.status(400).send("The user is already in the database");
    }
    if (existing.some(u => u.discord_id === discordId)) {
      return res.status(400).send("The discord id is already in the database");
    }

    // enrichment — needs its OWN token-scoped puuid, resolved (and cached)
    // via summonerName, since the main-token puuid isn't portable
    const { highestMastery, accountDetails, rank } = await enrichSummoner(summonerName)

    // Store the MAIN-token puuid (canonical identity) — accountDetails.puuid
    // is scoped to enrichTokenIndex and would not match future lookups.
    const save = await sql`
            INSERT INTO users
            (username, summoner_name, discord_id, puuid, account_details, rank, top_mastery, backfill_complete)
            VALUES
            (${resolved.username}, ${summonerName}, ${discordId}, ${puuid}, ${sql.json(accountDetails)}, ${sql.json(rank)}, ${sql.json(highestMastery)}, ${false})
        `;

    if (save.count > 0) {
      res.send(`user with info ${puuid} saved`);
      onboardGames(puuid, summonerName).catch(e => {
        console.error(`onboarding failed for ${summonerName}:`, e);
      });
    } else {
      res.status(400).send("error");
    }
  } catch(e: unknown) {
    console.log(e)
    res.status(400).send(e)
  }
})

export default router