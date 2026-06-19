import Participant from "../participant.ts";

export default function getOpponent(participants: Participant[], myPuuid: string): string {
  const me = participants.find(p => p.puuid === myPuuid);
  if (!me) return "error";

  const enemy = participants.find(
    p => p.teamId !== me.teamId && p.individualPosition === me.individualPosition
  );

  if(enemy){
    return enemy.championName
  } else {
    return "no opponent found"
  }
}