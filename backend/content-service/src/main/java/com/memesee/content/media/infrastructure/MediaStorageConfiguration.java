package com.memesee.content.media.infrastructure;

import io.minio.MinioClient;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(MediaStorageProperties.class)
public class MediaStorageConfiguration {

    @Bean
    public MinioClient minioClient(MediaStorageProperties mediaStorageProperties) {
        MediaStorageProperties.Minio minio = mediaStorageProperties.getMinio();
        return MinioClient.builder()
                .endpoint(minio.getEndpoint())
                .credentials(minio.getAccessKey(), minio.getSecretKey())
                .build();
    }
}
