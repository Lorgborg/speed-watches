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

router.post('/update/user', async (req, res) => {
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

  // identity — main token, this puuid is the canonical one being updated to
  const resolved = await resolvePlayer(parsed);
  if (resolved == null) {
    return res.status(400).send("Please supply either summoner name or puuid");
  }
  const { puuid, summonerName } = resolved;

  // Targeted duplicate check instead of pulling the whole table
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
  // via summonerName
  const { highestMastery, accountDetails, rank } = await enrichSummoner(summonerName)

  // Write the MAIN-token puuid, not accountDetails.puuid (which is scoped
  // to enrichTokenIndex and would break future lookups against this row).
  const save = await sql`
    UPDATE users
    SET
        puuid = ${puuid},
        account_details = ${sql.json(accountDetails)},
        rank = ${sql.json(rank)},
        top_mastery = ${sql.json(highestMastery)}
    WHERE discord_id = ${parsed.discordId}
    `;

  if (save.count > 0) {
    res.send(`user with info ${puuid} saved`);
    onboardGames(puuid, summonerName).catch(e => {
      console.error(`onboarding failed for ${summonerName}:`, e);
    });
  } else {
    res.status(400).send("error");
  }
})

export default router