import { Schema, model } from "mongoose"

const scoreSchema = new Schema({
    laning:       { type: Number, required: false, default: undefined },
    teamFighting: { type: Number, required: false, default: undefined },
    push:         { type: Number, required: false, default: undefined }
}, { _id: false })

export const gameSchema = new Schema({
    puuid: { type: String, required: true},
    matchId: { type: String, required: true},
    championPlayed: { type: String, required: true},
    championFighting: { type: String, required: true },
    laningWith: { type: String, required: false},
    role: { type: String, required: true},
    KDA: { type: String, required: true},
    performanceMetrics: { type: String, required: false },
    isWin: { type: Boolean, required: true },
    gameLength: {type: Number, required: true },
    champComposition: {type: Array<String>, required: true},
    score: { type: scoreSchema, required: false, default: undefined }
})

export const gameModel = model("game", gameSchema)