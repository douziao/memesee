package com.memesee.content.interaction.infrastructure;

import com.memesee.content.interaction.domain.MainPostLike;
import java.util.Optional;
import java.util.Collection;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface MainPostLikeRepository extends JpaRepository<MainPostLike, Long> {

    long countByMainPostId(Long mainPostId);

    List<MainPostLike> findAllByMainPostIdInAndUsername(Collection<Long> mainPostIds, String username);

    List<MainPostLike> findAllByUsernameOrderByCreatedAtDesc(String username, Pageable pageable);

    @Query("""
            select distinct l.username
            from MainPostLike l
            where l.mainPostId = :mainPostId
            """)
    List<String> findDistinctUsernamesByMainPostId(@Param("mainPostId") Long mainPostId);

    Optional<MainPostLike> findByMainPostIdAndUsername(Long mainPostId, String username);

    @Transactional
    long deleteByMainPostIdAndUsername(Long mainPostId, String username);
}
