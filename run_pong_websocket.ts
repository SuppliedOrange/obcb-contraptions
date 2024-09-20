import {loadImage, createCanvas} from 'canvas';
import { BitmapClient } from './client';

const startIndex = 262144;
const page = 2;

async function main() {

    // Function to convert image to black and white and map it to a binary array
    async function convertToBlackAndWhite(imagePath: string, targetWidth: number, startIndex=0, threshold = 128) {
        const image = await loadImage(imagePath);
        const targetHeight = Math.floor(image.height * (targetWidth / image.width)) + 16;

        const canvas = createCanvas(targetWidth, targetHeight);
        const ctx = canvas.getContext('2d');
        
        ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
        const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
        const binaryPixels = new Array(targetWidth * targetHeight).fill(0);

        const gridWidth = 60;
        const startRow = Math.floor(startIndex / gridWidth);
        const startCol = startIndex % gridWidth;

        for (let row = 0; row < targetHeight; row++) {
            for (let col = 0; col < targetWidth; col++) {
                const pixelIndex = row * targetWidth + col;
                const gridRow = startRow + Math.floor(pixelIndex / gridWidth);
                const gridCol = (startCol + col) % gridWidth;

                const originalIndex = (row * targetWidth + col) * 4;
                const grayscale = (imageData.data[originalIndex] + imageData.data[originalIndex + 1] + imageData.data[originalIndex + 2]) / 3;
                binaryPixels[gridRow * gridWidth + gridCol] = grayscale < threshold ? 1 : 0; // Apply threshold
            }
        }

        let trimmedBinaryPixels = binaryPixels.slice(startIndex);

        return { binaryPixels: trimmedBinaryPixels, width: targetWidth, height: targetHeight };
    }


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
    let combatMode = false;

    async function drawImage() {

        let chosenBinaryPixels;

        try {
            let { binaryPixels, width, height } = await convertToBlackAndWhite( "./images/pong.png", 60, startIndex, 128 );
            chosenBinaryPixels = binaryPixels;
        }
        catch (err) {
            return
        }

        return new Promise( (resolve, reject) => {
            for (let index = 0; index < chosenBinaryPixels.length; index++) {

                let pixel = chosenBinaryPixels[index];
                let pixelIndex = startIndex + index;
        
                let isChecked = client.isChecked(pixelIndex);
                if (
                    pixel === 1 && !isChecked ||
                    pixel === 0 && isChecked
                ) {               
                    try { client.toggle(pixelIndex); }
                    catch (err) { console.log(err); }
                }

            }
            resolve("finished")
        })

    }

    while (true) {

        try {
            if (!combatMode) await new Promise(r => setTimeout(r, 300));
            await navigateAndWait(client, page);
            await drawImage()
            await new Promise(r => setImmediate(r));;
        }
        catch (error) {
            console.log(error);
            process.exit(1)
        }
    }

}

main();