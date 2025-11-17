const API = "http://127.0.0.1:8000";

export async function uploadPdf(file: File): Promise<{ paper_id: string }> {
  const form = new FormData();
  form.append("file", file);

  const r = await fetch(`${API}/upload`, {
    method: "POST",
    body: form,
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getPageCount(paperId: string) {
  const r = await fetch(`${API}/papers/${paperId}/pages`);
  if (!r.ok) throw new Error(await r.text());
  return r.json(); // { pages: number }
}

export function pageImageURL(
  paperId: string,
  idx: number,
  zoom: number = 1.5
) {
  return `${API}/papers/${paperId}/page/${idx}/image?zoom=${zoom}`;
}

export async function pageMeta(
  paperId: string,
  idx: number,
  zoom: number = 1.5
) {
  const r = await fetch(`${API}/papers/${paperId}/page/${idx}/meta?zoom=${zoom}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function listEquations(paperId: string) {
  const r = await fetch(`${API}/papers/${paperId}/equations`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function saveEquation(paperId: string, payload: any) {
  const r = await fetch(`${API}/papers/${paperId}/equations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function validateLatex(latex: string) {
  const r = await fetch(`${API}/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latex }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
