/**
 * Parse MSCX XML (MuseScore 2.x and 3.x) into an intermediate representation.
 */

import {
  MscxScore, MscxPart, MscxInstrument, MscxMeasure, MscxVoice,
  MscxElement, MscxChord, MscxNote, MscxRest, MscxLyric,
} from "./MscxTypes";

/** Get text content of first matching child element, or empty string. */
function childText(parent: Element, tagName: string): string {
  const el = parent.getElementsByTagName(tagName)[0];
  return el?.textContent?.trim() ?? "";
}

/** Get direct child elements with a given tag name (non-recursive). */
function directChildren(parent: Element, tagName: string): Element[] {
  const result: Element[] = [];
  for (let i = 0; i < parent.children.length; i++) {
    if (parent.children[i].tagName === tagName) {
      result.push(parent.children[i]);
    }
  }
  return result;
}

// Slur tracking: maps MSCX slur ID → MusicXML slur number (1-based)
let slurIdMap: Map<string, number>;
let nextSlurNum: number;

function getSlurNumber(slurId: string): number {
  if (!slurIdMap.has(slurId)) {
    slurIdMap.set(slurId, nextSlurNum++);
  }
  return slurIdMap.get(slurId)!;
}

// For v3 spanners: auto-increment counter since they don't have explicit IDs
let v3SlurCounter: number;

/** Parse the MSCX XML string into the IR. */
export function parseMscx(xmlString: string): MscxScore {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "text/xml");

  // Reset slur tracking for each parse
  slurIdMap = new Map();
  nextSlurNum = 1;
  v3SlurCounter = 1;

  const museScoreEl = doc.documentElement;
  const version = parseFloat(museScoreEl.getAttribute("version") || "2.0");
  const isV3 = version >= 3.0;

  const scoreEl = museScoreEl.getElementsByTagName("Score")[0];
  if (!scoreEl) {
    throw new Error("No <Score> element found in MSCX file");
  }

  const division = parseInt(childText(scoreEl, "Division")) || 480;

  // Parse metadata
  const { title, composer, lyricist } = parseMetadata(scoreEl);

  // Parse parts
  const parts = parseParts(scoreEl);

  // Parse staff data (measures)
  const staffData = parseStaffData(scoreEl, isV3);

  return { version, division, title, composer, lyricist, parts, staffData };
}

function parseMetadata(scoreEl: Element): { title: string; composer: string; lyricist: string } {
  let title = "";
  let composer = "";
  let lyricist = "";

  // From <metaTag> elements
  const metaTags = scoreEl.getElementsByTagName("metaTag");
  for (let i = 0; i < metaTags.length; i++) {
    const name = metaTags[i].getAttribute("name");
    const value = metaTags[i].textContent?.trim() ?? "";
    if (name === "workTitle" && value) title = value;
    if (name === "composer" && value) composer = value;
    if (name === "lyricist" && value) lyricist = value;
  }

  // Override from VBox title text if present
  const vboxes = scoreEl.getElementsByTagName("VBox");
  for (let i = 0; i < vboxes.length; i++) {
    const texts = vboxes[i].getElementsByTagName("Text");
    for (let j = 0; j < texts.length; j++) {
      const style = childText(texts[j], "style").toLowerCase();
      const text = childText(texts[j], "text");
      if (style === "title" && text) title = text;
      if (style === "composer" && text) composer = text;
      if (style === "lyricist" && text) lyricist = text;
    }
  }

  return { title, composer, lyricist };
}

