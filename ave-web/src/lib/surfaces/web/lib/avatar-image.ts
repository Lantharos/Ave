export type AvatarCropState = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export const MIN_AVATAR_CROP_SCALE = 1;
export const MAX_AVATAR_CROP_SCALE = 3;

function clampAvatarCropScale(scale: number): number {
  return Math.min(MAX_AVATAR_CROP_SCALE, Math.max(MIN_AVATAR_CROP_SCALE, scale));
}

export function clampAvatarCrop(
  image: HTMLImageElement,
  viewportSize: number,
  state: AvatarCropState,
): AvatarCropState {
  const scale = clampAvatarCropScale(state.scale);
  const normalized = { ...state, scale };
  const { drawWidth, drawHeight } = computeAvatarDrawParams(image, viewportSize, normalized);
  const maxOffsetX = Math.max(0, (drawWidth - viewportSize) / 2);
  const maxOffsetY = Math.max(0, (drawHeight - viewportSize) / 2);

  return {
    scale,
    offsetX: Math.min(maxOffsetX, Math.max(-maxOffsetX, normalized.offsetX)),
    offsetY: Math.min(maxOffsetY, Math.max(-maxOffsetY, normalized.offsetY)),
  };
}

export function zoomPercentForScale(scale: number): number {
  const clamped = clampAvatarCropScale(scale);
  return ((clamped - MIN_AVATAR_CROP_SCALE) / (MAX_AVATAR_CROP_SCALE - MIN_AVATAR_CROP_SCALE)) * 100;
}

export function scaleForZoomPercent(percent: number): number {
  const normalized = Math.min(100, Math.max(0, percent));
  return MIN_AVATAR_CROP_SCALE + (normalized / 100) * (MAX_AVATAR_CROP_SCALE - MIN_AVATAR_CROP_SCALE);
}

export const DEFAULT_AVATAR_CROP: AvatarCropState = {
  scale: MIN_AVATAR_CROP_SCALE,
  offsetX: 0,
  offsetY: 0,
};

export async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not load image"));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function computeAvatarDrawParams(
  image: HTMLImageElement,
  viewportSize: number,
  state: AvatarCropState,
) {
  const coverScale = Math.max(
    viewportSize / image.naturalWidth,
    viewportSize / image.naturalHeight,
  );
  const drawScale = coverScale * state.scale;
  const drawWidth = image.naturalWidth * drawScale;
  const drawHeight = image.naturalHeight * drawScale;
  const x = (viewportSize - drawWidth) / 2 + state.offsetX;
  const y = (viewportSize - drawHeight) / 2 + state.offsetY;
  return { x, y, drawWidth, drawHeight };
}

export function renderCroppedSquareAvatar(
  image: HTMLImageElement,
  state: AvatarCropState,
  viewportSize = 320,
  outputSize = 512,
): HTMLCanvasElement {
  const { x, y, drawWidth, drawHeight } = computeAvatarDrawParams(image, viewportSize, state);
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas");

  const ratio = outputSize / viewportSize;
  ctx.drawImage(
    image,
    x * ratio,
    y * ratio,
    drawWidth * ratio,
    drawHeight * ratio,
  );
  return canvas;
}

export async function canvasToJpegFile(
  canvas: HTMLCanvasElement,
  fileName = "avatar.jpg",
  quality = 0.92,
): Promise<File> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("Could not encode image"))),
      "image/jpeg",
      quality,
    );
  });
  return new File([blob], fileName, { type: "image/jpeg" });
}
