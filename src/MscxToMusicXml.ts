/**
 * Convert MSCX IR to MusicXML string.
 *
 * Builds a MusicXML score-partwise document that OSMD can render.
 */

import { MscxScore, MscxPart, MscxMeasure, MscxVoice, MscxChord, MscxRest, MscxElement } from "./MscxTypes";
import { tpcToPitch } from "./TpcUtils";
import { DURATION_MAP, calcDuration, getClefInfo, getAccidentalName, NOTATION_MAP } from "./ConvertHelpers";

/**
 * Convert a parsed MscxScore to a MusicXML string.
 */
export function convertToMusicXml(score: MscxScore): string {
  const doc = document.implementation.createDocument(null, "score-partwise", null);
  const root = doc.documentElement;
  root.setAttribute("version", "3.1");

  // Work title (metadata only, not rendered by OSMD)
  if (score.title) {
    const work = appendElement(doc, root, "work");
    appendTextElement(doc, work, "work-title", score.title);
  }

  // Identification
  {
    const identification = appendElement(doc, root, "identification");
    if (score.composer) {
      const creator = appendTextElement(doc, identification, "creator", score.composer);
      creator.setAttribute("type", "composer");
    }
    if (score.lyricist) {
      const creator = appendTextElement(doc, identification, "creator", score.lyricist);
      creator.setAttribute("type", "lyricist");
    }
  }

  // Credit elements (OSMD renders these as page headers)
  if (score.title) {
    const credit = appendElement(doc, root, "credit");
    credit.setAttribute("page", "1");
    const cw = appendTextElement(doc, credit, "credit-words", score.title);
    cw.setAttribute("default-x", "612");
    cw.setAttribute("default-y", "1553");
    cw.setAttribute("justify", "center");
    cw.setAttribute("valign", "top");
    cw.setAttribute("font-size", "22");
  }
  if (score.composer) {
    const credit = appendElement(doc, root, "credit");
    credit.setAttribute("page", "1");
    const cw = appendTextElement(doc, credit, "credit-words", score.composer);
    cw.setAttribute("default-x", "1124");
    cw.setAttribute("default-y", "1453");
    cw.setAttribute("justify", "right");
    cw.setAttribute("valign", "top");
    cw.setAttribute("font-size", "10");
  }
  if (score.lyricist) {
    const credit = appendElement(doc, root, "credit");
    credit.setAttribute("page", "1");
    const cw = appendTextElement(doc, credit, "credit-words", score.lyricist);
    cw.setAttribute("default-x", "100");
    cw.setAttribute("default-y", "1453");
    cw.setAttribute("justify", "left");
    cw.setAttribute("valign", "top");
    cw.setAttribute("font-size", "10");
  }

  // Part list
  const partList = appendElement(doc, root, "part-list");
  for (let p = 0; p < score.parts.length; p++) {
    const part = score.parts[p];
    const scorePart = appendElement(doc, partList, "score-part");
    scorePart.setAttribute("id", `P${p + 1}`);
    appendTextElement(doc, scorePart, "part-name", part.trackName || part.instrument.longName || `Part ${p + 1}`);
  }

  // Parts with measures
  for (let p = 0; p < score.parts.length; p++) {
    const part = score.parts[p];
    const partEl = appendElement(doc, root, "part");
    partEl.setAttribute("id", `P${p + 1}`);

    buildPart(doc, partEl, part, score);
  }

  // Serialize to string
  const serializer = new XMLSerializer();
  let xmlStr = serializer.serializeToString(doc);

  // Add XML declaration and DOCTYPE
  const header =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" ' +
    '"http://www.musicxml.org/dtds/partwise.dtd">\n';

  return header + xmlStr;
}

