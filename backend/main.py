from pathlib import Path
import os
import hashlib
from typing import List, Dict, Any

from fastapi import Body
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from .schemas import EquationRecord
from .storage import read_equations, append_equation
from .services.pdf import page_count, render_page_png, page_meta
from .services.validate import validate_latex


APP_ROOT = Path(__file__).resolve().parents[1]
PROFILES_ROOT = Path(os.getenv("PROFILES_ROOT"))
PAPERS_ROOT = Path(os.getenv("PAPERS_ROOT"))
# Ensure directories exist
PROFILES_ROOT.mkdir(parents=True, exist_ok=True)
PAPERS_ROOT.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Equation Scribe API (React + Konva)")

# CORS for local frontend (Vite on 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        # "*",  # fine for local dev; tighten later if you like
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LatexPayload(BaseModel):
    latex: str


class UploadResponse(BaseModel):
    paper_id: str


def slugify(name: str) -> str:
    stem = Path(name).stem
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in stem)
    return safe or "paper"


def pdf_path_for(paper_id: str) -> Path:
    p = PAPERS_ROOT / f"{paper_id}.pdf"
    if not p.exists():
        raise HTTPException(404, f"PDF for paper_id '{paper_id}' not found")
    return p


@app.post("/upload", response_model=UploadResponse)
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported")

    paper_id = slugify(file.filename)
    dest = PAPERS_ROOT / f"{paper_id}.pdf"

    contents = await file.read()
    dest.write_bytes(contents)

    return UploadResponse(paper_id=paper_id)


@app.get("/papers/{paper_id}/pages")
def get_pages(paper_id: str):
    p = pdf_path_for(paper_id)
    return {"pages": page_count(p)}


@app.get("/papers/{paper_id}/page/{idx}/image")
def get_page_image(paper_id: str, idx: int, zoom: float = 1.5):
    p = pdf_path_for(paper_id)
    data = render_page_png(p, idx, zoom=zoom)
    return Response(content=data, media_type="image/png")


@app.get("/papers/{paper_id}/page/{idx}/meta")
def get_page_meta(paper_id: str, idx: int, zoom: float = 1.5):
    p = pdf_path_for(paper_id)
    return page_meta(p, idx, zoom=zoom)


@app.get("/papers/{paper_id}/equations")
def list_equations(paper_id: str) -> Dict[str, Any]:
    items = read_equations(PROFILES_ROOT, paper_id)
    return {"items": items}


@app.post("/papers/{paper_id}/equations")
def save_equation(paper_id: str, rec: EquationRecord):
    if not rec.boxes:
        raise HTTPException(400, "At least one box is required")
    if rec.paper_id != paper_id:
        raise HTTPException(400, "paper_id mismatch")
    append_equation(PROFILES_ROOT, rec)
    return {"ok": True}


@app.post("/validate")
def validate(payload: LatexPayload):
    return validate_latex(payload.latex or "")


def canonical_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]

@app.put("/papers/{paper_id}/equations/{eq_uid}")
def update_equation_endpoint(paper_id: str, eq_uid: str, rec: EquationRecord):
    if rec.paper_id != paper_id:
        raise HTTPException(400, "paper_id mismatch")
    if rec.eq_uid != eq_uid:
        raise HTTPException(400, "eq_uid mismatch")
    # use storage.update_equation
    from .storage import update_equation
    update_equation(PROFILES_ROOT, paper_id, eq_uid, rec.model_dump() if hasattr(rec, "model_dump") else rec.dict())
    return {"ok": True}
