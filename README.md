# Pokemon Pet

Pokemon Pet is an Obsidian plugin that adds a collectible Pokemon companion to your workspace.

The first unlocked Pokemon is Pikachu. Your active Pokemon wanders along the bottom of the Obsidian window, can briefly hop onto text or images, and reacts when you type. Wild Pokemon occasionally appear with probabilities based on rarity. Select a wild Pokemon to throw a Pokeball and add it to your collection.

## Features

- 70+ pixel Pokemon pet forms inside Obsidian.
- Pikachu unlocked by default.
- Calm pet-app style movement along visible Obsidian editor/preview surfaces.
- Rare wild encounters weighted by rarity.
- Catch animation with a Pokeball.
- Repeat encounters can evolve Pokemon already in your collection.
- Pet menu for size, collection selection, wiki link, and hiding the pet.
- Pomodoro timer presets with Pokemon completion notifications.
- Canvas-rendered frame animations for idle, walking, travel, and typing reactions.
- Optional remote Pokemon data lookup with local fallback data.

## Data sources

The plugin keeps a small bundled fallback roster so it works offline. When remote data is enabled, it fetches structured Pokemon data from the public PokeAPI, uses transparent pixel sprites from Pokemon Showdown, and links each Pokemon to its Pokemon Wiki page. These requests use Pokemon IDs and sprite URLs only; no vault content, note names, or personal data are sent to external services.

Pokemon Pet is an unofficial fan-made plugin. It is not affiliated with, endorsed by, sponsored by, or approved by Nintendo, Game Freak, Creatures Inc., The Pokemon Company, PokeAPI, Pokemon Showdown, or Pokemon Wiki.

## Install from source

Clone the repository into your vault plugin folder:

```bash
cd "path/to/vault/.obsidian/plugins"
git clone https://github.com/aisatsanz/obsidian-pokemon-pet.git pokemon-pet
cd pokemon-pet
npm install
npm run build
```

Then reload Obsidian and enable **Pokemon Pet** in **Settings -> Community plugins**.

For BRAT users, add this repository:

```text
https://github.com/aisatsanz/obsidian-pokemon-pet
```

## Development

```bash
npm install
npm run dev
```

For production builds:

```bash
npm run build
```

Manual Obsidian install for testing:

```bash
mkdir -p "path/to/vault/.obsidian/plugins/pokemon-pet"
cp manifest.json main.js styles.css "path/to/vault/.obsidian/plugins/pokemon-pet/"
```

Then reload Obsidian and enable **Pokemon Pet** in **Settings -> Community plugins**.

## Release artifacts

Each release should include:

- `manifest.json`
- `main.js`
- `styles.css`

## License

MIT
