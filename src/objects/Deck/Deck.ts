import { match } from "assert";
import Team from "../Team.js"
import Card, { CardKey } from "./Card.js";
import { DeckAction, DeckActionType } from "./DeckAction.js";

class Deck {
    public team: Team

    public cards: Card[]

	public pendingActions: DeckAction[] = []
	public tempCardIds: { [key: string]: Card } = {}

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
		this.tempCardIds[cardStrSplit[0]] = card;
		this.pendingActions.push(new DeckAction(DeckActionType.ADD_CARD, card));
	}

	removeCard(id: string) {
		this.pendingActions.push(new DeckAction(DeckActionType.REMOVE_CARD, id));
	}

	setSuit(id: string, suit: string) {
		this.pendingActions.push(new DeckAction(DeckActionType.CHANGE_CARD, id, CardKey.SUIT, suit));
	}

	setRank(id: string, rank: string) {
		this.pendingActions.push(new DeckAction(DeckActionType.CHANGE_CARD, id, CardKey.RANK, rank + ".0"));
	}

	setEnhancement(id: string, enhancement: string) {
		this.pendingActions.push(new DeckAction(DeckActionType.CHANGE_CARD, id, CardKey.ENHANCEMENT, enhancement));
	}

	setEdition(id: string, edition: string) {
		this.pendingActions.push(new DeckAction(DeckActionType.CHANGE_CARD, id, CardKey.EDITION, edition));
	}

	setSeal(id: string, seal: string) {
		this.pendingActions.push(new DeckAction(DeckActionType.CHANGE_CARD, id, CardKey.SEAL, seal));
	}


	getCard(id: string): Card | undefined {
		return this.cards.find(card => card.equals(id));
	}
	

	toString(): string {
		return this.cards.map(card => card.toString()).join("|");
	}

	applyPendingActions() {
		// Sort them after priority
		this.pendingActions = this.pendingActions.sort((a, b) => a.shouldPrioritizeOver(b));

		// Apply changes
		this.pendingActions.forEach(action => {
			// Check if the card still exists despite previous actions (Assuming it is not an add card action)
			let card: Card;
			if (action.type != DeckActionType.ADD_CARD) {
				if (!action.card) return;
				
				if ((typeof(action.card) == "string" && this.tempCardIds[action.card])) {
					card = this.tempCardIds[action.card];
				} else {
					let cardIndex: number = this.cards.findIndex(card => card.equals(action.card!))
					if (cardIndex == -1) return;
					card = this.cards[cardIndex];
				}
			} else {
				// Adding a card requires an actual card
				if (!action.card || typeof(action.card) == "string") return;

				card = action.card;
			}

			switch (action.type) {
				case DeckActionType.ADD_CARD:
					if (action.card && typeof action.card != "string") {
						this.cards.push(action.card);
					}
					break;

				case DeckActionType.REMOVE_CARD:
					let index = this.cards.findIndex(potentialCard => potentialCard.equals(card));
					if (index != -1) this.cards.splice(index, 1);
					break;

				case DeckActionType.CHANGE_CARD:
					if (!action.key || !action.value) return;
					switch (action.key) {
						case CardKey.SUIT:
							card.suit = action.value.charAt(0);
							break;
						case CardKey.RANK:
							if (action.value == "10") {
								card.rank = "T";
							} else {
								card.rank = action.value.charAt(0);
							}
							break;
						case CardKey.ENHANCEMENT:
							card.enhancement = action.value;
							break;
						case CardKey.EDITION:
							card.edition = action.value.startsWith("e_") ? action.value.substring(2) : action.value;
							break;
						case CardKey.SEAL:
							card.seal = action.value;
							break;
					}
					break;
			}
		});

		this.pendingActions = [];
		this.tempCardIds = {};

		this.team.broadcastDeck();
	}
}

export default Deck