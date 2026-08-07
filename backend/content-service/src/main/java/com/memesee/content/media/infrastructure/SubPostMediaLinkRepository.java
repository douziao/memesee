package com.memesee.content.media.infrastructure;

import com.memesee.content.media.domain.SubPostMediaLink;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

public interface SubPostMediaLinkRepository extends JpaRepository<SubPostMediaLink, Long> {

    List<SubPostMediaLink> findAllBySubPostIdInOrderBySubPostIdAscSortOrderAscIdAsc(Collection<Long> subPostIds);

    List<SubPostMediaLink> findAllByMediaAssetId(Long mediaAssetId);

    @Transactional
    void deleteAllBySubPostId(Long subPostId);
}
