# This is totally broken, dont use this lol

import struct
import time
import cv2
import websocket


def pageToIndex(page):
    return (page - 1) * 262144, page * 262144 - 1


def indexToBytes(index):
    return struct.pack("<BI", 0x13, index)


page = 3
row_offset = 78
images = [
    {
        "name": "./image5.jpg",
        "threshold": 200
    },
    {
        "name": "./image4.jpg",
        "threshold": 200
    },
    {
        "name": "./image3.jpg",
        "threshold": 160
    },
    {
        "name": "./image2.jpg",
        "threshold": 128
    },
    {
        "name": "./image8.jpg",
        "threshold": 200
    },
    {
        "name": "./image9.jpg",
        "threshold": 180
    },
    {
        "name": "./image7.jpg",
        "threshold": 200
    },
    {
        "name": "./image10.jpg",
        "threshold": 200
    },
    {
        "name": "./image11.jpg",
        "threshold": 180
    }
]

pageIndex = pageToIndex(page)

ws = websocket.WebSocket()
ws.connect("wss://bitmap-ws.alula.me/")
ws.recv()
ws.recv()

ws.send(struct.pack("<BH", 0x10, page - 1), websocket.ABNF.OPCODE_BINARY)
data = ws.recv()

pageIndex = pageToIndex(page)
image_index = 0
changedPixels = []

def redraw():

    counter = 0

    for byte in data[3:]:
        for i in range(8):

            bit = (byte >> i) & 1
            if bit == 1:
                bytesIndex = indexToBytes( (pageIndex[0] + counter ))
                ws.send(bytesIndex, websocket.ABNF.OPCODE_BINARY)

            counter += 1

redraw()
exit()

def render_image(image, threshold):

    global changedPixels
    global pageIndex

    image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    image = cv2.threshold(image, threshold, 210, cv2.THRESH_BINARY)[1]
    image = cv2.resize(image, (60, int(image.shape[0] * (60 / image.shape[1]))))

    data = ws.recv()

    currentIndex = pageIndex[0]

    oldChangedPixels = changedPixels.copy()
    changedPixels = []
    for row in image:
        for pixel in row:
            if pixel == 0:
                bytesIndex = indexToBytes(currentIndex + (row_offset * 60))
                changedPixels.append(bytesIndex)

                if bytesIndex not in oldChangedPixels:
                    ws.send(bytesIndex, websocket.ABNF.OPCODE_BINARY)
            currentIndex += 1

    for pixel in oldChangedPixels:
        if pixel not in changedPixels:
            ws.send(pixel, websocket.ABNF.OPCODE_BINARY)



while True:
    
    image_index += 1
    if image_index == len(images): image_index = 0

    currentImage = images[image_index]["name"]
    currentImageThreshold = images[image_index]["threshold"]
    image = cv2.imread(currentImage)
    redraw(len(image))
    render_image(image, currentImageThreshold)

    time.sleep(5)