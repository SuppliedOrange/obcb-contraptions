import struct

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
                if bit == 1:
                    self.flip(page, counter)

                counter += 1

                if counter > endIndex:
                    toBreak = True
                    break

if __name__ == "__main__":

    obcb = OBCB()

    for pageNumber in range(1, 4097):

        print(f"Processing page {pageNumber}")

        bitList = []

        pageState = obcb.getPageState( pageNumber )
        toBreak = False
        startIndex = obcb.pageToIndex( pageNumber )
        endIndex = startIndex + 262143
        counter = startIndex

        for byte in pageState:
            
            if toBreak:
                break

            for i in range(8):

                bit = (byte >> i) & 1

                if bit == 1:
                    bitList.append(1)
                else:
                    bitList.append(0)

                counter += 1

                if counter > endIndex:
                    toBreak = True
                    break
        
        with open("pagesdata.txt", "a") as myfile:
            myfile.write( "".join( map(str, bitList) ) )