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
  /** Tempo in BPM (quarter note = X), from <Tempo> element */
  tempo?: number;
}

export interface MscxVoice {
  elements: MscxElement[];
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
}

export interface MscxNote {
  pitch: number;         // MIDI pitch
  tpc: number;           // tonal pitch class (concert)
  tpc2?: number;         // written pitch TPC (for transposing instruments, v3)
  tieStart: boolean;
  tieEnd: boolean;
  accidental?: string;   // MSCX accidental subtype
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
