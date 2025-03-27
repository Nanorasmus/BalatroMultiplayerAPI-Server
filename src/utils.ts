export function generateSeed(length = 5) {
	let result = ''
	const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
	const charactersLength = characters.length
	let counter = 0
	while (counter < length) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength))
		counter += 1
	}
	return result
}

export function randomInt(max: number): number {
	return Math.floor(Math.random() * max);
}
export function randomIntRange(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Turn any characters necessary for parsing into a special sequence
export function preProcessStringForNetworking(str: string): string {
	return str			
	.replaceAll(',', "{a}") // Needed to seperate action values
	.replaceAll(':', "{b}") // Needed to parse action values

	.replaceAll('|', "{c}") // Needed to seperate sub-list entries
	.replaceAll('-', "{d}") // Needed to seperate sub-list entry values
	.replaceAll('>', "{e}"); // Needed to parse sub-list entry values
}

// Turn any characters that were needed for parsing back into their original characters
export function postProcessStringFromNetworking(str: string): string {
	return str
	.replaceAll("{a}", ",") // Needed to seperate action values
	.replaceAll("{b}", ":") // Needed to parse action values

	.replaceAll("{c}", "|") // Needed to seperate sub-list entries
	.replaceAll("{d}", "-") // Needed to seperate sub-list entry values
	.replaceAll("{e}", ">"); // Needed to parse sub-list entry values
}