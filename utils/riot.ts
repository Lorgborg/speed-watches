import axios, { AxiosResponse } from "axios"

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
        return res
    }

    
    /*
     *  turns tag to id
     */
    public summonerNameToId(name: string, id: string): Promise<AxiosResponse>{
        let usedId: string = id
        if(id.startsWith("#")) {
            const sliced: string[] = id.split("#")
            usedId = sliced[1]
        }
        return this.call(`/riot/account/v1/accounts/by-riot-id/${name}/${usedId}`);
    }

    public idToHighestMastery(id: string): Promise<AxiosResponse> {
        return this.call(`/lol/champion-mastery/v4/champion-masteries/by-puuid/${id}/top`, "sg2")
    }

    public idToMatch(id: string, count:string ="3"): Promise<AxiosResponse>{
        return this.call(`/lol/match/v5/matches/by-puuid/${id}/ids?start=0&count=${count}`, "sea")
    }

    public matchIdToMatches(matchId: string): Promise<AxiosResponse>{
        return this.call(`/lol/match/v5/matches/${matchId}`, "sea")
    }

    public idToSummoner(id: string): Promise<AxiosResponse>{
        return this.call(`/lol/summoner/v4/summoners/by-puuid/${id}`, "sg2")
    }

    public idToCurrentMatch(id: string): Promise<AxiosResponse> {
        return this.call(`/lol/spectator/v5/active-games/by-summoner/${id}`, "sg2")
    }

    public matchIdToMatchTimeLine(matchId: string): Promise<AxiosResponse> {
        return this.call(`/lol/match/v5/matches/${matchId}/timeline`, "sea")
    }
}