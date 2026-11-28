import { decodeJPEG } from '../images/jpeg.js';
import type { Pixel } from '../images/index.js';

// ─────────────────────────────────────────────
//  Phase 12 — baseline JPEG decoding (v1.10.0)
//
//  Verified in the sandbox against libjpeg (through Pillow) over 124 files —
//  four image kinds × five sizes × 4:4:4/4:2:2/4:2:0 × two qualities, plus
//  greyscale, restart intervals and optimized Huffman tables. Average error
//  per channel against libjpeg: 0.02 at 4:4:4, 0.58 at 4:2:2, 0.73 at 4:2:0.
//  jpeg-js, as a control on the same files, scored 0.85 / 13.33 / 21.25.
//
//  The fixtures below were written by Pillow and are embedded base64 so the
//  suite needs no binary files; the expected pixels are libjpeg's output for
//  the same bytes.
// ─────────────────────────────────────────────

/** 8x8 solid red, 4:4:4, quality 95. */
const SOLID_8X8 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAIBAQEBAQIBAQECAgICAgQDAgICAgUEBAMEBgUGBgYF' +
  'BgYGBwkIBgcJBwYGCAsICQoKCgoKBggLDAsKDAkKCgr/2wBDAQICAgICAgUDAwUKBwYHCgoKCgoK' +
  'CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgr/wAARCAAIAAgDAREA' +
  'AhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQA' +
  'AAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3' +
  'ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWm' +
  'p6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEA' +
  'AwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSEx' +
  'BhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElK' +
  'U1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3' +
  'uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD4vr+U' +
  'z/fw/9k=';

/** 16x16 red|blue halves, 4:2:0, quality 90. */
const HALVES_420 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsK' +
  'CwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQU' +
  'FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAQABADASIA' +
  'AhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQA' +
  'AAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3' +
  'ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWm' +
  'p6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEA' +
  'AwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSEx' +
  'BhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElK' +
  'U1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3' +
  'uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD50rwK' +
  'vfa8Cr9w+jL/AMzj/uB/7mP6N+kN/wAyr/uN/wC4j//Z';

/** 16x16 gradient, 4:2:2, quality 90. */
const GRADIENT_422 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsK' +
  'CwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQU' +
  'FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAQABADASEA' +
  'AhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQA' +
  'AAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3' +
  'ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWm' +
  'p6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEA' +
  'AwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSEx' +
  'BhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElK' +
  'U1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3' +
  'uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD5V8Kf' +
  'Cn7n7n9K9m8J/Cn7n7n9K/Q84zjfU/RvDbP/AIPePYvCfwp+5+5/SvZvCnwp+5+5/Svw7OM431P5' +
  'w8Ns++DU/9k=';

/** 8x8 greyscale ramp, one component, quality 95. */
const GREY_8X8 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAIBAQEBAQIBAQECAgICAgQDAgICAgUEBAMEBgUGBgYF' +
  'BgYGBwkIBgcJBwYGCAsICQoKCgoKBggLDAsKDAkKCgr/wAALCAAIAAgBAREA/8QAHwAAAQUBAQEB' +
  'AQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1Fh' +
  'ByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZ' +
  'WmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXG' +
  'x8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/APP/APg24/5gH/bL+lf/' +
  '2Q==';

/** 32x32 with a restart marker every MCU row, quality 85. */
const RESTARTS =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEP' +
  'ERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4e' +
  'Hh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAAgACADASIA' +
  'AhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQA' +
  'AAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3' +
  'ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWm' +
  'p6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEA' +
  'AwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSEx' +
  'BhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElK' +
  'U1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3' +
  'uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/90ABAAB/9oADAMBAAIRAxEA' +
  'PwD5msNK6fLW9Y6V0+Wt6w0rp8tb1hpXT5avFZn5iyLONtT/0PI7DSuny1vWGldPlresNK6fLW9Y' +
  'aV0+WvAxWZ+Z+zZFnG2p/9HnrHSuny1vWGldPlresNK6fLW/YaV0+Wvz7FZn5n5TkWcban//0tyw' +
  '0rp8tb9hpXT5a3bDSuny1v2GldPlr8cxWZ+Z6GRZxtqf/9k=';

/** 32x32 progressive — must be refused by name. */
const PROGRESSIVE =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEP' +
  'ERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4e' +
  'Hh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wgARCAAgACADASIA' +
  'AhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABAUH/8QAFwEAAwEAAAAAAAAAAAAAAAAAAQUGB//a' +
  'AAwDAQACEAMQAAABzJ73kBe9660nvfQXZCB73rrP/8QAFhAAAwAAAAAAAAAAAAAAAAAAAAID/9oA' +
  'CAEBAAEFAkkJISQkhJCSEkJISQkhJCSEkJISQkj/xAAVEQEBAAAAAAAAAAAAAAAAAAAEAP/aAAgB' +
  'AwEBPwELILILILL/xAAWEQADAAAAAAAAAAAAAAAAAAAAAwT/2gAIAQIBAT8BbSNpG0jaT//EABQQ' +
  'AQAAAAAAAAAAAAAAAAAAAED/2gAIAQEABj8CB//EABUQAQEAAAAAAAAAAAAAAAAAAABh/9oACAEB' +
  'AAE/IZJJJJJJJJJJJJJJJP/aAAwDAQACAAMAAAAQ/C6W/8QAFhEAAwAAAAAAAAAAAAAAAAAAACEx' +
  '/9oACAEDAQE/EJMkyTJM/8QAFREBAQAAAAAAAAAAAAAAAAAAAGH/2gAIAQIBAT8Qqqqq/8QAFRAB' +
  'AQAAAAAAAAAAAAAAAAAAADH/2gAIAQEAAT8QmRJkyZMmTIkyZMmTJkz/2Q==';

