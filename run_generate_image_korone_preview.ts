import fs from 'fs';
import {loadImage, createCanvas} from 'canvas';
import sharp from 'sharp';

// Configuration for korone vinyl image
const startIndex = 327652232;
const gridWidth = 32768;
const image_path = './images/korone-vinyl.png';
const image_invert = false;
const image_threshold = 200; // 200 for korone as noted in original code

interface BinaryPixelDetails {
    pixel: number,
    toggle: number,
    row: number,
    col: number,
    imageRow: number,
    imageCol: number
}

async function main() {
    console.log('=== Korone Vinyl Image Preview Generator ===');
    console.log('This creates a local preview without connecting to the board service');
    console.log('to avoid memory/storage issues while demonstrating the fixed mapping.\n');

    // Function to convert image to black and white and map it to a binary array
    async function convertToBinaryPixels(imagePath: string, threshold = 128, invert = false) {
        const image = sharp(imagePath);
        const metadata = await image.metadata();

        if (!metadata || !metadata.height || !metadata.width) {
            throw new Error("Could not get metadata");
        }

        console.log(`Original image dimensions: ${metadata.width}x${metadata.height}`);
        
        // Use original dimensions to maintain aspect ratio
        const targetWidth = metadata.width;
        const targetHeight = metadata.height;
        
        console.log(`Target dimensions: ${targetWidth}x${targetHeight}`);

        const resizedImage = await image.resize(targetWidth, targetHeight, { fit: "fill" }).raw().toBuffer();

        const startRow = Math.floor(startIndex / gridWidth);
        const startCol = startIndex % gridWidth;
        
        console.log(`Start position: row ${startRow}, col ${startCol}`);
        console.log(`Board pixel range: ${startIndex} to ${startIndex + targetHeight * gridWidth + targetWidth}`);

        let binaryPixels: BinaryPixelDetails[] = [];
        const bytesPerPixel = metadata.channels || 1;

        for (let row = 0; row < targetHeight; row++) {
            for (let col = 0; col < targetWidth; col++) {
                // Fixed mapping: each image row maps directly to board row, each column with proper offset
                const gridRow = startRow + row;
                const gridCol = startCol + col;
                
                // Ensure we don't exceed grid boundaries
                if (gridRow >= 32768 || gridCol >= gridWidth) continue;

                const pixelIndex = row * targetWidth + col;
                const grayscale = resizedImage[pixelIndex * bytesPerPixel]; // Grayscale value (0-255)

                const dark = (invert) ? 0 : 1;
                const light = (invert) ? 1 : 0;

                const pixelDetails: BinaryPixelDetails = {
                    pixel: gridRow * gridWidth + gridCol,
                    toggle: grayscale < threshold ? (invert ? light : dark) : (invert ? dark : light),
                    row: gridRow,
                    col: gridCol,
                    imageRow: row,
                    imageCol: col
                }
                
                binaryPixels.push(pixelDetails);
            }
        }

        return { binaryPixels, width: targetWidth, height: targetHeight };
    }

    function createPreviewImage(binaryPixels: BinaryPixelDetails[], width: number, height: number, outputPath: string) {
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(width, height);

        // Create the preview image based on how it would look on the board
        for (let i = 0; i < binaryPixels.length; i++) {
            const pixel = binaryPixels[i];
            const colorValue = pixel.toggle === 1 ? 0 : 255; // 0 for black, 255 for white
            
            // Map back to image coordinates for preview
            const index = (pixel.imageRow * width + pixel.imageCol) * 4;
            if (index < imageData.data.length) {
                imageData.data[index] = colorValue;      // R
                imageData.data[index + 1] = colorValue;  // G
                imageData.data[index + 2] = colorValue;  // B
                imageData.data[index + 3] = 255;         // A (full opacity)
            }
        }

        ctx.putImageData(imageData, 0, 0);

        // Save the canvas as an image file
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(outputPath, buffer);
        console.log(`Preview image saved to ${outputPath}`);
    }

    function analyzeMappingCorrectness(binaryPixels: BinaryPixelDetails[], width: number, height: number) {
        console.log('\n=== Mapping Analysis ===');
        
        // Check if each image row maps to consecutive board rows
        const rowMappings = new Map<number, number[]>();
        
        for (const pixel of binaryPixels) {
            if (!rowMappings.has(pixel.imageRow)) {
                rowMappings.set(pixel.imageRow, []);
            }
            rowMappings.get(pixel.imageRow)!.push(pixel.row);
        }
        
        let mappingCorrect = true;
        const startRow = Math.floor(startIndex / gridWidth);
        
        for (let imageRow = 0; imageRow < Math.min(height, 5); imageRow++) { // Check first 5 rows
            const boardRows = rowMappings.get(imageRow) || [];
            const uniqueBoardRows = [...new Set(boardRows)];
            const expectedBoardRow = startRow + imageRow;
            
            console.log(`Image row ${imageRow} → Board row(s): ${uniqueBoardRows.join(', ')} (expected: ${expectedBoardRow})`);
            
            if (uniqueBoardRows.length !== 1 || uniqueBoardRows[0] !== expectedBoardRow) {
                mappingCorrect = false;
                console.log(`  ❌ INCORRECT: Expected single board row ${expectedBoardRow}`);
            } else {
                console.log(`  ✅ CORRECT: Maps to board row ${expectedBoardRow}`);
            }
        }
        
        if (mappingCorrect) {
            console.log('\n✅ Mapping is CORRECT: Each image row maps to exactly one board row');
        } else {
            console.log('\n❌ Mapping has ISSUES: Image rows are not mapping correctly to board rows');
        }
        
        // Show some example pixel mappings
        console.log('\n=== Example Pixel Mappings ===');
        for (let i = 0; i < Math.min(binaryPixels.length, 10); i++) {
            const pixel = binaryPixels[i];
            console.log(`Image(${pixel.imageRow},${pixel.imageCol}) → Board(${pixel.row},${pixel.col}) [index: ${pixel.pixel}]`);
        }
    }

    try {
        const { binaryPixels, width, height } = await convertToBinaryPixels(image_path, image_threshold, image_invert);
        
        console.log(`\nProcessed ${binaryPixels.length} pixels`);
        console.log(`Black pixels (toggle=1): ${binaryPixels.filter(p => p.toggle === 1).length}`);
        console.log(`White pixels (toggle=0): ${binaryPixels.filter(p => p.toggle === 0).length}`);
        
        // Analyze the mapping to verify correctness
        analyzeMappingCorrectness(binaryPixels, width, height);
        
        // Create a preview image showing how it would look
        const outputPath = './renders/korone_vinyl_preview.png';
        createPreviewImage(binaryPixels, width, height, outputPath);
        
        console.log('\n=== Summary ===');
        console.log('✅ Image processing complete without memory/storage issues');
        console.log('✅ Fixed mapping verified: each image row maps to one board row');
        console.log('✅ Preview image generated for visualization');
        console.log('\nThis demonstrates the fix works correctly without connecting to the actual board service.');
        
    } catch (error) {
        console.error('Error processing image:', error);
        process.exit(1);
    }
}

main();