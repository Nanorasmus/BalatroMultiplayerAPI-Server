import { TeamBased } from "./BRModes/HouseBased/TeamBased/TeamBased.js"
import Client from "./Client.js"
import Deck from "./Deck/Deck.js"
import { InsaneInt } from "./InsaneInt.js"
import Lobby from "./Lobby.js"

class Team {
    public id: string
    public lobby: Lobby
    public BRMode: TeamBased

    public players: Client[] = []

    public deckBack: string | null = null
    public deckSleeve: string | null = null
    public deckStake: string | null = null

    public deck: Deck | null = null
    public handLevels: { [key: string]: number } = {}

    public score: InsaneInt = new InsaneInt(0, 0, 0)
    public lives: number = 4
    public skips: number = 0

    public lastBlindRequirement: InsaneInt = new InsaneInt(0, 0, 0)
    public inBlind: boolean = false
    public inPVPBlind: boolean = false
    public enemyTeam: Team | null = null

    public lostLifeToTimer: boolean = false

    deckChunks: string[] = []
    deckProvider: string | null = null

	constructor(id: string, lobby: Lobby, BRMode: TeamBased) {
		this.id = id
        this.lobby = lobby
        this.BRMode = BRMode
	}

    addPlayer(client: Client) {
        if (client.team) {
            client.team.removePlayer(client);
        }

        client.team = this;
        this.players.push(client);

        // Tell the new player the team's deck type if there is one
        if (this.deckBack && this.deckSleeve && this.deckStake)
            client.sendAction({ action: "setDeckType", back: this.deckBack, sleeve: this.deckSleeve, stake: this.deckStake });

        // Tell everyone the player's team
        this.lobby.broadcastAction({
            action: "setPlayerTeam",
            playerId: client.id,
            teamId: this.id
        });
    }

    removePlayer(client: Client) {
        client.team = null;
        this.players.splice(this.players.indexOf(client), 1);
        
        if (this.players.length === 0) {
            this.BRMode.removeTeam(this);
        }
    }

    setDeckType(back: string, sleeve: string, stake: string) {
        this.deckBack = back;
        this.deckSleeve = sleeve;
        this.deckStake = stake;

        this.players.forEach(player => {
            player.sendAction({ action: "setDeckType", back, sleeve, stake });
        });
    }

    setDeck(client: Client, deckStr: string) {
        if (this.deckChunks.length > 0 && this.deckProvider != client.id) return;

        this.deckProvider = client.id;
        this.deckChunks.push(deckStr);
    }

    setEnemyTeam(team: Team) {
        if (this.enemyTeam) {
            this.enemyTeam.enemyTeam = null;
        }
        this.enemyTeam = team;

        if (this.enemyTeam) {
            this.enemyTeam.broadcastStatsToEnemies();
        }

        this.players.forEach(player => {
            player.sendAction({
                action: "setPlayerTeam",
                playerId: "house",
                teamId: team.id
            });
        })
    }

    clearEnemyTeam() {
        if (this.enemyTeam) this.enemyTeam.enemyTeam = null;
        this.enemyTeam = null;

        
        this.players.forEach(player => {
            player.sendAction({
                action: 'enemyInfo',
                playerId: "house",
                score: new InsaneInt(0, 100, 0).toString(),
                handsLeft: 0,
                lives: 4,
                skips: 0
            });
            player.sendAction({
                action: "setPlayerTeam",
                playerId: "house",
                teamId: "GREY"
            })
        });
    }

    astroidEnemy() {
        this.enemyTeam?.players.forEach(player => {
            player.sendAction({ action: "asteroid" });
        });
    }

    addScore(score: InsaneInt, requiredChips: InsaneInt) {
        console.log("Adding score: " + score.toString() + " to team " + this.id + " score: " + this.score.toString());
        if (score.lessThan(new InsaneInt(0, 0, 0))) {
            this.resetScore();
        } else if (this.inBlind) {
            this.score = this.score.add(score);

            if (this.score.lessThan(new InsaneInt(0, 0, 0))) {
                this.resetScore();
            }

            this.lastBlindRequirement = requiredChips

            this.broadcastScore();

            this.checkDoneWithBlind();
        }
    }

    checkDoneWithBlind() {
        if (!this.inPVPBlind && ((!this.lastBlindRequirement.equalTo(new InsaneInt(0, 0, 0)) && !this.score.lessThan(this.lastBlindRequirement)) || this.getHandsLeft() <= 0)) {
            if (this.getHandsLeft() <= 0 && this.score.lessThan(this.lastBlindRequirement)) {
                this.loseLife();
            }
            
            this.endBlind();
        };
    }

