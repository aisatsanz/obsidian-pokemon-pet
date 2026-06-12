import { Notice } from 'obsidian';
import PokemonPetPlugin from './main';
import {
	FALLBACK_POKEMON,
	PokemonEntry,
	RARITY_LABELS,
	RARITY_WEIGHTS,
	getPokemonName,
} from './pokemon';

type Direction = -1 | 1;

export class PokemonPetController {
	private plugin: PokemonPetPlugin;
	private rootEl: HTMLDivElement | null = null;
	private petEl: HTMLButtonElement | null = null;
	private spriteEl: HTMLImageElement | null = null;
	private menuEl: HTMLDivElement | null = null;
	private wildEl: HTMLButtonElement | null = null;
	private activePokemon: PokemonEntry | null = null;
	private x = 80;
	private y = 28;
	private direction: Direction = 1;
	private lastStepAt = 0;
	private lastEncounterAt = 0;
	private isPerched = false;
	private removeTypingListener: (() => void) | null = null;

	constructor(plugin: PokemonPetPlugin) {
		this.plugin = plugin;
	}

	async mount(): Promise<void> {
		this.unmount();

		const doc = activeDocument;
		this.rootEl = doc.body.createDiv({ cls: 'pokemon-pet-root' });
		this.petEl = this.rootEl.createEl('button', {
			cls: 'pokemon-pet pokemon-pet-walk',
			attr: { type: 'button', 'aria-label': 'Open pokemon pet menu' },
		});
		this.spriteEl = this.petEl.createEl('img', { cls: 'pokemon-pet-sprite' });
		this.petEl.createDiv({ cls: 'pokemon-pet-shadow' });

		this.petEl.addEventListener('click', (event) => {
			event.stopPropagation();
			this.toggleMenu();
		});

		doc.addEventListener('click', this.closeMenuOnOutsideClick, true);
		this.removeTypingListener = this.registerTypingReaction(doc);

		await this.refresh();
	}

	unmount(): void {
		if (this.rootEl) {
			activeDocument.removeEventListener('click', this.closeMenuOnOutsideClick, true);
			this.rootEl.remove();
		}
		this.removeTypingListener?.();
		this.rootEl = null;
		this.petEl = null;
		this.spriteEl = null;
		this.menuEl = null;
		this.wildEl = null;
		this.removeTypingListener = null;
	}

	async refresh(): Promise<void> {
		if (!this.rootEl || !this.petEl || !this.spriteEl) {
			return;
		}

		if (this.plugin.settings.hidden) {
			this.rootEl.addClass('is-hidden');
			return;
		}

		this.rootEl.removeClass('is-hidden');
		this.activePokemon = await this.plugin.getPokemon(this.plugin.settings.activePokemonId);
		this.spriteEl.src = this.activePokemon.spriteUrl;
		this.spriteEl.alt = this.activePokemon.name;
		this.petEl.style.setProperty('--pokemon-pet-size', `${this.plugin.settings.size}px`);
		this.petEl.setAttribute('aria-label', `Open ${this.activePokemon.name} menu`);
		this.renderMenu();
		this.positionPet();
	}

	async tick(now: number): Promise<void> {
		if (!this.rootEl || !this.petEl || this.plugin.settings.hidden) {
			return;
		}

		if (!this.isPerched && now - this.lastStepAt > 60) {
			this.move();
			this.lastStepAt = now;
		}

		if (this.plugin.settings.encountersEnabled && now - this.lastEncounterAt > 22000) {
			this.lastEncounterAt = now;
			if (!this.wildEl && Math.random() < this.plugin.settings.encounterChance) {
				await this.spawnWildPokemon();
			}
		}

		if (!this.isPerched && Math.random() < 0.002) {
			this.perchOnContent();
		}
	}

	private move(): void {
		const size = this.plugin.settings.size;
		const width = activeWindow.innerWidth;
		this.x += this.direction * 1.4;

		if (this.x < 12) {
			this.direction = 1;
			this.x = 12;
		}
		if (this.x > width - size - 12) {
			this.direction = -1;
			this.x = width - size - 12;
		}

		this.y = 28 + Math.sin(Date.now() / 380) * 4;
		this.positionPet();
	}

	private positionPet(): void {
		if (!this.petEl) {
			return;
		}

		this.petEl.style.transform = `translate3d(${this.x}px, -${this.y}px, 0) scaleX(${this.direction})`;
	}

