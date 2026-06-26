export type AvatarCropState = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export const DEFAULT_AVATAR_CROP: AvatarCropState = {
  scale: 1,
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

export function deriveBannerColorFromCanvas(canvas: HTMLCanvasElement): string {
  const sample = document.createElement("canvas");
  const size = 32;
  sample.width = size;
  sample.height = size;
  const ctx = sample.getContext("2d");
  if (!ctx) return "#B9BBBE";

  ctx.drawImage(canvas, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3] ?? 0;
    if (alpha < 128) continue;
    red += data[index] ?? 0;
    green += data[index + 1] ?? 0;
    blue += data[index + 2] ?? 0;
    count++;
  }

  if (count === 0) return "#B9BBBE";

  const mix = (channel: number) => {
    const average = channel / count;
    return Math.max(0, Math.min(255, Math.round(average * 0.72)));
  };

  const toHex = (value: number) => value.toString(16).padStart(2, "0");
  return `#${toHex(mix(red))}${toHex(mix(green))}${toHex(mix(blue))}`;
}

export async function deriveBannerColorFromFile(file: File): Promise<string> {
  const image = await loadImageFromFile(file);
  const canvas = renderCroppedSquareAvatar(image, DEFAULT_AVATAR_CROP);
  return deriveBannerColorFromCanvas(canvas);
}
