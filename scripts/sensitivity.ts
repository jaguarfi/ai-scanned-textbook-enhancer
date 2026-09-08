
/**
 * Confirms the fidelity check fails when it should.
 *
 * A verifier that passes everything provides no assurance, so each case below
 * injects a defect of the kind a generative model actually produces and
 * asserts the report catches it.
 */
import { readFileSync } from 'fs';
import sharp from 'sharp';
import { measurePaperTone, verifyFidelity } from '../server/pipeline/analysis';
import { RgbImage } from '../server/pipeline/types';

const load = async (): Promise<RgbImage> => {
  const d = await sharp(readFileSync('scripts/fixtures/scanned-page.jpg'))
    .flatten({ background: { r: 255, g: 255, b: 255 } }).removeAlpha()
    .raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(d.data), width: d.info.width, height: d.info.height };
};

const clone = (i: RgbImage): RgbImage => ({ data: new Uint8Array(i.data), width: i.width, height: i.height });

function drawTick(img: RgbImage, cx: number, cy: number) {
  // A handwritten-looking tick: exactly the sort of annotation the generative
  // model was adding to pages unprompted.
  const put = (x: number, y: number) => {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const o = ((y + dy) * img.width + (x + dx)) * 3;
      img.data[o] = 20; img.data[o + 1] = 20; img.data[o + 2] = 20;
    }
  };
  for (let t = 0; t < 14; t++) put(cx + t, cy + t);
  for (let t = 0; t < 28; t++) put(cx + 14 + t, cy + 14 - t);
}

function eraseBand(img: RgbImage, x0: number, y0: number, w: number, h: number, paperLum: number) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const o = (y * img.width + x) * 3;
    img.data[o] = paperLum; img.data[o + 1] = paperLum - 2; img.data[o + 2] = paperLum - 18;
  }
}

/** Round-trips pixels through sharp so geometric cases can use real resampling. */
async function transform(
  img: RgbImage,
  fn: (p: ReturnType<typeof sharp>) => ReturnType<typeof sharp>
): Promise<RgbImage> {
  const raw = { raw: { width: img.width, height: img.height, channels: 3 as const } };
  const d = await fn(sharp(Buffer.from(img.data), raw))
    .raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(d.data), width: d.info.width, height: d.info.height };
}

async function main() {
  const src = await load();
  const paper = measurePaperTone(src);

  // Expected outcome is declared per case, so loosening a threshold to silence
  // a false positive cannot quietly disarm a real detection.
  const cases: [string, boolean, (i: RgbImage) => RgbImage | Promise<RgbImage>][] = [
    ['unmodified copy (control)', true, (i) => i],

    ['benign resample blur', true, (i) =>
      // Softened but not moved: what an honest model does to the frame. This
      // must pass, or every AI result is flagged and the report means nothing.
      transform(i, (p) => p
        .resize(Math.round(i.width * 0.7), Math.round(i.height * 0.7), { kernel: 'lanczos3' })
        .resize(i.width, i.height, { kernel: 'lanczos3' }))],

    ['added a handwritten tick', false, (i) => { drawTick(i, 700, 500); return i; }],

    ['erased one table row', false, (i) => {
      eraseBand(i, 160, 520, 400, 30, paper.luminance); return i;
    }],

    ['page stretched 4%', false, (i) =>
      // Content displaced outward from the centre, which is what happens when
      // the page is forced into the wrong aspect ratio.
      transform(i, (p) => p
        .resize(Math.round(i.width * 1.04), i.height, { fit: 'fill', kernel: 'lanczos3' })
        .extract({
          left: Math.round(i.width * 0.02), top: 0, width: i.width, height: i.height,
        }))],

    ['background forced to white', false, (i) => {
      for (let k = 0; k < i.data.length; k += 3) {
        const l = 0.299 * i.data[k] + 0.587 * i.data[k+1] + 0.114 * i.data[k+2];
        if (l > paper.luminance - 30) { i.data[k] = 255; i.data[k+1] = 255; i.data[k+2] = 255; }
      }
      return i;
    }],
  ];

  console.log('case                            added%   lost%   tone   struct   verdict      expected');
  console.log('-'.repeat(88));

  let failures = 0;
  for (const [name, shouldPass, mutate] of cases) {
    const c = await mutate(clone(src));
    const f = verifyFidelity(src, c, paper, measurePaperTone(c));
    const correct = f.passed === shouldPass;
    if (!correct) failures++;

    console.log(
      name.padEnd(30) +
      (f.addedInkRatio * 100).toFixed(2).padStart(7) +
      (f.lostInkRatio * 100).toFixed(2).padStart(8) +
      f.paperToneDelta.toFixed(0).padStart(7) +
      f.structuralCorrelation.toFixed(3).padStart(9) +
      '   ' + (f.passed ? 'PASS' : 'DETECTED').padEnd(11) +
      (correct ? 'ok' : shouldPass ? 'FALSE ALARM' : 'MISSED')
    );
    for (const w of f.warnings) console.log('      -> ' + w);
  }

  console.log('-'.repeat(88));
  console.log(failures === 0
    ? `All ${cases.length} cases behaved as expected.`
    : `${failures} of ${cases.length} cases behaved incorrectly.`);
  if (failures > 0) process.exit(1);
}
main();
