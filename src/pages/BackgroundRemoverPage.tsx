import {
  useEffect,
  useRef,
  useState
} from "react";

import type {
  ChangeEvent
} from "react";

import {
  downloadBlob,
  processImageLocally,
  readImagesFromDirectory,
  saveBlobToDirectory,
  supportsDirectoryAccess
} from "../services/localBackgroundRemoval";

import "./BackgroundRemoverPage.css";

interface ProcessingRecord {
  fileName: string;
  status: "success" | "failed";
  detail: string;
}

function readableStage(stage: string): string {
  if (stage.startsWith("fetch:")) {
    return "Downloading AI model";
  }

  if (stage.includes("decode")) {
    return "Reading image";
  }

  if (stage.includes("inference")) {
    return "Removing background";
  }

  if (stage.includes("mask")) {
    return "Preparing transparent edges";
  }

  if (stage.includes("encode")) {
    return "Creating PNG";
  }

  return "Processing image";
}

export default function BackgroundRemoverPage() {
  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  const cancelRequested = useRef(false);

  const originalPreviewRef =
    useRef<string | null>(null);

  const processedPreviewRef =
    useRef<string | null>(null);

  const directoryAccessAvailable =
    supportsDirectoryAccess();

  const [inputDirectory, setInputDirectory] =
    useState<FileSystemDirectoryHandle | null>(null);

  const [outputDirectory, setOutputDirectory] =
    useState<FileSystemDirectoryHandle | null>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [padding, setPadding] = useState(10);
  const [processing, setProcessing] =
    useState(false);
  const [currentFile, setCurrentFile] =
    useState("");
  const [currentIndex, setCurrentIndex] =
    useState(0);
  const [completedCount, setCompletedCount] =
    useState(0);
  const [failedCount, setFailedCount] =
    useState(0);
  const [modelProgress, setModelProgress] =
    useState(0);
  const [processingStage, setProcessingStage] =
    useState("Ready");
  const [records, setRecords] =
    useState<ProcessingRecord[]>([]);
  const [errorMessage, setErrorMessage] =
    useState("");
  const [successMessage, setSuccessMessage] =
    useState("");
  const [originalPreview, setOriginalPreview] =
    useState<string | null>(null);
  const [processedPreview, setProcessedPreview] =
    useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (originalPreviewRef.current) {
        URL.revokeObjectURL(
          originalPreviewRef.current
        );
      }

      if (processedPreviewRef.current) {
        URL.revokeObjectURL(
          processedPreviewRef.current
        );
      }
    };
  }, []);

  function replaceOriginalPreview(file: File) {
    if (originalPreviewRef.current) {
      URL.revokeObjectURL(
        originalPreviewRef.current
      );
    }

    const nextUrl = URL.createObjectURL(file);
    originalPreviewRef.current = nextUrl;
    setOriginalPreview(nextUrl);
  }

  function replaceProcessedPreview(blob: Blob) {
    if (processedPreviewRef.current) {
      URL.revokeObjectURL(
        processedPreviewRef.current
      );
    }

    const nextUrl = URL.createObjectURL(blob);
    processedPreviewRef.current = nextUrl;
    setProcessedPreview(nextUrl);
  }

  async function chooseInputFolder() {
    setErrorMessage("");
    setSuccessMessage("");

    if (!window.showDirectoryPicker) {
      fileInputRef.current?.click();
      return;
    }

    try {
      const directory =
        await window.showDirectoryPicker({
          id: "auction-bg-input",
          mode: "read",
          startIn: "pictures"
        });

      const selectedFiles =
        await readImagesFromDirectory(directory);

      setInputDirectory(directory);
      setFiles(selectedFiles);
      setRecords([]);

      if (selectedFiles[0]) {
        replaceOriginalPreview(selectedFiles[0]);
      }

      if (selectedFiles.length === 0) {
        setErrorMessage(
          "The selected folder does not contain JPG, PNG or WebP images."
        );
      }
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The input folder could not be opened."
      );
    }
  }

  async function chooseOutputFolder() {
    setErrorMessage("");
    setSuccessMessage("");

    if (!window.showDirectoryPicker) {
      setErrorMessage(
        "This browser cannot write to a selected folder. Processed files will use normal browser downloads instead."
      );
      return;
    }

    try {
      const directory =
        await window.showDirectoryPicker({
          id: "auction-bg-output",
          mode: "readwrite",
          startIn: "pictures"
        });

      setOutputDirectory(directory);
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The output folder could not be opened."
      );
    }
  }

  function handleFallbackFiles(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const selectedFiles = Array.from(
      event.target.files ?? []
    ).filter((file) =>
      ["image/jpeg", "image/png", "image/webp"]
        .includes(file.type)
    );

    setInputDirectory(null);
    setFiles(selectedFiles);
    setRecords([]);
    setErrorMessage("");

    if (selectedFiles[0]) {
      replaceOriginalPreview(selectedFiles[0]);
    }

    event.target.value = "";
  }

  async function processAllImages() {
    if (processing) {
      return;
    }

    if (files.length === 0) {
      setErrorMessage(
        "Select an input folder containing images first."
      );
      return;
    }

    if (
      directoryAccessAvailable &&
      !outputDirectory
    ) {
      setErrorMessage(
        "Select the output folder before starting."
      );
      return;
    }

    cancelRequested.current = false;
    setProcessing(true);
    setCompletedCount(0);
    setFailedCount(0);
    setCurrentIndex(0);
    setRecords([]);
    setErrorMessage("");
    setSuccessMessage("");
    setProcessingStage("Preparing AI model");

    let completed = 0;
    let failed = 0;

    for (
      let index = 0;
      index < files.length;
      index += 1
    ) {
      if (cancelRequested.current) {
        break;
      }

      const file = files[index];
      setCurrentFile(file.name);
      setCurrentIndex(index + 1);
      setModelProgress(0);
      replaceOriginalPreview(file);

      try {
        const result = await processImageLocally(
          file,
          padding,
          ({ stage, current, total }) => {
            setProcessingStage(readableStage(stage));

            setModelProgress(
              total > 0
                ? Math.min(
                    100,
                    Math.round((current / total) * 100)
                  )
                : 0
            );
          }
        );

        replaceProcessedPreview(result);

        let savedName = "";

        if (outputDirectory) {
          savedName = await saveBlobToDirectory(
            outputDirectory,
            file.name,
            result
          );
        } else {
          downloadBlob(file.name, result);
          savedName = "Downloaded by browser";
        }

        completed += 1;
        setCompletedCount(completed);
        setRecords((current) => [
          ...current,
          {
            fileName: file.name,
            status: "success",
            detail: savedName
          }
        ]);
      } catch (error) {
        failed += 1;
        setFailedCount(failed);
        setRecords((current) => [
          ...current,
          {
            fileName: file.name,
            status: "failed",
            detail:
              error instanceof Error
                ? error.message
                : "Processing failed"
          }
        ]);
      }
    }

    const cancelled = cancelRequested.current;

    setProcessing(false);
    setCurrentFile("");
    setModelProgress(0);
    setProcessingStage(
      cancelled ? "Cancelled" : "Completed"
    );

    if (cancelled) {
      setSuccessMessage(
        `Processing stopped. ${completed} image(s) were saved.`
      );
    } else {
      setSuccessMessage(
        `Finished: ${completed} saved, ${failed} failed.`
      );
    }
  }

  function cancelProcessing() {
    cancelRequested.current = true;
    setProcessingStage(
      "Stopping after the current image"
    );
  }

  const overallProgress =
    files.length > 0
      ? Math.round(
          ((completedCount + failedCount) /
            files.length) *
            100
        )
      : 0;

  return (
    <main className="background-remover-page">
      <header className="background-remover-header">
        <p className="page-label">
          LOCAL ADMIN TOOL
        </p>

        <h1>Background remover</h1>

        <p>
          Remove photo backgrounds inside this browser and
          save transparent PNG files directly to a folder on
          this computer. Images are never sent to Supabase.
        </p>
      </header>

      {!directoryAccessAvailable && (
        <div className="background-remover-warning">
          Folder writing is unavailable in this browser.
          Select individual files and the results will use
          normal browser downloads. For full folder support,
          use the latest Microsoft Edge or Google Chrome.
        </div>
      )}

      {errorMessage && (
        <div className="form-error">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="background-remover-success">
          {successMessage}
        </div>
      )}

      <section className="background-folder-panel">
        <article>
          <span>1</span>
          <div>
            <small>INPUT</small>
            <strong>
              {inputDirectory?.name ??
                (files.length > 0
                  ? `${files.length} selected files`
                  : "No folder selected")}
            </strong>
            <p>{files.length} supported image(s)</p>
          </div>
          <button
            type="button"
            disabled={processing}
            onClick={chooseInputFolder}
          >
            {directoryAccessAvailable
              ? "Choose input folder"
              : "Choose images"}
          </button>
        </article>

        <article>
          <span>2</span>
          <div>
            <small>OUTPUT</small>
            <strong>
              {outputDirectory?.name ??
                (directoryAccessAvailable
                  ? "No folder selected"
                  : "Browser downloads")}
            </strong>
            <p>Transparent PNG files</p>
          </div>
          <button
            type="button"
            disabled={
              processing ||
              !directoryAccessAvailable
            }
            onClick={chooseOutputFolder}
          >
            Choose output folder
          </button>
        </article>

        <input
          ref={fileInputRef}
          type="file"
          hidden
          multiple
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFallbackFiles}
        />
      </section>

      <section className="background-remover-workspace">
        <div className="background-remover-settings">
          <h2>Processing settings</h2>

          <label>
            Transparent padding
            <strong>{padding}%</strong>
            <input
              type="range"
              min="0"
              max="35"
              step="1"
              disabled={processing}
              value={padding}
              onChange={(event) =>
                setPadding(Number(event.target.value))
              }
            />
            <small>
              Adds clear space around the detected subject and
              centres it on a square canvas.
            </small>
          </label>

          <div className="background-remover-privacy">
            <strong>Local processing</strong>
            <p>
              The AI runs on this device. Only the AI model is
              downloaded; selected photos are not uploaded.
            </p>
          </div>

          <div className="background-remover-actions">
            {!processing ? (
              <button
                type="button"
                className="background-start-button"
                disabled={files.length === 0}
                onClick={processAllImages}
              >
                Remove backgrounds
              </button>
            ) : (
              <button
                type="button"
                className="background-cancel-button"
                onClick={cancelProcessing}
              >
                Stop after current image
              </button>
            )}
          </div>
        </div>

        <div className="background-preview-panel">
          <div className="background-preview-heading">
            <div>
              <h2>Latest preview</h2>
              <p>{currentFile || "Select images to begin"}</p>
            </div>
            <span>{processingStage}</span>
          </div>

          <div className="background-preview-grid">
            <article>
              <small>ORIGINAL</small>
              {originalPreview ? (
                <img
                  src={originalPreview}
                  alt="Original selected file"
                />
              ) : (
                <div>No image selected</div>
              )}
            </article>

            <article className="transparent-preview">
              <small>TRANSPARENT PNG</small>
              {processedPreview ? (
                <img
                  src={processedPreview}
                  alt="Processed transparent result"
                />
              ) : (
                <div>Result preview</div>
              )}
            </article>
          </div>
        </div>
      </section>

      <section className="background-progress-panel">
        <div className="background-progress-heading">
          <div>
            <h2>Batch progress</h2>
            <p>
              {currentIndex} of {files.length} images
            </p>
          </div>

          <div className="background-progress-stats">
            <span>{completedCount} saved</span>
            <span>{failedCount} failed</span>
          </div>
        </div>

        <div className="background-progress-track">
          <i style={{ width: `${overallProgress}%` }} />
        </div>

        {processing && (
          <div className="background-model-progress">
            <span>{processingStage}</span>
            <strong>{modelProgress}%</strong>
          </div>
        )}

        {records.length > 0 && (
          <div className="background-results-list">
            {records.map((record, index) => (
              <article
                key={`${record.fileName}-${index}`}
                className={
                  record.status === "success"
                    ? "background-result-success"
                    : "background-result-failed"
                }
              >
                <strong>{record.fileName}</strong>
                <span>{record.detail}</span>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}