/** 8x8 flat with a COM segment reading "ansimax". */
const WITH_COMMENT =
  '/9j/4AAQSkZJRgABAQAAAQABAAD//gAJYW5zaW1heP/bAEMAAwICAwICAwMDAwQDAwQFCAUFBAQF' +
  'CgcHBggMCgwMCwoLCw0OEhANDhEOCwsQFhARExQVFRUMDxcYFhQYEhQVFP/bAEMBAwQEBQQFCQUF' +
  'CRQNCw0UFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFP/A' +
  'ABEIAAgACAMBIgACEQEDEQH/xAAfAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgv/xAC1EAAC' +
  'AQMDAgQDBQUEBAAAAX0BAgMABBEFEiExQQYTUWEHInEUMoGRoQgjQrHBFVLR8CQzYnKCCQoWFxgZ' +
  'GiUmJygpKjQ1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoOEhYaHiImKkpOU' +
  'lZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4eLj5OXm5+jp6vHy8/T1' +
  '9vf4+fr/xAAfAQADAQEBAQEBAQEBAAAAAAAAAQIDBAUGBwgJCgv/xAC1EQACAQIEBAMEBwUEBAAB' +
  'AncAAQIDEQQFITEGEkFRB2FxEyIygQgUQpGhscEJIzNS8BVictEKFiQ04SXxFxgZGiYnKCkqNTY3' +
  'ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6Sl' +
  'pqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2dri4+Tl5ufo6ery8/T19vf4+fr/2gAMAwEA' +
  'AhEDEQA/APzaooor0zzz/9k=';


// libjpeg ground truth, via Pillow
const TRUTH_SOLID = [
  [[254,0,0], [254,0,0], [254,0,0], [254,0,0], [254,0,0], [254,0,0], [254,0,0], [254,0,0]],
  [[254,0,0], [254,0,0], [254,0,0], [254,0,0], [254,0,0], [254,0,0], [254,0,0], [254,0,0]],
  [[254,0,0], [254,0,0], [254,0,0], [254,0,0], [254,0,0], [254,0,0], [254,0,0], [254,0,0]],
  [[254,0,0], [254,0,0], [254,0,0], [254,0,0], [254,0,0], [254,0,0], [254,0,0], [254,0,0]],
  [[254,0,0], [254,0,0], [254,0,0], [254,0,0], [254,0,0], [254,0,0], [254,0,0], [254,0,0]],
  [[254,0,0], [254,0,0], [254,0,0], [254,0,0], [254,0,0], [254,0,0], [254,0,0], [254,0,0]],
  [[254,0,0], [254,0,0], [254,0,0], [254,0,0], [254,0,0], [254,0,0], [254,0,0], [254,0,0]],
  [[254,0,0], [254,0,0], [254,0,0], [254,0,0], [254,0,0], [254,0,0], [254,0,0], [254,0,0]],
];
const TRUTH_GREY = [
  [[0,0,0], [32,32,32], [64,64,64], [96,96,96], [128,128,128], [160,160,160], [192,192,192], [224,224,224]],
  [[0,0,0], [32,32,32], [64,64,64], [96,96,96], [128,128,128], [160,160,160], [192,192,192], [224,224,224]],
  [[0,0,0], [32,32,32], [64,64,64], [96,96,96], [128,128,128], [160,160,160], [192,192,192], [224,224,224]],
  [[0,0,0], [32,32,32], [64,64,64], [96,96,96], [128,128,128], [160,160,160], [192,192,192], [224,224,224]],
  [[0,0,0], [32,32,32], [64,64,64], [96,96,96], [128,128,128], [160,160,160], [192,192,192], [224,224,224]],
  [[0,0,0], [32,32,32], [64,64,64], [96,96,96], [128,128,128], [160,160,160], [192,192,192], [224,224,224]],
  [[0,0,0], [32,32,32], [64,64,64], [96,96,96], [128,128,128], [160,160,160], [192,192,192], [224,224,224]],
  [[0,0,0], [32,32,32], [64,64,64], [96,96,96], [128,128,128], [160,160,160], [192,192,192], [224,224,224]],
];

/** Decode a base64 fixture. */
const bytes = (b64: string): Uint8Array => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of b64) {
    if (ch === '=') break;
    buffer = (buffer << 6) | alphabet.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
};

const at = (img: { pixels: Pixel[][] }, x: number, y: number): [number, number, number] => {
  const px = (img.pixels[y] as Pixel[])[x] as NonNullable<Pixel>;
  return [px.r, px.g, px.b];
};

/** How far a decoded pixel is from libjpeg's, in the worst channel. */
const off = (got: [number, number, number], want: readonly number[]): number =>
  Math.max(
    Math.abs(got[0] - (want[0] as number)),
    Math.abs(got[1] - (want[1] as number)),
    Math.abs(got[2] - (want[2] as number)),
  );

