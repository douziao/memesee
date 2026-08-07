package com.memesee.content.community.infrastructure;

import com.memesee.content.community.domain.Community;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CommunityRepository extends JpaRepository<Community, Long> {

    Optional<Community> findBySlug(String slug);

    List<Community> findAllByOrderBySortOrderAscIdAsc();
}
