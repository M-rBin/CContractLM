import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/common/prisma.service';
import { BaseService, PageOptions } from '@/common/crud';
import { AddContractDto, UpdateContractDto } from '../dto/contract.dto';

interface ContractQuery extends PageOptions {
  keyword?: string;
  type?: string;
  status?: string;
  counterparty?: string;
  ownerId?: string | number;
  signDateStart?: string;
  signDateEnd?: string;
  effectiveDateStart?: string;
  effectiveDateEnd?: string;
  expireDateStart?: string;
  expireDateEnd?: string;
}

/**
 * 合同台账服务
 */
@Injectable()
export class ContractService extends BaseService {
  constructor(protected prisma: PrismaService) {
    super(prisma, 'contractInfo');
  }

  async pageContracts(query: ContractQuery, tenantId?: number) {
    const page = Math.max(Number(query.page || 1), 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
    const where = this.buildWhere(query, tenantId);

    const [rawList, total] = await Promise.all([
      this.prisma.contractInfo.findMany({
        where,
        include: {
          payments: {
            where: { status: '已完成' },
            select: { actualAmount: true, planAmount: true },
          },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { id: 'desc' },
      }),
      this.prisma.contractInfo.count({ where }),
    ]);

    const list = rawList.map(({ payments, ...contract }) => {
      const paidAmount = payments.reduce(
        (sum, p) => sum + Number(p.actualAmount ?? 0),
        0,
      );
      return {
        ...contract,
        receivedAmount: paidAmount,
        remainingPerformanceAmount: Math.max(Number(contract.amount) - paidAmount, 0),
      };
    });

    return { list, pagination: { page, pageSize, total } };
  }

  async verifyTenantAccess(id: number, tenantId?: number) {
    if (!tenantId) return;
    const contract = await this.prisma.contractInfo.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!contract) throw new ForbiddenException('无权访问该合同');
  }

  async createContract(dto: AddContractDto, tenantId?: number) {
    await this.validateBusiness(dto, undefined, tenantId);
    return this.prisma.contractInfo.create({ data: this.toPrismaData(dto, tenantId) });
  }

  async updateContract(dto: UpdateContractDto, tenantId?: number) {
    const { id, ...data } = dto;
    await this.verifyTenantAccess(id, tenantId);
    await this.validateBusiness(data, id, tenantId);
    return this.prisma.contractInfo.update({
      where: { id },
      data: this.toPrismaData(data),
    });
  }

  async listForExport(query: ContractQuery, tenantId?: number) {
    return this.prisma.contractInfo.findMany({
      where: this.buildWhere(query, tenantId),
      orderBy: { id: 'desc' },
    });
  }

  /**
   * 生成当天下一个可用合同编号，格式：N + YYYYMMDD + 3位序号
   */
  async generateNextCode(): Promise<string> {
    // en-CA locale 稳定输出 YYYY-MM-DD，replace 后得到 YYYYMMDD
    const dateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date()).replace(/-/g, '');
    const prefix = `N${dateStr}`;

    // code 字段全局唯一，扫描全库当天编号以确保生成结果不冲突
    const records = await this.prisma.contractInfo.findMany({
      where: { code: { startsWith: prefix } },
      select: { code: true },
    });

    const maxSeq = records.reduce((max, r) => {
      const seq = parseInt(r.code.slice(prefix.length), 10);
      return isNaN(seq) ? max : Math.max(max, seq);
    }, 0);

    return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
  }

  async deleteContractCascade(id: number) {
    await this.prisma.$transaction(async (tx) => {
      await tx.contractAttachment.deleteMany({ where: { contractId: id } });
      await tx.contractMilestone.deleteMany({ where: { contractId: id } });
      await tx.contractPaymentPlan.deleteMany({ where: { contractId: id } });
      await tx.contractReminder.deleteMany({ where: { contractId: id } });
      await tx.contractInfo.delete({ where: { id } });
    });
  }

  private buildWhere(query: ContractQuery, tenantId?: number): Prisma.ContractInfoWhereInput {
    const where: Prisma.ContractInfoWhereInput = {};
    if (tenantId !== undefined && tenantId !== 0) where.tenantId = tenantId;
    if (query.keyword) {
      where.OR = ['code', 'name', 'counterparty', 'signSubject'].map((field) => ({
        [field]: { contains: query.keyword },
      }));
    }
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    if (query.counterparty) where.counterparty = { contains: query.counterparty };
    if (query.ownerId !== undefined && query.ownerId !== '') where.ownerId = Number(query.ownerId);
    this.applyDateRange(where, 'signDate', query.signDateStart, query.signDateEnd);
    this.applyDateRange(where, 'effectiveDate', query.effectiveDateStart, query.effectiveDateEnd);
    this.applyDateRange(where, 'expireDate', query.expireDateStart, query.expireDateEnd);
    return where;
  }

  private applyDateRange(
    where: Prisma.ContractInfoWhereInput,
    field: 'signDate' | 'effectiveDate' | 'expireDate',
    start?: string,
    end?: string,
  ) {
    if (!start && !end) return;
    where[field] = {
      ...(start ? { gte: new Date(start) } : {}),
      ...(end ? { lte: new Date(`${end}T23:59:59`) } : {}),
    };
  }

  private async validateBusiness(dto: Partial<AddContractDto>, id?: number, tenantId?: number) {
    if (dto.signDate && dto.effectiveDate && new Date(dto.effectiveDate) < new Date(dto.signDate)) {
      throw new BadRequestException('日期填写有误，请检查签订、生效、到期日期的先后顺序');
    }
    if (dto.effectiveDate && dto.expireDate && new Date(dto.expireDate) < new Date(dto.effectiveDate)) {
      throw new BadRequestException('日期填写有误，请检查签订、生效、到期日期的先后顺序');
    }
    if (dto.code) {
      const exists = await this.prisma.contractInfo.findFirst({
        where: {
          code: dto.code,
          ...(tenantId ? { tenantId } : {}),
          ...(id ? { id: { not: id } } : {}),
        },
        select: { code: true },
      });
      if (exists) {
        throw new BadRequestException(`合同编号【${dto.code}】已存在，请更换`);
      }
    }
  }

  private toPrismaData(dto: Partial<AddContractDto>, tenantId?: number): Prisma.ContractInfoUncheckedCreateInput {
    return {
      code: dto.code!,
      name: dto.name!,
      type: dto.type!,
      signSubject: dto.signSubject!,
      counterparty: dto.counterparty!,
      amount: new Prisma.Decimal(dto.amount ?? 0),
      currency: dto.currency || '人民币',
      signDate: new Date(dto.signDate!),
      effectiveDate: new Date(dto.effectiveDate!),
      expireDate: new Date(dto.expireDate!),
      ownerId: dto.ownerId,
      ownerName: dto.ownerName,
      status: dto.status || '草稿',
      remark: dto.remark,
      ...(tenantId ? { tenantId } : {}),
    };
  }
}
