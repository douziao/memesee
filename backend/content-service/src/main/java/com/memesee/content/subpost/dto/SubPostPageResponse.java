package com.memesee.content.subpost.dto;

import java.util.List;

public record SubPostPageResponse(
        List<SubPostResponse> subPosts,
        String nextCursor,
        boolean hasMore
) {
}
