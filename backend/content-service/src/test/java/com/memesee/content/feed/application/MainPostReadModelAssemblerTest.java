package com.memesee.content.feed.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.memesee.content.community.domain.Community;
import com.memesee.content.mainpost.domain.MainPost;
import com.memesee.content.mainpost.dto.MainPostDetailResponse;
import com.memesee.content.mainpost.dto.MainPostSummaryResponse;
import com.memesee.content.media.dto.MediaAssetResponse;
import java.lang.reflect.Field;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class MainPostReadModelAssemblerTest {

    private final MainPostReadModelAssembler assembler = new MainPostReadModelAssembler();

    @Test
    void extractsMarkdownAndHtmlPreviewImagesInContentOrderWithLimitAndDedupe() {
        String content = """
                开头 ![a](https://cdn.example.com/a.webp)
                <img alt="b" src='https://cdn.example.com/b.webp'>
                ![dup](https://cdn.example.com/a.webp)
                <img src="https://cdn.example.com/c.webp">
                ![overflow](https://cdn.example.com/d.webp)
                """;

        assertThat(assembler.extractPreviewImageUrls(content)).containsExactly(
                "https://cdn.example.com/a.webp",
                "https://cdn.example.com/b.webp",
                "https://cdn.example.com/c.webp"
        );
    }

    @Test
    void mapsSummaryAndDetailReadModelsConsistently() {
        MainPost post = new MainPost(
                10L,
                "alice",
                "一次产品迭代",
                "这里是正文 ![图](https://cdn.example.com/a.webp) [链接](https://memesee.world)",
                List.of("产品", "迭代"),
                "rich"
        );
        writeField(post, "id", 42L);
        writeField(post, "createdAt", Instant.parse("2026-06-08T00:00:00Z"));
        writeField(post, "updatedAt", Instant.parse("2026-06-08T00:01:00Z"));
        writeField(post, "latestActivityAt", Instant.parse("2026-06-08T00:02:00Z"));
        Community community = Community.snapshot(10L, "memes", "梗图", "description", 0);
        MediaAssetResponse mediaAsset = new MediaAssetResponse(
                7L,
                "asset-7",
                "IMAGE",
                "https://cdn.example.com/display.webp",
                "https://cdn.example.com/thumb.webp",
                "https://cdn.example.com/small.webp",
                "https://cdn.example.com/medium.webp",
                "https://cdn.example.com/display.webp",
                "https://cdn.example.com/original.jpg",
                "image/webp",
                "image.jpg",
                1024L,
                640,
                480,
                "READY",
                "",
                List.of()
        );

        MainPostReadModel readModel = assembler.assemble(post, community, true, false, List.of(mediaAsset));
        MainPostSummaryResponse summary = assembler.toSummary(readModel);
        MainPostDetailResponse detail = assembler.toDetail(readModel);

        assertThat(summary.id()).isEqualTo(42L);
        assertThat(summary.communitySlug()).isEqualTo("memes");
        assertThat(summary.communityName()).isEqualTo("梗图");
        assertThat(summary.contentPreview()).isEqualTo("这里是正文 链接");
        assertThat(summary.postMode()).isEqualTo("rich");
        assertThat(summary.likedByMe()).isTrue();
        assertThat(summary.favoritedByMe()).isFalse();
        assertThat(summary.mediaAssets()).containsExactly(mediaAsset);
        assertThat(summary.previewImageUrls()).containsExactly("https://cdn.example.com/a.webp");
        assertThat(summary.tags()).containsExactly("产品", "迭代");

        assertThat(detail.id()).isEqualTo(summary.id());
        assertThat(detail.communitySlug()).isEqualTo(summary.communitySlug());
        assertThat(detail.postMode()).isEqualTo(summary.postMode());
        assertThat(detail.likedByMe()).isEqualTo(summary.likedByMe());
        assertThat(detail.favoritedByMe()).isEqualTo(summary.favoritedByMe());
        assertThat(detail.mediaAssets()).hasSize(1);
        assertThat(detail.mediaAssets().get(0).id()).isEqualTo(mediaAsset.id());
        assertThat(detail.tags()).containsExactlyElementsOf(summary.tags());
    }

    private static void writeField(Object target, String fieldName, Object value) {
        try {
            Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (ReflectiveOperationException exception) {
            throw new AssertionError("Unable to set field " + fieldName, exception);
        }
    }
}
