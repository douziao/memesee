package com.memesee.content.media.infrastructure;

import com.memesee.content.media.application.MediaVariantProcessingPublisher;
import com.memesee.content.media.application.MediaVariantProcessingRequested;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "app.media.processing", name = "async-enabled", havingValue = "true")
public class RabbitMediaVariantProcessingPublisher implements MediaVariantProcessingPublisher {

    private final RabbitTemplate rabbitTemplate;
    private final MediaProcessingQueueProperties properties;

    public RabbitMediaVariantProcessingPublisher(
            RabbitTemplate rabbitTemplate,
            MediaProcessingQueueProperties properties
    ) {
        this.rabbitTemplate = rabbitTemplate;
        this.properties = properties;
    }

    @Override
    public void publish(Long assetId) {
        rabbitTemplate.convertAndSend(
                properties.getExchange(),
                properties.getRoutingKey(),
                new MediaVariantProcessingRequested(assetId)
        );
    }
}
