import { POST as presignPOST } from '@/app/api/files/presign/route';
import { POST as registerPOST } from '@/app/api/files/register/route';
import { GET as downloadGET } from '@/app/api/files/[id]/presign-download/route';
import { DELETE } from '@/app/api/files/[id]/route';
import { jsonRequest, mockUser } from './test-helpers';
import * as authLib from '@/lib/auth';
import * as s3Lib from '@/lib/s3';
import * as projectsLib from '@/lib/projects';

// Mock libraries
jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
}));

jest.mock('@/lib/s3', () => ({
  generatePresignedUploadUrl: jest.fn(),
  registerFile: jest.fn(),
  getFileById: jest.fn(),
  generatePresignedDownloadUrl: jest.fn(),
  deleteFile: jest.fn(),
}));

jest.mock('@/lib/projects', () => ({
  verifyProjectOwnership: jest.fn(),
}));

describe('Files API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (authLib.requireAuth as jest.Mock).mockResolvedValue(mockUser);
  });

  describe('POST /api/files/presign', () => {
    it('generates presigned upload URL', async () => {
      (projectsLib.verifyProjectOwnership as jest.Mock).mockResolvedValue(true);
      (s3Lib.generatePresignedUploadUrl as jest.Mock).mockResolvedValue({
        s3Key: 'projects/00000000-0000-0000-0000-000000000001/files/file-1/test.jpg',
        uploadUrl: 'https://presigned-url.example.com',
        expiresAt: new Date(),
      });

      const request = jsonRequest('/api/files/presign', 'POST', {
        projectId: '00000000-0000-0000-0000-000000000001',
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
      });

      const response = await presignPOST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.uploadUrl).toBe('https://presigned-url.example.com');
      expect(s3Lib.generatePresignedUploadUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: '00000000-0000-0000-0000-000000000001',
          filename: 'test.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 1024,
        })
      );
    });

    it('returns 404 if project not found', async () => {
      (projectsLib.verifyProjectOwnership as jest.Mock).mockResolvedValue(false);

      const request = jsonRequest('/api/files/presign', 'POST', {
        projectId: '00000000-0000-0000-0000-000000000001',
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
      });

      const response = await presignPOST(request);

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({
        error: 'Project not found or access denied',
      });
    });

    it('returns 400 for invalid file size', async () => {
      const request = jsonRequest('/api/files/presign', 'POST', {
        projectId: '00000000-0000-0000-0000-000000000001',
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 11 * 1024 * 1024, // Exceeds 10MB limit
      });

      const response = await presignPOST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation error');
    });

    it('returns 400 for missing required fields', async () => {
      const request = jsonRequest('/api/files/presign', 'POST', {
        filename: 'test.jpg',
        // Missing projectId, mimeType, sizeBytes
      });

      const response = await presignPOST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation error');
    });

    it('returns 401 when auth fails', async () => {
      (authLib.requireAuth as jest.Mock).mockRejectedValue(new Error('Unauthorized'));

      const request = jsonRequest('/api/files/presign', 'POST', {
        projectId: '00000000-0000-0000-0000-000000000001',
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
      });

      const response = await presignPOST(request);

      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ error: 'Unauthorized' });
    });
  });

  describe('POST /api/files/register', () => {
    it('registers uploaded file', async () => {
      // Mock file - Prisma returns BigInt but NextResponse.json can't serialize it
      // So we'll mock registerFile to return a serializable object
      const mockFile = {
        id: 'file-1',
        s3Key: 'projects/00000000-0000-0000-0000-000000000001/files/file-1/test.jpg',
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: BigInt(1024), // This is what Prisma returns
        ownerId: 'user-1',
        projectId: '00000000-0000-0000-0000-000000000001',
      };

      (s3Lib.registerFile as jest.Mock).mockResolvedValue(mockFile);
      
      // Intercept NextResponse.json to handle BigInt serialization
      const { NextResponse } = await import('next/server');
      const originalJson = NextResponse.json;
      const jsonSpy = jest.spyOn(NextResponse, 'json').mockImplementation((data: any, init?: any) => {
        // Convert BigInt to string for JSON serialization
        if (data && typeof data === 'object' && 'sizeBytes' in data && typeof data.sizeBytes === 'bigint') {
          return originalJson({ ...data, sizeBytes: data.sizeBytes.toString() }, init);
        }
        return originalJson(data, init);
      });

      const request = jsonRequest('/api/files/register', 'POST', {
        projectId: '00000000-0000-0000-0000-000000000001',
        s3Key: 'projects/00000000-0000-0000-0000-000000000001/files/file-1/test.jpg',
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
      });

      const response = await registerPOST(request);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.id).toBe('file-1');
      expect(s3Lib.registerFile).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000001',
        mockUser.id,
        'projects/00000000-0000-0000-0000-000000000001/files/file-1/test.jpg',
        'test.jpg',
        'image/jpeg',
        BigInt(1024),
        undefined
      );
      
      jsonSpy.mockRestore();
    });

    it('registers file with metadata', async () => {
      const mockFile = {
        id: 'file-1',
        s3Key: 'projects/00000000-0000-0000-0000-000000000001/files/file-1/test.jpg',
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: BigInt(1024),
        ownerId: 'user-1',
        projectId: '00000000-0000-0000-0000-000000000001',
      };

      (s3Lib.registerFile as jest.Mock).mockResolvedValue(mockFile);
      
      // Intercept NextResponse.json to handle BigInt serialization
      const { NextResponse } = await import('next/server');
      const originalJson = NextResponse.json;
      const jsonSpy = jest.spyOn(NextResponse, 'json').mockImplementation((data: any, init?: any) => {
        // Convert BigInt to string for JSON serialization
        if (data && typeof data === 'object' && 'sizeBytes' in data && typeof data.sizeBytes === 'bigint') {
          return originalJson({ ...data, sizeBytes: data.sizeBytes.toString() }, init);
        }
        return originalJson(data, init);
      });

      const request = jsonRequest('/api/files/register', 'POST', {
        projectId: '00000000-0000-0000-0000-000000000001',
        s3Key: 'projects/00000000-0000-0000-0000-000000000001/files/file-1/test.jpg',
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
        metadata: { width: 1920, height: 1080 },
      });

      const response = await registerPOST(request);

      expect(response.status).toBe(201);
      expect(s3Lib.registerFile).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000001',
        mockUser.id,
        'projects/00000000-0000-0000-0000-000000000001/files/file-1/test.jpg',
        'test.jpg',
        'image/jpeg',
        BigInt(1024),
        { width: 1920, height: 1080 }
      );
      
      jsonSpy.mockRestore();
    });

    it('returns 400 for invalid payload', async () => {
      const request = jsonRequest('/api/files/register', 'POST', {
        projectId: 'not-a-uuid',
        filename: '',
        sizeBytes: -1,
      });

      const response = await registerPOST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation error');
    });

    it('returns 401 when auth fails', async () => {
      (authLib.requireAuth as jest.Mock).mockRejectedValue(new Error('Unauthorized'));

      const request = jsonRequest('/api/files/register', 'POST', {
        projectId: '00000000-0000-0000-0000-000000000001',
        s3Key: 'key',
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
      });

      const response = await registerPOST(request);

      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ error: 'Unauthorized' });
    });
  });

  describe('GET /api/files/[id]/presign-download', () => {
    it('generates presigned download URL', async () => {
      const mockFile = {
        id: 'file-1',
        s3Key: 'projects/00000000-0000-0000-0000-000000000001/files/file-1/test.jpg',
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: BigInt(1024),
      };

      (s3Lib.getFileById as jest.Mock).mockResolvedValue(mockFile);
      (s3Lib.generatePresignedDownloadUrl as jest.Mock).mockResolvedValue({
        downloadUrl: 'https://download-url.example.com',
        expiresAt: new Date(),
      });

      const request = jsonRequest('/api/files/file-1/presign-download');
      const response = await downloadGET(request, { params: { id: 'file-1' } });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toMatchObject({
        downloadUrl: 'https://download-url.example.com',
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: '1024',
      });
      expect(s3Lib.generatePresignedDownloadUrl).toHaveBeenCalledWith(mockFile.s3Key);
    });

    it('returns 404 when file not found', async () => {
      (s3Lib.getFileById as jest.Mock).mockResolvedValue(null);

      const request = jsonRequest('/api/files/missing/presign-download');
      const response = await downloadGET(request, { params: { id: 'missing' } });

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ error: 'File not found' });
    });

    it('returns 401 when auth fails', async () => {
      (authLib.requireAuth as jest.Mock).mockRejectedValue(new Error('Unauthorized'));

      const request = jsonRequest('/api/files/file-1/presign-download');
      const response = await downloadGET(request, { params: { id: 'file-1' } });

      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ error: 'Unauthorized' });
    });
  });

  describe('DELETE /api/files/[id]', () => {
    it('deletes file', async () => {
      (s3Lib.deleteFile as jest.Mock).mockResolvedValue({ success: true });

      const request = jsonRequest('/api/files/file-1', 'DELETE');
      const response = await DELETE(request, { params: { id: 'file-1' } });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(s3Lib.deleteFile).toHaveBeenCalledWith('file-1', mockUser.id);
    });

    it('returns 404 when file not found or access denied', async () => {
      (s3Lib.deleteFile as jest.Mock).mockRejectedValue(
        new Error('File not found or access denied')
      );

      const request = jsonRequest('/api/files/missing', 'DELETE');
      const response = await DELETE(request, { params: { id: 'missing' } });

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({
        error: 'File not found or access denied',
      });
    });

    it('returns 401 when auth fails', async () => {
      (authLib.requireAuth as jest.Mock).mockRejectedValue(new Error('Unauthorized'));

      const request = jsonRequest('/api/files/file-1', 'DELETE');
      const response = await DELETE(request, { params: { id: 'file-1' } });

      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ error: 'Unauthorized' });
    });
  });
});

