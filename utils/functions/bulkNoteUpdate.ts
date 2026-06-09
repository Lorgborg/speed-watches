import { AnyBulkWriteOperation, connect, connection } from "mongoose";
import { gameModel } from "../schemas/games";
import { NoteModel } from "../schemas/notes";
import "dotenv/config"

export default async function bulkNoteUpdate() {
    try {
        if (process.env.mongoUri && connection.readyState === 0) {
            const connectionString = process.env.mongoUri.replace("?", "league?")
            await connect(connectionString)
            console.log("Connected successfully")
        }
        const documents = await gameModel.find().lean()
        console.log("Total game documents:", documents.length)

        const existingNotes = await NoteModel.find().lean()
        console.log("Total existing notes:", existingNotes.length)
        // this proccess bulk updates all the notes.

        const bulkOps: Array<AnyBulkWriteOperation<any>> = existingNotes.map(note => ({
            updateOne: {
                filter: {
                    puuid: note.puuid,
                    championFighting: note.championFighting,
                    championPlayed: note.championPlayed
                },
                update: {
                    $set: {
                        gameEntries: documents
                        .filter(doc =>
                            doc.puuid == note.puuid &&
                            doc.championFighting == note.championFighting &&
                            doc.championPlayed == note.championPlayed
                        ).map(doc => ({
                            matchId: doc.matchId,
                            isWin: doc.isWin
                        }))
                    }
                }
            }
        }));

        if (bulkOps.length > 0) {
            const result = await NoteModel.bulkWrite(bulkOps, { ordered: false })
            console.log("Notes updated:", result.modifiedCount)
        } else {
            console.log("Nothing to update")
        }

    } catch (err) {
        console.error("Migration failed:", err)
    }
}
