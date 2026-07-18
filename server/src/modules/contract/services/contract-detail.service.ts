import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '@/common/prisma.service';
import {
  AddMilestoneDto,
  AddPaymentPlanDto,
  CompleteMilestoneDto,
  RegisterPaymentPlanDto,
  UpdateMilestoneDto,
  UpdatePaymentPlanDto,
} from '../dto/contract.dto';
import { resolvePendingStatus } from '../utils/contract-status.util';

@Injectable()
export class ContractDetailService {
  constructor(private readonly prisma: PrismaService) {}

  async detail(contractId: number) {
    const data = await this.prisma.contractInfo.findUnique({
      where: { id: contractId },
      include: {
        attachments: { orderBy: { id: 'desc' } },
        milestones: { orderBy: { planDate: 'asc' } },
        payments: { orderBy: { planDate: 'asc' } },
        operRecords: { orderBy: { id: 'desc' } },
      },
    });
    if (!data) return null;
    return {
      ...data,
      payments: data.payments.map((p) =>
        this.withRemaining({ ...p, status: resolvePendingStatus(p.status, p.planDate) }),
      ),
    };
  }

  async listAttachments(contractId: number) {
    await this.ensureContract(contractId);
    return this.prisma.contractAttachment.findMany({ where: { contractId }, orderBy: { id: 'desc' } });
  }

  async uploadAttachment(dto: { contractId: number; category: string }, file: Express.Multer.File, operatorId?: number) {
    if (!file) throw new BadRequestException('请选择上传文件');
    await this.ensureContract(dto.contractId);
    const filePath = this.saveFile(file);
    return this.prisma.$transaction(async (tx) => {
      const attachment = await tx.contractAttachment.create({
        data: {
          contractId: dto.contractId,
          category: dto.category,
          fileName: file.originalname,
          filePath,
          fileSize: file.size,
          uploaderId: operatorId,
        },
      });
      await this.record(tx, dto.contractId, '附件上传', file.originalname, operatorId);
      return attachment;
    });
  }

  async deleteAttachment(id: number) {
    await this.prisma.contractAttachment.delete({ where: { id } });
  }

  async getAttachment(id: number) {
    return this.prisma.contractAttachment.findUnique({ where: { id } });
  }

  async listMilestones(contractId: number) {
    await this.ensureContract(contractId);
    const rows = await this.prisma.contractMilestone.findMany({ where: { contractId }, orderBy: { planDate: 'asc' } });
    return rows.map((row) => ({ ...row, status: resolvePendingStatus(row.status, row.planDate) }));
  }

  async addMilestone(dto: AddMilestoneDto) {
    await this.ensureContract(dto.contractId);
    return this.prisma.contractMilestone.create({
      data: {
        contractId: dto.contractId,
        name: dto.name,
        planDate: new Date(dto.planDate),
        ownerId: dto.ownerId,
        ownerName: dto.ownerName,
        status: resolvePendingStatus('待处理', dto.planDate),
        remark: dto.remark,
      },
    });
  }

  async updateMilestone(dto: UpdateMilestoneDto) {
    const { id, ...data } = dto;
    await this.ensureContract(data.contractId);
    return this.prisma.contractMilestone.update({
      where: { id },
      data: {
        contractId: data.contractId,
        name: data.name,
        planDate: new Date(data.planDate),
        ownerId: data.ownerId,
        ownerName: data.ownerName,
        status: resolvePendingStatus('待处理', data.planDate),
        remark: data.remark,
      },
    });
  }

