// Read the text inside a QR code image, in the browser. The image never leaves the device; the
// QR reader (jsqr) is loaded only when a school actually picks an image.

const SIDES = [1600, 800]; // a big phone photo of a printed QR often reads better scaled down

const loadImage = async (file) => {
  if (typeof createImageBitmap === "function") return createImageBitmap(file);
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  await image.decode();
  image.revokeUrl = () => URL.revokeObjectURL(url);
  return image;
};

/** @returns {Promise<string|null>} the QR's text, or null when no QR could be read */
export const readQrCode = async (file) => {
  const [{ default: jsQR }, image] = await Promise.all([import("jsqr"), loadImage(file)]);
  try {
    const longest = Math.max(image.width, image.height);
    for (const side of SIDES) {
      const scale = Math.min(1, side / longest);
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      // White first, so a QR saved on a transparent background still reads.
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      const code = jsQR(context.getImageData(0, 0, width, height).data, width, height, { inversionAttempts: "attemptBoth" });
      if (code?.data) return code.data;
      if (scale === 1) break; // already at full size: a smaller pass would read the same pixels
    }
    return null;
  } finally {
    image.close?.();
    image.revokeUrl?.();
  }
};
