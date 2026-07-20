-- 为操作日志表新增操作说明字段
ALTER TABLE `base_sys_log` ADD COLUMN `description` VARCHAR(200) NULL;
