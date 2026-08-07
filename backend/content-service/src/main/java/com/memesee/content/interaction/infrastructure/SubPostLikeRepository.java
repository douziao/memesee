package com.memesee.content.interaction.infrastructure;

import com.memesee.content.interaction.domain.SubPostLike;
import java.util.Optional;
import java.util.Collection;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface SubPostLikeRepository extends JpaRepository<SubPostLike, Long> {

    long countBySubPostId(Long subPostId);

    List<SubPostLike> findAllBySubPostIdInAndUsername(Collection<Long> subPostIds, String username);

    List<SubPostLike> findAllByUsernameOrderByCreatedAtDesc(String username, Pageable pageable);

    @Query("""
            select distinct l.username
            from SubPostLike l
            where l.subPostId = :subPostId
            """)
    List<String> findDistinctUsernamesBySubPostId(@Param("subPostId") Long subPostId);

    @Query("""
            select distinct l.username
            from SubPostLike l
            where l.subPostId in (
                select sp.id
                from SubPost sp
                where sp.mainPostId = :mainPostId
            )
            """)
    List<String> findDistinctUsernamesByMainPostId(@Param("mainPostId") Long mainPostId);

    Optional<SubPostLike> findBySubPostIdAndUsername(Long subPostId, String username);

    @Transactional
    long deleteBySubPostIdAndUsername(Long subPostId, String username);
}
