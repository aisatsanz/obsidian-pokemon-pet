export type PokemonRarity = 'common' | 'uncommon' | 'rare' | 'legendary' | 'mythical';

export interface PokemonEntry {
	id: number;
	name: string;
	level: number;
	rarity: PokemonRarity;
	spriteUrl: string;
	stillSpriteUrl: string;
	wikiUrl: string;
	types: string[];
	captureRate?: number;
}

export const RARITY_LABELS: Record<PokemonRarity, string> = {
	common: 'Common',
	uncommon: 'Uncommon',
	rare: 'Rare',
	legendary: 'Legendary',
	mythical: 'Mythical',
};

export const RARITY_WEIGHTS: Record<PokemonRarity, number> = {
	common: 80,
	uncommon: 16,
	rare: 3,
	legendary: 0.7,
	mythical: 0.3,
};

export const NEXT_EVOLUTION_BY_ID: Record<number, number> = {
	1: 2,
	2: 3,
	4: 5,
	5: 6,
	7: 8,
	8: 9,
	25: 26,
	39: 40,
	52: 53,
	54: 55,
	58: 59,
	63: 64,
	64: 65,
	66: 67,
	67: 68,
	74: 75,
	75: 76,
	92: 93,
	93: 94,
	133: 134,
	147: 148,
	148: 149,
	152: 153,
	153: 154,
	155: 156,
	156: 157,
	158: 159,
	159: 160,
	172: 25,
	252: 253,
	253: 254,
	255: 256,
	256: 257,
	258: 259,
	259: 260,
	393: 394,
	394: 395,
	396: 397,
	397: 398,
	403: 404,
	404: 405,
	447: 448,
};

export const WILD_POKEMON_IDS = new Set([
	25,
	1,
	4,
	7,
	39,
	52,
	54,
	58,
	63,
	66,
	74,
	92,
	133,
	143,
	147,
	150,
	151,
	152,
	155,
	158,
	252,
	255,
	258,
	359,
	393,
	396,
	403,
	447,
]);

export const FALLBACK_POKEMON: PokemonEntry[] = [
	makePokemon(25, 'Pikachu', 14, 'common', ['electric'], 190),
	makePokemon(26, 'Raichu', 28, 'uncommon', ['electric'], 75),
	makePokemon(1, 'Bulbasaur', 5, 'uncommon', ['grass', 'poison'], 45),
	makePokemon(2, 'Ivysaur', 18, 'uncommon', ['grass', 'poison'], 45),
	makePokemon(3, 'Venusaur', 36, 'rare', ['grass', 'poison'], 45),
	makePokemon(4, 'Charmander', 5, 'uncommon', ['fire'], 45),
	makePokemon(5, 'Charmeleon', 18, 'uncommon', ['fire'], 45),
	makePokemon(6, 'Charizard', 36, 'rare', ['fire', 'flying'], 45),
	makePokemon(7, 'Squirtle', 5, 'uncommon', ['water'], 45),
	makePokemon(8, 'Wartortle', 18, 'uncommon', ['water'], 45),
	makePokemon(9, 'Blastoise', 36, 'rare', ['water'], 45),
	makePokemon(39, 'Jigglypuff', 10, 'common', ['normal', 'fairy'], 170),
	makePokemon(40, 'Wigglytuff', 26, 'uncommon', ['normal', 'fairy'], 50),
	makePokemon(52, 'Meowth', 10, 'common', ['normal'], 255),
	makePokemon(53, 'Persian', 28, 'uncommon', ['normal'], 90),
	makePokemon(54, 'Psyduck', 14, 'common', ['water'], 190),
	makePokemon(55, 'Golduck', 33, 'uncommon', ['water'], 75),
	makePokemon(58, 'Growlithe', 16, 'uncommon', ['fire'], 190),
	makePokemon(59, 'Arcanine', 36, 'rare', ['fire'], 75),
	makePokemon(63, 'Abra', 8, 'uncommon', ['psychic'], 200),
	makePokemon(64, 'Kadabra', 22, 'uncommon', ['psychic'], 100),
	makePokemon(65, 'Alakazam', 40, 'rare', ['psychic'], 50),
	makePokemon(66, 'Machop', 12, 'common', ['fighting'], 180),
	makePokemon(67, 'Machoke', 28, 'uncommon', ['fighting'], 90),
	makePokemon(68, 'Machamp', 42, 'rare', ['fighting'], 45),
	makePokemon(74, 'Geodude', 11, 'common', ['rock', 'ground'], 255),
	makePokemon(75, 'Graveler', 28, 'uncommon', ['rock', 'ground'], 120),
	makePokemon(76, 'Golem', 44, 'rare', ['rock', 'ground'], 45),
	makePokemon(92, 'Gastly', 12, 'uncommon', ['ghost', 'poison'], 190),
	makePokemon(93, 'Haunter', 28, 'uncommon', ['ghost', 'poison'], 90),
	makePokemon(94, 'Gengar', 44, 'rare', ['ghost', 'poison'], 45),
	makePokemon(133, 'Eevee', 12, 'rare', ['normal'], 45),
	makePokemon(134, 'Vaporeon', 32, 'rare', ['water'], 45),
	makePokemon(143, 'Snorlax', 35, 'rare', ['normal'], 25),
	makePokemon(147, 'Dratini', 10, 'rare', ['dragon'], 45),
	makePokemon(148, 'Dragonair', 35, 'rare', ['dragon'], 45),
	makePokemon(149, 'Dragonite', 55, 'rare', ['dragon', 'flying'], 45),
	makePokemon(150, 'Mewtwo', 70, 'legendary', ['psychic'], 3),
	makePokemon(151, 'Mew', 70, 'mythical', ['psychic'], 45),
	makePokemon(152, 'Chikorita', 5, 'uncommon', ['grass'], 45),
	makePokemon(153, 'Bayleef', 18, 'uncommon', ['grass'], 45),
	makePokemon(154, 'Meganium', 36, 'rare', ['grass'], 45),
	makePokemon(155, 'Cyndaquil', 5, 'uncommon', ['fire'], 45),
	makePokemon(156, 'Quilava', 18, 'uncommon', ['fire'], 45),
	makePokemon(157, 'Typhlosion', 36, 'rare', ['fire'], 45),
	makePokemon(158, 'Totodile', 5, 'uncommon', ['water'], 45),
	makePokemon(159, 'Croconaw', 18, 'uncommon', ['water'], 45),
	makePokemon(160, 'Feraligatr', 36, 'rare', ['water'], 45),
	makePokemon(172, 'Pichu', 5, 'common', ['electric'], 190),
	makePokemon(252, 'Treecko', 5, 'uncommon', ['grass'], 45),
	makePokemon(253, 'Grovyle', 18, 'uncommon', ['grass'], 45),
	makePokemon(254, 'Sceptile', 36, 'rare', ['grass'], 45),
	makePokemon(255, 'Torchic', 5, 'uncommon', ['fire'], 45),
	makePokemon(256, 'Combusken', 18, 'uncommon', ['fire', 'fighting'], 45),
	makePokemon(257, 'Blaziken', 36, 'rare', ['fire', 'fighting'], 45),
	makePokemon(258, 'Mudkip', 5, 'uncommon', ['water'], 45),
	makePokemon(259, 'Marshtomp', 18, 'uncommon', ['water', 'ground'], 45),
	makePokemon(260, 'Swampert', 36, 'rare', ['water', 'ground'], 45),
	makePokemon(359, 'Absol', 36, 'rare', ['dark'], 30),
	makePokemon(393, 'Piplup', 5, 'uncommon', ['water'], 45),
	makePokemon(394, 'Prinplup', 18, 'uncommon', ['water'], 45),
	makePokemon(395, 'Empoleon', 36, 'rare', ['water', 'steel'], 45),
	makePokemon(396, 'Starly', 4, 'common', ['normal', 'flying'], 255),
	makePokemon(397, 'Staravia', 20, 'uncommon', ['normal', 'flying'], 120),
	makePokemon(398, 'Staraptor', 36, 'rare', ['normal', 'flying'], 45),
	makePokemon(403, 'Shinx', 8, 'common', ['electric'], 235),
	makePokemon(404, 'Luxio', 22, 'uncommon', ['electric'], 120),
	makePokemon(405, 'Luxray', 42, 'rare', ['electric'], 45),
	makePokemon(447, 'Riolu', 16, 'rare', ['fighting'], 75),
	makePokemon(448, 'Lucario', 38, 'rare', ['fighting', 'steel'], 45),
];

