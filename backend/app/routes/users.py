from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from typing import List
from datetime import datetime

from app.database import users_collection
from app.models.user import UserResponse
from app.utils.auth import get_current_user

router = APIRouter(prefix="/users", tags=["Users"])


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
        avatar_color=user_doc.get("avatar_color", "#6366f1")
    )


@router.get("/me", response_model=UserResponse)
async def get_my_profile(current_user: dict = Depends(get_current_user)):
    user = await users_collection.find_one({"_id": ObjectId(current_user["user_id"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return format_user(user)


@router.get("/matches", response_model=List[dict])
async def get_recommended_matches(current_user: dict = Depends(get_current_user)):
    # Get current user's skills
    me = await users_collection.find_one({"_id": ObjectId(current_user["user_id"])})
    if not me:
        raise HTTPException(status_code=404, detail="User not found")
    
    my_offers = set(s.lower() for s in me.get("skills_offered", []))
    my_wants = set(s.lower() for s in me.get("skills_wanted", []))
    
    # Get all OTHER users
    cursor = users_collection.find({"_id": {"$ne": ObjectId(current_user["user_id"])}})
    all_users = await cursor.to_list(length=100)
    
    # Score each user
    scored_users = []
    for user in all_users:
        their_offers = set(s.lower() for s in user.get("skills_offered", []))
        their_wants = set(s.lower() for s in user.get("skills_wanted", []))
        
        match_for_me = len(their_offers & my_wants)
        match_for_them = len(my_offers & their_wants)
        
        score = match_for_me + match_for_them
        
        scored_users.append({
            "id": str(user["_id"]),
            "full_name": user["full_name"],
            "university": user.get("university", ""),
            "skills_offered": user.get("skills_offered", []),
            "skills_wanted": user.get("skills_wanted", []),
            "avatar_color": user.get("avatar_color", "#6366f1"),
            "credits": user.get("credits", 0),
            "match_score": score
        })
    
    scored_users.sort(key=lambda x: x["match_score"], reverse=True)
    
    return scored_users


@router.get("/{user_id}", response_model=UserResponse)
async def get_user_profile(user_id: str):
    try:
        user = await users_collection.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID format")
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return format_user(user)


@router.get("/", response_model=List[UserResponse])
async def get_all_users(current_user: dict = Depends(get_current_user)):
    cursor = users_collection.find({"_id": {"$ne": ObjectId(current_user["user_id"])}})
    users = await cursor.to_list(length=100)
    return [format_user(u) for u in users]


@router.put("/me/skills")
async def update_my_skills(
    skills_offered: List[str],
    skills_wanted: List[str],
    current_user: dict = Depends(get_current_user)
):
    await users_collection.update_one(
        {"_id": ObjectId(current_user["user_id"])},
        {"$set": {
            "skills_offered": skills_offered,
            "skills_wanted": skills_wanted
        }}
    )
    return {"message": "Skills updated successfully"}
