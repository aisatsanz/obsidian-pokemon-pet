import { App, PluginSettingTab, Setting } from 'obsidian';
import PokemonPetPlugin from './main';

export interface PokemonPetSettings {
	activePokemonId: number;
	collection: number[];
	hidden: boolean;
	size: number;
	encountersEnabled: boolean;
	encounterChance: number;
	useRemotePokemonData: boolean;
	pokemonCache: Record<string, unknown>;
}

export const DEFAULT_SETTINGS: PokemonPetSettings = {
	activePokemonId: 25,
	collection: [25],
	hidden: false,
	size: 96,
	encountersEnabled: true,
	encounterChance: 0.35,
	useRemotePokemonData: true,
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
					.setLimits(48, 180, 4)
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
			.setDesc('Higher values create more frequent wild pokemon checks.')
			.addSlider((slider) =>
				slider
					.setLimits(0.05, 1, 0.05)
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
