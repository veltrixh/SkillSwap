from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ConversationCreate(BaseModel):
    participant_id: str = Field(..., example="64abc123def456")


class MessageSend(BaseModel):
    conversation_id: str = Field(..., example="64abc123def456")
    content: str = Field(..., min_length=1, max_length=2000, example="Can we trade Python for Spanish?")


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    sender_name: str
    content: str
    timestamp: str


class ConversationResponse(BaseModel):
    id: str
    # The OTHER user in the conversation (not you)
    other_user_id: str
    other_user_name: str
    other_user_skill: Optional[str] = None
    last_message: Optional[str] = None
    last_message_time: Optional[str] = None
    unread_count: int = 0
