import { InsaneInt } from "../../../InsaneInt.js";
import Lobby from "../../../Lobby.js";
import Team from "./Team.js";
import { TeamBased } from "./TeamBased.js";

export class BRModeHivemind extends TeamBased {

    constructor(lobby: Lobby) {
        super(lobby);
    }

    public override checkPVPDone(): void {
        if (this.teams.every((team) => team.getAllDoneWithPVP())) {
            this.teams.forEach((team) => {
                if (team.lives <= 0) return;

                team.inPVPBlind = false;
                team.inBlind = false;
                let lost = team.score.lessThan(team.enemyTeam?.score ?? new InsaneInt(0, 0, 0));

                team.players.forEach((player) => {
                    player.sendAction({ action: "endPvP", lost: lost });

                    player.isReady = false;
                    player.isReadyPVP = false;
                    player.firstReady = false;
                    player.inPVPBattle = false;
                });
                
                if (lost) team.loseLife();
            });

            this.rerollEnemies();
        }
    }
}