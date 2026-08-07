package com.memesee.content.subpost.infrastructure;

import com.memesee.content.subpost.domain.SubPost;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SubPostRepository extends JpaRepository<SubPost, Long> {

    @Query("""
            select subPost
            from SubPost subPost
            where subPost.mainPostId = :mainPostId
              and subPost.deletedAt is null
              and (
                :cursorCreatedAt is null
                or subPost.createdAt > :cursorCreatedAt
                or (subPost.createdAt = :cursorCreatedAt and subPost.id > :cursorSubPostId)
              )
            order by subPost.createdAt asc, subPost.id asc
            """)
    List<SubPost> findThreadPage(
            @Param("mainPostId") Long mainPostId,
            @Param("cursorCreatedAt") java.time.Instant cursorCreatedAt,
            @Param("cursorSubPostId") Long cursorSubPostId,
            Pageable pageable
    );

    List<SubPost> findByIdIn(List<Long> ids);

    List<SubPost> findByAuthorUsernameAndDeletedAtIsNullOrderByCreatedAtDescIdDesc(String authorUsername, Pageable pageable);

    Optional<SubPost> findFirstByMainPostIdAndDeletedAtIsNullOrderByCreatedAtDescIdDesc(Long mainPostId);

    Optional<SubPost> findByIdAndDeletedAtIsNull(Long id);
}
