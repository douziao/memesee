package com.memesee.content.community.application;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface CommunityCatalogProjectionPort {

    List<CommunityCatalogProjection> loadCommunityCatalog();

    Optional<CommunityCatalogProjection> loadCommunityBySlug(String slug);

    Optional<CommunityCatalogProjection> loadCommunityById(Long communityId);

    List<CommunityCatalogProjection> loadCommunitiesByIds(Collection<Long> communityIds);

    record CommunityCatalogProjection(
            Long id,
            String slug,
            String name,
            String description,
            int sortOrder
    ) {
    }
}
