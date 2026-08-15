import { supabase } from "@/integrations/supabase/client";

/**
 * Buckets the website may use for profile pictures. We try them in order and
 * keep the first one that accepts the upload, so the app stays in sync with
 * whatever bucket already holds the website's avatars.
 */
const AVATAR_BUCKETS = ["avatars", "profile-images", "profile_images", "profiles", "images"];

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/**
 * Uploads a profile photo and returns a URL that can be rendered directly.
 * Public buckets return the public URL; private buckets fall back to a
 * long-lived signed URL.
 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file");
  if (file.size > MAX_AVATAR_BYTES) throw new Error("Image must be smaller than 5 MB");

  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  let lastError = "Upload failed";

  for (const bucket of AVATAR_BUCKETS) {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
    if (error) {
      lastError = error.message;
      continue;
    }
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
    const publicUrl = pub?.publicUrl;
    if (publicUrl) {
      const ok = await fetch(publicUrl, { method: "HEAD" })
        .then((r) => r.ok)
        .catch(() => false);
      if (ok) return publicUrl;
    }
    const { data: signed } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    if (signed?.signedUrl) return signed.signedUrl;
  }

  throw new Error(lastError);
}
