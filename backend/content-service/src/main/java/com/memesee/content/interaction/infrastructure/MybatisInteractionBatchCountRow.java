package com.memesee.content.interaction.infrastructure;

public class MybatisInteractionBatchCountRow {

    private Long targetId;
    private Long totalCount;

    public Long getTargetId() {
        return targetId;
    }

    public void setTargetId(Long targetId) {
        this.targetId = targetId;
    }

    public Long getTotalCount() {
        return totalCount;
    }

    public void setTotalCount(Long totalCount) {
        this.totalCount = totalCount;
    }
}
