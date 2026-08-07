package com.memesee.user.repository;

import com.memesee.user.entity.UserCommunityMainPostActivity;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserCommunityMainPostActivityRepository extends JpaRepository<UserCommunityMainPostActivity, Long> {

    Optional<UserCommunityMainPostActivity> findByUsernameAndCommunitySlug(String username, String communitySlug);

    long countByUsername(String username);

    long countByUsernameAndLastMainPostAtGreaterThanEqual(String username, Instant startInstant);
}
