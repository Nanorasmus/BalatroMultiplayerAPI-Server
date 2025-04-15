import type Client from "./objects/Client.js";
import GameModes from "./GameMode.js";
import { InsaneInt } from "./objects/InsaneInt.js";
import Lobby, { getEnemy } from "./objects/Lobby.js";
import type {
	ActionAddCard,
	ActionChangeHandLevel,
	ActionCreateLobby,
	ActionEatPizza,
	ActionHandlerArgs,
	ActionHandlers,
	ActionJoinLobby,
	ActionKickPlayer,
	ActionMagnet,
	ActionMagnetResponse,
	ActionPlayHand,
	ActionReadyBlind,
	ActionReceiveEndGameJokersRequest,
	ActionReceiveEndGameJokersResponse,
	ActionRemoveCard,
	ActionRemovePhantom,
	ActionSendDeck,
	ActionSendDeckType,
	ActionSendMoneyToPlayer,
	ActionSendPhantom,
	ActionSetAnte,
	ActionSetCardEdition,
	ActionSetCardEnhancement,
	ActionSetCardRank,
	ActionSetCardSeal,
	ActionSetCardSuit,
	ActionSetLocation,
	ActionSetTeamRequest,
	ActionSkip,
	ActionSpentLastShop,
	ActionSpentLastShopRequest,
	ActionStartAnteTimer,
	ActionUsername,
	ActionVersion,
} from "./actions.js";
import { generateSeed } from "./utils.js";
import { TeamBased } from "./objects/BRModes/HouseBased/TeamBased/TeamBased.js";
import { BRModeHivemind } from "./objects/BRModes/HouseBased/TeamBased/BRModeHivemind.js";
import { BRModeDisabled } from "./objects/BRModes/Base/BRModeDisabled.js";
import { BRModeNemesis } from "./objects/BRModes/Base/BRModeNemesis.js";

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

const sendMoneyToPlayerAction = (
	{ playerId, amount }: ActionHandlerArgs<ActionSendMoneyToPlayer>,
	client: Client
) => {
	if (!client.lobby) return;
	const player = client.lobby.getPlayer(playerId);
	if (!player) return;
	player.sendAction({ action: "giveMoney", amount });
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
	if (!lobby || !lobby.isHost(client) || lobby.isStarted || !lobby.brMode) {
		return;
	}

	if (lobby.brMode instanceof TeamBased && lobby.brMode.teams.length < lobby.brMode.minTeamCount) {
		client.sendAction({ action: "error", message: "Not enough teams have players" });
		return;
	}

	console.log("Starting game...");

	lobby.brMode.startGame();
};

const setTeamAction = (
	{ teamId }: ActionHandlerArgs<ActionSetTeamRequest>,
	client: Client,
) => {
	if (client.lobby?.brMode instanceof TeamBased) {
		client.lobby?.brMode.setPlayerTeam(client, teamId);
	}
};

const readyBlindAction = (
	{ isPVP }: ActionHandlerArgs<ActionReadyBlind>,
	client: Client
) => {
	if (!client.lobby || !client.lobby.isStarted) return
	if (isPVP == undefined || isPVP == "true" || isPVP.toString() == "true") {
		client.isReadyPVP = true
	} else {
		client.isReady = true
	}

	const [lobby, enemy] = getEnemy(client)

	if (!client.firstReady && !enemy?.isReadyPVP && !enemy?.firstReady) {
		client.firstReady = true
		client.sendAction({ action: "speedrun" })
	}

	// Check if PVP blind should start
	client.lobby?.brMode.checkAllReady();
};

const unreadyBlindAction = (client: Client) => {
	client.isReady = false;
	client.isReadyPVP = false;
};

