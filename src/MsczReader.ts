/**
 * Extract MSCX XML from .mscz (ZIP) or .mscx (plain XML) input.
 */

import JSZip from "jszip";

/**
 * Check if data starts with ZIP magic bytes (PK\x03\x04).
 */
function isZip(data: ArrayBuffer): boolean {
  const view = new Uint8Array(data);
  return view.length >= 4 &&
    view[0] === 0x50 && view[1] === 0x4B &&
    view[2] === 0x03 && view[3] === 0x04;
}

/**
 * Extract the MSCX XML string from a .mscz ZIP archive or return .mscx string as-is.
 *
 * @param content - ArrayBuffer (ZIP or raw XML bytes) or string (raw XML)
 * @returns The MSCX XML string
 */
export async function readMscx(content: ArrayBuffer | string): Promise<string> {
  // If already a string, return directly
  if (typeof content === "string") {
    return content;
  }

  // Check if it's a ZIP file
  if (!isZip(content)) {
    // Assume it's raw XML bytes
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(content);
  }

  // Extract from ZIP
  const zip = await JSZip.loadAsync(content);

  // Try reading META-INF/container.xml to find the main score file
  const containerFile = zip.file("META-INF/container.xml");
  let mscxPath: string | undefined;

  if (containerFile) {
    const containerXml = await containerFile.async("string");
    const parser = new DOMParser();
    const doc = parser.parseFromString(containerXml, "text/xml");
    const rootfileEl = doc.getElementsByTagName("rootfile")[0];
    if (rootfileEl) {
      mscxPath = rootfileEl.getAttribute("full-path") || undefined;
    }
  }

  // If no container.xml, find any .mscx file in the ZIP
  if (!mscxPath) {
    for (const filename of Object.keys(zip.files)) {
      if (filename.endsWith(".mscx")) {
        mscxPath = filename;
        break;
      }
    }
  }

  if (!mscxPath) {
    throw new Error("No .mscx file found in the archive");
  }

  const mscxFile = zip.file(mscxPath);
  if (!mscxFile) {
    throw new Error(`Referenced file "${mscxPath}" not found in archive`);
  }

  return mscxFile.async("string");
}
