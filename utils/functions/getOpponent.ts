import Participant from "../participant";

export default function getOpponent(participants: Participant[], myPuuid: string): String | undefined {
  const me = participants.find(p => p.puuid === myPuuid);
  if (!me) return undefined;

  const enemy = participants.find(
    p => p.teamId !== me.teamId && p.individualPosition === me.individualPosition
  );

  if(enemy){
    return enemy.championName
  } else {
    return undefined
  }
}