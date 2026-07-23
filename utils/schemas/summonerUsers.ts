import { Schema, model } from "mongoose"

export const summonerUserSchema = new Schema({
    puuid: { type: String, required: true},
    user: { type: String, required: true},
    discordId: { type: String, required: false }
});

export const summonerUserModel = model("summonerUser", summonerUserSchema)