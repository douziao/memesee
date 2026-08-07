package com.memesee.content.media.api;

import com.memesee.content.media.dto.MediaAssetResponse;
import com.memesee.content.media.application.MediaAssetApplicationService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/media-assets")
public class MediaAssetController {

    private final MediaAssetApplicationService mediaAssetApplicationService;

    public MediaAssetController(MediaAssetApplicationService mediaAssetApplicationService) {
        this.mediaAssetApplicationService = mediaAssetApplicationService;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<MediaAssetResponse> uploadImage(
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader,
            @RequestParam("file") MultipartFile file
    ) {
        MediaAssetResponse response = mediaAssetApplicationService.uploadImage(authorizationHeader, file);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{assetId}")
    public MediaAssetResponse getMediaAsset(@PathVariable Long assetId) {
        return mediaAssetApplicationService.getMediaAsset(assetId);
    }

}
