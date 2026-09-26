/**
 * Browser-side image compression utility.
 * Optimizes mobile camera photos (which can be 5MB - 15MB) into lightweight JPEGs (~80KB - 150KB)
 * so they upload instantly over cellular networks and stay well below Firestore's 1MB document limit.
 */
export async function compressImageFile(
  file: File | Blob,
  maxWidth = 900,
  maxHeight = 900,
  quality = 0.65
): Promise<string> {
  return new Promise((resolve, reject) => {
    // If not in a browser environment, return empty string
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return resolve('');
    }

    const reader = new FileReader();
    reader.onerror = (err) => reject(err);
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onerror = () => {
        // If image fails to load in canvas, fallback to raw reader output safely
        resolve(dataUrl);
      };
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxWidth || height > maxHeight) {
            if (width / maxWidth > height / maxHeight) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(width, 1);
          canvas.height = Math.max(height, 1);
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            resolve(dataUrl);
            return;
          }

          // Fill white background for transparent PNGs converted to JPEG
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          let compressed = canvas.toDataURL('image/jpeg', quality);

          // If still larger than 250KB base64 (~180KB binary), re-compress to lower quality
          if (compressed.length > 250_000) {
            compressed = canvas.toDataURL('image/jpeg', 0.45);
          }

          resolve(compressed);
        } catch (e) {
          console.warn('[Image Compression] Fallback to original image:', e);
          resolve(dataUrl);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