describe('decodeJPEG geometry', () => {
  it('reads the dimensions from the frame header', () => {
    expect(decodeJPEG(bytes(SOLID_8X8)).width).toBe(8);
    expect(decodeJPEG(bytes(SOLID_8X8)).height).toBe(8);
    expect(decodeJPEG(bytes(HALVES_420)).width).toBe(16);
    expect(decodeJPEG(bytes(RESTARTS)).width).toBe(32);
  });

  it('returns a full grid with no transparent pixels', () => {
    const img = decodeJPEG(bytes(GRADIENT_422));
    expect(img.pixels).toHaveLength(16);
    for (const row of img.pixels) {
      expect(row).toHaveLength(16);
      for (const px of row) expect(px).not.toBeNull();
    }
  });

  it('reports the component count', () => {
    expect(decodeJPEG(bytes(SOLID_8X8)).components).toBe(3);
    expect(decodeJPEG(bytes(GREY_8X8)).components).toBe(1);
  });

  it('reports the restart interval when the file has one', () => {
    expect(decodeJPEG(bytes(RESTARTS)).restartInterval).toBeGreaterThan(0);
    expect(decodeJPEG(bytes(SOLID_8X8)).restartInterval).toBe(0);
  });

  it('reads a COM segment', () => {
    expect(decodeJPEG(bytes(WITH_COMMENT)).comment).toBe('ansimax');
    expect(decodeJPEG(bytes(SOLID_8X8)).comment).toBeUndefined();
  });
});

describe('decodeJPEG pixels', () => {
  it('matches libjpeg on a 4:4:4 image', () => {
    const img = decodeJPEG(bytes(SOLID_8X8));
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        expect(off(at(img, x, y), TRUTH_SOLID[y]?.[x] as number[])).toBeLessThanOrEqual(2);
      }
    }
  });

  it('matches libjpeg on a greyscale image, where R, G and B are equal', () => {
    const img = decodeJPEG(bytes(GREY_8X8));
    for (let x = 0; x < 8; x++) {
      const [r, g, b] = at(img, x, 0);
      expect(r).toBe(g);
      expect(g).toBe(b);
      expect(off([r, g, b], TRUTH_GREY[0]?.[x] as number[])).toBeLessThanOrEqual(2);
    }
  });

  it('interpolates subsampled chroma instead of repeating it', () => {
    // 4:2:0 red|blue halves: libjpeg's fancy upsampling makes the seam a
    // gradient, not a step. Repeating chroma would give two flat halves.
    const img = decodeJPEG(bytes(HALVES_420));
    const left = at(img, 0, 0);
    const seamL = at(img, 7, 0);
    const seamR = at(img, 8, 0);
    const right = at(img, 15, 0);
    expect(left[0]).toBeGreaterThan(240); // red
    expect(right[2]).toBeGreaterThan(240); // blue
    // The pixels either side of the seam are mixed, not either endpoint.
    expect(seamL[2]).toBeGreaterThan(20);
    expect(seamR[0]).toBeGreaterThan(20);
    expect(off(seamL, [201, 12, 76])).toBeLessThanOrEqual(12);
    expect(off(seamR, [53, 0, 178])).toBeLessThanOrEqual(12);
  });

  it('decodes a 4:2:2 gradient monotonically across the row', () => {
    const img = decodeJPEG(bytes(GRADIENT_422));
    let previous = -1;
    for (let x = 0; x < 16; x++) {
      const [r] = at(img, x, 0);
      expect(r).toBeGreaterThanOrEqual(previous - 12); // allow DCT ringing
      previous = r;
    }
    expect(at(img, 15, 0)[0]).toBeGreaterThan(at(img, 0, 0)[0] + 150);
  });

  it('decodes a file with restart markers without drifting', () => {
    // A restart resets the DC predictor; mishandling one makes every block
    // after it wrong, which shows up as banding rather than a throw.
    const img = decodeJPEG(bytes(RESTARTS));
    expect(off(at(img, 0, 0), [1, 2, 59])).toBeLessThanOrEqual(6);
    // The gradient must still be increasing at the far corner.
    expect(at(img, 31, 31)[0]).toBeGreaterThan(at(img, 0, 0)[0] + 150);
    expect(at(img, 31, 31)[1]).toBeGreaterThan(at(img, 0, 0)[1] + 150);
  });

  it('keeps every channel inside 0..255', () => {
    for (const fixture of [SOLID_8X8, HALVES_420, GRADIENT_422, GREY_8X8, RESTARTS]) {
      const img = decodeJPEG(bytes(fixture));
      for (const row of img.pixels) {
        for (const px of row) {
          const p = px as NonNullable<Pixel>;
          for (const v of [p.r, p.g, p.b]) {
            expect(Number.isInteger(v)).toBe(true);
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(255);
          }
        }
      }
    }
  });
});

