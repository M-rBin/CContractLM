import { BadRequestException, Controller, Delete, Get, Param, ParseIntPipe, Post, Res, Body, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { createReadStream } from 'fs';
import { Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BaseController } from '@/common/crud';
import { Admin, Perms } from '@/common/decorators';
import { AddAttachmentDto } from '../dto/contract.dto';
import { ContractDetailService } from '../services/contract-detail.service';

@ApiTags('合同附件')
@Controller('admin/contract/attachment')
export class ContractAttachmentController extends BaseController {
  constructor(private readonly contractDetailService: ContractDetailService) {
    super();
  }

  @Get('list/:contractId')
  @Perms('list')
  @ApiOperation({ summary: '查询合同附件列表' })
  async list(@Param('contractId', ParseIntPipe) contractId: number) {
    return this.ok(await this.contractDetailService.listAttachments(contractId));
  }

  @Post('upload')
  @Perms('upload')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }))
  @ApiOperation({ summary: '上传合同附件' })
  async upload(@Body() dto: AddAttachmentDto, @UploadedFile() file: Express.Multer.File, @Admin('userId') userId?: number) {
    if (!file) throw new BadRequestException('请上传文件');
    // multer 以 latin1 解码文件名，中文会乱码，修正为 utf-8
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    return this.ok(await this.contractDetailService.uploadAttachment(dto, file, userId));
  }

  @Get('download/:id')
  @Perms('download')
  @ApiOperation({ summary: '下载合同附件' })
  async download(@Param('id', ParseIntPipe) id: number, @Res() res: Response): Promise<void> {
    const attachment = await this.contractDetailService.getAttachment(id);
    if (!attachment) {
      res.status(404).send('附件不存在');
      return;
    }
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`);
    const stream = createReadStream(attachment.filePath);
    stream.on('error', () => {
      if (res.headersSent) {
        res.end();
      } else {
        res.status(404).send('文件不存在或已被移除');
      }
    });
    stream.pipe(res);
  }

  @Delete('delete/:id')
  @Perms('delete')
  @ApiOperation({ summary: '删除合同附件' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.contractDetailService.deleteAttachment(id);
    return this.ok();
  }
}