  async completeMilestone(dto: CompleteMilestoneDto, operatorId?: number) {
    const milestone = await this.prisma.contractMilestone.findUnique({ where: { id: dto.id } });
    if (!milestone) throw new BadRequestException('履约节点不存在');
    if (milestone.status === '已完成') return milestone;
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.contractMilestone.update({
        where: { id: dto.id },
        data: {
          status: '已完成',
          actualDate: new Date(dto.actualDate),
          completeRemark: dto.completeRemark,
        },
      });
      await tx.contractReminder.updateMany({
        where: { sourceType: 'milestone', sourceId: dto.id },
        data: { handleStatus: '已处理' },
      });
      await this.record(tx, milestone.contractId, '节点完成', milestone.name, operatorId);
      return updated;
    });
  }

  async deleteMilestone(id: number) {
    await this.prisma.contractMilestone.delete({ where: { id } });
  }

  async listPayments(contractId: number) {
    await this.ensureContract(contractId);
    const rows = await this.prisma.contractPaymentPlan.findMany({ where: { contractId }, orderBy: { planDate: 'asc' } });
    return rows.map((row) => this.withRemaining({ ...row, status: resolvePendingStatus(row.status, row.planDate) }));
  }

  async addPayment(dto: AddPaymentPlanDto) {
    await this.ensureContract(dto.contractId);
    await this.assertAvailableAmount(dto.contractId, dto.direction, dto.planAmount);
    return this.prisma.contractPaymentPlan.create({
      data: {
        contractId: dto.contractId,
        direction: dto.direction,
        planAmount: new Prisma.Decimal(dto.planAmount),
        planDate: new Date(dto.planDate),
        status: resolvePendingStatus('待处理', dto.planDate),
        remark: dto.remark,
      },
    });
  }

  async updatePayment(dto: UpdatePaymentPlanDto) {
    const { id, ...data } = dto;
    await this.ensureContract(data.contractId);
    await this.assertAvailableAmount(data.contractId, data.direction, data.planAmount, id);
    return this.prisma.contractPaymentPlan.update({
      where: { id },
      data: {
        contractId: data.contractId,
        direction: data.direction,
        planAmount: new Prisma.Decimal(data.planAmount),
        planDate: new Date(data.planDate),
        status: resolvePendingStatus('待处理', data.planDate),
        remark: data.remark,
      },
    });
  }

  // 校验计划金额是否超出该方向下的可用金额：合同金额 - 同方向其他计划金额之和（编辑时排除自身）
  private async assertAvailableAmount(contractId: number, direction: string, planAmount: number, excludeId?: number) {
    const contract = await this.prisma.contractInfo.findUnique({ where: { id: contractId }, select: { amount: true } });
    if (!contract) throw new BadRequestException('关联合同不存在');
    const others = await this.prisma.contractPaymentPlan.findMany({
      where: { contractId, direction, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { planAmount: true },
    });
    const usedAmount = others.reduce((total, item) => total.add(item.planAmount), new Prisma.Decimal(0));
    const availableAmount = contract.amount.sub(usedAmount);
    if (new Prisma.Decimal(planAmount).greaterThan(availableAmount)) {
      throw new BadRequestException(`计划金额超出可用金额，当前可用金额为 ${availableAmount.toFixed(2)}`);
    }
  }

  async registerPayment(dto: RegisterPaymentPlanDto, operatorId?: number) {
    return this.prisma.$transaction(async (tx) => {
      // SELECT ... FOR UPDATE 加悲观行锁，防止并发登记导致 paidAmount 超限
      const [payment] = await tx.$queryRaw<Array<{
        id: number; contractId: number; planAmount: string; paidAmount: string; status: string; direction: string;
      }>>`SELECT id, contractId, planAmount, paidAmount, status, direction FROM contract_payment_plan WHERE id = ${dto.id} FOR UPDATE`;
      if (!payment) throw new BadRequestException('收付款计划不存在');
      if (payment.status === '已完成') throw new BadRequestException('该收付款计划已完成，无法继续登记');

      const newPaid = new Prisma.Decimal(payment.paidAmount).add(new Prisma.Decimal(dto.actualAmount));
      const plan = new Prisma.Decimal(payment.planAmount);
      if (newPaid.gt(plan)) {
        throw new BadRequestException(`登记金额不能超过剩余金额 ${plan.sub(payment.paidAmount).toFixed(2)}`);
      }
      const isDone = newPaid.gte(plan);

      const updated = await tx.contractPaymentPlan.update({
        where: { id: dto.id },
        data: {
          paidAmount: newPaid,
          actualAmount: new Prisma.Decimal(dto.actualAmount),
          actualDate: new Date(dto.actualDate),
          status: isDone ? '已完成' : payment.status,
        },
      });
      await this.record(tx, payment.contractId, '收付款登记', payment.direction, operatorId);
      return this.withRemaining(updated);
    });
  }

  async deletePayment(id: number) {
    await this.prisma.contractPaymentPlan.delete({ where: { id } });
  }

  async listRecords(contractId: number) {
    return this.prisma.contractOperRecord.findMany({ where: { contractId }, orderBy: { id: 'desc' } });
  }

  private withRemaining<T extends { planAmount: Prisma.Decimal; paidAmount: Prisma.Decimal }>(row: T) {
    const remaining = new Prisma.Decimal(row.planAmount).sub(row.paidAmount);
    return { ...row, remainingAmount: remaining.toFixed(2) };
  }

  private async ensureContract(contractId: number) {
    const contract = await this.prisma.contractInfo.findUnique({ where: { id: contractId }, select: { id: true } });
    if (!contract) throw new BadRequestException('关联合同不存在');
  }

  private saveFile(file: Express.Multer.File) {
    const dir = join(process.cwd(), 'uploads', 'contract');
    mkdirSync(dir, { recursive: true });
    const safeName = `${Date.now()}-${file.originalname.replace(/[^\w.\-\u4e00-\u9fa5]/g, '_')}`;
    const filePath = join(dir, safeName);
    writeFileSync(filePath, file.buffer);
    return filePath;
  }

  private async record(tx: Prisma.TransactionClient, contractId: number, operType: string, operTarget?: string, operatorId?: number) {
    let operatorName: string | undefined;
    if (operatorId) {
      const user = await tx.sysUser.findUnique({ where: { id: operatorId }, select: { nickName: true, username: true } });
      operatorName = user?.nickName || user?.username || undefined;
    }
    await tx.contractOperRecord.create({
      data: { contractId, operType, operTarget, operatorId, operatorName },
    });
  }
}
