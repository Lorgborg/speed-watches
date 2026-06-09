// express related imports
import express from "express";
const app = express()
const port = 3000
import { connect, FilterQuery } from 'mongoose';
import { apiReference } from "@scalar/express-api-reference"

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
import { NoteModel } from "./utils/schemas/notes";

import dns from "node:dns/promises";
dns.setServers(["1.1.1.1"]);

app.use(express.json())

// app.use("/docs", apiReference({
//     url: "/documentation.yaml",
//     authentication: {
//         preferredSecurityScheme: "VercelAuth",
//         securitySchemes: {
//             VercelAuth: {
//                 type: "apiKey",
//                 name: "Authorizatoin",
//                 in: "header",
//                 value: process.env.vercelBypass ?? ""
//             }
//         }
//     }
// }))

// save all necessary info to save on api calls needed when querying data
app.get("/speedwatches/match/check", async (req, res) => {
    // try catch for getting games
    try {
        const summoners = await summonerUserModel.find()

        for (const summoner of summoners) {
            const matches = await riot.idToMatch(summoner.puuid)
            for (const match of matches.data) {
                // checks if the game is saved in db
                const gameQuery = await gameModel.findOne({ matchId: match, puuid: summoner.puuid })
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
                }
            }
        }
        
        try {
            await bulkNoteUpdate()
            console.log("bulk updated notes")
        } catch {
            console.log("There was an error in the bulk update of notes")
        }
        res.send("saved")
    } catch(e) {
        res.send(`error: ${e}`)
    }
})

app.get("/speedwatches/get/users", async (req, res) => {
    try {
        const username = req.body["username"]
        console.log(username)
        
    } catch (e) {
        console.log(`error at /get/users \n${e}`)
    }
})

app.get("/speedwatches/get/matchup", async (req, res) => {
    try {
        const query: FilterQuery<typeof NoteModel> = {

        }
        if(req.query["username"] != null){
            const userDbQuery = await summonerUserModel.findOne(
                { user: req.query["username"] },
                { puuid: 1 }
            ).lean()
            if(userDbQuery == null){
                console.log("user not found in database")
                return
            }
            query.puuid = userDbQuery.puuid
        }
        
        if(req.query["championPlayed"] != null) query.championPlayed = req.body["championPlayed"]
        if(req.query["championFighting"] != null) query.championFighting = req.body["championFighting"]

        console.log(`using query: ${query}`)
        const find = await NoteModel.find(
            query
        ).lean()

        res.send(find)
    } catch (e) {
        res.send(`error at /get/matchup \n${e}`)
    }
})

async function main() {
    await connect(getLeagueKey())
    
    app.listen(port, () => console.log(`Server running on ${port}`))
}

main()