/**
 * Intermediate representation (IR) types for parsed MSCX data.
 */

export interface MscxScore {
  version: number;       // e.g., 2.06 or 3.02
  division: number;      // ticks per quarter note (typically 480)
  title: string;
  composer: string;
  lyricist: string;
  parts: MscxPart[];
  /** Map from staff ID (string) to array of measures for that staff. */
  staffData: Map<string, MscxMeasure[]>;
}

export interface MscxPart {
  /** Staff IDs belonging to this part (e.g., ["1", "2"] for piano). */
  staffIds: string[];
  trackName: string;
  instrument: MscxInstrument;
}

export interface MscxInstrument {
  longName: string;
  shortName: string;
  transposeDiatonic: number;
  transposeChromatic: number;
  /** Clef overrides per staff number within the part (1-indexed). */
  clefs: Map<number, string>;
}

export interface MscxMeasure {
  number: number;
  keySig?: number;       // fifths: negative=flats, positive=sharps
  timeSig?: { beats: number; beatType: number };
  clef?: string;         // clef change within this measure
  voices: MscxVoice[];
  /** Barline properties */
  startRepeat?: boolean;
  endRepeat?: number;    // repeat count (e.g. 2)
  endBarline?: string;   // "double", "end", "repeat", etc.
  /** Tempo marking from <Tempo> element */
  tempo?: MscxTempo;
}

export interface MscxTempo {
  /** Quarter-note BPM for playback (<sound> element) */
  bpm: number;
  /** Tempo text label (e.g. "Andante"), empty if metronome-only */
  text: string;
  /** Beat unit for display: "quarter", "eighth", "half", etc. */
  beatUnit: string;
  /** Whether beat unit is dotted */
  beatUnitDot: boolean;
  /** Per-minute value as displayed (e.g. 54 for dotted-quarter = 54) */
  perMinute: number;
}

export interface MscxVoice {
  elements: MscxElement[];
  /** Tick offset at the start of this voice (from v3 <location> element) */
  startOffset?: number;
}

export type MscxElement = MscxChord | MscxRest;

export interface MscxChord {
  type: "chord";
  durationType: string;
  dots: number;
  notes: MscxNote[];
  lyrics?: MscxLyric[];
  /** Verse labels (e.g. "Kyrie: 1.") keyed by verse number (0-based). */
  verseLabels?: { number: number; text: string }[];
  /** Slur starts on this chord (slur number for MusicXML). */
  slurStarts?: number[];
  /** Slur ends on this chord (slur number for MusicXML). */
  slurStops?: number[];
  /** Ornament subtypes, e.g. ["ornamentTrill"] */
  ornaments?: string[];
  /** Articulation subtypes, e.g. ["articStaccatoBelow", "fermataAbove"] */
  articulations?: string[];
  /** Grace note type (chord is a grace note preceding a main chord). */
  graceType?: "appoggiatura" | "acciaccatura" | "grace16" | "grace32";
  /** Arpeggio subtype: 0=neutral, 1=up, 2=down */
  arpeggio?: number;
  /** Voice-level fermata (v4 format): "fermataAbove" or "fermataBelow" */
  fermata?: string;
  /** Dynamic marking before this chord (e.g. "p", "mf", "sf") */
  dynamic?: { subtype: string; velocity?: number };
  /** Hairpin (wedge) starts on this chord. subtype: 0=crescendo, 1=decrescendo */
  hairpinStarts?: { number: number; subtype: number }[];
  /** Hairpin (wedge) stops on this chord */
  hairpinStops?: number[];
  /** Expression/staff text marking (e.g. "rit.", "a tempo", "grazioso") */
  expressionText?: string;
}

export interface MscxNote {
  pitch: number;         // MIDI pitch
  tpc: number;           // tonal pitch class (concert)
  tpc2?: number;         // written pitch TPC (for transposing instruments, v3)
  tieStart: boolean;
  tieEnd: boolean;
  accidental?: string;   // MSCX accidental subtype
  fingering?: string;    // e.g. "2"
}

export interface MscxRest {
  type: "rest";
  durationType: string;
  dots: number;
  isMeasureRest: boolean;
}

export interface MscxLyric {
  /** Verse number (0-based). <no> element, defaults to 0. */
  number: number;
  text: string;
  /** Syllabic type: single, begin, middle, end */
  syllabic?: string;
}