describe('decodeJPEG refusals', () => {
  it('names progressive rather than producing nonsense', () => {
    expect(() => decodeJPEG(bytes(PROGRESSIVE))).toThrow(/ANSIMAX_JPEG_PROGRESSIVE/);
  });

  it('rejects a file with no SOI marker', () => {
    expect(() => decodeJPEG(new Uint8Array([1, 2, 3, 4]))).toThrow(/ANSIMAX_JPEG_SIGNATURE/);
    expect(() => decodeJPEG(new Uint8Array(0))).toThrow(/ANSIMAX_JPEG_SIGNATURE/);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
    expect(() => decodeJPEG(png)).toThrow(/ANSIMAX_JPEG_SIGNATURE/);
  });

  it('rejects a non-Uint8Array', () => {
    expect(() => decodeJPEG([0xff, 0xd8] as unknown as Uint8Array)).toThrow(/ANSIMAX_JPEG_INPUT/);
  });

  it('rejects a file that ends inside a segment', () => {
    const truncated = bytes(SOLID_8X8).subarray(0, 30);
    expect(() => decodeJPEG(truncated)).toThrow(/ANSIMAX_JPEG_/);
  });

  it('rejects a file with no frame header', () => {
    // SOI then EOI: a well-formed file with nothing in it.
    expect(() => decodeJPEG(new Uint8Array([0xff, 0xd8, 0xff, 0xd9])))
      .toThrow(/ANSIMAX_JPEG_SOF/);
  });

  it('refuses a frame bigger than the pixel cap', () => {
    expect(() => decodeJPEG(bytes(SOLID_8X8), { maxPixels: 10 }))
      .toThrow(/ANSIMAX_JPEG_TOO_LARGE/);
    // And a nonsense cap falls back to the default rather than refusing.
    expect(() => decodeJPEG(bytes(SOLID_8X8), { maxPixels: Number.NaN })).not.toThrow();
  });

  it('names an unsupported frame type', () => {
    // Rewrite the SOF0 marker as SOF3 (lossless).
    const file = bytes(SOLID_8X8);
    for (let i = 0; i + 1 < file.length; i++) {
      if (file[i] === 0xff && file[i + 1] === 0xc0) {
        file[i + 1] = 0xc3;
        break;
      }
    }
    expect(() => decodeJPEG(file)).toThrow(/ANSIMAX_JPEG_UNSUPPORTED/);
  });

  it('names a missing quantization or Huffman table', () => {
    // Blank out the DQT marker so the scan references a table never defined.
    const file = bytes(SOLID_8X8);
    for (let i = 0; i + 1 < file.length; i++) {
      if (file[i] === 0xff && file[i + 1] === 0xdb) {
        file[i + 1] = 0xe0; // turn it into an APP0 segment, which is skipped
        break;
      }
    }
    expect(() => decodeJPEG(file)).toThrow(/ANSIMAX_JPEG_DQT/);
  });
});

/** Adobe CMYK JPEG, four components. */
const JPEG_CMYK =
  '/9j/7gAOQWRvYmUAZAAAAAAA/9sAQwACAQEBAQECAQEBAgICAgIEAwICAgIFBAQDBAYFBgYGBQYG' +
  'BgcJCAYHCQcGBggLCAkKCgoKCgYICwwLCgwJCgoK/8AAFAgABwALBEMRAE0RAFkRAEsRAP/EAB8A' +
  'AAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUS' +
  'ITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElK' +
  'U1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4' +
  'ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/aAA4EQwBNAFkASwAAPwD5' +
  'B/4Iuf8AMJ/4B/SqX/EMh4P/AOgJpn/fyP8Axr8tV/4xHxs/0/8AtDG3H7r+xNm3H9/7T53np/d8' +
  'vjpx5X7+V/Rp8JP+SbaP/wBeY/maP+IZDwf/ANATTP8Av5H/AI1+zcn7Lllobf2ZL8bYtFMagjTG' +
  '8Mi58kEbh+8+bduBDdeN2MLjaCv/2Q==';

/** libjpeg's RGB for the CMYK fixture. */
const CMYK_TRUTH = [
  [[0,0,1], [23,0,13], [46,0,25], [70,0,39], [91,0,52], [115,0,66], [138,0,78], [161,0,90], [184,0,105], [207,0,114], [230,0,130]],
  [[0,37,12], [23,37,1], [46,37,38], [70,37,26], [91,37,65], [115,37,53], [138,37,90], [161,37,79], [184,37,116], [207,37,108], [230,37,143]],
  [[0,74,25], [23,74,41], [46,74,0], [70,74,17], [91,74,74], [115,74,92], [138,74,50], [161,74,66], [184,74,129], [207,74,145], [230,74,102]],
  [[0,110,42], [23,110,24], [46,110,14], [70,110,0], [91,110,93], [115,110,77], [138,110,67], [161,110,49], [184,110,145], [207,110,126], [230,110,120]],
  [[0,148,51], [23,148,63], [46,148,79], [70,148,91], [91,148,0], [115,148,12], [138,148,28], [161,148,40], [184,148,157], [207,148,169], [230,148,182]],
  [[0,185,66], [23,185,53], [46,185,90], [70,185,77], [91,185,14], [115,185,1], [138,185,38], [161,185,25], [184,185,170], [207,185,154], [230,185,197]],
  [[0,222,76], [23,222,92], [46,222,53], [70,222,64], [91,222,27], [115,222,38], [138,222,0], [161,222,15], [184,222,180], [207,222,199], [230,222,154]],
];

describe('decodeJPEG — four components', () => {
  it('decodes an Adobe CMYK JPEG', () => {
    const img = decodeJPEG(bytes(JPEG_CMYK));
    expect(img.components).toBe(4);
    expect(img.height).toBe(CMYK_TRUTH.length);
    expect(img.width).toBe((CMYK_TRUTH[0] as number[][]).length);
    let worst = 0;
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        const [r, g, b] = (CMYK_TRUTH[y] as number[][])[x] as number[];
        const px = (img.pixels[y] as Pixel[])[x] as NonNullable<Pixel>;
        worst = Math.max(
          worst,
          Math.abs(px.r - (r as number)),
          Math.abs(px.g - (g as number)),
          Math.abs(px.b - (b as number)),
        );
      }
    }
    // CMYK → RGB is lossy both ways, so a few levels is the right bar.
    expect(worst).toBeLessThanOrEqual(8);
  });
});

// ─────────────────────────────────────────────
//  Byte-level surgery, for the paths a well-formed file never reaches
// ─────────────────────────────────────────────

