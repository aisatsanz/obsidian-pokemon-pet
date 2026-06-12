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
import { PokemonSpriteAnimator, SpriteAnimationState } from './sprite-animator';

type Direction = -1 | 1;
type PetState = 'walk' | 'idle' | 'travel';

interface WalkSurface {
	element: HTMLElement | null;
	left: number;
	right: number;
	top: number;
}

const WALK_SPEED = 0.014;
const ENCOUNTER_INTERVAL = 75_000;
const FIRST_ENCOUNTER_DELAY = 90_000;
const MIN_SURFACE_SWITCH_DELAY = 55_000;
const MAX_SURFACE_SWITCH_DELAY = 110_000;
const SURFACE_FOOT_OFFSET = 4;
const FALLBACK_BOTTOM_OFFSET = 24;

export class PokemonPetController {
	private plugin: PokemonPetPlugin;
	private rootEl: HTMLDivElement | null = null;
	private petEl: HTMLButtonElement | null = null;
	private spriteEl: HTMLCanvasElement | null = null;
	private animator: PokemonSpriteAnimator | null = null;
	private menuEl: HTMLDivElement | null = null;
	private wildEl: HTMLButtonElement | null = null;
	private activePokemon: PokemonEntry | null = null;
	private currentSurface: WalkSurface | null = null;
	private targetSurface: WalkSurface | null = null;
	private state: PetState = 'walk';
	private x = 80;
	private y = FALLBACK_BOTTOM_OFFSET;
	private direction: Direction = 1;
	private lastFrameAt = 0;
	private stateUntil = 0;
	private lastEncounterAt = 0;
	private nextSurfaceAt = 0;
	private travelStartAt = 0;
	private travelDuration = 0;
	private startX = 0;
	private startY = FALLBACK_BOTTOM_OFFSET;
	private targetX = 80;
	private targetY = FALLBACK_BOTTOM_OFFSET;
	private removeTypingListener: (() => void) | null = null;

	constructor(plugin: PokemonPetPlugin) {
		this.plugin = plugin;
	}

	async mount(): Promise<void> {
		this.unmount();

		const now = window.performance.now();
		this.lastFrameAt = now;
		this.lastEncounterAt = now - ENCOUNTER_INTERVAL + FIRST_ENCOUNTER_DELAY;
		this.nextSurfaceAt = now + randomBetween(MIN_SURFACE_SWITCH_DELAY, MAX_SURFACE_SWITCH_DELAY);
		this.stateUntil = now + randomBetween(10_000, 24_000);

		const doc = activeDocument;
		this.rootEl = doc.body.createDiv({ cls: 'pokemon-pet-root' });
		this.petEl = this.rootEl.createEl('button', {
			cls: 'pokemon-pet pokemon-pet-walk',
			attr: { type: 'button', 'aria-label': 'Open pokemon pet menu' },
		});
		this.spriteEl = this.petEl.createEl('canvas', { cls: 'pokemon-pet-sprite' });
		this.animator = new PokemonSpriteAnimator(this.spriteEl);
		this.petEl.createDiv({ cls: 'pokemon-pet-emote', text: '!' });
		this.petEl.createDiv({ cls: 'pokemon-pet-shadow' });

		this.currentSurface = this.pickSurface();
		this.snapToSurface(this.currentSurface);

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
		this.animator = null;
		this.menuEl = null;
		this.wildEl = null;
		this.currentSurface = null;
		this.targetSurface = null;
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
		this.spriteEl.setAttribute('aria-label', this.activePokemon.name);
		this.animator?.load(this.activePokemon.stillSpriteUrl);
		this.animator?.setState(this.getAnimationState());
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
			this.animator?.setState('idle');
			return;
		}

		this.petEl.removeClass('pokemon-pet-paused');
		this.updateMovement(now);
		this.animator?.tick(now);

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

		if (this.state === 'travel') {
			this.updateTravel(now);
			this.positionPet();
			return;
		}

		this.currentSurface = this.resolveSurface(this.currentSurface);
		if (!this.currentSurface) {
			this.beginTravelToSurface(this.pickSurface(), now);
			this.positionPet();
			return;
		}

		this.y = this.getSurfaceY(this.currentSurface);
		this.x = clamp(
			this.x,
			this.currentSurface.left,
			Math.max(this.currentSurface.left, this.currentSurface.right - this.plugin.settings.size),
		);

		if (this.state === 'walk') {
			this.walkOnSurface(dt, now);
		} else if (now >= this.stateUntil) {
			this.beginWalk(now);
		}

		if (now >= this.nextSurfaceAt) {
			this.beginTravelToSurface(this.pickSurface(this.currentSurface), now);
		}

