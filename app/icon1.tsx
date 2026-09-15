import { ImageResponse } from "next/og";

export const size = { height: 512, width: 512 };
export const contentType = "image/png";

export default function Icon512() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "linear-gradient(135deg, #171717 0%, #404040 100%)",
        borderRadius: 100,
        color: "#fafafa",
        display: "flex",
        fontFamily: "sans-serif",
        fontSize: 288,
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
