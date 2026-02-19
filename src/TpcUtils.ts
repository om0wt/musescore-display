/**
 * TPC (Tonal Pitch Class) utilities.
 *
 * MuseScore encodes note spelling as TPC on the line of fifths:
 *   -1=Fbb, 0=Cbb, ..., 13=F, 14=C, 15=G, ..., 19=B, 20=F#, ..., 33=B##
 *
 * Groups of 7 by alteration:
 *   [-1..5] = double-flat
 *   [6..12] = flat
 *   [13..19] = natural
 *   [20..26] = sharp
 *   [27..33] = double-sharp
 */

// Circle-of-fifths order within each group of 7
const STEP_NAMES = ["C", "G", "D", "A", "E", "B", "F"];

/**
 * Get the diatonic step letter (C, D, E, F, G, A, B) from a TPC value.
 */
export function tpcToStep(tpc: number): string {
  // TPC % 7 gives index into circle-of-fifths order
  // We need to handle negative TPCs: JS % can return negative
  const idx = ((tpc % 7) + 7) % 7;
  return STEP_NAMES[idx];
}

/**
 * Get the chromatic alteration (-2=bb, -1=b, 0=natural, 1=#, 2=##) from a TPC value.
 */
export function tpcToAlter(tpc: number): number {
  return Math.floor((tpc + 1) / 7) - 2;
}

/**
 * Get the MusicXML octave from a MIDI pitch number.
 * MusicXML convention: C4 = middle C = MIDI 60, octave = floor(pitch/12) - 1
 */
export function midiToOctave(midiPitch: number): number {
  return Math.floor(midiPitch / 12) - 1;
}

/**
 * Convert TPC + MIDI pitch to MusicXML pitch components.
 */
export function tpcToPitch(tpc: number, midiPitch: number): { step: string; alter: number; octave: number } {
  const step = tpcToStep(tpc);
  const alter = tpcToAlter(tpc);
  const octave = midiToOctave(midiPitch);
  return { step, alter, octave };
}

/**
 * Convert an alter value to MusicXML accidental name.
 */
export function alterToAccidentalName(alter: number): string | undefined {
  switch (alter) {
    case -2: return "flat-flat";
    case -1: return "flat";
    case 0: return "natural";
    case 1: return "sharp";
    case 2: return "double-sharp";
    default: return undefined;
  }
}
