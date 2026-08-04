import { Router } from "express"
import { checkDiscordId, checkPuuid, getQueries } from "../../util/inputValidation"
import { riot, sql } from "../../util/services.ts"
import z from "zod"
import { callRiot } from "../../../utils/riotQueue.ts"
import { idToChampion } from "../../../utils/functions/idToChampion.ts"
import { onboardGames } from "../../../immigrant-scum.ts"
import riotApi from "../../../utils/riot.ts"

const router = Router()

const user = z.object({
    discordId: z.string().describe("value"),
    puuid: z.string().describe("value").optional(),
    summonerName: z.string().optional(),
    username: z.string().describe("value").optional()
})

async function resolvePlayer(parsed: { summonerName?: string, puuid?: string, username?: string }) {
    const { summonerName, puuid, username } = parsed;
    const parsedUsername = username ?? "none";

    if (summonerName !== undefined && puuid === undefined) {
        const resolvedPuuid = (await callRiot(riotApi.prototype.summonerNameToId, summonerName)).puuid;
        return { summonerName, puuid: resolvedPuuid, username: parsedUsername };
    } else if (puuid !== undefined && summonerName === undefined) {
        const resolvedName = (await callRiot(riotApi.prototype.idToSummonerName, puuid)).summonerName;
        return { summonerName: resolvedName, puuid, username: parsedUsername };
    } else if (summonerName !== undefined && puuid !== undefined) {
        return { summonerName, puuid, username: parsedUsername };
    } else {
        return null;
    }
}

router.post('/post/user', async (req, res) => {
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

    const resolved = await resolvePlayer(parsed);
    if (resolved == null) {
        return res.status(400).send("Please supply either summoner name or puuid");
    }
    const { puuid } = resolved;

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

    // Fire all three independent Riot calls concurrently
    const [highestMastery, accountDetails, rank] = await Promise.all([
        callRiot(riotApi.prototype.idToHighestMastery, puuid),
        callRiot(riotApi.prototype.idToSummoner, puuid),
        callRiot(riotApi.prototype.idToRank, puuid),
    ]);

    await Promise.all(
        // to lazy to type
        highestMastery.map(async (mastery: any) => {
            mastery.championName = await idToChampion(mastery.championId);
        })
    );

    const save = await sql`
        INSERT INTO users
        (username, summoner_name, discord_id, puuid, account_details, rank, top_mastery, backfill_complete)
        VALUES
        (${resolved.username}, ${resolved.summonerName}, ${discordId}, ${accountDetails.puuid}, ${sql.json(accountDetails)}, ${sql.json(rank)}, ${sql.json(highestMastery)}, ${false})
    `;

    if (save.count > 0) {
        res.send(`user with info ${accountDetails.puuid} saved`);
        onboardGames(puuid, resolved.summonerName).catch(e => {
            console.error(`onboarding failed for ${resolved.summonerName}:`, e);
        });
    } else {
        res.status(400).send("error");
    }
})

export default router