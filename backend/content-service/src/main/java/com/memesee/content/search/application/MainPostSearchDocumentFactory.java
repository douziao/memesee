package com.memesee.content.search.application;

import com.memesee.content.community.domain.Community;
import com.memesee.content.mainpost.domain.MainPost;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class MainPostSearchDocumentFactory {

    public MainPostSearchDocument from(MainPost mainPost, Community community) {
        if (mainPost == null) {
            throw new IllegalArgumentException("mainPost must not be null.");
        }
        if (mainPost.getDeletedAt() != null) {
            throw new IllegalArgumentException("deleted main posts must not be indexed.");
        }
        if (community == null) {
            throw new IllegalArgumentException("community must not be null.");
        }
        return new MainPostSearchDocument(
                mainPost.getId(),
                community.getId(),
                community.getSlug(),
                community.getName(),
                mainPost.getAuthorUsername(),
                mainPost.getTitle(),
                mainPost.getContent(),
                copyTags(mainPost.getTags()),
                mainPost.getHeatScore(),
                mainPost.getViewCount(),
                mainPost.getSubPostCount(),
                mainPost.getLikeCount(),
                mainPost.getFavoriteCount(),
                mainPost.getCreatedAt(),
                mainPost.getUpdatedAt(),
                mainPost.getLatestActivityAt()
        );
    }

    private List<String> copyTags(List<String> tags) {
        return tags == null ? List.of() : List.copyOf(tags);
    }
}
