import { NextRequest } from 'next/server';

export const mockUser = {
  id: 'user-1',
  hashid: 'abc123',
  email: 'test@example.com',
  name: 'Test User',
  picture: null,
};

export function jsonRequest(
  path: string,
  method: string = 'GET',
  body?: unknown
): NextRequest {
  const url = path.startsWith('http')
    ? path
    : `http://localhost:3000${path}`;

  const init: {
    method: string;
    body?: string;
    headers?: Record<string, string>;
  } = {
    method,
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = {
      'Content-Type': 'application/json',
    };
  }

  return new NextRequest(url, init);
}

export async function readStream(
  stream?: ReadableStream<Uint8Array> | null
): Promise<string> {
  if (!stream) {
    return '';
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    if (value) {
      result += decoder.decode(value);
    }
  }

  reader.releaseLock();
  return result;
}



