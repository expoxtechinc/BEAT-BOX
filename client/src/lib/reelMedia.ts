export type ReelMediaProgress = {
  stage: "thumbnail" | "compressing";
  percent: number;
};

export type PreparedReelMedia = {
  video: File;
  thumbnail: File;
  compressed: boolean;
  durationSeconds: number | null;
};

function waitForVideoEvent(video: HTMLVideoElement, eventName: "loadedmetadata" | "loadeddata" | "ended") {
  return new Promise<void>((resolve, reject) => {
    const onResolve = () => {
      cleanup();
      resolve();
    };
    const onReject = () => {
      cleanup();
      reject(new Error("The browser could not read this video."));
    };
    const cleanup = () => {
      video.removeEventListener(eventName, onResolve);
      video.removeEventListener("error", onReject);
    };
    video.addEventListener(eventName, onResolve, { once: true });
    video.addEventListener("error", onReject, { once: true });
  });
}

function chooseRecordingMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  return ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
    .find(type => MediaRecorder.isTypeSupported(type)) ?? null;
}

async function createThumbnail(video: HTMLVideoElement, sourceName: string): Promise<File> {
  await waitForVideoEvent(video, "loadeddata");
  const maxWidth = 720;
  const scale = Math.min(1, maxWidth / Math.max(video.videoWidth, 1));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser cannot create a Reel thumbnail.");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.84));
  if (!blob) throw new Error("The browser could not create a Reel thumbnail.");
  const baseName = sourceName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9._-]/g, "-");
  return new File([blob], `${baseName}-thumbnail.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}

async function compressVideo(video: HTMLVideoElement, source: File, onProgress?: (progress: ReelMediaProgress) => void) {
  const mimeType = chooseRecordingMimeType();
  const captureStream = (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream;
  if (!mimeType || typeof captureStream !== "function") return { file: source, compressed: false };
  const stream = captureStream.call(video);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = event => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  const recordingComplete = new Promise<void>((resolve, reject) => {
    recorder.addEventListener("stop", () => resolve(), { once: true });
    recorder.addEventListener("error", () => reject(new Error("Video compression failed; the original video will be used.")), { once: true });
  });
  video.currentTime = 0;
  video.muted = true;
  await video.play();
  recorder.start(250);
  const startedAt = performance.now();
  await waitForVideoEvent(video, "ended");
  recorder.stop();
  await recordingComplete;
  stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
  const blob = new Blob(chunks, { type: mimeType });
  if (blob.size >= source.size || blob.size === 0) return { file: source, compressed: false };
  onProgress?.({ stage: "compressing", percent: 100 });
  const baseName = source.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9._-]/g, "-");
  return { file: new File([blob], `${baseName}.webm`, { type: mimeType, lastModified: Date.now() }), compressed: true };
}

export async function prepareReelMedia(source: File, onProgress?: (progress: ReelMediaProgress) => void): Promise<PreparedReelMedia> {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    throw new Error("Reel preparation is available in a browser only.");
  }
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  const objectUrl = URL.createObjectURL(source);
  video.src = objectUrl;
  try {
    await waitForVideoEvent(video, "loadedmetadata");
    onProgress?.({ stage: "thumbnail", percent: 20 });
    const thumbnail = await createThumbnail(video, source.name);
    onProgress?.({ stage: "thumbnail", percent: 40 });
    const compressedResult = await compressVideo(video, source, onProgress);
    onProgress?.({ stage: "compressing", percent: 100 });
    return {
      video: compressedResult.file,
      thumbnail,
      compressed: compressedResult.compressed,
      durationSeconds: Number.isFinite(video.duration) ? Math.round(video.duration * 100) / 100 : null,
    };
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}
