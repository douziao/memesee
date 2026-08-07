package com.memesee.content.community.infrastructure;

import java.util.Collection;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.ResultMap;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface MybatisCommunityCatalogProjectionMapper {

    @Select("""
            SELECT
                id,
                slug,
                name,
                description,
                sort_order
            FROM communities
            ORDER BY sort_order ASC, id ASC
            """)
    @Results(id = "communityCatalogProjectionRow", value = {
            @Result(property = "id", column = "id"),
            @Result(property = "slug", column = "slug"),
            @Result(property = "name", column = "name"),
            @Result(property = "description", column = "description"),
            @Result(property = "sortOrder", column = "sort_order")
    })
    List<MybatisCommunityCatalogProjectionRow> selectCommunityCatalog();

    @Select("""
            SELECT
                id,
                slug,
                name,
                description,
                sort_order
            FROM communities
            WHERE slug = #{slug}
            """)
    @ResultMap("communityCatalogProjectionRow")
    MybatisCommunityCatalogProjectionRow selectCommunityBySlug(@Param("slug") String slug);

    @Select("""
            SELECT
                id,
                slug,
                name,
                description,
                sort_order
            FROM communities
            WHERE id = #{communityId}
            """)
    @ResultMap("communityCatalogProjectionRow")
    MybatisCommunityCatalogProjectionRow selectCommunityById(@Param("communityId") Long communityId);

    @Select("""
            <script>
            SELECT
                id,
                slug,
                name,
                description,
                sort_order
            FROM communities
            WHERE id IN
              <foreach item="communityId" collection="communityIds" open="(" separator="," close=")">
                #{communityId}
              </foreach>
            ORDER BY sort_order ASC, id ASC
            </script>
            """)
    @ResultMap("communityCatalogProjectionRow")
    List<MybatisCommunityCatalogProjectionRow> selectCommunitiesByIds(@Param("communityIds") Collection<Long> communityIds);
}
