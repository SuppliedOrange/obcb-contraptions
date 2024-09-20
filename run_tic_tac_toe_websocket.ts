import fs from 'fs';
import {loadImage, createCanvas} from 'canvas';
import { BitmapClient } from './client';

const startIndex = 786432;
const page = 4;
let gameData: string[][] = [
    ['', '', ''], ['', '', ''], ['', '', '']
];
let gameRunning: Boolean = false;
let turn = "X";

async function main() {

    let frame = await loadImage("./images/tictactoe_frame.jpg");
    let cross = await loadImage("./images/cross.jpg");
    let o = await loadImage("./images/o.jpg");

    async function generateBoard(board: string[][]) {

        const frameSize = 60;
        const symbolSize = 17;
        const canvas = createCanvas(frameSize, frameSize);
        const ctx = canvas.getContext('2d');
    
        // Load the images
        const frameImg = frame;
        const crossImg = cross;
        const oImg = o;
    
        // Draw the frame first
        ctx.drawImage(frameImg, 0, 0, frameSize, frameSize);
    
        // Calculate the top-left corner of each cell
        const positions = [
            [0, 0], [22, 0], [43, 0],
            [1, 14], [22, 14], [43, 14],
            [1, 30], [22, 30], [43, 30]
        ];
    
        // Overlay the symbols on the board
        for (let i = 0; i < 9; i++) {
            const symbol = board[Math.floor(i / 3)][i % 3];
            if (symbol === 'X') {
                ctx.drawImage(crossImg, positions[i][0], positions[i][1], symbolSize, symbolSize - 4);
            } else if (symbol === 'O') {
                ctx.drawImage(oImg, positions[i][0], positions[i][1], symbolSize, symbolSize - 4);
            }
        }

        const buffer: Buffer = canvas.toBuffer('image/png');
        return buffer;

    }

    // Function to convert image to black and white and map it to a binary array
    async function convertToBlackAndWhite(imagePath: string | Buffer, targetWidth: number, startIndex=0, threshold = 128) {

        const image = await loadImage(imagePath);
        const targetHeight = 80;

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

    function checkGameState(board: string[][]): string | undefined {
        const size = board.length;
    
        // Check rows and columns for a win
        for (let i = 0; i < size; i++) {
            if (board[i][0] && board[i].every(cell => cell === board[i][0])) {
                return `WIN ${board[i][0]}`; // Row win
            }
            if (board[0][i] && board.every(row => row[i] === board[0][i])) {
                return `WIN ${board[0][i]}`; // Column win
            }
        }
    
        // Check diagonals for a win
        if (board[0][0] && board.every((row, idx) => row[idx] === board[0][0])) {
            return `WIN ${board[0][0]}`; // Top-left to bottom-right diagonal win
        }
        if (board[0][size - 1] && board.every((row, idx) => row[size - 1 - idx] === board[0][size - 1])) {
            return `WIN ${board[0][size - 1]}`; // Top-right to bottom-left diagonal win
        }
    
        // Check for a draw
        if (board.flat().every(cell => cell)) {
            return "DRAW";
        }
    
        // If no win and not a draw, the game is still ongoing
        return undefined;
    }

    async function celebrationScreen( fileName: string ) {

        let { binaryPixels } = await convertToBlackAndWhite( fileName, 60, startIndex, 140 );

        return new Promise( async (resolve, reject) => {
            for (let index = 0; index < binaryPixels.length; index++) {

                let pixel = binaryPixels[index];
                let pixelIndex = startIndex + index;
        
                let isChecked = client.isChecked(pixelIndex);

                if ( pixel === 1 && !isChecked ) {
                    
                    client.toggle(pixelIndex)
                }

                else if ( pixel === 0 && isChecked ) {     
                    validateClick(pixelIndex);          
                    client.toggle(pixelIndex);
                }

            }
            await new Promise(r => setTimeout(r, 4000));
            resolve("finished")
        })

    }

    async function handleWinners() {

        let result = checkGameState( gameData );
        if (!result) return;

        let msgs = result.split(" ");

        if (msgs[0] === 'DRAW') {
            console.log("Game is a draw!")
            await celebrationScreen("./images/tictactoe_draw_screen.jpg")
            await resetGame();
        }
        if (msgs[0] === 'WIN') {
            console.log(`${msgs[1]} wins!`);
            await celebrationScreen(`./images/tictactoe_${msgs[1]}_win_screen.jpg`)
            await resetGame()
        }
    }

    async function resetGame() {
        gameRunning = false;
        gameData = [
            ['', '', ''], ['', '', ''], ['', '', '']
        ];
        await navigateAndWait(client, page);
        await drawImage()
        await new Promise(r => setImmediate(r));;
        gameRunning = true;
    }

    function validateClick(index: number) {

        index = index - startIndex;

        if (!gameRunning) return;

        let height = 60;
        let width = 60;

        let column = Math.floor( index / (height * (height / 3)) );
        let row = Math.floor(( index % height ) / (height / 3));

        if (
            column >= 3 || row >= 3 || column <= -1 || row <= -1
        ) return;

        if (gameData[column][row] !== '') return;
        
        gameData[column][row] = turn;
        
        turn = ( turn === "X" ) ? "O" : "X"

    }

    let client = new BitmapClient();
    await resetGame();

    let combatMode = false;

    async function drawImage() {

        let board = await generateBoard( gameData );
        let { binaryPixels } = await convertToBlackAndWhite( board, 60, startIndex, 140 );

        return new Promise( (resolve, reject) => {
            for (let index = 0; index < binaryPixels.length; index++) {

                let pixel = binaryPixels[index];
                let pixelIndex = startIndex + index;
        
                let isChecked = client.isChecked(pixelIndex);

                if ( pixel === 1 && !isChecked ) {
                    
                    try { client.toggle(pixelIndex); }
                    catch (err) { console.log(err); }
                }

                else if ( pixel === 0 && isChecked ) {     
                    validateClick(pixelIndex);          
                    try { client.toggle(pixelIndex); }
                    catch (err) { console.log(err); }
                }

            }
            resolve("finished")
        })

    }

    while (true) {

        try {
            if (!combatMode) await new Promise(r => setTimeout(r, 800));
            await handleWinners();
            await navigateAndWait(client, page);
            await drawImage()
            await new Promise(r => setImmediate(r));;
        }
        catch (error) {
            console.log(error);
        }
    }

}

main();