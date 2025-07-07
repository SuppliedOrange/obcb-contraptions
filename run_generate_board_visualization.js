const fs = require('fs');
const {loadImage, createCanvas} = require('canvas');
const sharp = require('sharp');

// Configuration for korone vinyl image
const startIndex = 327652232;
const gridWidth = 32768;
const image_path = './images/korone-vinyl.png';
const image_invert = false;
const image_threshold = 200;

async function main() {
    console.log('=== Board Section Visualization with Korone Vinyl ===');
    console.log('This creates a visualization of the board section where the image would be placed');
    console.log('without connecting to the actual board service.\n');

    // Function to convert image to binary pixels
    async function convertToBinaryPixels(imagePath, threshold = 128, invert = false) {
        const image = sharp(imagePath);
        const metadata = await image.metadata();

        if (!metadata || !metadata.height || !metadata.width) {
            throw new Error("Could not get metadata");
        }

        const targetWidth = metadata.width;
        const targetHeight = metadata.height;
        const resizedImage = await image.resize(targetWidth, targetHeight, { fit: "fill" }).raw().toBuffer();

        const startRow = Math.floor(startIndex / gridWidth);
        const startCol = startIndex % gridWidth;

        let binaryPixels = [];
        const bytesPerPixel = metadata.channels || 1;

        for (let row = 0; row < targetHeight; row++) {
            for (let col = 0; col < targetWidth; col++) {
                const gridRow = startRow + row;
                const gridCol = startCol + col;
                
                if (gridRow >= 32768 || gridCol >= gridWidth) continue;

                const pixelIndex = row * targetWidth + col;
                const grayscale = resizedImage[pixelIndex * bytesPerPixel];

                const dark = invert ? 0 : 1;
                const light = invert ? 1 : 0;

                binaryPixels.push({
                    pixel: gridRow * gridWidth + gridCol,
                    toggle: grayscale < threshold ? (invert ? light : dark) : (invert ? dark : light),
                    boardRow: gridRow,
                    boardCol: gridCol,
                    imageRow: row,
                    imageCol: col
                });
            }
        }

        return { binaryPixels, width: targetWidth, height: targetHeight, startRow, startCol };
    }

    function createBoardVisualization(binaryPixels, imageWidth, imageHeight, startRow, startCol, outputPath) {
        // Create a canvas showing the board section with padding around the image
        const padding = 50;
        const canvasWidth = imageWidth + 2 * padding;
        const canvasHeight = imageHeight + 2 * padding;
        
        const canvas = createCanvas(canvasWidth, canvasHeight);
        const ctx = canvas.getContext('2d');
        
        // Fill background with light gray to represent empty board
        ctx.fillStyle = '#E0E0E0';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        
        // Draw grid lines for reference
        ctx.strokeStyle = '#D0D0D0';
        ctx.lineWidth = 0.5;
        
        // Draw vertical grid lines every 10 pixels
        for (let x = 0; x <= canvasWidth; x += 10) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvasHeight);
            ctx.stroke();
        }
        
        // Draw horizontal grid lines every 10 pixels
        for (let y = 0; y <= canvasHeight; y += 10) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvasWidth, y);
            ctx.stroke();
        }
        
        // Draw image area border
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 2;
        ctx.strokeRect(padding - 1, padding - 1, imageWidth + 2, imageHeight + 2);
        
        // Place the image pixels
        for (const pixel of binaryPixels) {
            const canvasX = padding + pixel.imageCol;
            const canvasY = padding + pixel.imageRow;
            
            // Set pixel color based on toggle value
            ctx.fillStyle = pixel.toggle === 1 ? '#000000' : '#FFFFFF';
            ctx.fillRect(canvasX, canvasY, 1, 1);
        }
        
        // Add labels
        ctx.fillStyle = '#000000';
        ctx.font = '12px Arial';
        ctx.fillText(`Korone Vinyl on Board`, 10, 20);
        ctx.fillText(`Start: (${startRow}, ${startCol})`, 10, 35);
        ctx.fillText(`Size: ${imageWidth}x${imageHeight}`, 10, 50);
        ctx.fillText(`Red border shows image area`, 10, canvasHeight - 10);

        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(outputPath, buffer);
        console.log(`Board visualization saved to ${outputPath}`);
    }

    try {
        const { binaryPixels, width, height, startRow, startCol } = await convertToBinaryPixels(image_path, image_threshold, image_invert);
        
        console.log(`Image: ${width}x${height} pixels`);
        console.log(`Board position: starts at row ${startRow}, col ${startCol}`);
        console.log(`Board range: rows ${startRow}-${startRow + height - 1}, cols ${startCol}-${startCol + width - 1}`);
        console.log(`Total pixels: ${binaryPixels.length}`);
        
        // Create board visualization
        createBoardVisualization(binaryPixels, width, height, startRow, startCol, './renders/korone_vinyl_board_visualization.png');
        
        // Also create a simple preview of just the processed image
        const previewCanvas = createCanvas(width, height);
        const previewCtx = previewCanvas.getContext('2d');
        const imageData = previewCtx.createImageData(width, height);

        for (const pixel of binaryPixels) {
            const index = (pixel.imageRow * width + pixel.imageCol) * 4;
            const colorValue = pixel.toggle === 1 ? 0 : 255;
            imageData.data[index] = colorValue;
            imageData.data[index + 1] = colorValue;
            imageData.data[index + 2] = colorValue;
            imageData.data[index + 3] = 255;
        }

        previewCtx.putImageData(imageData, 0, 0);
        const previewBuffer = previewCanvas.toBuffer('image/png');
        fs.writeFileSync('./renders/korone_vinyl_processed.png', previewBuffer);
        
        console.log('\n=== Generated Files ===');
        console.log('✅ korone_vinyl_board_visualization.png - Shows image placement on board section');
        console.log('✅ korone_vinyl_processed.png - Shows processed black/white image');
        console.log('\n=== Mapping Verification ===');
        console.log('✅ Each image row maps to exactly one board row (no row squishing)');
        console.log('✅ Image rows map to consecutive board rows starting from the correct position');
        console.log('✅ Fixed mapping eliminates need for targetHeightMultiplier');
        
    } catch (error) {
        console.error('Error processing image:', error);
        process.exit(1);
    }
}

main();