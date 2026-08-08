package com.memesee.user.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.memesee.platform.error.ApiErrorCode;
import com.memesee.platform.error.ApiException;
import com.memesee.user.dto.AuthResponse;
import com.memesee.user.dto.LoginRequest;
import com.memesee.user.dto.RegisterRequest;
import com.memesee.user.entity.InviteCode;
import com.memesee.user.entity.User;
import com.memesee.user.repository.InviteCodeRepository;
import com.memesee.user.repository.UserRepository;
import com.memesee.user.security.JwtService;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.lang.reflect.Field;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;

class AuthServiceTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final InviteCodeRepository inviteCodeRepository = mock(InviteCodeRepository.class);
    private final RecordingJwtService jwtService = new RecordingJwtService();
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final AuthService authService = new AuthService(
            userRepository,
            inviteCodeRepository,
            jwtService,
            null,
            null,
            passwordEncoder
    );

    @Test
    void registerNormalizesInputHashesPasswordConsumesInviteAndReturnsToken() {
        InviteCode inviteCode = inviteCode(2, 0, false, Instant.now().plus(1, ChronoUnit.DAYS));
        when(userRepository.existsByUsername("alice")).thenReturn(false);
        when(inviteCodeRepository.findByCodeForUpdate("LAUNCH")).thenReturn(Optional.of(inviteCode));
        when(passwordEncoder.encode("plain-password")).thenReturn("encoded-password");

        AuthResponse response = authService.register(new RegisterRequest(
                "  alice  ",
                "plain-password",
                " launch "
        ));

        assertThat(response).isEqualTo(new AuthResponse("alice", "jwt-token-for-alice-level-0", 0));

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        User savedUser = userCaptor.getValue();
        assertThat(savedUser.getUsername()).isEqualTo("alice");
        assertThat(savedUser.getPasswordHash()).isEqualTo("encoded-password");
        assertThat(savedUser.getPasswordHash()).isNotEqualTo("plain-password");
        assertThat(savedUser.getLevel()).isZero();
        assertThat(savedUser.getCreatedAt()).isNotNull();

        assertThat(readField(inviteCode, "usedCount", Integer.class)).isEqualTo(1);
        assertThat(readField(inviteCode, "usedBy", String.class)).isEqualTo("alice");
        assertThat(readField(inviteCode, "usedAt", Instant.class)).isNotNull();
    }

    @Test
    void registerRejectsDuplicateUsernameWithoutHashingPassword() {
        when(userRepository.existsByUsername("alice")).thenReturn(true);

        assertThatThrownBy(() -> authService.register(new RegisterRequest(
                " alice ",
                "plain-password",
                "launch"
        )))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(exception.getCode()).isEqualTo(ApiErrorCode.CONFLICT);
                });

        verify(userRepository, never()).save(org.mockito.ArgumentMatchers.any(User.class));
        verifyNoInteractions(passwordEncoder);
        assertThat(jwtService.generatedTokens).isZero();
    }

    @Test
    void registerRejectsInvalidInviteWithoutSavingUser() {
        when(userRepository.existsByUsername("alice")).thenReturn(false);
        when(inviteCodeRepository.findByCodeForUpdate("BADCODE")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.register(new RegisterRequest(
                "alice",
                "plain-password",
                " badcode "
        ))).isInstanceOf(ApiException.class);

        verify(userRepository, never()).save(org.mockito.ArgumentMatchers.any(User.class));
        verifyNoInteractions(passwordEncoder);
        assertThat(jwtService.generatedTokens).isZero();
    }

    @Test
    void loginTrimsUsernameChecksPasswordAndReturnsToken() {
        User user = new User("alice", "encoded-password", Instant.now(), 3);
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("plain-password", "encoded-password")).thenReturn(true);

        AuthResponse response = authService.login(new LoginRequest(" alice ", "plain-password"));

        assertThat(response).isEqualTo(new AuthResponse("alice", "jwt-token-for-alice-level-3", 3));
    }

    @Test
    void loginRejectsWrongPasswordWithoutIssuingToken() {
        User user = new User("alice", "encoded-password", Instant.now(), 0);
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong-password", "encoded-password")).thenReturn(false);

        assertThatThrownBy(() -> authService.login(new LoginRequest("alice", "wrong-password")))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED);
                    assertThat(exception.getCode()).isEqualTo(ApiErrorCode.UNAUTHORIZED);
                });

        assertThat(jwtService.generatedTokens).isZero();
    }

    private InviteCode inviteCode(int maxUses, int usedCount, boolean disabled, Instant expiresAt) {
        InviteCode inviteCode = new InviteCode();
        writeField(inviteCode, "maxUses", maxUses);
        writeField(inviteCode, "usedCount", usedCount);
        writeField(inviteCode, "disabled", disabled);
        writeField(inviteCode, "expiresAt", expiresAt);
        writeField(inviteCode, "createdAt", Instant.now());
        return inviteCode;
    }

    private void writeField(Object target, String fieldName, Object value) {
        try {
            Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (ReflectiveOperationException exception) {
            throw new AssertionError("Unable to set field " + fieldName, exception);
        }
    }

    private <T> T readField(Object target, String fieldName, Class<T> fieldType) {
        try {
            Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            return fieldType.cast(field.get(target));
        } catch (ReflectiveOperationException exception) {
            throw new AssertionError("Unable to read field " + fieldName, exception);
        }
    }

    private static class RecordingJwtService extends JwtService {
        private int generatedTokens;

        RecordingJwtService() {
            super("test-secret-with-at-least-thirty-two-characters", 86400);
        }

        @Override
        public String generateToken(String username, int userLevel) {
            generatedTokens += 1;
            return "jwt-token-for-" + username + "-level-" + userLevel;
        }
    }
}
