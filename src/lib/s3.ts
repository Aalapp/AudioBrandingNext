import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { prisma } from './db';

const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || 'audiobranding-files';
const S3_ENDPOINT = process.env.S3_ENDPOINT;
const S3_FORCE_PATH_STYLE = process.env.S3_FORCE_PATH_STYLE === 'true';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  ...(S3_ENDPOINT && {
    endpoint: S3_ENDPOINT,
    forcePathStyle: S3_FORCE_PATH_STYLE,
  }),
});

// Allowed MIME types for uploads
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'application/json',
];

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export interface PresignUploadOptions {
  projectId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface PresignDownloadOptions {
  fileId: string;
}

/**
 * Validate file upload request
 */
export function validateFileUpload(
  filename: string,
  mimeType: string,
  sizeBytes: number
): { valid: boolean; error?: string } {
  if (!filename || filename.trim().length === 0) {
    return { valid: false, error: 'Filename is required' };
  }

  if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType)) {
    return {
      valid: false,
      error: `MIME type ${mimeType} is not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
    };
  }

  if (sizeBytes > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  return { valid: true };
}

/**
 * Generate S3 key for a file
 */
export function generateS3Key(projectId: string, fileId: string, filename: string): string {
  // Sanitize filename
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `projects/${projectId}/files/${fileId}/${sanitized}`;
}

/**
 * Generate presigned URL for upload
 */
export async function generatePresignedUploadUrl(
  options: PresignUploadOptions,
  expiresIn: number = 900 // 15 minutes default
): Promise<{ s3Key: string; uploadUrl: string; expiresAt: Date }> {
  const { projectId, filename, mimeType, sizeBytes } = options;

  // Validate file
  const validation = validateFileUpload(filename, mimeType, sizeBytes);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Generate a temporary file ID for the presigned URL
  // The actual file ID will be created when the file is registered
  const tempFileId = `temp-${Date.now()}`;
  const s3Key = generateS3Key(projectId, tempFileId, filename);

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: s3Key,
    ContentType: mimeType,
    ContentLength: sizeBytes,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });

  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  return {
    s3Key,
    uploadUrl,
    expiresAt,
  };
}

/**
 * Generate presigned URL for download
 */
export async function generatePresignedDownloadUrl(
  s3Key: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<{ downloadUrl: string; expiresAt: Date }> {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: s3Key,
  });

  const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn });

  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  return {
    downloadUrl,
    expiresAt,
  };
}

/**
 * Verify file exists in S3
 */
export async function verifyFileExists(s3Key: string): Promise<boolean> {
  try {
    const command = new HeadObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: s3Key,
    });

    await s3Client.send(command);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Delete file from S3
 */
export async function deleteFileFromS3(s3Key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: s3Key,
  });

  await s3Client.send(command);
}

/**
 * Register uploaded file in database
 */
export async function registerFile(
  projectId: string,
  ownerId: string,
  s3Key: string,
  filename: string,
  mimeType: string,
  sizeBytes: bigint,
  metadata?: Record<string, any>
) {
  // Verify file exists in S3
  const exists = await verifyFileExists(s3Key);
  if (!exists) {
    throw new Error('File not found in S3');
  }

  // Verify project ownership
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ownerId,
      deleted: false,
    },
  });

  if (!project) {
    throw new Error('Project not found or access denied');
  }

  // Create file record
  const file = await prisma.file.create({
    data: {
      ownerId,
      projectId,
      s3Key,
      filename,
      mimeType,
      sizeBytes,
      metadata: metadata ?? undefined,
    },
    include: {
      owner: {
        select: {
          id: true,
          hashid: true,
          email: true,
          name: true,
        },
      },
      project: {
        select: {
          id: true,
          hashid: true,
          brandName: true,
        },
      },
    },
  });

  return file;
}

/**
 * Get file by ID with ownership check
 */
export async function getFileById(fileId: string, userId: string) {
  return prisma.file.findFirst({
    where: {
      id: fileId,
      ownerId: userId,
      deleted: false,
    },
    include: {
      owner: {
        select: {
          id: true,
          hashid: true,
          email: true,
          name: true,
        },
      },
      project: {
        select: {
          id: true,
          hashid: true,
          brandName: true,
        },
      },
    },
  });
}

/**
 * Soft delete a file
 */
export async function deleteFile(fileId: string, userId: string) {
  const file = await prisma.file.findFirst({
    where: {
      id: fileId,
      ownerId: userId,
      deleted: false,
    },
  });

  if (!file) {
    throw new Error('File not found or access denied');
  }

  // Soft delete in database
  await prisma.file.update({
    where: { id: fileId },
    data: { deleted: true },
  });

  // Optionally delete from S3 (or keep for audit)
  // await deleteFileFromS3(file.s3Key);

  return { success: true };
}

