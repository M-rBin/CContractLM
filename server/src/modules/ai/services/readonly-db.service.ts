import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * 只读数据库服务
 *
 * 经营数据问答（Text-to-SQL）的执行底座。使用独立的只读数据库连接，
 * 与主 PrismaService 物理隔离：连接串来自环境变量 AI_READONLY_DATABASE_URL，
 * 应指向一个仅授予 SELECT 权限的 MySQL 只读账号，从数据库层面杜绝写操作。
 *
 * 该连接只暴露受控的原始查询能力，配合 SqlGuard（应用层校验）构成多层防线。
 * 未配置只读连接串时回退到主 DATABASE_URL，并打印告警（生产环境务必配置独立只读账号）。
 */
@Injectable()
export class ReadonlyDbService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReadonlyDbService.name);
  /** 查询超时（毫秒） */
  private readonly queryTimeoutMs = Number(process.env.AI_SQL_TIMEOUT_MS || 5000);
  private readonly client: PrismaClient;

  constructor() {
    const readonlyUrl = process.env.AI_READONLY_DATABASE_URL;
    if (!readonlyUrl) {
      this.logger.warn(
        '未配置 AI_READONLY_DATABASE_URL，已回退到主数据库连接，生产环境务必配置独立的只读账号以物理隔离写权限',
      );
    }
    this.client = new PrismaClient({
      datasources: {
        db: { url: readonlyUrl || process.env.DATABASE_URL },
      },
    });
  }

  async onModuleInit() {
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }

  /**
   * 执行只读查询（原始 SQL）
   *
   * 调用方必须先经 SqlGuard 校验通过后才可传入 SQL。
   * 本方法额外施加查询超时，超时后抛出异常。
   *
   * @param sql 已通过安全校验的单条 SELECT 语句
   * @returns 查询结果行数组
   */
  async executeReadonly<T = Record<string, unknown>>(sql: string): Promise<T[]> {
    const queryPromise = this.client.$queryRawUnsafe<T[]>(sql);
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`查询超时（超过 ${this.queryTimeoutMs}ms）`));
      }, this.queryTimeoutMs);
      // 允许进程在无其他任务时正常退出
      if (typeof timer.unref === 'function') timer.unref();
    });
    return Promise.race([queryPromise, timeoutPromise]);
  }
}
