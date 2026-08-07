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
        havingValue = "mybatis",
        matchIfMissing = true
)
public class MybatisNotificationUnreadCountProjectionPort implements NotificationUnreadCountProjectionPort {

    private static final String PROJECTION_NAME = "notification-unread-count";
    private static final String ADAPTER_NAME = "mybatis";

    private final MybatisNotificationUnreadCountProjectionMapper mybatisNotificationUnreadCountProjectionMapper;
    private final ProjectionQueryMetricsRecorder projectionQueryMetricsRecorder;

    public MybatisNotificationUnreadCountProjectionPort(
            MybatisNotificationUnreadCountProjectionMapper mybatisNotificationUnreadCountProjectionMapper,
            ObjectProvider<ProjectionQueryMetricsRecorder> projectionQueryMetricsRecorderProvider
    ) {
        this.mybatisNotificationUnreadCountProjectionMapper = mybatisNotificationUnreadCountProjectionMapper;
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
                () -> mybatisNotificationUnreadCountProjectionMapper.selectUnreadCount(username)
        );
    }
}
