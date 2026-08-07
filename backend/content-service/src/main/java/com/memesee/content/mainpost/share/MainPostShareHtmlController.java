package com.memesee.content.mainpost.share;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class MainPostShareHtmlController {

    private final MainPostShareHtmlService mainPostShareHtmlService;

    public MainPostShareHtmlController(MainPostShareHtmlService mainPostShareHtmlService) {
        this.mainPostShareHtmlService = mainPostShareHtmlService;
    }

    @GetMapping(value = "/share/posts/{mainPostId}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> render(
            @PathVariable Long mainPostId,
            @RequestParam(required = false) String subPost,
            HttpServletRequest request
    ) {
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_HTML)
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                .body(mainPostShareHtmlService.render(mainPostId, subPost, request));
    }
}
