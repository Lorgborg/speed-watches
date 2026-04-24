// express related imports
import express from "express";
const app = express()
const port = 3000
import { connect, disconnect } from 'mongoose';

// riot related imports and .env import
import "dotenv/config"
import Participant from "./utils/participant";
import riotApi from "./utils/riot"
const riot = new riotApi(process.env["leagueApi"])

// models import
import { gameModel } from "./utils/schemas/games"
import { summonerUserModel } from "./utils/schemas/summonerUsers"

// utility functions
import bulkNoteUpdate from "./utils/functions/bulkNoteUpdate";
import getOpponent from "./utils/functions/getOpponent";
import getLeagueKey from "./utils/getLeagueKey";

// save all necessary info to save on api calls needed when querying data
app.get("/speedwatches/match/check", async (req, res) => {
    // try catch for getting games
    try {
        await connect(getLeagueKey())
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
                    // updates the notes schema. Here in place of a propper trigger for now
                    try {
                        await bulkNoteUpdate()
                    } catch {
                        console.log("There was an error in the bulk update of notes")
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

app.get("/speedwatches/get/users", async (req, res) => {
    try {
        await connect(getLeagueKey())
    } catch {
        throw Error("error in /get/user")
    } finally {
        disconnect()
    }
})


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})