package com.memesee.content.mainpost.infrastructure;

import com.memesee.content.mainpost.domain.MainPost;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MainPostRepository extends JpaRepository<MainPost, Long>, JpaSpecificationExecutor<MainPost> {

    Page<MainPost> findByDeletedAtIsNull(Pageable pageable);

    Page<MainPost> findByCommunityIdAndDeletedAtIsNull(Long communityId, Pageable pageable);

    Page<MainPost> findByAuthorUsernameAndDeletedAtIsNull(String authorUsername, Pageable pageable);

    Page<MainPost> findByCommunityIdAndAuthorUsernameAndDeletedAtIsNull(Long communityId, String authorUsername, Pageable pageable);

    List<MainPost> findAllByIdInAndDeletedAtIsNull(Collection<Long> ids);

    Page<MainPost> findAllByOrderByIdAsc(Pageable pageable);

    Page<MainPost> findByDeletedAtIsNullOrderByIdAsc(Pageable pageable);

    Optional<MainPost> findByIdAndDeletedAtIsNull(Long id);

    @Modifying
    @Query(value = """
            UPDATE main_posts
            SET heat_score = ROUND(((view_count + :delta) * 0.1) + like_count + (favorite_count * 2) + (sub_post_count * 3), 6),
                view_count = view_count + :delta
            WHERE id = :id
              AND deleted_at IS NULL
            """, nativeQuery = true)
    int incrementViewStats(@Param("id") Long id, @Param("delta") long delta);
}
