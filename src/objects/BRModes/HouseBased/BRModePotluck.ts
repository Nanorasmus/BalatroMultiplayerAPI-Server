import { InsaneInt } from "../../InsaneInt.js";
import Lobby from "../../Lobby.js";
import { HouseBased } from "./HouseBased.js";

export class BRModePotluck extends HouseBased {

    constructor(lobby: Lobby) {
        super(lobby);
    }

    public override getAllDoneWithPVP(): boolean {
		return this.lobby.players.every((player) => {
			if (player.lives <= 0 || !player.inMatch) return true;
			if (!player.inPVPBattle) return false;

			return player.handsLeft <= 0 || !player.score.lessThan(player.score_to_beat);
		});
    }

    public override checkPVPDone(): void {
        if (this.getAllDoneWithPVP()) {
            this.lobby.players.forEach((player) => {
                if (player.lives <= 0) return;

                if (player.score.lessThan(player.score_to_beat)) {
                    player.loseLife();
                }
                player.sendAction({ action: "endPvP", lost: player.score.lessThan(player.score_to_beat) });
                player.firstReady = false;
                player.inPVPBattle = false;
                player.score_to_beat = new InsaneInt(0, 0, 0);
                player.clearEnemy();
            });
        }
    }

    public override recalculateScoreToBeat(): void {
        this.lobby.players.forEach((player) => {
            let score_to_beat = new InsaneInt(0, 0, 0);
            let hands = 0;

            this.lobby.players.forEach((otherPlayer) => {
                if (player.id != otherPlayer.id) {
                    score_to_beat = score_to_beat.add(otherPlayer.score);
                    hands += player.handsLeft
                }
            });

            score_to_beat = score_to_beat.div(new InsaneInt(0, this.lobby.players.filter((player) => player.lives > 0).length - 1, 0));

            if (score_to_beat.lessThan(new InsaneInt(0, 100, 0))) score_to_beat = new InsaneInt(0, 100, 0);

            try {
                score_to_beat = score_to_beat.div(new InsaneInt(0, 1, 0).div(new InsaneInt(0, this.lobby.options["nano_br_potluck_score_multiplier"], 0)));
            } catch (e) {
                console.log("Failed to add multiplier");
            }

            player.score_to_beat = score_to_beat;
            player.sendAction({
                action: "enemyInfo",
                playerId: "house",
                score: score_to_beat.toString(),
                handsLeft: hands,
                skips: 0,
                lives: 0
            })
        })
    }
}