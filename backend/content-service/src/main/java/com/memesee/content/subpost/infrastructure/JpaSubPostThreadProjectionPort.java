package com.memesee.content.subpost.infrastructure;

import com.memesee.content.common.observability.ProjectionQueryMetricsRecorder;
import com.memesee.content.subpost.application.SubPostThreadProjectionPort;
import com.memesee.content.subpost.domain.SubPost;
import java.time.Instant;
import java.util.Map;
import java.util.List;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(prefix = "app.projection.sub-post-thread", name = "mode", havingValue = "jpa")
public class JpaSubPostThreadProjectionPort implements SubPostThreadProjectionPort {

    private static final String PROJECTION_NAME = "sub-post-thread";
    private static final String ADAPTER_NAME = "jpa";

    private final SubPostRepository subPostRepository;
    private final ProjectionQueryMetricsRecorder projectionQueryMetricsRecorder;

    public JpaSubPostThreadProjectionPort(
            SubPostRepository subPostRepository,
            ObjectProvider<ProjectionQueryMetricsRecorder> projectionQueryMetricsRecorderProvider
    ) {
        this.subPostRepository = subPostRepository;
        this.projectionQueryMetricsRecorder = projectionQueryMetricsRecorderProvider
                .getIfAvailable(ProjectionQueryMetricsRecorder::noop);
    }

    @Override
    public List<SubPostThreadProjection> loadThreadPage(
            Long mainPostId,
            Instant cursorCreatedAt,
            Long cursorSubPostId,
            int limit
    ) {
        if (mainPostId == null || limit <= 0) {
            return List.of();
        }
        return projectionQueryMetricsRecorder.record(
                PROJECTION_NAME,
                ADAPTER_NAME,
                "thread-page",
                () -> {
                    List<SubPost> subPosts = subPostRepository.findThreadPage(
                            mainPostId,
                            cursorCreatedAt,
                            cursorSubPostId,
                            PageRequest.of(0, limit)
                    );
                    Map<Long, SubPost> parentSubPostsById = subPostRepository.findByIdIn(
                                    subPosts.stream()
                                            .map(SubPost::getParentSubPostId)
                                            .filter(parentSubPostId -> parentSubPostId != null)
                                            .distinct()
                                            .toList()
                            )
                            .stream()
                            .collect(Collectors.toMap(SubPost::getId, Function.identity()));
                    return subPosts.stream()
                            .map(subPost -> toProjection(subPost, parentSubPostsById))
                            .toList();
                }
        );
    }

    private SubPostThreadProjection toProjection(SubPost subPost, Map<Long, SubPost> parentSubPostsById) {
        SubPost parentSubPost = parentSubPostsById.get(subPost.getParentSubPostId());
        return new SubPostThreadProjection(
                subPost.getId(),
                subPost.getMainPostId(),
                subPost.getParentSubPostId(),
                parentSubPost == null ? null : parentSubPost.getAuthorUsername(),
                subPost.getAuthorUsername(),
                subPost.getContent(),
                subPost.getLikeCount(),
                subPost.getChildSubPostCount(),
                subPost.getCreatedAt(),
                subPost.getUpdatedAt()
        );
    }
}
