package com.memesee.content.common.outbox.infrastructure;

public class MybatisContentOutboxBacklogRow {

    private Long pendingCount;
    private Long processingCount;
    private Long processedCount;
    private Long failedCount;

    public Long getPendingCount() {
        return pendingCount;
    }

    public void setPendingCount(Long pendingCount) {
        this.pendingCount = pendingCount;
    }

    public Long getProcessingCount() {
        return processingCount;
    }

    public void setProcessingCount(Long processingCount) {
        this.processingCount = processingCount;
    }

    public Long getProcessedCount() {
        return processedCount;
    }

    public void setProcessedCount(Long processedCount) {
        this.processedCount = processedCount;
    }

    public Long getFailedCount() {
        return failedCount;
    }

    public void setFailedCount(Long failedCount) {
        this.failedCount = failedCount;
    }
}
