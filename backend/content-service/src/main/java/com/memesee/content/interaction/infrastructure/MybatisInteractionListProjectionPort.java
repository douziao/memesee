package com.memesee.content.interaction.infrastructure;

import com.memesee.content.common.observability.ProjectionQueryMetricsRecorder;
import com.memesee.content.interaction.application.InteractionListProjectionPort;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(
        prefix = "app.projection.interaction-list",
        name = "mode",
        havingValue = "mybatis",
        matchIfMissing = true
)
public class MybatisInteractionListProjectionPort implements InteractionListProjectionPort {

    private static final int SUB_POST_PREVIEW_LIMIT = 120;
    private static final String PROJECTION_NAME = "interaction-list";
    private static final String ADAPTER_NAME = "mybatis";

    private final MybatisInteractionListProjectionMapper mybatisInteractionListProjectionMapper;
    private final ProjectionQueryMetricsRecorder projectionQueryMetricsRecorder;

    public MybatisInteractionListProjectionPort(
            MybatisInteractionListProjectionMapper mybatisInteractionListProjectionMapper,
            ObjectProvider<ProjectionQueryMetricsRecorder> projectionQueryMetricsRecorderProvider
    ) {
        this.mybatisInteractionListProjectionMapper = mybatisInteractionListProjectionMapper;
        this.projectionQueryMetricsRecorder = projectionQueryMetricsRecorderProvider
                .getIfAvailable(ProjectionQueryMetricsRecorder::noop);
    }

    @Override
    public InteractionListProjection loadInteractionList(String username, int limit) {
        List<MybatisPostInteractionProjectionRow> postRows = projectionQueryMetricsRecorder.record(
                PROJECTION_NAME,
                ADAPTER_NAME,
                "post-interactions",
                () -> mybatisInteractionListProjectionMapper.selectPostInteractions(username, limit)
        );
        List<PostInteractionProjection> postInteractions = postRows
                .stream()
                .map(this::toPostProjection)
                .toList();
        List<MybatisSubPostInteractionProjectionRow> subPostRows = projectionQueryMetricsRecorder.record(
                PROJECTION_NAME,
                ADAPTER_NAME,
                "sub-post-interactions",
                () -> mybatisInteractionListProjectionMapper.selectSubPostInteractions(username, limit)
        );
        List<SubPostInteractionProjection> subPostInteractions = subPostRows
                .stream()
                .map(this::toSubPostProjection)
                .toList();
        return new InteractionListProjection(postInteractions, subPostInteractions);
    }

    private PostInteractionProjection toPostProjection(MybatisPostInteractionProjectionRow row) {
        return new PostInteractionProjection(
                row.getPostId(),
                row.getPostTitle(),
                row.getCommunityName(),
                row.getContentPreview(),
                row.getAuthorUsername(),
                toInstant(row.getCreatedAt()),
                toInstant(row.getLatestActivityAt()),
                row.getViewCount(),
                row.getSubPostCount(),
                row.getLikeCount(),
                row.getFavoriteCount(),
                row.getAction(),
                toInstant(row.getInteractedAt())
        );
    }

    private SubPostInteractionProjection toSubPostProjection(MybatisSubPostInteractionProjectionRow row) {
        return new SubPostInteractionProjection(
                row.getSubPostId(),
                row.getMainPostId(),
                row.getPostTitle(),
                row.getMainPostCommunitySlug(),
                row.getMainPostCommunityName(),
                row.getMainPostContentPreview(),
                row.getMainPostAuthorUsername(),
                toInstant(row.getMainPostCreatedAt()),
                toInstant(row.getMainPostLatestActivityAt()),
                row.getMainPostViewCount(),
                row.getMainPostSubPostCount(),
                row.getMainPostLikeCount(),
                row.getMainPostFavoriteCount(),
                row.getSubPostAuthorUsername(),
                summarizeSubPost(row.getSubPostContent()),
                row.getAction(),
                toInstant(row.getInteractedAt())
        );
    }

    private Instant toInstant(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toInstant();
    }

    private String summarizeSubPost(String content) {
        String normalizedContent = String.valueOf(content == null ? "" : content)
                .replaceAll("\\s+", " ")
                .trim();
        if (normalizedContent.isEmpty()) {
            return "";
        }
        if (normalizedContent.length() <= SUB_POST_PREVIEW_LIMIT) {
            return normalizedContent;
        }
        return normalizedContent.substring(0, SUB_POST_PREVIEW_LIMIT - 3) + "...";
    }
}
