import { BadRequestException, Injectable } from '@nestjs/common';
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

  async pageContracts(query: ContractQuery) {
    const page = Math.max(Number(query.page || 1), 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
    const where = this.buildWhere(query);

    const [rawList, total] = await Promise.all([
      this.prisma.contractInfo.findMany({
        where,
        include: {
          payments: {
            where: { direction: '收款', status: '已完成' },
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
      const receivedAmount = payments.reduce(
        (sum, p) => sum + Number(p.actualAmount ?? 0),
        0,
      );
      return {
        ...contract,
        receivedAmount,
        remainingPerformanceAmount: Math.max(Number(contract.amount) - receivedAmount, 0),
      };
    });

    return { list, pagination: { page, pageSize, total } };
  }

  async createContract(dto: AddContractDto) {
    await this.validateBusiness(dto);
    return this.prisma.contractInfo.create({ data: this.toPrismaData(dto) });
  }

  async updateContract(dto: UpdateContractDto) {
    const { id, ...data } = dto;
    await this.validateBusiness(data, id);
    return this.prisma.contractInfo.update({
      where: { id },
      data: this.toPrismaData(data),
    });
  }

  async listForExport(query: ContractQuery) {
    return this.prisma.contractInfo.findMany({
      where: this.buildWhere(query),
      orderBy: { id: 'desc' },
    });
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

  private buildWhere(query: ContractQuery): Prisma.ContractInfoWhereInput {
    const where: Prisma.ContractInfoWhereInput = {};
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

  private async validateBusiness(dto: Partial<AddContractDto>, id?: number) {
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
          ...(id ? { id: { not: id } } : {}),
        },
        select: { code: true },
      });
      if (exists) {
        throw new BadRequestException(`合同编号【${dto.code}】已存在，请更换`);
      }
    }
  }

  private toPrismaData(dto: Partial<AddContractDto>): Prisma.ContractInfoUncheckedCreateInput {
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
    };
  }
}
