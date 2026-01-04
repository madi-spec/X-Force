import { createClient } from '@/lib/supabase/client';
import { createAdminClient } from '@/lib/supabase/admin';

const BUCKET_NAME = 'collateral';

/**
 * Upload a file to Supabase Storage
 */
export async function uploadCollateralFile(
  file: File,
  userId: string
): Promise<{ path: string; error: Error | null }> {
  const supabase = createClient();

  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    return { path: '', error: new Error(error.message) };
  }

  return { path: data.path, error: null };
}

/**
 * Upload a file to Supabase Storage (server-side with admin client)
 */
export async function uploadCollateralFileServer(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
  userId: string
): Promise<{ path: string; error: Error | null }> {
  const supabase = createAdminClient();

  const fileExt = fileName.split('.').pop();
  const storagePath = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, fileBuffer, {
      contentType,
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    return { path: '', error: new Error(error.message) };
  }

  return { path: data.path, error: null };
}

/**
 * Get a signed URL for a private file
 */
export async function getCollateralFileUrl(path: string): Promise<string> {
  const supabase = createClient();

  const { data } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, 3600); // 1 hour expiry

  return data?.signedUrl || '';
}

/**
 * Get a signed URL for a private file (server-side)
 */
export async function getCollateralFileUrlServer(path: string): Promise<string> {
  const supabase = createAdminClient();

  const { data } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, 3600); // 1 hour expiry

  return data?.signedUrl || '';
}

/**
 * Delete a file from storage
 */
export async function deleteCollateralFile(path: string): Promise<void> {
  const supabase = createClient();

  await supabase.storage.from(BUCKET_NAME).remove([path]);
}

/**
 * Delete a file from storage (server-side)
 */
export async function deleteCollateralFileServer(path: string): Promise<void> {
  const supabase = createAdminClient();

  await supabase.storage.from(BUCKET_NAME).remove([path]);
}

/**
 * Get file type category from MIME type or extension
 */
export function getFileTypeFromMime(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'text/html': 'html',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'video/mp4': 'mp4',
  };

  return mimeMap[mimeType] || 'other';
}

/**
 * Check if file type is allowed
 */
export function isAllowedFileType(mimeType: string): boolean {
  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/html',
    'image/png',
    'image/jpeg',
  ];

  return allowedTypes.includes(mimeType);
}

/**
 * Max file size in bytes (25MB)
 */
export const MAX_FILE_SIZE = 26214400;
