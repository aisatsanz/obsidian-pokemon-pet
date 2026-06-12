import { Notice } from 'obsidian';
import PokemonPetPlugin from './main';
import {
	FALLBACK_POKEMON,
	PokemonEntry,
	RARITY_LABELS,
	RARITY_WEIGHTS,
	WILD_POKEMON_IDS,
	getPokemonName,
	getNextEvolutionId,
	makeStaticSpriteUrl,
} from './pokemon';
import {
	POMODORO_PRESETS,
	PomodoroPresetId,
	formatPomodoroTime,
	getPomodoroPreset,
} from './pomodoro';
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
const SURFACE_FOOT_OFFSET = 0;
const FALLBACK_BOTTOM_OFFSET = 24;

export class PokemonPetController {
	private plugin: PokemonPetPlugin;
	private rootEl: HTMLDivElement | null = null;
	private petEl: HTMLButtonElement | null = null;
	private spriteEl: HTMLCanvasElement | null = null;
	private emoteEl: HTMLDivElement | null = null;
	private animator: PokemonSpriteAnimator | null = null;
	private menuEl: HTMLDivElement | null = null;
	private wildEl: HTMLButtonElement | null = null;
	private pomodoroStatusEl: HTMLSpanElement | null = null;
	private pomodoroRemainingEl: HTMLSpanElement | null = null;
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
	private pomodoroPresetId: PomodoroPresetId = 'focus-25';
	private pomodoroEndsAt = 0;
	private lastPomodoroDisplaySecond = -1;
	private reactionResetTimeout: number | undefined;
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
		this.emoteEl = this.petEl.createDiv({ cls: 'pokemon-pet-emote', text: '!' });

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
		this.emoteEl = null;
		this.animator = null;
		this.menuEl = null;
		this.wildEl = null;
		this.pomodoroStatusEl = null;
		this.pomodoroRemainingEl = null;
		this.currentSurface = null;
		this.targetSurface = null;
		if (this.reactionResetTimeout) {
			window.clearTimeout(this.reactionResetTimeout);
			this.reactionResetTimeout = undefined;
		}
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
		if (!this.rootEl || !this.petEl) {
			return;
		}

		this.updatePomodoro(now);

		if (this.plugin.settings.hidden) {
			return;
		}

