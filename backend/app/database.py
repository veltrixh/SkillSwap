import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")

client = AsyncIOMotorClient(MONGODB_URL)

db = client["skillswap"]

users_collection = db["users"]           
conversations_collection = db["conversations"]  
messages_collection = db["messages"]     

async def connect_db():
    try:
        await client.admin.command('ping')
        print("✅ Successfully connected to MongoDB!")
    except Exception as e:
        print(f"❌ MongoDB connection failed: {e}")


async def close_db():
    client.close()
    print("🔌 MongoDB connection closed.")
