package com.memesee.content.common.application;

import com.memesee.content.mainpost.domain.MainPost;
import com.memesee.content.mainpost.infrastructure.MainPostRepository;
import com.memesee.content.subpost.domain.SubPost;
import com.memesee.content.subpost.infrastructure.SubPostRepository;
import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ContentReferenceAvailabilityService {

    private final MainPostRepository mainPostRepository;
    private final SubPostRepository subPostRepository;

    public ContentReferenceAvailabilityService(
            MainPostRepository mainPostRepository,
            SubPostRepository subPostRepository
    ) {
        this.mainPostRepository = mainPostRepository;
        this.subPostRepository = subPostRepository;
    }

    @Transactional(readOnly = true)
    public Set<Long> loadActiveMainPostIds(Collection<Long> mainPostIds) {
        List<Long> normalizedMainPostIds = normalizeIds(mainPostIds);
        if (normalizedMainPostIds.isEmpty()) {
            return Set.of();
        }
        return mainPostRepository.findAllByIdInAndDeletedAtIsNull(normalizedMainPostIds).stream()
                .map(MainPost::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toUnmodifiableSet());
    }

    @Transactional(readOnly = true)
    public Set<Long> loadActiveSubPostIdsWithActiveMainPost(Collection<Long> subPostIds) {
        List<Long> normalizedSubPostIds = normalizeIds(subPostIds);
        if (normalizedSubPostIds.isEmpty()) {
            return Set.of();
        }
        List<SubPost> activeSubPosts = subPostRepository.findByIdIn(normalizedSubPostIds).stream()
                .filter(subPost -> subPost.getDeletedAt() == null)
                .toList();
        if (activeSubPosts.isEmpty()) {
            return Set.of();
        }
        Set<Long> activeMainPostIds = loadActiveMainPostIds(
                activeSubPosts.stream().map(SubPost::getMainPostId).toList()
        );
        if (activeMainPostIds.isEmpty()) {
            return Set.of();
        }
        return activeSubPosts.stream()
                .filter(subPost -> activeMainPostIds.contains(subPost.getMainPostId()))
                .map(SubPost::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toUnmodifiableSet());
    }

    private List<Long> normalizeIds(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        return ids.stream()
                .filter(id -> id != null && id > 0L)
                .distinct()
                .toList();
    }
}
