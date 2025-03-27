import type Client from "./Client.js";
import GameModes from "./GameMode.js";
import Lobby, { getEnemy } from "./Lobby.js";
import type {
	ActionCreateLobby,
	ActionEatPizza,
	ActionHandlerArgs,
	ActionHandlers,
	ActionJoinLobby,
	ActionKickPlayer,
	ActionMagnet,
	ActionMagnetResponse,
	ActionPlayHand,
	ActionReceiveEndGameJokersRequest,
	ActionReceiveEndGameJokersResponse,
	ActionRemovePhantom,
	ActionSendPhantom,
	ActionSetAnte,
	ActionSetLocation,
	ActionSkip,
	ActionSpentLastShop,
	ActionSpentLastShopRequest,
	ActionStartAnteTimer,
	ActionUsername,
	ActionVersion,
} from "./actions.js";
import { generateSeed } from "./utils.js";

const usernameAction = (
	{ username, modHash }: ActionHandlerArgs<ActionUsername>,
	client: Client,
) => {
	client.setUsername(username);
	client.setModHash(modHash);
};

const createLobbyAction = (
	{ gameMode }: ActionHandlerArgs<ActionCreateLobby>,
	client: Client,
) => {
	/** Also sets the client lobby to this newly created one */
	new Lobby(client, gameMode);
};

const joinLobbyAction = (
	{ code }: ActionHandlerArgs<ActionJoinLobby>,
	client: Client,
) => {
	const newLobby = Lobby.get(code);
	if (!newLobby) {
		client.sendAction({
			action: "error",
			message: "Lobby does not exist.",
		});
		return;
	}
	newLobby.join(client);
};

const leaveLobbyAction = (client: Client) => {
	client.lobby?.removePlayerFromGame(client);
};

const returnToLobbyAction = (client: Client) => {
	client.lobby?.removePlayerFromGame(client, false);
}

const kickPlayerAction = (
	{ playerId }: ActionHandlerArgs<ActionKickPlayer>,
	client: Client
) => {
	if (!client.lobby || !client.lobby.isHost(client)) return;

	const player = client.lobby.getPlayer(playerId);
	if (!player) return;

	client.lobby?.removePlayerFromGame(player);
	player.sendAction({
		action: "kickedFromLobby"
	})
}

const lobbyInfoAction = (client: Client) => {
	client.lobby?.broadcastLobbyInfo();
};

const keepAliveAction = (client: Client) => {
	// Send an ack back to the received keepAlive
	client.sendAction({ action: "keepAliveAck" });
};

const startGameAction = (client: Client) => {
	const lobby = client.lobby;
	// Only allow the host to start the game
	if (!lobby || !lobby.isHost(client)) {
		return;
	}
	console.log("Starting game...");

	const lives = lobby.options.starting_lives
		? Number.parseInt(lobby.options.starting_lives)
		: GameModes[lobby.gameMode].startingLives;
	

	lobby.broadcastAction({
		action: "startGame",
		deck: "c_multiplayer_1",
		seed: lobby.options.different_seeds ? undefined : generateSeed(),
	});
	// Reset players' lives
	lobby.setPlayersLives(lives);

	// Roll for who is whose nemesis
	lobby.rerollEnemies();
	
	// Set the game as started
	lobby.isStarted = true;
	lobby.broadcastLobbyInfo();
};

const readyBlindAction = (client: Client) => {
	client.isReady = true

	const [lobby, enemy] = getEnemy(client)

	if (!client.firstReady && !enemy?.isReady && !enemy?.firstReady) {
		client.firstReady = true
		client.sendAction({ action: "speedrun" })
	}

	// Check if PVP blind should start
	client.lobby?.checkAllReady();
};

const unreadyBlindAction = (client: Client) => {
	client.isReady = false;
};

