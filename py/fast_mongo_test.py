from concurrent.futures import ThreadPoolExecutor
import time
from pymongo import MongoClient, InsertOne
import struct
from threading import Thread
from typing import List
import ssl
ssl._create_default_https_context = ssl._create_unverified_context

import websocket


def valueChecks(page, startIndex, endIndex):
    if startIndex > endIndex:
        raise ValueError("startIndex must be less than endIndex")

    if startIndex < 0 or endIndex > 64**3:
        raise ValueError("startIndex and endIndex must be between 0 and 64**3")

    if page < 1 or page > 4096:
        raise ValueError("Page must be between 1 and 4096")


class OBCB:
    def __init__(self):
        """
        Connects to the OBCB WebSocket server.
        """
        self.ws = websocket.WebSocket()
        self.ws.connect("wss://bitmap-ws.alula.me/")
        self.ws.recv()  # hello (0x00)
        self.ws.recv()  # stats (0x01)

    def pageToIndex(self, page: int) -> int:
        """
        Calculates the starting index of a given page.

        Parameters:
        - page (int): The page number.

        Returns:
        - int: The starting index of the page.
        """
        return (page - 1) * 64**3

    def rowToIndex(self, row: int) -> int:
        """
        Converts a row number to an index.

        Parameters:
        - row (int): The row number to convert.

        Returns:
        - int: The corresponding index.
        """
        return row * 60

    def indexToBytes(self, index: int) -> bytes:
        """
        Converts an index to bytes.

        Parameters:
        - index (int): The index to convert.

        Returns:
        - bytes: The converted index.
        """
        return struct.pack("<BI", 0x13, index)

    def flip(self, page: int, index: int) -> None:
        """
        Flips the page at the specified index.

        Parameters:
        - page (int): The page number.
        - index (int): The index of the page within the book.

        Returns:
        - None
        """
        pageIndex = self.pageToIndex(page)

        bytesIndex = self.indexToBytes(pageIndex + index)
        self.ws.send(bytesIndex, websocket.ABNF.OPCODE_BINARY)

    def     getPageState(self, page: int) -> bytes:
        """
        Retrieves the state of a page.

        Parameters:
        - page (int): The page number.

        Returns:
        - bytes: The state of the page.
        """
        self.ws.send(struct.pack("<BH", 0x10, page - 1), websocket.ABNF.OPCODE_BINARY)

        while True:
            data = self.ws.recv()

            if data[0] == 0x11:
                break

        return data[3:]

    def clear(self, page: int, startIndex: int, endIndex: int) -> None:
        """
        Clears the bits in the specified range of a page.

        Parameters:
        - page (int): The page number.
        - startIndex (int): The starting index of the range.
        - endIndex (int): The ending index of the range.

        Returns:
        - None
        """
        valueChecks(page, startIndex, endIndex)

        pageState = self.getPageState(page)

        toBreak = False
        skipped = 0
        counter = startIndex

        for byte in pageState:
            if toBreak:
                break

            for i in range(8):
                if skipped < startIndex:
                    skipped += 1
                    continue

                bit = (byte >> i) & 1
                if bit == 0:
                    self.flip(page, counter)

                counter += 1

                if counter > endIndex:
                    toBreak = True
                    break
    def close(self):

        self.ws.close()

def scrape(pageNumber: int,  collection):

    obcb = OBCB()

    start = time.time()

    print(f"Starting {pageNumber}")

    numbers = []

    pageState = obcb.getPageState(pageNumber)

    startIndex = obcb.pageToIndex(pageNumber)
    endIndex = startIndex + 262144

    # Perform a batch query to retrieve all pixels in the current range
    existing_pixels = set(collection.find({"pixel": {"$gte": startIndex, "$lt": endIndex}}).distinct("pixel"))
    end3 = time.time()
    print(f"Got mongodb response in {end3 - start} seconds")

    counter = startIndex
    toBreak = False

    for byte in pageState:

        if toBreak:
            break

        for i in range(8):

            #if counter in existing_pixels:
            #    counter += 1
            #    continue

            bit = (byte >> i) & 1

            if bit == 1:
                numbers.append({"pixel": counter, "value": 1})
            else:
                numbers.append({"pixel": counter, "value": 0})

            counter += 1

            if counter >= endIndex:
                toBreak = True
                break

    if not numbers:
        print(f"{pageNumber} had no data!")
        return f"{pageNumber} had no data!"
    
    finishMain = time.time()
    collection.insert_many(numbers)
    end2 = time.time()
    obcb.close()
    print(f"Finished inserting {pageNumber} into collection in {end2 - finishMain} seconds")


uri = "mongodb://localhost:27017/"
client = MongoClient(uri)
db = client["obcb"]
collection = db["pixels"]

threads: List[str] = []

with ThreadPoolExecutor(max_workers=25) as executor:
    for pageNumber in range(2200, 4096):
        future = executor.submit( scrape, pageNumber, collection )

print("Finished!")

client.close()