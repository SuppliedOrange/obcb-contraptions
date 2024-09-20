import 'dotenv/config';
import * as fs from 'fs';
import Piscina from 'piscina';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import * as shelljs from 'shelljs';
import { toLower, endsWith, range } from 'lodash';
import {loadImage, createCanvas, Image, Canvas, CanvasRenderingContext2D} from 'canvas';
import extractFrames from "gif-extract-frames";
import sharp from 'sharp';

//local
import { BitmapClient } from '../../client';

const game = "./games/Tetris copy.nes";
const startIndex = 265024;
// 5 =1048576
// 2 = 262144
const page = 2;
const use_id: string | null = "tetris-auto-save";
const gameHorizontal = false;

import { InputState } from './util';
import { CoreType, emulate } from './emulate';
import { setGameInfo, isGameId, getGameInfo, GameInfo, InputAssist, InputAssistSpeed, DirectionPress } from './gameInfo';
import { MAX_WORKERS } from './config';

const NES = ['nes'];
const SNES = ['sfc', 'smc'];
const GB = ['gb', 'gbc'];
const GBA = ['gba'];
const COMPRESSED = ['zip', 'tar.gz', 'tar.bz2', 'tar.xz', 'bz2'];

const ALL = [...NES, ...SNES, ...GB, ...GBA, ...COMPRESSED];

const pool = new Piscina({
    filename: path.resolve(__dirname, path.resolve(__dirname, 'worker.ts')),
    name: 'default',
    execArgv: ['-r', 'ts-node/register'],
    ...MAX_WORKERS == -1     
        ? {}
        : { maxThreads: MAX_WORKERS }
});


