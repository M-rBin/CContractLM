import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BaseController } from '@/common/crud';
import { ApiOkVoid, Admin } from '@/common/decorators';
import { AgentService } from '../services/agent.service';
import { AgentSessionService } from '../services/agent-session.service';
import { AgentChatDto } from '../dto/agent.dto';

/**
 * 合同智能助手控制器
 *
 * 前缀 admin/contract/agent 派生权限点 contract:agent:*。
 * 对话与会话查询均按当前登录用户隔离。
 */
@ApiTags('合同智能助手')
@Controller('admin/contract/agent')
export class AgentController extends BaseController {
  constructor(
    private readonly agentService: AgentService,
    private readonly sessionService: AgentSessionService,
  ) {
    super();
  }

  @Post('chat')
  @ApiOperation({ summary: '发起一次对话（返回结构化回复）' })
  async chat(@Body() dto: AgentChatDto, @Admin('userId') userId: number) {
    return this.ok(await this.agentService.chat(userId, dto.sessionId, dto.question));
  }

  @Get('sessions')
  @ApiOperation({ summary: '查询我的会话列表' })
  async sessions(@Admin('userId') userId: number) {
    return this.ok(await this.sessionService.listSessions(userId));
  }

  @Get('session/:id')
  @ApiOperation({ summary: '查询会话消息记录' })
  async sessionMessages(
    @Param('id', ParseIntPipe) id: number,
    @Admin('userId') userId: number,
  ) {
    return this.ok(await this.sessionService.getSessionMessages(userId, id));
  }

  @Delete('session/:id')
  @ApiOperation({ summary: '删除会话' })
  @ApiOkVoid()
  async deleteSession(
    @Param('id', ParseIntPipe) id: number,
    @Admin('userId') userId: number,
  ) {
    await this.sessionService.deleteSession(userId, id);
    return this.ok();
  }
}
