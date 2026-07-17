import { Module } from '@nestjs/common';
import { AiConfigController } from './controllers/ai-config.controller';
import { ContractRecognizeController } from './controllers/contract-recognize.controller';
import { AgentController } from './controllers/agent.controller';
import { AiService } from './services/ai.service';
import { AiConfigService } from './services/ai-config.service';
import { ContractRecognizeService } from './services/contract-recognize.service';
import { CryptoService } from './services/crypto.service';
import { PdfExtractService } from './services/pdf-extract.service';
import { ReadonlyDbService } from './services/readonly-db.service';
import { AgentService } from './services/agent.service';
import { AgentIntentService } from './services/agent-intent.service';
import { AgentSessionService } from './services/agent-session.service';
import { AgentNavigateService } from './services/agent-navigate.service';
import { TextToSqlService } from './services/text-to-sql.service';

/**
 * AI 能力模块
 *
 * 聚合 AI 基础设施与上层能力：
 *  - 基础设施：AiService（多提供商适配）、CryptoService（密钥加解密）、
 *    ReadonlyDbService（只读执行底座）、PdfExtractService（PDF 提取）
 *  - AI 配置管理：AiConfigService
 *  - 合同智能识别：ContractRecognizeService
 *  - 合同智能助手：AgentService 及意图/问数/导航/会话子服务
 */
@Module({
  controllers: [AiConfigController, ContractRecognizeController, AgentController],
  providers: [
    AiService,
    AiConfigService,
    ContractRecognizeService,
    CryptoService,
    PdfExtractService,
    ReadonlyDbService,
    AgentService,
    AgentIntentService,
    AgentSessionService,
    AgentNavigateService,
    TextToSqlService,
  ],
  exports: [AiService, AiConfigService, CryptoService, ReadonlyDbService],
})
export class AiModule {}
