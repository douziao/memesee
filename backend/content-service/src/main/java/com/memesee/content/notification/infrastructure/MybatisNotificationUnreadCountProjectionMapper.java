package com.memesee.content.notification.infrastructure;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface MybatisNotificationUnreadCountProjectionMapper {

    @Select("""
            SELECT COUNT(*)
            FROM notifications
            WHERE username = #{username}
              AND read_at IS NULL
            """)
    long selectUnreadCount(@Param("username") String username);
}
