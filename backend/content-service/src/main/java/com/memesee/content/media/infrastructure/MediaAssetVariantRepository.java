package com.memesee.content.media.infrastructure;

import com.memesee.content.media.domain.MediaAssetVariant;
import com.memesee.content.media.domain.MediaAssetVariantKind;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MediaAssetVariantRepository extends JpaRepository<MediaAssetVariant, Long> {

    Optional<MediaAssetVariant> findByMediaAssetIdAndKind(Long mediaAssetId, MediaAssetVariantKind kind);

    List<MediaAssetVariant> findAllByMediaAssetIdIn(Collection<Long> mediaAssetIds);
}
