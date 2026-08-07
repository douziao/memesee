package com.memesee.content.interaction.infrastructure;

import com.memesee.content.interaction.domain.MainPostFavorite;
import java.util.Optional;
import java.util.Collection;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface MainPostFavoriteRepository extends JpaRepository<MainPostFavorite, Long> {

    long countByMainPostId(Long mainPostId);

    List<MainPostFavorite> findAllByMainPostIdInAndUsername(Collection<Long> mainPostIds, String username);

    List<MainPostFavorite> findAllByUsernameOrderByCreatedAtDesc(String username, Pageable pageable);

    @Query("""
            select distinct f.username
            from MainPostFavorite f
            where f.mainPostId = :mainPostId
            """)
    List<String> findDistinctUsernamesByMainPostId(@Param("mainPostId") Long mainPostId);

    Optional<MainPostFavorite> findByMainPostIdAndUsername(Long mainPostId, String username);

    @Transactional
    long deleteByMainPostIdAndUsername(Long mainPostId, String username);
}
