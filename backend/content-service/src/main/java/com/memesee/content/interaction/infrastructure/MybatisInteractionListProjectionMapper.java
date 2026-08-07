package com.memesee.content.interaction.infrastructure;

import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface MybatisInteractionListProjectionMapper {

    @Select("""
            <script>
            SELECT
                interactions.main_post_id AS post_id,
                mp.title AS post_title,
                COALESCE(c.name, '') AS community_name,
                LEFT(REPLACE(REPLACE(mp.content, CHAR(13), ' '), CHAR(10), ' '), 120) AS content_preview,
                mp.author_username AS author_username,
                mp.created_at AS created_at,
                mp.latest_activity_at AS latest_activity_at,
                mp.view_count AS view_count,
                mp.sub_post_count AS sub_post_count,
                mp.like_count AS like_count,
                mp.favorite_count AS favorite_count,
                interactions.action AS action,
                interactions.interacted_at AS interacted_at
            FROM (
                SELECT
                    merged.main_post_id,
                    merged.action,
                    merged.interacted_at,
                    merged.action_rank
                FROM (
                    SELECT
                        main_post_id,
                        'like' AS action,
                        created_at AS interacted_at,
                        0 AS action_rank
                    FROM main_post_likes
                    WHERE username = #{username}
                    UNION ALL
                    SELECT
                        main_post_id,
                        'favorite' AS action,
                        created_at AS interacted_at,
                        1 AS action_rank
                    FROM main_post_favorites
                    WHERE username = #{username}
                ) merged
                ORDER BY merged.interacted_at DESC, merged.action_rank ASC, merged.main_post_id DESC
                LIMIT #{limit}
            ) interactions
            LEFT JOIN main_posts mp ON mp.id = interactions.main_post_id
            LEFT JOIN communities c ON c.id = mp.community_id
            WHERE mp.id IS NOT NULL
              AND mp.deleted_at IS NULL
            ORDER BY interactions.interacted_at DESC, interactions.action_rank ASC, interactions.main_post_id DESC
            </script>
            """)
    @Results(id = "postInteractionProjectionRow", value = {
            @Result(property = "postId", column = "post_id"),
            @Result(property = "postTitle", column = "post_title"),
            @Result(property = "communityName", column = "community_name"),
            @Result(property = "contentPreview", column = "content_preview"),
            @Result(property = "authorUsername", column = "author_username"),
            @Result(property = "createdAt", column = "created_at"),
            @Result(property = "latestActivityAt", column = "latest_activity_at"),
            @Result(property = "viewCount", column = "view_count"),
            @Result(property = "subPostCount", column = "sub_post_count"),
            @Result(property = "likeCount", column = "like_count"),
            @Result(property = "favoriteCount", column = "favorite_count"),
            @Result(property = "action", column = "action"),
            @Result(property = "interactedAt", column = "interacted_at")
    })
    List<MybatisPostInteractionProjectionRow> selectPostInteractions(
            @Param("username") String username,
            @Param("limit") int limit
    );

    @Select("""
            <script>
            SELECT
                interactions.sub_post_id AS sub_post_id,
                sp.main_post_id AS main_post_id,
                COALESCE(mp.title, '主帖') AS post_title,
                COALESCE(c.slug, '') AS main_post_community_slug,
                COALESCE(c.name, '') AS main_post_community_name,
                LEFT(REPLACE(REPLACE(mp.content, CHAR(13), ' '), CHAR(10), ' '), 120) AS main_post_content_preview,
                COALESCE(mp.author_username, '') AS main_post_author_username,
                mp.created_at AS main_post_created_at,
                mp.latest_activity_at AS main_post_latest_activity_at,
                COALESCE(mp.view_count, 0) AS main_post_view_count,
                COALESCE(mp.sub_post_count, 0) AS main_post_sub_post_count,
                COALESCE(mp.like_count, 0) AS main_post_like_count,
                COALESCE(mp.favorite_count, 0) AS main_post_favorite_count,
                sp.author_username AS sub_post_author_username,
                sp.content AS sub_post_content,
                interactions.action AS action,
                interactions.interacted_at AS interacted_at
            FROM (
                SELECT
                    merged.sub_post_id,
                    merged.action,
                    merged.interacted_at,
                    merged.action_rank
                FROM (
                    SELECT
                        sub_post_id,
                        'like' AS action,
                        created_at AS interacted_at,
                        0 AS action_rank
                    FROM sub_post_likes
                    WHERE username = #{username}
                    UNION ALL
                    SELECT
                        sub_post_id,
                        'favorite' AS action,
                        created_at AS interacted_at,
                        1 AS action_rank
                    FROM sub_post_favorites
                    WHERE username = #{username}
                ) merged
                ORDER BY merged.interacted_at DESC, merged.action_rank ASC, merged.sub_post_id DESC
                LIMIT #{limit}
            ) interactions
            LEFT JOIN sub_posts sp ON sp.id = interactions.sub_post_id
            LEFT JOIN main_posts mp ON mp.id = sp.main_post_id
              AND mp.deleted_at IS NULL
            LEFT JOIN communities c ON c.id = mp.community_id
            WHERE sp.id IS NOT NULL
              AND sp.deleted_at IS NULL
              AND mp.id IS NOT NULL
            ORDER BY interactions.interacted_at DESC, interactions.action_rank ASC, interactions.sub_post_id DESC
            </script>
            """)
    @Results(id = "subPostInteractionProjectionRow", value = {
            @Result(property = "subPostId", column = "sub_post_id"),
            @Result(property = "mainPostId", column = "main_post_id"),
            @Result(property = "postTitle", column = "post_title"),
            @Result(property = "mainPostCommunitySlug", column = "main_post_community_slug"),
            @Result(property = "mainPostCommunityName", column = "main_post_community_name"),
            @Result(property = "mainPostContentPreview", column = "main_post_content_preview"),
            @Result(property = "mainPostAuthorUsername", column = "main_post_author_username"),
            @Result(property = "mainPostCreatedAt", column = "main_post_created_at"),
            @Result(property = "mainPostLatestActivityAt", column = "main_post_latest_activity_at"),
            @Result(property = "mainPostViewCount", column = "main_post_view_count"),
            @Result(property = "mainPostSubPostCount", column = "main_post_sub_post_count"),
            @Result(property = "mainPostLikeCount", column = "main_post_like_count"),
            @Result(property = "mainPostFavoriteCount", column = "main_post_favorite_count"),
            @Result(property = "subPostAuthorUsername", column = "sub_post_author_username"),
            @Result(property = "subPostContent", column = "sub_post_content"),
            @Result(property = "action", column = "action"),
            @Result(property = "interactedAt", column = "interacted_at")
    })
    List<MybatisSubPostInteractionProjectionRow> selectSubPostInteractions(
            @Param("username") String username,
            @Param("limit") int limit
    );
}