export function getFallbackPokemon(id: number): PokemonEntry | undefined {
	return FALLBACK_POKEMON.find((pokemon) => pokemon.id === id);
}

export function getPokemonName(id: number): string {
	return getFallbackPokemon(id)?.name ?? `Pokemon #${id}`;
}

export function getNextEvolutionId(id: number): number | undefined {
	return NEXT_EVOLUTION_BY_ID[id];
}

export function makePokemonSpriteSlug(name: string): string {
	return name
		.toLowerCase()
		.replaceAll('♀', '-f')
		.replaceAll('♂', '-m')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

export function makeSpriteUrl(pokemon: number | string): string {
	const slug = typeof pokemon === 'number'
		? getFallbackPokemon(pokemon)?.name
		: pokemon;
	if (!slug && typeof pokemon === 'number') {
		return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon}.png`;
	}
	return `https://play.pokemonshowdown.com/sprites/ani/${makePokemonSpriteSlug(slug ?? 'pikachu')}.gif`;
}

export function makeStaticSpriteUrl(pokemon: number | string): string {
	const slug = typeof pokemon === 'number'
		? getFallbackPokemon(pokemon)?.name
		: pokemon;
	if (!slug && typeof pokemon === 'number') {
		return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon}.png`;
	}
	return `https://play.pokemonshowdown.com/sprites/gen5/${makePokemonSpriteSlug(slug ?? 'pikachu')}.png`;
}

export function makeWikiUrl(name: string): string {
	return `https://pokemon.fandom.com/wiki/${encodeURIComponent(name.replaceAll(' ', '_'))}`;
}

function makePokemon(
	id: number,
	name: string,
	level: number,
	rarity: PokemonRarity,
	types: string[],
	captureRate: number,
): PokemonEntry {
	return {
		id,
		name,
		level,
		rarity,
		types,
		captureRate,
		spriteUrl: makeSpriteUrl(name),
		stillSpriteUrl: makeStaticSpriteUrl(name),
		wikiUrl: makeWikiUrl(name),
	};
}
