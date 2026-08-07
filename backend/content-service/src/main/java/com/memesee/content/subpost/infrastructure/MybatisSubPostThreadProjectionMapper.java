package com.memesee.content.subpost.infrastructure;

import java.util.List;
import java.sql.Timestamp;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface MybatisSubPostThreadProjectionMapper {

    @Select("""
            <script>
            SELECT
                sp.id,
                sp.main_post_id,
                sp.parent_sub_post_id,
                parent.author_username AS parent_sub_post_author_username,
                sp.author_username,
                sp.content,
                sp.like_count,
                sp.child_sub_post_count,
                sp.created_at,
                sp.updated_at
            FROM sub_posts sp
            LEFT JOIN sub_posts parent ON parent.id = sp.parent_sub_post_id
            WHERE sp.main_post_id = #{mainPostId}
              AND sp.deleted_at IS NULL
            <if test="cursorCreatedAt != null and cursorSubPostId != null">
              AND (
                sp.created_at &gt; #{cursorCreatedAt}
                OR (sp.created_at = #{cursorCreatedAt} AND sp.id &gt; #{cursorSubPostId})
              )
            </if>
            ORDER BY sp.created_at ASC, sp.id ASC
            LIMIT #{limit}
            </script>
            """)
    @Results(id = "subPostThreadProjectionRow", value = {
            @Result(property = "id", column = "id"),
            @Result(property = "mainPostId", column = "main_post_id"),
            @Result(property = "parentSubPostId", column = "parent_sub_post_id"),
            @Result(property = "parentSubPostAuthorUsername", column = "parent_sub_post_author_username"),
            @Result(property = "authorUsername", column = "author_username"),
            @Result(property = "content", column = "content"),
            @Result(property = "likeCount", column = "like_count"),
            @Result(property = "childSubPostCount", column = "child_sub_post_count"),
            @Result(property = "createdAt", column = "created_at"),
            @Result(property = "updatedAt", column = "updated_at")
    })
    List<MybatisSubPostThreadProjectionRow> selectPageByMainPostId(
            @Param("mainPostId") Long mainPostId,
            @Param("cursorCreatedAt") Timestamp cursorCreatedAt,
            @Param("cursorSubPostId") Long cursorSubPostId,
            @Param("limit") int limit
    );
}
