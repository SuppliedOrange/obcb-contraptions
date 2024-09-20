from PIL import Image
import numpy as np

binary_data = ""

# Open the file and read the binary data
with open('pagedata-1-820.txt', 'r') as file:
    binary_data += file.read()
with open('pagedata-820-1639.txt', 'r') as file:
    binary_data += file.read()
with open('pagedata-1639-2458.txt', 'r') as file:
    binary_data += file.read()
with open('pagedata-2458-3277.txt', 'r') as file:
    binary_data += file.read()
with open('pagedata-3277-4096.txt', 'r') as file:
    binary_data += file.read()

# Calculate the size of the square image
side_length = int(len(binary_data) ** 0.5)

# Convert the binary data to a numpy array
binary_array = np.array([int(bit) for bit in binary_data], dtype=np.uint8)

# Reshape the array into a square shape
binary_array = binary_array.reshape((side_length, side_length))

# Create the image using the binary data
image = Image.fromarray(binary_array * 255)  # Multiply by 255 to convert 0 and 1 to black and white

# Save the image
image.save('square_image.png')