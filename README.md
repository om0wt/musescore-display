# musescore-display

**[Live Demo](https://om0wt.github.io/musescore-display/)**

A TypeScript library that renders MuseScore `.mscz` and `.mscx` files directly in the browser.

It parses the native MuseScore XML format, converts it to MusicXML, and renders it using [OpenSheetMusicDisplay (OSMD)](https://opensheetmusicdisplay.org/).

## Features

### Notation

- Notes, rests, and chords (all standard durations)
- Dotted notes and double dots
- Accidentals (sharp, flat, natural, double sharp, double flat)
- Key signatures and time signatures
- Clefs (treble, bass, alto, tenor) and mid-measure clef changes
- Ties (v2 and v3 formats) and slurs
- Multiple voices per staff with correct positioning (v3 `<location>` offsets)
- Multiple staves per part (e.g., piano grand staff)
- Multiple parts/instruments
- Transposing instruments (written pitch via `tpc2`)
- Beat-aware beaming (respects compound meters like 6/8, 9/8, 12/8)
- Repeat barlines (forward/backward with repeat counts)
- Double barlines and final barlines (auto-emitted on last measure)
- Grace notes (appoggiatura, acciaccatura, grace16, grace32)
- Arpeggios (neutral, up, down)
- Articulations (staccato, accent, tenuto, marcato, etc.)
- Ornaments (trill, mordent, turn, inverted turn, etc.)
- Fermatas (upright, inverted; both chord-level and voice-level)
- Fingerings
- Tuplets (triplets, duplets, and other groupings with bracket display)

### Dynamics and Expression

- Dynamic markings (p, pp, mp, mf, f, ff, fp, sf, sfz, etc.)
- Hairpins / wedges (crescendo, decrescendo)
- Expression text (rit., a tempo, grazioso, con anima, etc.)
- Tempo markings with text labels (e.g., "Andante (dotted-quarter = 54)")
- Correct beat-unit and per-minute display for compound meters

### Text and Lyrics

- Title, composer, and lyricist (rendered via MusicXML credit elements)
- Multi-verse lyrics with syllabic hyphenation (begin/middle/end/single)
- Verse labels (e.g., "Kyrie: 1.", "Gloria: 2.") displayed inline on their respective verse lines

### Playback / Interactive

- Transposition by semitones (via OSMD's TransposeCalculator)
- Zoom in/out with live re-rendering

### Format Support

- MuseScore 2.x `.mscx` files (XML)
- MuseScore 3.x `.mscx` files (XML)
- MuseScore 3.x `.mscz` files (ZIP-compressed)

## Quick Start

### Install

```bash
npm install
```

### Run the Demo

```bash
npm run start
```

Opens a browser at [http://localhost:8001](http://localhost:8001) with:

- Sample file dropdown (3 included test scores)
- File picker and drag-and-drop for custom `.mscz`/`.mscx` files
- Zoom controls (+/- buttons, keyboard shortcuts)
- Transpose controls (semitone input)
- Debug tools (re-render, download generated MusicXML, clear)

### Build for Production

```bash
npm run build
```

Outputs `build/musescore-display.min.js` (UMD bundle) and TypeScript declarations.

## Usage

### Browser (Script Tag)

```html
<script src="musescore-display.min.js"></script>
<div id="score"></div>
<script>
  const display = new musescoreDisplay.MuseScoreDisplay("score");
  display.load("path/to/score.mscz");
</script>
```

### ES Module / TypeScript

```typescript
import { MuseScoreDisplay } from "musescore-display";

const display = new MuseScoreDisplay("score-container", {
  autoResize: true,
  zoom: 1.0,
  drawingParameters: "default",
});

// Load from various sources
await display.load(file);              // File or Blob (e.g., from <input type="file">)
await display.load(arrayBuffer);       // ArrayBuffer (raw bytes)
await display.load(mscxXmlString);     // Raw MSCX XML string
await display.load("https://...");     // URL (fetched automatically)

// Zoom
display.zoom = 1.5;                    // 150%
console.log(display.zoom);             // current zoom level

// Transpose
display.transpose(3);                  // up 3 semitones
display.transpose(-2);                 // down 2 semitones
display.transpose(0);                  // reset to original key

// Clear
display.clear();

// Debug: access generated MusicXML
console.log(display.lastMusicXml);

// Advanced: access underlying OSMD instance
display.osmdInstance.cursor.show();
```

### Constructor Options

| Option              | Type     | Default     | Description                                |
|---------------------|----------|-------------|--------------------------------------------|
| `autoResize`        | boolean  | `true`      | Re-render on window resize                 |
| `zoom`              | number   | `1.0`       | Initial zoom level (1.0 = 100%)            |
| `drawingParameters` | string   | `"default"` | OSMD drawing parameters preset             |

### API Reference

| Method / Property     | Type                          | Description                                          |
|-----------------------|-------------------------------|------------------------------------------------------|
| `load(content)`       | `Promise<void>`               | Load and render a score from File, Blob, ArrayBuffer, XML string, or URL |
| `zoom`                | `number` (get/set)            | Zoom level (1.0 = 100%). Setting re-renders.         |
| `transpose(semitones)`| `void`                        | Transpose the score by N semitones and re-render      |
| `currentTranspose`    | `number` (get)                | Current transposition in semitones                    |
| `clear()`             | `void`                        | Clear the rendered score                              |
| `lastMusicXml`        | `string` (get)                | The last generated MusicXML (for debugging)           |
| `osmdInstance`        | `OpenSheetMusicDisplay` (get) | Direct access to the underlying OSMD instance         |

### Lower-Level API

The individual pipeline stages are also exported for advanced use:

```typescript
import { readMscx, parseMscx, convertToMusicXml } from "musescore-display";

// 1. Extract MSCX XML from .mscz (ZIP) or pass through .mscx
const mscxXml: string = await readMscx(arrayBufferOrString);

// 2. Parse MSCX XML into an intermediate representation (IR)
const score: MscxScore = parseMscx(mscxXml);

// 3. Convert IR to MusicXML string
const musicXml: string = convertToMusicXml(score);
```

#### TPC Utilities

```typescript
import { tpcToStep, tpcToAlter, midiToOctave } from "musescore-display";

tpcToStep(14);      // "C"
tpcToAlter(14);     // 0
tpcToAlter(21);     // 1 (sharp)
midiToOctave(60);   // 4 (middle C)
```

## Architecture

```
.mscz (ZIP) or .mscx (XML)
        |
        v
  MsczReader.ts          Extract MSCX XML from ZIP or passthrough
        |
        v
  MscxParser.ts          Parse MSCX XML -> Intermediate Representation (IR)
        |                (MscxScore, MscxPart, MscxMeasure, MscxChord, etc.)
        v
  MscxToMusicXml.ts      Convert IR -> MusicXML string
        |
        v
  MuseScoreDisplay.ts    Load MusicXML into OSMD and render to SVG
        |
        v
  OpenSheetMusicDisplay  (OSMD v1.9.6) renders to the DOM
```

### Key Source Files

| File                  | Purpose                                               |
|-----------------------|-------------------------------------------------------|
| `src/MuseScoreDisplay.ts` | Public API class wrapping the full pipeline       |
| `src/MsczReader.ts`       | ZIP extraction (JSZip) for `.mscz`, passthrough for `.mscx` |
| `src/MscxParser.ts`       | MSCX XML parser (v2 + v3 formats) producing IR    |
| `src/MscxToMusicXml.ts`   | IR to MusicXML converter                           |
| `src/MscxTypes.ts`        | TypeScript interfaces for the IR                   |
| `src/TpcUtils.ts`         | Tonal Pitch Class math (TPC -> step/alter/octave)  |
| `src/ConvertHelpers.ts`   | Lookup tables for durations, clefs, accidentals    |
| `src/index.ts`            | Public exports                                     |
| `demo/demo.ts`            | Demo page logic                                    |
| `demo/index.html`         | Demo page HTML template                            |

## Demo Page

The demo page (`npm run start`) provides a full-featured testing environment:

### Controls

- **Sample dropdown** -- 4 included test scores covering v2/v3 formats, multi-part, lyrics, slurs, dynamics
- **Open File** -- file picker for any `.mscz`/`.mscx` file
- **Drag & Drop** -- drop files anywhere on the page
- **Zoom** -- +/- buttons, Reset button, keyboard shortcuts (`Ctrl/Cmd` + `+`/`-`/`0`)
- **Transpose** -- semitone input (-12 to +12) with Apply button or Enter key
- **Re-render** -- force re-render of the current score
- **Download MusicXML** -- save the generated MusicXML for inspection
- **Clear** -- remove the current score

### URL Parameters

Load a sample automatically via URL:

```
http://localhost:8001/?sample=0          # Load by index (0, 1, 2)
http://localhost:8001/?sample=hark       # Load by name substring match
http://localhost:8001/?sample=boze       # Load by name substring match
```

### Debugging

The generated MusicXML is accessible in the browser console:

```javascript
window.__lastMusicXml    // Full MusicXML string
```

You can also use the "Download MusicXML" button to save it to a file for inspection in other tools.

## Test Scores

Three test scores are included in the repository root:

| File | Format | Description |
|------|--------|-------------|
| `FileExample/Hark the Herald Angels Sing (No 209).mscx` | v2 `.mscx` | 2-staff organ arrangement |
| `hark-the-herald-angels-sing-clarinet-piano.mscz` | v3 `.mscz` | Bb clarinet + piano (transposing instrument) |
| `boze-svetov-mocny-pane-jks238-andrej-radlinsky.mscz` | v3 `.mscz` | Choir with multi-verse lyrics, slurs, verse labels |
| `serenade-a-woodall.mscz` | v3 `.mscz` | Flute + piano; dynamics, hairpins, expression text, compound meter (9/8) |

## Not Yet Implemented

The following MSCX features are not yet supported:

- Volta brackets (1st/2nd endings)
- Pedal markings
- Page layout and system/page breaks
- Chord symbols
- Coda/Segno navigation marks
- Rehearsal marks
- Multi-measure rests
- Glissando / portamento
- Tremolos
- Cross-staff notation

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| [opensheetmusicdisplay](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay) | ^1.9.6 | MusicXML rendering engine |
| [jszip](https://github.com/Stuk/jszip) | ^3.10.1 | ZIP extraction for `.mscz` files |

### Dev Dependencies

| Package | Purpose |
|---------|---------|
| typescript | TypeScript compiler |
| ts-loader | Webpack TypeScript loader |
| webpack, webpack-cli | Module bundler |
| webpack-dev-server | Development server with HMR |
| webpack-merge | Webpack config composition |
| html-webpack-plugin | HTML template processing |

## Project Structure

```
musescore-display/
  src/                  # Library source
    index.ts            # Public exports
    MuseScoreDisplay.ts # Main API class
    MsczReader.ts       # ZIP/XML reader
    MscxParser.ts       # MSCX -> IR parser
    MscxToMusicXml.ts   # IR -> MusicXML converter
    MscxTypes.ts        # IR type definitions
    TpcUtils.ts         # TPC pitch utilities
    ConvertHelpers.ts   # Lookup tables
  demo/                 # Demo application
    index.html          # HTML template
    demo.ts             # Demo logic
  build/                # Build output (gitignored)
  webpack.common.js     # Shared webpack config
  webpack.dev.js        # Dev server config (port 8001)
  webpack.prod.js       # Production build config
  tsconfig.json         # TypeScript config
  package.json          # Dependencies and scripts
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start` | Start dev server with HMR at localhost:8001 |
| `npm run build` | Production build to `build/` |
| `npm run build:dev` | Development build (with source maps) |

## License

MIT
