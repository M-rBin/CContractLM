-- CreateTable
CREATE TABLE `base_sys_tenant` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `remark` VARCHAR(200) NULL,
    `createTime` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updateTime` DATETIME(3) NOT NULL,

    UNIQUE INDEX `base_sys_tenant_code_key`(`code`),
    INDEX `base_sys_tenant_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `base_sys_user_tenant` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `tenantId` INTEGER NOT NULL,

    UNIQUE INDEX `base_sys_user_tenant_userId_tenantId_key`(`userId`, `tenantId`),
    INDEX `base_sys_user_tenant_userId_idx`(`userId`),
    INDEX `base_sys_user_tenant_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `base_sys_user_tenant` ADD CONSTRAINT `base_sys_user_tenant_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `base_sys_user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `base_sys_user_tenant` ADD CONSTRAINT `base_sys_user_tenant_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `base_sys_tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