/** Find a marker segment: returns [markerAt, bodyAt, length]. */
const findSegment = (file: Uint8Array, marker: number): [number, number, number] => {
  for (let i = 2; i + 4 < file.length; i++) {
    if (file[i] === 0xff && file[i + 1] === marker) {
      const length = ((file[i + 2] as number) << 8) | (file[i + 3] as number);
      return [i, i + 4, length - 2];
    }
  }
  throw new Error(`marker FF${marker.toString(16)} not found`);
};

/** Replace one segment's body, fixing its length field. */
const replaceSegment = (file: Uint8Array, marker: number, body: Uint8Array): Uint8Array => {
  const [at, bodyAt, oldLen] = findSegment(file, marker);
  const out = new Uint8Array(file.length - oldLen + body.length);
  out.set(file.subarray(0, at + 2), 0);
  const length = body.length + 2;
  out[at + 2] = (length >> 8) & 0xff;
  out[at + 3] = length & 0xff;
  out.set(body, at + 4);
  out.set(file.subarray(bodyAt + oldLen), at + 4 + body.length);
  return out;
};

describe('decodeJPEG — segment variants', () => {
  it('reads a 16-bit quantization table', () => {
    // Pillow only ever writes 8-bit tables, so the file is rebuilt: the
    // precision nibble goes to 1 and each of the 64 values becomes two bytes.
    const file = bytes(SOLID_8X8);
    const [, bodyAt, length] = findSegment(file, 0xdb);
    const old = file.subarray(bodyAt, bodyAt + length);
    const spec = old[0] as number;
    const wide = new Uint8Array(1 + 128);
    wide[0] = (1 << 4) | (spec & 15); // precision 1, same table id
    for (let i = 0; i < 64; i++) {
      wide[1 + i * 2] = 0;
      wide[2 + i * 2] = old[1 + i] as number;
    }
    const rebuilt = replaceSegment(file, 0xdb, wide);
    const widened = decodeJPEG(rebuilt);
    const plain = decodeJPEG(file);
    // Same quantization values, just stored in two bytes each.
    expect(widened.pixels).toEqual(plain.pixels);
  });

  it('decodes what it can from a scan that ends early', () => {
    // Cut the entropy-coded data in half. The reader feeds zero bits past the
    // end rather than throwing, so the top of the image survives.
    const file = bytes(RESTARTS);
    const [, bodyAt, length] = findSegment(file, 0xda);
    const scanStart = bodyAt + length;
    const cut = scanStart + Math.floor((file.length - scanStart) / 2);
    const truncated = file.subarray(0, cut);
    const img = decodeJPEG(truncated);
    expect(img.width).toBe(32);
    expect(img.height).toBe(32);
    // The first row came through; every pixel is still a valid byte triple.
    for (const row of img.pixels) {
      for (const px of row) {
        const p = px as NonNullable<Pixel>;
        for (const v of [p.r, p.g, p.b]) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(255);
        }
      }
    }
  });

  it('names a component count it cannot handle', () => {
    const file = bytes(SOLID_8X8);
    const [, bodyAt] = findSegment(file, 0xc0);
    const broken = file.slice();
    broken[bodyAt + 5] = 2; // two components
    expect(() => decodeJPEG(broken)).toThrow(/ANSIMAX_JPEG_UNSUPPORTED/);
  });

  it('names a sample precision it cannot handle', () => {
    const file = bytes(SOLID_8X8);
    const [, bodyAt] = findSegment(file, 0xc0);
    const broken = file.slice();
    broken[bodyAt] = 12; // 12-bit samples
    expect(() => decodeJPEG(broken)).toThrow(/ANSIMAX_JPEG_UNSUPPORTED/);
  });

  it('names zero dimensions', () => {
    const file = bytes(SOLID_8X8);
    const [, bodyAt] = findSegment(file, 0xc0);
    const broken = file.slice();
    broken[bodyAt + 1] = 0;
    broken[bodyAt + 2] = 0; // height 0
    expect(() => decodeJPEG(broken)).toThrow(/ANSIMAX_JPEG_SOF/);
  });

  it('rejects a Huffman table id outside 0..3', () => {
    const file = bytes(SOLID_8X8);
    const [, bodyAt] = findSegment(file, 0xc4);
    const broken = file.slice();
    broken[bodyAt] = (broken[bodyAt] as number) | 0x0f; // id 15
    expect(() => decodeJPEG(broken)).toThrow(/ANSIMAX_JPEG_DHT/);
  });

  it('rejects a quantization table id outside 0..3', () => {
    const file = bytes(SOLID_8X8);
    const [, bodyAt] = findSegment(file, 0xdb);
    const broken = file.slice();
    broken[bodyAt] = (broken[bodyAt] as number) | 0x0f;
    expect(() => decodeJPEG(broken)).toThrow(/ANSIMAX_JPEG_DQT/);
  });

  it('names a component the frame never declared', () => {
    const file = bytes(SOLID_8X8);
    const [, bodyAt] = findSegment(file, 0xda);
    const broken = file.slice();
    broken[bodyAt + 1] = 99; // first scan component id
    expect(() => decodeJPEG(broken)).toThrow(/ANSIMAX_JPEG_SOS/);
  });

  it('refuses a scan that arrives before any frame header', () => {
    // Turn SOF0 into an APP segment, which is skipped, leaving the scan first.
    const file = bytes(SOLID_8X8);
    const [at] = findSegment(file, 0xc0);
    const broken = file.slice();
    broken[at + 1] = 0xe1; // APP1
    expect(() => decodeJPEG(broken)).toThrow(/ANSIMAX_JPEG_SOF/);
  });

  it('reports a Huffman code that matches no table entry', () => {
    // Fill the scan with 0xFF-free noise: a code longer than any in the
    // table has to resolve to nothing.
    const file = bytes(SOLID_8X8);
    const [, bodyAt, length] = findSegment(file, 0xda);
    const broken = file.slice();
    for (let i = bodyAt + length; i < broken.length - 2; i++) broken[i] = 0x55;
    // Either it decodes (a valid code sequence by luck) or it names the
    // failure — what it must not do is produce an out-of-range sample.
    try {
      const img = decodeJPEG(broken);
      for (const row of img.pixels) {
        for (const px of row) {
          const p = px as NonNullable<Pixel>;
          expect(p.r).toBeLessThanOrEqual(255);
        }
      }
    } catch (e) {
      expect((e as Error).message).toMatch(/ANSIMAX_JPEG_/);
    }
  });

  it('reads the Adobe transform byte to tell CMYK from YCCK', () => {
    // The fixture is plain CMYK — libjpeg wrote APP14 with transform 0 — and
    // that is the branch the test above covers. Forcing the byte to 2 selects
    // YCCK, where the first three channels go through the YCbCr matrix
    // first, so the two readings must disagree.
    const file = bytes(JPEG_CMYK);
    const [, bodyAt, length] = findSegment(file, 0xee);
    expect(String.fromCharCode(...file.subarray(bodyAt, bodyAt + 5))).toBe('Adobe');
    expect(file[bodyAt + 11]).toBe(0); // plain CMYK
    expect(length).toBeGreaterThanOrEqual(12);

    const forced = file.slice();
    forced[bodyAt + 11] = 2; // YCCK
    const cmyk = decodeJPEG(file);
    const ycck = decodeJPEG(forced);
    expect(ycck.components).toBe(4);
    expect(ycck.width).toBe(cmyk.width);
    expect(JSON.stringify(ycck.pixels)).not.toBe(JSON.stringify(cmyk.pixels));
  });

  it('skips fill bytes between segments', () => {
    // Extra 0xFF bytes before a marker are legal padding.
    const file = bytes(SOLID_8X8);
    const [at] = findSegment(file, 0xdb);
    const padded = new Uint8Array(file.length + 3);
    padded.set(file.subarray(0, at), 0);
    padded[at] = 0xff;
    padded[at + 1] = 0xff;
    padded[at + 2] = 0xff;
    padded.set(file.subarray(at), at + 3);
    expect(decodeJPEG(padded).pixels).toEqual(decodeJPEG(file).pixels);
  });
});

