import postgres from 'postgres';
import Participant from "./types/participant.ts";
import riotApi from "./riot/riot.ts"
import "dotenv/config"
import getOpponent from "./core/getOpponent.ts";
import getPlaying from './core/getPlaying.ts';
import { callRiot } from './riot/riotQueue.ts';
import { MAIN_TOKEN_INDEX, pickWorkerTokenIndex } from './riot/riotTokens.ts';
import { resolvePuuidForToken } from './riot/resolvePuuidForTokens.ts';
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
      // currently using the main api key to prevent encrypted puuid from cock blocking
      const game = await callRiot(MAIN_TOKEN_INDEX, riotApi.prototype.matchIdToMatches, gameId);
      const info = game.info
      const participants: Participant[] = game.info.participants
      const participant = getPlaying(participants, user.puuid)

      if(participant == null) {
        continue;
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
      } catch(e: unknown) {
        const err = e as { code?: string; message?: string }
        console.log("Error code:", err.code, "Error:", err.message);
        if (err.code === '23505') {
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

