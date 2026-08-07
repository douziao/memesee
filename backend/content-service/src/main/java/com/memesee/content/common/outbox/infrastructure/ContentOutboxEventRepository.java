package com.memesee.content.common.outbox.infrastructure;

import com.memesee.content.common.outbox.domain.ContentOutboxEvent;
import com.memesee.content.common.outbox.domain.ContentOutboxEventStatus;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ContentOutboxEventRepository extends JpaRepository<ContentOutboxEvent, Long> {

    long countByStatus(ContentOutboxEventStatus status);

    List<ContentOutboxEvent> findAllByStatusAndAvailableAtLessThanEqualOrderByIdAsc(
            ContentOutboxEventStatus status,
            Instant availableAt,
            Pageable pageable
    );

    List<ContentOutboxEvent> findAllByStatusAndEventTypeAndAvailableAtLessThanEqualOrderByIdAsc(
            ContentOutboxEventStatus status,
            String eventType,
            Instant availableAt,
            Pageable pageable
    );

    List<ContentOutboxEvent> findAllByStatusOrderByIdAsc(
            ContentOutboxEventStatus status,
            Pageable pageable
    );

    List<ContentOutboxEvent> findAllByStatusAndAttemptCountLessThanOrderByIdAsc(
            ContentOutboxEventStatus status,
            int attemptCount,
            Pageable pageable
    );

    List<ContentOutboxEvent> findAllByStatusOrderByCreatedAtDescIdDesc(
            ContentOutboxEventStatus status,
            Pageable pageable
    );

    Optional<ContentOutboxEvent> findFirstByStatusOrderByCreatedAtAscIdAsc(ContentOutboxEventStatus status);
}