	private async spawnWildPokemon(): Promise<void> {
		if (!this.rootEl) {
			return;
		}

		const available = FALLBACK_POKEMON.filter(
			(pokemon) => !this.plugin.settings.collection.includes(pokemon.id),
		);
		if (available.length === 0) {
			return;
		}

		const pokemon = await this.plugin.getPokemon(weightedPick(available).id);
		this.wildEl = this.rootEl.createEl('button', {
			cls: `pokemon-pet-wild pokemon-pet-rarity-${pokemon.rarity}`,
			attr: {
				type: 'button',
				'aria-label': `Catch ${pokemon.name}`,
			},
		});
		this.wildEl.style.left = `${Math.max(24, Math.random() * (activeWindow.innerWidth - 144))}px`;
		this.wildEl.style.bottom = `${80 + Math.random() * 180}px`;
		this.wildEl.createEl('img', {
			attr: {
				src: pokemon.spriteUrl,
				alt: pokemon.name,
			},
		});
		this.wildEl.createDiv({
			cls: 'pokemon-pet-wild-label',
			text: `${pokemon.name} Lv.${pokemon.level}`,
		});
		this.wildEl.addEventListener('click', () => {
			void this.catchPokemon(pokemon);
		});

		window.setTimeout(() => {
			if (this.wildEl?.isConnected) {
				this.wildEl.remove();
				this.wildEl = null;
			}
		}, 14000);
	}

	private async catchPokemon(pokemon: PokemonEntry): Promise<void> {
		if (!this.rootEl || !this.wildEl) {
			return;
		}

		const ball = this.rootEl.createDiv({ cls: 'pokemon-pet-ball' });
		const wildRect = this.wildEl.getBoundingClientRect();
		const petRect = this.petEl?.getBoundingClientRect();
		ball.style.left = `${petRect ? petRect.left + petRect.width / 2 : 40}px`;
		ball.style.top = `${petRect ? petRect.top + petRect.height / 2 : activeWindow.innerHeight - 100}px`;
		ball.style.setProperty('--pokemon-pet-ball-x', `${wildRect.left - (petRect?.left ?? 0)}px`);
		ball.style.setProperty('--pokemon-pet-ball-y', `${wildRect.top - (petRect?.top ?? 0)}px`);

		this.wildEl.addClass('is-catching');

		window.setTimeout(() => {
			this.wildEl?.remove();
			this.wildEl = null;
			ball.remove();
			void this.plugin.addToCollection(pokemon.id);
			new Notice(`${pokemon.name} joined your collection.`);
			this.renderMenu();
		}, 720);
	}

	private perchOnContent(): void {
		if (!this.petEl) {
			return;
		}

		const candidates = Array.from(
			activeDocument.querySelectorAll<HTMLElement>(
				'.markdown-preview-view img, .markdown-preview-view p, .cm-content .cm-line',
			),
		).filter((element) => {
			const rect = element.getBoundingClientRect();
			return rect.width > 80 && rect.height > 12 && rect.top > 80 && rect.bottom < activeWindow.innerHeight - 120;
		});

		const target = candidates[Math.floor(Math.random() * candidates.length)];
		if (!target) {
			return;
		}

		const rect = target.getBoundingClientRect();
		this.isPerched = true;
		this.petEl.removeClass('pokemon-pet-walk');
		this.petEl.addClass('pokemon-pet-perch');
		this.x = Math.min(activeWindow.innerWidth - this.plugin.settings.size - 12, Math.max(12, rect.left));
		this.y = activeWindow.innerHeight - rect.top + 8;
		this.positionPet();

		window.setTimeout(() => {
			this.isPerched = false;
			this.petEl?.removeClass('pokemon-pet-perch');
			this.petEl?.addClass('pokemon-pet-walk');
		}, 4600);
	}

	private toggleMenu(): void {
		if (this.menuEl?.isConnected) {
			this.menuEl.remove();
			this.menuEl = null;
			return;
		}
		this.renderMenu(true);
	}

