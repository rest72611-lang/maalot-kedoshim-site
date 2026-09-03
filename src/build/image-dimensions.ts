import { readFile } from "node:fs/promises";

export type ImageDimensions = {
  width: number;
  height: number;
};

export async function readImageDimensions(filePath: string): Promise<ImageDimensions> {
  const buffer = await readFile(filePath);

  if (isPng(buffer)) {
    return readPngDimensions(buffer, filePath);
  }

  if (isJpeg(buffer)) {
    return readJpegDimensions(buffer, filePath);
  }

  throw new Error(`Unsupported image format for dimension reading: "${filePath}" (expected PNG or JPEG).`);
}

function isPng(buffer: Buffer): boolean {
  return (
    buffer.length >= 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  );
}

function readPngDimensions(buffer: Buffer, filePath: string): ImageDimensions {
  if (buffer.length < 24) {
    throw new Error(`PNG file "${filePath}" is too small to contain a valid header.`);
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function isJpeg(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8;
}

function readJpegDimensions(buffer: Buffer, filePath: string): ImageDimensions {
  let offset = 2;

  while (offset + 9 <= buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    if (marker === undefined) {
      break;
    }

    if (marker === 0xd9) {
      break;
    }

    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

    if (isStartOfFrame) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }

    const segmentLength = buffer.readUInt16BE(offset + 2);
    offset += 2 + segmentLength;
  }

  throw new Error(`Could not locate a JPEG SOF marker to read dimensions in "${filePath}".`);
}
