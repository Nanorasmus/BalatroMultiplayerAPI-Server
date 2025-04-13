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
import Team from "./Team.js";

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
	playerLimit: number = 16;
	teams: Team[];
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
		this.options = {
			"nano_battle_royale": true,
		};

		host.setLobby(this);
		host.sendAction({
			action: "joinedLobby",
			code: this.code,
			type: this.gameMode,
		});

		// Initialize teams
		this.teams = [new Team("RED", this)];
		this.teams[0].addPlayer(host);
	}

	static get = (code: string) => {
		return Lobbies.get(code);
	};

	getPlayerCount = () => this.players.length;

	isJoinable = () => this.getPlayerCount() < this.playerLimit && !this.isStarted;

	getPlayer = (id: string): Client | null => {
		const player = this.players.find((player) => player.id === id);
		return player == undefined ? null : player;
	}

	isHost(client: Client): boolean {
		if (this.players.length === 0) return false
		return client.id === this.players[0].id;
	}

	getAllPlayersReadyPVP(): boolean {
		if (!this.isStarted) return false;
		
		return this.players.every((player) => !player.inMatch || player.lives <= 0 || player.isReadyPVP);
	}

	recalculateScoreToBeat() {
		if (this.options["nano_br_mode"] == "potluck") {
			this.players.forEach((player) => {
				let score_to_beat = new InsaneInt(0, 0, 0);
				let hands = 0;

				this.players.forEach((otherPlayer) => {
					if (player.id != otherPlayer.id) {
						score_to_beat = score_to_beat.add(otherPlayer.score);
						hands += player.handsLeft
					}
				});

				score_to_beat = score_to_beat.div(new InsaneInt(0, this.players.filter((player) => player.lives > 0).length - 1, 0));

				if (score_to_beat.lessThan(new InsaneInt(0, 100, 0))) score_to_beat = new InsaneInt(0, 100, 0);

				try {
					score_to_beat = score_to_beat.div(new InsaneInt(0, 1, 0).div(new InsaneInt(0, this.options["nano_br_potluck_score_multiplier"], 0)));
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

	getAllPlayersDonePotLuck(): boolean {
		return this.players.every((player) => {
			if (player.lives <= 0) return true;
			if (!player.inPVPBattle) return false;

			return player.handsLeft <= 0 || !player.score.lessThan(player.score_to_beat);
		});
	}

	checkPotLuckDone = () => {
		if (this.getAllPlayersDonePotLuck()) {
			this.players.forEach((player) => {
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

	checkHivemindDone = () => {
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

			this.rerollTeamEnemies();
		}
	}



	checkAllReady = () => {
		if (this.getAllPlayersReadyPVP()) {
            // Give everyone an updated deck if in hivemind
			if (this.options["nano_br_mode"] == "hivemind") {
				this.teams.forEach((team) => team.deck?.applyPendingActions());
			}

			this.players.forEach((player) => {
				// Reset ready status for next blind
				player.isReady = false;
				player.isReadyPVP = false;
				
				// Reset scores for next blind
				player.score = new InsaneInt(0, 0, 0);
	
				// Reset hands left for next blind
				player.handsLeft = 4;
	
				console.log("Starting blind for all!");
				player.sendAction({ action: "startBlind" });
	
				// Start the blind
				player.inPVPBattle = true;
			})
			if (this.options["nano_br_mode"] == 'potluck') {
				this.recalculateScoreToBeat();
			}
			if (this.options["nano_br_mode"] == "hivemind") {
				this.teams.forEach((team) => {
					team.inBlind = true;
					team.inPVPBlind = true;
				});
			}
		}
		if (this.options["nano_br_mode"] == "hivemind") {
			this.teams.forEach((team) => team.checkAllReady());
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

	// Returns winning team, or null if game is not over yet
	getWinningTeam(): Team | null {
		if (this.teams.length === 0) return null;
		if (this.teams.length === 1) return this.teams[0];
		let potentialWinner: Team | null = null;
		for (const team of this.teams) {
			if (team.lives > 0 && team.players.length > 0) {
				if (potentialWinner) return null;
				potentialWinner = team;
			}
		}
		return potentialWinner;
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
				
				this.checkAllReady();
				this.recalculateScoreToBeat();
				if (this.options["nano_br_mode"] == 'potluck') {
					this.checkPotLuckDone();
				} else if (this.options["nano_br_mode"] == 'hivemind') {
					this.checkHivemindDone();
				}
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
		this.setPlayerTeam(client, "RED");
		this.broadcastLobbyInfo();

		// Tell new client what team everyone is on
		this.players.forEach(player => {
			if (player.team) {
				client.sendAction({ action: "setPlayerTeam", playerId: player.id, teamId: player.team.id });
			}
		});
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
				this.playerLimit = 16;
			} else {
				// Battle royale disabled
				this.playerLimit = 2;

				// Kick overflow players
				this.players.forEach((player, idx) => {
					if (this.playerLimit <= idx + 1) {
						player.sendAction({
							action: "kickedFromLobby"
						})
						this.removePlayerFromGame(player);
						player.sendAction({ action: "error", message: "You have been removed from the lobby due to player limit changing." });
					}
				});
			}
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

	resetPlayers = () => {
		this.players.forEach(player => {
			player.reset();
		})
		this.teams.forEach(team => {
			team.resetStats();
		})
	}

	setPlayerTeam = (client: Client, teamId: string) => {
		for (const team of this.teams) {
			if (team.id == teamId) {
				team.addPlayer(client);
				return;
			}
		}

		// If team was not found
		let team: Team = new Team(teamId, this);
		this.teams.push(team);
		team.addPlayer(client);
	};

	removeTeam = (team: Team) => {
		this.teams.splice(this.teams.indexOf(team), 1);
	};

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
		console.log("Rerolling team enemies");

		let teamsLeft: Team[] = Array.from(this.teams)
		
		// Remove any invalid picks
		teamsLeft = teamsLeft.filter(team => {
			return team.lives > 0 && team.players.length > 0;
		});

		while (teamsLeft.length >= 2) {
			const team1 = teamsLeft.splice(randomInt(teamsLeft.length), 1)[0];
			const team2 = teamsLeft.splice(randomInt(teamsLeft.length), 1)[0];
			team1.setEnemyTeam(team2);
			team2.setEnemyTeam(team1);
		}

		if (teamsLeft.length === 1) {
			teamsLeft[0].clearEnemyTeam();
		}
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
		if (this.options["nano_br_mode"] == "hivemind") {
			const winner = this.getWinningTeam();

			if (winner) {
				winner.players.forEach(player => {
					player.sendAction({ action: "winGame" });

					winner.enemyTeam?.players.forEach(enemy => {
						player.sendEndGameJokersOfPlayer(enemy.id);
					})
				});
				this.resetPlayers();
				this.isStarted = false;
				this.broadcastLobbyInfo();
			}
			return
		};

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