		this.positionPet();
	}

	private walkOnSurface(dt: number, now: number): void {
		if (!this.currentSurface) {
			return;
		}

		const maxX = Math.max(this.currentSurface.left, this.currentSurface.right - this.plugin.settings.size);
		this.x += this.direction * WALK_SPEED * dt;

		if (this.x <= this.currentSurface.left) {
			this.x = this.currentSurface.left;
			this.direction = 1;
			this.beginIdle(now, randomBetween(2_500, 6_000));
			return;
		}

		if (this.x >= maxX) {
			this.x = maxX;
			this.direction = -1;
			this.beginIdle(now, randomBetween(2_500, 6_000));
			return;
		}

		if (now >= this.stateUntil) {
			if (Math.random() < 0.45) {
				this.beginIdle(now, randomBetween(4_000, 9_000));
			} else {
				this.stateUntil = now + randomBetween(12_000, 26_000);
			}
		}
	}

	private beginWalk(now: number): void {
		this.state = 'walk';
		this.stateUntil = now + randomBetween(12_000, 26_000);
		this.setStateClass();
	}

	private beginIdle(now: number, duration: number): void {
		this.state = 'idle';
		this.stateUntil = now + duration;
		this.setStateClass();
	}

	private beginTravelToSurface(surface: WalkSurface | null, now: number): void {
		const target = this.resolveSurface(surface) ?? this.getFallbackSurface();
		this.nextSurfaceAt = now + randomBetween(MIN_SURFACE_SWITCH_DELAY, MAX_SURFACE_SWITCH_DELAY);

		if (!target) {
			return;
		}

		this.targetSurface = target;
		this.state = 'travel';
		this.travelStartAt = now;
		this.travelDuration = randomBetween(1_300, 2_100);
		this.startX = this.x;
		this.startY = this.y;
		this.targetX = randomBetween(
			target.left,
			Math.max(target.left, target.right - this.plugin.settings.size),
		);
		this.targetY = this.getSurfaceY(target);
		this.direction = this.targetX >= this.x ? 1 : -1;
		this.setStateClass();
	}

	private updateTravel(now: number): void {
		const surface = this.resolveSurface(this.targetSurface);
		if (surface) {
			this.targetSurface = surface;
			this.targetY = this.getSurfaceY(surface);
			this.targetX = clamp(
				this.targetX,
				surface.left,
				Math.max(surface.left, surface.right - this.plugin.settings.size),
			);
		}

		const amount = smoothStep(clamp((now - this.travelStartAt) / this.travelDuration, 0, 1));
		const lift = Math.sin(amount * Math.PI) * 34;
		this.x = lerp(this.startX, this.targetX, amount);
		this.y = lerp(this.startY, this.targetY, amount) + lift;

		if (amount >= 1) {
			this.currentSurface = this.targetSurface ?? this.getFallbackSurface();
			this.targetSurface = null;
			this.snapToSurface(this.currentSurface);
			this.beginWalk(now);
		}
	}

	private snapToSurface(surface: WalkSurface | null): void {
		const resolved = this.resolveSurface(surface) ?? this.getFallbackSurface();
		if (!resolved) {
			return;
		}

		this.currentSurface = resolved;
		this.x = clamp(
			this.x,
			resolved.left,
			Math.max(resolved.left, resolved.right - this.plugin.settings.size),
		);
		this.y = this.getSurfaceY(resolved);
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

		const surface = this.resolveSurface(this.currentSurface) ?? this.getFallbackSurface();
		const pokemon = await this.plugin.getPokemon(weightedPick(available).id);
		this.wildEl = this.rootEl.createEl('button', {
			cls: `pokemon-pet-wild pokemon-pet-rarity-${pokemon.rarity}`,
			attr: {
				type: 'button',
				'aria-label': `Catch ${pokemon.name}`,
			},
		});
		if (surface) {
			this.wildEl.style.left = `${randomBetween(surface.left, Math.max(surface.left, surface.right - 76))}px`;
			this.wildEl.style.bottom = `${this.getSurfaceY(surface) + 4}px`;
		} else {
			this.wildEl.style.left = `${Math.max(24, Math.random() * (activeWindow.innerWidth - 144))}px`;
			this.wildEl.style.bottom = `${FALLBACK_BOTTOM_OFFSET}px`;
		}
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
		this.animator?.setState('idle');
		this.renderMenu(true);
	}

	private closeMenu(): void {
		this.menuEl?.remove();
		this.menuEl = null;
		this.petEl?.removeClass('pokemon-pet-paused');
		this.lastFrameAt = window.performance.now();
		this.animator?.setState(this.getAnimationState());
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
				this.snapToSurface(this.currentSurface);
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
			this.animator?.setState('react');
			if (timeout) {
				window.clearTimeout(timeout);
			}
			timeout = window.setTimeout(() => {
				this.petEl?.removeClass('pokemon-pet-react');
				this.animator?.setState(this.getAnimationState());
			}, 650);
		};
		doc.addEventListener('keydown', onKeydown, true);
		return () => {
			doc.removeEventListener('keydown', onKeydown, true);
			if (timeout) {
				window.clearTimeout(timeout);
			}
		};
	}

	private pickSurface(exclude?: WalkSurface | null): WalkSurface | null {
		const candidates = this.getSurfaceCandidates();
		if (candidates.length === 0) {
			return this.getFallbackSurface();
		}

		const activeLine = candidates.find((surface) =>
			surface.element?.matches('.cm-activeLine, .cm-line.cm-active'),
		);
		if (activeLine && Math.random() < 0.7) {
			return activeLine;
		}

		const filtered = candidates.filter((surface) => surface.element !== exclude?.element);
		const pool = filtered.length > 0 ? filtered : candidates;
		return pool[Math.floor(Math.random() * pool.length)] ?? this.getFallbackSurface();
	}

	private getSurfaceCandidates(): WalkSurface[] {
		const selector = [
			'.workspace-leaf.mod-active .cm-activeLine',
			'.workspace-leaf.mod-active .cm-line',
			'.workspace-leaf.mod-active .markdown-preview-view p',
			'.workspace-leaf.mod-active .markdown-preview-view li',
			'.workspace-leaf.mod-active .markdown-preview-view img',
			'.workspace-leaf.mod-active .markdown-preview-view pre',
			'.workspace-leaf.mod-active .markdown-preview-view table',
			'.workspace-leaf.mod-active .markdown-preview-view .callout',
		].join(', ');
		const elements = Array.from(activeDocument.querySelectorAll<HTMLElement>(selector));
		const surfaces = elements
			.map((element) => this.surfaceFromElement(element))
			.filter((surface): surface is WalkSurface => Boolean(surface));

		return surfaces.length > 0 ? surfaces : [this.getFallbackSurface()].filter(Boolean) as WalkSurface[];
	}

	private surfaceFromElement(element: HTMLElement): WalkSurface | null {
		const rect = element.getBoundingClientRect();
		const style = activeWindow.getComputedStyle(element);
		const minWidth = Math.max(180, this.plugin.settings.size * 2.4);

		if (
			rect.width < minWidth ||
			rect.top < 84 ||
			rect.top > activeWindow.innerHeight - this.plugin.settings.size - 36 ||
			rect.right < 12 ||
			rect.left > activeWindow.innerWidth - 12 ||
			style.display === 'none' ||
			style.visibility === 'hidden' ||
			Number(style.opacity) < 0.2
		) {
			return null;
		}

		return {
			element,
			left: clamp(rect.left + 4, 12, activeWindow.innerWidth - 24),
			right: clamp(rect.right - 4, 24, activeWindow.innerWidth - 12),
			top: rect.top,
		};
	}

	private resolveSurface(surface: WalkSurface | null): WalkSurface | null {
		if (!surface) {
			return null;
		}
		if (!surface.element) {
			return this.getFallbackSurface();
		}
		return this.surfaceFromElement(surface.element);
	}

	private getFallbackSurface(): WalkSurface | null {
		const activeLeaf = activeDocument.querySelector<HTMLElement>('.workspace-leaf.mod-active .view-content');
		const rect = activeLeaf?.getBoundingClientRect();

		if (!rect) {
			return {
				element: null,
				left: 12,
				right: activeWindow.innerWidth - 12,
				top: activeWindow.innerHeight - FALLBACK_BOTTOM_OFFSET,
			};
		}

		return {
			element: activeLeaf,
			left: clamp(rect.left + 18, 12, activeWindow.innerWidth - 24),
			right: clamp(rect.right - 18, 24, activeWindow.innerWidth - 12),
			top: clamp(rect.bottom - 10, 96, activeWindow.innerHeight - FALLBACK_BOTTOM_OFFSET),
		};
	}

	private getSurfaceY(surface: WalkSurface): number {
		return activeWindow.innerHeight - surface.top + SURFACE_FOOT_OFFSET;
	}

	private isMenuOpen(): boolean {
		return Boolean(this.menuEl?.isConnected);
	}

	private setStateClass(): void {
		if (!this.petEl) {
			return;
		}

		this.petEl.removeClass('pokemon-pet-walk', 'pokemon-pet-idle', 'pokemon-pet-travel');
		if (this.state === 'walk') {
			this.petEl.addClass('pokemon-pet-walk');
		} else if (this.state === 'idle') {
			this.petEl.addClass('pokemon-pet-idle');
		} else {
			this.petEl.addClass('pokemon-pet-travel');
		}
		this.animator?.setState(this.getAnimationState());
	}

	private getAnimationState(): SpriteAnimationState {
		if (this.state === 'walk') {
			return 'walk';
		}
		if (this.state === 'travel') {
			return 'travel';
		}
		return 'idle';
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