const playHandAction = (
	{ handsLeft, score }: ActionHandlerArgs<ActionPlayHand>,
	client: Client,
) => {
	const [lobby, enemy] = getEnemy(client)

	if (lobby === null || lobby.players.length < 2) {
		stopGameAction(client);
		return
	}

	client.score = BigInt(String(score));

	client.handsLeft =
		typeof handsLeft === "number" ? handsLeft : Number(handsLeft);

	if (!client.inPVPBattle) return;
	
	if (enemy == null) {
		// Let them play 1 hand against noone
		client.firstReady = false
		client.inPVPBattle = false

		client.sendAction({ action: "message", locKey: "msg_no_enemy" });
		client.sendAction({ action: "endPvP", lost: false });
	} else {
		// Actual PVP
		client.lobby?.broadcastAction({
			action: "enemyInfo",

			playerId: client.id,
			handsLeft,
			score: client.score,
			skips: client.skips,
			lives: client.lives,
		});
	
		// This info is only sent on a boss blind, so it shouldn't
		// affect other blinds
		if (
			(client.handsLeft === 0 && enemy.score > client.score) ||
			(enemy.handsLeft === 0 && client.score > enemy.score) ||
			(enemy.handsLeft === 0 && client.handsLeft === 0)
		) {
			const roundWinner =
				enemy.score > client.score ? enemy : client;
			const roundLoser =
				roundWinner.id === client.id ? enemy : client;
	
			if (roundWinner.score !== roundLoser.score) {
				roundLoser.loseLife();
			}
	
			roundWinner.firstReady = false;
			roundWinner.inPVPBattle = false;
			roundWinner.clearEnemy();

			roundLoser.firstReady = false;
			roundLoser.inPVPBattle = false;
			roundLoser.clearEnemy();
			
			roundWinner.sendAction({ action: "endPvP", lost: false });
			roundLoser.sendAction({ action: "endPvP", lost: roundWinner.score !== roundLoser.score });
			
		}
	}
	
	client.lobby?.checkRerollEnemies();
};

const stopGameAction = (client: Client) => {
	if (!client.lobby) {
		return;
	}
	client.sendAction({ action: "stopGame" });
};

// Deprecated
const gameInfoAction = (client: Client) => {
	client.lobby?.sendGameInfo(client);
};

const lobbyOptionsAction = (
	options: Record<string, string>,
	client: Client,
) => {
	client.lobby?.setOptions(options);
};

const failRoundAction = (client: Client) => {
	const lobby = client.lobby;

	if (!lobby) return;

	if (lobby.options.death_on_round_loss) {
		client.loseLife()
	}
};

const setAnteAction = (
	{ ante }: ActionHandlerArgs<ActionSetAnte>,
	client: Client,
) => {
	client.ante = ante;
};

// TODO: Fix this
const serverVersion = "0.2.0-MULTIPLAYER";
/** Verifies the client version and allows connection if it matches the server's */
const versionAction = (
	{ version }: ActionHandlerArgs<ActionVersion>,
	client: Client,
) => {
	const versionMatch = version.match(/^(\d+\.\d+\.\d+)/);
	if (versionMatch) {
		const clientVersion = versionMatch[1];
		const serverVersionNumber = serverVersion.split('-')[0];

		const [clientMajor, clientMinor, clientPatch] = clientVersion.split('.').map(Number);
		const [serverMajor, serverMinor, serverPatch] = serverVersionNumber.split('.').map(Number);

		if (clientMajor < serverMajor ||
			(clientMajor === serverMajor && clientMinor < serverMinor) ||
			(clientMajor === serverMajor && clientMinor === serverMinor && clientPatch < serverPatch)) {
			client.sendAction({
				action: "error",
				message: `[WARN] Server expecting version ${serverVersion}`
			});
		}
	}
};

const setLocationAction = ({ location }: ActionHandlerArgs<ActionSetLocation>, client: Client) => {
	client.setLocation(location);
}

const newRoundAction = (client: Client) => {
	client.resetBlocker()
}

const skipAction = ({ skips }: ActionHandlerArgs<ActionSkip>, client: Client) => {
	client.setSkips(skips)
	if (!client.lobby) return;
	client.sendInfoToLobby();
}

const sendPhantomAction = ({ key }: ActionHandlerArgs<ActionSendPhantom>, client: Client) => {
	const [lobby, enemy] = getEnemy(client)
	if (!lobby || !enemy) return;
	client.phantomKeys.push(key);
	enemy.sendAction({
		action: "sendPhantom",
		key
	});
}