async function setup() {
    
    interface EmulationData {
        pool: Piscina;
        coreType:CoreType;
        gameBuffer: Buffer;
        state: Buffer;
        info: GameInfo;
        input: InputState[];
        activatedButton?: ButtonStateData
    }

    interface ButtonStateData {

        name: string,
        activeImage: Image,
        alternateImage: Image,
        isActivated: Boolean,
        hitboxColumn: number,
        hitboxRow: number,
        hitboxWidth: number,
        hitboxHeight: number
    
    }
    
    class ButtonState {
    
        private triangle: Image;
        private circle: Image;
        private rectangle: Image;
        private triangleAlternate: Image;
        private circleAlternate: Image;
        private rectangleAlternate: Image;
        public up: ButtonStateData
        public down: ButtonStateData
        public right: ButtonStateData
        public left: ButtonStateData
        public a: ButtonStateData
        public b: ButtonStateData
        public start: ButtonStateData
        public select: ButtonStateData
        
        constructor() {}
    
        async loadAllImages() {
            
            this.triangle = await loadImage("../images/triangle-0.png");
            this.circle = await loadImage("../images/circle-0.png");
            this.rectangle = await loadImage("../images/rectangle-0.png");
        
            this.triangleAlternate = await loadImage("../images/triangle-1.png");
            this.circleAlternate = await loadImage("../images/circle-1.png");
            this.rectangleAlternate = await loadImage("../images/rectangle-1.png");
    
        }

        async loadButtons() {
                this.up = {
                    name: 'up',
                    isActivated: false,
                    activeImage: this.triangle,
                    alternateImage: this.triangleAlternate,
                    hitboxColumn:(!gameHorizontal) ? 11 : 3,
                    hitboxRow: (!gameHorizontal) ? 99 : 15,
                    hitboxHeight: (!gameHorizontal) ? 5 : 8,
                    hitboxWidth: (!gameHorizontal) ? 10 : 7
                };
            
                this.down = {
                    name: 'down',
                    isActivated: false,
                    activeImage: this.triangle,
                    alternateImage: this.triangleAlternate,
                    hitboxColumn: (!gameHorizontal) ? 8 : 19,
                    hitboxRow: (!gameHorizontal) ? 114 : 15,
                    hitboxHeight: (!gameHorizontal) ? 5 : 8,
                    hitboxWidth: (!gameHorizontal) ? 10 : 7
                };
            
                this.right = {
                    name: 'right',
                    isActivated: false,
                    activeImage: this.triangle,
                    alternateImage: this.triangleAlternate,
                    hitboxColumn: (!gameHorizontal) ? 20 : 12,
                    hitboxRow: (!gameHorizontal) ? 106 : 2,
                    hitboxHeight: (!gameHorizontal) ? 7 : 10,
                    hitboxWidth: (!gameHorizontal) ? 5 : 5
                };
            
                this.left = {
                    name: 'left',
                    isActivated: false,
                    activeImage: this.triangle,
                    alternateImage: this.triangleAlternate,
                    hitboxColumn: (!gameHorizontal) ? 4 : 12,
                    hitboxRow: (!gameHorizontal) ? 106 : 18,
                    hitboxHeight: (!gameHorizontal) ? 7 : 10,
                    hitboxWidth: (!gameHorizontal) ? 5 : 5
                };
            
                this.a = {
                    name: 'a',
                    isActivated: false,
                    activeImage: this.circle,
                    alternateImage: this.circleAlternate,
                    hitboxColumn: (!gameHorizontal) ? 42 : 47,
                    hitboxRow: (!gameHorizontal) ? 111 : 19,
                    hitboxHeight: (!gameHorizontal) ? 9 : 9,
                    hitboxWidth: (!gameHorizontal) ? 9 : 9
                };
            
                this.b = {
                    name: 'b',
                    isActivated: false,
                    activeImage: this.circle,
                    alternateImage: this.circleAlternate,
                    hitboxColumn: (!gameHorizontal) ? 48 : 42,
                    hitboxRow: (!gameHorizontal) ? 97 : 5,
                    hitboxHeight: (!gameHorizontal) ? 9 : 9,
                    hitboxWidth: (!gameHorizontal) ? 9 : 9
                };
            
                this.start = {
                    name: 'start',
                    isActivated: false,
                    activeImage: this.rectangle,
                    alternateImage: this.rectangleAlternate,
                    hitboxColumn: (!gameHorizontal) ? 21 : 30,
                    hitboxRow: (!gameHorizontal) ? 94 : 4,
                    hitboxHeight: (!gameHorizontal) ? 3 : 5,
                    hitboxWidth: (!gameHorizontal) ? 5 : 3
                };
            
                this.select = {
                    name: 'select',
                    isActivated: false,
                    activeImage: this.rectangle,
                    alternateImage: this.rectangleAlternate,
                    hitboxColumn: (!gameHorizontal) ? 33 : 30,
                    hitboxRow: (!gameHorizontal) ? 94 : 24,
                    hitboxHeight: (!gameHorizontal) ? 3 : 5,
                    hitboxWidth: (!gameHorizontal) ? 5 : 3
                };
            
        }

        get buttons() {
            return [
                this.a,
                this.b,
                this.select,
                this.start,
                this.up,
                this.down,
                this.right,
                this.left
            ]
        }   

        public getImage( item: ButtonStateData ) {
    
            if (!item.isActivated) return item.activeImage;
            else return item.alternateImage;
    
        }

    }
    
    let firstRunAfterRedraw = false;

    let buttonState = new ButtonState;
    await buttonState.loadAllImages();
    await buttonState.loadButtons();

    let client = new BitmapClient();
    await navigateAndWait(client, page);

    let coreType: CoreType;

    coreType = detectCore(game);

    const id = use_id || uuid().slice(0, 5);

    console.log("Writing to ID", id)

    const data = path.resolve('data', id);
    shelljs.mkdir('-p', data);

    const gameFile = game;
    let gameBuffer = fs.readFileSync(game);
    fs.writeFileSync(gameFile, gameBuffer, {flag: "w+"});

    const info: GameInfo = {
        game,
        coreType,
        inputAssist: InputAssist.Autoplay,
        inputAssistSpeed: InputAssistSpeed.Fast,
        directionPress: DirectionPress.Release,
        multipliers: [3, 5, 10]
    };

    setGameInfo(id, info);

    let isProcessing = false;
    let currentBinaryPixels: (1 | 0)[] = []

    async function triggerUpdate(emulationData?: EmulationData) {

        await navigateAndWait(client, page);

        if (isProcessing) return;
        isProcessing = true;

        const { recording, recordingName, state } = await emulate(
            emulationData?.pool || pool,
            emulationData?.coreType || coreType,
            emulationData?.gameBuffer || gameBuffer,
            emulationData?.state || null,
            emulationData?.info || info,
            emulationData?.input || []

        );
        const stateFile = path.join(data, 'state.sav');

        console.log('Got output');

        fs.writeFileSync(stateFile, state, {flag: "w+"});
        fs.writeFileSync("output-tetris-auto.gif", recording, {flag: "w+"});
        await loadGif(emulationData?.activatedButton);

        await new Promise(r => setImmediate(r));

        isProcessing = false;

    }

    function isPixelInHitbox(
        pixelIndex: number, hitboxRow: number, hitboxCol: number, hitboxWidth: number, hitboxHeight: number
    ) {
        const displayWidth = 60;

        // console.log('pixel', pixelIndex);
    
        // Calculate the starting pixel index for the hitbox based on the provided startIndex
        const hitboxStartIndex = (hitboxRow - 1) * displayWidth + (hitboxCol - 1) + startIndex;
        const hitboxEndIndex = hitboxStartIndex + (hitboxWidth - 1) + (hitboxHeight - 1) * displayWidth;
    
        // console.log('start ', hitboxStartIndex);
        // console.log('end ', hitboxEndIndex);
    
        // Check if the pixelIndex falls within the hitbox range
        const isInHorizontalRange = ((pixelIndex - hitboxStartIndex) % displayWidth) < hitboxWidth;
        // console.log( 'horizontal range', isInHorizontalRange )
        const isInVerticalRange = pixelIndex >= hitboxStartIndex && pixelIndex <= hitboxEndIndex;
        // console.log( 'vertical range', isInVerticalRange )
    
        return isInHorizontalRange && isInVerticalRange;
    }
    

    // Function to convert image to black and white and map it to a binary array
    async function convertToBlackAndWhite(imagePath: string | Buffer, targetWidth: number, startIndex=0, threshold = 128) {
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

    async function navigateAndWait(client: BitmapClient, page: number, retries: number = 15000) {

        // Wait for the websocket to open
        let currentRetry = 0;
        if (!client.websocketOpen) {
            while (true) {
                if (currentRetry >= retries) break;
                if (client.websocketOpen) break;
                currentRetry += 10;
                await new Promise(r => setTimeout(r, 10));
            }
        }

        // Wait for the chunk index to change
        client.setChunkIndex(page - 1);
        currentRetry = 0;

        if (!client.chunkLoaded) {
            while (true) {
                if (currentRetry >= retries) break;
                if (client.chunkLoaded) break;
                await new Promise(r => setImmediate(r));
            }
        }

    }

    async function renderButtons( gameScreenPath: string, messagePath: string ) {
        // Game screen is 480 x 320
        // You want a 480 x 571 image
        // Nevermind, bumped up to 480 x 750 because of the message

        // Create a canvas
        let canvas: Canvas;
        let ctx: CanvasRenderingContext2D;

        let gameScreen = await loadImage(gameScreenPath);
        let message = await loadImage(messagePath);

        if (gameHorizontal) {

            canvas = createCanvas(480, 1090);
            ctx = canvas.getContext('2d');
            ctx.fillStyle = '#000000' // black
            ctx.fillRect(0, 0, canvas.width, canvas.height); // Fill the entire canvas with black

            // Rotate the canvas for portrait mode
            ctx.save();
            ctx.translate(0, 950);
            ctx.rotate(-Math.PI / 2);

            // Draw the game screen (now in portrait mode)
            ctx.drawImage(gameScreen, 0, 0, 700, 480);

            // Restore the canvas state for normal drawing
            ctx.restore();

            ctx.drawImage(message, 0, 950, 480, 140);

            // left triangle
            let upTriangle = buttonState.getImage(buttonState.up);
            ctx.save();
            ctx.translate(45, 130);
            ctx.rotate(-Math.PI / 2); // Rotate -90 degrees to face left
            ctx.drawImage(upTriangle, -upTriangle.width / 2, -upTriangle.height / 2);
            ctx.restore();

            // right triangle
            let downTriangle = buttonState.getImage(buttonState.down);
            ctx.save();
            ctx.translate(165, 130);
            ctx.rotate(Math.PI / 2); // Rotate 90 degrees to face right
            ctx.drawImage(downTriangle, -downTriangle.width / 2, -downTriangle.height / 2);
            ctx.restore();

            // up triangle
            let rightTriangle = buttonState.getImage(buttonState.right);
            ctx.save();
            ctx.translate(105, 70);
            ctx.rotate(0); // No rotation, facing up
            ctx.drawImage(rightTriangle, -rightTriangle.width / 2, -rightTriangle.height / 2);
            ctx.restore();

            // down triangle
            let leftTriangle = buttonState.getImage(buttonState.left);
            ctx.save();
            ctx.translate(105, 190);
            ctx.rotate(Math.PI); // Rotate 180 degrees to face down
            ctx.drawImage(leftTriangle, -leftTriangle.width / 2, -leftTriangle.height / 2);
            ctx.restore();

            // b circle (rotate counterclockwise)
            let bCircle = buttonState.getImage(buttonState.b);
            ctx.drawImage(bCircle, 310, 30, bCircle.width, bCircle.height);

            // a circle (rotate counterclockwise)
            let aCircle = buttonState.getImage(buttonState.a);
            ctx.drawImage(aCircle, 360, 140, aCircle.width, aCircle.height);

            // Start button (rotate counterclockwise)
            let startButton = buttonState.getImage(buttonState.start);
            ctx.save();
            ctx.translate(130, 180);
            ctx.rotate(-Math.PI / 2); // Rotate -90 degrees counterclockwise
            ctx.drawImage(startButton, startButton.width - 20, startButton.height - 20);
            ctx.restore();

            // Select button (rotate counterclockwise)
            let selectButton = buttonState.getImage(buttonState.select);
            ctx.save();
            ctx.translate(130, 310);
            ctx.rotate(-Math.PI / 2); // Rotate -90 degrees counterclockwise
            ctx.drawImage(selectButton, selectButton.width - 20, selectButton.height - 20);
            ctx.restore();

        }

        else {

            canvas = createCanvas(480, 700);
            ctx = canvas.getContext('2d');
            // Define cropping and positioning
            const sourceX = 0; // Start x on the source image
            const sourceY = 0; // Start y on the source image
            const sourceWidth = 480; // Width of the cropped area on the source image
            const sourceHeight = 405; // Height of the cropped area on the source image (less than original height)

            // Draw the cropped and adjusted game screen onto the canvas
            ctx.drawImage(
                gameScreen,    // Image to draw
                sourceX,       // x coordinate on the source image
                sourceY,       // y coordinate on the source image
                sourceWidth,   // width of the area to crop from the source image
                sourceHeight,  // height of the area to crop from the source image
                -450,           // x coordinate on the canvas
                -125,           // y coordinate on the canvas
                1295,           // width to draw on the canvas (scaled)
                800           // height to draw on the canvas (scaled)
            );
        }

        if (gameHorizontal) sharp(canvas.toBuffer()).rotate(90).toFile('rendered-tetris-auto.png');
        else fs.writeFile('rendered-tetris-auto.png', canvas.toBuffer(), (err) => {}, );
        
        return canvas.toBuffer();


    }

    async function loadGif(activatedButton?: ButtonStateData) {

        console.log("Start rendering...");

        let outputFolder = "./exported_frames-tetris-auto"
        let messagePath = "../images/wait_screen.jpg"

        const results = await extractFrames({
            input: 'output-tetris-auto.gif',
            output: `${outputFolder}/%d.png`
        })
        if (!results) return;

        let framesRendered = results.shape[0];

        if (activatedButton && !activatedButton.isActivated) activatedButton.isActivated = true;

        for (let index = 0; index < framesRendered; index++ ) {

            let framePath =  `${outputFolder}/${index}.png`;
            let finalFramePath = 'final-frame-tetris-auto.png';

            // Render game screen with buttons
            let buttonOverlayImage = await renderButtons(framePath, messagePath);
            let { binaryPixels } = await convertToBlackAndWhite( buttonOverlayImage, 60, startIndex, 80 );

            if (index === (framesRendered -1)) { // on last frame

                fs.copyFile(framePath, finalFramePath, (err) => {
                    if (err) throw err;
                    console.log(`Final Frame: ${finalFramePath}`);
                  });

            }

            if (activatedButton) activatedButton.isActivated = false;
            messagePath = "../images/ok_screen.jpg";

            // Draw the iamge
            // await navigateAndWait(client,page)
            await drawImage( binaryPixels )
            currentBinaryPixels = binaryPixels;
            await new Promise(r => setTimeout(r, 50));

            firstRunAfterRedraw = true;

        }

        console.log('Finished rendering: ', results.shape[0])

    }

    const parseInput = (input: string) => {
        switch (toLower(input)) {
            case 'a':
                return { A: true };
            case 'b':
                return { B: true };
            case 'x':
                return { X: true };
            case 'y':
                return { Y: true };
            case 'l':
                return { L: true };
            case 'r':
                return { R: true };
            case 'up':
                return { UP: true };
            case 'down':
                return { DOWN: true };
            case 'left':
                return { LEFT: true };
            case 'right':
                return { RIGHT: true };
            case 'select':
                return { SELECT: true };
            case 'start':
                return { START: true };
        }
    };

    async function click() {
        
        let playerInputs: InputState[] = [];

        let multiplier = 10;
        playerInputs = range(0, multiplier).map(() => { return { A: true } });

        if (playerInputs.length > 0) {

            let game = fs.readFileSync(path.resolve(info.game))
            let oldState = fs.readFileSync(path.resolve('data', id, 'state.sav'));
            await triggerUpdate({
                pool: pool,
                coreType: info.coreType,
                gameBuffer: game,
                state: oldState,
                info: info,
                input: playerInputs,
            }) 
        }

    }

    async function drawImage( binaryPixels: (1 | 0)[], checkAgainstCurrntPixels: boolean = false ): Promise<number[]> {
        
        return new Promise( async (resolve, reject) => {

            let changedPixels: number[] =[];
            await navigateAndWait(client, page)
            
            for (let index = 0; index < binaryPixels.length; index++) {

                let pixel = binaryPixels[index];
                let pixelIndex = startIndex + index;
                
                let isChecked = (checkAgainstCurrntPixels && currentBinaryPixels.length !== 0) ? currentBinaryPixels[index] === 1 : client.isChecked(pixelIndex);
                if ( pixel === 1 && !isChecked ||
                    pixel === 0 && isChecked
                ) {
                    changedPixels.push(pixelIndex);
                    client.toggle(pixelIndex)
                }
            }
            resolve(changedPixels)
        })

    }
    
    await triggerUpdate();

    while (true) {

        try {
            // @ts-ignore
            await new Promise(r => setTimeout(r, 100));
            // continue not return!
            if (isProcessing) continue;
            click();
        }
        catch (error) {
            console.log(error);
        }

    }

}


const detectCore = (filename: string): CoreType => {
    if (NES.find(ext => endsWith(toLower(filename), ext)))
        return CoreType.NES;

    if (SNES.find(ext => endsWith(toLower(filename), ext)))
        return CoreType.SNES;

    if (GB.find(ext => endsWith(toLower(filename), ext)))
        return CoreType.GB;

    if (GBA.find(ext => endsWith(toLower(filename), ext)))
        return CoreType.GBA;
}

setup().catch(err => {
    console.error(err);
    process.exit(1);
});
