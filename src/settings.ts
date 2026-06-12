import { App, PluginSettingTab, Setting } from 'obsidian';
import PokemonPetPlugin from './main';
import { POMODORO_PRESETS, PomodoroPresetId } from './pomodoro';

export interface PokemonPetSettings {
	settingsVersion: number;
	activePokemonId: number;
	collection: number[];
	hidden: boolean;
	size: number;
	encountersEnabled: boolean;
	encounterChance: number;
	useRemotePokemonData: boolean;
	pomodoroPresetId: PomodoroPresetId;
	pokemonCache: Record<string, unknown>;
}

export const DEFAULT_SETTINGS: PokemonPetSettings = {
	settingsVersion: 3,
	activePokemonId: 25,
	collection: [25],
	hidden: false,
	size: 64,
	encountersEnabled: true,
	encounterChance: 0.08,
	useRemotePokemonData: true,
	pomodoroPresetId: 'focus-25',
	pokemonCache: {},
};

export class PokemonPetSettingTab extends PluginSettingTab {
	plugin: PokemonPetPlugin;

	constructor(app: App, plugin: PokemonPetPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName('Companion').setHeading();

		new Setting(containerEl)
			.setName('Show pokemon')
			.setDesc('Display the companion in the Obsidian window.')
			.addToggle((toggle) =>
				toggle
					.setValue(!this.plugin.settings.hidden)
					.onChange(async (value) => {
						this.plugin.settings.hidden = !value;
						await this.plugin.saveSettings();
						await this.plugin.refreshPet();
					}),
			);

		new Setting(containerEl)
			.setName('Pet size')
			.setDesc('Controls the size of the active pokemon.')
			.addSlider((slider) =>
				slider
					.setLimits(40, 112, 4)
					.setDynamicTooltip()
					.setValue(this.plugin.settings.size)
					.onChange(async (value) => {
						this.plugin.settings.size = value;
						await this.plugin.saveSettings();
						await this.plugin.refreshPet();
					}),
			);

		new Setting(containerEl)
			.setName('Wild encounters')
			.setDesc('Occasionally spawn catchable pokemon based on rarity.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.encountersEnabled)
					.onChange(async (value) => {
						this.plugin.settings.encountersEnabled = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Encounter rate')
			.setDesc('Higher values create more frequent wild pokemon checks. Keep this low for a calmer pet.')
			.addSlider((slider) =>
				slider
					.setLimits(0.01, 0.2, 0.01)
					.setDynamicTooltip()
					.setValue(this.plugin.settings.encounterChance)
					.onChange(async (value) => {
						this.plugin.settings.encounterChance = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Remote pokemon data')
			.setDesc('Fetch level, rarity hints, sprite urls, and wiki links from public pokemon data apis when available.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.useRemotePokemonData)
					.onChange(async (value) => {
						this.plugin.settings.useRemotePokemonData = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl).setName('Pomodoro').setHeading();

		new Setting(containerEl)
			.setName('Default timer')
			.setDesc('Preset used by the pet menu and the start command.')
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(
						Object.fromEntries(
							POMODORO_PRESETS.map((preset) => [
								preset.id,
								`${preset.shortLabel} ${preset.label}`,
							]),
						),
					)
					.setValue(this.plugin.settings.pomodoroPresetId)
					.onChange(async (value) => {
						this.plugin.settings.pomodoroPresetId = value as PomodoroPresetId;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Reset collection')
			.setDesc('Keep pikachu and remove all other caught pokemon.')
			.addButton((button) =>
				button
					.setButtonText('Reset')
					.setWarning()
					.onClick(async () => {
						await this.plugin.resetCollection();
						this.display();
					}),
			);
	}
}