const removePhantomAction = ({ key }: ActionHandlerArgs<ActionRemovePhantom>, client: Client) => {
	const [lobby, enemy] = getEnemy(client)
	if (!lobby || !enemy) return;
	client.phantomKeys.splice(client.phantomKeys.indexOf(key), 1);
	enemy.sendAction({
		action: "removePhantom",
		key
	});
}

const asteroidAction = (client: Client) => {
	const [lobby, enemy] = getEnemy(client)
	if (!lobby || !enemy) return;
	enemy.sendAction({
		action: "asteroid"
	});
}

const letsGoGamblingNemesisAction = (client: Client) => {
	const [lobby, enemy] = getEnemy(client)
	if (!lobby || !enemy) return;
	enemy.sendAction({
		action: "letsGoGamblingNemesis"
	});
}

const eatPizzaAction = ({ whole }: ActionHandlerArgs<ActionEatPizza>, client: Client) => {
	const [lobby, enemy] = getEnemy(client)
	if (!lobby || !enemy) return;
	enemy.sendAction({
		action: "eatPizza",
		whole
	})
}

const soldJokerAction = (client: Client) => {
	const [lobby, enemy] = getEnemy(client)
	if (!lobby || !enemy) return;
	enemy.sendAction({
		action: "soldJoker"
	})
}

const spentLastShopAction = ({ amount }: ActionHandlerArgs<ActionSpentLastShopRequest>, client: Client) => {
	if (!client.lobby) return;
	client.lobby.broadcastAction({
		action: "spentLastShop",
		playerId: client.id,
		amount
	})
}

const magnetAction = (client: Client) => {
	const [lobby, enemy] = getEnemy(client)
	if (!lobby || !enemy) return;
	enemy.sendAction({
		action: "magnet"
	})
}

const magnetResponseAction = ({ key }: ActionHandlerArgs<ActionMagnetResponse>, client: Client) => {
	const [lobby, enemy] = getEnemy(client)
	if (!lobby || !enemy) return;
	enemy.sendAction({
		action: "magnetResponse",
		key
	})
}

const receiveEndGameJokersAction = ({ recieverId, keys }: ActionHandlerArgs<ActionReceiveEndGameJokersResponse>, client: Client) => {
	const lobby = client.lobby;
	const reciever = lobby?.getPlayer(recieverId);
	if (!lobby || !reciever) return;
	reciever.sendAction({
		action: "receiveEndGameJokers",
		keys
	})
}

const startAnteTimerAction = ({ time }: ActionHandlerArgs<ActionStartAnteTimer>, client: Client) => {
	if (!client.lobby) return;
	client.lobby.broadcastAction({
		action: "startAnteTimer",
		time
	})
}

const failTimerAction = (client: Client) => {
	const lobby = client.lobby;

	client.loseLife();
}

export const actionHandlers = {
	username: usernameAction,
	createLobby: createLobbyAction,
	joinLobby: joinLobbyAction,
	lobbyInfo: lobbyInfoAction,
	leaveLobby: leaveLobbyAction,
	returnToLobby: returnToLobbyAction,
	kickPlayer: kickPlayerAction,
	keepAlive: keepAliveAction,
	startGame: startGameAction,
	readyBlind: readyBlindAction,
	unreadyBlind: unreadyBlindAction,
	playHand: playHandAction,
	stopGame: stopGameAction,
	gameInfo: gameInfoAction,
	lobbyOptions: lobbyOptionsAction,
	failRound: failRoundAction,
	setAnte: setAnteAction,
	version: versionAction,
	setLocation: setLocationAction,
	newRound: newRoundAction,
	skip: skipAction,
	sendPhantom: sendPhantomAction,
	removePhantom: removePhantomAction,
	asteroid: asteroidAction,
	letsGoGamblingNemesis: letsGoGamblingNemesisAction,
	eatPizza: eatPizzaAction,
	soldJoker: soldJokerAction,
	spentLastShop: spentLastShopAction,
	magnet: magnetAction,
	magnetResponse: magnetResponseAction,
	receiveEndGameJokers: receiveEndGameJokersAction,
	startAnteTimer: startAnteTimerAction,
	failTimer: failTimerAction,
} satisfies Partial<ActionHandlers>;
