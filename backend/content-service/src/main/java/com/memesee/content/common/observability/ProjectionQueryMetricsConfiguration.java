package com.memesee.content.common.observability;

import io.micrometer.core.instrument.MeterRegistry;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(ProjectionQueryMetricsConfiguration.ProjectionQueryMetricsProperties.class)
public class ProjectionQueryMetricsConfiguration {

    @Bean
    public ProjectionQueryMetricsRecorder projectionQueryMetricsRecorder(
            MeterRegistry meterRegistry,
            ProjectionQueryMetricsProperties properties
    ) {
        return new ProjectionQueryMetricsRecorder(meterRegistry, properties.getSlowThreshold());
    }

    @ConfigurationProperties(prefix = "app.observability.projection-query")
    public static class ProjectionQueryMetricsProperties {

        private Duration slowThreshold = Duration.ofMillis(250);

        public Duration getSlowThreshold() {
            return slowThreshold;
        }

        public void setSlowThreshold(Duration slowThreshold) {
            this.slowThreshold = slowThreshold;
        }
    }
}
