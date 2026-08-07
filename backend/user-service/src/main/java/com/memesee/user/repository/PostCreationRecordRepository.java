package com.memesee.user.repository;

import com.memesee.user.entity.PostCreationRecord;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PostCreationRecordRepository extends JpaRepository<PostCreationRecord, Long> {
}

