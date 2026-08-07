package com.memesee.user.repository;

import com.memesee.user.entity.InviteCode;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InviteCodeRepository extends JpaRepository<InviteCode, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select inviteCode from InviteCode inviteCode where inviteCode.code = :code")
    Optional<InviteCode> findByCodeForUpdate(@Param("code") String code);
}
