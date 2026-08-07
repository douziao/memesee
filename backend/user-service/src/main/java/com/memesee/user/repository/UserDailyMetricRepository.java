package com.memesee.user.repository;

import com.memesee.user.entity.UserDailyMetric;
import java.time.LocalDate;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserDailyMetricRepository extends JpaRepository<UserDailyMetric, Long> {

    Optional<UserDailyMetric> findByUsernameAndActivityDate(String username, LocalDate activityDate);

    @Query("select count(m) from UserDailyMetric m where m.username = :username and m.visited = true")
    long countVisitedDaysByUsername(@Param("username") String username);

    @Query("""
            select count(m) from UserDailyMetric m
            where m.username = :username
              and m.visited = true
              and m.activityDate >= :startDate
            """)
    long countVisitedDaysByUsernameFromDate(@Param("username") String username, @Param("startDate") LocalDate startDate);

    @Query("select coalesce(sum(m.readSeconds), 0) from UserDailyMetric m where m.username = :username")
    long sumReadSecondsByUsername(@Param("username") String username);

    @Query("select coalesce(sum(m.readSeconds), 0) from UserDailyMetric m where m.username = :username and m.activityDate >= :startDate")
    long sumReadSecondsByUsernameFromDate(@Param("username") String username, @Param("startDate") LocalDate startDate);

    @Query("select coalesce(sum(m.likesGiven), 0) from UserDailyMetric m where m.username = :username")
    long sumLikesGivenByUsername(@Param("username") String username);

    @Query("select coalesce(sum(m.likesGiven), 0) from UserDailyMetric m where m.username = :username and m.activityDate >= :startDate")
    long sumLikesGivenByUsernameFromDate(@Param("username") String username, @Param("startDate") LocalDate startDate);

    @Query("select coalesce(sum(m.likesReceived), 0) from UserDailyMetric m where m.username = :username")
    long sumLikesReceivedByUsername(@Param("username") String username);

    @Query("select coalesce(sum(m.likesReceived), 0) from UserDailyMetric m where m.username = :username and m.activityDate >= :startDate")
    long sumLikesReceivedByUsernameFromDate(@Param("username") String username, @Param("startDate") LocalDate startDate);
}

