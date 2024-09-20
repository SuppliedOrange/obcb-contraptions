import fs from 'fs';
import {loadImage, createCanvas} from 'canvas';
import { BitmapClient } from './client';

const startIndex = 264724;
const widthImage = 60;
const page = 2;
const image_path = './images/triangle-1.png';

async function main() {

    // Function to convert image to black and white and map it to a binary array
    async function convertToBinaryPixels(imagePath: string, targetWidth: number, startIndex=0, threshold = 128, invert = false) {
        const image = await loadImage(imagePath);
        const targetHeight = Math.floor(image.height * (targetWidth / image.width));

        const canvas = createCanvas(targetWidth, targetHeight);
        const ctx = canvas.getContext('2d');

        const gridWidth = 60;
        
        ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
        const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
        const binaryPixels = new Array(targetWidth * targetHeight).fill(0);

        const startRow = Math.floor(startIndex / gridWidth);
        const startCol = startIndex % gridWidth;

        for (let row = 0; row < targetHeight; row++) {
            for (let col = 0; col < targetWidth; col++) {
                const pixelIndex = row * targetWidth + col;
                const gridRow = startRow + Math.floor(pixelIndex / gridWidth);
                const gridCol = (startCol + col) % gridWidth;

                const originalIndex = (row * targetWidth + col) * 4;
                const grayscale = (imageData.data[originalIndex] + imageData.data[originalIndex + 1] + imageData.data[originalIndex + 2]) / 3;
                let dark = (invert) ? 0 : 1;
                let light = (invert) ? 1 : 0;
                binaryPixels[gridRow * gridWidth + gridCol] = grayscale < threshold ? dark : light; // Apply threshold
            }
        }

        let trimmedBinaryPixels = binaryPixels.slice(startIndex);

        return { binaryPixels: trimmedBinaryPixels, width: targetWidth, height: targetHeight };
    }

    function createBlackAndWhiteImage(binaryPixels, width, height, outputPath) {
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(width, height);

        for (let i = 0; i < binaryPixels.length; i++) {
            const colorValue = binaryPixels[i] === 1 ? 0 : 255; // 0 for black, 255 for white
            const index = i * 4;
            imageData.data[index] = colorValue;      // R
            imageData.data[index + 1] = colorValue;  // G
            imageData.data[index + 2] = colorValue;  // B
            imageData.data[index + 3] = 255;         // A (full opacity)
        }

        ctx.putImageData(imageData, 0, 0);

        // Save the canvas as an image file
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(outputPath, buffer);
        console.log(`Black-and-white image saved to ${outputPath}`);
    }

    interface ImageDetails {
        name: string,
        threshold: number,
        invert?: boolean
    }

    let image: ImageDetails = {
        name: image_path,
        threshold: 200
    }

    // Out of memory heap error!
    convertToBinaryPixels(image.name, widthImage, startIndex, image.threshold, image.invert).then(({ binaryPixels, width, height, }) => {
        createBlackAndWhiteImage(binaryPixels, width, height, `./renders/render_one-time-image.jpeg`);
    });
    
    let { binaryPixels } = await convertToBinaryPixels( image.name, widthImage, startIndex, image.threshold, image.invert );

    async function navigateAndWait(client: BitmapClient, page: number, retries: number = 15000) {

        // Wait for the websocket to open
        let currentRetry = 0;
        if (!client.websocketOpen) {
            while (true) {
                if (currentRetry >= retries) break;
                if (client.websocketOpen) break;
                currentRetry += 100;
                await new Promise(r => setTimeout(r, 100));
            }
        }

        // Wait for the chunk index to change
        client.setChunkIndex(page - 1);
        currentRetry = 0;

        if (!client.chunkLoaded) {
            while (true) {
                if (currentRetry >= retries) break;
                if (client.chunkLoaded) break;
                currentRetry += 100;
                await new Promise(r => setTimeout(r, 100));
            }
        }


    }

    let client = new BitmapClient();
    await navigateAndWait(client, page);

    async function drawImage() {

        return new Promise( async (resolve, reject) => {
            for (let index = 0; index < binaryPixels.length; index++) {

                let pixel = binaryPixels[index];
                let pixelIndex = startIndex + index;
        
                let isChecked = await client.isChecked(pixelIndex);
                if (
                    pixel === 1 && !isChecked ||
                    pixel === 0 && isChecked
                ) {             
                    try {
                        client.toggle(pixelIndex);
                    }  
                    catch (err) {
                        console.error(`We hit an error so aborted.\nError:\n${err}`);
                        process.exit();
                    }
                    
                }

            }
            resolve("finished")
        })

    }

    console.log("Drawing image.")

    await drawImage();

}

main();