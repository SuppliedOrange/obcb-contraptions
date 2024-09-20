import fs from 'fs';
import {loadImage, createCanvas} from 'canvas';
import { BitmapClient } from './client';

const startIndex = 1440;
const page = 1;
const shuffleEnabled = false;

async function main() {

    // Function to convert image to black and white and map it to a binary array
    async function convertToBlackAndWhite(imagePath: string, targetWidth: number, startIndex=0, threshold = 128, invert = false) {
        const image = await loadImage(imagePath);
        const targetHeight = Math.floor(image.height * (targetWidth / image.width));

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

    let images = [
        {
            name: [
                //'./images/image34.jpg',
                //'./images/image35.jpg',
                //'./images/image31.jpg',
                //'./images/image32.jpg',
                //'./images/image29.jpg',
                './images/image26.jpg'
                /*
                './images/image36.jpg',
                './images/image37.jpg',
                './images/image38.jpg',
                './images/image39.jpg',
                './images/image40.jpg',
                './images/image41.jpg',
                './images/image42.jpg',
                './images/image43.jpg',
                './images/image44.jpg',
                './images/image45.jpg',
                './images/image46.jpg',
                './images/image47.jpg',
                './images/image48.jpg',
                */
            ],
            
            threshold: 170,
            // invert: "random"
        },
        {
            name: './images/image20.jpg',
            threshold: 200,
            invert: true
        },
        {
            name: './images/image15.jpg',
            threshold: 128
        },
        {
            name: './images/image12.jpg',
            threshold: 120,
            invert: true
        },
        {
            name: './images/image4.jpg',
            threshold: 200
        },

        {
            name: './images/image3.jpg',
            threshold: 160,
            invert: true
        },
    
        {
            name: './images/image2.jpg',
            threshold: 128,
            invert: true
        },
        {
            name: './images/image10.jpg',
            threshold: 200
        },
        {
            name: './images/image11.jpg',
            threshold: 180
        },

    ];
    /**
     * 
        {
            name: './image.jpg',
            threshold: 128
        }
     */

    let binaryPixelList: Array<any> = [];

    function shuffleArray(array) {

        let currentIndex = array.length;
      
        // While there remain elements to shuffle...
        while (currentIndex != 0) {
      
          // Pick a remaining element...
          let randomIndex = Math.floor(Math.random() * currentIndex);
          currentIndex--;
      
          // And swap it with the current element.
          [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
        }

      }

    async function shuffle() {
        for ( let index = 0; index < images.length; index++) {

            if (shuffleEnabled) shuffleArray(images);

            let image = structuredClone(images[index]);
    
            if (image.name instanceof Array) image.name = image.name[Math.floor(Math.random()*image.name.length)];
            // @ts-expect-error
            if (image.invert instanceof String ) image.invert = (() => Math.random() < 0.5)();
    
            convertToBlackAndWhite(image.name, 60, 0, image.threshold ).then(({ binaryPixels, width, height, }) => {
                createBlackAndWhiteImage(binaryPixels, width, height, `./renders/render_${index}.jpeg`);
            });
            let { binaryPixels } = await convertToBlackAndWhite( image.name, 60, startIndex, image.threshold, image.invert );
            binaryPixelList.push(binaryPixels)
        }
    }

    await shuffle();

    console.log(`Start: ${startIndex}\n End: ${binaryPixelList[0].length + startIndex}`);

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

    function getRandomInt(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1) + min);   
      
    }

    let client = new BitmapClient();
    await navigateAndWait(client, page);

    let currentBinaryPixel = 0;
    let imageHasChanged = true;
    let combatMode = true;

    setInterval( async () => {
        if (shuffleEnabled) await shuffle();
    }, 60000);

    setInterval( () => {
        currentBinaryPixel = (currentBinaryPixel + 1) % binaryPixelList.length;
        imageHasChanged = true;
    },
    // getRandomInt(4000, 6000)
    5000
    );

    async function drawImage() {

        let chosenBinaryPixel = binaryPixelList[currentBinaryPixel]
        await navigateAndWait(client, page);

        let image = structuredClone(images[currentBinaryPixel]);

        let isChanged = true;

        if (image.name instanceof Array) {
            image.name = image.name[Math.floor(Math.random()*image.name.length)];
            isChanged = true;
        }
        if (typeof image.invert === 'string') {
            // @ts-expect-error
            image.invert = (() => Math.random() < 0.5)();
            isChanged = true;
        }

        if (isChanged) {
            let { binaryPixels } = await convertToBlackAndWhite( image.name, 60, startIndex, image.threshold, image.invert );
            chosenBinaryPixel = binaryPixels;
        }

        return new Promise( (resolve, reject) => {
            for (let index = 0; index < chosenBinaryPixel.length; index++) {

                let pixel = chosenBinaryPixel[index];
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
            if (combatMode) {
                await drawImage()
            }
            else if (imageHasChanged) {
                await drawImage()
                imageHasChanged = false;
            }
            else {
                await new Promise(r => setTimeout(r, 100));
            }
            await new Promise(r => setImmediate(r));;
        }
        catch (error) {
            console.log(error);
            process.exit(1)
        }
    }

}

main();