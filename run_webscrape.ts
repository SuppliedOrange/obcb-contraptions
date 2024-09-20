import fs from 'fs';
import {loadImage, createCanvas} from 'canvas';
import {chromium} from 'playwright';



async function main() {

    // Function to convert image to black and white and map it to a binary array
    async function convertToBlackAndWhite(imagePath: string, targetWidth: number, startIndex=0, threshold = 128) {
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
                binaryPixels[gridRow * gridWidth + gridCol] = grayscale < threshold ? 1 : 0; // Apply threshold
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
        /*
        {
            name: './image5.jpg',
            threshold: 200
        },
        */
        {
            name: './image4.jpg',
            threshold: 200
        },

        {
            name: './image3.jpg',
            threshold: 160
        },
    
        {
            name: './image2.jpg',
            threshold: 128
        },
        {
            name: './image8.jpg',
            threshold: 200
        },
        /**
        {
            name: './image9.jpg',
            threshold: 180
        },
        {
            name: './image7.jpg',
            threshold: 200
        },
        */
        {
            name: './image10.jpg',
            threshold: 200
        },
        {
            name: './image11.jpg',
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

    let startIndex = 1440;

    for ( let index = 0; index < images.length; index++) {
        let image = images[index];
        convertToBlackAndWhite(image.name, 60, 0, image.threshold ).then(({ binaryPixels, width, height, }) => {
            createBlackAndWhiteImage(binaryPixels, width, height, `./render_${index}.jpeg`);
        });
        let { binaryPixels, width, height } = await convertToBlackAndWhite( image.name, 60, startIndex, image.threshold );
        binaryPixelList.push(binaryPixels)
    }

    console.log(`Start: ${startIndex}\n End: ${binaryPixelList[0].length + startIndex}`);

    let browser = await chromium.launch(
        //{headless: false}
    );
    let context = await browser.newContext();
    let page = await context.newPage();

    // Set the viewport size a better view.
    // You're prolly better off using ctrl + scroll to resize the page anyway.
    /**
    page.setViewportSize({
        width: 1000,
        height: 2000
    });
    */


    await page.goto('https://bitmap.alula.me/', {waitUntil: "networkidle"});

    await page.evaluate( async (startIndex) => {
        await new Promise(r => setTimeout(r, 3000));
        // @ts-ignore
        app.$V.children.client.goToCheckboxCallback(startIndex);
        await new Promise(r => setTimeout(r, 3000));
    }, startIndex);

    let currentBinaryPixel = 0;

    while (true) {

        await new Promise(r => setTimeout(r, 5000));

        currentBinaryPixel = currentBinaryPixel + 1;
        if (currentBinaryPixel == binaryPixelList.length) currentBinaryPixel = 0;

        let chosenBinaryPixel = binaryPixelList[currentBinaryPixel];

        await page.evaluate( async data => {
    
            try {

                data.chosenBinaryPixel.forEach(async (pixel: number, index: number) => {

                    index += data.startIndex;

                    // @ts-ignore
                    let isChecked = app.$V.children.client.isChecked(index);

                    if (
                        pixel === 1 && !isChecked ||
                        pixel === 0 && isChecked
                    ) {               
                        // @ts-ignore
                        app.$V.children.client.toggle(index)
                    }

                });
            }
            catch (error) {
                console.log(error);
                process.exit(1)
            }
    
    
        }, {chosenBinaryPixel, startIndex} )
    }

    await context.close();
    await browser.close();

}

main();