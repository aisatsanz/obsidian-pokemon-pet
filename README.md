# Pokemon Pet

Pokemon Pet is an Obsidian plugin that adds a collectible Pokemon companion to your workspace.

The first unlocked Pokemon is Pikachu. Your active Pokemon wanders along the bottom of the Obsidian window, can briefly hop onto text or images, and reacts when you type. Wild Pokemon occasionally appear with probabilities based on rarity. Select a wild Pokemon to throw a Pokeball and add it to your collection.

## Features

- Pixel Pokemon pet inside Obsidian.
- Pikachu unlocked by default.
- Calm pet-app style movement with long idle/walk phases and rare perching on note content.
- Rare wild encounters weighted by rarity.
- Catch animation with a Pokeball.
- Pet menu for size, collection selection, wiki link, and hiding the pet.
- Pixel-style typing reaction.
- Optional remote Pokemon data lookup with local fallback data.

## Data sources

The plugin keeps a small bundled fallback roster so it works offline. When remote data is enabled, it fetches structured Pokemon data and pixel sprites from the public PokeAPI and links each Pokemon to its Pokemon Wiki page. No vault content is sent to external services.

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
