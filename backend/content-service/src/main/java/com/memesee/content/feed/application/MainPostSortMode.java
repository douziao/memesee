package com.memesee.content.feed.application;

import java.util.Locale;
import org.springframework.data.domain.Sort;

public enum MainPostSortMode {
    LATEST_MESSAGE,
    MOST_VIEWS,
    MOST_HEAT;

    public static MainPostSortMode from(String rawSortMode) {
        String normalizedSortMode = String.valueOf(rawSortMode == null ? "" : rawSortMode)
                .trim()
                .toLowerCase(Locale.ROOT);
        return switch (normalizedSortMode) {
            case "most_views" -> MOST_VIEWS;
            case "most_heat" -> MOST_HEAT;
            case "latest_message", "" -> LATEST_MESSAGE;
            default -> LATEST_MESSAGE;
        };
    }

    public Sort toSort() {
        return switch (this) {
            case MOST_VIEWS -> Sort.by(Sort.Order.desc("viewCount"), Sort.Order.desc("createdAt"), Sort.Order.desc("id"));
            case MOST_HEAT -> Sort.by(Sort.Order.desc("heatScore"), Sort.Order.desc("createdAt"), Sort.Order.desc("id"));
            case LATEST_MESSAGE -> Sort.by(Sort.Order.desc("latestActivityAt"), Sort.Order.desc("id"));
        };
    }
}