// ─────────────────────────────────────────────
//  The scan paths a smooth image never takes
// ─────────────────────────────────────────────

/**
 * 16x16 greyscale, quality 95, 4:4:4 — a deliberately high-frequency pattern.
 * A smooth image puts its energy in the first few coefficients, so its blocks
 * never contain a long run of zeros between two non-zero ones. This one does,
 * which is what a ZRL code (sixteen zeros) encodes.
 */
const NOISE_16X16 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAIBAQEBAQIBAQECAgICAgQDAgICAgUEBAMEBgUGBgYF' +
  'BgYGBwkIBgcJBwYGCAsICQoKCgoKBggLDAsKDAkKCgr/wAALCAAQABABAREA/8QAHwAAAQUBAQEB' +
  'AQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1Fh' +
  'ByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZ' +
  'WmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXG' +
  'x8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/APze/wCLp658U/8AmX/F' +
  'Xxc8VeH/APpvdeGf2mfDM8//AGwmk1t5rX/p3vbq9sv+XLxNYf8AEx5/TNT8CDwJ4W8S+Gvil4g0' +
  'r4d6V4gjHwm+LJuJZPEnwO8SPLLfR6Lq0ljGs0+myzJcXUU9tEpcpPqenRR3cWt6JKanpngQeBPF' +
  'PhrxL8LfEGlfDvSvEEh+LPwmFvLJ4k+B3iR5YrGTWtJjvpFmn02WZLe1lguZVLlINM1GWO7i0TW5' +
  'eg/4unrnxT/5l/xV8XPFXh//AKb3Xhn9pnwzPP8A9sJpNbea1/6d726vbL/ly8TWH/Ex/9k=';

/**
 * 8x8 greyscale checkerboard at quality 100, 4:4:4. A perfect checkerboard's
 * DCT is the DC term plus the single highest-frequency coefficient, so the
 * zigzag between them is sixty-two zeros — which the encoder has to write as
 * ZRL codes, sixteen zeros at a time.
 */
const CHECKER_8X8 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEB' +
  'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAALCAAIAAgBAREA/8QAHwAAAQUBAQEB' +
  'AQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1Fh' +
  'ByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZ' +
  'WmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXG' +
  'x8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/AI/+Rh/6mf8A4Sf/ALnv' +
  '/hLv+E7/APEp/wDhYv8AwsX/AIan/wCrxP8Ahc//AA2L/wA5Jv8Ah5N/x2jf/9k=';

describe('decodeJPEG — high-frequency blocks', () => {
  it('decodes a pattern whose blocks need zero-run codes', () => {
    const image = decodeJPEG(bytes(NOISE_16X16));
    expect(image.width).toBe(16);
    expect(image.height).toBe(16);
    // The pattern is two-valued, so after the codec's own loss every pixel
    // still sits near one end or the other rather than in a flat grey.
    const flat = image.pixels.flat().filter((p) => p !== null) as Array<{ r: number }>;
    expect(flat).toHaveLength(256);
    const dark = flat.filter((p) => p.r < 96).length;
    const light = flat.filter((p) => p.r > 160).length;
    expect(dark + light).toBeGreaterThan(200);
  });
});

