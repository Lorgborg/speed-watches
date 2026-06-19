import Participant from "../participant.ts";

export default function getPlaying(participants: Participant[], myPuuid: string): Participant | null {
  const me = participants.find(p => p.puuid === myPuuid);
  if(me){
    return me
  } else {
    console.log(`Champion was not found, still proceeding. ${myPuuid} not found in ${participants}`);
    return null
  }
}