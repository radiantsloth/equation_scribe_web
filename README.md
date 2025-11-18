# Equation Scribe – React + PDF.js + Konva + FastAPI Starter
.
# Run instructions: Backend
From conda
conda activate equation_scribe
cd C:\Data\repos\equation_scribe_web
uvicorn backend.main:app --reload --port 8000 --reload-dir backend

# Frontend
# 1. Open a new terminal (PowerShell or CMD)

# 2. Go to the frontend folder
cd C:\Data\repos\equation_scribe_web\frontend

# 3. Install dependencies (only needed once)
npm install

# 4. Start the development server
npm run dev

Here is a complete **README.md**, polished, structured, and ready to drop directly into the root of your `equation_scribe_web` repository.

---

# 📘 Equation Scribe Web UI

*A PDF-based equation annotation tool using React, PDF.js, Konva, FastAPI, and Python.*

Equation Scribe Web is the interactive user interface for building high-quality datasets of equations extracted from scientific PDFs. It allows you to:

* View PDF pages with zooming
* Draw equation bounding boxes
* Drag, resize, and edit boxes
* Enter LaTeX for each equation
* Validate LaTeX against SymPy
* Save structured JSONL records for downstream processing (RAG, model training, etc.)

This project contains **two separate components**:

* **Backend**: FastAPI server (Python)
* **Frontend**: React + Vite + Konva (JavaScript/TypeScript)

---

# 📁 Project Structure

```
equation_scribe_web/
│
├── backend/                 # FastAPI backend
│   ├── main.py              # API entrypoint
│   ├── pdf_utils.py         # Page rendering helpers
│   ├── storage.py           # Equation JSONL persistence layer
│   └── models.py            # Pydantic models
│
├── frontend/                # React + Vite frontend
│   ├── src/
│   │   ├── components/      # React components (PDF viewer, box editor)
│   │   ├── canvas/          # Konva layers for drawing/resizing
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
│
└── paper_profiles/          # Saved JSONL equation annotations
    └── sample-paper/
        └── equations.jsonl
```

---

# 🚀 Quickstart

## 1. Prerequisites

### 🐍 Python (backend)

* Python 3.10+ recommended
* Your existing Conda environment is fine
* Required pip packages are listed below

### 🟩 Node.js (frontend)

Install from:
[https://nodejs.org/en/download/](https://nodejs.org/en/download/)

Then verify:

```bash
node --version
npm --version
```

---

# 🖥️ Backend Setup (FastAPI)

## Step 1 — Navigate to backend folder

```bash
cd C:\Data\repos\equation_scribe_web
```

## Step 2 — Install dependencies

Inside your `eqscribe` conda env:

```bash
pip install fastapi uvicorn pydantic pymupdf pillow python-multipart
```

## Step 3 — Run backend server

```bash
uvicorn backend.main:app --reload --port 8000 --reload-dir backend
```

If successful, you'll see:

```
Uvicorn running on http://127.0.0.1:8000
```

Backend now provides:

* `/papers/...` → PDF rendering, metadata
* `/validate` → LaTeX → SymPy validation
* `/papers/.../equations` → JSONL persistence

---

# 🖥️ Frontend Setup (React + PDF.js + Konva)

## Step 1 — Navigate to frontend

```bash
cd C:\Data\repos\equation_scribe_web\frontend
```

## Step 2 — Install dependencies

```bash
npm install
```

## Step 3 — Run development server

```bash
npm run dev
```

You should see:

```
VITE v5.x ready
Local: http://127.0.0.1:5173/
```

Open a browser and go to:

👉 **[http://127.0.0.1:5173](http://127.0.0.1:5173)**

---

# 🎯 How to Use the UI

1. Enter the **path to a PDF**, e.g.:

   ```
   C:\Data\repos\equation_scribe\data\Research_on_SAR_Imaging.pdf
   ```

2. Scroll pages using the left panel.

3. Use the mouse to:

   * **Draw** a bounding box
   * **Select** a box
   * **Drag** to move
   * **Grab corners** to resize

4. Enter the **LaTeX** for that equation.

5. Click **Validate** to run SymPy parsing.

6. Click **Save** to append a record to:

   ```
   paper_profiles/<paper-name>/equations.jsonl
   ```

Each line of the JSONL contains:

```json
{
  "page": 3,
  "bbox_pdf": [x0, y0, x1, y1],
  "latex": "\\nabla \\cdot E = \\rho/\\epsilon_0",
  "hash": "sha256..."
}
```

This is stable across spirals and supports dataset creation.

---

# 🔧 Troubleshooting

### ❗ Backend: `ModuleNotFoundError: No module named 'backend'`

Run `uvicorn` from the `equation_scribe_web` **root directory**:

```bash
cd C:\Data\repos\equation_scribe_web
uvicorn backend.main:app --reload --port 8000 --reload-dir backend
```

### ❗ Frontend: `Cannot find @vitejs/plugin-react`

Install:

```bash
cd frontend
npm install @vitejs/plugin-react --save-dev
```

### ❗ Frontend: `fsevents` missing

Windows doesn't support `fsevents`. This is normal and harmless.

### ❗ LaTeX validation failing with ANTLR errors

Install compatible version:

```bash
pip install antlr4-python3-runtime==4.11
```

---

# 📦 Saving Outputs

Annotated equations are saved here:

```
equation_scribe_web/paper_profiles/<paper-id>/equations.jsonl
```

You can load this when re-opening a paper in Spiral 2.

---

# 🛠️ Development Notes

### Why React + Konva?

* Better mouse interactions (drag/resize/select)
* Real GUI quality
* Zooming and editing is smooth

### Why store JSONL instead of a DB?

* Line-append is cheap
* Git-friendly
* Easy to pipe into ML/RAG systems later
* Perfect for iterative labeling

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


