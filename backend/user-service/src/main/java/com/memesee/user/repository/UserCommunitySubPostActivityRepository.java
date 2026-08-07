package com.memesee.user.repository;

import com.memesee.user.entity.UserCommunitySubPostActivity;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserCommunitySubPostActivityRepository extends JpaRepository<UserCommunitySubPostActivity, Long> {

    Optional<UserCommunitySubPostActivity> findByUsernameAndCommunitySlug(String username, String communitySlug);

    long countByUsername(String username);

    long countByUsernameAndLastSubPostAtGreaterThanEqual(String username, Instant startInstant);
}

