import React, { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Transformer, Image as KonvaImage } from "react-konva";
import type { Box } from "../types";

type Props = {
  pageIndex: number;
  image: HTMLImageElement | null;
  pagePx: { width: number; height: number };
  pdfDims: { widthPts: number; heightPts: number };
  savedBoxes: Box[];
  currentBoxes: Box[];
  setCurrentBoxes: (b: Box[]) => void;
};

export default function Boxes({ pageIndex, image, pagePx, pdfDims, savedBoxes, currentBoxes, setCurrentBoxes }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const trRef = useRef<any>(null);

  // PDF points <-> pixel transforms
  const scaleX = pagePx.width / pdfDims.widthPts;
  const scaleY = pagePx.height / pdfDims.heightPts;
  const pdfToPx = (x:number,y:number)=>({ x: x*scaleX, y: y*scaleY });
  const pxToPdf = (x:number,y:number)=>({ x: x/scaleX, y: y/scaleY });

  const currentRects = useMemo(()=>{
    return currentBoxes
      .map((b,i)=>({...b, id: b.id ?? `cur-${i}`}))
      .filter(b=>b.page===pageIndex)
      .map(b=>{
        const [x0,y0,x1,y1] = b.bbox_pdf;
        const p0 = pdfToPx(x0,y0), p1 = pdfToPx(x1,y1);
        const x = Math.min(p0.x, p1.x), y = Math.min(p0.y, p1.y);
        const w = Math.abs(p1.x - p0.x), h = Math.abs(p1.y - p0.y);
        return {...b, id:b.id!, x, y, w, h};
      });
  }, [currentBoxes, pageIndex, scaleX, scaleY]);

  const savedRects = useMemo(()=>{
    return savedBoxes
      .filter(b=>b.page===pageIndex)
      .map((b,i)=>{
        const [x0,y0,x1,y1] = b.bbox_pdf;
        const p0 = pdfToPx(x0,y0), p1 = pdfToPx(x1,y1);
        const x = Math.min(p0.x, p1.x), y = Math.min(p0.y, p1.y);
        const w = Math.abs(p1.x - p0.x), h = Math.abs(p1.y - p0.y);
        return {...b, id:`saved-${i}`, x, y, w, h};
      });
  }, [savedBoxes, pageIndex, scaleX, scaleY]);

  useEffect(()=>{
    const tr = trRef.current;
    if (!tr) return;
    const stage = tr.getStage();
    const sel = stage?.findOne(`#${selectedId}`);
    if (sel) tr.nodes([sel]); else tr.nodes([]);
    tr.getLayer()?.batchDraw();
  }, [selectedId, currentRects]);

  // Rubber-band draw
  const [dragStart, setDragStart] = useState<{x:number;y:number}|null>(null);
  const [dragRect, setDragRect] = useState<{x:number;y:number;w:number;h:number}|null>(null);

  function onMouseDown(e:any){
    if (e.target?.name() !== "bg") return;
    const pos = e.target.getStage().getPointerPosition();
    if (!pos) return;
    setDragStart(pos);
    setSelectedId(null);
  }
  function onMouseMove(e:any){
    if (!dragStart) return;
    const pos = e.target.getStage().getPointerPosition();
    if (!pos) return;
    setDragRect({
      x: Math.min(dragStart.x, pos.x),
      y: Math.min(dragStart.y, pos.y),
      w: Math.abs(pos.x - dragStart.x),
      h: Math.abs(pos.y - dragStart.y),
    });
  }
  function onMouseUp(){
    if (dragRect && dragRect.w > 4 && dragRect.h > 4){
      const p0 = pxToPdf(dragRect.x, dragRect.y);
      const p1 = pxToPdf(dragRect.x + dragRect.w, dragRect.y + dragRect.h);
      const bbox:[number,number,number,number] = [
        Math.min(p0.x, p1.x), Math.min(p0.y, p1.y),
        Math.max(p0.x, p1.x), Math.max(p0.y, p1.y),
      ];
      const nb:Box = { page: pageIndex, bbox_pdf: bbox, id: `cur-${Date.now()}` };
      setCurrentBoxes([...currentBoxes, nb]);
      setSelectedId(nb.id!);
    }
    setDragStart(null);
    setDragRect(null);
  }

  function onRectDragMove(id:string, e:any){
    const node = e.target;
    const {x,y,width,height,scaleX,scaleY} = node.attrs;
    const w = width * scaleX, h = height * scaleY;
    const p0 = pxToPdf(x, y);
    const p1 = pxToPdf(x + w, y + h);
    const bbox:[number,number,number,number] = [
      Math.min(p0.x, p1.x), Math.min(p0.y, p1.y),
      Math.max(p0.x, p1.x), Math.max(p0.y, p1.y),
    ];
    setCurrentBoxes(currentBoxes.map(b => b.id===id ? {...b, bbox_pdf: bbox} : b));
  }

  function onRectTransformEnd(id:string, e:any){
    const node = e.target;
    const sx = node.scaleX();
    const sy = node.scaleY();
    node.scaleX(1); node.scaleY(1);
    const x = node.x(), y = node.y();
    const w = node.width() * sx, h = node.height() * sy;
    const p0 = pxToPdf(x, y);
    const p1 = pxToPdf(x + w, y + h);
    const bbox:[number,number,number,number] = [
      Math.min(p0.x, p1.x), Math.min(p0.y, p1.y),
      Math.max(p0.x, p1.x), Math.max(p0.y, p1.y),
    ];
    setCurrentBoxes(currentBoxes.map(b => b.id===id ? {...b, bbox_pdf: bbox} : b));
  }

  function deleteSelected(){
    if (!selectedId) return;
    setCurrentBoxes(currentBoxes.filter(b => b.id !== selectedId));
    setSelectedId(null);
  }

  return (
    <Stage
      width={pagePx.width}
      height={pagePx.height}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      tabIndex={0}
      onKeyDown={(e:any)=>{ if (e.key === "Delete") deleteSelected(); }}
      style={{border: "1px solid #ddd"}}
    >
      <Layer>
        <KonvaImage image={image || undefined} name="bg" listening={true}/>
        {savedRects.map(r => (
          <Rect key={r.id} x={r.x} y={r.y} width={r.w} height={r.h}
                stroke="gray" dash={[4,4]} listening={false}/>
        ))}
        {currentRects.map(r => (
          <Rect key={r.id} id={r.id} x={r.x} y={r.y} width={r.w} height={r.h}
                stroke="red" fill="rgba(255,0,0,0.06)" draggable
                onClick={()=>setSelectedId(r.id!)}
                onTap={()=>setSelectedId(r.id!)}
                onDragMove={(e)=>onRectDragMove(r.id!, e)}
                onTransformEnd={(e)=>onRectTransformEnd(r.id!, e)}
          />
        ))}
        <Transformer ref={trRef} rotateEnabled={false}
          enabledAnchors={["top-left","top-right","bottom-left","bottom-right"]}/>
        {dragRect && (
          <Rect x={dragRect.x} y={dragRect.y} width={dragRect.w} height={dragRect.h}
                stroke="#2a8" dash={[6,4]} listening={false}/>
        )}
      </Layer>
    </Stage>
  );
}