from pathlib import Path
import os
import hashlib
import json
from typing import List, Dict, Any

from fastapi import Body
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from .schemas import EquationRecord
from .storage import read_equations, append_equation, update_equation, delete_equation
from .services.pdf import page_count, render_page_png, page_meta
from .services.validate import validate_latex
from .adjudication import AdjudicationManager

from equation_scribe.recognition.inference import image_to_latex
from equation_scribe.pdf_ingest import load_pdf, page_image, page_layout, page_size_points, pdf_to_px_transform
from equation_scribe.detector.inference import detect_image #  YOLO inference script
from equation_scribe.detect import find_equation_candidates
import uuid # For generating UIDs

APP_ROOT = Path(__file__).resolve().parents[1]
# Point to the model you just copied
YOLO_MODEL_PATH = Path(__file__).parent / "models" / "best.pt" 
PROFILES_ROOT = Path(os.getenv("PROFILES_ROOT", "data/profiles"))
PAPERS_ROOT = Path(os.getenv("PAPERS_ROOT", "data/pdfs"))

PROFILES_ROOT.mkdir(parents=True, exist_ok=True)
PAPERS_ROOT.mkdir(parents=True, exist_ok=True)

adjudicator = AdjudicationManager()

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

class AutoDetectRequest(BaseModel):
    page_index: int

class UploadResponse(BaseModel):
    paper_id: str

class RescanRequest(BaseModel):
    page_index: int
    bbox: List[float]

def slugify(name: str) -> str:
    stem = Path(name).stem
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in stem)
    return safe or "paper"


def pdf_path_for(paper_id: str) -> Path:
    # Try finding it in PAPERS_ROOT
    p = PAPERS_ROOT / f"{paper_id}.pdf"
    if p.exists(): return p
    # Fallback search if needed
    raise HTTPException(404, f"PDF for paper_id '{paper_id}' not found")

# helper to load the index file from PROFILES_ROOT
def load_profiles_index() -> dict:
    idx_path = PROFILES_ROOT / "index.json"
    if not idx_path.exists():
        return {"version": 1, "papers": {}, "by_pdf_basename": {}}
    try:
        with idx_path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        # log and return a safe skeleton
        print("Error reading index.json:", e)
        return {"version": 1, "papers": {}, "by_pdf_basename": {}}

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


@app.get("/papers/index")
def get_profiles_index():
    """Return the profiles index.json (small)."""
    return load_profiles_index()


@app.get("/papers/find_by_pdf")
def find_by_pdf(basename: str):
    """
    Find the registered paper_id by PDF basename (relative filename),
    e.g. ?basename=Research_on_SAR_Imaging_...pdf
    """
    idx = load_profiles_index()
    pid = idx.get("by_pdf_basename", {}).get(basename)
    if not pid:
        raise HTTPException(404, "Profile not found for pdf basename")
    paper_entry = idx.get("papers", {}).get(pid, {})
    return {
        "paper_id": pid,
        "profiles_dir": paper_entry.get("profiles_dir", pid),
        "pdf_basename": paper_entry.get("pdf_basename", basename),
        "num_equations": paper_entry.get("num_equations", 0),
    }

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
    append_equation(PROFILES_ROOT, rec)
    
    # NEW: Save to Adjudication Dataset
    try:
        _adjudicate_record(paper_id, rec)
    except Exception as e:
        print(f"Adjudication error: {e}")
        
    return {"ok": True}

