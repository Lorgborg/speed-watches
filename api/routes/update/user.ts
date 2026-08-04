import { Router } from "express"
import { checkDiscordId, checkPuuid, getQueries } from "../../util/inputValidation"
import { riot, sql } from "../../util/services.ts"
import z from "zod"
import { callRiot } from "../../../utils/riot/riotQueue.ts"
import { idToChampion } from "../../../utils/functions/idToChampion.ts"
import { resolvePuuidForToken } from "../../../utils/riot/resolvePuuidForTokens.ts"
import { onboardGames } from "../../../immigrant-scum.ts"
import riotApi from "../../../utils/riot/riot.ts"
import { MAIN_TOKEN_INDEX, pickWorkerTokenIndex } from "../../../utils/riot/riotTokens.ts"

const router = Router()

const user = z.object({
    discordId: z.string().describe("value"),
    puuid: z.string().describe("value").optional(),
    summonerName: z.string().optional(),
    username: z.string().describe("value").optional()
})

// Identity resolution ONLY — always the main token.
async function resolvePlayer(parsed: { summonerName?: string, puuid?: string, username?: string }) {
    const { summonerName, puuid, username } = parsed;
    const parsedUsername = username ?? "none";

    if (summonerName !== undefined && puuid === undefined) {
        const resolvedPuuid = (await callRiot(MAIN_TOKEN_INDEX, riotApi.prototype.summonerNameToId, summonerName)).puuid;
        return { summonerName, puuid: resolvedPuuid, username: parsedUsername };
    } else if (puuid !== undefined && summonerName === undefined) {
        const resolvedName = (await callRiot(MAIN_TOKEN_INDEX, riotApi.prototype.idToSummoner, puuid)).summonerName;
        return { summonerName: resolvedName, puuid, username: parsedUsername };
    } else if (summonerName !== undefined && puuid !== undefined) {
        return { summonerName, puuid, username: parsedUsername };
    } else {
        return null;
    }
}

router.post('/update/user', async (req, res) => {
    console.log("posting")
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
    const enrichTokenIndex = await pickWorkerTokenIndex()
    const workerPuuid = await resolvePuuidForToken(enrichTokenIndex, summonerName)

    const [highestMastery, accountDetails, rank] = await Promise.all([
        callRiot(enrichTokenIndex, riotApi.prototype.idToHighestMastery, workerPuuid),
        callRiot(enrichTokenIndex, riotApi.prototype.idToSummoner, workerPuuid),
        callRiot(enrichTokenIndex, riotApi.prototype.idToRank, workerPuuid),
    ]);

    await Promise.all(
        highestMastery.map(async (mastery: any) => {
            mastery.championName = await idToChampion(mastery.championId);
        })
    );

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