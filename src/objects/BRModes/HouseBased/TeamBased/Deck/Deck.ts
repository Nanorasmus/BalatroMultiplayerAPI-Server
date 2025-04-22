import { match } from "assert";
import Team from "../Team.js"
import Card, { CardKey } from "./Card.js";
import { DeckAction, DeckActionType } from "./DeckAction.js";

class Deck {
    public team: Team

    public cards: Card[]

	public pendingActions: DeckAction[] = []
	
	syncPending: boolean = true

	constructor(team: Team, deckStr: string) {
		this.team = team;

		this.cards = [];
		deckStr.split("|").forEach(cardStr => this.cards.push(new Card(this, cardStr.split(">")[1])));
	}

	addCard(card_str: string) {
		const cardStrSplit = card_str.split(">");
		if (cardStrSplit.length != 2) {
			console.log("ERROR: Invalid card string: " + card_str);
		}

		const card = new Card(this, cardStrSplit[1]);
		
		this.cards.push(card);

		this.team.broadcastAction({ action: "addCard", tempId: cardStrSplit[0], card: card.toString() });
	}

	removeCard(id: string) {
		this.cards.splice(this.getCardIndex(id), 1);

		this.team.broadcastAction({ action: "removeCard", card: id });
	}

	copyCard(id: string, targetId: string) {
		const card = this.getCard(id);
		const target = this.getCard(targetId);
		console.log(card ? card.toString() : "null", target ? target.toString() : "null");
		if (card && target) {
			card.suit = target.suit;
			card.rank = target.rank;
			card.enhancement = target.enhancement;
			card.edition = target.edition;
			card.seal = target.seal;

			this.team.broadcastAction({ action: "copyCard", card: id, target: targetId });
		} else {
			this.syncPending = true;
		}
	}

	setSuit(id: string, suit: string) {
		suit = suit.charAt(0);

		const card = this.getCard(id);
		if (card) {
			card.suit = suit;
		} else {
			this.syncPending = true;
		}

		this.team.broadcastAction({ action: "setCardSuit", card: id, suit: suit });
	}

	setRank(id: string, rank: string) {
		if (rank.startsWith("10")) rank = "T";
		rank = rank.charAt(0);
		
		const card = this.getCard(id);
		if (card) {
			card.rank = rank;
		} else {
			this.syncPending = true;
		}

		this.team.broadcastAction({ action: "setCardRank", card: id, rank: rank });
	}

	setEnhancement(id: string, enhancement: string) {
		const card = this.getCard(id);
		if (card) {
			card.enhancement = enhancement;
		} else {
			this.syncPending = true;
		}

		this.team.broadcastAction({ action: "setCardEnhancement", card: id, enhancement: enhancement });
	}

	setEdition(id: string, edition: string) {
		const card = this.getCard(id);
		if (card) {
			card.edition = edition;
			if (card.edition.startsWith("e_")) card.edition = card.edition.substring(2);
		} else {
			this.syncPending = true;
		}

		this.team.broadcastAction({ action: "setCardEdition", card: id, edition: card ? card.edition : "none" });
	}

	setSeal(id: string, seal: string) {
		const card = this.getCard(id);
		if (card) {
			card.seal = seal;
		} else {
			this.syncPending = true;
		}

		this.team.broadcastAction({ action: "setCardSeal", card: id, seal: seal });
	}


	getCard(id: string): Card | undefined {
		return this.cards.find(card => card.equals(id));
	}

	getCardIndex(id: string): number {
		return this.cards.findIndex(card => card.equals(id));
	}
	

	toString(): string {
		return this.cards.map(card => card.toString()).join("|");
	}
}

export default Deck