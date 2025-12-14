import React, { useState } from "react";
import { autodetectPage } from "../api/client";
import { DetectionCandidate } from "../types";

interface Props {
  paperId: string;
  pageIndex: number;
  onCandidatesFound: (candidates: DetectionCandidate[]) => void;
}

export const AutoDetectButton: React.FC<Props> = ({ paperId, pageIndex, onCandidatesFound }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const candidates = await autodetectPage(paperId, pageIndex);
      onCandidatesFound(candidates);
    } catch (err) {
      console.error(err);
      setError("Detection failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "inline-block", marginLeft: "1rem" }}>
      <button 
        onClick={handleClick} 
        disabled={loading}
        style={{ backgroundColor: loading ? "#ccc" : "#007bff", color: "white", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer" }}
      >
        {loading ? "Scanning..." : "✨ Auto-Detect Equations"}
      </button>
      {error && <span style={{ color: "red", marginLeft: "8px", fontSize: "0.8em" }}>{error}</span>}
    </div>
  );
};