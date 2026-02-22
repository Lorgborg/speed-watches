import express from "express";
import { Schema, model, connect, Document, Model, connection, disconnect, createConnection } from 'mongoose';
import Participant from "./utils/participant";
import riotApi from "./utils/riot"
const app = express()
const port = 3000
import "dotenv/config"
import getOpponent from "./utils/functions/getOpponent";
const riot = new riotApi(process.env["leagueApi"])

app.get("/speedwatches/match/current", async (req, res) => {
    const user = await riot.summonerNameToId("Karma", "haru")

    try {
        const current = await (await riot.idToCurrentMatch(user.data.puuid)).data
        res.send({ isInMatch: true, content: current })
    } catch(AxiosError) {
        console.log("not in match")
        res.send( { isInMatch: false } )
    }
})

interface summonerUser extends Document {
    puuid: string;
    user: string;
    discordId: string;
}

const summonerUserSchema = new Schema({
    puuid: { type: String, required: true},
    user: { type: String, required: true},
    discordId: {type: String, required: false}
})

// save all necessary info to save on api calls needed when querying data

const gameSchema = new Schema({
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
    champComposition: {type: Array<String>, required: true}
})

const summonerUserModel = model<summonerUser>("summonerUser", summonerUserSchema)
const gameModel = model("game", gameSchema)

app.get("/speedwatches/match/check", async (req, res) => {
    // try catch for getting games
    try {
        if(process.env["mongoUri"] == undefined){
            throw("no mongo uri, check your .env")
        }
        await connect(process.env["mongoUri"].replace("?", "league?"))
        const summoners = summonerUserModel.find()

        for await (const summoner of summoners) {
            const matches = await riot.idToMatch(summoner.puuid)
            for (const match of matches.data) {
                // checks if the game is saved in db
                const gameQuery = await gameModel.findOne({ matchId: match, puuid: summoner.puuid })
                
                // we save it if not found
                console.log(`game query is: ${gameQuery}`)
                if(gameQuery == null){
                    const matchDetails = await riot.matchIdToMatches(match)
                    const participants: Participant[] = matchDetails.data.info.participants
                    // saves to database
                    for(const participant of participants){
                        if(participant.puuid == summoner.puuid){
                            const saving = await gameModel.create({
                                puuid: summoner.puuid,
                                matchId: match,
                                championPlayed: participant.championName,
                                championFighting: getOpponent(participants, summoner.puuid),
                                laningWith: undefined,
                                role: participant.teamPosition,
                                KDA: `${participant.kills}/${participant.deaths}/${participant.assists}`,
                                performanceMetrics: undefined,
                                isWin: participant.win,
                                gameLength: participant.timePlayed,
                                champComposition: participants.map(({ championName, teamPosition }) => ({ championName, teamPosition }))
                            })
                            console.log(`saving ${saving.puuid} with`)
                        }
                    }
                }
            }
        }
        res.send("saved")
    } catch(e) {
        res.send(`error: ${e}`)
    } finally {
        disconnect()
    }


})

app.get("/speedwatches/addUser", async (req, res) => {
    if(process.env["mongoUri"] == undefined){
        throw("no mongo uri, check your .env")
    }
    try {
        await connect(process.env["mongoUri"].replace("?", "league?"))
        console.log(`req body to save ${JSON.stringify(req.query)}`)
        const { puuid, user, discordId } = req.query
        const saving = await summonerUserModel.create({
            puuid: puuid,
            user: user,
            discordId: discordId
        })
        res.send(`saved to collection ${saving.collection.name} and db ${saving.db.name} with generated id of: ${saving.id}`)
    } catch(e) {
        console.log(`error: ${e}`)
        res.send(`an error has occured: ${e}`)
    } finally {
        disconnect()
    }
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
