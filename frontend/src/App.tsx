import React, { useEffect, useState } from "react";
import PdfImage from "./pdf/PdfImage";
import Boxes from "./canvas/Boxes";
import {
  getPageCount,
  listEquations,
  saveEquation,
  validateLatex,
  uploadPdf,
} from "./api/client";
import type { Box } from "./types";

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
  const [latex, setLatex] = useState("");
  const [notes, setNotes] = useState("");
  const [savedBoxes, setSavedBoxes] = useState<Box[]>([]);
  const [currentBoxes, setCurrentBoxes] = useState<Box[]>([]);

  const hasPdf = !!paperId && pages > 0;

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
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
      setSavedBoxes([]);
      setCurrentBoxes([]);
      setLatex("");
      setNotes("");
    } catch (err: any) {
      console.error(err);
      setStatus(
        `Error uploading/loading PDF: ${err.message ?? String(err)}`
      );
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

  async function onSave() {
    if (currentBoxes.length === 0) {
      setStatus("❌ Add at least one box.");
      return;
    }
    if (!paperId) {
      setStatus("❌ No PDF loaded.");
      return;
    }

    const rec = {
      eq_uid: crypto.randomUUID().slice(0, 16),
      paper_id: paperId,
      latex,
      notes,
      boxes: currentBoxes.map((b) => ({
        page: b.page,
        bbox_pdf: b.bbox_pdf,
      })),
    };

    try {
      await saveEquation(paperId, rec);
      setStatus(`✅ Saved ${currentBoxes.length} box(es).`);
      setCurrentBoxes([]);

      const saved = await listEquations(paperId);
      const boxes: Box[] = (saved.items || []).flatMap(
        (r: any) => r.boxes || []
      );
      setSavedBoxes(boxes);
    } catch (e: any) {
      setStatus(`❌ ${e.message || e}`);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        padding: 12,
        gap: 12,
        boxSizing: "border-box",
      }}
    >
      {/* LEFT: PDF viewport */}
      <div
        style={{
          flex: "0 0 70%",
          maxWidth: "70%",
          minWidth: 600,
          borderRight: "1px solid #ddd",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "#f5f5f5",
          overflow: "auto",
        }}
      >
        <div
          style={{
            display: "inline-block",
            position: "relative",
          }}
        >
          {hasPdf && (
            <PdfImage
              paperId={paperId!}
              pageIndex={pageIndex}
              zoom={zoom}
              onImageReady={handleImageReady}
            />
          )}
          <Boxes
            pageIndex={pageIndex}
            image={img}
            pagePx={pagePx}
            pdfDims={pdfDims}
            savedBoxes={savedBoxes}
            currentBoxes={currentBoxes}
            setCurrentBoxes={setCurrentBoxes}
          />
        </div>
      </div>

      {/* RIGHT: sidebar / controls */}
      <div
        style={{
          flex: "0 0 30%",
          maxWidth: "30%",
          minWidth: 360,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          overflowY: "auto",
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <label>
            <strong>Load PDF: </strong>
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
            />
          </label>
          {paperId && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#555" }}>
              Loaded paper id: <code>{paperId}</code> ({pages} pages)
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            disabled={!hasPdf}
            onClick={() =>
              setPageIndex((idx) => Math.max(0, idx - 1))
            }
          >
            ◀
          </button>
          <span>
            {hasPdf ? `Page ${pageIndex + 1}/${pages}` : "No PDF loaded"}
          </span>
          <button
            disabled={!hasPdf}
            onClick={() =>
              setPageIndex((idx) => Math.min(pages - 1, idx + 1))
            }
          >
            ▶
          </button>
          <button
            disabled={!hasPdf}
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
          >
            −
          </button>
          <span>Zoom {zoom.toFixed(2)}x</span>
          <button
            disabled={!hasPdf}
            onClick={() => setZoom((z) => z + 0.25)}
          >
            +
          </button>
        </div>

        <div style={{ border: "1px solid #eee", padding: 8 }}>
          <h3 style={{ marginTop: 0 }}>Equation Editor</h3>
          <label>LaTeX</label>
          <textarea
            rows={5}
            value={latex}
            onChange={(e) => setLatex(e.target.value)}
            style={{ width: "100%" }}
          />
          <label>Notes</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ width: "100%" }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button disabled={!hasPdf} onClick={onValidate}>
              Check
            </button>
            <button disabled={!hasPdf} onClick={onSave}>
              Approve & Save
            </button>
            <button
              disabled={!hasPdf}
              onClick={() => setCurrentBoxes([])}
            >
              Clear Current Boxes
            </button>
          </div>
        </div>

        <div style={{ border: "1px solid #eee", padding: 8 }}>
          <h3 style={{ marginTop: 0 }}>Boxes</h3>
          <div>
            Saved (gray):{" "}
            {savedBoxes.filter((b) => b.page === pageIndex).length} on this
            page
          </div>
          <div>
            Current (red):{" "}
            {currentBoxes.filter((b) => b.page === pageIndex).length} on this
            page
          </div>
          <div style={{ marginTop: 8, color: "#666" }}>{status}</div>
        </div>
      </div>
    </div>
  );
}
