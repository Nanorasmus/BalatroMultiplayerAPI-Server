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
    cardCriteria: Card
    key?: CardKey
    value?: string

    constructor(type: DeckActionType, cardCriteria: Card, key?: CardKey, value?: string) {
        this.type = type;
        this.cardCriteria = cardCriteria;
        this.key = key;
        this.value = value;
    }

    equals(otherAction: DeckAction) {
        return this.type == otherAction.type && this.cardCriteria.equals(otherAction.cardCriteria) && this.key == otherAction.key && this.value == otherAction.value;
    }

    shouldPrioritizeOver(otherAction: DeckAction) {
        // Remove card
        if (this.type == DeckActionType.REMOVE_CARD && otherAction.type == DeckActionType.REMOVE_CARD) {
            return 0;
        }
        if (this.type == DeckActionType.REMOVE_CARD) {
            return 1;
        }
        if (otherAction.type == DeckActionType.REMOVE_CARD) {
            return -1;
        }

        // Add card
        if (this.type == DeckActionType.ADD_CARD && otherAction.type == DeckActionType.ADD_CARD) {
            return 0;
        }
        if (this.type == DeckActionType.ADD_CARD) {
            return 1;
        }
        if (otherAction.type == DeckActionType.ADD_CARD) {
            return -1;
        }

        // Change card
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
}

export enum DeckActionType {
    ADD_CARD,
    REMOVE_CARD,
    CHANGE_CARD,
}