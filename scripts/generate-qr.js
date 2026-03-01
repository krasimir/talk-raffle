const fs = require('node:fs/promises');
const path = require('node:path');
const QRCode = require('qrcode');

async function run() {
  const targetUrl = process.env.RAFFLE_PUBLIC_URL || 'http://localhost:3000/';
  const outputPath = process.env.QR_OUTPUT || path.join('public', 'registration-qr.png');
  const absoluteOutput = path.join(process.cwd(), outputPath);

  await fs.mkdir(path.dirname(absoluteOutput), { recursive: true });
  await QRCode.toFile(absoluteOutput, targetUrl, {
    errorCorrectionLevel: 'M',
    width: 720,
    margin: 2
  });

  console.log(`QR generated: ${outputPath}`);
  console.log(`URL encoded: ${targetUrl}`);
}

run().catch((error) => {
  console.error('Failed to generate QR:', error.message);
  process.exit(1);
});