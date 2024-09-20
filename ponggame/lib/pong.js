
const { createCanvas } = require('canvas');
const fs = require('fs');

const flags = require("./flags")();
const { Terminal, Box, Menu } = require("../command-line-draw");
console = require("./colorConsole");

let terminalWidth = 140;
let terminalHeight = 60;

const random = (min, max) => Math.random() * (max - min) + min;
const randomSlope = (min, max) => Math.tan(random(Math.atan(min), Math.atan(max)));
function directionFunc (n, direction) {
    const min = 0;
    const max = terminal.width - ball.width;
    if (Math.abs(n) === Infinity) {
        if (direction === "right") return max;
        else return min;
    }
    else return Math.min(Math.max(n, min), max);
}
function nextPoint (slope, direction) {

    const directionMod = direction === "right" ? 1 : -1;
    const ballYInt = -slope * ball.x + ball.y;
    const x = directionFunc(directionMod * slope < 0 ? -ballYInt / slope : (terminal.height - ball.height - ballYInt) / slope, direction);
    const y = ball.yRounder(slope * x + ballYInt);

    if (x > paddleX + paddleWidth) leftPaddle.moveTo(paddleX, Math.min(Math.max(y + 1 - paddleHeight / 2, 0), terminal.height - paddleHeight));
    else leftPaddle.moveTo(paddleX, ball.yRounder(Math.min(Math.max(slope * (paddleX + paddleWidth) + ballYInt + 1 - paddleHeight / 2, 0), terminal.height - paddleHeight)));

    if (x > rightPaddle.x + paddleWidth) rightPaddle.moveTo(rightPaddle.x, Math.min(Math.max(y + 1 - paddleHeight / 2, 0), terminal.height - paddleHeight));
    else rightPaddle.moveTo(rightPaddle.x, ball.yRounder(Math.min(Math.max(slope * (rightPaddle.x + paddleWidth) + ballYInt + 1 - paddleHeight / 2, 0), terminal.height - paddleHeight)));

    return [ball.xRounder(x), y];

}
const writeScore = (score, location) => {};

const terminal = new Terminal({
    width: flags.w || flags.width || terminalWidth,
    height: flags.h || flags.height || terminalHeight,
    border: "solid",
    dev: flags.d || flags.dev,
    color: {
        foreground: flags.c || flags.color || flags.fg || flags.foreground || "white",
        background: flags.bg || flags.background || flags.backgroundColor || "black"
    }
});

const centerX = terminal.width / 2;
const centerY = terminal.height / 2;
const paddleHeight = 7;
const paddleWidth = 2;
const paddleX = 7;
const leftScoreX = Math.floor(terminal.width / 4 - 3);
const rightScoreX = Math.ceil(3 * terminal.width / 4 - 3);
const borders = Terminal.BORDERS.double;
borders.horizontalDown = "\u2566";
borders.horizontalUp = "\u2569";
let cpuScore, playerScore, ballDirection, ballSlope, bouncedOff, automatePlayer2, automatePlayer1;

const drawCenterLine = () => terminal.drawLine(centerX, 0, centerX, terminal.height, null, 2, true, 0.5);

const leftPaddle = new Box(paddleWidth, paddleHeight);
const rightPaddle = new Box(paddleWidth, paddleHeight, { speed: 30 });
const ball = new Box(2, 1, { speed: 30 });

terminal.addSprite(leftPaddle);
terminal.addSprite(rightPaddle);
terminal.addSprite(ball);


function reset () {
    // paddles
    leftPaddle.stop();
    rightPaddle.stop();
    leftPaddle.draw(paddleX, centerY - paddleHeight / 2);
    rightPaddle.draw(terminal.width - paddleX - paddleWidth, centerY - paddleHeight / 2);

    // ball
    bouncedOff = undefined;
    ballSlope = randomSlope(-0.5, 0.5);
    ball.speed = 30;
    ball.clear();
    setTimeout(() => {
        ball.draw(centerX - 1, centerY);
        bounce();
    }, 200);
}
function bounce() {
    ball.moveTo(...nextPoint(ballSlope, ballDirection));
}

