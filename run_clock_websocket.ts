import fs from 'fs';
import {loadImage, createCanvas} from 'canvas';
import { BitmapClient } from './client';
import { Jimp, loadFont } from "jimp";
import { SANS_64_BLACK } from "jimp/fonts"
import moment from 'moment-timezone';

const startIndex = 6060;
const page = 1;

async function main() {

    let font = await loadFont(SANS_64_BLACK)
    let clockFileName = "./images/clock4.png";

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
    }

    let timezones = [
        // India
        { name: "india <3", tz: "Asia/Kolkata" },
        // Singapore
        { name: "singapore", tz: "Asia/Singapore" },
        // Japan
        { name: "tokyo", tz: "Asia/Tokyo" },
        // Australia
        { name: "sydney", tz: "Australia/Sydney" },
         // East Coast USA
        { name: "usa-nyc", tz: "America/New_York" },
        // West Coast USA
        { name: "usa-la", tz: "America/Los_Angeles" },
        // GMT 0
        { name: "gmt-0", tz: "Etc/GMT-0" },
        // West Europe
        { name: "berlin", tz: "Europe/Berlin" },
        // Croatia
        { name: "croatia", tz: "CET" },
        // Middle East
        { name: "dubai", tz: "Asia/Dubai" },

    ]

    let displays: { name: string, x: number, y: number, isActive: Boolean }[] = []

    let clockImagePath = "./renders/drawn_clock.png";
    let clockImageThreshold = 128
    
    let currentTimezone = -1;

    function changeTime(timezone?: number) {

        if (timezone !== undefined) currentTimezone = timezone
        else currentTimezone = ( currentTimezone + 1) % timezones.length;

        displays.forEach(x => {x.isActive = false});
        displays.push({
            name: timezones[currentTimezone].name,
            x: 265,
            y: 100,
            isActive: true
        })       

    }

    changeTime();

    function checkMarqueeExceeded( textDisplay: { name: string, x: number, y: number, isActive: Boolean } ) {

        if (textDisplay.x >= 270) {

            const index = displays.indexOf(textDisplay);

            if (index > -1) { // only splice array when item is found
                displays.splice(index, 1);
            } 

        }

    }

    function getTime() {
        return moment().tz(timezones[currentTimezone].tz).format("HH:mm:ss");
    }

    async function drawClock(time: string) {

        let image = await Jimp.read(clockFileName);

        image.print( { text: time, x: 10, y: 20, font: font } )
        //.write("./renders/drawn_clock.png");

        let timeChanged = false;
        
        for (const display of displays) {

            // rightmost: 265?
            // leftmost: -230?
            await image.print( { text: display.name, x: display.x, y: display.y, font: font } )
            .write("./renders/drawn_clock.png");

            if (display.x < -100 && display.isActive) {
                changeTime();
                timeChanged = true;
            }

            checkMarqueeExceeded(display);

        }

        return { needsReset: timeChanged }

    }

    async function renderClock() {

        // Lets you save the rendered image so you can see it on disk.
        /*
        convertToBlackAndWhite(clockImagePath, 60, 0, clockImageThreshold ).then(({ binaryPixels, width, height, }) => {
            createBlackAndWhiteImage(binaryPixels, width, height, `./renders/rendered_clock.png`);
        });
        */
        let { binaryPixels, width, height } = await convertToBlackAndWhite( clockImagePath, 60, startIndex, clockImageThreshold );
        
        return binaryPixels;

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

    let time = "00:00:00";

    let combatMode = false;
    let imageHasChanged = true;
    
    setInterval(() => {

        time = getTime();
        displays.forEach( (display) => {
            display.x = display.x - 10;
        });
        imageHasChanged = true;

    }, 1000);   

    async function drawImage() {

        let result = await drawClock(time);
        if (result.needsReset) await navigateAndWait(client, page);

        let chosenBinaryPixel = await renderClock();

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
            else if ( imageHasChanged ) {
                imageHasChanged = false;
                await drawImage()
                
            }
            else {
                await new Promise(r => setTimeout(r, 100));
            }
            await new Promise(r => setImmediate(r));;
        }
        catch (error) {
            console.log(error);
        }
    }

}

main();