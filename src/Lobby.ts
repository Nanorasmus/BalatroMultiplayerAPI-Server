import { randomInt } from "crypto";
import type Client from "./Client.js";
import GameModes from "./GameMode.js";
import type {
	ActionLobbyInfo,
	ActionServerToClient,
	GameMode,
} from "./actions.js";
import { preProcessStringForNetworking } from "./utils.js";
import { serializeObject } from "./main.js";
import { actionHandlers } from "./actionHandlers.js";

const Lobbies = new Map();

const generateUniqueLobbyCode = (): string => {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	let result = "";
	for (let i = 0; i < 5; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return Lobbies.get(result) ? generateUniqueLobbyCode() : result;
};

export const getEnemy = (client: Client): [Lobby | null, Client | null] => {
	const lobby = client.lobby
	if (!lobby) return [null, null]

	if (client.enemyId != null) {
		const enemy = lobby.getPlayer(client.enemyId);
		if (enemy) return [lobby, enemy]
	}

	return [lobby, null]
}

class Lobby {
	code: string;
	players: Client[];
	gameMode: GameMode;
	isStarted = false;
	// biome-ignore lint/suspicious/noExplicitAny: 
	options: { [key: string]: any };

	// Attrition is the default game mode
	constructor(host: Client, gameMode: GameMode = "attrition") {
		do {
			this.code = generateUniqueLobbyCode();
		} while (Lobbies.get(this.code));
		Lobbies.set(this.code, this);

		this.players = [host];
		this.gameMode = gameMode;
		this.options = {};

		host.setLobby(this);
		host.sendAction({
			action: "joinedLobby",
			code: this.code,
			type: this.gameMode,
		});
	}

	static get = (code: string) => {
		return Lobbies.get(code);
	};

	getPlayer = (id: string): Client | null => {
		const player = this.players.find((player) => player.id === id);
		return player == undefined ? null : player;
	}

	isHost(client: Client): boolean {
		if (this.players.length === 0) return false
		return client.id === this.players[0].id;
	}

	getAllPlayersReady(): boolean {
		if (!this.isStarted) return false;
		
		return this.players.every((player) => player.lives <= 0 || player.isReady);
	}

	checkAllReady = () => {
		if (this.getAllPlayersReady()) {
			this.players.forEach((player) => {
				// Reset ready status for next blind
				player.isReady = false;
				
				// Reset scores for next blind
				player.score = 0n;
	
				// Reset hands left for next blind
				player.handsLeft = 4;
	
				player.sendAction({ action: "startBlind" });
	
				// Start the blind
				player.inPVPBattle = true;
			})
		}
	}

	// Returns the winner, or null if game is not over yet
	getWinner(): Client | null {
		let potentialWinner: Client | null = null;
		for (const player of this.players) {
			if (player.lives > 0) {
				if (potentialWinner) return null
				potentialWinner = player
			}
		}
		return potentialWinner;
	}

	removePlayerFromGame = (client: Client, removeFromLobby = true) => {
		// Stop the game for the removed player
		client.sendAction({ action: "stopGame" });

		if (removeFromLobby) {
			// Remove client from lobby
			const clientIndex = this.players.indexOf(client);
			if (clientIndex !== -1) {
				this.players.splice(clientIndex, 1);
			}
	
			client.setLobby(null);
		}

		if (this.players.length === 0) {
			Lobbies.delete(this.code);
		} else {
			if (this.isStarted) {

				// Handle the abandoned nemesis
				if (client.enemyId != null) {
					const enemy = this.getPlayer(client.enemyId);

					if (enemy != null) {
						if (enemy.inPVPBattle) {
							enemy.sendAction({ action: "endPvP", lost: false });
						}
						enemy.clearEnemy();
					}
				}
				
				this.checkAllReady();
				this.checkGameOver();

				if (this.players.filter((player) => player.lives > 0).length < 2) {
					// End game if no one is left or someone won due to this
					this.broadcastAction({ action: "stopGame" });
					this.resetPlayers();
					this.isStarted = false;
				}
			}

			client.resetStats();

			this.broadcastLobbyInfo();
		}
	};

	join = (client: Client) => {
		// Ignore if player is already in game
		if (this.players.indexOf(client) !== -1) {
			return;
		}

		// Error if game is ongoing or lobby is full
		if (this.players.length >= 16 || this.isStarted) {
			client.sendAction({
				action: "error",
				message: "Lobby is full, has already started, or does not exist.",
			});
			return;
		}

		this.players.push(client);
		client.setLobby(this);
		client.sendAction({
			action: "joinedLobby",
			code: this.code,
			type: this.gameMode,
		});
		client.sendAction({ action: "lobbyOptions", gamemode: this.gameMode, ...this.options });
		this.broadcastLobbyInfo();
	};

	broadcastAction = (action: ActionServerToClient) => {
		this.players.forEach(player => {
			player?.sendAction(action);
		});
	};

	broadcastLobbyInfo = () => {
		if (this.players.length == 0) {
			return;
		}

		// Get list of everyone in the lobby
		const playerStrings: string[] = []

		for (const player of this.players) {
			const playerInfo = {
				"id": preProcessStringForNetworking(player.id),
				"username": preProcessStringForNetworking(player.username),
				"hash": preProcessStringForNetworking(player.modHash),
				"isHost": this.isHost(player)
			}
			
			playerStrings.push(serializeObject(playerInfo, "-", ">"));
		}

		// Join the list into a single string with a semicolon seperator
		const playerString = playerStrings.join("|");

		// Send action to each player, telling them about themselves and their nemesis
		this.players.forEach(player => {
			let action: ActionLobbyInfo;

			let enemy: Client | null = null;

			// Get enemy
			if (this.isStarted && player.enemyId != null) {
				enemy = this.getPlayer(player.enemyId);
			}

			// Make action
			action = {
				action: "lobbyInfo",

				playerId: player.id,
				players: playerString,
				isStarted: this.isStarted,
			};
			
			// Send action
			player.sendAction(action);
		});
	};

	setPlayersLives = (lives: number) => {
		// TODO: Refactor for more than 2 players
		this.players.forEach(player => {
			player.lives = lives;
		});

		this.broadcastAction({ action: "playerInfo", lives });
	};

	// Deprecated
	sendGameInfo = (client: Client) => {
		if (this.players.indexOf(client) === -1) {
			return client.sendAction({
				action: "error",
				message: "Client not in Lobby",
			});
		}

		client.sendAction({
			action: "gameInfo",
			...GameModes[this.gameMode].getBlindFromAnte(client.ante, this.options),
		});
	};

	setOptions = (options: { [key: string]: string }) => {
		for (const key of Object.keys(options)) {
			if (options[key] === "true" || options[key] === "false") {
				this.options[key] = options[key] === "true";
			} else {
				this.options[key] = options[key];
			}
		}
		this.players.forEach(player => {
			if (this.players.indexOf(player) > 0) {
				player?.sendAction({ action: "lobbyOptions", gamemode: this.gameMode, ...options });
			}
		})
	};

	resetPlayers = () => {
		this.players.forEach(player => {
			player.reset();
		})
	}

	checkRerollEnemies = () => {
		console.log("Checking reroll:\n" + this.players.map(player => `${player.username} (${player.enemyId})`).join(",\n"));

		// Return if game is not started, less than 2 players remaining, or if someone still has a nemesis
		if (
			!this.isStarted
			|| this.players.length < 2
			|| !this.players.every(player => player.lives <= 0 || player.enemyId == null)
		) return;

		this.rerollEnemies();
	}

	rerollEnemies = () => {
		console.log("Rerolling");

		let playersLeft: Client[] = Array.from(this.players)
		
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

		this.broadcastLobbyInfo();
	}

	checkGameOver = () => {
		const winner = this.getWinner();

		if (winner) {
			winner.sendAction({ action: "winGame" });
			if (winner.enemyId) {
				winner.sendEndGameJokersOfPlayer(winner.enemyId);
			}

			this.resetPlayers();
			this.isStarted = false;
			this.broadcastLobbyInfo();
		}
	}
}

export default Lobby;
