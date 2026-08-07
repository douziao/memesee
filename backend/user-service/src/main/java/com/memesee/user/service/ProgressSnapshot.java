package com.memesee.user.service;

public record ProgressSnapshot(
        long visitedCommunitiesAll,
        long readPostsAll,
        long readSecondsAll,
        long activeDaysAll,
        long likesGivenAll,
        long likesReceivedAll,
        long mainPostCommunitiesAll,
        long activeDaysRecent100,
        long likesGivenRecent100,
        long likesReceivedRecent100,
        long viewedPostsRecent100,
        long mainPostCommunitiesRecent100,
        long level3RequiredViewedPosts
) {
}

