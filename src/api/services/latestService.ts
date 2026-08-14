import { classifyQueryFields, buildWhereClause } from "../query/queryClassifier"
import { sql } from "../../config/services"
import z from "zod"

type SqlValue =
  | null
  | boolean
  | number
  | string
  | Date
  | Uint8Array
  | readonly SqlValue[]

export async function latestService(
  shape: Record<string, z.ZodTypeAny>,
  parsed: Record<string, SqlValue | undefined>
) {
  if(parsed.championFighting !== undefined && parsed.championPlayed !== undefined) {
    const { where: latestWhere } = classifyQueryFields(shape, parsed)
    const latestWhereClause = buildWhereClause(latestWhere)
    const latestGame = await sql`
      SELECT
        g.match_id,
        g.game_creation,
        g.champion_played,
        g.champion_fighting,
        g.role,
        g.kda,
        g.is_win
      FROM games g
      JOIN users u ON g.puuid = u.puuid
      WHERE ${latestWhereClause}
      ORDER BY g.game_creation DESC
      LIMIT 1;
    `
    parsed.championFighting = latestGame[0].champion_fighting
    parsed.championPlayed = latestGame[0].champion_played
    return {
      championFighting: latestGame[0].champion_fighting,
      championPlayed: latestGame[0].champion_played,
      matchId: latestGame[0].match_id
    }
  }
}