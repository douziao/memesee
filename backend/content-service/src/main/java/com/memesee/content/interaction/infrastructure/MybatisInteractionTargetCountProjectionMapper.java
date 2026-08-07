package com.memesee.content.interaction.infrastructure;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface MybatisInteractionTargetCountProjectionMapper {

    @Select("""
            SELECT COUNT(*)
            FROM main_post_likes
            WHERE main_post_id = #{mainPostId}
            """)
    long selectMainPostLikeCount(@Param("mainPostId") Long mainPostId);

    @Select("""
            SELECT COUNT(*)
            FROM main_post_favorites
            WHERE main_post_id = #{mainPostId}
            """)
    long selectMainPostFavoriteCount(@Param("mainPostId") Long mainPostId);

    @Select("""
            SELECT COUNT(*)
            FROM sub_post_likes
            WHERE sub_post_id = #{subPostId}
            """)
    long selectSubPostLikeCount(@Param("subPostId") Long subPostId);

    @Select("""
            SELECT COUNT(*)
            FROM sub_post_favorites
            WHERE sub_post_id = #{subPostId}
            """)
    long selectSubPostFavoriteCount(@Param("subPostId") Long subPostId);
}
