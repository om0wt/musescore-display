/**
 * Lookup tables and helpers for MSCX → MusicXML conversion.
 */

/** Duration info: MusicXML type name and base tick count at divisions=480. */
export interface DurationInfo {
  xmlType: string;
  ticks: number;
}

/** Map from MuseScore durationType strings to MusicXML type + tick duration. */
export const DURATION_MAP: Record<string, DurationInfo> = {
  "long":    { xmlType: "long",    ticks: 7680 },
  "breve":   { xmlType: "breve",   ticks: 3840 },
  "whole":   { xmlType: "whole",   ticks: 1920 },
  "half":    { xmlType: "half",    ticks: 960 },
  "quarter": { xmlType: "quarter", ticks: 480 },
  "eighth":  { xmlType: "eighth",  ticks: 240 },
  "16th":    { xmlType: "16th",    ticks: 120 },
  "32nd":    { xmlType: "32nd",    ticks: 60 },
  "64th":    { xmlType: "64th",    ticks: 30 },
  "128th":   { xmlType: "128th",   ticks: 15 },
};

/**
 * Calculate the total tick duration for a note/rest, accounting for dots.
 * Each dot adds half of the previous value.
 */
export function calcDuration(durationType: string, dots: number): number {
  const info = DURATION_MAP[durationType];
  if (!info) return 480; // fallback to quarter
  let total = info.ticks;
  let add = info.ticks;
  for (let i = 0; i < dots; i++) {
    add = Math.floor(add / 2);
    total += add;
  }
  return total;
}

/** Clef mapping: MSCX clef name → MusicXML sign, line, and optional octave-change. */
export interface ClefInfo {
  sign: string;
  line: number;
  octaveChange?: number;
}

export const CLEF_MAP: Record<string, ClefInfo> = {
  "G":      { sign: "G", line: 2 },
  "G8va":   { sign: "G", line: 2, octaveChange: 1 },
  "G15ma":  { sign: "G", line: 2, octaveChange: 2 },
  "G8vb":   { sign: "G", line: 2, octaveChange: -1 },
  "F":      { sign: "F", line: 4 },
  "F8vb":   { sign: "F", line: 4, octaveChange: -1 },
  "F15mb":  { sign: "F", line: 4, octaveChange: -2 },
  "F8va":   { sign: "F", line: 4, octaveChange: 1 },
  "C":      { sign: "C", line: 3 },  // alto
  "C1":     { sign: "C", line: 1 },  // soprano
  "C2":     { sign: "C", line: 2 },  // mezzo-soprano
  "C3":     { sign: "C", line: 3 },  // alto
  "C4":     { sign: "C", line: 4 },  // tenor
  "C5":     { sign: "C", line: 5 },  // baritone
  "TAB":    { sign: "TAB", line: 5 },
  "PERC":   { sign: "percussion", line: 2 },
};

/**
 * Normalize MSCX accidental subtype names (v2 and v3 variants) to MusicXML names.
 */
export const ACCIDENTAL_MAP: Record<string, string> = {
  // v2 names
  "sharp":   "sharp",
  "flat":    "flat",
  "natural": "natural",
  "sharp2":  "double-sharp",
  "flat2":   "flat-flat",
  // v3 names (camelCase)
  "accidentalSharp":         "sharp",
  "accidentalFlat":          "flat",
  "accidentalNatural":       "natural",
  "accidentalDoubleSharp":   "double-sharp",
  "accidentalDoubleFlat":    "flat-flat",
  "accidentalSharp2":        "double-sharp",
  "accidentalFlat2":         "flat-flat",
  "accidentalNaturalSharp":  "natural-sharp",
  "accidentalNaturalFlat":   "natural-flat",
};

/**
 * Ornament/articulation mapping: MSCX subtype → { category, xmlElement }.
 * Categories: "ornaments", "articulations", "technical", "fermata".
 */
export interface NotationMapping {
  category: "ornaments" | "articulations" | "technical" | "fermata";
  xmlElement: string;
  /** For fermata: "upright" or "inverted" */
  fermataType?: string;
}

export const NOTATION_MAP: Record<string, NotationMapping> = {
  // Ornaments
  "ornamentTrill":          { category: "ornaments", xmlElement: "trill-mark" },
  "ornamentTurn":           { category: "ornaments", xmlElement: "turn" },
  "ornamentTurnInverted":   { category: "ornaments", xmlElement: "inverted-turn" },
  "ornamentShortTrill":     { category: "ornaments", xmlElement: "inverted-mordent" },
  "ornamentMordent":        { category: "ornaments", xmlElement: "mordent" },

  // Articulations (Above/Below variants map to the same element)
  "articStaccatoAbove":       { category: "articulations", xmlElement: "staccato" },
  "articStaccatoBelow":       { category: "articulations", xmlElement: "staccato" },
  "articStaccatissimoAbove":  { category: "articulations", xmlElement: "staccatissimo" },
  "articStaccatissimoBelow":  { category: "articulations", xmlElement: "staccatissimo" },
  "articTenutoAbove":         { category: "articulations", xmlElement: "tenuto" },
  "articTenutoBelow":         { category: "articulations", xmlElement: "tenuto" },
  "articAccentAbove":         { category: "articulations", xmlElement: "accent" },
  "articAccentBelow":         { category: "articulations", xmlElement: "accent" },
  "articMarcatoAbove":        { category: "articulations", xmlElement: "strong-accent" },
  "articMarcatoBelow":        { category: "articulations", xmlElement: "strong-accent" },

  // Technical
  "stringsUpBow":                 { category: "technical", xmlElement: "up-bow" },
  "stringsDownBow":               { category: "technical", xmlElement: "down-bow" },
  "brassMuteClosed":              { category: "technical", xmlElement: "stopped" },
  "pluckedSnapPizzicatoAbove":    { category: "technical", xmlElement: "snap-pizzicato" },
  "pluckedSnapPizzicatoBelow":    { category: "technical", xmlElement: "snap-pizzicato" },

  // Fermata
  "fermataAbove":  { category: "fermata", xmlElement: "fermata", fermataType: "upright" },
  "fermataBelow":  { category: "fermata", xmlElement: "fermata", fermataType: "inverted" },
};

/**
 * Get the default clef info for a clef name, with fallback to treble.
 */
export function getClefInfo(clefName: string): ClefInfo {
  return CLEF_MAP[clefName] || CLEF_MAP["G"];
}

/**
 * Get the MusicXML accidental name from an MSCX accidental subtype.
 */
export function getAccidentalName(mscxName: string): string | undefined {
  return ACCIDENTAL_MAP[mscxName];
}
