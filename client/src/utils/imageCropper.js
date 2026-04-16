const PASSPORT_WIDTH_PX = 413;
const PASSPORT_HEIGHT_PX = 531;

export const PASSPORT_ASPECT_RATIO = PASSPORT_WIDTH_PX / PASSPORT_HEIGHT_PX;

function loadImage(imageSrc) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read selected image"));
    image.src = imageSrc;
  });
}

function canvasToPassportFile(canvas, sourceFileName) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to generate cropped image"));
          return;
        }

        const baseName = (sourceFileName || "profile-image").replace(
          /\.[^/.]+$/,
          "",
        );

        resolve(
          new File([blob], `${baseName}-passport.jpg`, {
            type: "image/jpeg",
          }),
        );
      },
      "image/jpeg",
      0.95,
    );
  });
}

async function cropImageToPassportSize(
  imageSrc,
  croppedAreaPixels,
  sourceFileName,
) {
  if (!imageSrc || !croppedAreaPixels) {
    throw new Error("Missing crop data");
  }

  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = PASSPORT_WIDTH_PX;
  canvas.height = PASSPORT_HEIGHT_PX;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to process image");
  }

  const { x, y, width, height } = croppedAreaPixels;
  context.drawImage(
    image,
    x,
    y,
    width,
    height,
    0,
    0,
    PASSPORT_WIDTH_PX,
    PASSPORT_HEIGHT_PX,
  );

  return canvasToPassportFile(canvas, sourceFileName);
}

export default cropImageToPassportSize;
