import sharp from 'sharp';
import fs from 'fs';
import { enhanceWithAI } from '../server/ai/enhance';

/**
 * Checks the padding and crop-back geometry without calling the real model.
 *
 * The model is stubbed with a resize, which is the one thing a well-behaved
 * generative model would do to the frame: hand back the same composition at
 * its own resolution. If the pad/crop arithmetic is right, the page comes back
 * at its original dimensions with its content in the original places.
 */
async function main() {
  const input = fs.readFileSync('scripts/fixtures/scanned-page.jpg');
  const sourceMeta = await sharp(input).metadata();
  const sw = sourceMeta.width!;
  const sh = sourceMeta.height!;

  let requested: any = null;
  let receivedSize = { width: 0, height: 0 };

  const stub: any = {
    models: {
      generateContent: async (req: any) => {
        requested = req;
        const bytes = Buffer.from(req.contents.parts[0].inlineData.data, 'base64');
        const meta = await sharp(bytes).metadata();
        receivedSize = { width: meta.width!, height: meta.height! };

        // Stand in for the model: same framing, the model's own resolution.
        const out = await sharp(bytes)
          .resize({ height: 2048, kernel: 'lanczos3' })
          .png()
          .toBuffer();

        return {
          candidates: [
            { content: { parts: [{ inlineData: { data: out.toString('base64'), mimeType: 'image/png' } }] } },
          ],
        };
      },
    },
  };

  const result = await enhanceWithAI(stub, input);

  const cfg = requested.config;
  const padded = receivedSize;
  const paddedRatio = padded.width / padded.height;

  console.log('--- Request sent to the model ---');
  console.log(`  temperature        ${cfg.temperature}`);
  console.log(`  seed               ${cfg.seed}`);
  console.log(`  aspectRatio        ${cfg.imageConfig.aspectRatio}`);
  console.log(`  imageSize          ${cfg.imageConfig.imageSize}`);
  console.log(`  prompt words       ${requested.contents.parts[1].text.split(/\s+/).length}`);

  console.log('\n--- Geometry ---');
  console.log(`  source             ${sw}x${sh}  ratio ${(sw / sh).toFixed(4)}`);
  console.log(`  padded for model   ${padded.width}x${padded.height}  ratio ${paddedRatio.toFixed(4)}`);
  console.log(`  padding added      ${result.paddedPixels.x}px each side, ${result.paddedPixels.y}px top/bottom`);
  console.log(`  returned           ${result.width}x${result.height}  ratio ${(result.width / result.height).toFixed(4)}`);

  const targetRatio = eval(cfg.imageConfig.aspectRatio.replace(':', '/'));
  const ratioError = Math.abs(paddedRatio - targetRatio) / targetRatio * 100;
  const shapeError = Math.abs(result.width / result.height - sw / sh) / (sw / sh) * 100;
  console.log(`  padded vs target   ${ratioError.toFixed(3)}% off`);
  console.log(`  output vs source   ${shapeError.toFixed(3)}% shape distortion`);

  console.log('\n--- Fidelity of the round trip ---');
  const f = result.fidelity;
  console.log(`  added / lost       ${(f.addedInkRatio * 100).toFixed(3)}% / ${(f.lostInkRatio * 100).toFixed(3)}%`);
  console.log(`  largest new mark   ${f.largestAddedCluster}px`);
  console.log(`  worst erasure      ${(f.worstBlockLossRatio * 100).toFixed(1)}%`);
  console.log(`  tone delta         ${f.paperToneDelta.toFixed(2)}`);
  console.log(`  edge correlation   ${f.structuralCorrelation.toFixed(4)}`);
  console.log(`  verdict            ${f.passed ? 'PASS' : 'REVIEW'}`);
  for (const w of f.warnings) console.log(`    ! ${w}`);

  const ok = shapeError < 0.5 && ratioError < 0.5;
  console.log(`\n  GEOMETRY PRESERVED: ${ok ? 'YES' : 'NO'}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
