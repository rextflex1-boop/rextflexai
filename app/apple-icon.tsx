import { ImageResponse } from "next/og";

export const size = { height: 180, width: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "linear-gradient(135deg, #171717 0%, #404040 100%)",
        color: "#fafafa",
        display: "flex",
        fontFamily: "sans-serif",
        fontSize: 100,
        fontWeight: 700,
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      R
    </div>,
    { ...size },
  );
}
