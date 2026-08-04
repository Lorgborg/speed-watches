import postgres from 'postgres';
import Participant from "./utils/participant.ts";
import riotApi from "./utils/riot/riot.ts"
import "dotenv/config"
import getOpponent from "./utils/functions/getOpponent.ts";
import getPlaying from './utils/functions/getPlaying.ts';
import { callRiot } from './utils/riot/riotQueue.ts';
import { MAIN_TOKEN_INDEX, pickWorkerTokenIndex } from './utils/riot/riotTokens.ts';
import { resolvePuuidForToken } from './utils/riot/resolvePuuidForTokens.ts';
const riot = new riotApi(process.env["leagueApi"])
const { postgresuri } = process.env;

// throw error if postgres is undefined
if(postgresuri == undefined){
    throw TypeError("postgres uri is undefined. Is your .env existing?");   
}
const sql = postgres(postgresuri);

console.log("starting game updates...")

async function check() {
    // gets all users within database
    const users = await sql`
    SELECT * FROM users;
    `
    // gets the epoch time for 5 minutes ago and logs time point
    const minutesAgo = new Date().getTime() - 5 * 60000
    const epochTime = Math.floor(new Date(minutesAgo).getTime()/1000);
    console.log(`looking for data since ${new Date(epochTime*1000).toLocaleString()}`);

    // searches for games played for each user within last 5 minutes
    for(const user of users) {
        // checks games played within the last 5 minutes
        const listTokenIndex = await pickWorkerTokenIndex()
        const resolvedPuuid = await resolvePuuidForToken(listTokenIndex, user.summoner_name)
        const gamesPlayed = await callRiot(listTokenIndex, riotApi.prototype.idToMatch, resolvedPuuid, "5", 0, epochTime, 0) // beyonce, 5, 29 days: array
        for(const gameId of gamesPlayed) {
            const game = (await riot.matchIdToMatches(gameId)).data;
            const info = game.info
            const participants: Participant[] = game.info.participants
            const participant = getPlaying(participants, user.puuid)

            if(participant == null) {
                break;
            }

            const compositeId = `${gameId}-${user.puuid}`;
            const kda = `${participant.kills}/${participant.deaths}/${participant.assists}`;
            const save = sql`
                    INSERT INTO GAMES (
                        id, puuid, match_id, champion_played, champion_fighting,
                        role, kda, is_win, game_length, champ_composition, info
                    )
                    values (
                        ${compositeId}, ${user.puuid}, ${gameId}, ${participant.championName},
                        ${getOpponent(participants, user.puuid)}, ${participant.teamPosition},
                        ${kda}, ${participant.win}, ${participant.timePlayed},
                        ${sql.json(participants.map(({ championName, teamPosition }) => ({ championName, teamPosition })))},
                        ${sql.json(info)}
                    )
                    returning *
                `;
            try {
                await save.execute()
            } catch(e: any) {
                console.log("Error code:", e?.code, "Error:", e?.message);
                if (e?.code === '23505') {
                    console.log(`Game ${compositeId} already exists, skipping.`);
                    continue;
                }
            }
            console.log(`succesfully save`)
        }
    }
}

check()

setInterval(check, 5 * 60 * 1000) // runs 5 minutes
