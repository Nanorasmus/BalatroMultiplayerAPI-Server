// Server to Client
export type ActionConnected = { action: 'connected' }
export type ActionError = { action: 'error'; message: string }
export type ActionMessage = { action: 'message'; locKey: string }
export type ActionJoinedLobby = { action: 'joinedLobby'; code: string; type: GameMode }
export type ActionLobbyInfo = {
	action: 'lobbyInfo'
	playerId: string
	players: string
	isStarted: boolean
}
export type ActionKickedFromLobby = { action: 'kickedFromLobby' }
export type ActionStopGame = { action: 'stopGame' }
export type ActionStartGame = {
	action: 'startGame'
	deck: string
	stake?: number
	seed?: string
}
export type ActionStartBlind = { action: 'startBlind' }
export type ActionWinGame = { action: 'winGame' }
export type ActionLoseGame = { action: 'loseGame' }
export type ActionGameInfo = {
	action: 'gameInfo'
	small?: string
	big?: string
	boss?: string
}
export type ActionPlayerInfo = { action: 'playerInfo'; lives: number }
export type ActionEnemyInfo = {
	action: 'enemyInfo'
	playerId: string
	enemyId?: string
	score: string // Score is string to give control over the format it is sent in
	handsLeft: number
	skips: number
	lives: number
}
export type ActionSetPlayerTeam = { action: 'setPlayerTeam'; playerId: string; teamId: string }
export type ActionEndPvP = { action: 'endPvP'; lost: boolean }
export type ActionLobbyOptions = { action: 'lobbyOptions', gamemode: string }
export type ActionSetDeckType = { action: 'setDeckType'; back: string, sleeve: string, stake: string }
export type ActionSetDeck = { action: 'setDeck'; deck: string }
export type ActionSetHandLevel = { action: 'setHandLevel'; hand: string; level: number }
export type ActionRequestVersion = { action: 'version' }
export type ActionEnemyLocation = { action: 'enemyLocation'; playerId: string; location: string }
export type ActionSendPhantom = { action: 'sendPhantom', key: string }
export type ActionRemovePhantom = { action: 'removePhantom', key: string }
export type ActionSpeedrun = { action: 'speedrun' }
export type ActionAsteroid = { action: 'asteroid' }
export type ActionLetsGoGamblingNemesis = { action: 'letsGoGamblingNemesis' }
export type ActionEatPizza = { action: 'eatPizza', whole: boolean }
export type ActionSoldJoker = { action: 'soldJoker' }
export type ActionSpentLastShop = { action: 'spentLastShop', playerId: string, amount: number }
export type ActionMagnet = { action: 'magnet' }
export type ActionMagnetResponse = { action: 'magnetResponse', key: string }
export type ActionGetEndGameJokersRequest = { action: 'getEndGameJokers', recieverId: string }
export type ActionReceiveEndGameJokersRequest = { action: 'receiveEndGameJokers', keys: string }
export type ActionStartAnteTimer = { action: 'startAnteTimer', time: number }
export type ActionSetScore = { action: 'setScore', score: string }
export type ActionGiveMoney = { action: 'giveMoney', amount: number }
export type ActionSkipBlind = { action: 'skipBlind' }
export type ActionEndBlind = { action: 'endBlind' }

export type ActionServerToClient =
	| ActionConnected
	| ActionError
	| ActionMessage
	| ActionJoinedLobby
	| ActionLobbyInfo
	| ActionKickedFromLobby
	| ActionStopGame
	| ActionStartGame
	| ActionStartBlind
	| ActionWinGame
	| ActionLoseGame
	| ActionGameInfo
	| ActionPlayerInfo
	| ActionEnemyInfo
	| ActionSetPlayerTeam
	| ActionEndPvP
	| ActionLobbyOptions
	| ActionSetDeckType
	| ActionSetDeck
	| ActionSetHandLevel 
	| ActionRequestVersion
	| ActionUtility
	| ActionEnemyLocation
	| ActionSendPhantom
	| ActionRemovePhantom
	| ActionSpeedrun
	| ActionAsteroid
	| ActionLetsGoGamblingNemesis
	| ActionEatPizza
	| ActionSoldJoker
	| ActionSpentLastShop
	| ActionMagnet
	| ActionMagnetResponse
	| ActionGetEndGameJokersRequest
	| ActionReceiveEndGameJokersRequest
	| ActionStartAnteTimer
	| ActionSetScore
	| ActionGiveMoney
	| ActionSkipBlind
	| ActionEndBlind