function parseParts(scoreEl: Element): MscxPart[] {
  const parts: MscxPart[] = [];
  const partEls = directChildren(scoreEl, "Part");

  for (const partEl of partEls) {
    const staffIds: string[] = [];
    // v2/v3: <Part><Staff id="1"> — id on Staff element
    // v4: <Part id="1"><Staff> — id on Part element
    const partId = partEl.getAttribute("id");
    const staffEls = directChildren(partEl, "Staff");
    if (partId && staffEls.length > 0 && !staffEls[0].getAttribute("id")) {
      // v4 format: assign sequential IDs starting from partId
      for (let si = 0; si < staffEls.length; si++) {
        staffIds.push(String(parseInt(partId) + si));
      }
    } else {
      for (const staffEl of staffEls) {
        const id = staffEl.getAttribute("id");
        if (id) staffIds.push(id);
      }
    }

    const trackName = childText(partEl, "trackName");

    const instrumentEl = partEl.getElementsByTagName("Instrument")[0];
    const instrument = parseInstrument(instrumentEl);

    parts.push({ staffIds, trackName, instrument });
  }

  return parts;
}

function parseInstrument(el: Element | undefined): MscxInstrument {
  if (!el) {
    return {
      longName: "", shortName: "",
      transposeDiatonic: 0, transposeChromatic: 0,
      clefs: new Map(),
    };
  }

  const longName = childText(el, "longName");
  const shortName = childText(el, "shortName");
  const transposeDiatonic = parseInt(childText(el, "transposeDiatonic")) || 0;
  const transposeChromatic = parseInt(childText(el, "transposeChromatic")) || 0;

  const clefs = new Map<number, string>();
  const clefEls = el.getElementsByTagName("clef");
  for (let i = 0; i < clefEls.length; i++) {
    const staffAttr = clefEls[i].getAttribute("staff");
    const clefName = clefEls[i].textContent?.trim() ?? "G";
    if (staffAttr) {
      clefs.set(parseInt(staffAttr), clefName);
    }
  }

  return { longName, shortName, transposeDiatonic, transposeChromatic, clefs };
}

function parseStaffData(scoreEl: Element, isV3: boolean): Map<string, MscxMeasure[]> {
  const staffData = new Map<string, MscxMeasure[]>();

  // Top-level <Staff id="N"> elements that contain <Measure> children
  const allStaffs = directChildren(scoreEl, "Staff");
  for (const staffEl of allStaffs) {
    const id = staffEl.getAttribute("id");
    if (!id) continue;

    // Only staff data sections have <Measure> children (not part definition staves)
    const measureEls = directChildren(staffEl, "Measure");
    if (measureEls.length === 0) continue;

    const measures: MscxMeasure[] = [];
    for (let m = 0; m < measureEls.length; m++) {
      const measure = parseMeasure(measureEls[m], m + 1, isV3);
      measures.push(measure);
    }

    staffData.set(id, measures);
  }

  return staffData;
}

function parseMeasure(measureEl: Element, defaultNumber: number, isV3: boolean): MscxMeasure {
  const numAttr = measureEl.getAttribute("number");
  const number = numAttr ? parseInt(numAttr) : defaultNumber;

  let keySig: number | undefined;
  let timeSig: { beats: number; beatType: number } | undefined;
  let clef: string | undefined;
  let voices: MscxVoice[];

  if (isV3) {
    voices = parseV3Voices(measureEl);
    keySig = findKeySigInMeasure(measureEl);
    timeSig = findTimeSigInMeasure(measureEl);
    clef = findClefInMeasure(measureEl);
  } else {
    const parsed = parseV2Measure(measureEl);
    voices = parsed.voices;
    keySig = parsed.keySig;
    timeSig = parsed.timeSig;
    clef = parsed.clef;
  }

  // Barline properties
  const startRepeat = directChildren(measureEl, "startRepeat").length > 0 || undefined;
  const endRepeatEl = directChildren(measureEl, "endRepeat")[0];
  const endRepeat = endRepeatEl ? (parseInt(endRepeatEl.textContent ?? "2") || 2) : undefined;

  // End barline type from <BarLine><subtype> inside the measure (v3: inside voice)
  let endBarline: string | undefined;
  const barLineEls = measureEl.getElementsByTagName("BarLine");
  for (let i = 0; i < barLineEls.length; i++) {
    const sub = childText(barLineEls[i], "subtype");
    if (sub) endBarline = sub;
  }

  // Tempo (BPM)
  let tempo: number | undefined;
  const tempoEls = measureEl.getElementsByTagName("Tempo");
  if (tempoEls.length > 0) {
    const bps = parseFloat(childText(tempoEls[0], "tempo"));
    if (bps > 0) tempo = Math.round(bps * 60); // beats per second → BPM
  }

  return { number, keySig, timeSig, clef, voices, startRepeat, endRepeat, endBarline, tempo };
}

