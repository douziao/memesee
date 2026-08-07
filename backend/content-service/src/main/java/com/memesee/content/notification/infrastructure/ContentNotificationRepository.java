package com.memesee.content.notification.infrastructure;

import com.memesee.content.notification.domain.ContentNotification;
import com.memesee.content.notification.domain.NotificationType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ContentNotificationRepository
        extends JpaRepository<ContentNotification, Long>, JpaSpecificationExecutor<ContentNotification> {

    long countByUsernameAndReadAtIsNull(String username);

    List<ContentNotification> findAllByUsername(String username);

    Optional<ContentNotification> findByIdAndUsername(Long id, String username);

    @Query("""
            select distinct notification.username
            from ContentNotification notification
            where notification.mainPostId = :mainPostId
            """)
    List<String> findDistinctUsernamesByMainPostId(@Param("mainPostId") Long mainPostId);

    @Query("""
            select distinct notification.username
            from ContentNotification notification
            where notification.subPostId = :subPostId
            """)
    List<String> findDistinctUsernamesBySubPostId(@Param("subPostId") Long subPostId);

    boolean existsByUsernameAndTypeAndActorUsernameAndMainPostIdAndSubPostId(
            String username,
            NotificationType type,
            String actorUsername,
            Long mainPostId,
            Long subPostId
    );

    boolean existsByUsernameAndTypeAndActorUsernameAndMainPostIdAndSubPostIdIsNull(
            String username,
            NotificationType type,
            String actorUsername,
            Long mainPostId
    );
}
