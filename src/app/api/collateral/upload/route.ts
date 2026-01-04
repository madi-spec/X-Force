import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadCollateralFileServer, getFileTypeFromMime, isAllowedFileType, MAX_FILE_SIZE } from '@/lib/collateral/storage';

/**
 * POST /api/collateral/upload
 *
 * Upload a file to collateral storage
 * Expects multipart/form-data with:
 * - file: the file to upload
 *
 * Returns:
 * - file_path: storage path
 * - file_name: original file name
 * - file_type: detected file type
 * - file_size: size in bytes
 */
export async function POST(request: NextRequest) {
  const authSupabase = await createClient();

  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!isAllowedFileType(file.type)) {
      return NextResponse.json({
        error: 'File type not allowed. Allowed types: PDF, DOCX, PPTX, XLSX, HTML, PNG, JPEG',
      }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      }, { status: 400 });
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to storage
    const { path, error } = await uploadCollateralFileServer(
      buffer,
      file.name,
      file.type,
      user.id
    );

    if (error) {
      console.error('Error uploading file:', error);
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }

    return NextResponse.json({
      file_path: path,
      file_name: file.name,
      file_type: getFileTypeFromMime(file.type),
      file_size: file.size,
    });
  } catch (err) {
    console.error('Error processing upload:', err);
    return NextResponse.json({ error: 'Failed to process upload' }, { status: 500 });
  }
}
