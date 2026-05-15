-- CreateTable
CREATE TABLE `PendingChainTx` (
    `id` VARCHAR(191) NOT NULL,
    `bizType` VARCHAR(191) NOT NULL,
    `bizId` VARCHAR(191) NOT NULL,
    `contractName` VARCHAR(191) NOT NULL,
    `contractAddress` VARCHAR(191) NOT NULL,
    `funcName` VARCHAR(191) NOT NULL,
    `funcParam` JSON NOT NULL,
    `maxRetries` INTEGER NOT NULL DEFAULT 5,
    `retryCount` INTEGER NOT NULL DEFAULT 0,
    `nextRetryAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `lastError` VARCHAR(191) NULL,
    `confirmedTxHash` VARCHAR(191) NULL,
    `confirmedBlockHeight` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `PendingChainTx_status_nextRetryAt_idx` ON `PendingChainTx`(`status`, `nextRetryAt`);

-- CreateIndex
CREATE INDEX `PendingChainTx_bizType_bizId_idx` ON `PendingChainTx`(`bizType`, `bizId`);