/** Parse v3 measure: voices are explicit <voice> children. */
function parseV3Voices(measureEl: Element): MscxVoice[] {
  const voices: MscxVoice[] = [];
  const voiceEls = directChildren(measureEl, "voice");

  for (const voiceEl of voiceEls) {
    const elements = parseVoiceElements(voiceEl);
    if (elements.length > 0) {
      voices.push({ elements });
    }
  }

  return voices;
}

/** Parse v2 measure: no voice wrappers. Use <tick> resets to detect voice changes. */
function parseV2Measure(measureEl: Element): {
  voices: MscxVoice[];
  keySig?: number;
  timeSig?: { beats: number; beatType: number };
  clef?: string;
} {
  let keySig: number | undefined;
  let timeSig: { beats: number; beatType: number } | undefined;
  let clef: string | undefined;

  const voiceMap = new Map<number, MscxElement[]>();
  let currentVoice = 0;
  // Track the last chord per voice for attaching lyrics
  const lastChordByVoice = new Map<number, MscxChord>();

  for (let i = 0; i < measureEl.children.length; i++) {
    const child = measureEl.children[i];

    switch (child.tagName) {
      case "KeySig": {
        const acc = childText(child, "accidental");
        if (acc) keySig = parseInt(acc);
        break;
      }
      case "TimeSig": {
        const beats = parseInt(childText(child, "sigN"));
        const beatType = parseInt(childText(child, "sigD"));
        if (beats && beatType) timeSig = { beats, beatType };
        break;
      }
      case "Clef": {
        clef = childText(child, "concertClefType") || childText(child, "subtype") || undefined;
        break;
      }
      case "tick": {
        currentVoice++;
        break;
      }
      case "Chord": {
        const track = child.getAttribute("track") ?? childText(child, "track");
        if (track) {
          currentVoice = parseInt(track) % 4;
        }
        if (!voiceMap.has(currentVoice)) voiceMap.set(currentVoice, []);
        const chord = parseChord(child);
        voiceMap.get(currentVoice)!.push(chord);
        lastChordByVoice.set(currentVoice, chord);
        break;
      }
      case "Rest": {
        const track = child.getAttribute("track") ?? childText(child, "track");
        if (track) {
          currentVoice = parseInt(track) % 4;
        }
        if (!voiceMap.has(currentVoice)) voiceMap.set(currentVoice, []);
        voiceMap.get(currentVoice)!.push(parseRest(child));
        break;
      }
      case "Lyrics": {
        // v2: Lyrics as sibling of Chord — attach to last chord
        const lastChord = lastChordByVoice.get(currentVoice);
        if (lastChord) {
          const { lyric, label } = parseLyric(child);
          if (lyric) {
            if (!lastChord.lyrics) lastChord.lyrics = [];
            lastChord.lyrics.push(lyric);
          }
          if (label) {
            if (!lastChord.verseLabels) lastChord.verseLabels = [];
            lastChord.verseLabels.push(label);
          }
        }
        break;
      }
    }
  }

  // Build ordered voices array
  const voices: MscxVoice[] = [];
  const sortedKeys = Array.from(voiceMap.keys()).sort((a, b) => a - b);
  for (const key of sortedKeys) {
    const elements = voiceMap.get(key)!;
    if (elements.length > 0) {
      voices.push({ elements });
    }
  }

  return { voices, keySig, timeSig, clef };
}

/**
 * Parse elements within a voice context (Chord, Rest, Lyrics).
 * In v3, Lyrics appear as children of the voice alongside Chord/Rest.
 * They attach to the preceding Chord.
 */
