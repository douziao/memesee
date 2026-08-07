package com.memesee.content.feed.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MainPostFeedItemRepository extends JpaRepository<MainPostFeedItem, Long> {

    @Modifying
    @Query(value = """
            UPDATE main_post_feed_items
            SET heat_score = ROUND(((view_count + :delta) * 0.1) + like_count + (favorite_count * 2) + (sub_post_count * 3), 6),
                view_count = view_count + :delta,
                projection_updated_at = CURRENT_TIMESTAMP(6)
            WHERE main_post_id = :mainPostId
              AND deleted_at IS NULL
            """, nativeQuery = true)
    int incrementViewStats(@Param("mainPostId") Long mainPostId, @Param("delta") long delta);

    @Modifying
    @Query(value = """
            UPDATE main_post_feed_items
            SET media_assets_json = :mediaAssetsJson,
                projection_updated_at = CURRENT_TIMESTAMP(6)
            WHERE main_post_id = :mainPostId
              AND deleted_at IS NULL
            """, nativeQuery = true)
    int updateMediaAssetsJson(@Param("mainPostId") Long mainPostId, @Param("mediaAssetsJson") String mediaAssetsJson);
}
