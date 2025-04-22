import Card, { CardKey } from "./Card.js";

const priorities: { [key: string]: number } = {
    "suit": 0,
    "rank": 1,
    "enhancement": 2,
    "edition": 3,
    "seal": 4,
}

export class DeckAction {
    type: DeckActionType;
    card?: Card | string
    key?: CardKey
    value?: string

    timeAdded: number

    constructor(type: DeckActionType, card: Card | string, key?: CardKey, value?: string) {
        this.type = type;
        this.card = card;
        this.key = key;
        this.value = value;

        this.timeAdded = Date.now();
    }

    equals(otherAction: DeckAction) {
        let cardEquals = this.card == otherAction.card;
        if (this.card && otherAction.card && typeof this.card != "string" && typeof otherAction.card != "string") {
            cardEquals = this.card.equals(otherAction.card) ?? false;
        }
        
        return this.type == otherAction.type && cardEquals && this.key == otherAction.key && this.value == otherAction.value;
    }

    shouldPrioritizeOver(otherAction: DeckAction) {
        // Remove card
        if (this.type == DeckActionType.REMOVE_CARD && otherAction.type == DeckActionType.REMOVE_CARD) {
            return otherAction.timeAdded - this.timeAdded;
        }
        if (this.type == DeckActionType.REMOVE_CARD) {
            return 1;
        }
        if (otherAction.type == DeckActionType.REMOVE_CARD) {
            return -1;
        }

        // Add card
        if (this.type == DeckActionType.ADD_CARD && otherAction.type == DeckActionType.ADD_CARD) {
            return otherAction.timeAdded - this.timeAdded;
        }
        if (this.type == DeckActionType.ADD_CARD) {
            return 1;
        }
        if (otherAction.type == DeckActionType.ADD_CARD) {
            return -1;
        }

        // Change card
        if (this.timeAdded == otherAction.timeAdded) {
            if (this.key == otherAction.key) {
                return 0;
            }
            if (!this.key || !otherAction.key) return 0;
            
            // Prioritize certain values over others
            if (priorities[this.key!] > priorities[otherAction.key!]) {
                return 1;
            }
            return -1
        }

        return otherAction.timeAdded - this.timeAdded
    }
}

export enum DeckActionType {
    ADD_CARD,
    REMOVE_CARD,
    CHANGE_CARD,
}