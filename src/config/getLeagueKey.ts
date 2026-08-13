import "dotenv/config"

// gets key and handles error
export default function getLeagueKey(){
  if(process.env["mongoUri"] == undefined){
    throw Error("mongoUri was not defined")
  } else {
    return process.env["mongoUri"].replace("?", "league?")
  }
}