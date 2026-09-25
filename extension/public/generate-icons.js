const { createCanvas } = require('canvas');
const fs = require('fs');

const sizes = [16, 48, 128];

for (const size of sizes) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#1f6feb');
  gradient.addColorStop(1, '#a371f7');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  const radius = size * 0.1875;
  ctx.roundRect(0, 0, size, size, radius);
  ctx.fill();

  // Pi symbol
  ctx.fillStyle = 'white';
  ctx.font = `bold ${size * 0.5}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('π', size / 2, size * 0.6);

  // Lightning bolt indicator
  ctx.fillStyle = '#238636';
  ctx.beginPath();
  ctx.arc(size * 0.75, size * 0.25, size * 0.125, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'white';
  ctx.font = `bold ${size * 0.18}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚡', size * 0.75, size * 0.28);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(`icon-${size}.png`, buffer);
  console.log(`Generated icon-${size}.png`);
}
