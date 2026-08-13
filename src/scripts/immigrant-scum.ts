import postgres from 'postgres';
import Participant from "../types/participant.ts";
import riotApi from "../riot/riot.ts"
import "dotenv/config"
import getOpponent from "../core/getOpponent.ts";
import getPlaying from '../core/getPlaying.ts';
import { callRiot } from "../riot/riotQueue.ts";
import { getRiotTokens, pickWorkerTokenIndex } from "../riot/riotTokens.ts";
import { resolvePuuidForToken } from '../riot/resolvePuuidForTokens.ts';

const { postgresuri } = process.env;

if (postgresuri == undefined) {
  throw TypeError("postgres uri is undefined. Is your .env existing?");
}
const sql = postgres(postgresuri);

async function processGame(gameId: string, puuid: string, tokenIndex: number, searchPuuid: string): Promise<boolean> {
  const compositeId = `${gameId}-${puuid}`;

  const game = await callRiot(tokenIndex, riotApi.prototype.matchIdToMatches, gameId);
  const info = game.info;
  const participants: Participant[] = game.info.participants;
  const participant = getPlaying(participants, searchPuuid);

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
            ${getOpponent(participants, searchPuuid)}, ${participant.teamPosition},
            ${kda}, ${participant.win}, ${participant.timePlayed},
            ${sql.json(participants.map(({ championName, teamPosition }) => ({ championName, teamPosition })))},
            ${sql.json(info)}
        )
        returning *
    `;

  try {
    await save.execute();
    console.log(`[worker-${tokenIndex}] ${puuid} for ${new Date(info.gameCreation).toLocaleDateString()} matchId of ${gameId}`);
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string }
    if (err.code === '23505') {
      console.log(`Game ${compositeId} already exists, skipping.`);
      return true;
    }
    console.log("Error code:", err.code, "Error:", err.message);
  }

  return false;
}

export async function onboardGames(puuid: string, summonerName: string) {
  console.log(`onboarding for ${summonerName}`);

  const workerCount = getRiotTokens().length - 1 // exclude leagueApi1
  if (workerCount <= 0) {
    throw new Error("onboardGames requires at least one worker token (leagueApi2+)")
  }

  const user = (await sql`
        SELECT * FROM users WHERE puuid = ${puuid}
    `)[0];

  if (!user) {
    console.log(`User ${puuid} not found`);
    return;
  }

  if (user.backfill_complete === true) {
    console.log(`User ${user.username} already fully backfilled`);
    return;
  }

  const limit = 1000;
  const currentOffset = user.backfill_cursor ?? 0;

  const saved = await sql`SELECT match_id FROM games WHERE puuid = ${puuid}`;
  const offline = saved.map(match => match.match_id);
  const offlineSet = new Set(offline);

  for (let i = currentOffset; i < limit; i += 100) {
    // Fresh worker token PER PAGE for the listing call, so a long backfill
    // isn't pinned to a single token for its whole lifetime.
    const listTokenIndex = await pickWorkerTokenIndex()
    const listSearchPuuid = await resolvePuuidForToken(listTokenIndex, summonerName)

    let online: Array<string>;
    const now = Math.floor(Date.now() / 1000)
    try {
      online = await callRiot(listTokenIndex, riotApi.prototype.idToMatch, listSearchPuuid, "100", now, 0, i);
    } catch (e: unknown) {
      const err = e as { response?: { status?: number }; message?: string }
      console.log(`[FATAL PAGE FETCH] user=${user.username} offset=${i}:`, err.response?.status, err.message);
      break;
    }

    console.log(`start=${i}, got ${online.length} matches`);

    if (online.length === 0) {
      await sql`
                UPDATE users
                SET backfill_complete = true, backfill_cursor = ${i}
                WHERE puuid = ${user.puuid}
            `;
      console.log(`Backfill complete for ${user.username}`);
      break;
    }

    const onlineSet = new Set(online);
    const missingGames = Array.from(onlineSet.difference(offlineSet));
    console.log(`${user.username} has ${missingGames.length} missing games in this batch`);

    // matchIdToMatches doesn't require the SAME token as the listing call,
    // so games can be spread across all worker tokens and fired concurrently.
    // BUT: participant puuids inside a match are also token-scoped, so each
    // token needs its own resolved searchPuuid — can't reuse listSearchPuuid
    // across tokens.
    await Promise.all(
      missingGames.map(async (gameId, idx) => {
        const gameTokenIndex = 1 + (idx % workerCount) // round-robin over leagueApi2..N
        try {
          const gameSearchPuuid = gameTokenIndex === listTokenIndex
            ? listSearchPuuid
            : await resolvePuuidForToken(gameTokenIndex, summonerName)

          await processGame(gameId, user.puuid, gameTokenIndex, gameSearchPuuid)
        } catch (e) {
          console.log(`Error processing game ${gameId} for ${user.username}:`, e);
        }
      })
    );

    await sql`
            UPDATE users
            SET backfill_cursor = ${i + 100}
            WHERE puuid = ${user.puuid}
        `;

    if (i + 100 >= limit) {
      console.log(`Reached limit of ${limit} games for ${user.username}`);
      break;
    }
  }
  console.log(`_____________finished for ${user.username}`);
}
