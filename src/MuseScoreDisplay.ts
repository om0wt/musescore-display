/**
 * Main public API for displaying MuseScore files in the browser.
 */

import { OpenSheetMusicDisplay, TransposeCalculator, KeyInstruction, KeyEnum } from "opensheetmusicdisplay";
import { readMscx } from "./MsczReader";
import { parseMscx } from "./MscxParser";
import { convertToMusicXml } from "./MscxToMusicXml";

/** Key signature info: fifths on the circle of fifths (-7..+7) and mode. */
export interface KeySignatureInfo {
  /** Circle-of-fifths position: negative = flats, positive = sharps, 0 = C major / A minor */
  fifths: number;
  /** 0 = major, 1 = minor */
  mode: number;
  /** Human-readable name, e.g. "G major" or "E minor" */
  name: string;
}

/** Map circle-of-fifths position to major key name. */
const MAJOR_KEY_NAMES: Record<number, string> = {
  "-7": "Cb", "-6": "Gb", "-5": "Db", "-4": "Ab", "-3": "Eb", "-2": "Bb", "-1": "F",
  "0": "C", "1": "G", "2": "D", "3": "A", "4": "E", "5": "B", "6": "F#", "7": "C#",
};

/** Map circle-of-fifths position to minor key name. */
const MINOR_KEY_NAMES: Record<number, string> = {
  "-7": "Ab", "-6": "Eb", "-5": "Bb", "-4": "F", "-3": "C", "-2": "G", "-1": "D",
  "0": "A", "1": "E", "2": "B", "3": "F#", "4": "C#", "5": "G#", "6": "D#", "7": "A#",
};

function keyName(fifths: number, mode: number): string {
  const modeStr = mode === 1 ? "minor" : "major";
  const names = mode === 1 ? MINOR_KEY_NAMES : MAJOR_KEY_NAMES;
  return `${names[fifths] ?? "?"} ${modeStr}`;
}

export interface MuseScoreDisplayOptions {
  /** Whether to auto-resize on window resize. Default: true. */
  autoResize?: boolean;
  /** Initial zoom level (1.0 = 100%). Default: 1.0. */
  zoom?: number;
  /** Drawing parameters passed to OSMD. */
  drawingParameters?: string;
}

export class MuseScoreDisplay {
  private container: HTMLElement;
  private osmd: OpenSheetMusicDisplay;
  private _lastMusicXml: string = "";
  private _originalKey: KeySignatureInfo | null = null;

  constructor(container: string | HTMLElement, options?: MuseScoreDisplayOptions) {
    if (typeof container === "string") {
      const el = document.getElementById(container);
      if (!el) throw new Error(`Element with id "${container}" not found`);
      this.container = el;
    } else {
      this.container = container;
    }

    this.osmd = new OpenSheetMusicDisplay(this.container, {
      autoResize: options?.autoResize ?? true,
      drawingParameters: options?.drawingParameters ?? "default",
      autoBeam: true,
    });

    this.osmd.TransposeCalculator = new TransposeCalculator();

    if (options?.zoom) {
      this.osmd.Zoom = options.zoom;
    }
  }

  /**
   * Load and render a MuseScore file.
   *
   * @param content - Can be:
   *   - File or Blob (from file picker)
   *   - ArrayBuffer (raw bytes, ZIP or XML)
   *   - string starting with `<?xml` or `<museScore` (raw MSCX XML)
   *   - string URL to fetch
   */
  async load(content: string | Blob | ArrayBuffer | File): Promise<void> {
    let rawContent: ArrayBuffer | string;

    if (content instanceof File || content instanceof Blob) {
      rawContent = await content.arrayBuffer();
    } else if (content instanceof ArrayBuffer) {
      rawContent = content;
    } else if (typeof content === "string") {
      if (content.trimStart().startsWith("<?xml") || content.trimStart().startsWith("<museScore")) {
        rawContent = content;
      } else {
        // Treat as URL
        const response = await fetch(content);
        rawContent = await response.arrayBuffer();
      }
    } else {
      throw new Error("Unsupported content type");
    }

    // Extract MSCX XML
    const mscxXml = await readMscx(rawContent);

    // Parse to IR
    const score = parseMscx(mscxXml);

    // Convert to MusicXML
    const musicXml = convertToMusicXml(score);
    this._lastMusicXml = musicXml;

    // Load into OSMD and render
    await this.osmd.load(musicXml);
    this.osmd.render();

    // Detect original key signature from the first measure
    this._originalKey = this.detectKey();
  }

  /** Read key signature from the first measure of the loaded score. */
  private detectKey(): KeySignatureInfo | null {
    try {
      const measures = this.osmd.Sheet?.SourceMeasures;
      if (!measures || measures.length === 0) return null;
      const firstEntries = measures[0].FirstInstructionsStaffEntries;
      if (!firstEntries || firstEntries.length === 0 || !firstEntries[0]) return null;
      for (const instruction of firstEntries[0].Instructions) {
        if (instruction instanceof KeyInstruction) {
          const fifths = instruction.Key;
          const mode = instruction.Mode === KeyEnum.minor ? 1 : 0;
          return { fifths, mode, name: keyName(fifths, mode) };
        }
      }
    } catch {
      // Silently ignore detection failures
    }
    return null;
  }

