package com.memesee.content.interaction.infrastructure;

import com.memesee.content.interaction.domain.SubPostFavorite;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface SubPostFavoriteRepository extends JpaRepository<SubPostFavorite, Long> {

    long countBySubPostId(Long subPostId);

    List<SubPostFavorite> findAllBySubPostIdInAndUsername(Collection<Long> subPostIds, String username);

    List<SubPostFavorite> findAllByUsernameOrderByCreatedAtDesc(String username, Pageable pageable);

    @Query("""
            select distinct f.username
            from SubPostFavorite f
            where f.subPostId = :subPostId
            """)
    List<String> findDistinctUsernamesBySubPostId(@Param("subPostId") Long subPostId);

    @Query("""
            select distinct f.username
            from SubPostFavorite f
            where f.subPostId in (
                select sp.id
                from SubPost sp
                where sp.mainPostId = :mainPostId
            )
            """)
    List<String> findDistinctUsernamesByMainPostId(@Param("mainPostId") Long mainPostId);

    Optional<SubPostFavorite> findBySubPostIdAndUsername(Long subPostId, String username);

    @Transactional
    long deleteBySubPostIdAndUsername(Long subPostId, String username);

    @Query("""
            select f.subPostId as targetId, count(f) as totalCount
            from SubPostFavorite f
            where f.subPostId in :subPostIds
            group by f.subPostId
            """)
    List<TargetCountView> countAllBySubPostIdIn(@Param("subPostIds") Collection<Long> subPostIds);

    interface TargetCountView {
        Long getTargetId();
        long getTotalCount();
    }
}
