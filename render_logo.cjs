const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const svgPath = path.join(__dirname, 'public', 'logo.svg');
const svgContentFull = fs.readFileSync(svgPath, 'utf8');

// Generate the foreground SVG by removing the background rect
const svgContentForeground = svgContentFull.replace(/<rect[^>]*fill="#1E293B"[^>]*\/>/, '');

const densities = [
  { name: 'ldpi', launcherSize: 36, foregroundSize: 81 },
  { name: 'mdpi', launcherSize: 48, foregroundSize: 108 },
  { name: 'hdpi', launcherSize: 72, foregroundSize: 162 },
  { name: 'xhdpi', launcherSize: 96, foregroundSize: 216 },
  { name: 'xxhdpi', launcherSize: 144, foregroundSize: 324 },
  { name: 'xxxhdpi', launcherSize: 192, foregroundSize: 432 }
];

async function generateAll() {
  for (const density of densities) {
    const dirPath = path.join(__dirname, 'android', 'app', 'src', 'main', 'res', `mipmap-${density.name}`);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // 1. Generate ic_launcher.png (Full with background)
    await sharp(Buffer.from(svgContentFull))
      .resize(density.launcherSize, density.launcherSize)
      .png()
      .toFile(path.join(dirPath, 'ic_launcher.png'));

    // 2. Generate ic_launcher_round.png (Full with background)
    await sharp(Buffer.from(svgContentFull))
      .resize(density.launcherSize, density.launcherSize)
      .png()
      .toFile(path.join(dirPath, 'ic_launcher_round.png'));

    // 3. Generate ic_launcher_foreground.png (Transparent background)
    await sharp(Buffer.from(svgContentForeground))
      .resize(density.foregroundSize, density.foregroundSize)
      .png()
      .toFile(path.join(dirPath, 'ic_launcher_foreground.png'));

    console.log(`Generated all launcher PNGs for density: mipmap-${density.name}`);
  }
}

generateAll()
  .then(() => console.log('Successfully generated all high-resolution custom PNG icons from logo.svg!'))
  .catch(err => console.error('Error generating icons:', err));