  /** Set the zoom level (1.0 = 100%). */
  set zoom(value: number) {
    this.osmd.Zoom = value;
    this.osmd.render();
  }

  /** Get the current zoom level. */
  get zoom(): number {
    return this.osmd.Zoom;
  }

  /** Transpose the score by the given number of semitones and re-render. */
  transpose(semitones: number): void {
    this.osmd.Sheet.Transpose = semitones;
    this.osmd.updateGraphic();
    this.osmd.render();
  }

  /** Get the current transposition in semitones. */
  get currentTranspose(): number {
    return this.osmd.Sheet?.Transpose ?? 0;
  }

  /** Get the original key signature detected from the score (before any transposition). */
  get originalKey(): KeySignatureInfo | null {
    return this._originalKey;
  }

  /**
   * Transpose the score to a target key (specified as circle-of-fifths position)
   * and re-render. The transposition is calculated relative to the original key.
   *
   * @param targetFifths - Circle-of-fifths position of the target key (-7 to +7).
   *   For example: 0 = C major/A minor, 1 = G major/E minor, -1 = F major/D minor.
   * @param direction - "auto" picks the shortest interval (default),
   *   "up" always transposes up (0..+11), "down" always transposes down (-11..0).
   */
  transposeToKey(targetFifths: number, direction: "auto" | "up" | "down" = "auto"): void {
    if (!this._originalKey) {
      throw new Error("No key signature detected in the loaded score");
    }
    const deltaFifths = targetFifths - this._originalKey.fifths;
    let semitones = ((deltaFifths * 7) % 12 + 12) % 12; // 0..11
    if (direction === "auto") {
      if (semitones > 6) semitones -= 12;
    } else if (direction === "down") {
      if (semitones > 0) semitones -= 12;
    }
    // "up": semitones stays 0..11
    this.transpose(semitones);
  }

  // --- Cursor ---

  /** Show the cursor at its current position. */
  showCursor(): void {
    this.osmd.cursor.show();
  }

  /** Hide the cursor. */
  hideCursor(): void {
    this.osmd.cursor.hide();
  }

  /** Advance the cursor to the next beat. */
  cursorNext(): void {
    this.osmd.cursor.next();
  }

  /** Move the cursor to the previous beat. */
  cursorPrevious(): void {
    this.osmd.cursor.previous();
  }

  /** Reset the cursor to the beginning of the score. */
  cursorReset(): void {
    this.osmd.cursor.reset();
    this.osmd.cursor.show();
  }

  /** Whether the cursor is currently visible. */
  get cursorVisible(): boolean {
    return !this.osmd.cursor.Hidden;
  }

  /** Whether the view follows the cursor as it moves. */
  get followCursor(): boolean {
    return this.osmd.FollowCursor;
  }

  set followCursor(value: boolean) {
    this.osmd.FollowCursor = value;
  }

  // --- Backend ---

  /** Switch the rendering backend (svg or canvas) and re-render. */
  async setBackend(type: "svg" | "canvas"): Promise<void> {
    this.osmd.setOptions({ backend: type });
    if (this._lastMusicXml) {
      await this.osmd.load(this._lastMusicXml);
      this.osmd.render();
    }
  }

  // --- Dark Mode ---

  /** Whether dark mode is currently enabled. */
  get darkMode(): boolean {
    return this.osmd.EngravingRules.DarkModeEnabled;
  }

  /** Toggle dark mode on/off and re-render. */
  async toggleDarkMode(): Promise<void> {
    const enable = !this.osmd.EngravingRules.DarkModeEnabled;
    this.osmd.setOptions({ darkMode: enable });
    if (this._lastMusicXml) {
      await this.osmd.load(this._lastMusicXml);
      this.osmd.render();
    }
  }

  // --- Page Format ---

  /** Set page format and re-render. Format examples: "Endless", "A4_P", "A4_L", "Letter_P", "Letter_L". */
  async setPageFormat(format: string): Promise<void> {
    this.osmd.setOptions({ pageFormat: format });
    if (this._lastMusicXml) {
      await this.osmd.load(this._lastMusicXml);
      this.osmd.render();
    }
  }

  /** Clear the rendered score. */
  clear(): void {
    this.osmd.clear();
    this._lastMusicXml = "";
  }

  /** Access the underlying OSMD instance for advanced usage. */
  get osmdInstance(): OpenSheetMusicDisplay {
    return this.osmd;
  }

  /** Debug getter: the last generated MusicXML string. */
  get lastMusicXml(): string {
    return this._lastMusicXml;
  }
}
