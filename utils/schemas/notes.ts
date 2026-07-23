import { Schema, model } from "mongoose"

export const NoteSchema = new Schema({
    puuid: { type: String, required: true} ,
    championFighting: { type: String, required: true},
    championPlayed: { type: String, required: true },
    gameEntries : [
        {
            matchId: { type: String, required: false },
            isWin: { type: Boolean, required: false },
        }
    ]
})

export const NoteModel = model("Note", NoteSchema);