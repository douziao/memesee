package com.memesee.user.controller;

import com.memesee.user.dto.ActivityReportRequest;
import com.memesee.user.dto.ActivityReportResponse;
import com.memesee.user.dto.AuthResponse;
import com.memesee.user.dto.LoginRequest;
import com.memesee.user.dto.RegisterRequest;
import com.memesee.user.dto.UserProfileResponse;
import com.memesee.user.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public AuthResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @GetMapping("/me")
    public UserProfileResponse me(
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader
    ) {
        return authService.getMyProfile(authorizationHeader);
    }

    @PostMapping("/activity/report")
    public ActivityReportResponse reportActivity(
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader,
            @Valid @RequestBody ActivityReportRequest request
    ) {
        return authService.reportActivity(authorizationHeader, request);
    }
}

