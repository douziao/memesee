package com.memesee.content.notification.infrastructure;

import com.memesee.content.common.observability.ProjectionQueryMetricsRecorder;
import com.memesee.content.notification.application.NotificationListProjectionPort;
import com.memesee.content.notification.domain.ContentNotification;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(
        prefix = "app.projection.notification-list",
        name = "mode",
        havingValue = "jpa",
        matchIfMissing = true
)
public class JpaNotificationListProjectionPort implements NotificationListProjectionPort {

    private static final String PROJECTION_NAME = "notification-list";
    private static final String ADAPTER_NAME = "jpa";

    private final ContentNotificationRepository contentNotificationRepository;
    private final ProjectionQueryMetricsRecorder projectionQueryMetricsRecorder;

    public JpaNotificationListProjectionPort(
            ContentNotificationRepository contentNotificationRepository,
            ObjectProvider<ProjectionQueryMetricsRecorder> projectionQueryMetricsRecorderProvider
    ) {
        this.contentNotificationRepository = contentNotificationRepository;
        this.projectionQueryMetricsRecorder = projectionQueryMetricsRecorderProvider
                .getIfAvailable(ProjectionQueryMetricsRecorder::noop);
    }

    @Override
    public List<NotificationListItemProjection> loadNotifications(NotificationListProjectionQuery query) {
        int safeLimit = Math.max(query.limit(), 1);
        Specification<ContentNotification> specification = buildSpecification(query);
        return projectionQueryMetricsRecorder.record(
                PROJECTION_NAME,
                ADAPTER_NAME,
                "notification-list",
                () -> contentNotificationRepository.findAll(
                                specification,
                                PageRequest.of(
                                        0,
                                        safeLimit,
                                        Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))
                                )
                        ).stream()
                        .map(this::toProjection)
                        .toList()
        );
    }

    private Specification<ContentNotification> buildSpecification(NotificationListProjectionQuery query) {
        return (root, ignored, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(criteriaBuilder.equal(root.get("username"), query.username()));
            if (query.type() != null) {
                predicates.add(criteriaBuilder.equal(root.get("type"), query.type()));
            }
            if (query.actorUsername() != null) {
                predicates.add(criteriaBuilder.equal(root.get("actorUsername"), query.actorUsername()));
            }
            if (query.unread() != null) {
                predicates.add(query.unread()
                        ? criteriaBuilder.isNull(root.get("readAt"))
                        : criteriaBuilder.isNotNull(root.get("readAt")));
            }
            return criteriaBuilder.and(predicates.toArray(Predicate[]::new));
        };
    }

    private NotificationListItemProjection toProjection(ContentNotification notification) {
        return new NotificationListItemProjection(
                notification.getId(),
                notification.getType(),
                notification.getTitle(),
                notification.getBody(),
                notification.getMainPostId(),
                notification.getSubPostId(),
                notification.getActorUsername(),
                notification.getCreatedAt(),
                notification.isRead()
        );
    }
}
