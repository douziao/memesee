package com.memesee.content.interaction.dto;

import java.util.List;

public record MyInteractionListResponse(
        List<MyPostInteractionItemResponse> postInteractions,
        List<MySubPostInteractionItemResponse> subPostInteractions
) {
}
