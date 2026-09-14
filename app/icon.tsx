import { ImageResponse } from "next/og";

export const size = { height: 192, width: 192 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "linear-gradient(135deg, #171717 0%, #404040 100%)",
        borderRadius: 40,
        color: "#fafafa",
        display: "flex",
        fontFamily: "sans-serif",
        fontSize: 108,
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
