
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.database import connect_db, close_db
from app.routes import auth, users, chat


@asynccontextmanager
async def lifespan(app: FastAPI):

    await connect_db()  
    yield              
    await close_db()   


app = FastAPI(
    title="SkillSwap API",
    description="""
    ## SkillSwap — Student Skill Exchange Platform
    
    Connect with students, swap skills, grow together.
    
    ### Features:
    - 🔐 JWT Authentication (Register & Login)
    - 👤 User Profiles with Skills
    - 🤝 Smart Skill Matching
    - 💬 Real-time Chat (via polling)
    
    ### How to test:
    1. Register two users via POST /auth/register
    2. Login both via POST /auth/login  
    3. Copy the access_token from login response
    4. Click 'Authorize' button and paste: Bearer <your_token>
    5. Now you can test protected routes!
    """,
    version="1.0.0",
    lifespan=lifespan
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],               
    allow_credentials=True,
    allow_methods=["*"],         
    allow_headers=["*"],             
)


app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(chat.router, prefix="/api")


@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "Welcome to SkillSwap API! 🚀",
        "docs": "Visit /docs for interactive API documentation",
        "status": "running"
    }


@app.get("/health", tags=["Root"])
async def health_check():
    return {"status": "healthy"}
