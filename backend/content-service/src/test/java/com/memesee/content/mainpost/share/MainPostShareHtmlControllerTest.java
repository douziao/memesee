package com.memesee.content.mainpost.share;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;

class MainPostShareHtmlControllerTest {

    @Test
    void forwardsTargetSubPostQueryAndReturnsCrawlerReadableHtmlResponse() {
        RecordingShareHtmlService service = new RecordingShareHtmlService();
        MainPostShareHtmlController controller = new MainPostShareHtmlController(service);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/share/posts/42");

        ResponseEntity<String> response = controller.render(42L, "99", request);

        assertThat(service.mainPostId).isEqualTo(42L);
        assertThat(service.targetSubPostId).isEqualTo("99");
        assertThat(service.request).isSameAs(request);
        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getHeaders().getContentType()).isEqualTo(MediaType.TEXT_HTML);
        assertThat(response.getHeaders().getCacheControl()).isEqualTo(
                CacheControl.maxAge(java.time.Duration.ofMinutes(5)).cachePublic().getHeaderValue()
        );
        assertThat(response.getHeaders().getFirst(HttpHeaders.CACHE_CONTROL)).contains("public", "max-age=300");
        assertThat(response.getBody()).contains("<meta property=\"og:title\"");
    }

    private static class RecordingShareHtmlService extends MainPostShareHtmlService {

        private Long mainPostId;
        private String targetSubPostId;
        private MockHttpServletRequest request;

        private RecordingShareHtmlService() {
            super(null, null, null, null);
        }

        @Override
        public String render(Long mainPostId, String targetSubPostId, jakarta.servlet.http.HttpServletRequest request) {
            this.mainPostId = mainPostId;
            this.targetSubPostId = targetSubPostId;
            this.request = (MockHttpServletRequest) request;
            return """
                    <!doctype html>
                    <html>
                    <head><meta property="og:title" content="share"></head>
                    <body>share</body>
                    </html>
                    """;
        }
    }
}
