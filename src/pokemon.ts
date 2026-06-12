export type PokemonRarity = 'common' | 'uncommon' | 'rare' | 'legendary' | 'mythical';

export interface PokemonEntry {
	id: number;
	name: string;
	level: number;
	rarity: PokemonRarity;
	spriteUrl: string;
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
	common: 64,
	uncommon: 24,
	rare: 9,
	legendary: 2,
	mythical: 1,
};

export const FALLBACK_POKEMON: PokemonEntry[] = [
	makePokemon(25, 'Pikachu', 14, 'common', ['electric'], 190),
	makePokemon(1, 'Bulbasaur', 5, 'uncommon', ['grass', 'poison'], 45),
	makePokemon(4, 'Charmander', 5, 'uncommon', ['fire'], 45),
	makePokemon(7, 'Squirtle', 5, 'uncommon', ['water'], 45),
	makePokemon(39, 'Jigglypuff', 10, 'common', ['normal', 'fairy'], 170),
	makePokemon(52, 'Meowth', 10, 'common', ['normal'], 255),
	makePokemon(133, 'Eevee', 12, 'rare', ['normal'], 45),
	makePokemon(143, 'Snorlax', 35, 'rare', ['normal'], 25),
	makePokemon(149, 'Dragonite', 55, 'rare', ['dragon', 'flying'], 45),
	makePokemon(150, 'Mewtwo', 70, 'legendary', ['psychic'], 3),
	makePokemon(151, 'Mew', 70, 'mythical', ['psychic'], 45),
	makePokemon(252, 'Treecko', 5, 'uncommon', ['grass'], 45),
	makePokemon(255, 'Torchic', 5, 'uncommon', ['fire'], 45),
	makePokemon(258, 'Mudkip', 5, 'uncommon', ['water'], 45),
	makePokemon(448, 'Lucario', 38, 'rare', ['fighting', 'steel'], 45),
];

export function getFallbackPokemon(id: number): PokemonEntry | undefined {
	return FALLBACK_POKEMON.find((pokemon) => pokemon.id === id);
}

export function getPokemonName(id: number): string {
	return getFallbackPokemon(id)?.name ?? `Pokemon #${id}`;
}

export function makeSpriteUrl(id: number): string {
	return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
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
		spriteUrl: makeSpriteUrl(id),
		wikiUrl: makeWikiUrl(name),
	};
}
