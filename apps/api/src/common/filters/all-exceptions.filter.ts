import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

/** Maps every error to a safe Arabic JSON response; internals are only logged. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly log = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      return res
        .status(status)
        .json(
          typeof body === 'string'
            ? { statusCode: status, message: body }
            : body,
        );
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return res
          .status(HttpStatus.CONFLICT)
          .json({ statusCode: 409, message: 'هذه القيمة مستخدمة مسبقاً' });
      }
      if (exception.code === 'P2025') {
        return res
          .status(HttpStatus.NOT_FOUND)
          .json({ statusCode: 404, message: 'العنصر غير موجود' });
      }
    }

    // body-parser errors (malformed JSON, oversized payloads) carry a status and a type
    const parserError = exception as { status?: number; type?: string };
    if (
      parserError?.type &&
      (parserError.status === 400 || parserError.status === 413)
    ) {
      const status = parserError.status;
      return res.status(status).json({
        statusCode: status,
        message:
          status === 413 ? 'حجم الطلب كبير جداً' : 'بيانات الطلب غير صالحة',
      });
    }

    this.log.error(
      `${req.method} ${req.originalUrl}`,
      exception instanceof Error ? exception.stack : String(exception),
    );
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ statusCode: 500, message: 'حدث خطأ غير متوقع' });
  }
}
