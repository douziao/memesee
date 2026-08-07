package com.memesee.content.search.application;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.memesee.content.community.domain.Community;
import com.memesee.content.mainpost.domain.MainPost;
import org.junit.jupiter.api.Test;

class MainPostSearchDocumentFactoryTest {

    private final MainPostSearchDocumentFactory factory = new MainPostSearchDocumentFactory();

    @Test
    void rejectsDeletedMainPostBeforeBuildingSearchDocument() {
        MainPost mainPost = new MainPost(10L, "author", "stale title", "stale content");
        mainPost.markDeleted();
        Community community = Community.snapshot(10L, "memes", "梗图", "description", 0);

        assertThatThrownBy(() -> factory.from(mainPost, community))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("deleted main posts must not be indexed.");
    }
}
