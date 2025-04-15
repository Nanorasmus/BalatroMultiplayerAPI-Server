import { InsaneInt } from "../../InsaneInt.js";
import Lobby from "../../Lobby.js";
import { BRMode } from "../BRMode.js";


/// The base of all BR modes that require an abstraction of the enemy in the form of the house
export class HouseBased extends BRMode {
	public override startGame() {
		super.startGame();

		this.lobby.broadcastAction({
			action: "enemyInfo",
			playerId: "house",
			score: "0",
			handsLeft: 0,
			skips: 0,
			lives: 0
		})
	}

    public override startPVPBlind(): void {
        super.startPVPBlind();

        this.recalculateScoreToBeat();
    }

	public recalculateScoreToBeat() {
		this.lobby.players.forEach((player) => {
			player.score_to_beat = new InsaneInt(0, 100, 0);
			player.sendAction({
				action: "enemyInfo",
				playerId: "house",
				score: player.score_to_beat.toString(),
				handsLeft: 0,
				skips: 0,
				lives: 0
			})
		})
	}
}