/* ============================================================================
 * Generate PWA PNG icons (192×192 + 512×512) from the SVG favicon
 * ==========================================================================*/
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SVG_PATH = path.join(__dirname, '..', 'images', 'favicon.svg');
const OUT_DIR = path.join(__dirname, '..', 'images');

const SIZES = [192, 512];

async function main() {
  const svgBuffer = fs.readFileSync(SVG_PATH);

  for (const size of SIZES) {
    const outPath = path.join(OUT_DIR, `icon-${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 0 } })
      .png()
      .toFile(outPath);
    const stats = fs.statSync(outPath);
    console.log(`✅  icon-${size}.png  (${(stats.size / 1024).toFixed(1)} KB)`);
  }

  console.log('\n🎉  PWA icons generated successfully!');
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
