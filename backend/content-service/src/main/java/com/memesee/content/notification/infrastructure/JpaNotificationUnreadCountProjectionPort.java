package com.memesee.content.notification.infrastructure;

import com.memesee.content.common.observability.ProjectionQueryMetricsRecorder;
import com.memesee.content.notification.application.NotificationUnreadCountProjectionPort;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(
        prefix = "app.projection.notification-unread-count",
        name = "mode",
        havingValue = "jpa"
)
public class JpaNotificationUnreadCountProjectionPort implements NotificationUnreadCountProjectionPort {

    private static final String PROJECTION_NAME = "notification-unread-count";
    private static final String ADAPTER_NAME = "jpa";

    private final ContentNotificationRepository contentNotificationRepository;
    private final ProjectionQueryMetricsRecorder projectionQueryMetricsRecorder;

    public JpaNotificationUnreadCountProjectionPort(
            ContentNotificationRepository contentNotificationRepository,
            ObjectProvider<ProjectionQueryMetricsRecorder> projectionQueryMetricsRecorderProvider
    ) {
        this.contentNotificationRepository = contentNotificationRepository;
        this.projectionQueryMetricsRecorder = projectionQueryMetricsRecorderProvider
                .getIfAvailable(ProjectionQueryMetricsRecorder::noop);
    }

    @Override
    public long loadUnreadCount(String username) {
        if (username == null || username.isBlank()) {
            return 0L;
        }
        return projectionQueryMetricsRecorder.record(
                PROJECTION_NAME,
                ADAPTER_NAME,
                "unread-count",
                () -> contentNotificationRepository.countByUsernameAndReadAtIsNull(username)
        );
    }
}
