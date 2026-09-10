import { useRef } from "react";
import { useHologram } from "../hooks/useHologram.js";

export default function Hologram({ speakingLevelRef }) {
  const containerRef = useRef(null);
  useHologram(containerRef, speakingLevelRef);
  return <div ref={containerRef} className="hologram-canvas" />;
}
