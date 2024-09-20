/**
 * This was like an older version. If you're wondering why this is here...
 * invoked this with `node --max-old-space-size=20000 run_generate_image_big.js`
 * Yes, instead of correcting my code to use less memory I gave node 20 gigabytes
 * of it so it would work without complaining about it.
 */ 

const fs = require("fs");
const { loadImage, createCanvas } = require('canvas');
const { BitmapClient } = require("./client.js");

// any pixelIndex on the 32768 square = (column * 32768) - (32768 - row )
// wait no, opposite? yeah, column is row and vice versa. I don't know why.
// 163807233 fischl, 327652232 for korone 
const startIndex = 163807233;
// the width of the image.
const widthImage = 5000;
// The current page that it has loaded and navigated to.
let page = 1;
// 60 / width of canvas
const gridWidth = 32768;
// Image path
const image_path = './renders/render_dither_grayscale.png';
// You'll need to fill these in to modify your image correctly.
const image_invert = false;
const drawImageFromBinaryPixels = true;
const logBinaryPixelsAndRenderImage = false;
// 128 for fischl, 200 for korone.
const image_threshold = 128;

// IMPORTANT! YOU MUST CHANGE THIS. IDFK WHY. You'll need 6 for 5k width, 1 for 1k width on a square.
// 6 for fischl, 4 for korone
const targetHeightMultiplier = 6;
// It will vary based on the height of the image itself.
// You'd wanna ideally render once with this set to 1, see how bad it messed up and change it's multiplier accordingly. Why does it fail like this? :(
// I've rendered an image out of the binary pixels we get and it seems to be perfectly fine. I hate this.

async function main() {

    let client = new BitmapClient();
    await navigateAndWait(client, page);

    // Function to convert image to black and white and map it to a binary array
    async function convertToBinaryPixels(imagePath, targetWidth, startIndex=0, threshold = 128, invert = false) {

        const image = await loadImage(imagePath);
        let targetHeight = Math.floor(image.height * (targetWidth / image.width));
        if (drawImageFromBinaryPixels) targetHeight = targetHeight * targetHeightMultiplier // IMPORTANT! YOU MUST CHANGE THIS. IDFK WHY. You'll need 6 for 5k width, 1 for 1k widthon a square.
        // It will vary based on the height of the image itself.
        // You'd wanna ideally render once, see how bad it messed up and change it's multiplier accordingly. Why does it fail like this? :(
        // I've rendered an image out of the binary pixels we get and it seems to be perfectly fine. I hate this.

        const canvas = createCanvas(targetWidth, targetHeight);
        const ctx = canvas.getContext('2d');
        
        ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
        const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);

        const startRow = Math.floor(startIndex / gridWidth);
        const startCol = startIndex % gridWidth;

        let binaryPixels = []

        for (let row = 0; row < targetHeight; row++) {

            for (let col = 0; col < targetWidth; col++) {

                const pixelIndex = row * targetWidth + col;
                const gridRow = startRow + Math.floor(pixelIndex / gridWidth);
                const gridCol = (startCol + col) % gridWidth;

                const originalIndex = (row * targetWidth + col) * 4;
                const grayscale = (imageData.data[originalIndex] + imageData.data[originalIndex + 1] + imageData.data[originalIndex + 2]) / 3;

                const dark = (invert) ? 0 : 1;
                const light = (invert) ? 1 : 0;

                const pixelDetails = {
                    pixel: gridRow * gridWidth + gridCol,
                    toggle:
                        grayscale < threshold ?
                        invert? light : dark
                        :
                        invert? dark : light,
                    isChecked: client.isChecked(gridRow * gridWidth + gridCol)
                }
                if (logBinaryPixelsAndRenderImage) binaryPixels.push(pixelDetails);
                if (drawImageFromBinaryPixels) await drawSingleBinaryPixel(pixelDetails);

            }

            console.log(`Finished ${row} out of ${targetHeight}`);
        }

        return { binaryPixels: binaryPixels, width: targetWidth, height: targetHeight };
    }

    function createBlackAndWhiteImage(binaryPixels, width, height, outputPath) {
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(width, height);

        for (let i = 0; i < binaryPixels.length; i++) {
            const colorValue = binaryPixels[i].toggle === 1 ? 0 : 255; // 0 for black, 255 for white
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

    let image = {
        name: image_path,
        threshold: image_threshold,
        invert: image_invert
    }
    
    let { binaryPixels, width, height, } = await convertToBinaryPixels( image.name, widthImage, startIndex, image.threshold, image.invert );
    if (logBinaryPixelsAndRenderImage) createBlackAndWhiteImage(binaryPixels, width, height, `./renders/render_one-time-image.jpeg`);

    function getPageFromPixelIndex(pixelIndex) {
        // Each page contains 262144 pixels
        const pixelsPerPage = 262144;
    
        // Page number is determined by integer division of pixel by pixelsPerPage
        const pageNumber = Math.floor(pixelIndex / pixelsPerPage) + 1;
    
        return pageNumber;
    }

    async function navigateAndWait(client, page, retries = 15000) {

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

    async function drawSingleBinaryPixel( pixelDetails ) {

        let pageOfPixelIndex = getPageFromPixelIndex(pixelDetails.pixel);
        if (page != pageOfPixelIndex) {
            page = pageOfPixelIndex;
            await navigateAndWait(client, page);
        }

        return new Promise( async (resolve, reject) => {

            let isChecked = client.isChecked(pixelDetails.pixel);
            if (
                pixelDetails.toggle === 1 && !isChecked ||
                pixelDetails.toggle === 0 && isChecked
            ) {
                try {
                    await client.toggle(pixelDetails.pixel);
                }  
                catch (err) {
                    console.error(`We hit an error so aborted.\nError:\n${err}`);
                    process.exit();
                }
            }
            resolve("finished");
        })

    }

    async function drawImage( binaryPixels ) {

        return new Promise( async (resolve, reject) => {
            for (let index = 0; index < binaryPixels.length; index++) {

                let pixelDetails = binaryPixels[index];
        
                let isChecked = client.isChecked(pixelDetails.pixel);
                if (
                    pixelDetails.toggle === 1 && !isChecked ||
                    pixelDetails.toggle === 0 && isChecked
                ) {               
                    try {
                        await client.toggle(pixelDetails.pixel);
                    }  
                    catch (err) {
                        console.error(`We hit an error so aborted.\nError:\n${err}`);
                        process.exit();
                    }
                }

            }
            resolve("finished");
        })

    }

    if (!drawImageFromBinaryPixels) {
        console.log("Finished process. Did not draw image.")
        process.exit()
    }

    console.log("Drawing image.");

    // await drawImage();

    // console.log("This will continue to draw. You want to keep this open until your network tab shows 0.0mbps")
    console.log("Done drawing everything!");
    process.exit();
}

main();