function buildPart(doc: Document, partEl: Element, part: MscxPart, score: MscxScore): void {
  const numStaves = part.staffIds.length;
  const isMultiStaff = numStaves > 1;
  const isTransposing = part.instrument.transposeChromatic !== 0;

  // Get measures from first staff to determine measure count
  const firstStaffMeasures = score.staffData.get(part.staffIds[0]);
  if (!firstStaffMeasures) return;

  const measureCount = firstStaffMeasures.length;

  for (let m = 0; m < measureCount; m++) {
    const measureEl = appendElement(doc, partEl, "measure");
    measureEl.setAttribute("number", String(m + 1));

    let needAttributes = false;
    let attrKeySig: number | undefined;
    let attrTimeSig: { beats: number; beatType: number } | undefined;
    const attrClefs: { staffNum: number; clef: string }[] = [];

    // Collect attributes and barline/tempo info from all staves
    let startRepeat = false;
    let endRepeat: number | undefined;
    let endBarline: string | undefined;
    let tempo: number | undefined;

    for (let s = 0; s < numStaves; s++) {
      const staffMeasures = score.staffData.get(part.staffIds[s]);
      if (!staffMeasures || m >= staffMeasures.length) continue;
      const sm = staffMeasures[m];

      if (sm.keySig !== undefined) { attrKeySig = sm.keySig; needAttributes = true; }
      if (sm.timeSig) { attrTimeSig = sm.timeSig; needAttributes = true; }
      if (sm.clef) {
        attrClefs.push({ staffNum: s + 1, clef: sm.clef });
        needAttributes = true;
      }
      if (sm.startRepeat) startRepeat = true;
      if (sm.endRepeat) endRepeat = sm.endRepeat;
      if (sm.endBarline) endBarline = sm.endBarline;
      if (sm.tempo) tempo = sm.tempo;
    }

    // First measure always needs attributes
    if (m === 0) needAttributes = true;

    // Left barline (repeat forward)
    if (startRepeat) {
      const barline = appendElement(doc, measureEl, "barline");
      barline.setAttribute("location", "left");
      appendTextElement(doc, barline, "bar-style", "heavy-light");
      const repeat = appendElement(doc, barline, "repeat");
      repeat.setAttribute("direction", "forward");
    }

    if (needAttributes) {
      const attrs = appendElement(doc, measureEl, "attributes");

      if (m === 0) {
        appendTextElement(doc, attrs, "divisions", String(score.division));
      }

      if (attrKeySig !== undefined || m === 0) {
        const key = appendElement(doc, attrs, "key");
        appendTextElement(doc, key, "fifths", String(attrKeySig ?? 0));
      }

      if (attrTimeSig || m === 0) {
        const time = appendElement(doc, attrs, "time");
        appendTextElement(doc, time, "beats", String(attrTimeSig?.beats ?? 4));
        appendTextElement(doc, time, "beat-type", String(attrTimeSig?.beatType ?? 4));
      }

      if (m === 0 && isMultiStaff) {
        appendTextElement(doc, attrs, "staves", String(numStaves));
      }

      // Clefs
      if (m === 0) {
        for (let s = 0; s < numStaves; s++) {
          const staffNum = s + 1;
          let clefName = part.instrument.clefs.get(staffNum) ?? "G";
          if (s > 0 && !part.instrument.clefs.has(staffNum)) {
            clefName = "F";
          }
          const clefInfo = getClefInfo(clefName);
          const clefEl = appendElement(doc, attrs, "clef");
          if (isMultiStaff) clefEl.setAttribute("number", String(staffNum));
          appendTextElement(doc, clefEl, "sign", clefInfo.sign);
          appendTextElement(doc, clefEl, "line", String(clefInfo.line));
          if (clefInfo.octaveChange) {
            appendTextElement(doc, clefEl, "clef-octave-change", String(clefInfo.octaveChange));
          }
        }
      } else {
        for (const { staffNum, clef } of attrClefs) {
          const clefInfo = getClefInfo(clef);
          const clefEl = appendElement(doc, attrs, "clef");
          if (isMultiStaff) clefEl.setAttribute("number", String(staffNum));
          appendTextElement(doc, clefEl, "sign", clefInfo.sign);
          appendTextElement(doc, clefEl, "line", String(clefInfo.line));
          if (clefInfo.octaveChange) {
            appendTextElement(doc, clefEl, "clef-octave-change", String(clefInfo.octaveChange));
          }
        }
      }

      // Transpose
      if (m === 0 && isTransposing) {
        const transpose = appendElement(doc, attrs, "transpose");
        appendTextElement(doc, transpose, "diatonic", String(part.instrument.transposeDiatonic));
        appendTextElement(doc, transpose, "chromatic", String(part.instrument.transposeChromatic));
      }
    }

    // Tempo direction (before notes)
    if (tempo) {
      const direction = appendElement(doc, measureEl, "direction");
      direction.setAttribute("placement", "above");
      const dirType = appendElement(doc, direction, "direction-type");
      const metronome = appendElement(doc, dirType, "metronome");
      appendTextElement(doc, metronome, "beat-unit", "quarter");
      appendTextElement(doc, metronome, "per-minute", String(tempo));
      const sound = appendElement(doc, direction, "sound");
      sound.setAttribute("tempo", String(tempo));
    }

    // Collect verse labels from all voices in all staves (keyed by verse number)
    const pendingLabels = new Map<number, string>();
    for (let s = 0; s < numStaves; s++) {
      const staffMeasures = score.staffData.get(part.staffIds[s]);
      if (!staffMeasures || m >= staffMeasures.length) continue;
      for (const voice of staffMeasures[m].voices) {
        for (const elem of voice.elements) {
          if (elem.type === "chord" && elem.verseLabels) {
            for (const vl of elem.verseLabels) {
              pendingLabels.set(vl.number, vl.text);
            }
          }
        }
      }
    }

    // Calculate measure duration for backup
    const currentTimeSig = findCurrentTimeSig(score, part, m);
    const measureDuration = calcMeasureDuration(currentTimeSig, score.division);

    // Emit notes for each staff
    for (let s = 0; s < numStaves; s++) {
      const staffNum = s + 1;
      const staffMeasures = score.staffData.get(part.staffIds[s]);
      if (!staffMeasures || m >= staffMeasures.length) continue;
      const sm = staffMeasures[m];

      if (s > 0) {
        emitBackup(doc, measureEl, measureDuration);
      }

      const multiVoice = sm.voices.length > 1;

      for (let v = 0; v < sm.voices.length; v++) {
        if (v > 0) {
          emitBackup(doc, measureEl, measureDuration);
        }

        const voice = sm.voices[v];
        const voiceNum = s * 4 + v + 1;
        // When a staff has multiple voices, voice 0 = stems up, voice 1+ = stems down
        const stemDirection = multiVoice ? (v === 0 ? "up" : "down") : undefined;

        emitVoiceElements(doc, measureEl, voice, voiceNum, staffNum, isMultiStaff, isTransposing, part, score.division, measureDuration, pendingLabels, stemDirection);
      }
    }

    // Right barline (repeat backward, double, final)
    const isLastMeasure = m === measureCount - 1;
    if (endRepeat || endBarline || isLastMeasure) {
      const barline = appendElement(doc, measureEl, "barline");
      barline.setAttribute("location", "right");
      if (endRepeat) {
        appendTextElement(doc, barline, "bar-style", "light-heavy");
        const repeat = appendElement(doc, barline, "repeat");
        repeat.setAttribute("direction", "backward");
        if (endRepeat > 2) {
          repeat.setAttribute("times", String(endRepeat));
        }
      } else if (endBarline === "end" || isLastMeasure) {
        appendTextElement(doc, barline, "bar-style", "light-heavy");
      } else if (endBarline === "double") {
        appendTextElement(doc, barline, "bar-style", "light-light");
      }
    }
  }
}

