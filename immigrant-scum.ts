import postgres from 'postgres';
import Participant from "./utils/participant.ts";
import riotApi from "./utils/riot.ts"
import "dotenv/config"
import getOpponent from "./utils/functions/getOpponent.ts";
import getPlaying from './utils/functions/getPlaying.ts';
import { callRiot } from "./utils/riotRateLimit.ts";

const riot = new riotApi(process.env["leagueApi"])
const { postgresuri } = process.env;

if (postgresuri == undefined) {
    throw TypeError("postgres uri is undefined. Is your .env existing?");
}
const sql = postgres(postgresuri);

async function processGame(gameId: string, puuid: string): Promise<boolean> {
    const compositeId = `${gameId}-${puuid}`;

    const game = (await callRiot(() => riot.matchIdToMatches(gameId))).data;
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

async function repeat() {
    const users = await sql`SELECT * FROM users;`
    const dateLimit = Math.floor((Date.now() - 36 * 30 * 24 * 60 * 60_000) / 1000);

    for (const user of users) {
        const limit = 200
        const saved = await sql`select match_id from games where puuid=${user.puuid}`
        let offline: Array<string> = saved.map(match => match.match_id)

        if(offline.length >= limit) {
            console.log(`already saved ${limit} games for player ${user.username}`)
            break;
        }

        let matches: Array<string> = []

        for(let i = 0; i < limit; i+=100) {   
            const online = (await callRiot(() => riot.idToMatch(user.puuid,"100",0,dateLimit,i), 12)).data
            console.log(`start=${i}, got ${online.length} matches`)
            if(online.length===0) {
                console.log("stopped at " + i)
                const save = await sql`update users set backfill_complete='true' where puuid=${user.puuid}`
                break;
            }
            for(const match of online) {
                matches.push(match)
            }
        }

        const onlineSet = new Set(matches)
        const offlineSet = new Set(offline)

        const missingGames = onlineSet.difference(offlineSet)
        console.log(`${user.username} has ${missingGames.size} missing games`)

        for(const game of Array.from(missingGames)) {
            try {
                await processGame(game, user.puuid);
            } catch (e) {
                // maxRetries exhausted on a 429, or some other unrecoverable error —
                // don't let it kill the whole run; move on to the next user, and
                // whatever cursor was last saved is where this user resumes from
                console.log(`stopping ${user.username} early due to error:`, e);
            }
        }
        console.log(`_____________finished for ${user.username}`)
    }
}

repeat()