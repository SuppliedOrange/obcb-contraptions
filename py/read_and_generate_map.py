import struct
from threading import Thread
from time import time
from os import remove
from PIL import Image
import numpy as np
import websocket

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

    def getPageState(self, page: int) -> bytes:
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

def process_pages_in_chunk(start_page, end_page, filename):

    obcb = OBCB()

    with open(filename, "w") as myfile:
        pass

    for pageNumber in range(start_page, end_page + 1):
        print(f"Processing page {pageNumber}")
        bitList = []
        pageState = obcb.getPageState(pageNumber)
        toBreak = False
        startIndex = obcb.pageToIndex(pageNumber)
        endIndex = startIndex + 262143
        counter = startIndex

        for byte in pageState:
            if toBreak:
                break
            for i in range(8):
                bit = (byte >> i) & 1
                bitList.append(bit)
                counter += 1
                if counter > endIndex:
                    toBreak = True
                    break

        with open(filename, "a") as myfile:
            myfile.write("".join(map(str, bitList)))

def divide_chunks(l, n):
    # looping till length l
    for i in range(0, len(l), n): 
        yield l[i:i + n]

def process_all_pages(chunk_size):
    threads = []

    chunks = list(
        divide_chunks(
            list( range(1, 4097) ),
            chunk_size
        )
    )

    for chunk in chunks:
        
        start_page = chunk[0]
        end_page = chunk[-1]

        filename = f"pagedata-{start_page}-{end_page + 1}-{current_time}.txt"
        filenames.append(filename)

        thread = Thread(target=process_pages_in_chunk, args=(start_page, end_page, filename))
        threads.append(thread)
        thread.start()

    for thread in threads:
        thread.join()

if __name__ == "__main__":

    GENERATE_DUMP = True
    USE_FROM_DUMP = ""
    filenames = []
    total_start = time()
    start = time()
    binary_data = ""
    current_time = int(time())
    
    if not USE_FROM_DUMP:

        print("No dump provided, scanning.")
        
        process_all_pages(chunk_size=500)

        print(f"Finished reading all checkboxes in {time() - start} seconds, generating map.\nPlease be wary of memory and cpu. This is very resource intensive and may error if insufficient.")

        print("Reading data...")
        start = time()
        for filename in filenames:
            with open(filename, 'r') as file:
                binary_data += file.read()

        print(f"Finished reading in {time() - start} seconds")

        if (GENERATE_DUMP, "w"):
            print("Generating dump...")
            start = time()
            with open(f"dump-{current_time}.txt", "w") as f:
                f.write(binary_data)
            print(f"Finished generating dump in {time() - start} seconds")

        for filename in filenames:
            remove(filename)
    
    else:
        print(f"Using dump from {USE_FROM_DUMP}")
        start = time()
        with open(USE_FROM_DUMP, "r") as f:
            binary_data += f.read()
        print(f"Finished reading from dump in {time() - start} seconds")

    # Calculate the size of the square image
    side_length = int(len(binary_data) ** 0.5)

    print("Converting data to NP array...")
    start = time()
    # Convert the binary data to a numpy array
    binary_data = np.array([int(bit) for bit in binary_data], dtype=np.uint8)
    print(f"Finished converting in {time() - start} seconds")

    # Reshape the array into a square shape
    print("Reshaping array...")
    start = time()
    binary_data = binary_data.reshape((side_length, side_length))
    print(f"Finished reshaping in {time() - start} seconds")

    # Define the colors as numpy arrays
    filled_color = np.array([250, 179, 135], dtype=np.uint8)  # #fab387
    unfilled_color = np.array([30, 30, 46], dtype=np.uint8)    # #1e1e2e

    # Create an empty 3D numpy array to hold the RGB image data
    print("Mapping binary data to RGB values...")
    start = time()
    rgb_data = np.zeros((side_length, side_length, 3), dtype=np.uint8)

    # Use numpy's boolean indexing to assign colors based on the binary data
    rgb_data[binary_data == 0] = filled_color
    rgb_data[binary_data == 1] = unfilled_color
    print(f"Finished mapping in {time() - start} seconds")

    # Convert the RGB numpy array to an image
    print("Converting array to image...")
    start = time()
    image = Image.fromarray(rgb_data)
    print(f"Finished converting in {time() - start} seconds")

    # Save the image
    print("Saving image...")
    start = time()
    image.save('square_image.png')
    print(f"Image saved in {time() - start} seconds")

    print(f"Total operation time was {time() - total_start} seconds")

    print("Image saved to square_image.png")