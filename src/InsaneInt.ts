export class InsaneInt {
    startingECount: number;
    coefficient: number;
    exponent: number;

    constructor(val: string | InsaneInt) {
        if (val instanceof InsaneInt) {
            this.startingECount = val.startingECount;
            this.coefficient = val.coefficient;
            this.exponent = val.exponent;
            return;
        }

        this.startingECount = 0;
        while (val.startsWith('e')) {
            this.startingECount += 1;
            val = val.slice(1);
        }

        if (val.includes('e')) {
            [this.coefficient, this.exponent] = val.split('e').map(Number);
        } else {
            this.coefficient = Number(val);
            this.exponent = 0;
        }
    }

    toString() {
        let result = "";
        for (let i = 0; i < this.startingECount; i++) {
            result += "e";
        }

        result += this.coefficient;
        if (this.exponent != 0) {
            result += "e" + this.exponent;
        }

        return result;
    }

    greaterThan(other: InsaneInt) {
        if (this.startingECount != other.startingECount) {
            return this.startingECount > other.startingECount;
        }
        
        if (this.exponent != other.exponent) {
            return this.exponent > other.exponent;
        }

        return this.coefficient > other.coefficient;
    }

    equalTo(other: InsaneInt) {
        return this.startingECount == other.startingECount && this.exponent == other.exponent && this.coefficient == other.coefficient;
    }

    lessThan(other: InsaneInt) {
        return !this.equalTo(other) && !this.greaterThan(other);
    }
}