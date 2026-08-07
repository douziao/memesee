package com.memesee.content.common.outbox.infrastructure;

import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.ResultMap;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface MybatisContentOutboxStatusProjectionMapper {

    @Select("""
            SELECT
                COALESCE(SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END), 0) AS pending_count,
                COALESCE(SUM(CASE WHEN status = 'PROCESSING' THEN 1 ELSE 0 END), 0) AS processing_count,
                COALESCE(SUM(CASE WHEN status = 'PROCESSED' THEN 1 ELSE 0 END), 0) AS processed_count,
                COALESCE(SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END), 0) AS failed_count
            FROM content_outbox_events
            """)
    @Results(id = "outboxBacklogRow", value = {
            @Result(property = "pendingCount", column = "pending_count"),
            @Result(property = "processingCount", column = "processing_count"),
            @Result(property = "processedCount", column = "processed_count"),
            @Result(property = "failedCount", column = "failed_count")
    })
    MybatisContentOutboxBacklogRow selectBacklog();

    @Select("""
            SELECT
                id,
                event_type,
                aggregate_type,
                aggregate_id,
                attempt_count,
                created_at,
                available_at
            FROM content_outbox_events
            WHERE status = 'PENDING'
            ORDER BY created_at ASC, id ASC
            LIMIT 1
            """)
    @Results(id = "pendingEventRow", value = {
            @Result(property = "id", column = "id"),
            @Result(property = "eventType", column = "event_type"),
            @Result(property = "aggregateType", column = "aggregate_type"),
            @Result(property = "aggregateId", column = "aggregate_id"),
            @Result(property = "attemptCount", column = "attempt_count"),
            @Result(property = "createdAt", column = "created_at"),
            @Result(property = "availableAt", column = "available_at")
    })
    MybatisContentOutboxPendingEventRow selectOldestPendingEvent();

    @Select("""
            SELECT
                id,
                event_type,
                aggregate_type,
                aggregate_id,
                attempt_count,
                created_at,
                last_error
            FROM content_outbox_events
            WHERE status = 'FAILED'
            ORDER BY created_at DESC, id DESC
            LIMIT #{limit}
            """)
    @Results(id = "failedEventRow", value = {
            @Result(property = "id", column = "id"),
            @Result(property = "eventType", column = "event_type"),
            @Result(property = "aggregateType", column = "aggregate_type"),
            @Result(property = "aggregateId", column = "aggregate_id"),
            @Result(property = "attemptCount", column = "attempt_count"),
            @Result(property = "createdAt", column = "created_at"),
            @Result(property = "lastError", column = "last_error")
    })
    List<MybatisContentOutboxFailedEventRow> selectRecentFailedEvents(@Param("limit") int limit);
}
