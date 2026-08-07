package com.memesee.user.repository;

import com.memesee.user.entity.UserReadMainPost;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserReadMainPostRepository extends JpaRepository<UserReadMainPost, Long> {

    Optional<UserReadMainPost> findByUsernameAndMainPostId(String username, Long mainPostId);

    long countByUsername(String username);

    long countByUsernameAndLastReadAtGreaterThanEqual(String username, Instant startInstant);
}

