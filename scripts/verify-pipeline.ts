/**
 * Verifies the two properties the deterministic engine exists to guarantee:
 * byte-identical reproducibility, and faithfulness to the source page.
 */
import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { enhanceDeterministic } from '../server/pipeline/deterministic';

const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex').slice(0, 16);

async function main() {
  const input = readFileSync('scripts/fixtures/scanned-page.jpg');

  console.log('Run 1...');
  const t1 = Date.now();
  const a = await enhanceDeterministic(input);
  const elapsed = Date.now() - t1;

  console.log('Run 2...');
  const b = await enhanceDeterministic(input);

  console.log('\n--- Stages ---');
  for (const s of a.stages) {
    console.log(`  ${s.name.padEnd(22)} ${String(s.ms).padStart(6)}ms  ${s.detail}`);
  }

  console.log('\n--- Determinism ---');
  const hashA = sha(a.enhancedUrl);
  const hashB = sha(b.enhancedUrl);
  console.log(`  run 1 output sha256: ${hashA}`);
  console.log(`  run 2 output sha256: ${hashB}`);
  console.log(`  IDENTICAL: ${hashA === hashB ? 'YES' : 'NO  <-- FAILURE'}`);

  console.log('\n--- Faithfulness ---');
  const f = a.fidelity;
  console.log(`  added ink            ${(f.addedInkRatio * 100).toFixed(3)}%   (invented content)`);
  console.log(`  lost ink             ${(f.lostInkRatio * 100).toFixed(3)}%   (destroyed content)`);
  console.log(`  largest added blob   ${f.largestAddedCluster} px      (trips at 120)`);
  console.log(`  largest lost blob    ${f.largestLostCluster} px      (trips at 120)`);
  console.log(`  worst local erasure  ${(f.worstBlockLossRatio * 100).toFixed(1)}%     (trips at 40%)`);
  console.log(`  paper tone delta     ${f.paperToneDelta.toFixed(2)} levels`);
  console.log(`  edge correlation     ${f.structuralCorrelation.toFixed(4)}`);
  console.log(`  verdict:             ${f.passed ? 'PASS' : 'REVIEW'}`);
  for (const w of f.warnings) console.log(`    ! ${w}`);

  console.log('\n--- Geometry & tone ---');
  console.log(`  deskew applied       ${a.deskewAngle.toFixed(2)}deg  (fixture was skewed 1.40deg)`);
  console.log(
    `  source paper tone    rgb(${Math.round(a.paperTone.r)}, ${Math.round(
      a.paperTone.g
    )}, ${Math.round(a.paperTone.b)})  lum ${a.paperTone.luminance}`
  );
  console.log(`  output               ${a.width}x${a.height}, ${Math.round(a.size / 1024)} KB`);
  console.log(`  wall clock           ${elapsed}ms`);

  writeFileSync(
    'scripts/fixtures/restored-page.png',
    Buffer.from(a.enhancedUrl.split(',')[1], 'base64')
  );
  console.log('\nWrote scripts/fixtures/restored-page.png');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