function parseVoiceElements(container: Element): MscxElement[] {
  const elements: MscxElement[] = [];
  let lastChord: MscxChord | null = null;

  for (let i = 0; i < container.children.length; i++) {
    const child = container.children[i];
    if (child.tagName === "Chord") {
      const chord = parseChord(child);
      elements.push(chord);
      lastChord = chord;
    } else if (child.tagName === "Rest") {
      elements.push(parseRest(child));
      lastChord = null;
    } else if (child.tagName === "Lyrics") {
      // Lyrics in v3 are siblings of Chord inside <voice>, attach to preceding chord
      if (lastChord) {
        const { lyric, label } = parseLyric(child);
        if (lyric) {
          if (!lastChord.lyrics) lastChord.lyrics = [];
          lastChord.lyrics.push(lyric);
        }
        if (label) {
          if (!lastChord.verseLabels) lastChord.verseLabels = [];
          lastChord.verseLabels.push(label);
        }
      }
    }
  }

  return elements;
}

function parseChord(chordEl: Element): MscxChord {
  const durationType = childText(chordEl, "durationType") || "quarter";
  const dotsStr = childText(chordEl, "dots");
  const dots = dotsStr ? parseInt(dotsStr) : 0;

  const notes: MscxNote[] = [];
  const noteEls = chordEl.getElementsByTagName("Note");
  for (let i = 0; i < noteEls.length; i++) {
    notes.push(parseNote(noteEls[i]));
  }

  // v3: Lyrics can also be direct children of Chord
  const lyrics: MscxLyric[] = [];
  const labels: { number: number; text: string }[] = [];
  const lyricEls = directChildren(chordEl, "Lyrics");
  for (const lyricEl of lyricEls) {
    const { lyric, label } = parseLyric(lyricEl);
    if (lyric) lyrics.push(lyric);
    if (label) labels.push(label);
  }

  // Slurs
  const slurStarts: number[] = [];
  const slurStops: number[] = [];

  // v2 slurs: <Slur type="start" id="N"/> or <Slur type="stop" id="N"/> as direct children
  const slurEls = directChildren(chordEl, "Slur");
  for (const slurEl of slurEls) {
    const slurType = slurEl.getAttribute("type");
    const slurId = slurEl.getAttribute("id");
    if (slurType && slurId) {
      const num = getSlurNumber(slurId);
      if (slurType === "start") slurStarts.push(num);
      else if (slurType === "stop") slurStops.push(num);
    }
  }

  // v3 slurs: <Spanner type="Slur"> with <next> (start) or <prev> (stop)
  const spannerEls = directChildren(chordEl, "Spanner");
  for (const spannerEl of spannerEls) {
    if (spannerEl.getAttribute("type") === "Slur") {
      const hasNext = directChildren(spannerEl, "next").length > 0;
      const hasPrev = directChildren(spannerEl, "prev").length > 0;
      if (hasNext && !hasPrev) {
        // Slur starts here — assign a new slur number
        const num = v3SlurCounter++;
        slurStarts.push(num);
      } else if (hasPrev && !hasNext) {
        // Slur ends here — find the matching start number
        // The most recent unmatched start gets matched
        // Use a simple heuristic: decrement from the current counter
        slurStops.push(v3SlurCounter - 1);
      }
    }
  }

  // Ornaments and articulations
  const ornaments: string[] = [];
  const articulations: string[] = [];

  const ornamentEls = directChildren(chordEl, "Ornament");
  for (const el of ornamentEls) {
    const sub = childText(el, "subtype");
    if (sub) ornaments.push(sub);
  }

  const articulationEls = directChildren(chordEl, "Articulation");
  for (const el of articulationEls) {
    const sub = childText(el, "subtype");
    if (sub) articulations.push(sub);
  }

  return {
    type: "chord", durationType, dots, notes,
    lyrics: lyrics.length > 0 ? lyrics : undefined,
    verseLabels: labels.length > 0 ? labels : undefined,
    slurStarts: slurStarts.length > 0 ? slurStarts : undefined,
    slurStops: slurStops.length > 0 ? slurStops : undefined,
    ornaments: ornaments.length > 0 ? ornaments : undefined,
    articulations: articulations.length > 0 ? articulations : undefined,
  };
}

