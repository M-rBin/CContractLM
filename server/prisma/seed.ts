import { PrismaClient } from '@prisma/client';
import { SeedService } from '../src/common/seed.service';

/**
 * 开发环境种子脚本入口（pnpm prisma:seed / prisma db seed 调用）
 * 复用 SeedService 的幂等初始化逻辑，避免逻辑重复。
 * 生产环境由应用启动钩子 BootstrapService 调用 SeedService，不走此脚本。
 */
async function main() {
  const prisma = new PrismaClient();
  try {
    // seed 脚本无 NestJS 容器，用轻量 stub 满足 RedisService 接口
    // seedRoleMenus 中的缓存清除在此场景为 no-op，服务重启后缓存会自然重建
    const redisStub = { del: async () => 0, get: async () => null, set: async () => 'OK' } as any;
    const seedService = new SeedService(prisma as any, redisStub);
    await seedService.run();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  process.stderr.write(`种子数据初始化失败: ${e}\n`);
  process.exit(1);
});
