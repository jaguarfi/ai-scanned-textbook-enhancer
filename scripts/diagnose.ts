import { readFileSync } from 'fs';
import sharp from 'sharp';
import { measurePaperTone, verifyFidelity, luma } from '../server/pipeline/analysis';
import { applyInkPaperCurve, bilateralDenoise, flattenIllumination, unsharpMask } from '../server/pipeline/ops';
import { DEFAULT_PARAMS } from '../server/pipeline/deterministic';
import { RgbImage } from '../server/pipeline/types';

async function main() {
  const input = readFileSync('scripts/fixtures/scanned-page.jpg');
  const d = await sharp(input).flatten({background:{r:255,g:255,b:255}}).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const img: RgbImage = { data: new Uint8Array(d.data), width: d.info.width, height: d.info.height };
  const paper = measurePaperTone(img);
  const baseline: RgbImage = { data: new Uint8Array(img.data), width: img.width, height: img.height };

  const report = (label: string) => {
    const rp = measurePaperTone(img);
    const f = verifyFidelity(baseline, img, paper, rp);
    console.log(`${label.padEnd(24)} lost ${(f.lostInkRatio*100).toFixed(2).padStart(6)}%  added ${(f.addedInkRatio*100).toFixed(2).padStart(5)}%  paperLum ${rp.luminance}`);
  };

  // Histogram of source ink luminance, to see where strokes actually sit.
  const hist = new Uint32Array(256);
  for (let i = 0; i < img.data.length; i += 3) hist[Math.round(luma(img.data[i],img.data[i+1],img.data[i+2]))]++;
  const inkThr = paper.luminance - 40;
  let bands: string[] = [];
  for (let lo = 0; lo < inkThr; lo += 30) {
    let n = 0;
    for (let v = lo; v < Math.min(inkThr, lo+30); v++) n += hist[v];
    bands.push(`${lo}-${Math.min(inkThr,lo+30)}: ${n}`);
  }
  console.log(`paper lum ${paper.luminance}, ink threshold <${inkThr}`);
  console.log('source ink distribution: ' + bands.join('  '));
  console.log('');

  report('baseline');
  flattenIllumination(img, paper, DEFAULT_PARAMS); report('+ flatten');
  bilateralDenoise(img, DEFAULT_PARAMS); report('+ denoise');
  applyInkPaperCurve(img, paper, DEFAULT_PARAMS); report('+ curve');
  unsharpMask(img, DEFAULT_PARAMS); report('+ sharpen');
}
main();
