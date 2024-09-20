import sharp from "sharp";
import fs from 'fs';

const increaseHeight = true;

async function main() {

    const image = sharp('./renders/render_dither_grayscale.png');
    const metadata = await image.metadata();

    if (!metadata || !metadata.height || !metadata.width) {
        throw new Error("Could not get metadata");
    }

    let targetHeightMultiplier = 7;
    let targetWidth = 5000;
    let targetHeight = Math.floor(metadata.height * (targetWidth / metadata.width));

    if (increaseHeight) targetHeight = targetHeight * targetHeightMultiplier;

    const resizedImage = await image.resize(targetWidth, targetHeight, {fit: "fill"}).png().toBuffer();

    fs.writeFileSync("./renders/itlookslikethis.png", resizedImage);
}

main()