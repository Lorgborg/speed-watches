import postgres from 'postgres';
import Participant from "./utils/participant.ts";
import riotApi from "./utils/riot.ts"
import "dotenv/config"
import getOpponent from "./utils/functions/getOpponent.ts";
import getPlaying from './utils/functions/getPlaying.ts';
import { callRiot } from "./utils/riotQueue.ts";

const riot = new riotApi(process.env["aggregatorApi"])
const { postgresuri } = process.env;

if (postgresuri == undefined) {
    throw TypeError("postgres uri is undefined. Is your .env existing?");
}
const sql = postgres(postgresuri);

async function processGame(gameId: string, puuid: string): Promise<boolean> {
    const compositeId = `${gameId}-${puuid}`;

    const game = await callRiot(riotApi.prototype.matchIdToMatches, gameId);
    const info = game.info;
    const participants: Participant[] = game.info.participants;
    const participant = getPlaying(participants, puuid);

    if (participant == null) {
        return false;
    }

    const kda = `${participant.kills}/${participant.deaths}/${participant.assists}`;
    const save = sql`
        INSERT INTO GAMES (
            id, puuid, match_id, champion_played, champion_fighting,
            role, kda, is_win, game_length, champ_composition, info
        )
        values (
            ${compositeId}, ${puuid}, ${gameId}, ${participant.championName},
            ${getOpponent(participants, puuid)}, ${participant.teamPosition},
            ${kda}, ${participant.win}, ${participant.timePlayed},
            ${sql.json(participants.map(({ championName, teamPosition }) => ({ championName, teamPosition })))},
            ${sql.json(info)}
        )
        returning *
    `;

    try {
        await save.execute();
        console.log(`${puuid} for ${new Date(info.gameCreation).toLocaleDateString()} matchId of ${gameId}`);
    } catch (e: any) {
        if (e?.code === '23505') { 
            console.log(`Game ${compositeId} already exists, skipping.`);
            console.log(e)
            return true;
        }
        console.log("Error code:", e?.code, "Error:", e?.message);
    }

    return false;
}

export async function onboardGames(puuid: string, summonerName: string) {
    console.log(`onboarding for ${summonerName}`);
    const searchPuuid = (await callRiot(riotApi.prototype.summonerNameToId, summonerName)).puuid
    // Fetch the user row, including the current cursor
    const user = (await sql`
        SELECT * FROM users WHERE puuid = ${puuid}
    `)[0];

    if (!user) {
        console.log(`User ${puuid} not found`);
        return;
    }

    // If already complete, skip
    if (user.backfill_complete === true) {
        console.log(`User ${user.username} already fully backfilled`);
        return;
    }

    const limit = 1000;
    // Start from the saved cursor, default to 0
    let currentOffset = user.back_fillcursor ?? 0;

    // Remove the invalid filter on games.backfill_complete
    const saved = await sql`SELECT match_id FROM games WHERE puuid = ${puuid}`;
    const offline = saved.map(match => match.match_id);
    const offlineSet = new Set(offline);

    // Loop until we hit the hard limit or there are no more matches
    for (let i = currentOffset; i < limit; i += 100) {
        let online: Array<string> = [];
        try {
            online = await callRiot(riotApi.prototype.idToMatch, searchPuuid, "100", 0, 0, i);
        } catch (e: any) {
            console.log(`[FATAL PAGE FETCH] user=${user.username} offset=${i}:`, e?.response?.status, e?.message);
            // Do NOT update cursor here – next run will retry from the same offset
            break;
        }

        console.log(`start=${i}, got ${online.length} matches`);

        if (online.length === 0) {
            // No more matches → mark user as fully backfilled
            await sql`
                UPDATE users
                SET backfill_complete = true, back_fillcursor = ${i}
                WHERE puuid = ${user.puuid}
            `;
            console.log(`Backfill complete for ${user.username}`);
            break;
        }

        const onlineSet = new Set(online);
        const missingGames = onlineSet.difference(offlineSet);
        console.log(`${user.username} has ${missingGames.size} missing games in this batch`);

        // Process all missing games for this batch
        for (const game of Array.from(missingGames)) {
            try {
                await processGame(game, user.puuid);
            } catch (e) {
                // log and continue – processGame already has its own error handling
                console.log(`Error processing game ${game} for ${user.username}:`, e);
            }
        }

        // ✅ CRITICAL: update the cursor AFTER the whole batch is processed
        await sql`
            UPDATE users
            SET back_fillcursor = ${i + 100}
            WHERE puuid = ${user.puuid}
        `;

        // If we hit the arbitrary limit, stop here; next run picks up at i+100
        if (i + 100 >= limit) {
            console.log(`Reached limit of ${limit} games for ${user.username}`);
            break;
        }
    }
    console.log(`_____________finished for ${user.username}`);
}