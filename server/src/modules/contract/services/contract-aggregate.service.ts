import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/common/prisma.service';
import { PageOptions } from '@/common/crud';
import { RegisterPaymentPlanDto } from '../dto/contract.dto';
import { ContractDetailService } from './contract-detail.service';
import { resolvePendingStatus } from '../utils/contract-status.util';

interface PaymentQuery extends PageOptions {
  contractName?: string;
  direction?: string;
  status?: string;
  planDateStart?: string;
  planDateEnd?: string;
  counterparty?: string;
}

interface ReminderQuery extends PageOptions {
  contractName?: string;
  type?: string;
  overdueStatus?: string;
  handleStatus?: string;
  planDateStart?: string;
  planDateEnd?: string;
}

interface AnalysisQuery {
  dateStart?: string;
  dateEnd?: string;
  type?: string;
  status?: string;
}

@Injectable()
export class ContractAggregateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly detailService: ContractDetailService,
  ) {}

  async scanReminders() {
    const threshold = this.daysFromNow(30);
    const today = this.startOfToday();
    const contracts = await this.prisma.contractInfo.findMany({
      where: {
        status: { notIn: ['已终止', '已归档'] },
        expireDate: { lte: threshold },
      },
    });
    for (const contract of contracts) {
      await this.ensureReminder({
        contractId: contract.id,
        type: contract.expireDate < today ? '逾期提醒' : '合同到期提醒',
        sourceId: contract.id,
        sourceType: 'contract',
        content: `合同【${contract.name}】将于${this.dateText(contract.expireDate)}到期`,
        planDate: contract.expireDate,
        overdueStatus: contract.expireDate < today ? '已逾期' : '未逾期',
      });
    }

    const milestones = await this.prisma.contractMilestone.findMany({
      where: { status: { not: '已完成' }, planDate: { lte: threshold } },
      include: { contract: true },
    });
    for (const item of milestones) {
      const overdue = item.planDate < today;
      await this.ensureReminder({
        contractId: item.contractId,
        type: overdue ? '逾期提醒' : '履约节点提醒',
        sourceId: item.id,
        sourceType: 'milestone',
        content: `合同【${item.contract.name}】履约节点【${item.name}】计划于${this.dateText(item.planDate)}完成`,
        planDate: item.planDate,
        overdueStatus: overdue ? '已逾期' : '未逾期',
      });
    }
  }

  async pageReminders(query: ReminderQuery) {
    await this.scanReminders();
    const where: Prisma.ContractReminderWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.overdueStatus ? { overdueStatus: query.overdueStatus } : {}),
      ...(query.handleStatus ? { handleStatus: query.handleStatus } : {}),
      ...(query.contractName ? { contract: { name: { contains: query.contractName } } } : {}),
    };
    this.applyDateRange(where, 'planDate', query.planDateStart, query.planDateEnd);
    return this.page('contractReminder', query, where, { contract: true });
  }

  async getReminderSource(id: number) {
    const reminder = await this.prisma.contractReminder.findUnique({ where: { id } });
    if (!reminder) throw new BadRequestException('提醒不存在');
    return { contractId: reminder.contractId, sourceId: reminder.sourceId, sourceType: reminder.sourceType };
  }

  async handleReminder(id: number, actualDate: string, operatorId?: number) {
    const reminder = await this.prisma.contractReminder.findUnique({ where: { id } });
    if (!reminder) throw new BadRequestException('提醒不存在');
    if (reminder.sourceType === 'milestone' && reminder.sourceId) {
      await this.detailService.completeMilestone({ id: reminder.sourceId, actualDate }, operatorId);
    }
    return this.prisma.contractReminder.update({
      where: { id },
      data: { handleStatus: '已处理' },
    });
  }

  async pagePayments(query: PaymentQuery) {
    const where = this.buildPaymentWhere(query);
    const result = await this.page('contractPaymentPlan', query, where, { contract: true });
    return {
      ...result,
      list: result.list.map((row: any) => ({
        ...row,
        status: resolvePendingStatus(row.status, row.planDate),
        remainingAmount: row.planAmount != null
          ? new Prisma.Decimal(row.planAmount).sub(row.paidAmount ?? 0).toFixed(2)
          : null,
      })),
    };
  }

  async paymentStat(query: PaymentQuery) {
    const rows = await this.prisma.contractPaymentPlan.findMany({ where: this.buildPaymentWhere(query) });
    return this.sumPaymentRows(rows);
  }

  async listPaymentsForExport(query: PaymentQuery) {
    return this.prisma.contractPaymentPlan.findMany({
      where: this.buildPaymentWhere(query),
      include: { contract: true },
      orderBy: { id: 'desc' },
    });
  }

  registerPayment(dto: RegisterPaymentPlanDto, operatorId?: number) {
    return this.detailService.registerPayment(dto, operatorId);
  }

  async workbenchOverview() {
    const contracts = await this.prisma.contractInfo.findMany();
    const payments = await this.prisma.contractPaymentPlan.findMany();
    return {
      metrics: {
        totalCount: contracts.length,
        performingCount: contracts.filter((item) => item.status === '履行中').length,
        expiringCount: contracts.filter((item) => this.isWithinDays(item.expireDate, 30)).length,
        overdueCount: contracts.filter((item) => item.expireDate < this.startOfToday() && !['已终止', '已归档'].includes(item.status)).length,
        ...this.sumPaymentRows(payments),
      },
      charts: {
        statusDist: this.countBy(contracts, 'status'),
        typeDist: this.countBy(contracts, 'type'),
        monthlyAmount: this.monthlyAmount(contracts),
        paymentProgress: this.paymentProgress(payments),
      },
    };
  }

  async workbenchTodos(type?: string) {
    await this.scanReminders();
    const reminders = await this.prisma.contractReminder.findMany({
      where: { handleStatus: '待处理', ...(type ? { type } : {}) },
      orderBy: { planDate: 'asc' },
      take: 10,
    });
    return reminders;
  }

  async workbenchRecent() {
    return {
      recentContracts: await this.prisma.contractInfo.findMany({ orderBy: { id: 'desc' }, take: 5 }),
      recentMilestones: await this.prisma.contractMilestone.findMany({ where: { status: '已完成' }, orderBy: { updateTime: 'desc' }, take: 5 }),
      recentPayments: await this.prisma.contractPaymentPlan.findMany({ where: { status: '已完成' }, orderBy: { updateTime: 'desc' }, take: 5 }),
    };
  }

  async analysisOverview(query: AnalysisQuery) {
    const contractWhere: Prisma.ContractInfoWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    this.applyDateRange(contractWhere, 'signDate', query.dateStart, query.dateEnd);
    const contracts = await this.prisma.contractInfo.findMany({ where: contractWhere });
    const contractIds = contracts.map((item) => item.id);
    const payments = await this.prisma.contractPaymentPlan.findMany({
      where: contractIds.length ? { contractId: { in: contractIds } } : { id: -1 },
    });
    const paymentStat = this.sumPaymentRows(payments);
    return {
      metrics: {
        totalCount: contracts.length,
        totalAmount: this.sum(contracts.map((item) => Number(item.amount))),
        ...paymentStat,
      },
      typeDist: this.countBy(contracts, 'type'),
      statusDist: this.countBy(contracts, 'status'),
      monthlyTrend: this.monthlyAmount(contracts),
      paymentProgress: this.paymentProgress(payments),
      paymentCompare: {
        receivable: paymentStat.receivableTotal,
        payable: paymentStat.payableTotal,
        received: this.sum(payments.filter((item) => item.direction === '收款' && item.status === '已完成').map((item) => Number(item.paidAmount))),
        paid: this.sum(payments.filter((item) => item.direction === '付款' && item.status === '已完成').map((item) => Number(item.paidAmount))),
        pendingReceive: paymentStat.pendingReceive,
        pendingPay: paymentStat.pendingPay,
        overdue: paymentStat.overdueTotal,
      },
    };
  }

  private async ensureReminder(data: Prisma.ContractReminderUncheckedCreateInput) {
    const existing = await this.prisma.contractReminder.findFirst({
      where: { sourceType: data.sourceType, sourceId: data.sourceId, type: data.type },
    });
    if (existing) return this.prisma.contractReminder.update({ where: { id: existing.id }, data });
    return this.prisma.contractReminder.create({ data });
  }

  private buildPaymentWhere(query: PaymentQuery): Prisma.ContractPaymentPlanWhereInput {
    const where: Prisma.ContractPaymentPlanWhereInput = {
      ...(query.direction ? { direction: query.direction } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.contractName ? { contract: { name: { contains: query.contractName } } } : {}),
      ...(query.counterparty ? { contract: { counterparty: { contains: query.counterparty } } } : {}),
    };
    this.applyDateRange(where, 'planDate', query.planDateStart, query.planDateEnd);
    return where;
  }

  private async page(modelName: string, query: PageOptions, where: any, include?: any) {
    const page = Math.max(Number(query.page || 1), 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
    const model = (this.prisma as any)[modelName];
    const [list, total] = await Promise.all([
      model.findMany({ where, include, skip: (page - 1) * pageSize, take: pageSize, orderBy: { id: 'desc' } }),
      model.count({ where }),
    ]);
    return { list, pagination: { page, pageSize, total } };
  }

  private applyDateRange(where: any, field: string, start?: string, end?: string) {
    if (!start && !end) return;
    where[field] = {
      ...(start ? { gte: new Date(start) } : {}),
      ...(end ? { lte: new Date(`${end}T23:59:59`) } : {}),
    };
  }

  private sumPaymentRows(
    rows: Array<{ direction: string; status: string; planAmount: Prisma.Decimal; paidAmount: Prisma.Decimal; planDate: Date }>,
  ) {
    const normalized = rows.map((row) => ({ ...row, status: resolvePendingStatus(row.status, row.planDate) }));
    return {
      receivableTotal: this.sum(rows.filter((item) => item.direction === '收款').map((item) => Number(item.planAmount))),
      payableTotal: this.sum(rows.filter((item) => item.direction === '付款').map((item) => Number(item.planAmount))),
      pendingReceive: this.sum(normalized.filter((item) => item.direction === '收款' && item.status !== '逾期').map(outstandingAmount)),
      pendingPay: this.sum(normalized.filter((item) => item.direction === '付款' && item.status !== '逾期').map(outstandingAmount)),
      overdueTotal: this.sum(normalized.filter((item) => item.status === '逾期').map((item) => Number(item.planAmount))),
    };
  }

  private paymentProgress(rows: Array<{ status: string; planAmount: Prisma.Decimal; paidAmount: Prisma.Decimal; planDate: Date }>) {
    return ['待处理', '已完成', '逾期'].map((status) => {
      const matched = rows.filter((item) => resolvePendingStatus(item.status, item.planDate) === status);
      const amountOf = (item: (typeof matched)[number]) => (status === '已完成' ? Number(item.paidAmount) : Number(item.planAmount));
      return { status, count: matched.length, amount: this.sum(matched.map(amountOf)) };
    });
  }

  private countBy<T extends Record<string, any>>(rows: T[], field: keyof T) {
    const map = new Map<string, number>();
    rows.forEach((row) => map.set(String(row[field]), (map.get(String(row[field])) || 0) + 1));
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }

  private monthlyAmount(rows: Array<{ signDate: Date; amount: Prisma.Decimal }>) {
    const map = new Map<string, number>();
    for (const row of rows) {
      const month = `${row.signDate.getFullYear()}-${String(row.signDate.getMonth() + 1).padStart(2, '0')}`;
      map.set(month, (map.get(month) || 0) + Number(row.amount));
    }
    return Array.from(map.entries()).map(([month, amount]) => ({ month, amount: round2(amount) }));
  }

  // 浮点数累加会产生误差（如 45271642.15999999），金额场景需四舍五入到分
  private sum(values: number[]) {
    return round2(values.reduce((total, value) => total + value, 0));
  }

  private daysFromNow(days: number) {
    const date = this.startOfToday();
    date.setDate(date.getDate() + days);
    return date;
  }

  private isWithinDays(date: Date, days: number) {
    const today = this.startOfToday();
    return date >= today && date <= this.daysFromNow(days);
  }

  private startOfToday() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private dateText(date: Date) {
    return date.toISOString().slice(0, 10);
  }
}

// 金额四舍五入到分，避免浮点数累加误差（如 45271642.15999999）直接透传到前端
function round2(value: number) {
  return Math.round(value * 100) / 100;
}

// 未结清金额：待处理/逾期计划为全额，已完成计划为「计划金额 - 累计已登记金额」的差额
function outstandingAmount(row: { status: string; planAmount: Prisma.Decimal; paidAmount: Prisma.Decimal }) {
  if (row.status !== '已完成') return Number(row.planAmount);
  return Math.max(Number(row.planAmount) - Number(row.paidAmount), 0);
}
