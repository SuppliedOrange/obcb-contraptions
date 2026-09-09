import fs from 'fs';
import { loadImage, createCanvas } from 'canvas';
import { BitmapClient } from './client';
import { Jimp, loadFont } from 'jimp';
import { SANS_16_BLACK } from 'jimp/fonts';

// deepseek my goat. youre just as bad as i am. thank you.

// Configuration
const startIndex = 0;           // Starting pixel index on the canvas
const page = 1;                 // Chunk/page to use
const pollImagePath = './images/eye_poll.jpg';
const hearImagePath = './images/eye_hear.jpg';
const counterFile = './counter.json';
const targetWidth = 60;         // Grid width
const imageHeight = 120;        // Both images are 60×120
const counterAreaHeight = 40;   // Bottom blank area for counter
const pollRegionLength = targetWidth * imageHeight; // 7200 pixels

// Load font for counter text
const font = await loadFont(SANS_16_BLACK);

// ------------------------------------------------------------
// Helper: Convert an image to binary pixel array (with optional targetHeight)
// ------------------------------------------------------------
async function convertToBlackAndWhite(
  imagePath: string,
  targetWidth: number,
  startIndex = 0,
  threshold = 128,
  invert = false,
  targetHeight?: number   // If provided, force exact height
) {
  const image = await loadImage(imagePath);
  // If targetHeight is provided, use it; otherwise compute from aspect ratio
  const finalHeight = targetHeight ?? Math.floor(image.height * (targetWidth / image.width));

  const canvas = createCanvas(targetWidth, finalHeight);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, targetWidth, finalHeight);
  const imageData = ctx.getImageData(0, 0, targetWidth, finalHeight);
  const binaryPixels = new Array(targetWidth * finalHeight).fill(0);

  const gridWidth = 60;
  const startRow = Math.floor(startIndex / gridWidth);
  const startCol = startIndex % gridWidth;

  for (let row = 0; row < finalHeight; row++) {
    for (let col = 0; col < targetWidth; col++) {
      const pixelIndex = row * targetWidth + col;
      const gridRow = startRow + Math.floor(pixelIndex / gridWidth);
      const gridCol = (startCol + col) % gridWidth;

      const originalIndex = (row * targetWidth + col) * 4;
      const grayscale =
        (imageData.data[originalIndex] +
          imageData.data[originalIndex + 1] +
          imageData.data[originalIndex + 2]) /
        3;
      const dark = invert ? 0 : 1;
      const light = invert ? 1 : 0;
      binaryPixels[gridRow * gridWidth + gridCol] =
        grayscale < threshold ? dark : light;
    }
  }

  const trimmed = binaryPixels.slice(startIndex);
  return { binaryPixels: trimmed, width: targetWidth, height: finalHeight };
}

// ------------------------------------------------------------
// Persistent counter
// ------------------------------------------------------------
function readCounter(): number {
  try {
    if (fs.existsSync(counterFile)) {
      const data = JSON.parse(fs.readFileSync(counterFile, 'utf8'));
      return data.count || 0;
    }
  } catch (err) {
    console.error('Error reading counter file, starting at 0', err);
  }
  return 0;
}

function saveCounter(count: number) {
  fs.writeFileSync(counterFile, JSON.stringify({ count }), 'utf8');
}

// ------------------------------------------------------------
// Generate binary pixels for the "hear" image with counter text
// ------------------------------------------------------------
async function getHearPixelsWithCounter(count: number): Promise<number[]> {
  // Load eye_hear.jpg and resize to exactly 60×120
  const hearBase = await Jimp.read(hearImagePath);
  hearBase.resize({ w: targetWidth, h: imageHeight });

  // Create a new white canvas of size 60×120
  const canvas = new Jimp({
    width: targetWidth,
    height: imageHeight,
    color: 0xffffffff,
  });

  // Composite the full hear image (including its blank bottom)
  canvas.composite(hearBase, 0, 0);

  // Set color to black for the text
  canvas.scan(0, 0, canvas.bitmap.width, canvas.bitmap.height, function (x, y, idx) {
    // This is just to ensure the color is set, but we can set it before print
  });
  // More direct: use the color method (Jimp v1)
  // canvas.color([{ apply: 'mix', params: [0x000000] }]); // Not sure about API
  // Actually, the print method uses the current foreground color which defaults to black? 
  // To be safe, we can draw text on a separate transparent layer and composite.
  // Simpler: just print – black text on white background should be visible.
  const text = String(count);
  const approxCharWidth = 8; // approximate width per character at 16px
  const textWidth = text.length * approxCharWidth;
  const x = Math.max(0, Math.floor((targetWidth - textWidth) / 2));
  const y = imageHeight - counterAreaHeight + Math.floor((counterAreaHeight - font.info.size) / 2);
  canvas.print({ text, x, y, font });

  // Ensure the output directory exists
  if (!fs.existsSync('./renders')) {
    fs.mkdirSync('./renders', { recursive: true });
  }

  // Write the generated image to a temporary file
  const tempPath = './renders/temp_hear.png';
  await canvas.write(tempPath);

  // Convert the temporary file to binary pixels (exact 60×120)
  const { binaryPixels } = await convertToBlackAndWhite(tempPath, targetWidth, 0, 128, false, imageHeight);
  return binaryPixels;
}

