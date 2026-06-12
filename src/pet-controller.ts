import { Notice } from 'obsidian';
import PokemonPetPlugin from './main';
import {
	FALLBACK_POKEMON,
	PokemonEntry,
	RARITY_LABELS,
	RARITY_WEIGHTS,
	getPokemonName,
	makeStaticSpriteUrl,
} from './pokemon';

type Direction = -1 | 1;
type PetState = 'walk' | 'idle' | 'travel-to-perch' | 'perch' | 'travel-to-ground';

const GROUND_OFFSET = 20;
const WALK_SPEED = 0.018;
const ENCOUNTER_INTERVAL = 75_000;
const FIRST_ENCOUNTER_DELAY = 90_000;
const MIN_PERCH_DELAY = 120_000;
const MAX_PERCH_DELAY = 240_000;

export class PokemonPetController {
	private plugin: PokemonPetPlugin;
	private rootEl: HTMLDivElement | null = null;
	private petEl: HTMLButtonElement | null = null;
	private spriteEl: HTMLImageElement | null = null;
	private menuEl: HTMLDivElement | null = null;
	private wildEl: HTMLButtonElement | null = null;
	private activePokemon: PokemonEntry | null = null;
	private focusedElement: HTMLElement | null = null;
	private state: PetState = 'walk';
	private x = 80;
	private y = GROUND_OFFSET;
	private direction: Direction = 1;
	private lastFrameAt = 0;
	private stateUntil = 0;
	private lastEncounterAt = 0;
	private nextPerchAt = 0;
	private travelStartAt = 0;
	private travelDuration = 0;
	private startX = 0;
	private startY = GROUND_OFFSET;
	private targetX = 80;
	private targetY = GROUND_OFFSET;
	private removeTypingListener: (() => void) | null = null;

	constructor(plugin: PokemonPetPlugin) {
		this.plugin = plugin;
	}

	async mount(): Promise<void> {
		this.unmount();

		const now = window.performance.now();
		this.lastFrameAt = now;
		this.lastEncounterAt = now - ENCOUNTER_INTERVAL + FIRST_ENCOUNTER_DELAY;
		this.nextPerchAt = now + randomBetween(MIN_PERCH_DELAY, MAX_PERCH_DELAY);
		this.stateUntil = now + randomBetween(8_000, 18_000);

		const doc = activeDocument;
		this.rootEl = doc.body.createDiv({ cls: 'pokemon-pet-root' });
		this.petEl = this.rootEl.createEl('button', {
			cls: 'pokemon-pet pokemon-pet-walk',
			attr: { type: 'button', 'aria-label': 'Open pokemon pet menu' },
		});
		this.spriteEl = this.petEl.createEl('img', { cls: 'pokemon-pet-sprite' });
		this.petEl.createDiv({ cls: 'pokemon-pet-emote', text: '!' });
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
		this.focusedElement = null;
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

		if (this.isMenuOpen()) {
			this.lastFrameAt = now;
			this.petEl.addClass('pokemon-pet-paused');
			return;
		}

		this.petEl.removeClass('pokemon-pet-paused');
		this.updateMovement(now);

		if (this.plugin.settings.encountersEnabled && now - this.lastEncounterAt > ENCOUNTER_INTERVAL) {
			this.lastEncounterAt = now;
			if (!this.wildEl && Math.random() < this.plugin.settings.encounterChance) {
				await this.spawnWildPokemon();
			}
		}
	}

	private updateMovement(now: number): void {
		const dt = Math.min(80, Math.max(0, now - this.lastFrameAt));
		this.lastFrameAt = now;

		if (this.state === 'walk') {
			this.walk(dt, now);
		} else if (this.state === 'idle') {
			this.y = GROUND_OFFSET;
			if (now >= this.stateUntil) {
				this.beginWalk(now);
			}
		} else if (this.state === 'travel-to-perch' || this.state === 'travel-to-ground') {
			this.updateTravel(now);
		} else if (this.state === 'perch') {
			this.updatePerch(now);
		}

		if ((this.state === 'walk' || this.state === 'idle') && now >= this.nextPerchAt) {
			this.beginTravelToContent(now);
		}

		this.positionPet();
	}

	private walk(dt: number, now: number): void {
		const size = this.plugin.settings.size;
		const width = activeWindow.innerWidth;
		this.y = GROUND_OFFSET;
		this.x += this.direction * WALK_SPEED * dt;

		if (this.x < 12) {
			this.direction = 1;
			this.x = 12;
			this.beginIdle(now, randomBetween(1_800, 4_200));
			return;
		}

		if (this.x > width - size - 12) {
			this.direction = -1;
			this.x = width - size - 12;
			this.beginIdle(now, randomBetween(1_800, 4_200));
			return;
		}

		if (now >= this.stateUntil) {
			if (Math.random() < 0.55) {
				this.beginIdle(now, randomBetween(3_500, 8_500));
			} else {
				this.stateUntil = now + randomBetween(8_000, 18_000);
			}
		}
	}