const playHandAction = (
	{ handsLeft, score, scoreDelta, blindChips }: ActionHandlerArgs<ActionPlayHand>,
	client: Client,
) => {
	const [lobby, enemy] = getEnemy(client)

	if (lobby === null || lobby.players.length < 2) {
		stopGameAction(client);
		return
	}

	client.score = InsaneInt.fromString(score);

	client.handsLeft =
		typeof handsLeft === "number" ? handsLeft : Number(handsLeft);
	
	client.lobby?.broadcastAction({
		action: "enemyInfo",

		playerId: client.id,
		handsLeft,
		score: client.score.toString(),
		skips: client.skips,
		lives: client.lives,
	});

	if (!client.inPVPBattle) {
		if (lobby.options["nano_br_mode"] == "hivemind") {
			client.team?.addScore(
				InsaneInt.fromString((typeof scoreDelta === "string" && scoreDelta.indexOf("e") != -1) ? scoreDelta : `${scoreDelta}e0`),
				InsaneInt.fromString((typeof blindChips === "string" && blindChips.indexOf("e") != -1) ? blindChips : `${blindChips}e0`)
			);
		}
		return;
	}
	
	if (lobby.options["nano_br_mode"] == "nemesis" && enemy == null) {
		// Let them play 1 hand against noone
		client.firstReady = false
		client.inPVPBattle = false

		client.sendAction({ action: "message", locKey: "msg_no_enemy" });
		client.sendAction({ action: "endPvP", lost: false });
	} else {
		// Actual PVP
	
		// This info is only sent on a boss blind, so it shouldn't
		// affect other blinds
		if (!lobby.options["nano_br_mode"] || lobby.options["nano_br_mode"] == "nemesis") {
			// Nemesis
			if (
				enemy != null && (
				(client.handsLeft === 0 && enemy.score.greaterThan(client.score)) ||
				(enemy.handsLeft === 0 && client.score.greaterThan(enemy.score)) ||
				(enemy.handsLeft === 0 && client.handsLeft === 0))
			) {
				const roundWinner =
					enemy.score.greaterThan(client.score) ? enemy : client;
				const roundLoser =
					roundWinner.id === client.id ? enemy : client;
		
				if (!roundWinner.score.equalTo(roundLoser.score)) {
					roundLoser.loseLife();
				}
		
				roundWinner.firstReady = false;
				roundWinner.inPVPBattle = false;
				roundWinner.clearEnemy();
	
				roundLoser.firstReady = false;
				roundLoser.inPVPBattle = false;
				roundLoser.clearEnemy();
				
				roundWinner.sendAction({ action: "endPvP", lost: false });
				roundLoser.sendAction({ action: "endPvP", lost: !roundWinner.score.equalTo(roundLoser.score) });
				
			}
		} else if (!(lobby.brMode instanceof BRModeDisabled || lobby.brMode instanceof BRModeNemesis)) {
			
			if (lobby.brMode instanceof TeamBased) {
				client.team?.addScore(
					InsaneInt.fromString((typeof scoreDelta === "string" && scoreDelta.indexOf("e") != -1) ? scoreDelta : `${scoreDelta}e0`),
					InsaneInt.fromString((typeof blindChips === "string" && blindChips.indexOf("e") != -1) ? blindChips : `${blindChips}e0`)
				);
			}

			console.log("Played a hand in potluck")
			lobby.brMode.recalculateScoreToBeat()
			lobby.brMode.checkPVPDone()
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

const lobbyOptionsAction = (
	options: Record<string, string>,
	client: Client,
) => {
	client.lobby?.setOptions(options);
};

const sendDeckTypeAction = (
	{ back, sleeve, stake }: ActionHandlerArgs<ActionSendDeckType>,
	client: Client,
) => {
	if (!client.lobby || client.lobby.options["nano_br_mode"] != "hivemind" || !client.team) {
		return;
	}

	client.team.setDeckType(back, sleeve, stake);
}

const sendDeckAction = (
	{ deck }: ActionHandlerArgs<ActionSendDeck>,
	client: Client,
) => {
	if (!client.lobby || client.lobby.options["nano_br_mode"] != "hivemind" || !client.team) {
		return;
	}

	client.team.setDeck(client, deck);
}

const setCardSuitAction = (
	{ card, suit }: ActionHandlerArgs<ActionSetCardSuit>,
	client: Client,
) => {
	if (!client.lobby || client.lobby.options["nano_br_mode"] != "hivemind" || !client.team || !client.inMatch) {
		return;
	}
	
	client.team?.deck?.setSuit(card, suit)
}

const setCardRankAction = (
	{ card, rank }: ActionHandlerArgs<ActionSetCardRank>,
	client: Client,
) => {
	if (!client.lobby || client.lobby.options["nano_br_mode"] != "hivemind" || !client.team || !client.inMatch) {
		return;
	}
	
	client.team?.deck?.setRank(card, rank)
}

const setCardEnhancementAction = (
	{ card, enhancement }: ActionHandlerArgs<ActionSetCardEnhancement>,
	client: Client,
) => {
	if (!client.lobby || client.lobby.options["nano_br_mode"] != "hivemind" || !client.team || !client.inMatch) {
		return;
	}
	
	client.team?.deck?.setEnhancement(card, enhancement)
}

const setCardEditionAction = (
	{ card, edition }: ActionHandlerArgs<ActionSetCardEdition>,
	client: Client,
) => {
	if (!client.lobby || client.lobby.options["nano_br_mode"] != "hivemind" || !client.team || !client.inMatch) {
		return;
	}
	
	client.team?.deck?.setEdition(card, edition)
}

const setCardSealAction = (
	{ card, seal }: ActionHandlerArgs<ActionSetCardSeal>,
	client: Client,
) => {
	if (!client.lobby || client.lobby.options["nano_br_mode"] != "hivemind" || !client.team || !client.inMatch) {
		return;
	}
	
	client.team?.deck?.setSeal(card, seal)
}

const addCardAction = (
	{ card }: ActionHandlerArgs<ActionAddCard>,
	client: Client,
) => {
	if (!client.lobby || client.lobby.options["nano_br_mode"] != "hivemind" || !client.team || !client.inMatch) {
		return;
	}
	
	client.team?.deck?.addCard(card)
}

const removeCardAction = (
	{ card }: ActionHandlerArgs<ActionRemoveCard>,
	client: Client,
) => {
	if (!client.lobby || client.lobby.options["nano_br_mode"] != "hivemind" || !client.team || !client.inMatch) {
		return;
	}
	
	client.team?.deck?.removeCard(card)	
}

const changeHandLevelAction = (
	{ hand, amount }: ActionHandlerArgs<ActionChangeHandLevel>,
	client: Client,
) => {
	if (!client.lobby || client.lobby.options["nano_br_mode"] != "hivemind" || !client.team || !client.inMatch) {
		return;
	}
	
	client.team.changeHandLevel(hand, amount)
}

const failRoundAction = (client: Client) => {
	const lobby = client.lobby;

	if (!lobby) return;

	if (lobby.options.death_on_round_loss) {
		if (lobby.options["nano_br_mode"] == "hivemind") {
			client.team?.loseLife();
		} else {
			client.loseLife()
		}
	}
};

const setAnteAction = (
	{ ante }: ActionHandlerArgs<ActionSetAnte>,
	client: Client,
) => {
	client.ante = ante;
};

const serverVersion = "1.0.4";
/** Verifies the client version and allows connection if it matches the server's */
const versionAction = (
	{ version }: ActionHandlerArgs<ActionVersion>,
	client: Client,
) => {
	const versionMatch = version.match(/(\d+\.\d+\.\d+)/);
	if (versionMatch) {
		const clientVersion = versionMatch[0];
		const serverVersionNumber = serverVersion.split('~')[0];

		const [clientMajor, clientMinor, clientPatch] = clientVersion.split('.').map(Number);
		const [serverMajor, serverMinor, serverPatch] = serverVersionNumber.split('.').map(Number);

		if (clientMajor < serverMajor ||
			(clientMajor === serverMajor && clientMinor < serverMinor) ||
			(clientMajor === serverMajor && clientMinor === serverMinor && clientPatch < serverPatch)) {
			client.sendAction({
				action: "error",
				message: `Server expecting version ${serverVersion}. Please update your mod!`,
			});
		} else if (clientMajor > serverMajor ||
			(clientMajor === serverMajor && clientMinor > serverMinor) ||
			(clientMajor === serverMajor && clientMinor === serverMinor && clientPatch > serverPatch)) {
			client.sendAction({
				action: "error",
				message: `How the heck are you using a newer version than the server?!`,
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

	if (client.lobby.options["nano_br_mode"] == "hivemind" && client.team) {
		client.team.skipBlind(client.id);
	}
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
	if (!lobby) return;

	if (!enemy) {
		if (lobby.options["nano_br_mode"] == "hivemind" && client.team) {
			client.team.astroidEnemy();
		}
		return;
	}

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
	sendMoneyToPlayer: sendMoneyToPlayerAction,
	kickPlayer: kickPlayerAction,
	keepAlive: keepAliveAction,
	startGame: startGameAction,
	setTeam: setTeamAction,
	readyBlind: readyBlindAction,
	unreadyBlind: unreadyBlindAction,
	playHand: playHandAction,
	stopGame: stopGameAction,
	lobbyOptions: lobbyOptionsAction,
	sendDeckType: sendDeckTypeAction,
	sendDeck: sendDeckAction,
	setCardSuit: setCardSuitAction,
	setCardRank: setCardRankAction,
	setCardEnhancement: setCardEnhancementAction,
	setCardEdition: setCardEditionAction,
	setCardSeal: setCardSealAction,
	addCard: addCardAction,
	removeCard: removeCardAction,
	changeHandLevel: changeHandLevelAction,
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

