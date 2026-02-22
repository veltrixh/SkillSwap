from fastapi import APIRouter, HTTPException, status
from datetime import datetime
from bson import ObjectId
import random

from app.database import users_collection
from app.models.user import UserRegister, UserLogin, UserResponse, TokenResponse
from app.utils.auth import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["Authentication"])
AVATAR_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"]


def format_user(user_doc: dict) -> UserResponse:
    return UserResponse(
        id=str(user_doc["_id"]),
        full_name=user_doc["full_name"],
        email=user_doc["email"],
        university=user_doc.get("university"),
        skills_offered=user_doc.get("skills_offered", []),
        skills_wanted=user_doc.get("skills_wanted", []),
        credits=user_doc.get("credits", 0),
        member_since=user_doc.get("created_at", datetime.utcnow()).strftime("%Y"),
        avatar_color=user_doc.get("avatar_color", AVATAR_COLORS[0])
    )


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(user_data: UserRegister):

    # Step 1: Check if email is already registered
    existing = await users_collection.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(
            status_code=400,
            detail="This email is already registered. Please login instead."
        )
    hashed = hash_password(user_data.password)
    
    new_user = {
        "full_name": user_data.full_name,
        "email": user_data.email,
        "password_hash": hashed,       
        "university": user_data.university,
        "skills_offered": user_data.skills_offered,
        "skills_wanted": user_data.skills_wanted,
        "credits": 100,                
        "created_at": datetime.utcnow(),
        "avatar_color": random.choice(AVATAR_COLORS)  
    }
    

    result = await users_collection.insert_one(new_user)
    new_user["_id"] = result.inserted_id  
    
    user_id = str(result.inserted_id)
    token = create_access_token(user_id=user_id, user_email=user_data.email)
    
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=format_user(new_user)
    )


@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):

    user = await users_collection.find_one({"email": credentials.email})
    if not user:
        raise HTTPException(
            status_code=401,
            detail="No account found with this email address."
        )
    
    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(
            status_code=401,
            detail="Incorrect password. Please try again."
        )
    
    user_id = str(user["_id"])
    token = create_access_token(user_id=user_id, user_email=user["email"])
    
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=format_user(user)
    )