def _adjudicate_record(paper_id: str, rec: EquationRecord):
    """Helper to crop and save to adjudication dataset."""
    if not rec.boxes: return
    
    # Load PDF and Page
    pdf_path = pdf_path_for(paper_id)
    doc = load_pdf(pdf_path)
    page_ix = rec.boxes[0].page
    bbox_pdf = rec.boxes[0].bbox_pdf
    
    # Render page (150 DPI matches training)
    full_page_img = page_image(doc, page_ix, dpi=150)
    pdf2px, _ = pdf_to_px_transform(doc, page_ix, dpi=150)
    
    # Convert and Crop
    x0, y0, x1, y1 = bbox_pdf
    px0, py0 = pdf2px(x0, y0)
    px1, py1 = pdf2px(x1, y1)
    
    # NEW: Add Padding (Important for quality data)
    pad = 5
    w, h = full_page_img.size
    crop_box = (
        max(0, min(px0, px1) - pad), 
        max(0, min(py0, py1) - pad), 
        min(w, max(px0, px1) + pad), 
        min(h, max(py0, py1) + pad)
    )
    
    crop_img = full_page_img.crop(crop_box)
    
    # Save to "Gold Standard"
    adjudicator.save_correction(
        image=crop_img,
        latex=rec.latex,
        source_file=f"{paper_id}.pdf",
        bbox=bbox_pdf
    )

@app.post("/validate")
def validate(payload: LatexPayload):
    return validate_latex(payload.latex or "")


def canonical_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]

@app.put("/papers/{paper_id}/equations/{eq_uid}")
def update_equation_endpoint(paper_id: str, eq_uid: str, rec: EquationRecord):
    update_equation(PROFILES_ROOT, paper_id, eq_uid, rec.model_dump())
    
    # NEW: Save to Adjudication Dataset
    try:
        _adjudicate_record(paper_id, rec)
    except Exception as e:
        print(f"Adjudication error: {e}")
        
    return {"ok": True}

@app.delete("/papers/{paper_id}/equations/{eq_uid}")
def delete_equation_endpoint(paper_id: str, eq_uid: str):
    from .storage import delete_equation
    ok = delete_equation(PROFILES_ROOT, paper_id, eq_uid)
    if not ok:
        raise HTTPException(404, "Equation not found")
    return {"ok": True}

@app.post("/papers/{paper_id}/autodetect_page")
def autodetect_page(paper_id: str, payload: AutoDetectRequest):
    """
    1. Detect boxes using new column-aware logic.
    2. Crop images.
    3. Run OCR to get LaTeX.
    """
    # Use the existing helper to get the PDF path
    try:
        pdf_path = pdf_path_for(paper_id)
    except NameError:
        # Fallback if you haven't refactored pdf_path_for to be importable
        # This assumes PAPERS_ROOT is defined in this file (which it is)
        pdf_path = PAPERS_ROOT / f"{paper_id}.pdf"
        if not pdf_path.exists():
            raise HTTPException(404, f"PDF for paper_id '{paper_id}' not found")

    doc = load_pdf(pdf_path)
    
    # 1. Get Spans & Detect
    spans = page_layout(doc, payload.page_index)
    width, height = page_size_points(doc, payload.page_index)
    
    # Run the new Spiral 1 detector
    candidates = find_equation_candidates(spans, width)
    
    # 2. Recognition Loop (Spiral 2)
    results = []
    
    # Render page once at 150 DPI for efficiency
    full_page_img = page_image(doc, payload.page_index, dpi=150)
    pdf2px, _ = pdf_to_px_transform(doc, payload.page_index, dpi=150)
    
    for cand in candidates:
        x0, y0, x1, y1 = cand["bbox_pdf"]
        
        # Convert PDF coords to pixels for cropping
        # pdf2px returns (x, y), we need to handle the two corners
        px0, py0 = pdf2px(x0, y0) 
        px1, py1 = pdf2px(x1, y1)
        
        # Ensure coordinates are ordered for PIL crop (left, upper, right, lower)
        crop_box = (min(px0, px1), min(py0, py1), max(px0, px1), max(py0, py1))
        
        # Crop
        crop_img = full_page_img.crop(crop_box)
        
        # 3. Predict LaTeX using the Spiral 2 inference engine
        latex = image_to_latex(crop_img)
        
        results.append({
            "bbox_pdf": cand["bbox_pdf"],
            "latex": latex,
            "score": cand["score"]
        })
        
    return {"candidates": results}

class RescanRequest(BaseModel):
    page_index: int
    bbox: List[float]  # [x0, y0, x1, y1] (PDF coordinates)

