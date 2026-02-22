from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime


class UserRegister(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100, example="Alex Johnson")
    email: EmailStr = Field(..., example="alex@university.edu")
    password: str = Field(..., min_length=8, example="securepassword123")
    university: Optional[str] = Field(None, example="Stanford University")
    # Skills this user can TEACH (shown as "Offers" on cards)
    skills_offered: List[str] = Field(default=[], example=["UI Design", "Figma"])
    # Skills this user wants to LEARN (shown as "Wants" on cards)
    skills_wanted: List[str] = Field(default=[], example=["Python", "React Native"])


class UserLogin(BaseModel):
    email: EmailStr = Field(..., example="alex@university.edu")
    password: str = Field(..., example="securepassword123")


class UserResponse(BaseModel):
    id: str
    full_name: str
    email: str
    university: Optional[str] = None
    skills_offered: List[str] = []
    skills_wanted: List[str] = []
    credits: int = 0
    member_since: str
    avatar_color: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
