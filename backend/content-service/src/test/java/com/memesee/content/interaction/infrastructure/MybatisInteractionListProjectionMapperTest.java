package com.memesee.content.interaction.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import org.apache.ibatis.annotations.Select;
import org.junit.jupiter.api.Test;

class MybatisInteractionListProjectionMapperTest {

    @Test
    void subPostInteractionQueryRequiresActiveParentMainPost() throws Exception {
        Method method = MybatisInteractionListProjectionMapper.class.getMethod(
                "selectSubPostInteractions",
                String.class,
                int.class
        );
        String sql = String.join("\n", method.getAnnotation(Select.class).value());

        assertThat(sql).contains("LEFT JOIN main_posts mp ON mp.id = sp.main_post_id");
        assertThat(sql).contains("AND mp.deleted_at IS NULL");
        assertThat(sql).contains("AND mp.id IS NOT NULL");
    }
}
