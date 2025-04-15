import Lobby from "../../Lobby.js";
import { BRMode } from "../BRMode.js";

export class BRModeDisabled extends BRMode {
    public override maxPlayers: number = 2

    constructor(lobby: Lobby) {
        super(lobby);

        this.lobby.players.forEach((player, idx) => {
            if (this.maxPlayers <= idx + 1) {
                player.sendAction({
                    action: "kickedFromLobby"
                })
                this.lobby.removePlayerFromGame(player);
                player.sendAction({ action: "error", message: "You have been removed from the lobby due to player limit changing." });
            }
        });
    }

    public rerollEnemies(): void {
        if (this.lobby.players.length >= 2) {
            this.lobby.players[0].setEnemy(this.lobby.players[1]);
            this.lobby.players[1].setEnemy(this.lobby.players[0]);
        }
    }
}