"""
routes/chat.py — Chat System Routes
--------------------------------------
This is the CORE feature of SkillSwap — two users exchanging messages.

How the chat works (step by step):

1. User A clicks "Chat" on User B's card
   → Frontend calls POST /chat/conversations with B's ID
   → Backend creates a conversation document in MongoDB (if not exists)
   → Returns conversation_id

2. User A types a message and clicks Send
   → Frontend calls POST /chat/messages with conversation_id + content
   → Backend saves message to MongoDB
   → Returns saved message

3. Frontend polls GET /chat/messages/{conversation_id} every few seconds
   → Backend returns all messages in that conversation
   → Frontend displays them (yours on right, theirs on left)

4. Same process works for User B — they see the same conversation

DATABASE DESIGN:
   
   conversations collection:
   {
     _id: ObjectId,
     participants: ["user_a_id", "user_b_id"],  // Always sorted!
     created_at: datetime,
     last_message: "Can we trade Python?",
     last_message_time: datetime
   }
   
   messages collection:
   {
     _id: ObjectId,
     conversation_id: "conv_id",  // Links to conversations
     sender_id: "user_a_id",
     content: "Can we trade Python for Spanish?",
     timestamp: datetime
   }
   
   Why sorted participants?
   If A starts chat with B → participants: ["A", "B"]
   If B starts chat with A → same conversation! (we sort and find existing)
   This prevents duplicate conversations.
"""

from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from typing import List
from datetime import datetime

from app.database import users_collection, conversations_collection, messages_collection
from app.models.chat import ConversationCreate, MessageSend, MessageResponse, ConversationResponse
from app.utils.auth import get_current_user

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.post("/conversations", response_model=dict)
async def create_or_get_conversation(
    data: ConversationCreate,
    current_user: dict = Depends(get_current_user)
):

    my_id = current_user["user_id"]
    other_id = data.participant_id
    
    if my_id == other_id:
        raise HTTPException(status_code=400, detail="You cannot chat with yourself")
    
    # Verify the other user exists
    other_user = await users_collection.find_one({"_id": ObjectId(other_id)})
    if not other_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Sort participant IDs so A→B and B→A find the same conversation
    participants_sorted = sorted([my_id, other_id])

    existing = await conversations_collection.find_one({
        "participants": participants_sorted
    })
    
    if existing:
        return {"conversation_id": str(existing["_id"]), "is_new": False}
    
    new_conv = {
        "participants": participants_sorted,
        "created_at": datetime.utcnow(),
        "last_message": None,
        "last_message_time": None
    }
    result = await conversations_collection.insert_one(new_conv)
    
    return {"conversation_id": str(result.inserted_id), "is_new": True}


@router.post("/messages", response_model=MessageResponse)
async def send_message(
    data: MessageSend,
    current_user: dict = Depends(get_current_user)
):
    my_id = current_user["user_id"]
    
    # Verify conversation exists
    conv = await conversations_collection.find_one({"_id": ObjectId(data.conversation_id)})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Verify you're a participant (security check!)
    if my_id not in conv["participants"]:
        raise HTTPException(status_code=403, detail="You're not part of this conversation")
    
    # Get sender's name to include in response
    sender = await users_collection.find_one({"_id": ObjectId(my_id)})
    sender_name = sender["full_name"] if sender else "Unknown"
    
    # Save the message
    now = datetime.utcnow()
    new_message = {
        "conversation_id": data.conversation_id,
        "sender_id": my_id,
        "sender_name": sender_name,
        "content": data.content,
        "timestamp": now
    }
    result = await messages_collection.insert_one(new_message)
    
    # Update conversation's last_message for sidebar preview
    await conversations_collection.update_one(
        {"_id": ObjectId(data.conversation_id)},
        {"$set": {
            "last_message": data.content,
            "last_message_time": now
        }}
    )
    
    return MessageResponse(
        id=str(result.inserted_id),
        conversation_id=data.conversation_id,
        sender_id=my_id,
        sender_name=sender_name,
        content=data.content,
        timestamp=now.isoformat()
    )


@router.get("/messages/{conversation_id}", response_model=List[MessageResponse])
async def get_messages(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
   
    my_id = current_user["user_id"]
    
    conv = await conversations_collection.find_one({"_id": ObjectId(conversation_id)})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if my_id not in conv["participants"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    cursor = messages_collection.find(
        {"conversation_id": conversation_id}
    ).sort("timestamp", 1) 
    
    messages = await cursor.to_list(length=500)
    
    return [
        MessageResponse(
            id=str(m["_id"]),
            conversation_id=m["conversation_id"],
            sender_id=m["sender_id"],
            sender_name=m["sender_name"],
            content=m["content"],
            timestamp=m["timestamp"].isoformat()
        )
        for m in messages
    ]


@router.get("/conversations", response_model=List[ConversationResponse])
async def get_my_conversations(current_user: dict = Depends(get_current_user)):
    """
    Get all conversations for the logged-in user.
    Shown in the messages sidebar.
    """
    my_id = current_user["user_id"]
    
    cursor = conversations_collection.find(
        {"participants": my_id}
    ).sort("last_message_time", -1) 

    conversations = await cursor.to_list(length=50)
    
    result = []
    for conv in conversations:

        other_id = next((p for p in conv["participants"] if p != my_id), None)
        if not other_id:
            continue
        
        other_user = await users_collection.find_one({"_id": ObjectId(other_id)})
        if not other_user:
            continue
        

        other_skill = (other_user.get("skills_offered") or [""])[0]
        
        result.append(ConversationResponse(
            id=str(conv["_id"]),
            other_user_id=other_id,
            other_user_name=other_user["full_name"],
            other_user_skill=other_skill,
            last_message=conv.get("last_message"),
            last_message_time=conv["last_message_time"].isoformat() if conv.get("last_message_time") else None,
            unread_count=0
        ))
    
    return result
