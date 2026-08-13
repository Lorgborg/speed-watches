import Participant from "../types/participant.ts";

export default function getPlaying(participants: Participant[], myPuuid: string): Participant | null {
  const me = participants.find(p => p.puuid === myPuuid);
  if(me){
    return me
  } else {
    console.log(`Participant ${myPuuid} not found among ${participants.length} participants, skipping.`);
    return null
  }
}