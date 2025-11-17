/**
 * API Client for frontend
 * Handles all API calls to the backend
 */

const API_BASE = '/api';

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include', // Include cookies for session
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  return response.json();
}

// Auth API
export const authApi = {
  signin: () => {
    window.location.href = '/api/auth/signin';
  },
  
  logout: async () => {
    await apiRequest('/auth/logout', { method: 'POST' });
    window.location.href = '/signin';
  },
  
  getMe: async () => {
    return apiRequest<{
      id: string;
      hashid: string;
      email: string | null;
      name: string | null;
      picture: string | null;
    }>('/user/me');
  },
};

// Projects API
export const projectsApi = {
  list: async (params?: { limit?: number; cursor?: string }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.cursor) query.set('cursor', params.cursor);
    return apiRequest<{
      items: any[];
      nextCursor: string | null;
      hasNextPage: boolean;
    }>(`/projects?${query.toString()}`);
  },
  
  create: async (data: { brandName: string; brandWebsite: string }) => {
    return apiRequest<any>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  get: async (id: string) => {
    return apiRequest<any>(`/projects/${id}`);
  },
  
  update: async (id: string, data: Partial<{ brandName: string; brandWebsite: string; findingsDraft: any }>) => {
    return apiRequest<any>(`/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  
  delete: async (id: string) => {
    return apiRequest<{ success: boolean }>(`/projects/${id}`, {
      method: 'DELETE',
    });
  },
  
  getAnalyses: async (id: string) => {
    return apiRequest<{
      analyses: Array<{
        id: string;
        kind: string;
        status: string;
        startedAt: string;
        finishedAt: string | null;
        failureReason: string | null;
      }>;
      exploratoryAnalysis: {
        id: string;
        kind: string;
        status: string;
        startedAt: string;
        finishedAt: string | null;
        failureReason: string | null;
      } | null;
      finalizeAnalysis: {
        id: string;
        kind: string;
        status: string;
        startedAt: string;
        finishedAt: string | null;
        failureReason: string | null;
      } | null;
    }>(`/projects/${id}/analyses`);
  },
};

// Files API
export const filesApi = {
  presign: async (data: {
    projectId: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
  }) => {
    return apiRequest<{
      s3Key: string;
      uploadUrl: string;
      expiresAt: string;
    }>('/files/presign', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  upload: async (url: string, file: File) => {
    const response = await fetch(url, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });
    
    if (!response.ok) {
      throw new Error('Upload failed');
    }
  },
  
  register: async (data: {
    projectId: string;
    s3Key: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    metadata?: any;
  }) => {
    return apiRequest<any>('/files/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  getDownloadUrl: async (id: string) => {
    return apiRequest<{
      downloadUrl: string;
      expiresAt: string;
      filename: string;
    }>(`/files/${id}/presign-download`);
  },
  
  delete: async (id: string) => {
    return apiRequest<{ success: boolean }>(`/files/${id}`, {
      method: 'DELETE',
    });
  },
};

// Analysis API
export const analysisApi = {
  start: async (data: { projectId: string; seedPrompt?: string }) => {
    return apiRequest<{
      id: string;
      status: string;
      kind: string;
      startedAt: string;
    }>('/analysis/start', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  getStatus: async (id: string) => {
    return apiRequest<{
      id: string;
      status: string;
      kind: string;
      startedAt: string;
      finishedAt: string | null;
      failureReason: string | null;
      partialResult?: any;
    }>(`/analysis/${id}/status`);
  },
  
  getResult: async (id: string) => {
    return apiRequest<{
      id: string;
      status: string;
      kind: string;
      responseJson: any;
      startedAt: string;
      finishedAt: string | null;
    }>(`/analysis/${id}/result`);
  },
  
  finalize: async (data: {
    analysisId: string;
    useFindingsDraft?: boolean;
    selectedIdeas?: number[];
  }) => {
    return apiRequest<{
      id: string;
      status: string;
      kind: string;
      startedAt: string;
    }>(`/analysis/${data.analysisId}/finalize`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// Artifacts API
export const artifactsApi = {
  list: async (analysisId: string) => {
    return apiRequest<{
      artifacts: Array<{
        id: string;
        type: string;
        filename: string;
        s3Key: string;
        createdAt: string;
      }>;
    }>(`/analyses/${analysisId}/artifacts`);
  },
  
  getDownloadUrl: async (id: string) => {
    return apiRequest<{
      downloadUrl: string;
      expiresAt: string;
      filename: string;
      type: string;
    }>(`/artifacts/${id}/presign-download`);
  },
};

// Chat API
export const chatApi = {
  send: async (projectId: string, data: {
    message: any;
    useFindingsDraft?: boolean;
  }) => {
    return apiRequest<{
      userMessage: any;
      assistantMessage: any;
    }>(`/projects/${projectId}/chat`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// Messages API
export const messagesApi = {
  list: async (projectId: string, params?: { limit?: number; cursor?: string }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.cursor) query.set('cursor', params.cursor);
    return apiRequest<{
      items: any[];
      nextCursor: string | null;
      hasNextPage: boolean;
    }>(`/projects/${projectId}/messages?${query.toString()}`);
  },
  
  create: async (projectId: string, data: { role: string; content: any }) => {
    return apiRequest<any>(`/projects/${projectId}/messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

