-- CreateTable
CREATE TABLE `contract_info` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `type` VARCHAR(30) NOT NULL,
    `signSubject` VARCHAR(100) NOT NULL,
    `counterparty` VARCHAR(100) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `currency` VARCHAR(20) NOT NULL DEFAULT '人民币',
    `signDate` DATETIME(3) NOT NULL,
    `effectiveDate` DATETIME(3) NOT NULL,
    `expireDate` DATETIME(3) NOT NULL,
    `ownerId` INTEGER NULL,
    `ownerName` VARCHAR(50) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT '草稿',
    `remark` VARCHAR(500) NULL,
    `tenantId` INTEGER NULL,
    `createTime` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updateTime` DATETIME(3) NOT NULL,

    UNIQUE INDEX `contract_info_code_key`(`code`),
    INDEX `contract_info_type_idx`(`type`),
    INDEX `contract_info_status_idx`(`status`),
    INDEX `contract_info_ownerId_idx`(`ownerId`),
    INDEX `contract_info_signDate_idx`(`signDate`),
    INDEX `contract_info_effectiveDate_idx`(`effectiveDate`),
    INDEX `contract_info_expireDate_idx`(`expireDate`),
    INDEX `contract_info_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_attachment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contractId` INTEGER NOT NULL,
    `category` VARCHAR(20) NOT NULL,
    `fileName` VARCHAR(200) NOT NULL,
    `filePath` VARCHAR(500) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `uploaderId` INTEGER NULL,
    `uploaderName` VARCHAR(50) NULL,
    `tenantId` INTEGER NULL,
    `createTime` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updateTime` DATETIME(3) NOT NULL,

    INDEX `contract_attachment_contractId_idx`(`contractId`),
    INDEX `contract_attachment_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_milestone` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contractId` INTEGER NOT NULL,
    `name` VARCHAR(50) NOT NULL,
    `planDate` DATETIME(3) NOT NULL,
    `actualDate` DATETIME(3) NULL,
    `ownerId` INTEGER NULL,
    `ownerName` VARCHAR(50) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT '待处理',
    `remark` VARCHAR(200) NULL,
    `completeRemark` VARCHAR(200) NULL,
    `tenantId` INTEGER NULL,
    `createTime` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updateTime` DATETIME(3) NOT NULL,

    INDEX `contract_milestone_contractId_idx`(`contractId`),
    INDEX `contract_milestone_ownerId_idx`(`ownerId`),
    INDEX `contract_milestone_planDate_idx`(`planDate`),
    INDEX `contract_milestone_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_payment_plan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contractId` INTEGER NOT NULL,
    `direction` VARCHAR(10) NOT NULL,
    `planAmount` DECIMAL(18, 2) NOT NULL,
    `planDate` DATETIME(3) NOT NULL,
    `actualAmount` DECIMAL(18, 2) NULL,
    `actualDate` DATETIME(3) NULL,
    `paidAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL DEFAULT '待处理',
    `remark` VARCHAR(200) NULL,
    `tenantId` INTEGER NULL,
    `createTime` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updateTime` DATETIME(3) NOT NULL,

    INDEX `contract_payment_plan_contractId_idx`(`contractId`),
    INDEX `contract_payment_plan_planDate_idx`(`planDate`),
    INDEX `contract_payment_plan_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_reminder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contractId` INTEGER NOT NULL,
    `type` VARCHAR(20) NOT NULL,
    `sourceId` INTEGER NULL,
    `sourceType` VARCHAR(20) NOT NULL,
    `content` VARCHAR(200) NOT NULL,
    `planDate` DATETIME(3) NOT NULL,
    `overdueStatus` VARCHAR(10) NOT NULL DEFAULT '未逾期',
    `handleStatus` VARCHAR(10) NOT NULL DEFAULT '待处理',
    `tenantId` INTEGER NULL,
    `createTime` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updateTime` DATETIME(3) NOT NULL,

    INDEX `contract_reminder_contractId_idx`(`contractId`),
    INDEX `contract_reminder_planDate_idx`(`planDate`),
    INDEX `contract_reminder_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_oper_record` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contractId` INTEGER NULL,
    `operType` VARCHAR(20) NOT NULL,
    `operTarget` VARCHAR(100) NULL,
    `operatorId` INTEGER NULL,
    `operatorName` VARCHAR(50) NULL,
    `operDesc` VARCHAR(200) NULL,
    `tenantId` INTEGER NULL,
    `createTime` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updateTime` DATETIME(3) NOT NULL,

    INDEX `contract_oper_record_contractId_idx`(`contractId`),
    INDEX `contract_oper_record_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `contract_attachment` ADD CONSTRAINT `contract_attachment_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contract_info`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_milestone` ADD CONSTRAINT `contract_milestone_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contract_info`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_payment_plan` ADD CONSTRAINT `contract_payment_plan_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contract_info`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_reminder` ADD CONSTRAINT `contract_reminder_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contract_info`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_oper_record` ADD CONSTRAINT `contract_oper_record_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contract_info`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
