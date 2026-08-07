package com.memesee.content.media.infrastructure;

import com.memesee.content.media.domain.MediaAsset;
import com.memesee.content.media.domain.MediaAssetProcessingStatus;
import com.memesee.content.media.domain.MediaAssetStatus;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MediaAssetRepository extends JpaRepository<MediaAsset, Long> {

    Optional<MediaAsset> findByIdAndStatus(Long id, MediaAssetStatus status);

    List<MediaAsset> findAllByOwnerUsernameAndIdInAndStatus(String ownerUsername, Collection<Long> ids, MediaAssetStatus status);

    List<MediaAsset> findAllByIdInAndStatus(Collection<Long> ids, MediaAssetStatus status);

    List<MediaAsset> findTop100ByStatusAndProcessingStatusOrderByIdAsc(
            MediaAssetStatus status,
            MediaAssetProcessingStatus processingStatus
    );
}
