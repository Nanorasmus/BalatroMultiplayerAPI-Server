import { randomInt } from "crypto";
import type Client from "./Client.js";
import GameModes from "../GameMode.js";
import type {
	ActionLobbyInfo,
	ActionServerToClient,
	GameMode,
} from "../actions.js";
import { preProcessStringForNetworking } from "../utils.js";
import { serializeObject } from "../main.js";
import { actionHandlers } from "../actionHandlers.js";
import { InsaneInt } from "./InsaneInt.js";
import Team from "./BRModes/HouseBased/TeamBased/Team.js";
import { BRMode } from "./BRModes/BRMode.js";
import { BRModeDisabled } from "./BRModes/Base/BRModeDisabled.js";
import { BRModeNemesis } from "./BRModes/Base/BRModeNemesis.js";
import { BRModePotluck } from "./BRModes/HouseBased/BRModePotluck.js";
import { BRModeHivemind } from "./BRModes/HouseBased/TeamBased/BRModeHivemind.js";

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
	brMode: BRMode = new BRModeNemesis(this);
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
		this.options = {
			"nano_battle_royale": true,
		};

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

	getPlayerCount = () => this.players.length;

	isJoinable = () => this.getPlayerCount() < this.brMode.maxPlayers && !this.isStarted;

	getPlayer = (id: string): Client | null => {
		const player = this.players.find((player) => player.id === id);
		return player == undefined ? null : player;
	}

	isHost(client: Client): boolean {
		if (this.players.length === 0) return false
		return client.id === this.players[0].id;
	}


	removePlayerFromGame = (client: Client, removeFromLobby = true) => {
		// Stop the game for the removed player
		client.sendAction({ action: "stopGame" });
		client.inMatch = false;
		client.inPVPBattle = false;

		if (removeFromLobby) {
			// Remove client from team
			client.team?.removePlayer(client);

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

				if (client.team) {}
				
				this.brMode.checkAllReady();
				this.brMode.recalculateScoreToBeat();
				this.brMode.checkPVPDone();
				this.checkGameOver();

				client.resetStats();

				if (this.players.filter((player) => player.lives > 0).length < 2) {
					// End game if no one is left or someone won due to this
					this.broadcastAction({ action: "stopGame" });
					this.resetPlayers();
					this.isStarted = false;
				}
			}

			this.broadcastLobbyInfo();

			this.brMode.onLeaveLobby(client, removeFromLobby);
		}
	};

	join = (client: Client) => {
		// Ignore if player is already in game
		if (this.players.indexOf(client) !== -1) {
			return;
		}

		// Error if game is ongoing or lobby is full
		if (!this.isJoinable()) {
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

		this.brMode.onJoinLobby(client);
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

	setOptions = (options: { [key: string]: string }) => {
		// Get old BR mode
		let wasBREnabled: boolean = this.options["nano_battle_royale"];
		let lastBRMode: string = this.options["nano_br_mode"];

		for (const key of Object.keys(options)) {
			if (options[key] === "true" || options[key] === "false") {
				this.options[key] = options[key] === "true";
			} else {
				this.options[key] = options[key];
			}
		}

		if (wasBREnabled != this.options["nano_battle_royale"]) {
			if (this.options["nano_battle_royale"]) {
				// Battle royale enabled
				this.setBRMode();
			} else {
				// Battle royale disabled
				this.brMode = new BRModeDisabled(this);
			}
		} else if (lastBRMode != this.options["nano_br_mode"]) {
			// Battle royale mode changed
			this.setBRMode();
		}
		
		this.broadcastLobbyOptions(this.players[0].id);
	};

	broadcastLobbyOptions = (excludePlayer: string) => {
		this.players.forEach(player => {
			if (player.id != excludePlayer) {
				player?.sendAction({ action: "lobbyOptions", gamemode: this.gameMode, ...this.options });
			}
		})
	}

	setBRMode = () => {
		switch (this.options["nano_br_mode"]) {
			case "nemesis":
				this.brMode = new BRModeNemesis(this);
				break;
			case "potluck":
				this.brMode = new BRModePotluck(this);
				break;
			case "hivemind":
				this.brMode = new BRModeHivemind(this);
				break;
			default:
				this.brMode = new BRModeDisabled(this);
				break;
		}
	};

	resetPlayers = () => {
		this.players.forEach(player => {
			player.reset();
		})
		this.brMode.resetPlayers();
	}

	checkRerollEnemies = () => {
		console.log("Checking reroll:\n" + this.players.map(player => `${player.username} (${player.enemyId})`).join(",\n"));

		

		// Return if game is not started, less than 2 players remaining, or if someone still has a nemesis
		if (
			!this.isStarted
			|| this.options["nano_br_mode"] == "hivemind"
			|| this.players.length < 2
			|| !this.players.every(player => player.lives <= 0 || player.enemyId == null)
		) return;

		this.rerollEnemies();
	}

	rerollTeamEnemies = () => {
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
		// Special team-based logic
		this.brMode.checkGameOver();
	}
}

export default Lobby;
