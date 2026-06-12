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
	133: 134,
	252: 253,
	253: 254,
	255: 256,
	256: 257,
	258: 259,
	259: 260,
};

export const WILD_POKEMON_IDS = new Set([
	25,
	1,
	4,
	7,
	39,
	52,
	133,
	143,
	149,
	150,
	151,
	252,
	255,
	258,
	448,
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
	makePokemon(133, 'Eevee', 12, 'rare', ['normal'], 45),
	makePokemon(134, 'Vaporeon', 32, 'rare', ['water'], 45),
	makePokemon(143, 'Snorlax', 35, 'rare', ['normal'], 25),
	makePokemon(149, 'Dragonite', 55, 'rare', ['dragon', 'flying'], 45),
	makePokemon(150, 'Mewtwo', 70, 'legendary', ['psychic'], 3),
	makePokemon(151, 'Mew', 70, 'mythical', ['psychic'], 45),
	makePokemon(252, 'Treecko', 5, 'uncommon', ['grass'], 45),
	makePokemon(253, 'Grovyle', 18, 'uncommon', ['grass'], 45),
	makePokemon(254, 'Sceptile', 36, 'rare', ['grass'], 45),
	makePokemon(255, 'Torchic', 5, 'uncommon', ['fire'], 45),
	makePokemon(256, 'Combusken', 18, 'uncommon', ['fire', 'fighting'], 45),
	makePokemon(257, 'Blaziken', 36, 'rare', ['fire', 'fighting'], 45),
	makePokemon(258, 'Mudkip', 5, 'uncommon', ['water'], 45),
	makePokemon(259, 'Marshtomp', 18, 'uncommon', ['water', 'ground'], 45),
	makePokemon(260, 'Swampert', 36, 'rare', ['water', 'ground'], 45),
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
