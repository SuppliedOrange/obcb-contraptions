from pymongo import MongoClient

# Connect to the MongoDB server
client = MongoClient("mongodb://localhost:27017/")

# Select the database and collection
db = client["obcb"]
collection = db["pixels"]

# Dictionary to track seen pixels
seen_pixels = {}

# Iterate over all documents in the collection
for doc in collection.find():
    pixel_value = doc["pixel"]
    
    if pixel_value in seen_pixels:
        # If pixel is already seen, delete the current document
        collection.delete_one({"_id": doc["_id"]})
        print(f"Removed duplicate document with pixel: {pixel_value}")
    else:
        # If pixel is not seen, mark it as seen
        seen_pixels[pixel_value] = doc["_id"]

# Close the connection
client.close()