@app.post("/papers/{paper_id}/rescan_box")
def rescan_box(paper_id: str, payload: RescanRequest):
    """
    Rescan a specific user-defined bounding box on a page.
    """
    # 1. Load PDF
    try:
        pdf_path = pdf_path_for(paper_id)
    except NameError:
         # Fallback if helper isn't imported
        pdf_path = PAPERS_ROOT / f"{paper_id}.pdf"

    doc = load_pdf(pdf_path)
    
    # 2. Prepare Image (150 DPI is usually sufficient for Latex-OCR)
    # Using the same transform logic as autodetect
    full_page_img = page_image(doc, payload.page_index, dpi=150)
    pdf2px, _ = pdf_to_px_transform(doc, payload.page_index, dpi=150)

    # 3. Convert PDF coords to Pixels
    x0, y0, x1, y1 = payload.bbox
    px0, py0 = pdf2px(x0, y0)
    px1, py1 = pdf2px(x1, y1)

    # Crop (ensure order for PIL)
    crop_box = (min(px0, px1), min(py0, py1), max(px0, px1), max(py0, py1))
    crop_img = full_page_img.crop(crop_box)

    # 4. Run Inference
    latex_result = image_to_latex(crop_img)
    
    return {"latex": latex_result}



@app.post("/papers/{paper_id}/autodetect_all")
def autodetect_all(paper_id: str):
    """
    Run detection on ALL pages using YOLO if available.
    """
    pdf_path = pdf_path_for(paper_id)
    doc = load_pdf(pdf_path)
    detected_count = 0
    
    for page_ix in range(doc.num_pages):
        candidates = []
        
        # 1. YOLO Detection
        if YOLO_MODEL_PATH.exists():
            img_path = PAPERS_ROOT / f"temp_{paper_id}_{page_ix}.png"
            page_img = page_image(doc, page_ix, dpi=150) 
            page_img.save(img_path)
            
            try:
                yolo_boxes = detect_image(str(YOLO_MODEL_PATH), str(img_path), conf_thresh=0.25)
                
                pdf2px, px2pdf = pdf_to_px_transform(doc, page_ix, dpi=150)
                
                for box in yolo_boxes:
                    px_coords = box['xyxy']
                    x0, y0 = px2pdf(px_coords[0], px_coords[1])
                    x1, y1 = px2pdf(px_coords[2], px_coords[3])
                    
                    candidates.append({
                        "bbox_pdf": (min(x0,x1), min(y0,y1), max(x0,x1), max(y0,y1)),
                        "score": box['conf']
                    })
            finally:
                if img_path.exists(): img_path.unlink()

        # 2. Recognition & Save
        if candidates:
            full_page_img = page_image(doc, page_ix, dpi=150)
            pdf2px, _ = pdf_to_px_transform(doc, page_ix, dpi=150)
            
            for cand in candidates:
                x0, y0, x1, y1 = cand["bbox_pdf"]
                px0, py0 = pdf2px(x0, y0)
                px1, py1 = pdf2px(x1, y1)
                
                # --- NEW: Add 5px padding ---
                pad = 5
                w, h = full_page_img.size
                crop_box = (
                    max(0, min(px0, px1) - pad), 
                    max(0, min(py0, py1) - pad), 
                    min(w, max(px0, px1) + pad), 
                    min(h, max(py0, py1) + pad)
                )
                
                crop_img = full_page_img.crop(crop_box)
                latex = image_to_latex(crop_img)
                
                rec = EquationRecord(
                    eq_uid=str(uuid.uuid4())[:16],
                    paper_id=paper_id,
                    latex=latex,
                    notes=f"Auto (YOLO {cand['score']:.2f})",
                    boxes=[{"page": page_ix, "bbox_pdf": cand["bbox_pdf"]}]
                )
                append_equation(PROFILES_ROOT, rec)
                detected_count += 1

    return {"message": f"Scanned {doc.num_pages} pages", "equations_found": detected_count}