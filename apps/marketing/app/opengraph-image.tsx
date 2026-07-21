import { ImageResponse } from "next/og";

export const alt = "Careerden — Job application tracker and CV creator";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#f7f7f7",
        color: "#191919",
        padding: "68px",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          fontSize: "28px",
          fontWeight: 700,
        }}
      >
        <svg aria-hidden="true" height="42" viewBox="0 0 322 226" width="60">
          <path
            d="M160 45 121 84c-4 4-4 7 0 11l15 15c4 4 7 4 11 0l25-25c2-2 5-2 8 1l64 65-55 55c-16 16-44 16-60 0L10 85l63-65c17-17 43-17 63 1Z"
            fill="#191919"
          />
          <path d="m160 45 27-27c12-12 42-12 57 0l67 67-56 55Z" fill="#191919" />
        </svg>
        Careerden
      </div>
      <div style={{ display: "flex", flexDirection: "column", maxWidth: "900px" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: "75px",
            fontWeight: 700,
            lineHeight: 1.02,
            letterSpacing: "-4px",
          }}
        >
          <span>Every application.</span>
          <span>One clear workspace.</span>
        </div>
        <div style={{ marginTop: "28px", color: "#686868", fontSize: "25px" }}>
          Open-source job application tracker, CV creator, and cover letter creator.
        </div>
      </div>
      <div style={{ display: "flex", gap: "12px", color: "#777", fontSize: "18px" }}>
        <span>Track applications</span>
        <span>·</span>
        <span>Create tailored documents</span>
        <span>·</span>
        <span>Review every draft</span>
      </div>
    </div>,
    size,
  );
}
