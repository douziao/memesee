package com.memesee.content.search.application;

record MainPostSearchSyncPayload(
        MainPostSearchSyncAction action,
        Long mainPostId,
        MainPostSearchDocument document
) {
}
