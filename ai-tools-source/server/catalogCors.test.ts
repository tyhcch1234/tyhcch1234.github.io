import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { catalogCors, pagesOrigin } from './catalogCors';

function invoke(origin?: string, method = 'GET') {
  const req = { method, get: () => origin } as unknown as Request;
  const headers: Record<string, string> = {};
  const res = {
    vary: vi.fn(),
    set: vi.fn((key: string, value: string) => { headers[key] = value; return res; }),
    status: vi.fn(() => res),
    end: vi.fn(),
  };
  const next = vi.fn();
  catalogCors(req, res as unknown as Response, next as NextFunction);
  return { headers, res, next };
}

describe('public catalogue GitHub Pages CORS', () => {
  it('allows the exact user Pages origin without credential cookies', () => {
    const { headers, res, next } = invoke(pagesOrigin);
    expect(headers['Access-Control-Allow-Origin']).toBe(pagesOrigin);
    expect(headers['Access-Control-Allow-Credentials']).toBeUndefined();
    expect(res.vary).toHaveBeenCalledWith('Origin');
    expect(next).toHaveBeenCalledOnce();
  });
  it('does not grant browser access to unrelated origins', () => {
    const { headers, next } = invoke('https://unrelated.example');
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });
  it('keeps ordinary same-site/no-origin reads available', () => {
    const { headers, next } = invoke();
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });
  it('allows only the configured origin preflight', () => {
    const allowed = invoke(pagesOrigin, 'OPTIONS');
    expect(allowed.res.status).toHaveBeenCalledWith(204);
    expect(allowed.next).not.toHaveBeenCalled();
    const denied = invoke('https://unrelated.example', 'OPTIONS');
    expect(denied.res.status).toHaveBeenCalledWith(403);
    expect(denied.next).not.toHaveBeenCalled();
  });
});
