package com.memesee.content.subpost.api;


import com.memesee.content.subpost.dto.CreateSubPostRequest;
import com.memesee.content.subpost.dto.MySubPostItemResponse;
import com.memesee.content.subpost.dto.SubPostPageResponse;
import com.memesee.content.subpost.dto.SubPostResponse;
import com.memesee.content.subpost.dto.UpdateSubPostRequest;
import com.memesee.content.subpost.application.SubPostCommandApplicationService;
import com.memesee.content.subpost.application.SubPostQueryApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class SubPostController {

    private final SubPostQueryApplicationService subPostQueryApplicationService;
    private final SubPostCommandApplicationService subPostCommandApplicationService;

    public SubPostController(
            SubPostQueryApplicationService subPostQueryApplicationService,
            SubPostCommandApplicationService subPostCommandApplicationService
    ) {
        this.subPostQueryApplicationService = subPostQueryApplicationService;
        this.subPostCommandApplicationService = subPostCommandApplicationService;
    }

    @GetMapping("/main-posts/{mainPostId}/sub-posts/page")
    public SubPostPageResponse listSubPostPage(
            @PathVariable Long mainPostId,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) Integer limit,
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader
    ) {
        return subPostQueryApplicationService.listSubPostPage(
                mainPostId,
                cursor,
                limit,
                authorizationHeader
        );
    }

    @GetMapping("/me/sub-posts")
    public List<MySubPostItemResponse> listMySubPosts(
            @RequestParam(required = false) Integer limit,
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader
    ) {
        return subPostQueryApplicationService.listMySubPosts(authorizationHeader, limit);
    }

    @PostMapping("/main-posts/{mainPostId}/sub-posts")
    public ResponseEntity<SubPostResponse> createSubPost(
            @PathVariable Long mainPostId,
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader,
            @Valid @RequestBody CreateSubPostRequest request
    ) {
        SubPostResponse response = subPostCommandApplicationService.createSubPost(mainPostId, authorizationHeader, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/sub-posts/{subPostId}")
    public SubPostResponse updateSubPost(
            @PathVariable Long subPostId,
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader,
            @Valid @RequestBody UpdateSubPostRequest request
    ) {
        return subPostCommandApplicationService.updateSubPost(subPostId, authorizationHeader, request);
    }

    @DeleteMapping("/sub-posts/{subPostId}")
    public ResponseEntity<Void> deleteSubPost(
            @PathVariable Long subPostId,
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader
    ) {
        subPostCommandApplicationService.deleteSubPost(subPostId, authorizationHeader);
        return ResponseEntity.noContent().build();
    }
}
