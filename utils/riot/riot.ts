import axios, { Axios } from "axios"
import type { AxiosResponse } from "axios";

export default class riotApi {
    private apiKey: string;
    
    public constructor(apiKey: string | undefined) {
        if(apiKey == undefined || apiKey == null){
            throw("Api key not provided. Please provide the api key to the riotApi constrcutor")
        }
        this.apiKey = apiKey;
    }

    private async call(path: string, region: string="asia"): Promise<AxiosResponse>{
        const root = `https://${region}.api.riotgames.com`
        const res = await axios.get(root+path, {
            headers: {
                "X-Riot-Token": this.apiKey
            }
        })
        console.log(root+path)
        return res
    }

    
    /**
     * league user name to puuid
     *
     * @param {string} name - the name
     * @param {string} id - the riot tag (after the #)
     *
     * @returns {Promise<AxiosResponse>} res - Do not forget to await
     */
    public summonerNameToId(name: string, id?: string): Promise<AxiosResponse> {
        let gameName: string = name
        let tagLine: string = id ?? ""

        if (name.includes("#")) {
            const sliced: string[] = name.split("#")
            gameName = sliced[0]
            tagLine = sliced[1]
        } else if (id?.startsWith("#")) {
            tagLine = id.split("#")[1]
        }

        if (!tagLine) {
            throw new Error("No tagLine provided — pass it via `name` (e.g. 'Name#TAG') or the `id` parameter.")
        }

        return this.call(`/riot/account/v1/accounts/by-riot-id/${gameName}/${tagLine}`);
    }

    /**
     * puuid to that player's top champion mastery entries
     *
     * @param {string} id - the puuid of the player
     *
     * @returns {Promise<AxiosResponse>} res - Do not forget to await
     */
    public idToHighestMastery(id: string): Promise<AxiosResponse> {
        return this.call(`/lol/champion-mastery/v4/champion-masteries/by-puuid/${id}/top`, "sg2")
    }

    /**
     * league id  to matches
     *
     * @param {string} id - the puuid of the player
     * @param {string} [count=5] - the amount of games that should be checked (default 5)
     * @param {number} [endTime=0] - The start time to look for use epoch time. From clause
     * @param {number} [startTime=0] - The end time to look for use epoch time. To clause
     * @param {number} [start=0] - The start count
     *
     * @returns {Promise<AxiosResponse>} res - Do not forget to await
     */
    public idToMatch(id: string, count:string ="5", endTime:number=0, startTime:number=0, start:number=0): Promise<AxiosResponse>{
        let querries:string = "";
    
        if (startTime>0){
            querries += `&startTime=${startTime}`
        } 
        if (endTime>0) {
            querries += `&endTime=${endTime}`
        }
        return this.call(`/lol/match/v5/matches/by-puuid/${id}/ids?start=${start}&count=${count}${querries}`, "sea")
    }

    /**
     * match id to the full match details for that game
     *
     * @param {string} matchId - the match id to look up (e.g. "SG2_161017792")
     *
     * @returns {Promise<AxiosResponse>} res - Do not forget to await
     */
    public matchIdToMatches(matchId: string): Promise<AxiosResponse>{
        return this.call(`/lol/match/v5/matches/${matchId}`, "sea")
    }

    /**
     * puuid to that player's summoner info (level, icon, etc.)
     *
     * @param {string} id - the puuid of the player
     *
     * @returns {Promise<AxiosResponse>} res - Do not forget to await
     */
    public idToSummoner(id: string): Promise<AxiosResponse>{
        return this.call(`/lol/summoner/v4/summoners/by-puuid/${id}`, "sg2")
    }

    /**
     * puuid to that player's currently active game, if one is in progress
     *
     * @param {string} id - the puuid of the player
     *
     * @returns {Promise<AxiosResponse>} res - Do not forget to await. Rejects/404s if the player is not currently in a game.
     */
    public idToCurrentMatch(id: string): Promise<AxiosResponse> {
        return this.call(`/lol/spectator/v5/active-games/by-summoner/${id}`, "sg2")
    }

    /**
     * match id to the timeline (frame-by-frame events) for that game
     *
     * @param {string} matchId - the match id to look up (e.g. "SG2_161017792")
     *
     * @returns {Promise<AxiosResponse>} res - Do not forget to await
     */
    public matchIdToMatchTimeLine(matchId: string): Promise<AxiosResponse> {
        return this.call(`/lol/match/v5/matches/${matchId}/timeline`, "sea")
    }

    public idToRank(id: string): Promise<AxiosResponse> {
        return this.call(`/lol/league/v4/entries/by-puuid/${id}`, "sg2")
    }
}