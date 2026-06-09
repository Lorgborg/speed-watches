import { Schema, model, connect, Document, disconnect } from 'mongoose';
import Participant from "./utils/participant.ts";
import riotApi from "./utils/riot.ts"
import "dotenv/config"
import getOpponent from "./utils/functions/getOpponent.ts";
const riot = new riotApi(process.env["leagueApi"])

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

console.log("starting game updates...")

async function check() {
    // try catch for getting games
    try {
        console.log("updating games...")
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
                if(gameQuery == null){
                    console.log("saving game with id: " + match)
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
        console.log("finished updating games");
    } catch(e) {
        console.log(`error: ${e}`)
    } finally {
        disconnect()
    }
}

check()

setInterval(check, 5 * 60 * 1000) // runs 5 minutes

// temporary endpoint