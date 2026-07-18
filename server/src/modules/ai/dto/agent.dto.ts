import { IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 助手对话入参
 */
export class AgentChatDto {
  @ApiProperty({ description: '会话 ID（不传则新建会话）', required: false })
  @IsOptional()
  @IsInt()
  sessionId?: number;

  @ApiProperty({ description: '用户问题' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  question: string;
}
