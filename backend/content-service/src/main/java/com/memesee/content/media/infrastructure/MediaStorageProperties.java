package com.memesee.content.media.infrastructure;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.media.storage")
public class MediaStorageProperties {

    private final Minio minio = new Minio();

    public Minio getMinio() {
        return minio;
    }

    public static class Minio {

        private String endpoint = "http://localhost:9000";
        private String accessKey = "minioadmin";
        private String secretKey = "minioadmin";
        private String bucketName = "memesee-post-images";
        private boolean autoCreateBucket = true;
        private boolean directDeliveryEnabled = false;
        private String publicBaseUrl = "";

        public String getEndpoint() {
            return endpoint;
        }

        public void setEndpoint(String endpoint) {
            this.endpoint = endpoint;
        }

        public String getAccessKey() {
            return accessKey;
        }

        public void setAccessKey(String accessKey) {
            this.accessKey = accessKey;
        }

        public String getSecretKey() {
            return secretKey;
        }

        public void setSecretKey(String secretKey) {
            this.secretKey = secretKey;
        }

        public String getBucketName() {
            return bucketName;
        }

        public void setBucketName(String bucketName) {
            this.bucketName = bucketName;
        }

        public boolean isAutoCreateBucket() {
            return autoCreateBucket;
        }

        public void setAutoCreateBucket(boolean autoCreateBucket) {
            this.autoCreateBucket = autoCreateBucket;
        }

        public boolean isDirectDeliveryEnabled() {
            return directDeliveryEnabled;
        }

        public void setDirectDeliveryEnabled(boolean directDeliveryEnabled) {
            this.directDeliveryEnabled = directDeliveryEnabled;
        }

        public String getPublicBaseUrl() {
            return publicBaseUrl;
        }

        public void setPublicBaseUrl(String publicBaseUrl) {
            this.publicBaseUrl = publicBaseUrl;
        }
    }
}