/** Compute beam groups for consecutive beamable notes in a voice. */
function computeBeamGroups(elements: MscxElement[]): Map<number, string> {
  const beamStatus = new Map<number, string>();
  const BEAMABLE = new Set(["eighth", "16th", "32nd", "64th", "128th"]);

  let groupIndices: number[] = [];

  for (let i = 0; i <= elements.length; i++) {
    const elem = i < elements.length ? elements[i] : null;
    const isBeamable = elem !== null && elem.type === "chord" && BEAMABLE.has(elem.durationType);

    if (isBeamable) {
      groupIndices.push(i);
    } else {
      // Flush beam group (need at least 2 notes to form a beam)
      if (groupIndices.length >= 2) {
        beamStatus.set(groupIndices[0], "begin");
        for (let j = 1; j < groupIndices.length - 1; j++) {
          beamStatus.set(groupIndices[j], "continue");
        }
        beamStatus.set(groupIndices[groupIndices.length - 1], "end");
      }
      groupIndices = [];
    }
  }

  return beamStatus;
}

function emitVoiceElements(
  doc: Document, measureEl: Element, voice: MscxVoice,
  voiceNum: number, staffNum: number, isMultiStaff: boolean,
  isTransposing: boolean, part: MscxPart, division: number,
  measureDuration: number, pendingLabels: Map<number, string>,
  stemDirection?: string
): void {
  const beamGroups = computeBeamGroups(voice.elements);

  for (let i = 0; i < voice.elements.length; i++) {
    const elem = voice.elements[i];
    if (elem.type === "chord") {
      emitChord(doc, measureEl, elem, voiceNum, staffNum, isMultiStaff, isTransposing, part, pendingLabels, beamGroups.get(i), stemDirection);
    } else {
      emitRest(doc, measureEl, elem, voiceNum, staffNum, isMultiStaff, division, measureDuration, stemDirection);
    }
  }
}

