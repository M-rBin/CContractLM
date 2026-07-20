import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LogService } from '@/modules/base/services/log.service';

const SENSITIVE_KEYS = new Set([
  'password', 'passwd', 'secret', 'token', 'accessToken', 'refreshToken',
  'idCard', 'bankCard', 'cvv',
]);

function maskSensitiveFields(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (SENSITIVE_KEYS.has(key)) {
      result[key] = '***';
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = maskSensitiveFields(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item !== null && typeof item === 'object' ? maskSensitiveFields(item) : item,
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

const OPERATION_MAP: Record<string, string> = {
  add: '新增', create: '新增',
  update: '修改', edit: '修改',
  delete: '删除', remove: '删除',
  'batch-delete': '批量删除',
  'update-status': '修改状态',
  clear: '清空',
  upload: '上传',
  export: '导出',
  import: '导入',
};

function deriveDescription(method: string, url: string): string {
  // 过滤纯数字路径段（动态 ID），避免生成如 "42 update-status" 的无意义描述
  const segments = url.split('/').filter((s) => s && !/^\d+$/.test(s));
  const last = segments[segments.length - 1] ?? '';
  const operation = OPERATION_MAP[last] ?? (method === 'DELETE' ? '删除' : last);
  const module = segments.length >= 2 ? segments[segments.length - 2] : '';
  return module ? `${operation} ${module}` : operation;
}

/**
 * 操作日志拦截器
 *
 * 拦截所有非 GET 请求，在响应成功后异步写入操作日志。
 * 写入失败不阻塞响应，仅打印警告。
 */
@Injectable()
export class LogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LogInterceptor.name);

  constructor(private readonly logService: LogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method: string = request.method ?? '';

    // 只记录写操作，GET 请求跳过
    if (method === 'GET') {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: () => {
          this.record(request).catch((err) =>
            this.logger.warn(`操作日志写入失败: ${err?.message}`),
          );
        },
      }),
    );
  }

  private async record(request: any): Promise<void> {
    const userId: number | undefined = request.admin?.userId;
    // 未登录请求（如 /open 接口）不记录
    if (!userId) return;

    const ip = this.resolveIp(request);
    const url: string = (request.url ?? '').split('?')[0];
    const action = `${request.method} ${url}`;

    let params: string | undefined;
    if (request.body && Object.keys(request.body).length > 0) {
      try {
        params = JSON.stringify(maskSensitiveFields(request.body)).slice(0, 2000);
      } catch {
        // ignore
      }
    }

    const description = deriveDescription(request.method, url);
    await this.logService.record(userId, action, ip, params, description);
  }

  private resolveIp(request: any): string {
    // 优先使用框架处理后的 req.ip（需在 main.ts 配置 app.set('trust proxy', ...)）
    // 避免直接解析 x-forwarded-for 原始头，防止客户端伪造 IP
    return request.ip ?? request.socket?.remoteAddress ?? '';
  }
}
