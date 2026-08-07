package com.memesee.user.repository;

import com.memesee.user.entity.PostDailyStat;
import java.time.LocalDate;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PostDailyStatRepository extends JpaRepository<PostDailyStat, Long> {

    Optional<PostDailyStat> findByActivityDate(LocalDate activityDate);

    long countByActivityDateGreaterThanEqual(LocalDate activityDate);

    @Query("select coalesce(sum(s.createdCount), 0) from PostDailyStat s where s.activityDate >= :startDate")
    long sumCreatedCountFromDate(@Param("startDate") LocalDate startDate);

    @Modifying
    @Query("update PostDailyStat s set s.createdCount = s.createdCount + 1 where s.activityDate = :activityDate")
    int incrementCreatedCount(@Param("activityDate") LocalDate activityDate);
}

