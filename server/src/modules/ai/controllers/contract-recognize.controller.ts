import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';
import { BaseController } from '@/common/crud';
import { ApiResult, Perms } from '@/common/decorators';
import { ContractRecognizeService } from '../services/contract-recognize.service';
import { RecognizeResultVo } from '../vo/recognize.vo';

/** 允许的 PDF 单文件大小上限：20MB */
const MAX_PDF_SIZE = 20 * 1024 * 1024;

/**
 * 合同智能识别控制器
 *
 * 前缀 admin/contract/ai 派生权限点 contract:ai:*。
 * 仅接收 PDF，内存缓冲不落盘，识别结果不持久化。
 */
@ApiTags('合同智能识别')
@Controller('admin/contract/ai')
export class ContractRecognizeController extends BaseController {
  constructor(private readonly service: ContractRecognizeService) {
    super();
  }

  @Post('recognize')
  @Perms('recognize')
  @ApiOperation({ summary: '上传合同 PDF 进行智能识别' })
  @ApiConsumes('multipart/form-data')
  @ApiResult(RecognizeResultVo)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_PDF_SIZE },
    }),
  )
  async recognize(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('请上传合同 PDF 文件');
    }
    const isPdf =
      file.mimetype === 'application/pdf' ||
      file.originalname?.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      throw new BadRequestException('仅支持 PDF 格式的合同文件');
    }
    return this.ok(await this.service.recognize(file.buffer));
  }
}
