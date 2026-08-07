package com.memesee.content.media.infrastructure;

import com.memesee.platform.error.ApiErrorCode;
import com.memesee.platform.error.ApiException;
import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import java.io.InputStream;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class MinioMediaStorageService {

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("jpg", "jpeg", "png", "gif", "webp", "bmp");
    private static final Logger log = LoggerFactory.getLogger(MinioMediaStorageService.class);

    private final MinioClient minioClient;
    private final String bucketName;
    private final boolean autoCreateBucket;
    private final boolean directDeliveryEnabled;
    private final String publicBaseUrl;
    private final long maxFileSizeBytes;

    public MinioMediaStorageService(
            MinioClient minioClient,
            MediaStorageProperties mediaStorageProperties,
            @Value("${app.media.upload.max-file-size-bytes}") long maxFileSizeBytes
    ) {
        this.minioClient = Objects.requireNonNull(minioClient, "minioClient must not be null");
        this.bucketName = mediaStorageProperties.getMinio().getBucketName();
        this.autoCreateBucket = mediaStorageProperties.getMinio().isAutoCreateBucket();
        this.directDeliveryEnabled = mediaStorageProperties.getMinio().isDirectDeliveryEnabled();
        this.publicBaseUrl = normalizePublicBaseUrl(mediaStorageProperties.getMinio().getPublicBaseUrl());
        this.maxFileSizeBytes = maxFileSizeBytes;
    }

    public StoredMediaObject storeImageBytes(byte[] bytes, String originalFilename, String contentType) {
        if (bytes == null || bytes.length == 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ApiErrorCode.INVALID_REQUEST, "请选择要上传的图片。");
        }
        if (bytes.length > maxFileSizeBytes) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ApiErrorCode.INVALID_REQUEST, "图片文件过大。");
        }
        String normalizedContentType = normalizeContentType(contentType);
        String extension = resolveExtension(originalFilename, normalizedContentType);
        return storeBytes(bytes, originalFilename, normalizedContentType, extension);
    }

    public String buildPublicUrl(String bucketName, String objectKey) {
        if (!directDeliveryEnabled || publicBaseUrl == null || publicBaseUrl.isBlank()) {
            return "";
        }
        if (objectKey == null || objectKey.isBlank()) {
            return "";
        }
        return publicBaseUrl + "/" + objectKey.trim();
    }

    private void ensureBucketReady() {
        try {
            boolean exists = minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucketName).build());
            if (!exists && autoCreateBucket) {
                minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucketName).build());
            }
        } catch (Exception ex) {
            log.warn("minio_bucket_prepare_failed bucket={} autoCreateBucket={}", bucketName, autoCreateBucket, ex);
            throw new ApiException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    ApiErrorCode.INTERNAL_ERROR,
                    "媒体存储初始化失败。",
                    ex
            );
        }
    }

    private StoredMediaObject storeBytes(
            byte[] bytes,
            String originalFilename,
            String contentType,
            String extension
    ) {
        ensureBucketReady();
        String objectKey = UUID.randomUUID() + "." + extension;
        try (InputStream inputStream = new java.io.ByteArrayInputStream(bytes)) {
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(bucketName)
                    .object(objectKey)
                    .stream(inputStream, bytes.length, -1)
                    .contentType(contentType)
                    .build());
            return new StoredMediaObject(
                    bucketName,
                    objectKey,
                    normalizeFilename(originalFilename),
                    contentType,
                    Math.max(0L, bytes.length)
            );
        } catch (Exception ex) {
            log.warn(
                    "minio_media_store_failed bucket={} objectKey={} originalFilename={} contentType={}",
                    bucketName,
                    objectKey,
                    normalizeFilename(originalFilename),
                    contentType,
                    ex
            );
            throw new ApiException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    ApiErrorCode.INTERNAL_ERROR,
                    "媒体存储失败。",
                    ex
            );
        }
    }

    private String resolveExtension(String originalFilename, String contentType) {
        if (originalFilename != null) {
            int dot = originalFilename.lastIndexOf('.');
            if (dot >= 0 && dot < originalFilename.length() - 1) {
                String extension = originalFilename.substring(dot + 1).toLowerCase(Locale.ROOT);
                if (ALLOWED_EXTENSIONS.contains(extension)) {
                    return extension;
                }
            }
        }

        return switch (normalizeContentType(contentType)) {
            case "image/jpeg" -> "jpg";
            case "image/png" -> "png";
            case "image/gif" -> "gif";
            case "image/webp" -> "webp";
            case "image/bmp" -> "bmp";
            default -> throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    ApiErrorCode.INVALID_REQUEST,
                    "不支持的图片格式。"
            );
        };
    }

    private String normalizeFilename(String filename) {
        if (filename == null || filename.isBlank()) {
            return "image";
        }
        return filename.trim();
    }

    private String normalizeContentType(String contentType) {
        if (contentType == null || contentType.isBlank()) {
            return "application/octet-stream";
        }
        return contentType.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizePublicBaseUrl(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return value.trim().replaceAll("/+$", "");
    }

    private String resolveBucketName(String bucketName) {
        if (bucketName == null || bucketName.isBlank()) {
            return this.bucketName;
        }
        return bucketName.trim();
    }

    public record StoredMediaObject(
            String bucketName,
            String objectKey,
            String originalFilename,
            String contentType,
            long sizeBytes
    ) {
    }
}
