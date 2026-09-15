"use client";

import { merchantFetch } from "./session";

/**
 * Shrinks photos on the phone before upload: max 1280px, WebP.
 * A 4 MB camera photo typically becomes ~150 KB, which matters on slow connections.
 */
export async function compressImage(file: File, maxSide = 1280, quality = 0.82): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  return blob && blob.size < file.size ? blob : file;
}

export async function uploadImage(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) {
    throw new Error("اختر صورة بصيغة JPG أو PNG أو WEBP");
  }
  const blob = await compressImage(file);
  const form = new FormData();
  const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
  form.append("file", blob, `photo.${ext}`);
  const { url } = await merchantFetch<{ url: string }>("/merchant/media", { method: "POST", body: form });
  return url;
}
