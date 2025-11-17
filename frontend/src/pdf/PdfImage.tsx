import React, { useEffect, useState } from "react";
import { pageImageURL, pageMeta } from "../api/client";

type Props = {
  paperId: string;
  pdfPath: string;
  pageIndex: number;
  zoom: number;
  onImageReady: (img: HTMLImageElement, meta: any) => void;
};

export default function PdfImage({ paperId, pdfPath, pageIndex, zoom, onImageReady }: Props) {
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const meta = await pageMeta(paperId, pageIndex, pdfPath, zoom);
      const url = pageImageURL(paperId, pageIndex, pdfPath, zoom);
      const img = new Image();
      img.onload = () => { if (!cancelled) onImageReady(img, meta); };
      img.src = url;
      setSrc(url);
    }
    run().catch(console.error);
    return () => { cancelled = true; };
  }, [paperId, pdfPath, pageIndex, zoom]);

  return <img src={src} alt="pdf" style={{ display: "none" }} />;
}