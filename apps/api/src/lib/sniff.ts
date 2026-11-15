/**
 * Minimal content sniffing for uploads. The declared `Content-Type` of a multipart part is chosen
 * by the client, so the bytes have to agree with it before a file is stored and later served back
 * with that type.
 */

const startsWith = (
  bytes: Uint8Array,
  signature: readonly number[],
): boolean => signature.every((byte, index) => bytes[index] === byte);

const OLE2 = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

/** Detected type for signatures we can recognise, otherwise `null`. */
export const detectMime = (bytes: Uint8Array): string | null => {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return "image/png";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (startsWith(bytes, [0x42, 0x4d])) return "image/bmp";
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return "application/pdf";
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return "application/zip";
  if (startsWith(bytes, OLE2)) return "application/x-ole-storage";

  const head = Buffer.from(bytes.subarray(0, 32)).toString("latin1");
  if (head.startsWith("RIFF") && head.slice(8, 12) === "WEBP") {
    return "image/webp";
  }
  if (head.slice(4, 8) === "ftyp") {
    const brand = head.slice(8, 12);
    if (brand === "avif" || brand === "avis") return "image/avif";
  }

  return null;
};

const ZIP_CONTAINERS: Record<string, true> = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": true,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": true,
};

const OLE_CONTAINERS: Record<string, true> = {
  "application/msword": true,
  "application/vnd.ms-excel": true,
  "application/vnd.ms-powerpoint": true,
};

/** Whether the upload's bytes are consistent with the declared MIME type. */
export const contentMatchesMime = (
  declared: string,
  bytes: Uint8Array,
): boolean => {
  if (declared === "text/plain" || declared === "text/csv") {
    if (bytes.includes(0)) return false;
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return true;
    } catch {
      return false;
    }
  }

  const detected = detectMime(bytes);

  if (ZIP_CONTAINERS[declared]) return detected === "application/zip";
  if (OLE_CONTAINERS[declared]) return detected === "application/x-ole-storage";

  return detected === declared;
};
