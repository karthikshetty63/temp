import { useEffect, useState } from "react";

/**
 * Draws a UPI QR from its link — the app's own copy of the school's QR, so what people scan is exactly
 * the link that was checked (shared/upiQrRules.js). The QR library loads only when one is shown.
 */
const UpiQrCode = ({ link, label, size = 176 }) => {
  const [drawn, setDrawn] = useState({ link: null, src: null, failed: false });

  useEffect(() => {
    let current = true;
    import("qrcode")
      .then(({ default: QRCode }) => QRCode.toDataURL(link, { width: size * 2, margin: 1, errorCorrectionLevel: "M" }))
      .then((src) => current && setDrawn({ link, src, failed: false }))
      .catch(() => current && setDrawn({ link, src: null, failed: true }));
    return () => {
      current = false;
    };
  }, [link, size]);

  const ready = drawn.link === link;
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-xl bg-white p-2 ring-1 ring-inset ring-slate-200" style={{ width: size + 16, height: size + 16 }}>
      {ready && drawn.src ? (
        <img src={drawn.src} width={size} height={size} alt={label} />
      ) : (
        <span role={ready ? "img" : "status"} aria-label={ready ? `${label} (couldn't be drawn)` : "Drawing the QR code…"} className="text-center text-xs text-slate-500">
          {ready && drawn.failed ? "QR couldn't be drawn" : "Loading QR…"}
        </span>
      )}
    </span>
  );
};

export default UpiQrCode;
