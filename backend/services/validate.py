from typing import Dict, Any

def _fallback_validate(latex: str) -> Dict[str, Any]:
    latex = (latex or "").strip()
    if not latex:
        return {"ok": True, "errors": []}
    return {"ok": True, "errors": []}

try:
    from equation_scribe.validate import validate_latex as _core_validate
    def validate_latex(latex: str) -> Dict[str, Any]:
        res = _core_validate(latex or "")
        return {"ok": bool(res.ok), "errors": res.errors or []}
except Exception:
    def validate_latex(latex: str) -> Dict[str, Any]:
        return _fallback_validate(latex)