	private beginWalk(now: number): void {
		this.state = 'walk';
		this.stateUntil = now + randomBetween(8_000, 18_000);
		this.setStateClass();
	}

	private beginIdle(now: number, duration: number): void {
		this.state = 'idle';
		this.stateUntil = now + duration;
		this.setStateClass();
	}

	private beginTravelToContent(now: number): void {
		const target = this.getRandomPerchElement();
		this.nextPerchAt = now + randomBetween(MIN_PERCH_DELAY, MAX_PERCH_DELAY);

		if (!target) {
			return;
		}

		const rect = target.getBoundingClientRect();
		this.focusedElement = target;
		this.state = 'travel-to-perch';
		this.travelStartAt = now;
		this.travelDuration = randomBetween(1_800, 2_600);
		this.startX = this.x;
		this.startY = this.y;
		this.targetX = clamp(rect.left + rect.width / 2 - this.plugin.settings.size / 2, 12, activeWindow.innerWidth - this.plugin.settings.size - 12);
		this.targetY = activeWindow.innerHeight - rect.top + 6;
		this.direction = this.targetX >= this.x ? 1 : -1;
		this.setStateClass();
	}

	private beginTravelToGround(now: number): void {
		this.focusedElement = null;
		this.state = 'travel-to-ground';
		this.travelStartAt = now;
		this.travelDuration = randomBetween(1_200, 1_800);
		this.startX = this.x;
		this.startY = this.y;
		this.targetX = clamp(this.x + this.direction * randomBetween(60, 140), 12, activeWindow.innerWidth - this.plugin.settings.size - 12);
		this.targetY = GROUND_OFFSET;
		this.direction = this.targetX >= this.x ? 1 : -1;
		this.setStateClass();
	}

	private updateTravel(now: number): void {
		const amount = smoothStep(clamp((now - this.travelStartAt) / this.travelDuration, 0, 1));
		const lift = Math.sin(amount * Math.PI) * 42;
		this.x = lerp(this.startX, this.targetX, amount);
		this.y = lerp(this.startY, this.targetY, amount) + lift;

		if (amount >= 1) {
			this.x = this.targetX;
			this.y = this.targetY;
			if (this.state === 'travel-to-perch') {
				this.state = 'perch';
				this.stateUntil = now + randomBetween(12_000, 22_000);
			} else {
				this.beginWalk(now);
			}
			this.setStateClass();
		}
	}

	private updatePerch(now: number): void {
		if (!this.focusedElement?.isConnected) {
			this.beginTravelToGround(now);
			return;
		}

		const rect = this.focusedElement.getBoundingClientRect();
		if (rect.bottom < 0 || rect.top > activeWindow.innerHeight) {
			this.beginTravelToGround(now);
			return;
		}

		this.x = clamp(rect.left + rect.width / 2 - this.plugin.settings.size / 2, 12, activeWindow.innerWidth - this.plugin.settings.size - 12);
		this.y = activeWindow.innerHeight - rect.top + 6;

		if (now >= this.stateUntil) {
			this.beginTravelToGround(now);
		}
	}

