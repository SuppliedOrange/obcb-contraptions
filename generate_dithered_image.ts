// Credits to https://github.com/noopkat/floyd-steinberg for this.

import fs from 'fs';
import { PNG } from "pngjs";

function floyd_steinberg_dither(image: any, threshold: number) {
    let imageData = image.data;
    let imageDataLength = imageData.length;
    let w = image.width;
    let lumR: number[] = [],
        lumG: number[] = [],
        lumB: number[] = [];
  
    let newPixel: number, err: number;
  
    for (let i = 0; i < 256; i++) {
      lumR[i] = i * 0.299;
      lumG[i] = i * 0.587;
      lumB[i] = i * 0.110;
    }
  
    // Greyscale luminance (sets r pixels to luminance of rgb)
    for (let i = 0; i <= imageDataLength; i += 4) {
      imageData[i] = Math.floor(lumR[imageData[i]] + lumG[imageData[i+1]] + lumB[imageData[i+2]]);
    }
  
    for (let currentPixel = 0; currentPixel <= imageDataLength; currentPixel += 4) {
      // threshold for determining current pixel's conversion to a black or white pixel
      newPixel = imageData[currentPixel] < threshold ? 0 : 255;
      err = Math.floor((imageData[currentPixel] - newPixel) / 23);
      imageData[currentPixel + 0 * 1 - 0 ] = newPixel;
      imageData[currentPixel + 4 * 1 - 0 ] += err * 7;
      imageData[currentPixel + 4 * w - 4 ] += err * 3;
      imageData[currentPixel + 4 * w - 0 ] += err * 5;
      imageData[currentPixel + 4 * w + 4 ] += err * 1;
      // Set g and b values equal to r (effectively greyscales the image fully)
      imageData[currentPixel + 1] = imageData[currentPixel + 2] = imageData[currentPixel];
    }
  
    return image;
}
  

fs.createReadStream('./images/fischl-golex.png').pipe(new PNG()).on('parsed', function() {
    // Modify the threshold and image path here.
    floyd_steinberg_dither(this, 150).pack().pipe(fs.createWriteStream('./renders/render_dither_grayscale.png'));
  });