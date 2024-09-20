import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';

async function main() {

    // Create a canvas
    const canvas = createCanvas(480, 251);
    const ctx = canvas.getContext('2d');

    
    let triangle = await loadImage("../images/triangle-0.png");
    let circle = await loadImage("../images/circle-0.png");
    let rectangle = await loadImage("../images/rectangle-0.png");

    // up triangle
    ctx.save();
    ctx.translate(105, 69);
    ctx.rotate(0); // No rotation, facing up
    ctx.drawImage(triangle, -triangle.width / 2, -triangle.height / 2);
    ctx.restore();

    // down triangle
    ctx.save();
    ctx.translate(105, 189);
    ctx.rotate(Math.PI); // Rotate 180 degrees to face down
    ctx.drawImage(triangle, -triangle.width / 2, -triangle.height / 2);
    ctx.restore();

    // right triangle
    ctx.save();
    ctx.translate(165, 129);
    ctx.rotate(Math.PI / 2); // Rotate 90 degrees to face right
    ctx.drawImage(triangle, -triangle.width / 2, -triangle.height / 2);
    ctx.restore();

    // left triangle
    ctx.save();
    ctx.translate(45, 129);
    ctx.rotate(-Math.PI / 2); // Rotate -90 degrees to face left
    ctx.drawImage(triangle, -triangle.width / 2, -triangle.height / 2);
    ctx.restore();

    // b
    ctx.drawImage(circle, 370, 29, circle.width, circle.height);

    // a
    ctx.drawImage(circle, 320, 129, circle.width, circle.height);

    // Start button
    ctx.drawImage(rectangle, 150, -16, rectangle.width - 20, rectangle.height - 20);

    // Select button
    ctx.drawImage(rectangle, 250, -16, rectangle.width - 20, rectangle.height - 20);

    fs.writeFileSync( 'output.png', canvas.toBuffer() );
    
    return

}

main();
