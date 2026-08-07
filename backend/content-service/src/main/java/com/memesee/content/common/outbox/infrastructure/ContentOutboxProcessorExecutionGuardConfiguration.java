package com.memesee.content.common.outbox.infrastructure;

import com.memesee.content.common.observability.OutboxMetricsRecorder;
import com.memesee.content.common.outbox.application.ContentOutboxProcessorExecutionGuard;
import com.memesee.content.common.outbox.application.ContentOutboxProcessorProperties;
import org.redisson.Redisson;
import org.redisson.api.RedissonClient;
import org.redisson.config.Config;
import org.redisson.config.SingleServerConfig;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.data.redis.RedisProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

@Configuration
@EnableConfigurationProperties(ContentOutboxProcessorProperties.class)
public class ContentOutboxProcessorExecutionGuardConfiguration {

    @Bean(destroyMethod = "shutdown")
    @ConditionalOnProperty(prefix = "app.outbox.processor.distributed-lock", name = "enabled", havingValue = "true")
    public RedissonClient contentOutboxRedissonClient(RedisProperties redisProperties) {
        Config config = new Config();
        SingleServerConfig singleServerConfig = config.useSingleServer()
                .setAddress(resolveRedisAddress(redisProperties))
                .setDatabase(redisProperties.getDatabase());

        if (StringUtils.hasText(redisProperties.getUsername())) {
            singleServerConfig.setUsername(redisProperties.getUsername().trim());
        }
        if (StringUtils.hasText(redisProperties.getPassword())) {
            singleServerConfig.setPassword(redisProperties.getPassword());
        }
        if (redisProperties.getConnectTimeout() != null && !redisProperties.getConnectTimeout().isZero()) {
            singleServerConfig.setConnectTimeout((int) redisProperties.getConnectTimeout().toMillis());
        }
        if (redisProperties.getTimeout() != null && !redisProperties.getTimeout().isZero()) {
            singleServerConfig.setTimeout((int) redisProperties.getTimeout().toMillis());
        }
        return Redisson.create(config);
    }

    @Bean
    @ConditionalOnBean(RedissonClient.class)
    public ContentOutboxProcessorLockClient contentOutboxProcessorLockClient(RedissonClient redissonClient) {
        return new RedissonContentOutboxProcessorLockClient(redissonClient);
    }

    @Bean
    @ConditionalOnBean(ContentOutboxProcessorLockClient.class)
    public ContentOutboxProcessorExecutionGuard contentOutboxProcessorExecutionGuard(
            ContentOutboxProcessorLockClient lockClient,
            ContentOutboxProcessorProperties properties,
            OutboxMetricsRecorder outboxMetricsRecorder
    ) {
        return new RedissonContentOutboxProcessorExecutionGuard(
                lockClient,
                properties,
                outboxMetricsRecorder
        );
    }

    @Bean
    @ConditionalOnMissingBean(ContentOutboxProcessorExecutionGuard.class)
    public ContentOutboxProcessorExecutionGuard noOpContentOutboxProcessorExecutionGuard() {
        return new NoOpContentOutboxProcessorExecutionGuard();
    }

    private String resolveRedisAddress(RedisProperties redisProperties) {
        if (StringUtils.hasText(redisProperties.getUrl())) {
            return redisProperties.getUrl().trim();
        }
        String protocol = redisProperties.getSsl() != null && redisProperties.getSsl().isEnabled() ? "rediss" : "redis";
        String host = StringUtils.hasText(redisProperties.getHost()) ? redisProperties.getHost().trim() : "localhost";
        int port = redisProperties.getPort() > 0 ? redisProperties.getPort() : 6379;
        return protocol + "://" + host + ":" + port;
    }
}
