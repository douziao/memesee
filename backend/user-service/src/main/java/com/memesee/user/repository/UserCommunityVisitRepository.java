package com.memesee.user.repository;

import com.memesee.user.entity.UserCommunityVisit;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserCommunityVisitRepository extends JpaRepository<UserCommunityVisit, Long> {

    Optional<UserCommunityVisit> findByUsernameAndCommunitySlug(String username, String communitySlug);

    long countByUsername(String username);

    long countByUsernameAndCommunitySlugNot(String username, String communitySlug);
}