function init () {
    cpuScore = 0;
    playerScore = 0;
    ballDirection = Math.round(Math.random()) ? "left" : "right";

    terminal.width = 60;
    terminal.height = 140;

    ball.removeAllListeners();
    terminal.removeAllListeners();
    terminal.clear();
    terminal.on("resize", () => {
        terminal.width = 60;
        terminal.height = 140;
    });

    ball.on("clear", (x, y) => {
        if (x <= centerX && x >= centerX - 2) drawCenterLine();
        else if (!(y + ball.height < 1 || y > 6)) {
        if (!(x + ball.width < leftScoreX || x >= leftScoreX + 6)) writeScore(cpuScore, "left");
        else if (!(x + ball.width < rightScoreX || x >= rightScoreX + 6)) writeScore(playerScore, "right");
        }
    });


    ball.on("frame", async () => {

        const touching = ball.touching(rightPaddle) ? rightPaddle : ball.touching(leftPaddle) ? leftPaddle : null;

        if (touching) {
            touching.draw();
            if (bouncedOff !== touching) {
                ball.stop();
                let x;
                if (touching === rightPaddle) {
                    x = terminal.width - paddleX - 1;
                    ballDirection = "left";
                }
                else {
                    x = paddleX + 1;
                    ballDirection = "right";
                }
                ballSlope = ((rightPaddle.y + paddleHeight / 2) - (ball.y + 0.5)) / ((terminal.width - paddleX) - Math.min(ball.x + 1, x)) / 1.5 + (Math.random() - 0.5) / 5;
                ball.speed += 0;
                bouncedOff = touching;
                bounce();
            }
        }

    });

    ball.on("moveEnded", () => {
        
        ballDirection = "left";
        reset();
        if (ball.y === 0 || ball.y === terminal.height - 1) {
            ballSlope *= -1;
            bounce();
        }

    });

    reset();
    drawCenterLine();
}

automatePlayer2 = true;
automatePlayer1 = true;
leftPaddle.speed = 30;
init();

let ballPosition = { x: 0, y: 0 };
let leftPaddlePosition = { x: 0, y: 0 };
let rightPaddlePosition = { x: 0, y: 0 };

const width = terminalWidth;
const height = terminalHeight;
const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');

function drawGame() {

    // Clear the canvas
    ctx.clearRect(0, 0, width, height);

    // Draw the background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    // Draw the ball
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(ballPosition.x, ballPosition.y + 2, 3, 0, Math.PI * 2, true);
    ctx.fill();

    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, width, height);

    // Draw the dotted line in the middle
    ctx.setLineDash([10, 15]); // 10px dash, 15px gap
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();
    ctx.setLineDash([]); // Reset the line dash

    // Draw the left paddle
    ctx.fillRect(leftPaddlePosition.x, leftPaddlePosition.y, 4, 15);

    // Draw the right paddle
    ctx.fillRect(rightPaddlePosition.x, rightPaddlePosition.y, 4, 15);
}

function saveImage() {
    const buffer = canvas.toBuffer('image/png');
    const filename = `../images/pong.png`;
    try {
        fs.writeFileSync(filename, buffer);
    }
    catch(err) { console.log('pong.png locked') }
}

let changeBall = false;
let changeRightPaddle = false;
let changeLeftPaddle = false;

setInterval(() => {
    changeBall = true;
    changeRightPaddle = true;
    changeLeftPaddle = true;
}, 300);

ball.on('draw', (x, y) => {
    if (!changeBall) return;
    ballPosition = { x, y };
    drawGame();
    saveImage();
    changeBall = false;
});

leftPaddle.on('draw', (x, y) => {
    if (!changeLeftPaddle) return;
    leftPaddlePosition = { x, y };
    drawGame();
    saveImage();
    changeLeftPaddle = false;
});

rightPaddle.on('draw', (x, y) => {
    if (!changeRightPaddle) return;
    rightPaddlePosition = { x, y };
    drawGame();
    saveImage();
    changeRightPaddle = false;
});