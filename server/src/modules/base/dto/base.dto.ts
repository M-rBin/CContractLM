import {
  IsInt,
  IsPositive,
  IsArray,
  IsOptional,
  IsString,
  ValidateIf,
  MaxLength,
  IsEmail,
  ArrayNotEmpty,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * 移动用户部门接口入参
 * 用于将指定用户迁移到目标部门。
 */
export class MoveUserDto {
  @ApiProperty({ description: '用户 ID' })
  @IsInt()
  @IsPositive()
  userId: number;

  @ApiProperty({ description: '目标部门 ID' })
  @IsInt()
  @IsPositive()
  departmentId: number;
}

/**
 * 设置角色菜单权限接口入参
 * 用于为角色全量分配菜单（权限）。
 */
export class SetMenusDto {
  @ApiProperty({ description: '角色 ID' })
  @IsInt()
  @IsPositive()
  roleId: number;

  @ApiProperty({ description: '菜单 ID 列表' })
  @IsArray()
  @IsInt({ each: true })
  menuIds: number[];
}

/**
 * 新增用户接口入参
 * 用户名、密码必填，其余资料字段及角色分配可选；邮箱填写时校验格式。
 */
export class AddUserDto {
  @ApiProperty({ description: '用户名' })
  @IsString()
  @MaxLength(100)
  username: string;

  @ApiProperty({ description: '密码' })
  @IsString()
  @MaxLength(128)
  password: string;

  @ApiProperty({ description: '姓名', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @ApiProperty({ description: '昵称', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nickName?: string;

  @ApiProperty({ description: '手机号', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiProperty({ description: '邮箱', required: false })
  // 非必填：仅当传入非空值时才校验邮箱格式（避免空串穿透 @IsOptional 触发格式报错）
  @ValidateIf((o) => o.email !== undefined && o.email !== null && o.email !== '')
  @IsEmail({}, { message: '邮箱格式不正确' })
  @MaxLength(200)
  email?: string;

  @ApiProperty({ description: '部门 ID', required: false })
  @IsOptional()
  @IsInt()
  departmentId?: number;

  @ApiProperty({ description: '岗位 ID', required: false })
  @IsOptional()
  @IsInt()
  positionId?: number;

  @ApiProperty({ description: '角色 ID 列表', required: false })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  roleIds?: number[];
}

/**
 * 更新用户接口入参
 * 通过用户 ID 定位，其余字段均为可选（仅更新传入字段）；邮箱填写时校验格式；
 * roleIds 传入时全量替换用户角色。
 */
export class UpdateUserDto {
  @ApiProperty({ description: '用户 ID' })
  @IsInt()
  @IsPositive()
  id: number;

  @ApiProperty({ description: '姓名', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @ApiProperty({ description: '昵称', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nickName?: string;

  @ApiProperty({ description: '手机号', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiProperty({ description: '邮箱', required: false })
  // 非必填：仅当传入非空值时才校验邮箱格式（避免空串穿透 @IsOptional 触发格式报错）
  @ValidateIf((o) => o.email !== undefined && o.email !== null && o.email !== '')
  @IsEmail({}, { message: '邮箱格式不正确' })
  @MaxLength(200)
  email?: string;

  @ApiProperty({ description: '部门 ID', required: false })
  @IsOptional()
  @IsInt()
  departmentId?: number;

  @ApiProperty({ description: '岗位 ID', required: false })
  @IsOptional()
  @IsInt()
  positionId?: number;

  @ApiProperty({ description: '备注', required: false })
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiProperty({ description: '角色 ID 列表', required: false })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  roleIds?: number[];
}

/**
 * 批量设置用户岗位接口入参
 * 用于将多个用户统一设置为指定岗位。
 */
export class BatchSetUserPositionDto {
  @ApiProperty({ description: '用户 ID 列表' })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  ids: number[];

  @ApiProperty({ description: '岗位 ID' })
  @IsInt()
  @IsPositive()
  positionId: number;
}

/**
 * 批量设置用户角色接口入参
 * 用于将多个用户的角色全量替换为指定角色列表。
 */
export class BatchSetUserRolesDto {
  @ApiProperty({ description: '用户 ID 列表' })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  ids: number[];

  @ApiProperty({ description: '角色 ID 列表' })
  @IsArray()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  roleIds: number[];
}

/**
 * 导入用户行数据
 * 前端从 Excel 解析后提交结构化行数据，后端负责校验唯一性、密码加密和角色关联。
 */
export class ImportUserRowDto {
  @ApiProperty({ description: '用户名' })
  @IsString()
  @MaxLength(100)
  username: string;

  @ApiProperty({ description: '密码' })
  @IsString()
  @MaxLength(128)
  password: string;

  @ApiProperty({ description: '姓名', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @ApiProperty({ description: '手机号', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiProperty({ description: '邮箱', required: false })
  @ValidateIf((o) => o.email !== undefined && o.email !== null && o.email !== '')
  @IsEmail({}, { message: '邮箱格式不正确' })
  @MaxLength(200)
  email?: string;

  @ApiProperty({ description: '部门 ID', required: false })
  @IsOptional()
  @IsInt()
  departmentId?: number;

  @ApiProperty({ description: '岗位 ID', required: false })
  @IsOptional()
  @IsInt()
  positionId?: number;

  @ApiProperty({ description: '角色 ID 列表', required: false })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  roleIds?: number[];
}

/**
 * 用户导入接口入参
 */
export class ImportUsersDto {
  @ApiProperty({ description: '导入用户行数据', type: [ImportUserRowDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ImportUserRowDto)
  rows: ImportUserRowDto[];
}
