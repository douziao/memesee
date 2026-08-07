package com.memesee.content.media.infrastructure;

import java.util.Collection;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.ResultMap;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface MybatisMediaAssetMetadataProjectionMapper {

    @Select("""
            SELECT
                id AS asset_id,
                public_id AS public_id,
                owner_username AS owner_username,
                kind AS kind,
                bucket_name AS bucket_name,
                object_key AS object_key,
                original_filename AS original_filename,
                content_type AS content_type,
                size_bytes AS size_bytes,
                processing_status AS processing_status,
                blur_data_url AS blur_data_url
            FROM media_assets
            WHERE id = #{assetId}
              AND status = 'ACTIVE'
            LIMIT 1
            """)
    @Results(id = "mediaAssetMetadataProjectionRow", value = {
            @Result(property = "assetId", column = "asset_id"),
            @Result(property = "publicId", column = "public_id"),
            @Result(property = "ownerUsername", column = "owner_username"),
            @Result(property = "kind", column = "kind"),
            @Result(property = "bucketName", column = "bucket_name"),
            @Result(property = "objectKey", column = "object_key"),
            @Result(property = "originalFilename", column = "original_filename"),
            @Result(property = "contentType", column = "content_type"),
            @Result(property = "sizeBytes", column = "size_bytes"),
            @Result(property = "processingStatus", column = "processing_status"),
            @Result(property = "blurDataUrl", column = "blur_data_url")
    })
    MybatisMediaAssetMetadataProjectionRow selectActiveMediaAsset(@Param("assetId") Long assetId);

    @Select("""
            <script>
            SELECT
                id AS asset_id,
                public_id AS public_id,
                owner_username AS owner_username,
                kind AS kind,
                bucket_name AS bucket_name,
                object_key AS object_key,
                original_filename AS original_filename,
                content_type AS content_type,
                size_bytes AS size_bytes,
                processing_status AS processing_status,
                blur_data_url AS blur_data_url
            FROM media_assets
            WHERE owner_username = #{ownerUsername}
              AND status = 'ACTIVE'
              AND id IN
              <foreach item="assetId" collection="assetIds" open="(" separator="," close=")">
                #{assetId}
              </foreach>
            ORDER BY id ASC
            </script>
            """)
    @ResultMap("mediaAssetMetadataProjectionRow")
    List<MybatisMediaAssetMetadataProjectionRow> selectOwnedActiveMediaAssets(
            @Param("ownerUsername") String ownerUsername,
            @Param("assetIds") Collection<Long> assetIds
    );
}