function emitChord(
  doc: Document, measureEl: Element, chord: MscxChord,
  voiceNum: number, staffNum: number, isMultiStaff: boolean,
  isTransposing: boolean, part: MscxPart,
  pendingLabels: Map<number, string>,
  beamStatus?: string,
  stemDirection?: string
): void {
  const duration = calcDuration(chord.durationType, chord.dots);
  const xmlType = DURATION_MAP[chord.durationType]?.xmlType ?? "quarter";

  for (let n = 0; n < chord.notes.length; n++) {
    const note = chord.notes[n];
    const noteEl = appendElement(doc, measureEl, "note");

    // Subsequent notes in a chord get <chord/>
    if (n > 0) {
      appendElement(doc, noteEl, "chord");
    }

    // Pitch
    const pitchEl = appendElement(doc, noteEl, "pitch");
    let useTpc = note.tpc;
    let useMidi = note.pitch;
    if (isTransposing && note.tpc2 !== undefined) {
      useTpc = note.tpc2;
      useMidi = note.pitch - part.instrument.transposeChromatic;
    }
    const { step, alter, octave } = tpcToPitch(useTpc, useMidi);
    appendTextElement(doc, pitchEl, "step", step);
    if (alter !== 0) {
      appendTextElement(doc, pitchEl, "alter", String(alter));
    }
    appendTextElement(doc, pitchEl, "octave", String(octave));

    // Duration
    appendTextElement(doc, noteEl, "duration", String(duration));

    // Tie
    if (note.tieStart) {
      const tie = appendElement(doc, noteEl, "tie");
      tie.setAttribute("type", "start");
    }
    if (note.tieEnd) {
      const tie = appendElement(doc, noteEl, "tie");
      tie.setAttribute("type", "stop");
    }

    // Voice
    appendTextElement(doc, noteEl, "voice", String(voiceNum));

    // Type
    appendTextElement(doc, noteEl, "type", xmlType);

    // Dots
    for (let d = 0; d < chord.dots; d++) {
      appendElement(doc, noteEl, "dot");
    }

    // Accidental
    if (note.accidental) {
      const accName = getAccidentalName(note.accidental);
      if (accName) {
        appendTextElement(doc, noteEl, "accidental", accName);
      }
    }

    // Stem direction (for multi-voice staves)
    if (stemDirection) {
      appendTextElement(doc, noteEl, "stem", stemDirection);
    }

    // Staff (multi-staff parts)
    if (isMultiStaff) {
      appendTextElement(doc, noteEl, "staff", String(staffNum));
    }

    // Beam
    if (beamStatus) {
      appendTextElement(doc, noteEl, "beam", beamStatus).setAttribute("number", "1");
    }

    // Notations (tied, slurs, ornaments, articulations, technical, fermata)
    const hasTie = note.tieStart || note.tieEnd;
    const hasSlur = n === 0 && ((chord.slurStarts && chord.slurStarts.length > 0) || (chord.slurStops && chord.slurStops.length > 0));
    const hasOrnaments = n === 0 && chord.ornaments && chord.ornaments.length > 0;
    const hasArticulations = n === 0 && chord.articulations && chord.articulations.length > 0;
    if (hasTie || hasSlur || hasOrnaments || hasArticulations) {
      const notations = appendElement(doc, noteEl, "notations");
      if (note.tieEnd) {
        const tied = appendElement(doc, notations, "tied");
        tied.setAttribute("type", "stop");
      }
      if (note.tieStart) {
        const tied = appendElement(doc, notations, "tied");
        tied.setAttribute("type", "start");
      }
      // Slurs (only on first note of chord)
      if (n === 0) {
        if (chord.slurStops) {
          for (const num of chord.slurStops) {
            const slur = appendElement(doc, notations, "slur");
            slur.setAttribute("number", String(num));
            slur.setAttribute("type", "stop");
          }
        }
        if (chord.slurStarts) {
          for (const num of chord.slurStarts) {
            const slur = appendElement(doc, notations, "slur");
            slur.setAttribute("number", String(num));
            slur.setAttribute("type", "start");
          }
        }
      }
      // Ornaments, articulations, technical, fermata (only on first note)
      if (n === 0) {
        // Collect all subtypes from both ornaments and articulations arrays
        const allSubtypes: string[] = [
          ...(chord.ornaments || []),
          ...(chord.articulations || []),
        ];

        const ornamentXmls: string[] = [];
        const articulationXmls: string[] = [];
        const technicalXmls: string[] = [];
        const fermatas: { xmlElement: string; fermataType: string }[] = [];

        for (const sub of allSubtypes) {
          const mapping = NOTATION_MAP[sub];
          if (!mapping) continue;
          switch (mapping.category) {
            case "ornaments":
              ornamentXmls.push(mapping.xmlElement);
              break;
            case "articulations":
              articulationXmls.push(mapping.xmlElement);
              break;
            case "technical":
              technicalXmls.push(mapping.xmlElement);
              break;
            case "fermata":
              fermatas.push({ xmlElement: mapping.xmlElement, fermataType: mapping.fermataType! });
              break;
          }
        }

        if (ornamentXmls.length > 0) {
          const ornWrap = appendElement(doc, notations, "ornaments");
          for (const xmlEl of ornamentXmls) {
            appendElement(doc, ornWrap, xmlEl);
          }
        }
        if (articulationXmls.length > 0) {
          const artWrap = appendElement(doc, notations, "articulations");
          for (const xmlEl of articulationXmls) {
            appendElement(doc, artWrap, xmlEl);
          }
        }
        if (technicalXmls.length > 0) {
          const techWrap = appendElement(doc, notations, "technical");
          for (const xmlEl of technicalXmls) {
            appendElement(doc, techWrap, xmlEl);
          }
        }
        for (const f of fermatas) {
          const fermEl = appendElement(doc, notations, f.xmlElement);
          fermEl.setAttribute("type", f.fermataType);
        }
      }
    }

    // Lyrics (only on first note of chord, not on <chord/> notes)
    if (n === 0 && chord.lyrics) {
      for (const lyric of chord.lyrics) {
        const lyricEl = appendElement(doc, noteEl, "lyric");
        const mxmlNum = lyric.number + 1; // MusicXML uses 1-based
        lyricEl.setAttribute("number", String(mxmlNum));

        // Prepend pending verse label (e.g. "Kyrie: 1.") to this verse's first lyric
        const label = pendingLabels.get(lyric.number);
        if (label) {
          pendingLabels.delete(lyric.number);
          // Emit label as a separate elision-linked text before the syllable
          appendTextElement(doc, lyricEl, "text", label + " ");
          appendElement(doc, lyricEl, "elision");
        }

        if (lyric.syllabic) {
          appendTextElement(doc, lyricEl, "syllabic", lyric.syllabic);
        }
        appendTextElement(doc, lyricEl, "text", lyric.text);
      }
    }
  }
}

