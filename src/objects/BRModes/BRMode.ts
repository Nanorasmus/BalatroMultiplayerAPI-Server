import GameModes from "../../GameMode.js";
import { generateSeed, randomInt } from "../../utils.js";
import Client from "../Client.js";
import { InsaneInt } from "../InsaneInt.js";
import Lobby from "../Lobby.js";

/// The base of all Battle royale modes
export class BRMode {
    public id: string = "N/A";

    public lobby: Lobby

    public minPlayers: number = 2
    public maxPlayers: number = 16

    livesOption: number = 4

    constructor(lobby: Lobby) {
        this.lobby = lobby
    }


    public onJoinLobby(client: Client) {}

    public onLeaveLobby(client: Client, leftFully: boolean) {}

    public startGame() {
        this.livesOption = this.lobby.options.starting_lives
        ? Number.parseInt(this.lobby.options.starting_lives)
        : GameModes[this.lobby.gameMode].startingLives;


        this.lobby.broadcastAction({
            action: "startGame",
            deck: "c_multiplayer_1",
            seed: this.lobby.options.different_seeds ? undefined : generateSeed(),
        });
        // Reset players' lives
        this.lobby.setPlayersLives(this.livesOption);
        
        // Roll for who is whose nemesis
        this.rerollEnemies();

        // Set the game as started
        this.lobby.isStarted = true;
        this.lobby.broadcastLobbyInfo();

        this.lobby.players.forEach((player) => {
            player.inMatch = true;
            player.isReady = false;
            player.isReadyPVP = false;
        });
    }
    
    public getAllPlayersReadyPVP(): boolean {
        if (!this.lobby.isStarted) return false;
        
        return this.lobby.players.every((player) => !player.inMatch || player.lives <= 0 || player.isReadyPVP);
    }


	public checkAllReady(): void {
		if (this.getAllPlayersReadyPVP()) {
            this.startPVPBlind();
		}
	}

    public startPVPBlind() {
        this.lobby.players.forEach((player) => {
            if (player.lives <= 0 || !player.inMatch) return;
            
            // Reset ready status for next blind
            player.isReady = false;
            player.isReadyPVP = false;
            
            // Reset scores for next blind
            player.score = new InsaneInt(0, 0, 0);

            // Reset hands left for next blind
            player.handsLeft = 4;

            player.sendAction({ action: "startBlind" });

            // Start the blind
            player.inPVPBattle = true;
        })
    }


    public getAllDoneWithPVP(): boolean { return true; }
    public checkPVPDone() {}

	// Returns the winner, or null if game is not over yet
	public getWinner(): Client | null {
		let potentialWinner: Client | null = null;
		for (const player of this.lobby.players) {
			if (player.lives > 0) {
				if (potentialWinner) return null
				potentialWinner = player
			}
		}
		return potentialWinner;
	}

    public checkGameOver() {
		const winner = this.getWinner();

		if (winner) {
			winner.sendAction({ action: "winGame" });
			if (winner.enemyId) {
				winner.sendEndGameJokersOfPlayer(winner.enemyId);
			}

			this.resetPlayers();
			this.lobby.isStarted = false;
			this.lobby.broadcastLobbyInfo();
		}
    }

    public rerollEnemies() {
		console.log("Rerolling enemies");

		let playersLeft: Client[] = Array.from(this.lobby.players)
		
		// Remove any invalid picks
		playersLeft = playersLeft.filter(player => {
			return player.lives > 0;
		});

		while (playersLeft.length >= 2) {
			const player1 = playersLeft.splice(randomInt(playersLeft.length), 1)[0];
			const player2 = playersLeft.splice(randomInt(playersLeft.length), 1)[0];
			player1.setEnemy(player2);
			player2.setEnemy(player1);
		}

		if (playersLeft.length === 1) {
			playersLeft[0].clearEnemy();
		}

		this.lobby.broadcastLobbyInfo();
    }

    public resetPlayers() {}
    
    public recalculateScoreToBeat() {}
}