/**
 * Parse a <Lyrics> element. Returns a lyric or a verse label text.
 * Verse labels (e.g. "Kyrie: 1.") are stored as <Lyrics> in MSCX but lack
 * <syllabic> and have <offset>/<align> for manual positioning.
 * Single-syllable words also lack <syllabic> but have no positioning overrides.
 */
function parseLyric(lyricEl: Element): { lyric: MscxLyric | null; label: { number: number; text: string } | null } {
  const text = childText(lyricEl, "text");

  // Skip empty/whitespace-only lyrics
  if (!text || !text.trim()) {
    return { lyric: null, label: null };
  }

  const noStr = childText(lyricEl, "no");
  const number = noStr ? parseInt(noStr) : 0;
  const syllabic = childText(lyricEl, "syllabic") || undefined;
  const hasOffset = directChildren(lyricEl, "offset").length > 0;
  const hasAlign = directChildren(lyricEl, "align").length > 0;

  // Verse labels: no <syllabic> + manual positioning (<offset> or <align>)
  if (!syllabic && (hasOffset || hasAlign)) {
    return { lyric: null, label: { number, text } };
  }

  // Regular lyric (missing <syllabic> means "single" for single-syllable words)
  return { lyric: { number, text, syllabic: syllabic || "single" }, label: null };
}

function parseNote(noteEl: Element): MscxNote {
  const pitch = parseInt(childText(noteEl, "pitch")) || 60;
  const tpc = parseInt(childText(noteEl, "tpc")) || 14;
  const tpc2Str = childText(noteEl, "tpc2");
  const tpc2 = tpc2Str ? parseInt(tpc2Str) : undefined;

  // Tie detection
  const tieEls = noteEl.getElementsByTagName("Tie");
  const tieStart = tieEls.length > 0;

  const spannerEls = noteEl.getElementsByTagName("endSpanner");
  const tieEnd = spannerEls.length > 0;

  // Accidental
  const accEl = noteEl.getElementsByTagName("Accidental")[0];
  let accidental: string | undefined;
  if (accEl) {
    accidental = childText(accEl, "subtype") || childText(accEl, "name") || undefined;
  }

  return { pitch, tpc, tpc2, tieStart, tieEnd, accidental };
}

function parseRest(restEl: Element): MscxRest {
  const durationType = childText(restEl, "durationType") || "quarter";
  const dotsStr = childText(restEl, "dots");
  const dots = dotsStr ? parseInt(dotsStr) : 0;
  const isMeasureRest = durationType === "measure";

  return { type: "rest", durationType, dots, isMeasureRest };
}

/** Find KeySig in measure (works for both v2 and v3). */
function findKeySigInMeasure(measureEl: Element): number | undefined {
  const keySigEls = measureEl.getElementsByTagName("KeySig");
  if (keySigEls.length === 0) return undefined;
  const el = keySigEls[0];
  const acc = childText(el, "accidental");
  if (acc) return parseInt(acc);
  const concertKey = childText(el, "concertKey");
  if (concertKey) return parseInt(concertKey);
  return undefined;
}

/** Find TimeSig in measure. */
function findTimeSigInMeasure(measureEl: Element): { beats: number; beatType: number } | undefined {
  const tsEls = measureEl.getElementsByTagName("TimeSig");
  if (tsEls.length === 0) return undefined;
  const el = tsEls[0];
  const beats = parseInt(childText(el, "sigN"));
  const beatType = parseInt(childText(el, "sigD"));
  if (beats && beatType) return { beats, beatType };
  return undefined;
}

/** Find Clef change in measure (not initial clef). */
function findClefInMeasure(measureEl: Element): string | undefined {
  const clefEls = measureEl.getElementsByTagName("Clef");
  if (clefEls.length === 0) return undefined;
  return childText(clefEls[0], "concertClefType") || childText(clefEls[0], "subtype") || undefined;
}
