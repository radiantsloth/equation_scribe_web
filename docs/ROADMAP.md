Spiral 1 — Human-in-the-loop PDF Equation Scribe (SPIRAL1_ROADMAP)
Summary (goal)

Build an interactive GUI & lightweight backend that lets humans verify and correct equations auto-detected in PDFs. Deliver a repeatable pipeline from PDF → heuristic detector → human in the loop editing → validated equations saved as JSONL profiles.

What we implemented (completed)

PDF rendering and metadata helpers (page images, pdf_to_px/px_to_pdf).

Heuristic detector for equation candidates (tuned thresholds).

Profile indexing (PROFILES_ROOT/index.json) and CLI registration (register_paper).

Backend endpoints for:

profile index, find-by-basename, list/save/update/delete equations,

page image/meta and LaTeX validation.

Frontend (React + Konva) that supports:

drawing/moving/resizing boxes (corner + edge handles),

selecting “current boxes” and saved boxes,

LaTeX edit box with KaTeX preview,

Save / Update / Delete flows wired to backend,

Auto-load profile by PDF basename.

Storage safety: portalocker-backed index read/writes and backup history for profile writes.

Unit tests for PDF ingest & detection fixed and passing.

Remaining / polish items (recommended)

Delete confirmation + undo for deletions.

Checksum-based profile lookup (fallback to basename): compute & store PDF checksum to avoid missing profile when filename changed.

Auto-pan/zoom to saved box when selecting a saved box off-screen.

Larger improvements in autodetector (ML-based / multi-line grouping) to reduce human work in Spiral 2.

CI: pytest in GitHub Actions, and linting for frontend.

E2E tests for critical flows (open PDF → edit box → validate → save → verify).

How to proceed (next steps)

Prioritize: (1) checksum lookup + profile registration, (2) autodetector improvement, (3) sympy integration and symbol glossary.

For each item, create a small branch, add unit tests for the core logic, and produce a PR that CI runs.

File locations

Backend: equation_scribe_web/backend/

Frontend: equation_scribe_web/frontend/

Index & profiles: $PROFILES_ROOT/index.json and $PROFILES_ROOT/<paper_id>/equations.jsonl

Roadmap docs: equation_scribe_web/docs/