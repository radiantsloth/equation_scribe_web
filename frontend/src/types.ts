// frontend/src/types.ts

export type BBox = [number, number, number, number];

export type Box = {
  page: number;
  bbox_pdf: BBox;
  id?: string;
};

// SavedBox includes which equation it belongs to and which index
export type SavedBox = Box & {
  eq_uid: string;
  box_idx: number;
  id: string;
};

export type EquationRecord = {
  eq_uid: string;
  paper_id: string;
  latex: string;
  notes: string;
  boxes: Box[];
};

export async function updateEquation(paperId: string, eqUid: string, payload: any) {
  const r = await fetch(`${API}/papers/${paperId}/equations/${encodeURIComponent(eqUid)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