	private renderMenu(open = this.menuEl?.isConnected ?? false): void {
		if (!open || !this.rootEl || !this.petEl || !this.activePokemon) {
			return;
		}

		this.menuEl?.remove();
		this.menuEl = this.rootEl.createDiv({ cls: 'pokemon-pet-menu' });
		const rect = this.petEl.getBoundingClientRect();
		this.menuEl.style.left = `${Math.min(activeWindow.innerWidth - 270, Math.max(12, rect.left + rect.width + 8))}px`;
		this.menuEl.style.top = `${Math.min(activeWindow.innerHeight - 300, Math.max(16, rect.top - 20))}px`;

		const title = this.menuEl.createDiv({ cls: 'pokemon-pet-menu-title' });
		title.createEl('strong', { text: this.activePokemon.name });
		title.createSpan({ text: `Lv.${this.activePokemon.level} ${RARITY_LABELS[this.activePokemon.rarity]}` });

		const sprite = title.createEl('img', {
			attr: { src: this.activePokemon.spriteUrl, alt: this.activePokemon.name },
		});
		sprite.addClass('pokemon-pet-menu-sprite');

		this.createSizeControl(this.menuEl);
		this.createPokemonSelect(this.menuEl);

		const actions = this.menuEl.createDiv({ cls: 'pokemon-pet-menu-actions' });
		const wikiLink = actions.createEl('a', {
			text: 'Wiki',
			href: this.activePokemon.wikiUrl,
			cls: 'pokemon-pet-link',
		});
		wikiLink.setAttribute('target', '_blank');
		wikiLink.setAttribute('rel', 'noopener noreferrer');

		const hideButton = actions.createEl('button', {
			text: 'Hide pokemon',
			cls: 'mod-warning',
			attr: { type: 'button' },
		});
		hideButton.addEventListener('click', () => {
			void (async () => {
			this.plugin.settings.hidden = true;
			await this.plugin.saveSettings();
			await this.refresh();
			new Notice('Pokemon hidden. Re-enable it in pokemon pet settings.');
			})();
		});
	}

	private createSizeControl(container: HTMLElement): void {
		const field = container.createDiv({ cls: 'pokemon-pet-field' });
		field.createEl('label', { text: 'Size' });
		const input = field.createEl('input', {
			type: 'range',
			attr: { min: '48', max: '180', step: '4' },
		});
		input.value = String(this.plugin.settings.size);
		input.addEventListener('input', () => {
			void (async () => {
			this.plugin.settings.size = Number(input.value);
			await this.plugin.saveSettings();
			await this.refresh();
			})();
		});
	}

	private createPokemonSelect(container: HTMLElement): void {
		const field = container.createDiv({ cls: 'pokemon-pet-field' });
		field.createEl('label', { text: 'Pokemon' });
		const select = field.createEl('select');
		for (const pokemonId of this.plugin.settings.collection) {
			select.createEl('option', {
				text: getPokemonName(pokemonId),
				value: String(pokemonId),
			});
		}
		select.value = String(this.plugin.settings.activePokemonId);
		select.addEventListener('change', () => {
			void (async () => {
			this.plugin.settings.activePokemonId = Number(select.value);
			await this.plugin.saveSettings();
			await this.refresh();
			})();
		});
	}

	private closeMenuOnOutsideClick = (event: MouseEvent): void => {
		if (!this.menuEl || !this.petEl) {
			return;
		}
		const target = event.target as Node;
		if (!this.menuEl.contains(target) && !this.petEl.contains(target)) {
			this.menuEl.remove();
			this.menuEl = null;
		}
	};

	private registerTypingReaction(doc: Document): () => void {
		let timeout: number | undefined;
		const onKeydown = () => {
			if (!this.petEl || this.plugin.settings.hidden) {
				return;
			}
			this.petEl.addClass('pokemon-pet-react');
			if (timeout) {
				window.clearTimeout(timeout);
			}
			timeout = window.setTimeout(() => this.petEl?.removeClass('pokemon-pet-react'), 520);
		};
		doc.addEventListener('keydown', onKeydown, true);
		return () => {
			doc.removeEventListener('keydown', onKeydown, true);
			if (timeout) {
				window.clearTimeout(timeout);
			}
		};
	}
}

function weightedPick(pokemon: PokemonEntry[]): PokemonEntry {
	const total = pokemon.reduce((sum, entry) => sum + RARITY_WEIGHTS[entry.rarity], 0);
	let roll = Math.random() * total;
	for (const entry of pokemon) {
		roll -= RARITY_WEIGHTS[entry.rarity];
		if (roll <= 0) {
			return entry;
		}
	}
	return pokemon[0]!;
}
