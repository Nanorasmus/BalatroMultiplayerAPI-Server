import Client from "./Client.js"
import Deck from "./Deck/Deck.js"
import { InsaneInt } from "./InsaneInt.js"
import Lobby from "./Lobby.js"

class Team {
    public id: string
    public lobby: Lobby

    public players: Client[] = []
    public deck: Deck | null = null
    public handLevels: { [key: string]: number } = {}

    public score: InsaneInt = new InsaneInt(0, 0, 0)
    public lives: number = 4
    public skips: number = 0

    public inPVPBlind: boolean = false
    public enemyTeam: Team | null = null

	constructor(id: string, lobby: Lobby) {
		this.id = id
        this.lobby = lobby
	}

    addPlayer(client: Client) {
        if (client.team) {
            client.team.removePlayer(client);
        }

        client.team = this;
        this.players.push(client);

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
            this.lobby.removeTeam(this);
        }
    }

    setDeckType(back: string, sleeve: string, stake: string) {
        this.players.forEach(player => {
            player.sendAction({ action: "setDeckType", back, sleeve, stake });
        });
    }

    setDeck(deckStr: string) {
        if (this.deck != null) return;

        this.deck = new Deck(this, deckStr);

        this.broadcastDeck()
    }

    setEnemyTeam(team: Team) {
        if (this.enemyTeam) {
            this.enemyTeam.enemyTeam = null;
        }
        this.enemyTeam = team;

        if (this.enemyTeam) {
            this.enemyTeam.broadcastStatsToEnemies();
        }
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
        });
    }

    addScore(score: InsaneInt) {
        console.log("Adding score: " + score.toString() + " to team " + this.id + " score: " + this.score.toString());
        if (score.lessThan(new InsaneInt(0, 0, 0))) {
            this.resetScore();
        } else {
            this.score = this.score.add(score);

            if (this.score.lessThan(new InsaneInt(0, 0, 0))) {
                this.resetScore();
            }

            this.broadcastScore();

            if (!this.inPVPBlind) {
                this.players.forEach(player => {
                    player.sendAction({ action: "endBlind" });
                });
            };
        }
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

    loseLife() {
        if (this.lives <= 0) return;

        this.lives -= 1;

        // Set lives
        this.players.forEach(player => {
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
        if (this.lobby.isStarted && this.lives > 0 && this.players.every(player => player.isReady)) {
            // Reset team score
            this.resetScore();
            
            // Give everyone an updated deck
            this.deck?.applyPendingActions();

            this.players.forEach(player => {
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
        if (this.lives <= 0 || !this.enemyTeam) return true;
        let handsLeft = this.getHandsLeft();
        return handsLeft <= 0 || (!this.score.lessThan(this.enemyTeam.score) && this.enemyTeam.getHandsLeft() <= 0);   
    }

    getHandsLeft() {
        let handsLeft = 0;
        this.players.forEach(player => {
            handsLeft += player.handsLeft;
        });
        return handsLeft;
    }
    

    broadcastDeck() {
        if (this.deck == null) return;

        this.players.forEach(player => {
            player.sendAction({ action: "setDeck", deck: this.deck!.toString() });
        })
    }

    private broadcastScore() {
        this.players.forEach(player => {
            player.sendAction({
                action: 'setScore',
                score: this.score.toString()
            });
        });
        this.broadcastStatsToEnemies()
    }

    private broadcastStatsToEnemies() {
        this.enemyTeam?.players.forEach(enemy => {
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
