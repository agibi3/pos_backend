import React, { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

/** Renders `value` (the receipt ID) as a CODE128 barcode, straight to an
 * inline SVG — SVG prints crisply at any resolution, unlike a <canvas>
 * bitmap, which matters on thermal/receipt printers. */
export default function Barcode({ value, height = 38, barWidth = 1.4 }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    try {
      JsBarcode(svgRef.current, String(value), {
        format: "CODE128",
        height,
        width: barWidth,
        margin: 0,
        displayValue: false,
        background: "transparent",
      });
    } catch (e) {
      // A receipt ID with characters CODE128 can't encode shouldn't take
      // down the whole receipt render — just skip the barcode.
      console.error("Barcode render failed:", e);
    }
  }, [value, height, barWidth]);

  if (!value) return null;
  return <svg ref={svgRef} style={{ display: "block", margin: "6px auto 0" }} />;
}
