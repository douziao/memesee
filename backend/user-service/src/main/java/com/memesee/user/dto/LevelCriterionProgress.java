package com.memesee.user.dto;

public record LevelCriterionProgress(
        String key,
        String label,
        long current,
        long required,
        String unit,
        boolean achieved
) {
}

