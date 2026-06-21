import express from "express"
import bodyParser from "body-parser"
import postgres from "postgres"
import "dotenv/config"
const app = express()
const port = 3000

import riotApi from "../utils/riot.ts"
import { checkDiscordId, checkPuuid } from "./util/inputValidation.ts"
const riot = new riotApi(process.env["leagueApi"])

const { postgresuri } = process.env
if(postgresuri == undefined){
    throw TypeError("postgres uri is undefined. Is your .env existing?");   
}
const sql = postgres(postgresuri);

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.get('/get/user', async (req, res) => {
    const { discordId, puuid, username} = req.body ?? {}
    let querryValue; 
    if(username) {
        querryValue = await sql`select * from users where username=${username}`
        console.log("getting through username")
    } else if (puuid) {
        if (await checkPuuid(puuid)) {
            res.status(401).send("Error: puuid is not a valid id")
        }
        querryValue = await sql`select * from users where puuid=${puuid}`
    } else if (discordId) {
        if(checkDiscordId(discordId)) {
            res.status(401).send("Error: Discord Id is not a valid format")
        }
        querryValue = await sql`select * from users where discordId=${discordId}`
    }

    res.send(querryValue)
})

app.get('/get/users', async (req, res) => {
    const data = await sql`select * from users`
    res.send(data)
})

app.get('/get/matchup', async (req, res) => {
    try {
        const { championFighting, championPlayed, username } = req.body
        if(username) {

        }
        sql`select * from notes where championFighting=${championFighting} and championPlayed=${championPlayed}`
    } catch(e) {

    }
})

app.post('/post/users', async (req, res) => {
    try {
        const { username, discordId, puuid } = req.body
        if(checkDiscordId(discordId)) {
            res.status(401).send("Error: Discord Id is not a valid format")
        } else if (await checkPuuid(puuid)) {
            res.status(401).send("Error: puuid is not a valid id")
        }
        const save = await sql`
        insert into users (username, discordId, puuid) values (${username}, ${discordId}, ${puuid})
        `
        res.send("successfully saved")
    } catch (e: any) {
        console.log(e)
        switch(e.code){
            case "UNDEFINED_VALUE": {
                res.status(401).send("Error: Value is undefined, check if values username, discordId and puuid is filled")
                break;
            }
            default: {
                res.status(401).send("Error: " + e)
            }
        }
        
    }
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})