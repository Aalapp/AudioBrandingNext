import {
  validateFileUpload,
  generateS3Key,
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
} from '@/lib/s3';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://presigned-url.example.com'),
}));

describe('S3 Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.S3_BUCKET_NAME = 'test-bucket';
    process.env.AWS_ACCESS_KEY_ID = 'test-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
  });

  describe('validateFileUpload', () => {
    it('should validate a valid file upload', () => {
      const result = validateFileUpload('test.jpg', 'image/jpeg', 1024 * 1024);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid MIME type', () => {
      const result = validateFileUpload('test.exe', 'application/x-msdownload', 1024);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('MIME type');
    });

    it('should reject file that is too large', () => {
      const result = validateFileUpload('test.jpg', 'image/jpeg', 11 * 1024 * 1024);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File size exceeds');
    });

    it('should reject empty filename', () => {
      const result = validateFileUpload('', 'image/jpeg', 1024);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Filename is required');
    });
  });

  describe('generateS3Key', () => {
    it('should generate correct S3 key', () => {
      const key = generateS3Key('project-1', 'file-1', 'test file.jpg');
      expect(key).toBe('projects/project-1/files/file-1/test_file.jpg');
    });

    it('should sanitize filename', () => {
      const key = generateS3Key('project-1', 'file-1', 'test@file#name$.jpg');
      expect(key).toBe('projects/project-1/files/file-1/test_file_name_.jpg');
    });
  });

  describe('generatePresignedUploadUrl', () => {
    it('should generate presigned upload URL', async () => {
      const result = await generatePresignedUploadUrl({
        projectId: 'project-1',
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
      });

      expect(result).toHaveProperty('s3Key');
      expect(result).toHaveProperty('uploadUrl');
      expect(result).toHaveProperty('expiresAt');
      expect(result.uploadUrl).toBe('https://presigned-url.example.com');
    });

    it('should throw error for invalid file', async () => {
      await expect(
        generatePresignedUploadUrl({
          projectId: 'project-1',
          filename: 'test.exe',
          mimeType: 'application/x-msdownload',
          sizeBytes: 1024,
        })
      ).rejects.toThrow();
    });
  });

  describe('generatePresignedDownloadUrl', () => {
    it('should generate presigned download URL', async () => {
      const result = await generatePresignedDownloadUrl('projects/project-1/files/file-1/test.jpg');

      expect(result).toHaveProperty('downloadUrl');
      expect(result).toHaveProperty('expiresAt');
      expect(result.downloadUrl).toBe('https://presigned-url.example.com');
    });
  });
});

