import { Module } from '@nestjs/common';
import { ContractAttachmentController } from './controllers/contract-attachment.controller';
import { ContractAnalysisController } from './controllers/contract-analysis.controller';
import { ContractController } from './controllers/contract.controller';
import { ContractDetailController } from './controllers/contract-detail.controller';
import { ContractMilestoneController } from './controllers/contract-milestone.controller';
import { ContractOperRecordController } from './controllers/contract-oper-record.controller';
import { ContractPaymentController } from './controllers/contract-payment.controller';
import { ContractPaymentManageController } from './controllers/contract-payment-manage.controller';
import { ContractReminderController } from './controllers/contract-reminder.controller';
import { ContractWorkbenchController } from './controllers/contract-workbench.controller';
import { ContractAggregateService } from './services/contract-aggregate.service';
import { ContractDetailService } from './services/contract-detail.service';
import { ContractService } from './services/contract.service';

/**
 * 合同管理模块
 */
@Module({
  controllers: [
    ContractController,
    ContractDetailController,
    ContractAttachmentController,
    ContractMilestoneController,
    ContractPaymentController,
    ContractOperRecordController,
    ContractReminderController,
    ContractPaymentManageController,
    ContractWorkbenchController,
    ContractAnalysisController,
  ],
  providers: [ContractService, ContractDetailService, ContractAggregateService],
  exports: [ContractService, ContractDetailService, ContractAggregateService],
})
export class ContractModule {}
