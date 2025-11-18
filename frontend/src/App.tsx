// frontend/src/App.tsx
import React, { useEffect, useState } from "react";
import PdfImage from "./pdf/PdfImage";
import Boxes from "./canvas/Boxes";
import {
  getPageCount,
  listEquations,
  saveEquation,
  updateEquation,
  validateLatex,
  uploadPdf,
} from "./api/client";
import type { Box, SavedBox, EquationRecord } from "./types";

export default function App() {
  const [paperId, setPaperId] = useState<string | null>(null);
  const [pages, setPages] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState(1.5);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [pagePx, setPagePx] = useState({ width: 800, height: 1100 });
  const [status, setStatus] = useState<string>("No PDF loaded");

  const [pdfDims, setPdfDims] = useState<{ widthPts: number; heightPts: number }>({
    widthPts: 0,
    heightPts: 0,
  });

  // equations holds the full EquationRecord array returned by the backend
  const [equations, setEquations] = useState<EquationRecord[]>([]);

  // Build savedBoxes from equations (each savedBox includes eq_uid and box_idx)
  const [savedBoxes, setSavedBoxes] = useState<SavedBox[]>([]);
  const [currentBoxes, setCurrentBoxes] = useState<Box[]>([]);

  // selection state
  const [selectedEqUid, setSelectedEqUid] = useState<string | null>(null);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);

  // Latex editor
  const [latex, setLatex] = useState("");
  const [notes, setNotes] = useState("");

  const hasPdf = !!paperId && pages > 0;

  // Upload handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setStatus(`Uploading "${file.name}"...`);
      const { paper_id } = await uploadPdf(file);
      setPaperId(paper_id);
      setStatus(`Uploaded. Loading pages for "${file.name}"...`);

      const { pages } = await getPageCount(paper_id);
      setPages(pages);
      setPageIndex(0);
      setStatus(`Loaded ${pages} pages.`);

      // clear state
      setSavedBoxes([]);
      setCurrentBoxes([]);
      setEquations([]);
      setSelectedEqUid(null);
      setSelectedBoxId(null);
      setLatex("");
      setNotes("");

      // fetch equations if any (some uploads may have none)
      const saved = await listEquations(paper_id);
      const eqs: EquationRecord[] = saved.items || [];
      setEquations(eqs);

      // flatten to SavedBox[]
      const sBoxes: SavedBox[] = [];
      for (const eq of eqs) {
        eq.boxes.forEach((b, idx) => {
          sBoxes.push({
            page: b.page,
            bbox_pdf: b.bbox_pdf,
            eq_uid: eq.eq_uid,
            box_idx: idx,
            id: `saved-${eq.eq_uid}-${idx}`,
          });
        });
      }
      setSavedBoxes(sBoxes);
    } catch (err: any) {
      console.error(err);
      setStatus(`Error uploading/loading PDF: ${err.message ?? String(err)}`);
    }
  };

  function handleImageReady(image: HTMLImageElement, meta: any) {
    setImg(image);
    setPagePx({ width: meta.width_px, height: meta.height_px });
    setPdfDims({ widthPts: meta.width_pts, heightPts: meta.height_pts });
  }

  async function onValidate() {
    const r = await validateLatex(latex);
    setStatus(r.ok ? "✅ OK" : `❌ ${r.errors?.join("; ") || ""}`);
  }

