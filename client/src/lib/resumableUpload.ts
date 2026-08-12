import * as tus from "tus-js-client";
import { supabase, supabaseUrl } from "./supabase";

const CHUNK_SIZE = 5 * 1024 * 1024;
const RESUME_PREFIX = "beatbox:tus:";

export type ResumableUploadOptions = {
  bucket: string;
  objectPath: string;
  file: File;
  onProgress?: (percent: number, uploadedBytes: number, totalBytes: number) => void;
  signal?: AbortSignal;
};

function resumeKey(bucket: string, objectPath: string, file: File) {
  return `${RESUME_PREFIX}${bucket}:${objectPath}:${file.size}:${file.lastModified}`;
}

export async function uploadResumable({ bucket, objectPath, file, onProgress, signal }: ResumableUploadOptions) {
  if (!navigator.onLine) throw new Error("You are offline. Reconnect before uploading media.");
  if (!supabaseUrl) throw new Error("Supabase upload configuration is missing for this deployment.");

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Sign in again before uploading media.");

  const key = resumeKey(bucket, objectPath, file);
  const endpoint = `${supabaseUrl}/storage/v1/upload/resumable`;
  let upload: tus.Upload;

  const abortHandler = () => upload?.abort();
  signal?.addEventListener("abort", abortHandler, { once: true });

  await new Promise<void>((resolve, reject) => {
    upload = new tus.Upload(file, {
      endpoint,
      chunkSize: CHUNK_SIZE,
      retryDelays: [0, 1000, 3000, 5000, 10000],
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      storeFingerprintForResuming: true,
      metadata: {
        bucketName: bucket,
        objectName: objectPath,
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
      },
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        "x-upsert": "false",
      },
      onError: (uploadError) => reject(uploadError),
      onProgress: (uploadedBytes, totalBytes) => {
        onProgress?.(Math.round((uploadedBytes / totalBytes) * 100), uploadedBytes, totalBytes);
      },
      onSuccess: () => resolve(),
    });

    void upload.findPreviousUploads().then((previous) => {
      if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    }).catch(reject);
  }).finally(() => signal?.removeEventListener("abort", abortHandler));

  return { bucket, objectPath, resumed: true };
}

export function formatUploadSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function clearUploadResume(file: File, bucket: string, objectPath: string) {
  localStorage.removeItem(resumeKey(bucket, objectPath, file));
}