		if (this.isMenuOpen()) {
			this.lastFrameAt = now;
			this.petEl.addClass('pokemon-pet-paused');
			if (this.petEl.classList.contains('pokemon-pet-react')) {
				this.animator?.tick(now);
			} else {
				this.animator?.setState('idle');
			}
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

	startPomodoro(presetId = this.plugin.settings.pomodoroPresetId): void {
		const preset = getPomodoroPreset(presetId);
		const now = window.performance.now();
		this.pomodoroPresetId = preset.id;
		this.pomodoroEndsAt = now + preset.minutes * 60_000;
		this.lastPomodoroDisplaySecond = -1;
		this.plugin.settings.pomodoroPresetId = preset.id;
		void this.plugin.saveSettings();
		this.updatePomodoroDisplay(now);
		this.playPetReaction('GO', 900);
		new Notice(`${preset.label} started: ${preset.minutes} minutes.`);
		this.renderMenu();
	}

	stopPomodoro(showNotice = true): void {
		if (!this.isPomodoroRunning()) {
			return;
		}
		this.pomodoroEndsAt = 0;
		this.lastPomodoroDisplaySecond = -1;
		this.updatePomodoroDisplay(window.performance.now());
		if (showNotice) {
			new Notice('Pomodoro stopped.');
		}
		this.renderMenu();
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
			(pokemon) =>
				(WILD_POKEMON_IDS.has(pokemon.id) &&
					!this.plugin.settings.collection.includes(pokemon.id)) ||
				this.canEvolveFromEncounter(pokemon.id),
		);
		if (available.length === 0) {
			return;
		}

		const surface = this.resolveSurface(this.currentSurface) ?? this.getFallbackSurface();
		const pokemon = await this.plugin.getPokemon(weightedPick(available).id);
		const isEvolutionEncounter = this.canEvolveFromEncounter(pokemon.id);
		const nextEvolutionName = isEvolutionEncounter
			? getPokemonName(getNextEvolutionId(pokemon.id)!)
			: null;
		this.wildEl = this.rootEl.createEl('button', {
			cls: `pokemon-pet-wild pokemon-pet-rarity-${pokemon.rarity}${isEvolutionEncounter ? ' pokemon-pet-wild-evolution' : ''}`,
			attr: {
				type: 'button',
				'aria-label': isEvolutionEncounter
					? `Evolve ${pokemon.name}`
					: `Catch ${pokemon.name}`,
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
			text: isEvolutionEncounter && nextEvolutionName
				? `${pokemon.name} -> ${nextEvolutionName}`
				: `${pokemon.name} Lv.${pokemon.level}`,
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
			void (async () => {
				this.wildEl?.remove();
				this.wildEl = null;
				ball.remove();

				const evolved = await this.plugin.evolveCollectionPokemon(pokemon.id);
				if (evolved) {
					new Notice(`${pokemon.name} evolved into ${evolved.name}.`);
					this.playPetReaction('UP', 1_400);
				} else {
					await this.plugin.addToCollection(pokemon.id);
					new Notice(`${pokemon.name} joined your collection.`);
				}

				this.renderMenu();
			})();
		}, 720);
	}

	private canEvolveFromEncounter(id: number): boolean {
		const nextId = getNextEvolutionId(id);
		return Boolean(nextId && this.plugin.settings.collection.includes(id));
	}

	private updatePomodoro(now: number): void {
		if (!this.isPomodoroRunning()) {
			this.updatePomodoroDisplay(now);
			return;
		}

		if (now >= this.pomodoroEndsAt) {
			this.finishPomodoro(now);
			return;
		}

		this.updatePomodoroDisplay(now);
	}

	private finishPomodoro(now: number): void {
		const preset = getPomodoroPreset(this.pomodoroPresetId);
		const pokemonName = this.activePokemon?.name ?? 'Pokemon';
		this.pomodoroEndsAt = 0;
		this.lastPomodoroDisplaySecond = -1;
		this.updatePomodoroDisplay(now);
		this.playPetReaction('DONE', 3_200, true);
		new Notice(`${pokemonName}: ${preset.doneMessage}`);
		this.renderMenu();
	}

	private isPomodoroRunning(): boolean {
		return this.pomodoroEndsAt > 0;
	}

	private updatePomodoroDisplay(now: number): void {
		if (!this.pomodoroStatusEl || !this.pomodoroRemainingEl) {
			return;
		}

		if (!this.isPomodoroRunning()) {
			const preset = getPomodoroPreset(this.plugin.settings.pomodoroPresetId);
			this.pomodoroStatusEl.setText('Ready');
			this.pomodoroRemainingEl.setText(formatPomodoroTime(preset.minutes * 60_000));
			this.lastPomodoroDisplaySecond = -1;
			return;
		}

		const remainingMs = Math.max(0, this.pomodoroEndsAt - now);
		const remainingSecond = Math.ceil(remainingMs / 1_000);
		if (remainingSecond === this.lastPomodoroDisplaySecond) {
			return;
		}

		this.lastPomodoroDisplaySecond = remainingSecond;
		const preset = getPomodoroPreset(this.pomodoroPresetId);
		this.pomodoroStatusEl.setText(preset.label);
		this.pomodoroRemainingEl.setText(formatPomodoroTime(remainingMs));
	}

	private playPetReaction(text: string, duration: number, isPomodoroDone = false): void {
		if (!this.petEl) {
			return;
		}

		if (this.reactionResetTimeout) {
			window.clearTimeout(this.reactionResetTimeout);
		}

		this.emoteEl?.setText(text);
		this.petEl.addClass('pokemon-pet-react');
		if (isPomodoroDone) {
			this.petEl.addClass('pokemon-pet-pomodoro-done');
		} else {
			this.petEl.removeClass('pokemon-pet-pomodoro-done');
		}
		this.animator?.setState('react');
		this.reactionResetTimeout = window.setTimeout(() => {
			this.petEl?.removeClass('pokemon-pet-react', 'pokemon-pet-pomodoro-done');
			this.emoteEl?.setText('!');
			this.animator?.setState(this.isMenuOpen() ? 'idle' : this.getAnimationState());
			this.reactionResetTimeout = undefined;
		}, duration);
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
		const margin = 12;
		const viewportHeight = activeWindow.innerHeight;
		const spaceBelow = viewportHeight - rect.bottom - margin;
		const spaceAbove = rect.top - margin;
		const openBelow = spaceBelow >= 300 || spaceBelow >= spaceAbove;
		const maxMenuHeight = Math.max(180, Math.min(560, viewportHeight - margin * 2));
		const menuHeight = clamp(
			openBelow ? spaceBelow : spaceAbove,
			Math.min(260, maxMenuHeight),
			maxMenuHeight,
		);
		const maxLeft = Math.max(12, activeWindow.innerWidth - menuWidth - 12);
		const maxTop = Math.max(margin, viewportHeight - menuHeight - margin);
		const left =
			rect.right + 12 + menuWidth < activeWindow.innerWidth
				? rect.right + 12
				: rect.left - menuWidth - 12;
		this.menuEl.style.left = `${clamp(left, 12, maxLeft)}px`;
		this.menuEl.style.top = `${clamp(openBelow ? rect.bottom + 8 : rect.top - menuHeight - 8, margin, maxTop)}px`;
		this.menuEl.style.maxHeight = `${menuHeight}px`;

		const header = this.menuEl.createDiv({ cls: 'pokemon-pet-menu-header' });
		header.createEl('img', {
			cls: 'pokemon-pet-menu-sprite',
			attr: { src: this.activePokemon.stillSpriteUrl, alt: this.activePokemon.name },
		});
		const title = header.createDiv({ cls: 'pokemon-pet-menu-title' });
		title.createEl('strong', { text: this.activePokemon.name });
		title.createSpan({ text: `Lv.${this.activePokemon.level} · ${RARITY_LABELS[this.activePokemon.rarity]}` });

		this.createSizeControl(this.menuEl);
		this.createPomodoroControl(this.menuEl);
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

	private createPomodoroControl(container: HTMLElement): void {
		const field = container.createDiv({ cls: 'pokemon-pet-field' });
		field.createEl('label', { text: 'Pomodoro' });
		const panel = field.createDiv({ cls: 'pokemon-pet-pomodoro' });
		const readout = panel.createDiv({ cls: 'pokemon-pet-pomodoro-readout' });
		this.pomodoroStatusEl = readout.createSpan({ cls: 'pokemon-pet-pomodoro-status' });
		this.pomodoroRemainingEl = readout.createSpan({ cls: 'pokemon-pet-pomodoro-time' });

		const presets = panel.createDiv({ cls: 'pokemon-pet-pomodoro-presets' });
		const activePresetId = this.isPomodoroRunning()
			? this.pomodoroPresetId
			: this.plugin.settings.pomodoroPresetId;
		for (const preset of POMODORO_PRESETS) {
			const isActive = preset.id === activePresetId;
			const button = presets.createEl('button', {
				cls: `pokemon-pet-pomodoro-preset${isActive ? ' is-active' : ''}`,
				attr: { type: 'button' },
			});
			button.createSpan({ text: preset.shortLabel });
			button.createSpan({ text: preset.label });
			button.addEventListener('click', () => {
				void (async () => {
					this.plugin.settings.pomodoroPresetId = preset.id;
					await this.plugin.saveSettings();
					this.renderMenu(true);
				})();
			});
		}

		const actions = panel.createDiv({ cls: 'pokemon-pet-pomodoro-actions' });
		actions.createEl('button', {
			text: this.isPomodoroRunning() ? 'Restart' : 'Start',
			cls: 'pokemon-pet-menu-button mod-cta',
			attr: { type: 'button' },
		}).addEventListener('click', () => {
			this.startPomodoro();
		});

		const stopButton = actions.createEl('button', {
			text: 'Stop',
			cls: 'pokemon-pet-menu-button',
			attr: { type: 'button' },
		});
		stopButton.disabled = !this.isPomodoroRunning();
		stopButton.addEventListener('click', () => {
			this.stopPomodoro();
		});

		this.updatePomodoroDisplay(window.performance.now());
	}

	private createCollection(container: HTMLElement): void {
		const field = container.createDiv({ cls: 'pokemon-pet-field pokemon-pet-collection-field' });
		field.createEl('label', { text: 'Collection' });
		const grid = field.createDiv({ cls: 'pokemon-pet-collection' });

		for (const pokemon of FALLBACK_POKEMON) {
			const pokemonId = pokemon.id;
			const isUnlocked = this.plugin.settings.collection.includes(pokemonId);
			const isActive = pokemonId === this.plugin.settings.activePokemonId;
			const button = grid.createEl('button', {
				cls: `pokemon-pet-collection-item${isActive ? ' is-active' : ''}${isUnlocked ? '' : ' is-locked'}`,
				attr: {
					type: 'button',
					'aria-label': isUnlocked ? `Select ${pokemon.name}` : 'Locked pokemon',
				},
			});
			button.createEl('img', {
				cls: isUnlocked ? '' : 'pokemon-pet-locked-sprite',
				attr: {
					src: makeStaticSpriteUrl(pokemon.name),
					alt: isUnlocked ? pokemon.name : 'Locked',
				},
			});
			button.createSpan({ text: isUnlocked ? getPokemonName(pokemonId) : '???' });
			button.disabled = !isUnlocked;
			button.addEventListener('click', () => {
				if (!isUnlocked) {
					return;
				}
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
			if (this.petEl.classList.contains('pokemon-pet-pomodoro-done')) {
				return;
			}
			this.playPetReaction('!', 650);
			if (timeout) {
				window.clearTimeout(timeout);
			}
			timeout = window.setTimeout(() => {
				this.petEl?.removeClass('pokemon-pet-react', 'pokemon-pet-pomodoro-done');
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

		const filtered = candidates.filter((surface) => surface.element !== exclude?.element);
		const pool = filtered.length > 0 ? filtered : candidates;
		return pool[Math.floor(Math.random() * pool.length)] ?? this.getFallbackSurface();
	}

	private getSurfaceCandidates(): WalkSurface[] {
		const selector = [
			'img',
			'video',
			'.workspace-leaf',
			'.cm-callout',
			'.HyperMD-codeblock-begin',
			'.status-bar',
			'.mobile-navbar',
			'.callout',
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
		const minWidth = 100;

		if (
			rect.width < minWidth ||
			rect.left < 0 ||
			rect.top < 80 ||
			rect.right > activeWindow.innerWidth ||
			rect.top > activeWindow.innerHeight ||
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
