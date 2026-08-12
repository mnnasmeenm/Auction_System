import {
  removeBackground
} from "@imgly/background-removal";

export const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp"
];

const SUPPORTED_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp"
];

// Keep slightly below 2 MB for safety.
const TARGET_OUTPUT_BYTES =
  1.9 * 1024 * 1024;

const MAX_OUTPUT_DIMENSION = 2200;
const MIN_OUTPUT_DIMENSION = 480;

export interface BackgroundRemovalProgress {
  stage: string;
  current: number;
  total: number;
}

export function supportsDirectoryAccess(): boolean {
  return (
    typeof window.showDirectoryPicker ===
    "function"
  );
}

export function isSupportedImage(
  file: File
): boolean {
  return (
    SUPPORTED_IMAGE_TYPES.includes(
      file.type
    ) ||
    SUPPORTED_EXTENSIONS.some(
      (extension) =>
        file.name
          .toLowerCase()
          .endsWith(extension)
    )
  );
}

export async function readImagesFromDirectory(
  directory: FileSystemDirectoryHandle
): Promise<File[]> {
  const files: File[] = [];

  for await (
    const [, handle] of
    directory.entries()
  ) {
    if (handle.kind !== "file") {
      continue;
    }

    const file =
      await handle.getFile();

    if (isSupportedImage(file)) {
      files.push(file);
    }
  }

  return files.sort(
    (first, second) =>
      first.name.localeCompare(
        second.name,
        undefined,
        {
          numeric: true
        }
      )
  );
}

function cleanFileName(
  fileName: string
): string {
  const lastDot =
    fileName.lastIndexOf(".");

  const baseName =
    lastDot > 0
      ? fileName.slice(0, lastDot)
      : fileName;

  const cleaned = baseName
    .trim()
    .replace(
      /[^a-zA-Z0-9._-]+/g,
      "-"
    )
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return (
    `${cleaned || "processed-image"}` +
    "_transparent.png"
  );
}

async function blobToCanvas(
  blob: Blob
): Promise<{
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
}> {
  const bitmap =
    await createImageBitmap(blob);

  const canvas =
    document.createElement("canvas");

  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const context = canvas.getContext(
    "2d",
    {
      willReadFrequently: true
    }
  );

  if (!context) {
    bitmap.close();

    throw new Error(
      "The browser could not prepare the image canvas."
    );
  }

  context.drawImage(
    bitmap,
    0,
    0
  );

  bitmap.close();

  return {
    canvas,
    context
  };
}

function canvasToPngBlob(
  canvas: HTMLCanvasElement
): Promise<Blob> {
  return new Promise<Blob>(
    (resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) {
            resolve(result);
          } else {
            reject(
              new Error(
                "The processed PNG could not be created."
              )
            );
          }
        },
        "image/png"
      );
    }
  );
}