function emitRest(
  doc: Document, measureEl: Element, rest: MscxRest,
  voiceNum: number, staffNum: number, isMultiStaff: boolean,
  division: number, measureDuration: number,
  stemDirection?: string
): void {
  const noteEl = appendElement(doc, measureEl, "note");
  appendElement(doc, noteEl, "rest");

  let duration: number;
  let xmlType: string;

  if (rest.isMeasureRest) {
    duration = measureDuration;
    xmlType = "whole";
  } else {
    duration = calcDuration(rest.durationType, rest.dots);
    xmlType = DURATION_MAP[rest.durationType]?.xmlType ?? "quarter";
  }

  appendTextElement(doc, noteEl, "duration", String(duration));
  appendTextElement(doc, noteEl, "voice", String(voiceNum));
  appendTextElement(doc, noteEl, "type", xmlType);

  for (let d = 0; d < rest.dots; d++) {
    appendElement(doc, noteEl, "dot");
  }

  if (stemDirection) {
    appendTextElement(doc, noteEl, "stem", stemDirection);
  }

  if (isMultiStaff) {
    appendTextElement(doc, noteEl, "staff", String(staffNum));
  }
}

function emitBackup(doc: Document, measureEl: Element, duration: number): void {
  const backup = appendElement(doc, measureEl, "backup");
  appendTextElement(doc, backup, "duration", String(duration));
}

/** Find the current time signature effective at measure index m. */
function findCurrentTimeSig(score: MscxScore, part: MscxPart, measureIndex: number): { beats: number; beatType: number } {
  const staffMeasures = score.staffData.get(part.staffIds[0]);
  if (!staffMeasures) return { beats: 4, beatType: 4 };

  let current = { beats: 4, beatType: 4 };
  for (let i = 0; i <= measureIndex && i < staffMeasures.length; i++) {
    if (staffMeasures[i].timeSig) {
      current = staffMeasures[i].timeSig!;
    }
  }
  return current;
}

/** Calculate measure duration in ticks from time signature. */
function calcMeasureDuration(timeSig: { beats: number; beatType: number }, division: number): number {
  return timeSig.beats * (4 / timeSig.beatType) * division;
}

// --- DOM helpers ---

function appendElement(doc: Document, parent: Element, tagName: string): Element {
  const el = doc.createElement(tagName);
  parent.appendChild(el);
  return el;
}

function appendTextElement(doc: Document, parent: Element, tagName: string, text: string): Element {
  const el = doc.createElement(tagName);
  el.textContent = text;
  parent.appendChild(el);
  return el;
}
