import { Notice, Plugin } from 'obsidian';
import { FALLBACK_POKEMON, PokemonEntry, getFallbackPokemon } from './pokemon';
import { PokemonPetController } from './pet-controller';
import {
	DEFAULT_SETTINGS,
	PokemonPetSettingTab,
	PokemonPetSettings,
} from './settings';
import { PokemonWikiClient } from './wiki-client';

export default class PokemonPetPlugin extends Plugin {
	settings!: PokemonPetSettings;
	private controller!: PokemonPetController;
	private wikiClient = new PokemonWikiClient();
	private animationFrame = 0;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.controller = new PokemonPetController(this);
		await this.controller.mount();

		this.addRibbonIcon('paw-print', 'Pokemon pet', () => {
			void this.toggleHidden();
		});

		this.addCommand({
			id: 'toggle-pet',
			name: 'Toggle pet',
			callback: () => {
				void this.toggleHidden();
			},
		});

		this.addCommand({
			id: 'show-pet',
			name: 'Show pet',
			callback: async () => {
				this.settings.hidden = false;
				await this.saveSettings();
				await this.refreshPet();
			},
		});

		this.addSettingTab(new PokemonPetSettingTab(this.app, this));
		this.startLoop();
	}

	onunload(): void {
		if (this.animationFrame) {
			window.cancelAnimationFrame(this.animationFrame);
		}
		this.controller?.unmount();
	}

	private async toggleHidden(): Promise<void> {
			this.settings.hidden = !this.settings.hidden;
			await this.saveSettings();
			await this.refreshPet();
			new Notice(this.settings.hidden ? 'Pokemon hidden.' : 'Pokemon is back.');
	}

	async loadSettings(): Promise<void> {
		const loaded = ((await this.loadData()) ?? {}) as Partial<PokemonPetSettings>;
		this.settings = {
			...DEFAULT_SETTINGS,
			...loaded,
			collection: normalizeCollection(loaded.collection),
			pokemonCache: loaded.pokemonCache ?? {},
		};
		if (!this.settings.collection.includes(this.settings.activePokemonId)) {
			this.settings.activePokemonId = 25;
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	async refreshPet(): Promise<void> {
		await this.controller.refresh();
	}

	async getPokemon(id: number): Promise<PokemonEntry> {
		const cached = this.settings.pokemonCache[String(id)] as PokemonEntry | undefined;
		if (cached) {
			return cached;
		}

		const pokemon = await this.wikiClient.getPokemon(id, this.settings.useRemotePokemonData);
		this.settings.pokemonCache[String(id)] = pokemon;
		void this.saveSettings();
		return pokemon;
	}

	async addToCollection(id: number): Promise<void> {
		if (!this.settings.collection.includes(id)) {
			this.settings.collection.push(id);
			this.settings.collection.sort((a, b) => a - b);
		}
		this.settings.activePokemonId = id;
		await this.saveSettings();
		await this.refreshPet();
	}

	async resetCollection(): Promise<void> {
		this.settings.collection = [25];
		this.settings.activePokemonId = 25;
		this.settings.hidden = false;
		await this.saveSettings();
		await this.refreshPet();
	}

	private startLoop(): void {
		const loop = (now: number) => {
			void this.controller.tick(now);
			this.animationFrame = window.requestAnimationFrame(loop);
		};
		this.animationFrame = window.requestAnimationFrame(loop);
	}
}

function normalizeCollection(collection: number[] | undefined): number[] {
	const knownIds = new Set(FALLBACK_POKEMON.map((pokemon) => pokemon.id));
	const values = collection?.filter((id) => knownIds.has(id) || Boolean(getFallbackPokemon(id))) ?? [];
	return Array.from(new Set([25, ...values])).sort((a, b) => a - b);
}
