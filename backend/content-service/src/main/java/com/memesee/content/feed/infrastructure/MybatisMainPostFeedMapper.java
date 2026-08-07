package com.memesee.content.feed.infrastructure;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.ResultMap;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface MybatisMainPostFeedMapper {

    @Select("""
            <script>
            SELECT
                main_post_id,
                community_slug,
                community_name,
                title,
                content_preview,
                post_mode,
                author_username,
                tags_json,
                media_assets_json,
                preview_image_urls_json,
                heat_score,
                view_count,
                sub_post_count,
                like_count,
                favorite_count,
                created_at,
                updated_at,
                latest_activity_at
            FROM main_post_feed_items
            WHERE deleted_at IS NULL
            <if test="communitySlug != null">
              AND community_slug = #{communitySlug}
            </if>
            <if test="authorUsername != null">
              AND author_username = #{authorUsername}
            </if>
            <if test="keyword != null">
              AND (
                LOWER(title) LIKE CONCAT('%', #{keyword}, '%')
                OR LOWER(content_preview) LIKE CONCAT('%', #{keyword}, '%')
                OR LOWER(author_username) LIKE CONCAT('%', #{keyword}, '%')
              )
            </if>
            <choose>
              <when test='sortMode == "MOST_VIEWS"'>
                <if test="cursorViewCount != null and cursorCreatedAt != null and cursorMainPostId != null">
                  AND (
                    view_count &lt; #{cursorViewCount}
                    OR (view_count = #{cursorViewCount} AND created_at &lt; #{cursorCreatedAt})
                    OR (view_count = #{cursorViewCount} AND created_at = #{cursorCreatedAt} AND main_post_id &lt; #{cursorMainPostId})
                  )
                </if>
                ORDER BY view_count DESC, created_at DESC, main_post_id DESC
              </when>
              <when test='sortMode == "MOST_HEAT"'>
                <if test="cursorHeatScore != null and cursorCreatedAt != null and cursorMainPostId != null">
                  AND (
                    heat_score &lt; #{cursorHeatScore}
                    OR (heat_score = #{cursorHeatScore} AND created_at &lt; #{cursorCreatedAt})
                    OR (heat_score = #{cursorHeatScore} AND created_at = #{cursorCreatedAt} AND main_post_id &lt; #{cursorMainPostId})
                  )
                </if>
                ORDER BY heat_score DESC, created_at DESC, main_post_id DESC
              </when>
              <otherwise>
                <if test="cursorLatestActivityAt != null and cursorMainPostId != null">
                  AND (
                    latest_activity_at &lt; #{cursorLatestActivityAt}
                    OR (latest_activity_at = #{cursorLatestActivityAt} AND main_post_id &lt; #{cursorMainPostId})
                  )
                </if>
                ORDER BY latest_activity_at DESC, main_post_id DESC
              </otherwise>
            </choose>
            LIMIT #{limit}
            </script>
            """)
    @Results(id = "mainPostFeedItemRow", value = {
            @Result(property = "mainPostId", column = "main_post_id"),
            @Result(property = "communitySlug", column = "community_slug"),
            @Result(property = "communityName", column = "community_name"),
            @Result(property = "title", column = "title"),
            @Result(property = "contentPreview", column = "content_preview"),
            @Result(property = "postMode", column = "post_mode"),
            @Result(property = "authorUsername", column = "author_username"),
            @Result(property = "tagsJson", column = "tags_json"),
            @Result(property = "mediaAssetsJson", column = "media_assets_json"),
            @Result(property = "previewImageUrlsJson", column = "preview_image_urls_json"),
            @Result(property = "heatScore", column = "heat_score"),
            @Result(property = "viewCount", column = "view_count"),
            @Result(property = "subPostCount", column = "sub_post_count"),
            @Result(property = "likeCount", column = "like_count"),
            @Result(property = "favoriteCount", column = "favorite_count"),
            @Result(property = "createdAt", column = "created_at"),
            @Result(property = "updatedAt", column = "updated_at"),
            @Result(property = "latestActivityAt", column = "latest_activity_at")
    })
    List<MybatisMainPostFeedItemRow> selectFeed(
            @Param("communitySlug") String communitySlug,
            @Param("authorUsername") String authorUsername,
            @Param("keyword") String keyword,
            @Param("sortMode") String sortMode,
            @Param("cursorMainPostId") Long cursorMainPostId,
            @Param("cursorLatestActivityAt") Timestamp cursorLatestActivityAt,
            @Param("cursorCreatedAt") Timestamp cursorCreatedAt,
            @Param("cursorHeatScore") BigDecimal cursorHeatScore,
            @Param("cursorViewCount") Long cursorViewCount,
            @Param("limit") int limit
    );

    @Select("""
            <script>
            SELECT
                main_post_id,
                community_slug,
                community_name,
                title,
                content_preview,
                post_mode,
                author_username,
                tags_json,
                media_assets_json,
                preview_image_urls_json,
                heat_score,
                view_count,
                sub_post_count,
                like_count,
                favorite_count,
                created_at,
                updated_at,
                latest_activity_at
            FROM main_post_feed_items
            WHERE deleted_at IS NULL
            <if test="communitySlug != null">
              AND community_slug = #{communitySlug}
            </if>
            <if test="keyword != null">
              AND (
                LOWER(title) LIKE CONCAT('%', #{keyword}, '%')
                OR LOWER(content_preview) LIKE CONCAT('%', #{keyword}, '%')
                OR LOWER(author_username) LIKE CONCAT('%', #{keyword}, '%')
              )
            </if>
            <choose>
              <when test='sortMode == "MOST_VIEWS"'>
                ORDER BY view_count DESC, created_at DESC, main_post_id DESC
              </when>
              <when test='sortMode == "MOST_HEAT"'>
                ORDER BY heat_score DESC, created_at DESC, main_post_id DESC
              </when>
              <otherwise>
                ORDER BY latest_activity_at DESC, main_post_id DESC
              </otherwise>
            </choose>
            LIMIT #{limit} OFFSET #{offset}
            </script>
            """)
    @ResultMap("mainPostFeedItemRow")
    List<MybatisMainPostFeedItemRow> selectFeedSearchOffset(
            @Param("communitySlug") String communitySlug,
            @Param("keyword") String keyword,
            @Param("sortMode") String sortMode,
            @Param("limit") int limit,
            @Param("offset") int offset
    );

    @Select("""
            <script>
            SELECT
                main_post_id,
                community_slug,
                community_name,
                title,
                content_preview,
                post_mode,
                author_username,
                tags_json,
                media_assets_json,
                preview_image_urls_json,
                heat_score,
                view_count,
                sub_post_count,
                like_count,
                favorite_count,
                created_at,
                updated_at,
                latest_activity_at
            FROM main_post_feed_items
            WHERE deleted_at IS NULL
              AND main_post_id IN
              <foreach collection="mainPostIds" item="mainPostId" open="(" separator="," close=")">
                #{mainPostId}
              </foreach>
            </script>
            """)
    @ResultMap("mainPostFeedItemRow")
    List<MybatisMainPostFeedItemRow> selectFeedByIds(@Param("mainPostIds") List<Long> mainPostIds);
}
