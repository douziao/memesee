package com.memesee.content.feed.application;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MainPostFeedApplicationConfiguration {

    @Bean
    public MainPostReadModelAssembler mainPostReadModelAssembler() {
        return new MainPostReadModelAssembler();
    }
}
