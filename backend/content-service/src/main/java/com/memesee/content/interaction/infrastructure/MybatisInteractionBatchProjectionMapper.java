package com.memesee.content.interaction.infrastructure;

import java.util.Collection;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.ResultMap;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface MybatisInteractionBatchProjectionMapper {

    @Select("""
            <script>
            SELECT
                target_id,
                interaction_type
            FROM (
                SELECT
                    like_row.main_post_id AS target_id,
                    'LIKE' AS interaction_type
                FROM main_post_likes like_row
                WHERE like_row.username = #{username}
                  AND like_row.main_post_id IN
                  <foreach item="mainPostId" collection="mainPostIds" open="(" separator="," close=")">
                    #{mainPostId}
                  </foreach>
                UNION ALL
                SELECT
                    favorite_row.main_post_id AS target_id,
                    'FAVORITE' AS interaction_type
                FROM main_post_favorites favorite_row
                WHERE favorite_row.username = #{username}
                  AND favorite_row.main_post_id IN
                  <foreach item="mainPostId" collection="mainPostIds" open="(" separator="," close=")">
                    #{mainPostId}
                  </foreach>
            ) interactions
            ORDER BY target_id ASC, interaction_type ASC
            </script>
            """)
    @Results(id = "interactionBatchTargetRow", value = {
            @Result(property = "targetId", column = "target_id"),
            @Result(property = "interactionType", column = "interaction_type")
    })
    List<MybatisInteractionBatchTargetRow> selectMainPostViewerInteractions(
            @Param("mainPostIds") Collection<Long> mainPostIds,
            @Param("username") String username
    );

    @Select("""
            <script>
            SELECT
                sub_post_id AS target_id,
                COUNT(*) AS total_count
            FROM sub_post_favorites
            WHERE sub_post_id IN
              <foreach item="subPostId" collection="subPostIds" open="(" separator="," close=")">
                #{subPostId}
              </foreach>
            GROUP BY sub_post_id
            ORDER BY sub_post_id ASC
            </script>
            """)
    @Results(id = "interactionBatchCountRow", value = {
            @Result(property = "targetId", column = "target_id"),
            @Result(property = "totalCount", column = "total_count")
    })
    List<MybatisInteractionBatchCountRow> selectSubPostFavoriteCounts(@Param("subPostIds") Collection<Long> subPostIds);

    @Select("""
            <script>
            SELECT
                target_id,
                interaction_type
            FROM (
                SELECT
                    like_row.sub_post_id AS target_id,
                    'LIKE' AS interaction_type
                FROM sub_post_likes like_row
                WHERE like_row.username = #{username}
                  AND like_row.sub_post_id IN
                  <foreach item="subPostId" collection="subPostIds" open="(" separator="," close=")">
                    #{subPostId}
                  </foreach>
                UNION ALL
                SELECT
                    favorite_row.sub_post_id AS target_id,
                    'FAVORITE' AS interaction_type
                FROM sub_post_favorites favorite_row
                WHERE favorite_row.username = #{username}
                  AND favorite_row.sub_post_id IN
                  <foreach item="subPostId" collection="subPostIds" open="(" separator="," close=")">
                    #{subPostId}
                  </foreach>
            ) interactions
            ORDER BY target_id ASC, interaction_type ASC
            </script>
            """)
    @ResultMap("interactionBatchTargetRow")
    List<MybatisInteractionBatchTargetRow> selectSubPostViewerInteractions(
            @Param("subPostIds") Collection<Long> subPostIds,
            @Param("username") String username
    );
}
