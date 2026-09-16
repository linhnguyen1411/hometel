import { Response } from 'express';

export function sendSuccess<T>(res: Response, data: T, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    meta: null,
    error: null
  });
}

export function sendList<T>(res: Response, data: T[], meta: { page: number; pageSize: number; total: number }, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    meta: {
      page: meta.page,
      page_size: meta.pageSize,
      total: meta.total
    },
    error: null
  });
}

export function sendError(res: Response, code: string, message: string, statusCode = 400) {
  return res.status(statusCode).json({
    success: false,
    data: null,
    meta: null,
    error: {
      code,
      message
    }
  });
}
