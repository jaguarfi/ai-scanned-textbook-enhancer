
import { readFileSync } from 'fs';
import sharp from 'sharp';
import { measurePaperTone, luma } from '../server/pipeline/analysis';
import { applyInkPaperCurve, bilateralDenoise, flattenIllumination, unsharpMask } from '../server/pipeline/ops';
import { DEFAULT_PARAMS } from '../server/pipeline/deterministic';
import { RgbImage } from '../server/pipeline/types';

async function main() {
  const input = readFileSync('scripts/fixtures/scanned-page.jpg');
  const d = await sharp(input).flatten({background:{r:255,g:255,b:255}}).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const img: RgbImage = { data: new Uint8Array(d.data), width: d.info.width, height: d.info.height };
  const paper = measurePaperTone(img);
  const base = new Uint8Array(img.data);

  const stages: [string, () => void][] = [
    ['flatten', () => { flattenIllumination(img, paper, DEFAULT_PARAMS); }],
    ['denoise', () => { bilateralDenoise(img, DEFAULT_PARAMS); }],
    ['curve',   () => { applyInkPaperCurve(img, paper, DEFAULT_PARAMS); }],
    ['sharpen', () => { unsharpMask(img, DEFAULT_PARAMS); }],
  ];
  for (const [, fn] of stages) fn();

  const rp = measurePaperTone(img);
  const w = img.width, h = img.height;
  const out = new Uint8Array(w * h * 3);
  const lossContrast: number[] = [];

  for (let i = 0; i < w * h; i++) {
    const o = i * 3;
    const sd = (paper.luminance - luma(base[o], base[o+1], base[o+2])) / paper.luminance;
    const rd = (rp.luminance - luma(img.data[o], img.data[o+1], img.data[o+2])) / rp.luminance;
    if (sd > 0.22 && rd < 0.07) {
      out[o] = 255; out[o+1] = 0; out[o+2] = 0;
      lossContrast.push(sd);
    } else if (sd > 0.22) {
      out[o] = 160; out[o+1] = 160; out[o+2] = 160;
    } else { out[o] = 240; out[o+1] = 240; out[o+2] = 240; }
  }

  lossContrast.sort((a,b) => a - b);
  const q = (p: number) => lossContrast[Math.floor(lossContrast.length * p)]?.toFixed(3);
  console.log('lost pixels: ' + lossContrast.length);
  console.log('source contrast of lost pixels - p10 ' + q(0.1) + '  p50 ' + q(0.5) + '  p90 ' + q(0.9) + '  max ' + lossContrast[lossContrast.length-1]?.toFixed(3));

  await sharp(Buffer.from(out), { raw: { width: w, height: h, channels: 3 } })
    .extract({ left: 100, top: 380, width: 560, height: 380 })
    .resize(1120, 760, { kernel: 'nearest' })
    .png().toFile('scripts/fixtures/loss-map.png');
  console.log('wrote scripts/fixtures/loss-map.png');
}
main();
