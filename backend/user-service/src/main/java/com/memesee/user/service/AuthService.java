package com.memesee.user.service;

import com.memesee.user.dto.ActivityReportRequest;
import com.memesee.user.dto.ActivityReportResponse;
import com.memesee.user.dto.AuthResponse;
import com.memesee.user.dto.LoginRequest;
import com.memesee.user.dto.RegisterRequest;
import com.memesee.user.dto.UserProfileResponse;
import com.memesee.user.entity.InviteCode;
import com.memesee.user.entity.User;
import com.memesee.platform.error.ApiErrorCode;
import com.memesee.platform.error.ApiException;
import com.memesee.user.repository.InviteCodeRepository;
import com.memesee.user.repository.UserRepository;
import com.memesee.user.security.AuthContextResolver;
import com.memesee.user.security.JwtService;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private static final int DEFAULT_REGISTER_LEVEL = 0;

    private final UserRepository userRepository;
    private final InviteCodeRepository inviteCodeRepository;
    private final JwtService jwtService;
    private final UserProgressService userProgressService;
    private final AuthContextResolver authContextResolver;
    private final PasswordEncoder passwordEncoder;

    public AuthService(
            UserRepository userRepository,
            InviteCodeRepository inviteCodeRepository,
            JwtService jwtService,
            UserProgressService userProgressService,
            AuthContextResolver authContextResolver,
            PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.inviteCodeRepository = inviteCodeRepository;
        this.jwtService = jwtService;
        this.userProgressService = userProgressService;
        this.authContextResolver = authContextResolver;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String normalizedUsername = request.username().trim();
        String normalizedInviteCode = normalizeInviteCode(request.inviteCode());
        Instant now = Instant.now();

        if (userRepository.existsByUsername(normalizedUsername)) {
            throw new ApiException(HttpStatus.CONFLICT, ApiErrorCode.CONFLICT, "用户名已被占用。");
        }

        InviteCode inviteCode = inviteCodeRepository.findByCodeForUpdate(normalizedInviteCode)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.BAD_REQUEST,
                        ApiErrorCode.VALIDATION_FAILED,
                        "邀请码无效。"
                ));
        if (inviteCode.isDisabled()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ApiErrorCode.VALIDATION_FAILED, "邀请码已失效。");
        }
        if (inviteCode.isExpired(now)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ApiErrorCode.VALIDATION_FAILED, "邀请码已过期。");
        }
        if (!inviteCode.hasRemainingUses()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ApiErrorCode.VALIDATION_FAILED, "邀请码已用完。");
        }

        User newUser = new User(
                normalizedUsername,
                passwordEncoder.encode(request.password()),
                now,
                DEFAULT_REGISTER_LEVEL
        );
        userRepository.save(newUser);
        inviteCode.consume(normalizedUsername, now);

        String token = jwtService.generateToken(newUser.getUsername(), newUser.getLevel());
        return new AuthResponse(newUser.getUsername(), token, newUser.getLevel());
    }

    private String normalizeInviteCode(String inviteCode) {
        return inviteCode.trim().toUpperCase();
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByUsername(request.username().trim())
                .orElseThrow(() -> new ApiException(
                        HttpStatus.UNAUTHORIZED,
                        ApiErrorCode.UNAUTHORIZED,
                        "用户名或密码错误。"
                ));

        boolean passwordMatched = passwordEncoder.matches(request.password(), user.getPasswordHash());
        if (!passwordMatched) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, ApiErrorCode.UNAUTHORIZED, "用户名或密码错误。");
        }

        String token = jwtService.generateToken(user.getUsername(), user.getLevel());
        return new AuthResponse(user.getUsername(), token, user.getLevel());
    }

    @Transactional
    public UserProfileResponse getMyProfile(String authorizationHeader) {
        User user = authContextResolver.resolveUser(authorizationHeader);
        return userProgressService.buildProfile(user);
    }

    @Transactional
    public ActivityReportResponse reportActivity(
            String authorizationHeader,
            ActivityReportRequest request
    ) {
        User user = authContextResolver.resolveUser(authorizationHeader);
        return userProgressService.reportActivity(user, request);
    }
}

