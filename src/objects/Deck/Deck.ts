import { match } from "assert";
import Team from "../Team.js"
import Card, { CardKey } from "./Card.js";
import { DeckAction, DeckActionType } from "./DeckAction.js";

class Deck {
    public team: Team

    public cards: Card[]
	public pendingActions: DeckAction[] = []

	constructor(team: Team, deckStr: string) {
		this.team = team;

		this.cards = [];
		deckStr.split("|").forEach(cardStr => this.cards.push(new Card(cardStr)));
	}


	addCard(card_str: string) {
		this.pendingActions.push(new DeckAction(DeckActionType.ADD_CARD, new Card(card_str)));
	}

	removeCard(card_str: string) {
		this.pendingActions.push(new DeckAction(DeckActionType.REMOVE_CARD, new Card(card_str)));
	}

	setSuit(card_str: string, suit: string) {
		this.pendingActions.push(new DeckAction(DeckActionType.CHANGE_CARD, new Card(card_str), CardKey.SUIT, suit));
	}

	setRank(card_str: string, rank: string) {
		this.pendingActions.push(new DeckAction(DeckActionType.CHANGE_CARD, new Card(card_str), CardKey.RANK, rank + ".0"));
	}

	setEnhancement(card_str: string, enhancement: string) {
		this.pendingActions.push(new DeckAction(DeckActionType.CHANGE_CARD, new Card(card_str), CardKey.ENHANCEMENT, enhancement));
	}

	setEdition(card_str: string, edition: string) {
		this.pendingActions.push(new DeckAction(DeckActionType.CHANGE_CARD, new Card(card_str), CardKey.EDITION, edition));
	}

	setSeal(card_str: string, seal: string) {
		this.pendingActions.push(new DeckAction(DeckActionType.CHANGE_CARD, new Card(card_str), CardKey.SEAL, seal));
	}

	

	toString(): string {
		return this.cards.map(card => card.toString()).join("|");
	}

	applyPendingActions() {
		// Remove duplicates
		let uniqueActions = this.pendingActions.filter((action, index) =>
			this.pendingActions.findIndex(otherAction => action.equals(otherAction)) == index
		);

		// Sort them after priority
		uniqueActions.sort((a, b) => a.shouldPrioritizeOver(b));

		// Apply changes
		uniqueActions.forEach(action => {
			// Check if the card still exists despite previous actions (Assuming it is not an add card action)
			let cardIndex: number = 0;
			if (action.type != DeckActionType.ADD_CARD) {
				cardIndex = this.cards.findIndex(card => card.equals(action.cardCriteria))
				if (cardIndex == -1) return;
			}

			switch (action.type) {
				case DeckActionType.ADD_CARD:
					this.cards.push(action.cardCriteria);
					break;

				case DeckActionType.REMOVE_CARD:
					let index = this.cards.findIndex(card => card.equals(action.cardCriteria));
					if (index != -1) this.cards.splice(index, 1);
					break;

				case DeckActionType.CHANGE_CARD:
					if (!action.key || !action.value) return;
					switch (action.key) {
						case CardKey.SUIT:
							this.cards[cardIndex].suit = action.value.charAt(0);
							break;
						case CardKey.RANK:
							if (action.value == "10") {
								this.cards[cardIndex].rank = "T";
							} else {
								this.cards[cardIndex].rank = action.value.charAt(0);
							}
							break;
						case CardKey.ENHANCEMENT:
							this.cards[cardIndex].enhancement = action.value;
							break;
						case CardKey.EDITION:
							this.cards[cardIndex].edition = action.value;
							break;
						case CardKey.SEAL:
							this.cards[cardIndex].seal = action.value;
							break;
					}
					break;
			}
		});

		this.team.broadcastDeck();
	}
}

export default Deck