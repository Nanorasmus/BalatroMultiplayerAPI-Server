import { randomInt } from "../../../../utils.js";
import Client from "../../../Client.js";
import { InsaneInt } from "../../../InsaneInt.js";
import Lobby from "../../../Lobby.js";
import Team from "../../../Team.js";
import { HouseBased } from "../HouseBased.js";


// The base of all BR modes that are team based
export class TeamBased extends HouseBased {
	public minTeamCount: number = 2
	public maxTeamCount: number = 4
	public minTeamMemberCount: number = 1

	public teams: Team[] = [];

	constructor(lobby: Lobby) {
		super(lobby);

		this.teams = [new Team("RED", this.lobby, this)];

		lobby.players.forEach((player) => {
			this.teams[0].addPlayer(player);
		})
	}

	public override startGame() {
		super.startGame();

		// Set team lives
		this.teams.forEach((team) => team.lives = this.livesOption);
	}

	public override onJoinLobby(client: Client): void {
		
		this.setPlayerTeam(client, "RED");

		// Tell new client what team everyone is on
		this.lobby.players.forEach(player => {
			if (player.team) {
				client.sendAction({ action: "setPlayerTeam", playerId: player.id, teamId: player.team.id });
			}
		});
	}

	public override onLeaveLobby(client: Client, leftFully: boolean): void {
		client.team?.checkDoneWithBlind();
	}

    public override checkAllReady(): void {
        super.checkAllReady();
        
        this.teams.forEach((team) => team.checkAllReady());
    }
	
    public override startPVPBlind() {
		this.teams.forEach((team) => {
			if (team.deck?.syncPending) team.broadcastDeck();
		});

		super.startPVPBlind();
		
		this.teams.forEach((team) => {
			team.resetScore();
			team.inBlind = true;
			team.inPVPBlind = true;
		});
	}

	public setPlayerTeam = (client: Client, teamId: string) => {
		for (const team of this.teams) {
			if (team.id == teamId) {
				team.addPlayer(client);
				return;
			}
		}

		// If team was not found
		let team: Team = new Team(teamId, this.lobby, this);
		this.teams.push(team);
		team.addPlayer(client);
	};

	public removeTeam = (team: Team) => {
		this.teams.splice(this.teams.indexOf(team), 1);
	};

    public override rerollEnemies(): void {
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

    public override resetPlayers(): void {
		this.teams.forEach(team => {
			team.resetStats();
		})
    }

	// Returns winning team, or null if game is not over yet
	public getWinningTeam(): Team | null {
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

	public override checkGameOver(): void {
		const winner = this.getWinningTeam();

		if (winner) {
			winner.players.forEach(player => {
				player.sendAction({ action: "winGame" });

				winner.enemyTeam?.players.forEach(enemy => {
					player.sendEndGameJokersOfPlayer(enemy.id);
				})
			});
			this.resetPlayers();
			this.lobby.isStarted = false;
			this.lobby.broadcastLobbyInfo();
		}
		return
	}
	
	public override recalculateScoreToBeat() {

	}
}