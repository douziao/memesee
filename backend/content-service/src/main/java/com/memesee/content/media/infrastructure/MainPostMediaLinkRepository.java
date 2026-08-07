package com.memesee.content.media.infrastructure;

import com.memesee.content.media.domain.MainPostMediaLink;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

public interface MainPostMediaLinkRepository extends JpaRepository<MainPostMediaLink, Long> {

    List<MainPostMediaLink> findAllByMainPostIdInOrderByMainPostIdAscSortOrderAscIdAsc(Collection<Long> mainPostIds);

    List<MainPostMediaLink> findAllByMediaAssetId(Long mediaAssetId);

    @Transactional
    void deleteAllByMainPostId(Long mainPostId);
}