// Save: create new equation OR update an existing one
async function onSave() {
  if (!paperId) {
    setStatus("❌ No PDF loaded.");
    return;
  }

  try {
    // If an existing equation is selected, update it
    if (selectedEqUid) {
      // find the equation record in memory
      const existing = equations.find((e) => e.eq_uid === selectedEqUid);

      if (!existing) {
        setStatus("❌ Selected equation not found; saving as new.");
      } else {
        // Make a new record merging edits:
        // Use the existing boxes (they should have been updated by handleSavedBoxChange)
        const updated: EquationRecord = {
          eq_uid: existing.eq_uid,
          paper_id: paperId,
          latex: latex,
          notes: notes,
          boxes: existing.boxes.map((b) => ({ page: b.page, bbox_pdf: b.bbox_pdf })),
        };

        // Call update endpoint (PUT) to persist changes in-place
        await updateEquation(paperId, existing.eq_uid, updated);

        setStatus("✅ Updated existing equation.");
        // Reload equations so frontend is canonical with backend
        const saved = await listEquations(paperId);
        setEquations(saved.items || []);
        // rebuild savedBoxes (you probably already do this after saves)
        const sBoxes: SavedBox[] = [];
        (saved.items || []).forEach((eq: EquationRecord) => {
          eq.boxes.forEach((b, idx) => {
            sBoxes.push({
              page: b.page,
              bbox_pdf: b.bbox_pdf,
              eq_uid: eq.eq_uid,
              box_idx: idx,
              id: `saved-${eq.eq_uid}-${idx}`,
            });
          });
        });
        setSavedBoxes(sBoxes);
        // keep selection on the updated equation
        setSelectedEqUid(existing.eq_uid);
        return;
      }
    }

    // Otherwise: create a new equation using currentBoxes
    if (currentBoxes.length === 0) {
      setStatus("❌ Add at least one box.");
      return;
    }

    const rec: EquationRecord = {
      eq_uid: crypto.randomUUID().slice(0, 16),
      paper_id: paperId,
      latex,
      notes,
      boxes: currentBoxes.map((b) => ({ page: b.page, bbox_pdf: b.bbox_pdf })),
    };

    await saveEquation(paperId, rec);

    setStatus(`✅ Saved ${currentBoxes.length} box(es).`);

    // reload equations and savedBoxes
    const saved = await listEquations(paperId);
    const eqs: EquationRecord[] = saved.items || [];
    setEquations(eqs);

    const sBoxes: SavedBox[] = [];
    for (const eq of eqs) {
      eq.boxes.forEach((b, idx) => {
        sBoxes.push({
          page: b.page,
          bbox_pdf: b.bbox_pdf,
          eq_uid: eq.eq_uid,
          box_idx: idx,
          id: `saved-${eq.eq_uid}-${idx}`,
        });
      });
    }
    setSavedBoxes(sBoxes);
    setCurrentBoxes([]); // clear the working boxes after save
  } catch (err: any) {
    console.error(err);
    setStatus(`❌ Error saving equation: ${err?.message ?? String(err)}`);
  }
}


  // When a saved box is selected on the canvas, load the corresponding equation's latex
  function handleSelectSaved(eq_uid: string, boxId: string) {
    setSelectedBoxId(boxId);
    setSelectedEqUid(eq_uid);
    const eq = equations.find((e) => e.eq_uid === eq_uid);
    if (eq) {
      setLatex(eq.latex || "");
      setNotes(eq.notes || "");
    } else {
      setLatex("");
      setNotes("");
    }
  }

  // When a saved box is edited (drag/transform), update in-memory savedBoxes (and equations structure)
  function handleSavedBoxChange(boxId: string, newBox: Box) {
    // update savedBoxes
    setSavedBoxes((prev) =>
      prev.map((sb) => (sb.id === boxId ? { ...sb, bbox_pdf: newBox.bbox_pdf } : sb))
    );

    // also update the corresponding equation's boxes in `equations` so LaTeX save can include the change
    setEquations((prev) =>
      prev.map((eq) => {
        const found = prev.findIndex((x) => x.eq_uid === eq.eq_uid);
        // map over eqs, but do it by replacing the box if it matches eq_uid & box_idx
        const updated = { ...eq };
        let changed = false;
        updated.boxes = updated.boxes.map((b, idx) => {
          const id = `saved-${eq.eq_uid}-${idx}`;
          if (id === boxId) {
            changed = true;
            return { ...b, bbox_pdf: newBox.bbox_pdf };
          }
          return b;
        });
        return updated;
      })
    );
  }

  // Create SavedBox[] convenience for Boxes component (already maintained above but keep in sync)
  // (No extra code needed here because we update savedBoxes on load/save/edit.)

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", padding: 12, gap: 12 }}>
      {/* LEFT: PDF viewport */}
      <div style={{ flex: "0 0 70%", maxWidth: "70%", minWidth: 600, borderRight: "1px solid #ddd", display: "flex", justifyContent: "center", alignItems: "center", background: "#f5f5f5", overflow: "auto" }}>
        <div style={{ display: "inline-block", position: "relative" }}>
          {hasPdf && (
            <PdfImage paperId={paperId!} pageIndex={pageIndex} zoom={zoom} onImageReady={handleImageReady} />
          )}
          <Boxes
            pageIndex={pageIndex}
            image={img}
            pagePx={pagePx}
            pdfDims={pdfDims}
            savedBoxes={savedBoxes}
            currentBoxes={currentBoxes}
            setCurrentBoxes={setCurrentBoxes}
            onSelectSaved={handleSelectSaved}
            onSavedBoxChange={handleSavedBoxChange}
          />
        </div>
      </div>

      {/* RIGHT: sidebar / controls */}
      <div style={{ flex: "0 0 30%", maxWidth: "30%", minWidth: 360, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
        <div style={{ marginBottom: 16 }}>
          <label>
            <strong>Load PDF: </strong>
            <input type="file" accept="application/pdf" onChange={handleFileChange} />
          </label>
          {paperId && <div style={{ marginTop: 8, fontSize: 12, color: "#555" }}>Loaded paper id: <code>{paperId}</code> ({pages} pages)</div>}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button disabled={!hasPdf} onClick={() => setPageIndex((idx) => Math.max(0, idx - 1))}>◀</button>
          <span>{hasPdf ? `Page ${pageIndex + 1}/${pages}` : "No PDF loaded"}</span>
          <button disabled={!hasPdf} onClick={() => setPageIndex((idx) => Math.min(pages - 1, idx + 1))}>▶</button>
          <button disabled={!hasPdf} onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>−</button>
          <span>Zoom {zoom.toFixed(2)}x</span>
          <button disabled={!hasPdf} onClick={() => setZoom((z) => z + 0.25)}>+</button>
        </div>

        <div style={{ border: "1px solid #eee", padding: 8 }}>
          <h3 style={{ marginTop: 0 }}>Equation Editor</h3>
          <label>LaTeX</label>
          <textarea rows={5} value={latex} onChange={(e) => setLatex(e.target.value)} style={{ width: "100%" }} />
          <label>Notes</label>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ width: "100%" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button disabled={!hasPdf} onClick={onValidate}>Check</button>
            <button disabled={!hasPdf} onClick={onSave}>Approve & Save</button>
            <button disabled={!hasPdf} onClick={() => setCurrentBoxes([])}>Clear Current Boxes</button>
          </div>
        </div>

        <div style={{ border: "1px solid #eee", padding: 8 }}>
          <h3 style={{ marginTop: 0 }}>Boxes</h3>
          <div>Saved (gray): {savedBoxes.filter((b) => b.page === pageIndex).length} on this page</div>
          <div>Current (red): {currentBoxes.filter((b) => b.page === pageIndex).length} on this page</div>
          <div style={{ marginTop: 8, color: "#666" }}>{status}</div>
        </div>
      </div>
    </div>
  );
}
