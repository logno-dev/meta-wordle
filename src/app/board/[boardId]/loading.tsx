import type { CSSProperties } from "react";

export default function Loading() {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#efe7dc]">
      <div className="absolute inset-0">
        <div
          className="board-plane absolute rounded-[48px] border border-black/10"
          style={{
            width: 4200,
            height: 4200,
            transform: "translate(-2100px, -2100px)",
            left: "50%",
            top: "50%",
            transformOrigin: "center center",
            "--board-grid-size": "56px",
          } as CSSProperties}
        />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded-full border border-black/10 bg-white/85 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#6b4b3d] shadow-lg shadow-black/5">
          Loading
        </div>
      </div>
    </div>
  );
}