function resizeCanvas(
  source: HTMLCanvasElement,
  size: number
): HTMLCanvasElement {
  const resized =
    document.createElement("canvas");

  resized.width = size;
  resized.height = size;

  const context = resized.getContext(
    "2d",
    {
      alpha: true
    }
  );

  if (!context) {
    throw new Error(
      "The browser could not resize the output image."
    );
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality =
    "high";

  context.clearRect(
    0,
    0,
    size,
    size
  );

  context.drawImage(
    source,
    0,
    0,
    size,
    size
  );

  return resized;
}

async function compressTransparentPng(
  source: HTMLCanvasElement
): Promise<Blob> {
  let workingCanvas = source;

  /*
   * Very large images are initially reduced
   * to prevent unnecessarily large PNG files.
   */
  if (
    workingCanvas.width >
    MAX_OUTPUT_DIMENSION
  ) {
    workingCanvas = resizeCanvas(
      workingCanvas,
      MAX_OUTPUT_DIMENSION
    );
  }

  let result =
    await canvasToPngBlob(
      workingCanvas
    );

  /*
   * PNG does not support normal quality-based
   * compression through canvas.toBlob().
   *
   * Therefore, reduce its dimensions gradually
   * until the transparent file is under 2 MB.
   */
  while (
    result.size >
      TARGET_OUTPUT_BYTES &&
    workingCanvas.width >
      MIN_OUTPUT_DIMENSION
  ) {
    const sizeRatio = Math.sqrt(
      TARGET_OUTPUT_BYTES /
        result.size
    );

    const nextSize = Math.max(
      MIN_OUTPUT_DIMENSION,
      Math.floor(
        workingCanvas.width *
          Math.min(
            0.9,
            sizeRatio * 0.96
          )
      )
    );

    if (
      nextSize >=
      workingCanvas.width
    ) {
      break;
    }

    workingCanvas = resizeCanvas(
      workingCanvas,
      nextSize
    );

    result =
      await canvasToPngBlob(
        workingCanvas
      );
  }

  return result;
}

async function centreOnTransparentCanvas(
  foreground: Blob,
  paddingPercent: number
): Promise<Blob> {
  const {
    canvas,
    context
  } = await blobToCanvas(
    foreground
  );

  const pixels =
    context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );

  let left = canvas.width;
  let top = canvas.height;
  let right = -1;
  let bottom = -1;

  for (
    let y = 0;
    y < canvas.height;
    y += 1
  ) {
    for (
      let x = 0;
      x < canvas.width;
      x += 1
    ) {
      const pixelIndex =
        (
          y * canvas.width +
          x
        ) * 4;

      const alpha =
        pixels.data[
          pixelIndex + 3
        ];

      /*
       * Ignore nearly invisible pixels.
       * This prevents transparent background
       * noise from affecting the crop.
       */
      if (alpha > 8) {
        left = Math.min(
          left,
          x
        );

        top = Math.min(
          top,
          y
        );

        right = Math.max(
          right,
          x
        );

        bottom = Math.max(
          bottom,
          y
        );
      }
    }
  }

  if (
    right < left ||
    bottom < top
  ) {
    throw new Error(
      "No visible person or foreground was detected."
    );
  }

  const subjectWidth =
    right - left + 1;

  const subjectHeight =
    bottom - top + 1;

  const longestSide = Math.max(
    subjectWidth,
    subjectHeight
  );

  const safePadding = Math.min(
    50,
    Math.max(
      0,
      paddingPercent
    )
  );

  const outputSize = Math.max(
    1,
    Math.ceil(
      longestSide *
        (
          1 +
          safePadding / 100
        )
    )
  );

  const outputCanvas =
    document.createElement(
      "canvas"
    );

  outputCanvas.width =
    outputSize;

  outputCanvas.height =
    outputSize;

  const outputContext =
    outputCanvas.getContext(
      "2d",
      {
        alpha: true
      }
    );

  if (!outputContext) {
    throw new Error(
      "The browser could not create the output image."
    );
  }

  outputContext.imageSmoothingEnabled =
    true;

  outputContext.imageSmoothingQuality =
    "high";

  outputContext.clearRect(
    0,
    0,
    outputSize,
    outputSize
  );

  const destinationX =
    Math.floor(
      (
        outputSize -
        subjectWidth
      ) / 2
    );

  const destinationY =
    Math.floor(
      (
        outputSize -
        subjectHeight
      ) / 2
    );

  outputContext.drawImage(
    canvas,
    left,
    top,
    subjectWidth,
    subjectHeight,
    destinationX,
    destinationY,
    subjectWidth,
    subjectHeight
  );

  return compressTransparentPng(
    outputCanvas
  );
}

export async function processImageLocally(
  file: File,
  paddingPercent: number,
  onProgress?: (
    progress:
      BackgroundRemovalProgress
  ) => void
): Promise<Blob> {
  const foreground =
    await removeBackground(
      file,
      {
        device: "cpu",

        /*
         * More accurate than isnet_quint8,
         * especially around hair, clothing
         * and softer edges.
         */
        model: "isnet_fp16",

        output: {
          format: "image/png",
          quality: 1
        },

        progress: (
          stage: string,
          current: number,
          total: number
        ) => {
          onProgress?.({
            stage,
            current,
            total
          });
        }
      }
    );

  return centreOnTransparentCanvas(
    foreground,
    paddingPercent
  );
}

export async function saveBlobToDirectory(
  directory:
    FileSystemDirectoryHandle,
  sourceFileName: string,
  blob: Blob
): Promise<string> {
  const outputName =
    cleanFileName(
      sourceFileName
    );

  const fileHandle =
    await directory.getFileHandle(
      outputName,
      {
        create: true
      }
    );

  const writable =
    await fileHandle.createWritable();

  await writable.write(blob);
  await writable.close();

  return outputName;
}

export function downloadBlob(
  sourceFileName: string,
  blob: Blob
): void {
  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;

  link.download =
    cleanFileName(
      sourceFileName
    );

  link.click();

  window.setTimeout(
    () => {
      URL.revokeObjectURL(url);
    },
    1000
  );
}