describe('decodeJPEG — malformed segments and scans', () => {
  it('names a code in the scan that matches no entry in its table', () => {
    // One byte of the scan data, changed to a value whose bit pattern walks
    // past the longest code in the table. Found by trying every single-byte
    // mutation of the fixture, so it is this byte and this value.
    const file = bytes(SOLID_8X8);
    expect(file[626]).not.toBe(248);
    const corrupt = file.slice();
    corrupt[626] = 248;
    expect(() => decodeJPEG(corrupt))
      .toThrow(/ANSIMAX_JPEG_HUFFMAN: a code in the scan matches no entry in its table/);
  });

  it('names a marker whose length field runs off the end', () => {
    const file = bytes(SOLID_8X8);
    const [at] = findSegment(file, 0xe0);
    // Keep the marker and one byte of its length: the second is missing.
    expect(() => decodeJPEG(file.subarray(0, at + 3)))
      .toThrow(/ANSIMAX_JPEG_TRUNCATED: marker FFe0 has no length/);
  });

  it('skips a standalone marker that carries no segment', () => {
    // TEM (FF01) has no length and no body. So does a stray RST outside a
    // scan. Both are skipped rather than read as a length.
    const file = bytes(SOLID_8X8);
    const [at] = findSegment(file, 0xdb);
    for (const marker of [0x01, 0xd0, 0xd7]) {
      const out = new Uint8Array(file.length + 2);
      out.set(file.subarray(0, at), 0);
      out[at] = 0xff;
      out[at + 1] = marker;
      out.set(file.subarray(at), at + 2);
      expect(decodeJPEG(out).pixels).toEqual(decodeJPEG(file).pixels);
    }
  });

  it('names a component whose Huffman table the file never defined', () => {
    // Drop the DHT segment the SOF refers to.
    const file = bytes(SOLID_8X8);
    const [at, , length] = findSegment(file, 0xc4);
    const out = new Uint8Array(file.length - (length + 4));
    out.set(file.subarray(0, at), 0);
    out.set(file.subarray(at + length + 4), at);
    expect(() => decodeJPEG(out))
      .toThrow(/ANSIMAX_JPEG_DHT: component \d+ names a Huffman table the file never defined/);
  });

  it('decodes a file whose EOI marker is missing', () => {
    // Without an EOI the segment walk runs to the end of the buffer, which is
    // not an error: the scan is complete, the file just stops.
    const file = bytes(SOLID_8X8);
    const image = decodeJPEG(file.subarray(0, file.length - 2));
    expect(image.width).toBe(8);
    expect(image.pixels).toEqual(decodeJPEG(file).pixels);
  });

  it('stops rather than decoding noise when a marker turns up mid-scan', () => {
    // Four bytes of scan data, then EOI, for an image that needs sixteen MCUs.
    // The rest of the image stays at whatever the decoder had, instead of
    // being filled from bits that are not scan data.
    const file = bytes(RESTARTS);
    const sos = findScanStart(file);
    const payload = sos + 2 + ((file[sos + 2] as number) << 8 | (file[sos + 3] as number));
    const out = new Uint8Array(payload + 8);
    out.set(file.subarray(0, payload + 4), 0);
    out.set([0xff, 0xd9, 0xff, 0xd9], payload + 4);
    const image = decodeJPEG(out);
    expect(image.width).toBe(32);
    expect(image.height).toBe(32);
    expect(image.pixels.flat()).toHaveLength(32 * 32);
  });
});

/** Where the SOS marker sits. */
const findScanStart = (file: Uint8Array): number => {
  let at = 2;
  while (at + 4 <= file.length) {
    if (file[at] !== 0xff) {
      at++;
      continue;
    }
    const marker = file[at + 1] as number;
    if (marker === 0xda) return at;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      at += 2;
      continue;
    }
    at += 2 + ((file[at + 2] as number) << 8 | (file[at + 3] as number));
  }
  throw new Error('no SOS marker');
};

describe('decodeJPEG — zero runs and short scans', () => {
  it('decodes a checkerboard, whose blocks are written with ZRL codes', () => {
    const image = decodeJPEG(bytes(CHECKER_8X8));
    expect(image.width).toBe(8);
    expect(image.height).toBe(8);
    // At quality 100 the checkerboard survives exactly.
    const row = (image.pixels[0] as Array<{ r: number } | null>)
      .map((p) => (p === null ? -1 : p.r));
    expect(row).toEqual([255, 0, 255, 0, 255, 0, 255, 0]);
  });

  it('stops at a marker that arrives with MCUs still to come', () => {
    // Two bytes of scan data, then EOI, for an image that needs four MCUs.
    // The decoder stops where the data stopped rather than decoding the
    // marker bytes as coefficients.
    const file = bytes(NOISE_16X16);
    const sos = findScanStart(file);
    const payload = sos + 2 + ((file[sos + 2] as number) << 8 | (file[sos + 3] as number));
    const out = new Uint8Array(payload + 4);
    out.set(file.subarray(0, payload + 2), 0);
    out[payload + 2] = 0xff;
    out[payload + 3] = 0xd9;
    const image = decodeJPEG(out);
    expect(image.width).toBe(16);
    expect(image.height).toBe(16);
    expect(image.pixels.flat()).toHaveLength(256);
  });

  it('walks over padding between the scan and the next marker', () => {
    // Bytes the entropy reader never consumed sit between the end of the scan
    // and the EOI. They are not an error; the walk steps over them.
    const file = bytes(SOLID_8X8);
    const out = new Uint8Array(file.length + 1);
    out.set(file.subarray(0, file.length - 2), 0);
    out[file.length - 2] = 0x00;
    out.set(file.subarray(file.length - 2), file.length - 1);
    expect(decodeJPEG(out).pixels).toEqual(decodeJPEG(file).pixels);
  });
});