	private positionPet(): void {
		if (!this.petEl) {
			return;
		}

		this.petEl.style.setProperty('--pokemon-pet-face', String(this.direction));
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
		this.wildEl.style.bottom = `${72 + Math.random() * 70}px`;
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
		}, 18_000);
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

	private toggleMenu(): void {
		if (this.menuEl?.isConnected) {
			this.closeMenu();
			return;
		}
		this.petEl?.addClass('pokemon-pet-paused');
		this.renderMenu(true);
	}

	private closeMenu(): void {
		this.menuEl?.remove();
		this.menuEl = null;
		this.petEl?.removeClass('pokemon-pet-paused');
		this.lastFrameAt = window.performance.now();
	}

	private renderMenu(open = this.menuEl?.isConnected ?? false): void {
		if (!open || !this.rootEl || !this.petEl || !this.activePokemon) {
			return;
		}

		this.menuEl?.remove();
		this.menuEl = this.rootEl.createDiv({ cls: 'pokemon-pet-menu' });
		const rect = this.petEl.getBoundingClientRect();
		const menuWidth = 292;
		const maxLeft = Math.max(12, activeWindow.innerWidth - menuWidth - 12);
		const maxTop = Math.max(16, activeWindow.innerHeight - 420);
		const left =
			rect.right + 12 + menuWidth < activeWindow.innerWidth
				? rect.right + 12
				: rect.left - menuWidth - 12;
		this.menuEl.style.left = `${clamp(left, 12, maxLeft)}px`;
		this.menuEl.style.top = `${clamp(rect.top - 30, 16, maxTop)}px`;

		const header = this.menuEl.createDiv({ cls: 'pokemon-pet-menu-header' });
		header.createEl('img', {
			cls: 'pokemon-pet-menu-sprite',
			attr: { src: this.activePokemon.stillSpriteUrl, alt: this.activePokemon.name },
		});
		const title = header.createDiv({ cls: 'pokemon-pet-menu-title' });
		title.createEl('strong', { text: this.activePokemon.name });
		title.createSpan({ text: `Lv.${this.activePokemon.level} · ${RARITY_LABELS[this.activePokemon.rarity]}` });

		this.createSizeControl(this.menuEl);
		this.createCollection(this.menuEl);

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
			cls: 'mod-warning pokemon-pet-menu-button',
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
			attr: { min: '40', max: '112', step: '4' },
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

	private createCollection(container: HTMLElement): void {
		const field = container.createDiv({ cls: 'pokemon-pet-field' });
		field.createEl('label', { text: 'Collection' });
		const grid = field.createDiv({ cls: 'pokemon-pet-collection' });

		for (const pokemonId of this.plugin.settings.collection) {
			const isActive = pokemonId === this.plugin.settings.activePokemonId;
			const button = grid.createEl('button', {
				cls: `pokemon-pet-collection-item${isActive ? ' is-active' : ''}`,
				attr: { type: 'button' },
			});
			button.createEl('img', {
				attr: {
					src: makeStaticSpriteUrl(pokemonId),
					alt: getPokemonName(pokemonId),
				},
			});
			button.createSpan({ text: getPokemonName(pokemonId) });
			button.addEventListener('click', () => {
				void (async () => {
					this.plugin.settings.activePokemonId = pokemonId;
					await this.plugin.saveSettings();
					await this.refresh();
				})();
			});
		}
	}

	private closeMenuOnOutsideClick = (event: MouseEvent): void => {
		if (!this.menuEl || !this.petEl) {
			return;
		}
		const target = event.target as Node;
		if (!this.menuEl.contains(target) && !this.petEl.contains(target)) {
			this.closeMenu();
		}
	};

	private registerTypingReaction(doc: Document): () => void {
		let timeout: number | undefined;
		const onKeydown = () => {
			if (!this.petEl || this.plugin.settings.hidden || this.isMenuOpen()) {
				return;
			}
			this.petEl.addClass('pokemon-pet-react');
			if (timeout) {
				window.clearTimeout(timeout);
			}
			timeout = window.setTimeout(() => this.petEl?.removeClass('pokemon-pet-react'), 650);
		};
		doc.addEventListener('keydown', onKeydown, true);
		return () => {
			doc.removeEventListener('keydown', onKeydown, true);
			if (timeout) {
				window.clearTimeout(timeout);
			}
		};
	}

	private getRandomPerchElement(): HTMLElement | null {
		const candidates = Array.from(
			activeDocument.querySelectorAll<HTMLElement>(
				'.markdown-preview-view img, .markdown-preview-view p, .cm-content .cm-line',
			),
		).filter((element) => {
			const rect = element.getBoundingClientRect();
			const style = activeWindow.getComputedStyle(element);
			return (
				rect.width > 120 &&
				rect.height > 14 &&
				rect.top > 110 &&
				rect.bottom < activeWindow.innerHeight - 140 &&
				style.display !== 'none' &&
				style.visibility !== 'hidden'
			);
		});

		return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
	}

	private isMenuOpen(): boolean {
		return Boolean(this.menuEl?.isConnected);
	}

	private setStateClass(): void {
		if (!this.petEl) {
			return;
		}

		this.petEl.removeClass('pokemon-pet-walk', 'pokemon-pet-idle', 'pokemon-pet-travel', 'pokemon-pet-perch');
		if (this.state === 'walk') {
			this.petEl.addClass('pokemon-pet-walk');
		} else if (this.state === 'idle') {
			this.petEl.addClass('pokemon-pet-idle');
		} else if (this.state === 'perch') {
			this.petEl.addClass('pokemon-pet-perch');
		} else {
			this.petEl.addClass('pokemon-pet-travel');
		}
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

function randomBetween(min: number, max: number): number {
	return min + Math.random() * (max - min);
}

function clamp(value: number, min = 0, max = 1): number {
	return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, amount: number): number {
	return start + (end - start) * amount;
}

function smoothStep(amount: number): number {
	return amount * amount * (3 - 2 * amount);
}