// ------------------------------------------------------------
// BitmapClient navigation
// ------------------------------------------------------------
async function navigateAndWait(client: BitmapClient, page: number, retries = 15000) {
  let currentRetry = 0;
  if (!client.websocketOpen) {
    while (true) {
      if (currentRetry >= retries) break;
      if (client.websocketOpen) break;
      currentRetry += 100;
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  client.setChunkIndex(page - 1);
  currentRetry = 0;

  if (!client.chunkLoaded) {
    while (true) {
      if (currentRetry >= retries) break;
      if (client.chunkLoaded) break;
      currentRetry += 100;
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}

// ------------------------------------------------------------
// Render a binary pixel array starting at startIndex
// ------------------------------------------------------------
async function renderPixels(client: BitmapClient, binaryPixels: number[]) {
  for (let i = 0; i < binaryPixels.length; i++) {
    const pixel = binaryPixels[i];
    const pixelIndex = startIndex + i;
    const isChecked = client.isChecked(pixelIndex);
    if ((pixel === 1 && !isChecked) || (pixel === 0 && isChecked)) {
      try {
        client.toggle(pixelIndex);
      } catch (err) {
        console.error('Toggle error:', err);
      }
    }
  }
}

// ------------------------------------------------------------
// Poll for changes in the poll region
// ------------------------------------------------------------
function pollForChanges(
  client: BitmapClient,
  baseline: number[],
  intervalMs = 500
): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      for (let i = 0; i < baseline.length; i++) {
        const pixelIndex = startIndex + i;
        const expected = baseline[i] === 1;
        const actual = client.isChecked(pixelIndex);
        if (expected !== actual) {
          resolve();
          return;
        }
      }
      setTimeout(check, intervalMs);
    };
    check();
  });
}

// ------------------------------------------------------------
// Main execution
// ------------------------------------------------------------
async function main() {
  const client = new BitmapClient();
  await navigateAndWait(client, page);

  // Load poll image and get baseline pixels (force height = 120)
  const { binaryPixels: pollPixels } = await convertToBlackAndWhite(
    pollImagePath,
    targetWidth,
    startIndex,
    128,
    false,
    imageHeight
  );
  console.log(`Poll image pixel count: ${pollPixels.length} (expected ${pollRegionLength})`);

  // Initialize counter
  let touchCount = readCounter();
  console.log(`Starting counter: ${touchCount}`);

  let state: 'poll' | 'hear' = 'poll';

  while (true) {
    if (state === 'poll') {
      // Render the poll image
      await renderPixels(client, pollPixels);
      console.log('Poll image rendered. Waiting 1 second for state to settle...');
      // Wait for the toggles to be applied and the client state to update
      await new Promise((r) => setTimeout(r, 1000));

      // Now poll for changes (user interaction)
      await pollForChanges(client, pollPixels);

      // Change detected – increment and persist counter
      touchCount++;
      saveCounter(touchCount);
      console.log(`Touch detected! Count = ${touchCount}`);
      state = 'hear';
    } else {
      const hearPixels = await getHearPixelsWithCounter(touchCount);
      await renderPixels(client, hearPixels);
      console.log('Hear image rendered with counter. Waiting 5 seconds...');
      await new Promise((r) => setTimeout(r, 5000));
      state = 'poll';
    }
    await new Promise((r) => setImmediate(r));
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});