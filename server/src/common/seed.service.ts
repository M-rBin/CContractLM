import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from './prisma.service';
import { buildContractDemoSeed } from './contract-demo-seed';

/**
 * 种子数据初始化服务
 *
 * 编译进 dist，生产环境无需 ts-node 即可运行。
 * 幂等：所有写入用 upsert / 存在性检查，可重复执行。
 */
@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 执行种子数据初始化（超级管理员 + 默认角色 + 系统菜单 + 业务字典） */
  async run(): Promise<void> {
    this.logger.log('开始初始化种子数据...');

    const password = await bcrypt.hash('123456', 12);

    const admin = await this.prisma.sysUser.upsert({
      where: { username: 'admin' },
      update: {},
      create: {
        username: 'admin',
        password,
        name: '超级管理员',
        nickName: 'Admin',
        status: 1,
        passwordV: 1,
      },
    });

    const adminRole = await this.prisma.sysRole.upsert({
      where: { label: 'admin' },
      update: {},
      create: {
        name: '管理员',
        label: 'admin',
        remark: '系统默认管理员角色',
        relevance: 1,
        status: 1,
      },
    });

    await this.prisma.sysUserRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
      update: {},
      create: { userId: admin.id, roleId: adminRole.id },
    });

    await this.seedMenus();
    await this.seedDepartments();
    await this.seedPositions();
    await this.seedRoles();
    await this.seedUsers(password);
    await this.syncContractDictionaries();
    await this.syncContractDemoData();

    this.logger.log('种子数据初始化完成，请登录后立即修改默认管理员密码');
  }

  /** 同步合同模块字典（用于已有数据库补齐业务枚举） */
  async syncContractDictionaries(): Promise<void> {
    const dictionaries: Array<{
      name: string;
      key: string;
      items: Array<{ name: string; value: string; remark?: string }>;
    }> = [
      {
        name: '合同类型',
        key: 'contract_type',
        items: [
          { name: '采购合同', value: '采购合同', remark: '采购类合同' },
          { name: '销售合同', value: '销售合同', remark: '销售类合同' },
          { name: '服务合同', value: '服务合同', remark: '服务类合同' },
          { name: '租赁合同', value: '租赁合同', remark: '租赁类合同' },
          { name: '框架协议', value: '框架协议', remark: '框架性协议' },
          { name: '其他合同', value: '其他合同', remark: '其他类型合同' },
        ],
      },
      {
        name: '合同状态',
        key: 'contract_status',
        items: [
          { name: '草稿', value: '草稿', remark: '合同已登记但未生效' },
          { name: '履行中', value: '履行中', remark: '合同生效并在履行过程中' },
          { name: '已到期', value: '已到期', remark: '合同已过到期日期' },
          { name: '已终止', value: '已终止', remark: '合同提前终止' },
          { name: '已归档', value: '已归档', remark: '合同履行完毕并归档' },
        ],
      },
      {
        name: '合同币种',
        key: 'contract_currency',
        items: [
          { name: '人民币', value: '人民币' },
          { name: '美元', value: '美元' },
          { name: '欧元', value: '欧元' },
          { name: '其他', value: '其他' },
        ],
      },
      {
        name: '附件分类',
        key: 'contract_attachment_category',
        items: [
          { name: '合同正文', value: '合同正文', remark: '合同主文件' },
          { name: '补充协议', value: '补充协议', remark: '补充或变更协议' },
          { name: '验收材料', value: '验收材料', remark: '验收相关材料' },
          { name: '发票', value: '发票', remark: '开具的发票' },
          { name: '付款凭证', value: '付款凭证', remark: '收付款凭证' },
          { name: '其他附件', value: '其他附件', remark: '其他类型附件' },
        ],
      },
      {
        name: '履约节点状态',
        key: 'contract_performance_status',
        items: [
          { name: '待处理', value: '待处理', remark: '节点尚未完成' },
          { name: '已完成', value: '已完成', remark: '节点已标记完成' },
          { name: '逾期', value: '逾期', remark: '超过计划日期仍未完成' },
        ],
      },
      {
        name: '收付款方向',
        key: 'contract_payment_direction',
        items: [
          { name: '收款', value: '收款', remark: '收款计划' },
          { name: '付款', value: '付款', remark: '付款计划' },
        ],
      },
      {
        name: '收付款计划状态',
        key: 'contract_payment_status',
        items: [
          { name: '待处理', value: '待处理', remark: '尚未登记实际收付款' },
          { name: '已完成', value: '已完成', remark: '已登记实际收付款' },
          { name: '逾期', value: '逾期', remark: '超过计划日期仍未登记' },
        ],
      },
      {
        name: '提醒类型',
        key: 'contract_reminder_type',
        items: [
          { name: '合同到期提醒', value: '合同到期提醒', remark: '合同到期日期临近或已到期' },
          { name: '履约节点提醒', value: '履约节点提醒', remark: '履约节点计划日期临近或已逾期' },
          { name: '收款计划提醒', value: '收款计划提醒', remark: '收款计划日期临近或已逾期' },
          { name: '付款计划提醒', value: '付款计划提醒', remark: '付款计划日期临近或已逾期' },
          { name: '逾期提醒', value: '逾期提醒', remark: '已逾期事项提醒' },
        ],
      },
      {
        name: '逾期状态',
        key: 'contract_overdue_status',
        items: [
          { name: '未逾期', value: '未逾期' },
          { name: '已逾期', value: '已逾期' },
        ],
      },
      {
        name: '处理状态',
        key: 'contract_process_status',
        items: [
          { name: '待处理', value: '待处理' },
          { name: '已处理', value: '已处理' },
        ],
      },
    ];

    for (const dictionary of dictionaries) {
      const type = await this.ensureDictType({
        name: dictionary.name,
        key: dictionary.key,
      });

      await this.ensureDictItems(type.id, dictionary.items);
    }

    this.logger.log('合同模块字典已同步');
  }

  /** 同步合同模块演示数据（用于页面级验收与图表统计展示） */
  async syncContractDemoData(): Promise<void> {
    const demoRows = buildContractDemoSeed();
    const usernames = [...new Set(demoRows.map((item) => item.ownerUsername).filter((item): item is string => !!item))];
    const owners = await this.prisma.sysUser.findMany({
      where: { username: { in: usernames } },
      select: { id: true, username: true, name: true, nickName: true },
    });
    const ownerMap = new Map(owners.map((item) => [item.username, item]));

    for (const row of demoRows) {
      const owner = row.ownerUsername ? ownerMap.get(row.ownerUsername) : undefined;
      const ownerName = owner?.name || owner?.nickName || row.ownerName;

      await this.prisma.$transaction(async (tx) => {
        const contract = await tx.contractInfo.upsert({
          where: { code: row.code },
          update: {
            name: row.name,
            type: row.type,
            signSubject: row.signSubject,
            counterparty: row.counterparty,
            amount: new Prisma.Decimal(row.amount),
            currency: row.currency,
            signDate: row.signDate,
            effectiveDate: row.effectiveDate,
            expireDate: row.expireDate,
            ownerId: owner?.id,
            ownerName,
            status: row.status,
            remark: row.remark,
          },
          create: {
            code: row.code,
            name: row.name,
            type: row.type,
            signSubject: row.signSubject,
            counterparty: row.counterparty,
            amount: new Prisma.Decimal(row.amount),
            currency: row.currency,
            signDate: row.signDate,
            effectiveDate: row.effectiveDate,
            expireDate: row.expireDate,
            ownerId: owner?.id,
            ownerName,
            status: row.status,
            remark: row.remark,
          },
        });

        await tx.contractReminder.deleteMany({ where: { contractId: contract.id } });
        await tx.contractAttachment.deleteMany({ where: { contractId: contract.id } });
        await tx.contractMilestone.deleteMany({ where: { contractId: contract.id } });
        await tx.contractPaymentPlan.deleteMany({ where: { contractId: contract.id } });
        await tx.contractOperRecord.deleteMany({ where: { contractId: contract.id } });

        if (row.attachments.length) {
          await tx.contractAttachment.createMany({
            data: row.attachments.map((attachment) => {
              const filePath = this.ensureDemoAttachment(row.code, attachment.fileName, attachment.content);
              return {
                contractId: contract.id,
                category: attachment.category,
                fileName: attachment.fileName,
                filePath,
                fileSize: Buffer.byteLength(attachment.content),
                uploaderId: owner?.id,
                uploaderName: ownerName,
              };
            }),
          });
        }

        await tx.contractMilestone.createMany({
          data: row.milestones.map((milestone) => ({
            contractId: contract.id,
            name: milestone.name,
            planDate: milestone.planDate,
            actualDate: milestone.actualDate,
            ownerId: owner?.id,
            ownerName: milestone.ownerName || ownerName,
            status: milestone.status,
            remark: milestone.remark,
            completeRemark: milestone.completeRemark,
          })),
        });

        await tx.contractPaymentPlan.createMany({
          data: row.payments.map((payment) => ({
            contractId: contract.id,
            direction: payment.direction,
            planAmount: new Prisma.Decimal(payment.planAmount),
            planDate: payment.planDate,
            actualAmount: payment.actualAmount === undefined ? undefined : new Prisma.Decimal(payment.actualAmount),
            actualDate: payment.actualDate,
            status: payment.status,
            remark: payment.remark,
          })),
        });

        await tx.contractOperRecord.createMany({
          data: row.records.map((record) => ({
            contractId: contract.id,
            operType: record.operType,
            operTarget: record.operTarget,
            operatorId: owner?.id,
            operatorName: record.operatorName || ownerName,
            operDesc: record.operDesc,
          })),
        });
      });
    }

    this.logger.log(`合同演示数据已同步：${demoRows.length} 条合同`);
  }

  /** 同步系统配置菜单（用于已有数据库补齐新增基础菜单） */
  async syncSystemMenus(): Promise<void> {
    const systemDir = await this.ensureMenu({
      name: '系统配置',
      type: 0,
      router: '/system',
      icon: 'Setting',
      orderNum: 30,
      updateExisting: true,
    });

    await this.ensureMenu({
      name: '字典管理',
      type: 1,
      router: '/system/dict',
      perms: 'dict:type:list',
      viewPath: '/system/dict/index.vue',
      icon: 'Tickets',
      orderNum: 1,
      parentId: systemDir.id,
    });

    await this.ensureMenu({
      name: '操作日志',
      type: 1,
      router: '/system/log',
      perms: 'sys:log:list',
      viewPath: '/system/log/index.vue',
      icon: 'Document',
      orderNum: 2,
      parentId: systemDir.id,
    });
  }

  /** 同步合同管理菜单（用于已有数据库补齐新增业务菜单） */
  async syncContractMenus(): Promise<void> {
    await this.syncTopLevelMenuOrder();

    await this.ensureMenu({
      name: '合同管理',
      type: 0,
      router: '/contract',
      icon: 'DocumentChecked',
      orderNum: 99,
      isShow: 0,
      updateExisting: true,
    });

    await this.ensureMenu({
      name: '合同工作台',
      type: 1,
      router: '/contract/workbench',
      perms: 'contract:workbench:overview',
      viewPath: '/contract/workbench/index.vue',
      icon: 'DataBoard',
      orderNum: 1,
      parentId: null,
      updateExisting: true,
    });

    await this.ensureMenu({
      name: '合同台账',
      type: 1,
      router: '/contract/ledger',
      perms: 'contract:info:list',
      viewPath: '/contract/ledger/index.vue',
      icon: 'Tickets',
      orderNum: 2,
      parentId: null,
      updateExisting: true,
    });

    await this.ensureMenu({
      name: '合同详情',
      type: 1,
      router: '/contract/detail',
      perms: 'contract:detail:detail',
      viewPath: '/contract/detail/index.vue',
      icon: 'Document',
      orderNum: 6,
      parentId: null,
      isShow: 0,
      updateExisting: true,
    });

    await this.ensureMenu({
      name: '履约提醒',
      type: 1,
      router: '/contract/reminder',
      perms: 'contract:reminder:list',
      viewPath: '/contract/reminder/index.vue',
      icon: 'Bell',
      orderNum: 3,
      parentId: null,
      updateExisting: true,
    });

    await this.ensureMenu({
      name: '收付款管理',
      type: 1,
      router: '/contract/payment',
      perms: 'contract:payment:manage:list',
      viewPath: '/contract/payment/index.vue',
      icon: 'Money',
      orderNum: 4,
      parentId: null,
      updateExisting: true,
    });

    await this.ensureMenu({
      name: '经营分析',
      type: 1,
      router: '/contract/analysis',
      perms: 'contract:analysis:overview',
      viewPath: '/contract/analysis/index.vue',
      icon: 'TrendCharts',
      orderNum: 5,
      parentId: null,
      updateExisting: true,
    });
  }

  /** 初始化系统菜单（type: 0=目录 1=菜单 2=权限按钮）；已存在则只补系统配置菜单 */
  private async seedMenus(): Promise<void> {
    const existing = await this.prisma.sysMenu.count();
    if (existing > 0) {
      await this.syncContractMenus();
      await this.syncSystemMenus();
      this.logger.log('菜单已存在，已补齐合同管理与系统配置菜单');
      return;
    }

    // 组织管理
    const orgDir = await this.prisma.sysMenu.create({
      data: { name: '组织管理', type: 0, router: '/organization', icon: 'OfficeBuilding', orderNum: 10 },
    });
    await this.prisma.sysMenu.create({
      data: { name: '部门管理', type: 1, router: '/organization/department', perms: 'sys:department:list', orderNum: 1, parentId: orgDir.id },
    });
    await this.prisma.sysMenu.create({
      data: { name: '人员管理', type: 1, router: '/organization/user', perms: 'sys:user:list', orderNum: 2, parentId: orgDir.id },
    });
    await this.prisma.sysMenu.create({
      data: { name: '岗位管理', type: 1, router: '/organization/position', perms: 'sys:position:list', orderNum: 3, parentId: orgDir.id },
    });

    // 权限管理
    const permDir = await this.prisma.sysMenu.create({
      data: { name: '权限管理', type: 0, router: '/permission', icon: 'Lock', orderNum: 20 },
    });
    // 仅建目录与菜单（type 0/1）；按钮（type 2）由 PermsSyncService 启动时自动登记
    await this.prisma.sysMenu.create({
      data: { name: '角色管理', type: 1, router: '/permission/role', perms: 'sys:role:list', orderNum: 1, parentId: permDir.id },
    });
    await this.prisma.sysMenu.create({
      data: { name: '菜单管理', type: 1, router: '/permission/menu', perms: 'sys:menu:list', orderNum: 2, parentId: permDir.id },
    });

    await this.syncContractMenus();
    await this.syncSystemMenus();

    this.logger.log('系统菜单已初始化（按钮权限由 PermsSyncService 自动登记）');
  }

  /** 按路由补齐基础菜单；已有节点不覆盖，避免影响人工维护的菜单名称和排序 */
  private async ensureMenu(data: {
    name: string;
    type: number;
    router: string;
    perms?: string;
    icon?: string;
    orderNum: number;
    parentId?: number | null;
    viewPath?: string;
    isShow?: number;
    updateExisting?: boolean;
  }) {
    const existing = await this.prisma.sysMenu.findFirst({
      where: {
        type: data.type,
        router: data.router,
      },
    });

    if (existing) {
      if (!data.updateExisting) return existing;
      return this.prisma.sysMenu.update({
        where: { id: existing.id },
        data: {
          name: data.name,
          perms: data.perms,
          icon: data.icon,
          orderNum: data.orderNum,
          parentId: data.parentId,
          viewPath: data.viewPath,
          isShow: data.isShow ?? 1,
        },
      });
    }

    return this.prisma.sysMenu.create({
      data: {
        name: data.name,
        type: data.type,
        router: data.router,
        perms: data.perms,
        icon: data.icon,
        orderNum: data.orderNum,
        parentId: data.parentId,
        viewPath: data.viewPath,
        isShow: data.isShow,
      },
    });
  }

  /** 调整一级菜单排序：合同模块位于组织管理上方 */
  private async syncTopLevelMenuOrder(): Promise<void> {
    const topMenus = [
      { router: '/organization', orderNum: 10 },
      { router: '/permission', orderNum: 20 },
      { router: '/system', orderNum: 30 },
    ];

    for (const item of topMenus) {
      await this.prisma.sysMenu.updateMany({
        where: { router: item.router, parentId: null },
        data: { orderNum: item.orderNum },
      });
    }
  }

  /** 按 key 补齐字典类型；已有类型不覆盖，避免影响后台人工维护 */
  private async ensureDictType(data: { name: string; key: string }) {
    return this.prisma.dictType.upsert({
      where: { key: data.key },
      update: {},
      create: data,
    });
  }

  /** 按 typeId + value 补齐字典项；已有字典项不覆盖 */
  private async ensureDictItems(
    typeId: number,
    items: Array<{ name: string; value: string; remark?: string }>,
  ): Promise<void> {
    for (const [index, item] of items.entries()) {
      const existing = await this.prisma.dictInfo.findFirst({
        where: { typeId, value: item.value },
      });

      if (existing) continue;

      await this.prisma.dictInfo.create({
        data: {
          typeId,
          name: item.name,
          value: item.value,
          orderNum: index + 1,
          remark: item.remark,
        },
      });
    }
  }

  /** 写入演示附件占位文件，确保附件下载接口可真实读取磁盘文件 */
  private ensureDemoAttachment(contractCode: string, fileName: string, content: string): string {
    const dir = join(process.cwd(), 'uploads', 'contract', 'demo');
    mkdirSync(dir, { recursive: true });
    const filePath = join(dir, `${contractCode}-${fileName}`);
    if (!existsSync(filePath)) {
      writeFileSync(filePath, content);
    }
    return filePath;
  }

  /** 初始化默认岗位数据（科技公司岗位体系）；已存在则跳过 */
  private async seedPositions(): Promise<void> {
    const existing = await this.prisma.sysPosition.count();
    if (existing > 0) {
      this.logger.log('岗位已存在，跳过岗位初始化');
      return;
    }

    await this.prisma.sysPosition.createMany({
      skipDuplicates: true,
      data: [
        { name: '技术总监', description: '负责技术方向把控与研发团队管理', orderNum: 1 },
        { name: '高级软件工程师', description: '负责核心模块设计与复杂功能开发', orderNum: 2 },
        { name: '软件工程师', description: '负责功能模块开发与单元测试', orderNum: 3 },
        { name: '产品经理', description: '负责产品规划、需求分析与项目推进', orderNum: 4 },
        { name: 'UI/UX 设计师', description: '负责产品交互设计与视觉设计', orderNum: 5 },
        { name: '市场总监', description: '负责品牌推广、市场策略与渠道建设', orderNum: 6 },
        { name: '销售经理', description: '负责客户开拓、商务谈判与合同签订', orderNum: 7 },
        { name: '财务经理', description: '负责财务核算、资金管理与成本管控', orderNum: 8 },
        { name: '人力资源专员', description: '负责招聘、员工关系与薪酬绩效管理', orderNum: 9 },
        { name: '法务专员', description: '负责合同审核、法律风险防控与合规管理', orderNum: 10 },
      ],
    });

    this.logger.log('默认岗位已初始化');
  }

  /** 初始化部门数据（科技公司组织架构）；已存在则跳过 */
  private async seedDepartments(): Promise<void> {
    const existing = await this.prisma.sysDepartment.count();
    if (existing > 0) {
      this.logger.log('部门已存在，跳过部门初始化');
      return;
    }

    await this.prisma.sysDepartment.createMany({
      skipDuplicates: true,
      data: [
        { name: '技术研发部', orderNum: 1, leader: '张伟' },
        { name: '产品与设计部', orderNum: 2, leader: '陈梅' },
        { name: '市场营销部', orderNum: 3, leader: '赵琳' },
        { name: '销售部', orderNum: 4 },
        { name: '财务部', orderNum: 5, leader: '王芳' },
        { name: '人力资源部', orderNum: 6 },
        { name: '法务合规部', orderNum: 7, leader: '李华' },
        { name: '运营部', orderNum: 8 },
      ],
    });

    this.logger.log('默认部门已初始化');
  }

  /** 初始化业务角色（除 admin 外的功能角色）；已存在则跳过 */
  private async seedRoles(): Promise<void> {
    const existing = await this.prisma.sysRole.count();
    if (existing > 1) {
      this.logger.log('角色已存在，跳过角色初始化');
      return;
    }

    await this.prisma.sysRole.createMany({
      skipDuplicates: true,
      data: [
        { name: '合同管理员', label: 'contract_admin', remark: '负责全公司合同的录入、审核与归档管理', relevance: 1, status: 1 },
        { name: '法务专员', label: 'legal', remark: '负责合同法律审核与合规风险识别', relevance: 1, status: 1 },
        { name: '财务专员', label: 'finance', remark: '负责收付款计划管理与资金台账维护', relevance: 1, status: 1 },
        { name: '部门经理', label: 'dept_manager', remark: '可查看并管理本部门相关合同', relevance: 1, status: 1 },
        { name: '普通员工', label: 'employee', remark: '只读权限，可查看公开合同信息', relevance: 1, status: 1 },
      ],
    });

    this.logger.log('默认角色已初始化');
  }

  /** 初始化示例员工账号；已有用户（不含 admin）则跳过 */
  private async seedUsers(password: string): Promise<void> {
    const existing = await this.prisma.sysUser.count();
    if (existing > 1) {
      this.logger.log('示例用户已存在，跳过用户初始化');
      return;
    }

    const [techDept, productDept, marketDept, financeDept, legalDept] = await Promise.all([
      this.prisma.sysDepartment.findFirst({ where: { name: '技术研发部' } }),
      this.prisma.sysDepartment.findFirst({ where: { name: '产品与设计部' } }),
      this.prisma.sysDepartment.findFirst({ where: { name: '市场营销部' } }),
      this.prisma.sysDepartment.findFirst({ where: { name: '财务部' } }),
      this.prisma.sysDepartment.findFirst({ where: { name: '法务合规部' } }),
    ]);

    const [ctpPos, pmPos, marketPos, financePos, legalPos, seniorEngPos] = await Promise.all([
      this.prisma.sysPosition.findFirst({ where: { name: '技术总监' } }),
      this.prisma.sysPosition.findFirst({ where: { name: '产品经理' } }),
      this.prisma.sysPosition.findFirst({ where: { name: '市场总监' } }),
      this.prisma.sysPosition.findFirst({ where: { name: '财务经理' } }),
      this.prisma.sysPosition.findFirst({ where: { name: '法务专员' } }),
      this.prisma.sysPosition.findFirst({ where: { name: '高级软件工程师' } }),
    ]);

    const [contractAdminRole, legalRole, financeRole, deptMgrRole, employeeRole] = await Promise.all([
      this.prisma.sysRole.findFirst({ where: { label: 'contract_admin' } }),
      this.prisma.sysRole.findFirst({ where: { label: 'legal' } }),
      this.prisma.sysRole.findFirst({ where: { label: 'finance' } }),
      this.prisma.sysRole.findFirst({ where: { label: 'dept_manager' } }),
      this.prisma.sysRole.findFirst({ where: { label: 'employee' } }),
    ]);

    const users = [
      { username: 'zhang.wei', name: '张伟', nickName: 'CTO', workId: 'T001', departmentId: techDept?.id, positionId: ctpPos?.id, roles: [deptMgrRole] },
      { username: 'li.hua', name: '李华', nickName: '法务', workId: 'L001', departmentId: legalDept?.id, positionId: legalPos?.id, roles: [contractAdminRole, legalRole] },
      { username: 'wang.fang', name: '王芳', nickName: '财务', workId: 'F001', departmentId: financeDept?.id, positionId: financePos?.id, roles: [financeRole] },
      { username: 'chen.mei', name: '陈梅', nickName: '产品', workId: 'P001', departmentId: productDept?.id, positionId: pmPos?.id, roles: [deptMgrRole] },
      { username: 'liu.yang', name: '刘洋', nickName: '工程师', workId: 'T002', departmentId: techDept?.id, positionId: seniorEngPos?.id, roles: [employeeRole] },
      { username: 'zhao.lin', name: '赵琳', nickName: '市场', workId: 'M001', departmentId: marketDept?.id, positionId: marketPos?.id, roles: [deptMgrRole] },
    ];

    for (const u of users) {
      const { roles, ...userData } = u;
      const user = await this.prisma.sysUser.upsert({
        where: { username: userData.username },
        update: {},
        create: { ...userData, password, status: 1, passwordV: 1 },
      });

      for (const role of roles) {
        if (!role) continue;
        await this.prisma.sysUserRole.upsert({
          where: { userId_roleId: { userId: user.id, roleId: role.id } },
          update: {},
          create: { userId: user.id, roleId: role.id },
        });
      }
    }

    this.logger.log('示例用户已初始化');
  }
}
