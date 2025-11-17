from pathlib import Path
from typing import List, Dict, Any
import json
from .schemas import EquationRecord

def equations_path(root: Path, paper_id: str) -> Path:
    d = root / paper_id
    d.mkdir(parents=True, exist_ok=True)
    return d / "equations.jsonl"

def read_equations(root: Path, paper_id: str) -> List[Dict[str, Any]]:
    p = equations_path(root, paper_id)
    if not p.exists():
        return []
    out = []
    with p.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except Exception:
                continue
    return out

def append_equation(root: Path, rec: EquationRecord) -> None:
    p = equations_path(root, rec.paper_id)
    # Pydantic v2 or v1 compatible JSON serialization
    try:
        # v2 path: dump to dict then json.dumps to control ensure_ascii
        payload = json.dumps(rec.model_dump(), ensure_ascii=False)
    except AttributeError:
        # v1 path: use .json with ensure_ascii
        payload = rec.json(ensure_ascii=False)
    with p.open("a", encoding="utf-8") as f:
        f.write(payload + "\n")
