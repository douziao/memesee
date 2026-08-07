package com.memesee.user.dto;

import java.util.List;

public record LevelProgressResponse(
        int currentLevel,
        Integer nextLevel,
        boolean maxLevel,
        int achievedCount,
        int totalCount,
        int completionPercent,
        List<LevelCriterionProgress> criteria
) {
}

