import sharp from 'sharp';

// Region of interest in clean-page coordinates, mapped into each render.
const regions: Record<string, [number, number, number, number]> = {
  table:  [140, 400, 440, 210],
  pencil: [100, 630, 520, 100],
  body:   [100, 160, 620, 130],
};

async function main() {
  const region = process.argv[2] || 'table';
  const [x, y, w, h] = regions[region];

  // The scan is rotated and padded; the restore is deskewed then doubled.
  const orig = await sharp('scripts/fixtures/scanned-page.jpg')
    .extract({ left: x + 14, top: y + 26, width: w, height: h })
    .resize(w * 2, h * 2, { kernel: 'nearest' })
    .toBuffer();

  const rest = await sharp('scripts/fixtures/restored-page.png')
    .extract({ left: (x + 22) * 2, top: (y + 30) * 2, width: w * 2, height: h * 2 })
    .toBuffer();

  const label = async (buf: Buffer, text: string) =>
    sharp(buf).extend({ top: 30, bottom: 6, left: 6, right: 6, background: '#ffffff' })
      .composite([{
        input: Buffer.from(`<svg width="${w * 2}" height="26"><text x="4" y="19" font-family="sans-serif" font-size="17" fill="#c00">${text}</text></svg>`),
        top: 2, left: 6,
      }]).toBuffer();

  const top = await label(orig, 'SCANNED INPUT (nearest-neighbour 2x, for fair comparison)');
  const bottom = await label(rest, 'DETERMINISTIC RESTORE');

  const tm = await sharp(top).metadata();
  const bm = await sharp(bottom).metadata();

  await sharp({
    create: { width: Math.max(tm.width!, bm.width!), height: tm.height! + bm.height!, channels: 3, background: '#ffffff' },
  })
    .composite([
      { input: top, top: 0, left: 0 },
      { input: bottom, top: tm.height!, left: 0 },
    ])
    .png()
    .toFile(`scripts/fixtures/compare-${region}.png`);

  console.log(`scripts/fixtures/compare-${region}.png`);
}
main();
