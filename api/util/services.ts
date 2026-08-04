/**
 * @file Centralized service instances shared across the app.
 * Provides a single import point for the Postgres client and Riot API client,
 * so route files don't need to import each utility individually.
 *
 * @module services
 */

import "dotenv/config"
import postgres from "postgres"
const { postgresuri } = process.env
if(postgresuri == undefined){
    throw TypeError("postgres uri is undefined. Is your .env existing?");   
}
const sql = postgres(postgresuri);

import riotApi from "../../utils/riot/riot.ts";
const { leagueApi } = process.env
const riot = new riotApi(leagueApi);

export { sql, riot }