package com.memesee.content.common.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.memesee.content.mainpost.domain.MainPost;
import com.memesee.content.mainpost.infrastructure.MainPostRepository;
import com.memesee.content.subpost.domain.SubPost;
import com.memesee.content.subpost.infrastructure.SubPostRepository;
import java.lang.reflect.Field;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;

class ContentReferenceAvailabilityServiceTest {

    private final MainPostRepository mainPostRepository = mock(MainPostRepository.class);
    private final SubPostRepository subPostRepository = mock(SubPostRepository.class);
    private final ContentReferenceAvailabilityService service =
            new ContentReferenceAvailabilityService(mainPostRepository, subPostRepository);

    @Test
    void loadActiveMainPostIdsNormalizesIdsAndKeepsOnlyRepositoryActivePosts() {
        when(mainPostRepository.findAllByIdInAndDeletedAtIsNull(anyCollection()))
                .thenReturn(List.of(mainPost(42L)));

        assertThat(service.loadActiveMainPostIds(Arrays.asList(null, -1L, 0L, 42L, 42L, 99L)))
                .containsExactly(42L);
    }

    @Test
    void loadActiveSubPostIdsRequiresActiveSubPostAndActiveParentMainPost() {
        when(subPostRepository.findByIdIn(anyList()))
                .thenReturn(List.of(
                        subPost(7L, 42L, false),
                        subPost(8L, 42L, true),
                        subPost(9L, 99L, false)
                ));
        when(mainPostRepository.findAllByIdInAndDeletedAtIsNull(anyCollection()))
                .thenReturn(List.of(mainPost(42L)));

        assertThat(service.loadActiveSubPostIdsWithActiveMainPost(List.of(7L, 8L, 9L)))
                .containsExactly(7L);
    }

    private static MainPost mainPost(Long id) {
        MainPost mainPost = new MainPost(1L, "author", "title", "content");
        setField(mainPost, "id", id);
        return mainPost;
    }

    private static SubPost subPost(Long id, Long mainPostId, boolean deleted) {
        SubPost subPost = new SubPost(mainPostId, null, "author", "content");
        setField(subPost, "id", id);
        if (deleted) {
            subPost.markDeleted();
        }
        return subPost;
    }

    private static void setField(Object target, String fieldName, Object value) {
        try {
            Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (ReflectiveOperationException error) {
            throw new AssertionError("Unable to set field " + fieldName, error);
        }
    }
}
