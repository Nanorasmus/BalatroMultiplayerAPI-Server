class Card {
    suit: string
    rank: string
    enhancement: string
    edition: string
    seal: string

    constructor(card_str: string) {
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
        return `${this.suit}-${this.rank}-${this.enhancement}-${this.edition}-${this.seal}`
    }

	equals(cardCriteria: Card): boolean {
        return this.suit == cardCriteria.suit && this.rank == cardCriteria.rank && this.enhancement == cardCriteria.enhancement && this.edition == cardCriteria.edition && this.seal == cardCriteria.seal
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