    changeHandLevel(hand: string, amount: string) {
        if (!this.handLevels[hand]) this.handLevels[hand] = 1;

        this.handLevels[hand] += parseInt(amount);

        this.players.forEach(player => {
            player.sendAction({ action: "setHandLevel", hand, level: this.handLevels[hand] });
        })
    }

    resetScore() {
        this.score = new InsaneInt(0, 0, 0);

        this.broadcastScore();
    }

    resetStats() {
        this.lives = 4;
        this.skips = 0;
        this.deck = null;
        this.handLevels = {};
        this.enemyTeam = null;
    }

	skipBlind = (excludePlayerId?: string) => {
		if (this.lives > 0) {
			this.skips += 1;

            this.players.forEach(player => {
                if (excludePlayerId != player.id) {
                    player.sendAction({ action: "skipBlind" });
                }
            });

            this.broadcastScore();
		}
	}

    endBlind = () => {
        this.inBlind = false;
        this.inPVPBlind = false;
        this.score = new InsaneInt(0, 0, 0);
        this.players.forEach(player => {
            player.sendAction({ action: "endBlind" });
        });
    }

    loseLife() {
        if (this.lives <= 0) return;

        this.lives -= 1;

        // Set lives
        this.players.forEach(player => {
            if (player.lives <= 0 || !player.inMatch) return;
            player.sendAction({ action: "playerInfo", lives: this.lives });
        })

        // Broadcast players
        this.broadcastPlayers();
        
        // Check if team died
        if (this.lives <= 0) {
            this.players.forEach(player => {
                player.sendAction({ action: "loseGame" });

                this.enemyTeam?.players.forEach(enemy => {
                    player.sendEndGameJokersOfPlayer(enemy.id);
                })
            });

			this.lobby?.checkGameOver();
        }
    }

    checkAllReady() {
        // Ignore if no players are in the match
        if (this.players.every(player => !player.inMatch)) return;

        if (this.lobby.isStarted && this.lives > 0 && (this.deckChunks.length > 0 || this.deck) && this.players.every(player => player.isReady || !player.inMatch)) {
            // Reset team score
            this.resetScore();
            this.lostLifeToTimer = false;

            // Init deck from chunks if necessary
            if (!this.deck) {
                if (this.deckChunks.length == 0) {
                    setTimeout(() => this.checkAllReady(), 1000);
                    return;
                };

                this.deck = new Deck(this, this.deckChunks.join("|"));
                this.deckChunks = [];
            }
            
            // Give everyone an updated deck
            this.deck?.applyPendingActions();

            this.inBlind = true;

            this.players.forEach(player => {
                if (player.lives <= 0 || !player.inMatch) return;

                player.isReady = false;
                
                // Reset scores for next blind
                player.score = new InsaneInt(0, 0, 0);

                // Reset hands left for next blind
                player.handsLeft = 4;

                player.sendAction({ action: "startBlind" });
            });
        }
    }

    getAllDoneWithPVP() {
        if (this.lives <= 0 || !this.enemyTeam || this.players.every(player => !player.inMatch)) return true;
        let handsLeft = this.getHandsLeft();
        return handsLeft <= 0 || (!this.score.lessThan(this.enemyTeam.score) && this.enemyTeam.getHandsLeft() <= 0);   
    }

    getHandsLeft() {
        let handsLeft = 0;
        this.players.forEach(player => {
            if (player.lives <= 0 || !player.inMatch) return;
            handsLeft += player.handsLeft;
        });
        return handsLeft;
    }
    

    broadcastDeck() {
        if (this.deck == null) return;

        this.players.forEach(player => {
            if (player.lives <= 1 || !player.inMatch) return;

            player.sendAction({ action: "setDeck", deck: this.deck!.toString() });
        })
    }

    private broadcastScore() {
        this.players.forEach(player => {
            if (player.lives <= 0 || !player.inMatch) return;

            player.sendAction({
                action: 'setScore',
                score: this.score.toString()
            });
        });
        this.broadcastPlayers();
        this.broadcastStatsToEnemies()
    }

    private broadcastStatsToEnemies() {
        this.enemyTeam?.players.forEach(enemy => {
            if (enemy.lives <= 0 || !enemy.inMatch) return;

            enemy.sendAction({
                action: 'enemyInfo',
                playerId: "house",
                score: (this.score.lessThan(new InsaneInt(0, 100, 0)) ? new InsaneInt(0, 100, 0) : this.score).toString(),
                handsLeft: this.getHandsLeft(),
                lives: this.lives,
                skips: this.skips
            });
        });
    }

    private broadcastPlayers() {
        this.players.forEach(player => {
            this.lobby?.broadcastAction({
                action: "enemyInfo",

                playerId: player.id,
                handsLeft: player.handsLeft,
                score: this.score.toString(),
                skips: this.skips,
                lives: this.lives,
            });
        })
    }
}

export default Team
