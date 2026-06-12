export type PomodoroPresetId = 'focus-25' | 'break-5' | 'long-break-15' | 'deep-focus-50';

export interface PomodoroPreset {
	id: PomodoroPresetId;
	label: string;
	shortLabel: string;
	minutes: number;
	doneMessage: string;
}

export const POMODORO_PRESETS: PomodoroPreset[] = [
	{
		id: 'focus-25',
		label: 'Focus',
		shortLabel: '25m',
		minutes: 25,
		doneMessage: 'Focus time is up.',
	},
	{
		id: 'break-5',
		label: 'Short break',
		shortLabel: '5m',
		minutes: 5,
		doneMessage: 'Break is over.',
	},
	{
		id: 'long-break-15',
		label: 'Long break',
		shortLabel: '15m',
		minutes: 15,
		doneMessage: 'Long break is over.',
	},
	{
		id: 'deep-focus-50',
		label: 'Deep focus',
		shortLabel: '50m',
		minutes: 50,
		doneMessage: 'Deep focus session is complete.',
	},
];

export const DEFAULT_POMODORO_PRESET_ID: PomodoroPresetId = 'focus-25';

export function getPomodoroPreset(id: string | undefined): PomodoroPreset {
	return POMODORO_PRESETS.find((preset) => preset.id === id) ?? POMODORO_PRESETS[0]!;
}

export function normalizePomodoroPresetId(id: string | undefined): PomodoroPresetId {
	return getPomodoroPreset(id).id;
}

export function formatPomodoroTime(milliseconds: number): string {
	const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1_000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
