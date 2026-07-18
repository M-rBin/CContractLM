-- CreateTable
CREATE TABLE IF NOT EXISTS `ai_config` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `provider` VARCHAR(30) NOT NULL,
    `model` VARCHAR(100) NOT NULL,
    `apiKey` VARCHAR(500) NOT NULL,
    `baseUrl` VARCHAR(200) NULL,
    `modelType` VARCHAR(10) NOT NULL DEFAULT 'text',
    `isDefault` INTEGER NOT NULL DEFAULT 0,
    `isEnabled` INTEGER NOT NULL DEFAULT 1,
    `tenantId` INTEGER NULL,
    `createTime` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updateTime` DATETIME(3) NOT NULL,

    INDEX `ai_config_isDefault_idx`(`isDefault`),
    INDEX `ai_config_isEnabled_idx`(`isEnabled`),
    INDEX `ai_config_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
