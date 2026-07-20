-- CreateTable: contract_agent_session / message / sql_audit
CREATE TABLE IF NOT EXISTS `contract_agent_session` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NOT NULL,
  `title` VARCHAR(100) NOT NULL,
  `tenantId` INTEGER NULL,
  `createTime` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updateTime` DATETIME(3) NOT NULL,
  INDEX `contract_agent_session_userId_idx`(`userId`),
  INDEX `contract_agent_session_tenantId_idx`(`tenantId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `contract_agent_message` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `sessionId` INTEGER NOT NULL,
  `role` VARCHAR(20) NOT NULL,
  `contentType` VARCHAR(20) NOT NULL,
  `content` JSON NOT NULL,
  `createTime` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `contract_agent_message_sessionId_idx`(`sessionId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `contract_agent_message_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `contract_agent_session`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `contract_agent_sql_audit` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NOT NULL,
  `question` VARCHAR(500) NOT NULL,
  `generatedSql` TEXT NULL,
  `rowCount` INTEGER NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL,
  `errorMsg` VARCHAR(500) NULL,
  `tenantId` INTEGER NULL,
  `createTime` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `contract_agent_sql_audit_userId_idx`(`userId`),
  INDEX `contract_agent_sql_audit_status_idx`(`status`),
  INDEX `contract_agent_sql_audit_tenantId_idx`(`tenantId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
