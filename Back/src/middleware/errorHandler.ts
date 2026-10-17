import type { Request, Response, NextFunction } from 'express'

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error('[Error Middleware]', err.message, err.stack)
  res.status(500).json({
    error: 'Error interno del servidor',
    message: err.message,
    timestamp: new Date().toISOString(),
  })
}
