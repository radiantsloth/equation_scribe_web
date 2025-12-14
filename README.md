# Equation Scribe Web (React + PDF.js + Konva + FastAPI)

A PDF-based equation annotation tool (frontend + backend) that provides:
- interactive PDF viewing and zoom
- drawing / moving / resizing equation bounding boxes
- LaTeX editing and KaTeX preview
- LaTeX validation (SymPy/ANTLR)
- saving per-paper structured JSONL「equations.jsonl」profiles
- an index that maps PDFs → `paper_id` profiles for consistent loading

---

## Repo layout

equation_scribe_web/
├── backend/ # FastAPI backend
├── frontend/ # React + Vite + Konva frontend
├── docs/ # Spiral roadmaps & documentation
└── paper_profiles/ # saved JSONL profiles (local example)


---

## Quickstart (development)

These examples assume Windows PowerShell and a Conda environment named `eqscribe`. Adjust paths and shell commands for Linux/macOS.

### Prereqs
- Python 3.10+ (3.11 tested)
- Conda (recommended)
- Node.js 18+ and npm 9+
- Optional: Tesseract OCR installed & on PATH (for heuristic OCR in autodetect)

### Environment
Create/activate the conda environment (if you have `environment.yml`):

```powershell
conda env create -f environment.yml -n eqscribe
conda activate eqscribe

or manually

conda activate eqscribe
pip install -r requirements.txt

# temporary for current session
$env:PAPERS_ROOT = "C:\[BASEDIR]\papers"
$env:PROFILES_ROOT = "C:\[BASEDIR]\paper_profiles"

To make permanent on Windows

setx PAPERS_ROOT "C:\[BASEDIR]\papers"
setx PROFILES_ROOT "C:\[BASEDIR]\paper_profiles"

Backend (FastAPI)

From repo root (equation_scribe_web), ensure dependencies installed:

conda activate eqscribe
pip install -r requirements.txt

2) Start the backend:

cd C:\Data\repos\equation_scribe_web
uvicorn backend.main:app --reload --port 8000 --reload-dir backend

Backend endpoints of interest:

GET /papers/index — profiles index JSON.

GET /papers/find_by_pdf?basename=<name> — find a profile by PDF basename.

GET /papers/{paper_id}/equations — list equations for a paper.

POST /papers/{paper_id}/equations — append a new equation.

PUT /papers/{paper_id}/equations/{eq_uid} — update an equation record.

DELETE /papers/{paper_id}/equations/{eq_uid} — delete an equation.

GET /papers/{paper_id}/page/{idx}/image and /meta — page image and metadata.

POST /validate — validate LaTeX with SymPy.

CORS: The backend allows the default dev origin (http://127.0.0.1:5173). If your frontend runs elsewhere, update CORS settings in backend/main.py.

Notes:

If you see ModuleNotFoundError: No module named 'backend', run uvicorn from the repo root (as shown).

For LaTeX parsing, SymPy requires antlr4-python3-runtime==4.11 (install if you see ANTLR errors).

Frontend (React + Vite + Konva)

Install and run:

cd frontend
npm install
npm run dev
Vite will show a local URL (commonly http://127.0.0.1:5173). Open in the browser.

If you see Cannot find @vitejs/plugin-react, run:

powershell
Copy code
cd frontend
npm install @vitejs/plugin-react --save-dev
Windows note: fsevents warnings are normal and can be ignored.

Autodetector CLI (equation_scribe repo)
The heuristic autodetector and profile registration are in the equation_scribe project (separate repo). Example usage:

powershell
Copy code
# in equation_scribe repo
conda activate eqscribe
python -m equation_scribe.autodetect_equations `
  --pdf "C:\[BASEDIR]\papers\MyPaper.pdf" `
  --paper-id "MyPaper" `
  --data-root "C:\[BASEDIR]\paper_profiles" `
  --min-score 0.6 --force
This writes PROFILES_ROOT/MyPaper/equations.jsonl and updates PROFILES_ROOT/index.json.


---

# 📅 Roadmap (Next Spirals)

* Spiral 2:
  Reloading saved boxes + editing existing datasets
* Spiral 3:
  Auto-detect candidate equations (ML + heuristics)
* Spiral 4:
  Symbol extraction + glossary building
* Spiral 5:
  Full RAG pipeline: equation search + explanation + consistency checking

---


