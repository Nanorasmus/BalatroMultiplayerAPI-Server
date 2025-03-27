import { type AddressInfo } from 'node:net'
import { v4 as uuidv4 } from 'uuid'
import type Lobby from './Lobby.js'
import type { ActionServerToClient } from './actions.js'
import { getEnemy } from './Lobby.js'

type SendFn = (action: ActionServerToClient) => void
type CloseConnFn = () => void

/* biome-ignore lint/complexity/noBannedTypes: 
	This is how the net module does it */
type Address = AddressInfo | {}

class Client {
	// Connection info
	id: string
	// Could be useful later on to detect reconnects
	address: Address
	sendAction: SendFn
	closeConnection: CloseConnFn

	// Game info
	username = 'Guest'
	modHash = 'NULL'
	lobby: Lobby | null = null
	/** Whether player is ready for next blind */
	isReady = false
	firstReady = false
	lives = 0
	score = 0n
	handsLeft = 4
	ante = 1
	skips = 0

	enemyId: string | null = null
	inPVPBattle = false
	phantomKeys: string[] = []

	livesBlocker = false

	location = 'loc_selecting'

	constructor(address: Address, send: SendFn, closeConnection: CloseConnFn) {
		this.id = uuidv4()
		this.address = address
		this.sendAction = send
		this.closeConnection = closeConnection
	}

	setLocation = (location: string) => {
		this.location = location
		if (this.lobby) {
			this.lobby.broadcastAction({ action: "enemyLocation", playerId: this.id, location: this.location });
		}
	}

	setUsername = (username: string) => {
		this.username = username
		console.log(username + " and " + (this.lobby == null))
		this.lobby?.broadcastLobbyInfo()
	}

	setModHash = (modHash: string) => {
		this.modHash = modHash
		this.lobby?.broadcastLobbyInfo()
	}

	setLobby = (lobby: Lobby | null) => {
		this.lobby = lobby
	}
	
	sendInfoToLobby = () => {
		this.lobby?.broadcastAction({
			action: "enemyInfo",
			playerId: this.id,
			handsLeft: this.handsLeft,
			score: this.score,
			skips: this.skips,
			lives: this.lives,
		});
	}

	resetStats = () => {
		this.lives = 0;
		this.score = 0n;
		this.handsLeft = 4;
		this.ante = 1;
		this.skips = 0;

		this.enemyId = null;
		this.inPVPBattle = false;
		this.phantomKeys = [];
		
		this.sendInfoToLobby();
	}

	resetBlocker = () => {
		this.livesBlocker = false
	}

	reset = () => {
		this.isReady = false;
		this.resetStats()
		this.resetBlocker()
		this.setLocation('loc_selecting');
	}

	loseLife = () => {
		if (!this.livesBlocker && this.lives > 0) {
			this.lives -= 1
			this.livesBlocker = true
			this.sendAction({ action: "playerInfo", lives: this.lives });

			this.lobby?.broadcastAction({
				action: "enemyInfo",

				playerId: this.id,
				handsLeft: this.handsLeft,
				score: this.score,
				skips: this.skips,
				lives: this.lives,
			});
		}

		if (this.lives <= 0) {
			this.sendAction({ action: "loseGame" });

			this.lobby?.checkGameOver();

			// Handle the abandoned nemesis
			if (this.enemyId != null) {

				const enemy = this.lobby?.getPlayer(this.enemyId);

				if (enemy != null) {
					enemy.clearEnemy();
					this.sendEndGameJokersOfPlayer(enemy.id);
				}
			}
	
			this.lobby?.checkAllReady();
		}
	}

	setSkips = (skips: number) => {
		this.skips = skips
	}

	sendEndGameJokersOfPlayer = (player_id: string) => {
		const killer = this.lobby?.getPlayer(player_id);
		killer?.sendAction({
			action: "getEndGameJokers",
			recieverId: this.id
		})
	}

	removePhantomsFromEnemy = () => {
		if (!this.lobby || !this.enemyId) return;

		const enemy = this.lobby.getPlayer(this.enemyId);

		this.phantomKeys.forEach((key) => enemy?.sendAction({ action: "removePhantom", key }));	
	}

	setEnemy = (enemy: Client) => {
		if (!this.lobby) return;

		// Check if new enemy is null
		if (enemy === null) {
			console.log("SetEnemy was asked to set enemy to null! please use clearEnemy instead");
			return;
		}

		// Clear old enemy of phantoms
		if (this.enemyId) {
			this.removePhantomsFromEnemy();
		}

		// Set enemy
		this.enemyId = enemy.id
		this.lobby?.broadcastAction({
			action: "enemyInfo",

			playerId: this.id,
			enemyId: this.enemyId,
			handsLeft: this.handsLeft,
			score: this.score,
			skips: this.skips,
			lives: this.lives,
		});

		// Send all phantoms to the new enemy
		this.phantomKeys.forEach((key) => enemy.sendAction({ action: "sendPhantom", key }));
	}

	clearEnemy = () => {
		this.removePhantomsFromEnemy();

		this.enemyId = null;
		this.lobby?.broadcastAction({
			action: "enemyInfo",

			playerId: this.id,
			enemyId: "None",
			handsLeft: this.handsLeft,
			score: this.score,
			skips: this.skips,
			lives: this.lives,
		});
	}
}

export default Client
