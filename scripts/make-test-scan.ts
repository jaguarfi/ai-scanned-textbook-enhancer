/**
 * Builds a synthetic "scanned textbook page" with known, controlled defects.
 *
 * Using a generated page rather than a real scan means the ground truth is
 * known exactly, so the pipeline can be checked for faithfulness rather than
 * just eyeballed.
 */
import sharp from 'sharp';
import { writeFileSync } from 'fs';

const W = 1240;
const H = 1754; // A4 at 150 DPI

function pageSvg(): string {
  const lines: string[] = [];
  let y = 190;
  const body = [
    'A quantity is said to vary directly with another when the ratio',
    'between them stays constant. If y = kx, then k is the constant of',
    'proportionality. Consider the table below, which records the',
    'distance travelled by a cyclist at a steady speed.',
  ];
  for (const text of body) {
    lines.push(
      `<text x="110" y="${y}" font-family="Georgia,serif" font-size="25" fill="#1a1a1a">${text}</text>`
    );
    y += 42;
  }

  // A small data table: numerals are the highest-stakes content on the page,
  // since a single altered digit makes the material wrong.
  const rows = [
    ['Time (h)', 'Distance (km)'],
    ['1', '18'],
    ['2', '36'],
    ['3', '54'],
    ['4', '72'],
  ];
  let ty = 430;
  for (let i = 0; i < rows.length; i++) {
    const weight = i === 0 ? 'bold' : 'normal';
    lines.push(
      `<text x="150" y="${ty}" font-family="Georgia,serif" font-size="24" font-weight="${weight}" fill="#1a1a1a">${rows[i][0]}</text>`,
      `<text x="360" y="${ty}" font-family="Georgia,serif" font-size="24" font-weight="${weight}" fill="#1a1a1a">${rows[i][1]}</text>`
    );
    ty += 38;
  }
  lines.push(`<line x1="140" y1="442" x2="560" y2="442" stroke="#1a1a1a" stroke-width="1.5"/>`);
  lines.push(`<rect x="140" y="405" width="420" height="195" fill="none" stroke="#1a1a1a" stroke-width="1.5"/>`);

  // An equation and a faint pencil annotation. The pencil is deliberately
  // low-contrast: it is the first thing an over-aggressive filter destroys.
  lines.push(
    `<text x="110" y="660" font-family="Georgia,serif" font-size="27" fill="#111">d = 18t,   where t &#8805; 0</text>`,
    `<text x="110" y="712" font-family="Georgia,serif" font-size="20" fill="#9a9a9a">check this at t = 2.5</text>`
  );

  // A simple line diagram with axes.
  lines.push(
    `<line x1="150" y1="1030" x2="150" y2="790" stroke="#1a1a1a" stroke-width="2"/>`,
    `<line x1="150" y1="1030" x2="520" y2="1030" stroke="#1a1a1a" stroke-width="2"/>`,
    `<polyline points="150,1030 250,970 350,910 450,850" fill="none" stroke="#1a1a1a" stroke-width="2"/>`,
    `<text x="530" y="1036" font-family="Georgia,serif" font-size="18" fill="#1a1a1a">t</text>`,
    `<text x="132" y="782" font-family="Georgia,serif" font-size="18" fill="#1a1a1a">d</text>`
  );

  let py = 1120;
  for (const text of [
    'Notice that the graph is a straight line through the origin. This is',
    'the defining feature of direct variation, and distinguishes it from',
    'the inverse relationships studied in the next section.',
  ]) {
    lines.push(
      `<text x="110" y="${py}" font-family="Georgia,serif" font-size="25" fill="#1a1a1a">${text}</text>`
    );
    py += 42;
  }

  lines.push(
    `<text x="${W / 2}" y="1650" text-anchor="middle" font-family="Georgia,serif" font-size="19" fill="#444">47</text>`
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="#ffffff"/>
    <text x="110" y="120" font-family="Georgia,serif" font-size="34" font-weight="bold" fill="#000">3.2  Direct Variation</text>
    ${lines.join('\n    ')}
  </svg>`;
}

/**
 * Applies the defects a real flatbed scan of a textbook exhibits: a warm paper
 * cast, an uneven lighting gradient falling off toward the spine, sensor
 * grain, and a slight rotation.
 */
async function degrade(clean: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(clean)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const px = new Uint8ClampedArray(data);

  // Deterministic pseudo-noise so the fixture is reproducible across runs.
  let seed = 20240917;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;

      // Lighting: bright at top-right, falling off toward the bottom-left
      // spine, plus a mild vignette.
      const nx = x / w;
      const ny = y / h;
      const gradient = 1 - 0.17 * (1 - nx) - 0.13 * ny;
      const vignette = 1 - 0.1 * ((nx - 0.5) ** 2 + (ny - 0.5) ** 2) * 2;
      const light = gradient * vignette;

      // Aged paper: warm, slightly desaturated toward blue.
      const cast = [1.0, 0.965, 0.885];

      const noise = (rand() - 0.5) * 17;

      for (let c = 0; c < 3; c++) {
        px[i + c] = px[i + c] * light * cast[c] + noise;
      }
    }
  }

  return sharp(Buffer.from(px), { raw: { width: w, height: h, channels: 3 } })
    .rotate(1.4, { background: { r: 232, g: 224, b: 205 } })
    .jpeg({ quality: 62 }) // Compression artefacts, as in a real archive scan.
    .toBuffer();
}

async function main() {
  const clean = await sharp(Buffer.from(pageSvg())).png().toBuffer();
  writeFileSync('scripts/fixtures/clean-page.png', clean);

  const scanned = await degrade(clean);
  writeFileSync('scripts/fixtures/scanned-page.jpg', scanned);

  const meta = await sharp(scanned).metadata();
  console.log(`clean-page.png    ${W}x${H}`);
  console.log(`scanned-page.jpg  ${meta.width}x${meta.height}  ${Math.round(scanned.length / 1024)} KB`);
  console.log('Defects: 1.4deg skew, warm cast, lighting gradient, grain, JPEG q62');
}

main();