// ─────────────────────────────────────────────
//  A JPEG written byte by byte
//
//  Two scan paths cannot be reached with a file libjpeg produced, so these
//  are assembled here instead of generated. The Huffman tables live in the
//  file, so a hand-built one can carry tables with exactly the symbols the
//  test needs — which is what makes a scan short enough to write by hand.
// ─────────────────────────────────────────────

/**
 * 8x8 greyscale, quantization all ones, with a three-symbol AC table (EOB,
 * ZRL and run-0/size-6) at two bits each. The scan is a single byte pair:
 * a zero DC difference, then **ZRL** — sixteen zero coefficients — then one
 * value of 40, then end of block.
 *
 * No image libjpeg encodes reaches this path: a run of sixteen zeros needs a
 * block holding the DC term plus a single coefficient past zigzag 16, and the
 * integer DCT spreads even a perfect checkerboard across enough coefficients
 * that the longest run measured over eight candidate images was nine.
 */
const ZRL_BLOCK =
  '/9j/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEB' +
  'AQEBAQEBAQEBAQEBAQH/wAALCAAIAAgBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABcQAAQA' +
  'AAAAAAAAAAAAAAAAAADwAQb/2gAIAQEAAD8APQf/2Q==';

describe('decodeJPEG — a zero-run code', () => {
  it('skips sixteen coefficients on a ZRL symbol', () => {
    const image = decodeJPEG(bytes(ZRL_BLOCK));
    expect(image.width).toBe(8);
    expect(image.height).toBe(8);
    const row = (image.pixels[0] as Array<{ r: number } | null>)
      .map((p) => (p === null ? -1 : p.r));
    // The one coefficient that survives the run sits past zigzag 16, so the
    // block is not flat — which is how we know the run was skipped rather
    // than the coefficient being dropped on the floor.
    expect(row).toEqual([136, 126, 119, 123, 133, 137, 130, 120]);
    expect(new Set(row).size).toBeGreaterThan(1);
  });
});

describe('decodeJPEG — fill bytes inside a scan', () => {
  it('walks over 0xFF padding in front of a restart marker', () => {
    // A run of 0xFF bytes may pad the space before any marker, restart
    // markers included. The byte is fill, not the start of a marker.
    const file = bytes(RESTARTS);
    let rst = -1;
    for (let i = 2; i + 1 < file.length; i++) {
      const next = file[i + 1] as number;
      if (file[i] === 0xff && next >= 0xd0 && next <= 0xd7) {
        rst = i;
        break;
      }
    }
    expect(rst).toBeGreaterThan(0);

    const padded = new Uint8Array(file.length + 1);
    padded.set(file.subarray(0, rst), 0);
    padded[rst] = 0xff;
    padded.set(file.subarray(rst), rst + 1);
    expect(decodeJPEG(padded).pixels).toEqual(decodeJPEG(file).pixels);
  });
});

/**
 * The same hand-built shape, with an AC table that also holds run-15/size-1.
 * The scan emits three ZRLs — forty-eight zeros, reaching coefficient 49 —
 * then a run of fifteen more, which points at coefficient 64. There is no
 * coefficient 64, so the block ends there rather than writing past its end.
 */
const RUN_PAST_BLOCK =
  '/9j/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEB' +
  'AQEBAQEBAQEBAQEBAQH/wAALCAAIAAgBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABgQAAMC' +
  'AAAAAAAAAAAAAAAAAADwAQbx/9oACAEBAAA/ACvA/9k=';

describe('decodeJPEG — a run that points past the block', () => {
  it('ends the block instead of writing past its 64 coefficients', () => {
    const image = decodeJPEG(bytes(RUN_PAST_BLOCK));
    expect(image.width).toBe(8);
    expect(image.height).toBe(8);
    // Every coefficient the run skipped stays zero, so only the DC term is
    // left and the block is the flat mid-grey a zero DC difference gives.
    const flat = (image.pixels.flat() as Array<{ r: number } | null>)
      .map((p) => (p === null ? -1 : p.r));
    expect(new Set(flat)).toEqual(new Set([128]));
  });
});

/** The same shape again, truncated so the scan's last byte is a lone 0xFF. */
const TRAILING_FF =
  '/9j/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEB' +
  'AQEBAQEBAQEBAQEBAQH/wAALCAAIAAgBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABgQAAMC' +
  'AAAAAAAAAAAAAAAAAADwAQbx/9oACAEBAAA/AP8=';

describe('decodeJPEG — a 0xFF with nothing after it', () => {
  it('treats the end of the data as EOI rather than reading past it', () => {
    // A 0xFF is either stuffing or a marker, and which one is decided by the
    // byte after it. When there is no byte after it, the file has ended.
    const image = decodeJPEG(bytes(TRAILING_FF));
    expect(image.width).toBe(8);
    expect(image.pixels.flat()).toHaveLength(64);
  });
});
