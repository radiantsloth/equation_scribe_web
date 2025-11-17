export type BBox = [number, number, number, number];

export type Box = {
  page: number;
  bbox_pdf: BBox;
  id?: string;
};

export type EquationRecord = {
  eq_uid: string;
  paper_id: string;
  latex: string;
  notes: string;
  boxes: Box[];
};