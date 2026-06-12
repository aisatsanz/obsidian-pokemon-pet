import { Notice, Plugin } from 'obsidian';
import { FALLBACK_POKEMON, PokemonEntry, getFallbackPokemon } from './pokemon';
import { PokemonPetController } from './pet-controller';
import {
	DEFAULT_SETTINGS,
	PokemonPetSettingTab,
	PokemonPetSettings,
} from './settings';
import { normalizePomodoroPresetId } from './pomodoro';
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

		this.addCommand({
			id: 'start-pomodoro',
			name: 'Start pomodoro',
			callback: () => {
				this.controller.startPomodoro();
			},
		});

		this.addCommand({
			id: 'stop-pomodoro',
			name: 'Stop pomodoro',
			callback: () => {
				this.controller.stopPomodoro();
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
		const shouldMigrate = loaded.settingsVersion !== DEFAULT_SETTINGS.settingsVersion;
		this.settings = {
			...DEFAULT_SETTINGS,
			...loaded,
			settingsVersion: DEFAULT_SETTINGS.settingsVersion,
			collection: normalizeCollection(loaded.collection),
			size: clampNumber(loaded.size ?? DEFAULT_SETTINGS.size, 40, 112),
			encounterChance: shouldMigrate
				? DEFAULT_SETTINGS.encounterChance
				: clampNumber(loaded.encounterChance ?? DEFAULT_SETTINGS.encounterChance, 0.01, 0.2),
			pomodoroPresetId: normalizePomodoroPresetId(loaded.pomodoroPresetId),
			pokemonCache: shouldMigrate ? {} : loaded.pokemonCache ?? {},
		};
		if (!this.settings.collection.includes(this.settings.activePokemonId)) {
			this.settings.activePokemonId = 25;
		}
		if (shouldMigrate) {
			await this.saveSettings();
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
		if (cached && isPixelSprite(cached)) {
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

function clampNumber(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function isPixelSprite(pokemon: PokemonEntry): boolean {
	return (
		Boolean(pokemon.stillSpriteUrl) &&
		pokemon.spriteUrl.includes('play.pokemonshowdown.com/sprites/')
	);
}
