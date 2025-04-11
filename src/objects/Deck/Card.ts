import { v4 as uuidv4 } from 'uuid'
import Deck from './Deck.js'

class Card {
    id: string

    suit: string
    rank: string
    enhancement: string
    edition: string
    seal: string

    constructor(deck: Deck, card_str: string) {
        do {
            this.id = uuidv4().replaceAll("-", "");
        } while (deck.getCard(this.id))
        

        let split = card_str.split("-");

        this.suit = split[0].charAt(0);
        this.rank = split[1];
        if (this.rank == "10") {
            this.rank = "T";
        } else {
            this.rank = this.rank.charAt(0);
        }

        this.enhancement = split[2];
        this.edition = split[3];
        this.seal = split[4];
    }

    toString(): string {
        return `${this.id}-${this.suit}-${this.rank}-${this.enhancement}-${this.edition}-${this.seal}`
    }

	equals(cardCriteria: Card | string): boolean {
        if (typeof cardCriteria == "string") return this.id == cardCriteria
        return this.id == cardCriteria.id
	}
}

export default Card

export enum CardKey {
    SUIT = 1,
    RANK,
    ENHANCEMENT,
    EDITION,
    SEAL,
}