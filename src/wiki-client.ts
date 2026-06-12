import { requestUrl } from 'obsidian';
import {
	FALLBACK_POKEMON,
	PokemonEntry,
	PokemonRarity,
	getFallbackPokemon,
	makeSpriteUrl,
	makeWikiUrl,
} from './pokemon';

interface PokeApiPokemon {
	base_experience?: number;
	id: number;
	name: string;
	sprites?: {
		other?: {
			'official-artwork'?: {
				front_default?: string;
			};
		};
		front_default?: string;
	};
	types?: Array<{ type: { name: string } }>;
}

interface PokeApiSpecies {
	capture_rate?: number;
	is_legendary?: boolean;
	is_mythical?: boolean;
	names?: Array<{ language: { name: string }; name: string }>;
}

export class PokemonWikiClient {
	async getPokemon(id: number, allowRemote: boolean): Promise<PokemonEntry> {
		const fallback = getFallbackPokemon(id) ?? FALLBACK_POKEMON[0]!;

		if (!allowRemote) {
			return fallback;
		}

		try {
			const [pokemon, species] = await Promise.all([
				this.fetchJson<PokeApiPokemon>(`https://pokeapi.co/api/v2/pokemon/${id}`),
				this.fetchJson<PokeApiSpecies>(`https://pokeapi.co/api/v2/pokemon-species/${id}`),
			]);
			const name = this.getEnglishName(species) ?? titleCase(pokemon.name);
			const captureRate = species.capture_rate ?? fallback.captureRate ?? 255;

			return {
				id: pokemon.id,
				name,
				level: deriveLevel(pokemon.base_experience, fallback.level),
				rarity: deriveRarity(species, captureRate),
				types: pokemon.types?.map((entry) => entry.type.name) ?? fallback.types,
				captureRate,
				spriteUrl:
					pokemon.sprites?.other?.['official-artwork']?.front_default ??
					pokemon.sprites?.front_default ??
					makeSpriteUrl(id),
				wikiUrl: makeWikiUrl(name),
			};
		} catch {
			return fallback;
		}
	}

	private async fetchJson<T>(url: string): Promise<T> {
		const response = await requestUrl({ url });
		return response.json as T;
	}

	private getEnglishName(species: PokeApiSpecies): string | undefined {
		return species.names?.find((entry) => entry.language.name === 'en')?.name;
	}
}

function deriveLevel(baseExperience: number | undefined, fallback: number): number {
	if (!baseExperience) {
		return fallback;
	}
	return Math.min(100, Math.max(1, Math.round(baseExperience / 9)));
}

function deriveRarity(species: PokeApiSpecies, captureRate: number): PokemonRarity {
	if (species.is_mythical) {
		return 'mythical';
	}
	if (species.is_legendary || captureRate <= 3) {
		return 'legendary';
	}
	if (captureRate <= 45) {
		return 'rare';
	}
	if (captureRate <= 120) {
		return 'uncommon';
	}
	return 'common';
}

function titleCase(value: string): string {
	return value
		.split('-')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}
