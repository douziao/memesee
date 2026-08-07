package com.memesee.content.search.application;

import java.util.List;

public interface MainPostSearchIndexer {

    void upsert(MainPostSearchDocument document);

    default void upsertAll(List<MainPostSearchDocument> documents) {
        if (documents == null || documents.isEmpty()) {
            return;
        }
        for (MainPostSearchDocument document : documents) {
            upsert(document);
        }
    }

    void delete(Long mainPostId);

    void clearAll();
}