// Client to Server
export type ActionUsername = { action: 'username'; username: string; modHash: string }
export type ActionCreateLobby = { action: 'createLobby'; gameMode: GameMode }
export type ActionJoinLobby = { action: 'joinLobby'; code: string }
export type ActionLeaveLobby = { action: 'leaveLobby' }
export type ActionReturnToLobby = { action: 'returnToLobby' }
export type ActionKickPlayer = { action: 'kickPlayer'; playerId: string }
export type ActionSendMoneyToPlayer = { action: 'sendMoneyToPlayer'; playerId: string; amount: number }
export type ActionLobbyInfoRequest = { action: 'lobbyInfo' }
export type ActionStopGameRequest = { action: 'stopGame' }
export type ActionStartGameRequest = { action: 'startGame' }
export type ActionSetTeamRequest = { action: 'setTeam'; teamId: string }
export type ActionReadyBlind = { action: 'readyBlind', isPVP: string }
export type ActionUnreadyBlind = { action: 'unreadyBlind' }
export type ActionPlayHand = {
	action: 'playHand'
	score: string
	scoreDelta: string
	handsLeft: number
	hasSpeedrun: boolean
}
export type ActionGameInfoRequest = { action: 'gameInfo' }
export type ActionPlayerInfoRequest = { action: 'playerInfo' }
export type ActionEnemyInfoRequest = { action: 'enemyInfo' }
export type ActionSendDeckType = { action: 'sendDeckType'; back: string, sleeve: string, stake: string }
export type ActionSendDeck = { action: 'sendDeck'; deck: string }
export type ActionSetCardSuit = { action: 'setCardSuit'; card: string; suit: string }
export type ActionSetCardRank = { action: 'setCardRank'; card: string; rank: string }
export type ActionSetCardEnhancement = { action: 'setCardEnhancement'; card: string; enhancement: string }
export type ActionSetCardEdition = { action: 'setCardEdition'; card: string; edition: string }
export type ActionSetCardSeal = { action: 'setCardSeal'; card: string; seal: string }
export type ActionAddCard = { action: 'addCard'; card: string }
export type ActionRemoveCard = { action: 'removeCard'; card: string }
export type ActionChangeHandLevel = { action: 'changeHandLevel'; hand: string; amount: string }

export type ActionFailRound = { action: 'failRound' }
export type ActionSetAnte = {
	action: 'setAnte'
	ante: number
}
export type ActionVersion = { action: 'version'; version: string }
export type ActionSetLocation = { action: 'setLocation'; location: string }
export type ActionNewRound = { action: 'newRound' }
export type ActionSkip = { action: 'skip', skips: number }
export type ActionLetsGoGamblingNemesisRequest = { action: 'letsGoGamblingNemesis' }
export type ActionEatPizzaRequest = { action: 'eatPizza', whole: boolean }
export type ActionSoldJokerRequest = { action: 'soldJoker' }
export type ActionSpentLastShopRequest = { action: 'spentLastShop', amount: number }
export type ActionMagnetRequest = { action: 'magnet' }
export type ActionMagnetResponseRequest = { action: 'magnetResponse', key: string }
export type ActionReceiveEndGameJokersResponse = { action: 'receiveEndGameJokers', recieverId: string, keys: string }
export type ActionStartAnteTimerRequest = { action: 'startAnteTimer', time: number }
export type ActionFailTimer = { action: 'failTimer' }
export type ActionClientToServer =
	| ActionUsername
	| ActionCreateLobby
	| ActionJoinLobby
	| ActionLeaveLobby
	| ActionReturnToLobby
	| ActionKickPlayer
	| ActionSendMoneyToPlayer
	| ActionLobbyInfoRequest
	| ActionStopGameRequest
	| ActionStartGameRequest
	| ActionSetTeamRequest
	| ActionReadyBlind
	| ActionPlayHand
	| ActionGameInfoRequest
	| ActionPlayerInfoRequest
	| ActionEnemyInfoRequest
	| ActionUnreadyBlind
	| ActionLobbyOptions
	| ActionSendDeckType
	| ActionSendDeck
	| ActionSetCardSuit
	| ActionSetCardRank
	| ActionSetCardEnhancement
	| ActionSetCardEdition
	| ActionSetCardSeal
	| ActionAddCard
	| ActionRemoveCard
	| ActionChangeHandLevel
	| ActionFailRound
	| ActionSetAnte
	| ActionVersion
	| ActionSetLocation
	| ActionNewRound
	| ActionSkip
	| ActionSendPhantom
	| ActionRemovePhantom
	| ActionAsteroid
	| ActionLetsGoGamblingNemesisRequest
	| ActionEatPizzaRequest
	| ActionSoldJokerRequest
	| ActionSpentLastShopRequest
	| ActionMagnetRequest
	| ActionMagnetResponseRequest
	| ActionReceiveEndGameJokersResponse
	| ActionStartAnteTimerRequest
	| ActionFailTimer
// Utility actions
export type ActionKeepAlive = { action: 'keepAlive' }
export type ActionKeepAliveAck = { action: 'keepAliveAck' }

export type ActionUtility = ActionKeepAlive | ActionKeepAliveAck

export type Action = ActionServerToClient | ActionClientToServer | ActionUtility

type HandledActions = ActionClientToServer | ActionUtility
export type ActionHandlers = {
	[K in HandledActions['action']]: keyof ActionHandlerArgs<
		Extract<HandledActions, { action: K }>
	> extends never
	? (
		// biome-ignore lint/suspicious/noExplicitAny: Function can receive any arguments
		...args: any[]
	) => void
	: (
		action: ActionHandlerArgs<Extract<HandledActions, { action: K }>>,
		// biome-ignore lint/suspicious/noExplicitAny: Function can receive any arguments
		...args: any[]
	) => void
}

export type ActionHandlerArgs<T extends HandledActions> = Omit<T, 'action'>

// Other types
export type GameMode = 'attrition' | 'showdown'
export type BRMode = 'nemesis' | 'potluck'