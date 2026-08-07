package com.memesee.content.mainpost.share;

import com.memesee.content.mainpost.application.MainPostQueryApplicationService;
import com.memesee.content.mainpost.dto.MainPostDetailMediaAssetResponse;
import com.memesee.content.mainpost.dto.MainPostDetailResponse;
import com.memesee.content.media.application.SubPostMediaCollaborationApplicationService;
import com.memesee.content.media.dto.MediaAssetResponse;
import com.memesee.content.subpost.application.SubPostApplicationSupport;
import com.memesee.content.subpost.domain.SubPost;
import com.memesee.platform.error.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.util.HtmlUtils;

@Service
public class MainPostShareHtmlService {

    private static final String DEFAULT_HOST = "memesee.world";
    private static final String SITE_NAME = "MemeSee";
    private static final String DEFAULT_IMAGE_PATH = "/og-image.png";
    private static final int DEFAULT_IMAGE_WIDTH = 1200;
    private static final int DEFAULT_IMAGE_HEIGHT = 630;
    private static final int DESCRIPTION_LIMIT = 160;

    private final MainPostQueryApplicationService mainPostQueryApplicationService;
    private final SubPostApplicationSupport subPostApplicationSupport;
    private final SubPostMediaCollaborationApplicationService subPostMediaCollaborationApplicationService;
    private final MainPostShareHtmlTelemetry telemetry;

    public MainPostShareHtmlService(
            MainPostQueryApplicationService mainPostQueryApplicationService,
            SubPostApplicationSupport subPostApplicationSupport,
            SubPostMediaCollaborationApplicationService subPostMediaCollaborationApplicationService,
            MainPostShareHtmlTelemetry telemetry
    ) {
        this.mainPostQueryApplicationService = mainPostQueryApplicationService;
        this.subPostApplicationSupport = subPostApplicationSupport;
        this.subPostMediaCollaborationApplicationService = subPostMediaCollaborationApplicationService;
        this.telemetry = telemetry == null ? MainPostShareHtmlTelemetry.noop() : telemetry;
    }

    public String render(Long mainPostId, String targetSubPostId, HttpServletRequest request) {
        long startNanos = System.nanoTime();
        Long resolvedSubPostId = null;
        String target = "main_post";
        String outcome = "success";
        String imageSource = "unknown";
        try {
            MainPostDetailResponse post = mainPostQueryApplicationService.getMainPost(mainPostId, null, false);
            ShareOrigin origin = resolveOrigin(request);
            TargetSubPostResolution targetSubPostResolution =
                    resolveTargetSubPost(post.id(), parseTargetSubPostId(targetSubPostId));
            TargetSubPost targetSubPost = targetSubPostResolution.targetSubPost();
            if (targetSubPost != null) {
                target = "sub_post";
                resolvedSubPostId = targetSubPost.subPost().getId();
            }
            outcome = targetSubPostResolution.outcome();
            String canonicalUrl = buildCanonicalUrl(origin.baseUrl(), post.id(), targetSubPost);
            String title = normalizeTitle(post, targetSubPost);
            String description = normalizeDescription(post, targetSubPost);
            ShareImage image = selectImage(post, targetSubPost, origin.baseUrl());
            imageSource = image.source();
            return buildHtml(title, description, canonicalUrl, image);
        } catch (ApiException error) {
            if (error.getStatus() == HttpStatus.NOT_FOUND) {
                outcome = "main_post_not_found";
                imageSource = "default";
                ShareOrigin origin = resolveOrigin(request);
                String canonicalUrl = origin.baseUrl() + "/posts/" + mainPostId;
                return buildUnavailableHtml(canonicalUrl, new ShareImage(
                        origin.baseUrl() + DEFAULT_IMAGE_PATH,
                        "MemeSee 分享预览图",
                        DEFAULT_IMAGE_WIDTH,
                        DEFAULT_IMAGE_HEIGHT,
                        "default"
                ));
            }
            outcome = "error";
            throw error;
        } catch (RuntimeException error) {
            outcome = "error";
            throw error;
        } finally {
            telemetry.record(new MainPostShareHtmlTelemetry.RenderObservation(
                    mainPostId,
                    normalizeWhitespace(targetSubPostId),
                    resolvedSubPostId,
                    target,
                    outcome,
                    imageSource,
                    System.nanoTime() - startNanos
            ));
        }
    }

    private String buildUnavailableHtml(String canonicalUrl, ShareImage image) {
        String title = "主帖已不可用";
        String description = "这条 MemeSee 内容可能已经被删除，或链接里的帖子编号不存在。";
        String escapedPageTitle = escape(title + " | " + SITE_NAME);
        String escapedTitle = escape(title);
        String escapedDescription = escape(description);
        String escapedCanonicalUrl = escape(canonicalUrl);
        String escapedImageUrl = escape(image.url());
        String escapedImageAlt = escape(image.alt());
        return """
                <!doctype html>
                <html lang="zh-CN">
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <title>%s</title>
                  <link rel="canonical" href="%s">
                  <meta name="robots" content="noindex,nofollow">
                  <meta name="description" content="%s">
                  <meta property="og:type" content="article">
                  <meta property="og:site_name" content="%s">
                  <meta property="og:title" content="%s">
                  <meta property="og:description" content="%s">
                  <meta property="og:url" content="%s">
                  <meta property="og:image" content="%s">
                  <meta property="og:image:alt" content="%s">
                  <meta property="og:image:width" content="%d">
                  <meta property="og:image:height" content="%d">
                  <meta name="twitter:card" content="summary_large_image">
                  <meta name="twitter:title" content="%s">
                  <meta name="twitter:description" content="%s">
                  <meta name="twitter:image" content="%s">
                  <meta name="twitter:image:alt" content="%s">
                  <script>location.replace(%s);</script>
                </head>
                <body>
                  <main>
                    <h1>%s</h1>
                    <p>%s</p>
                    <p><a href="%s">返回 MemeSee 查看</a></p>
                  </main>
                </body>
                </html>
                """.formatted(
                escapedPageTitle,
                escapedCanonicalUrl,
                escapedDescription,
                SITE_NAME,
                escapedTitle,
                escapedDescription,
                escapedCanonicalUrl,
                escapedImageUrl,
                escapedImageAlt,
                image.width(),
                image.height(),
                escapedTitle,
                escapedDescription,
                escapedImageUrl,
                escapedImageAlt,
                javascriptString(canonicalUrl),
                escapedTitle,
                escapedDescription,
                escapedCanonicalUrl
        );
    }

    private String buildHtml(String title, String description, String canonicalUrl, ShareImage image) {
        String escapedPageTitle = escape(title + " | " + SITE_NAME);
        String escapedTitle = escape(title);
        String escapedDescription = escape(description);
        String escapedCanonicalUrl = escape(canonicalUrl);
        String escapedImageUrl = escape(image.url());
        String escapedImageAlt = escape(image.alt());
        return """
                <!doctype html>
                <html lang="zh-CN">
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <title>%s</title>
                  <link rel="canonical" href="%s">
                  <meta name="robots" content="index,follow">
                  <meta name="description" content="%s">
                  <meta property="og:type" content="article">
                  <meta property="og:site_name" content="%s">
                  <meta property="og:title" content="%s">
                  <meta property="og:description" content="%s">
                  <meta property="og:url" content="%s">
                  <meta property="og:image" content="%s">
                  <meta property="og:image:alt" content="%s">
                  <meta property="og:image:width" content="%d">
                  <meta property="og:image:height" content="%d">
                  <meta name="twitter:card" content="summary_large_image">
                  <meta name="twitter:title" content="%s">
                  <meta name="twitter:description" content="%s">
                  <meta name="twitter:image" content="%s">
                  <meta name="twitter:image:alt" content="%s">
                  <script>location.replace(%s);</script>
                </head>
                <body>
                  <main>
                    <h1>%s</h1>
                    <p>%s</p>
                    <p><a href="%s">打开 MemeSee 帖子</a></p>
                  </main>
                </body>
                </html>
                """.formatted(
                escapedPageTitle,
                escapedCanonicalUrl,
                escapedDescription,
                SITE_NAME,
                escapedTitle,
                escapedDescription,
                escapedCanonicalUrl,
                escapedImageUrl,
                escapedImageAlt,
                image.width(),
                image.height(),
                escapedTitle,
                escapedDescription,
                escapedImageUrl,
                escapedImageAlt,
                javascriptString(canonicalUrl),
                escapedTitle,
                escapedDescription,
                escapedCanonicalUrl
        );
    }

    private String normalizeTitle(MainPostDetailResponse post, TargetSubPost targetSubPost) {
        String title = normalizeWhitespace(post.title());
        if (targetSubPost != null) {
            String author = normalizeWhitespace(targetSubPost.subPost().getAuthorUsername());
            String suffix = author.isBlank() ? "子帖" : "@" + stripLeadingAts(author) + " 的子帖";
            if (!title.isBlank()) {
                return title + " · " + suffix;
            }
            return "MemeSee 帖子 #" + post.id() + " · " + suffix;
        }
        if (!title.isBlank()) {
            return title;
        }
        return "MemeSee 帖子 #" + post.id();
    }

    private String normalizeDescription(MainPostDetailResponse post, TargetSubPost targetSubPost) {
        if (targetSubPost != null) {
            String content = normalizeDescriptionText(targetSubPost.subPost().getContent());
            String mediaSummary = buildMediaSummary(targetSubPost.mediaAssets());
            if (!content.isBlank() && !isLegacyEmptyMediaOnlyText(content, mediaSummary)) {
                return truncate("定位到子帖 #" + targetSubPost.subPost().getId() + "：" + content, DESCRIPTION_LIMIT);
            }
            if (!mediaSummary.isBlank()) {
                return "定位到子帖 #" + targetSubPost.subPost().getId() + "：" + mediaSummary;
            }
            String author = normalizeWhitespace(targetSubPost.subPost().getAuthorUsername());
            if (!author.isBlank()) {
                return "定位到 @" + stripLeadingAts(author) + " 在 MemeSee 发布的子帖。";
            }
            return "定位到 MemeSee 帖子中的子帖。";
        }
        String content = normalizeDescriptionText(post.content());
        String mediaSummary = buildPostMediaSummary(post.mediaAssets());
        if (!content.isBlank() && !isLegacyEmptyMediaOnlyText(content, mediaSummary)) {
            return truncate(content, DESCRIPTION_LIMIT);
        }
        if (!mediaSummary.isBlank()) {
            return mediaSummary + " · MemeSee 帖子";
        }
        String author = normalizeWhitespace(post.authorUsername());
        String community = normalizeWhitespace(post.communityName());
        if (!author.isBlank() && !community.isBlank()) {
            return "来自 @" + author + " 在 " + community + " 发布的 MemeSee 帖子。";
        }
        if (!author.isBlank()) {
            return "来自 @" + author + " 发布的 MemeSee 帖子。";
        }
        return "MemeSee 上的公开帖子。";
    }

    private String normalizeDescriptionText(String value) {
        String normalized = normalizeWhitespace(value)
                .replaceAll("!\\[[^\\]]*]\\([^)]*\\)", " ")
                .replaceAll("\\[([^\\]]+)]\\([^)]*\\)", "$1")
                .replaceAll("[*_~`#]+", "");
        return normalizeWhitespace(normalized)
                .replaceAll("\\s+(?:和|与|及|以及|还有|and)(?=\\s*(?:[，。！？；：,.!?;:]|$))", "")
                .replaceAll("\\s+([，。！？；：,.!?;:])", "$1")
                .trim();
    }

    private boolean isLegacyEmptyMediaOnlyText(String content, String mediaSummary) {
        return "无内容".equals(content) && !mediaSummary.isBlank();
    }

    private String buildMediaSummary(List<MediaAssetResponse> mediaAssets) {
        int imageCount = countImageAssets(mediaAssets);
        if (imageCount <= 0) {
            return "";
        }
        return imageCount + " 张图片";
    }

    private String buildPostMediaSummary(List<MainPostDetailMediaAssetResponse> mediaAssets) {
        int imageCount = countPostImageAssets(mediaAssets);
        if (imageCount <= 0) {
            return "";
        }
        return imageCount + " 张图片";
    }

    private int countImageAssets(List<MediaAssetResponse> mediaAssets) {
        if (mediaAssets == null || mediaAssets.isEmpty()) {
            return 0;
        }
        int count = 0;
        for (MediaAssetResponse asset : mediaAssets) {
            if (asset != null
                    && "IMAGE".equalsIgnoreCase(normalizeWhitespace(asset.kind()))
                    && isReadyProcessingStatus(asset.processingStatus())) {
                count += 1;
            }
        }
        return count;
    }

    private int countPostImageAssets(List<MainPostDetailMediaAssetResponse> mediaAssets) {
        if (mediaAssets == null || mediaAssets.isEmpty()) {
            return 0;
        }
        int count = 0;
        for (MainPostDetailMediaAssetResponse asset : mediaAssets) {
            if (asset != null
                    && "IMAGE".equalsIgnoreCase(normalizeWhitespace(asset.kind()))
                    && isReadyProcessingStatus(asset.processingStatus())) {
                count += 1;
            }
        }
        return count;
    }

    private ShareImage selectImage(MainPostDetailResponse post, TargetSubPost targetSubPost, String baseUrl) {
        if (targetSubPost != null) {
            ShareImage subPostImage = selectImage(
                    targetSubPost.mediaAssets().stream()
                            .filter(asset -> asset != null)
                            .map(ShareMediaAsset::from)
                            .toList(),
                    baseUrl,
                    "MemeSee 子帖图片"
            );
            if (subPostImage != null) {
                return subPostImage;
            }
        }
        ShareImage mainPostImage = selectImage(
                post.mediaAssets() == null
                        ? List.of()
                        : post.mediaAssets().stream()
                                .filter(asset -> asset != null)
                                .map(ShareMediaAsset::from)
                                .toList(),
                baseUrl,
                "MemeSee 帖子图片"
        );
        if (mainPostImage != null) {
            return mainPostImage;
        }
        return new ShareImage(
                baseUrl + DEFAULT_IMAGE_PATH,
                "MemeSee 分享预览图",
                DEFAULT_IMAGE_WIDTH,
                DEFAULT_IMAGE_HEIGHT,
                "default"
        );
    }

    private ShareImage selectImage(List<ShareMediaAsset> mediaAssets, String baseUrl, String alt) {
        if (mediaAssets != null) {
            for (ShareMediaAsset asset : mediaAssets) {
                if (!isReadyImage(asset)) {
                    continue;
                }
                String url = firstNonBlank(
                        asset.displayUrl(),
                        asset.mediumUrl(),
                        asset.smallUrl(),
                        asset.thumbUrl(),
                        asset.url(),
                        asset.originalUrl()
                );
                if (!url.isBlank()) {
                    return new ShareImage(toAbsoluteUrl(url, baseUrl), alt, positiveOrDefault(
                            asset.width(),
                            DEFAULT_IMAGE_WIDTH
                    ), positiveOrDefault(asset.height(), DEFAULT_IMAGE_HEIGHT), imageSource(alt));
                }
            }
        }
        return null;
    }

    private boolean isReadyImage(ShareMediaAsset asset) {
        if (asset == null || !"IMAGE".equalsIgnoreCase(normalizeWhitespace(asset.kind()))) {
            return false;
        }
        String processingStatus = normalizeWhitespace(asset.processingStatus());
        return isReadyProcessingStatus(processingStatus);
    }

    private boolean isReadyProcessingStatus(String processingStatus) {
        String normalized = normalizeWhitespace(processingStatus);
        return normalized.isBlank() || "READY".equalsIgnoreCase(normalized);
    }

    private TargetSubPostResolution resolveTargetSubPost(Long mainPostId, TargetSubPostId targetSubPostId) {
        if (targetSubPostId == null) {
            return new TargetSubPostResolution(null, "success");
        }
        if (!targetSubPostId.valid()) {
            return new TargetSubPostResolution(null, "invalid_sub_post_query");
        }
        try {
            SubPost subPost = subPostApplicationSupport.requireActiveSubPost(targetSubPostId.value());
            if (!mainPostId.equals(subPost.getMainPostId())) {
                return new TargetSubPostResolution(null, "sub_post_cross_post");
            }
            Map<Long, List<MediaAssetResponse>> mediaBySubPostId =
                    subPostMediaCollaborationApplicationService.resolveSubPostMediaByIds(List.of(subPost.getId()));
            return new TargetSubPostResolution(
                    new TargetSubPost(subPost, mediaBySubPostId.getOrDefault(subPost.getId(), List.of())),
                    "success"
            );
        } catch (ApiException error) {
            return new TargetSubPostResolution(null, "sub_post_not_found");
        }
    }

    private String buildCanonicalUrl(String baseUrl, Long mainPostId, TargetSubPost targetSubPost) {
        String canonicalUrl = baseUrl + "/posts/" + mainPostId;
        if (targetSubPost == null) {
            return canonicalUrl;
        }
        return canonicalUrl + "?subPost=" + targetSubPost.subPost().getId();
    }

    private String toAbsoluteUrl(String url, String baseUrl) {
        String trimmed = url.trim();
        String lower = trimmed.toLowerCase(Locale.ROOT);
        if (lower.startsWith("https://") || lower.startsWith("http://")) {
            return trimmed;
        }
        if (trimmed.startsWith("/")) {
            return baseUrl + trimmed;
        }
        return baseUrl + "/" + trimmed;
    }

    private ShareOrigin resolveOrigin(HttpServletRequest request) {
        String scheme = normalizeScheme(firstNonBlank(
                header(request, "X-Forwarded-Proto"),
                request == null ? null : request.getScheme()
        ));
        String host = normalizeHost(firstNonBlank(
                header(request, "X-Forwarded-Host"),
                header(request, "Host"),
                request == null ? null : request.getServerName()
        ));
        return new ShareOrigin(scheme + "://" + host);
    }

    private TargetSubPostId parseTargetSubPostId(String targetSubPostId) {
        String normalized = normalizeWhitespace(targetSubPostId);
        if (normalized.isBlank()) {
            return null;
        }
        try {
            long parsed = Long.parseLong(normalized);
            return parsed > 0 ? new TargetSubPostId(parsed, true) : new TargetSubPostId(null, false);
        } catch (NumberFormatException error) {
            return new TargetSubPostId(null, false);
        }
    }

    private String imageSource(String alt) {
        return "MemeSee 子帖图片".equals(alt) ? "sub_post" : "main_post";
    }

    private String normalizeScheme(String scheme) {
        String normalized = normalizeWhitespace(scheme).toLowerCase(Locale.ROOT);
        if ("http".equals(normalized) || "https".equals(normalized)) {
            return normalized;
        }
        return "https";
    }

    private String normalizeHost(String host) {
        String normalized = normalizeWhitespace(host);
        if (normalized.matches("[A-Za-z0-9.-]+(:[0-9]{1,5})?")) {
            return normalized;
        }
        return DEFAULT_HOST;
    }

    private String header(HttpServletRequest request, String name) {
        return request == null ? null : request.getHeader(name);
    }

    private String normalizeWhitespace(String value) {
        if (value == null) {
            return "";
        }
        return value.replaceAll("\\s+", " ").trim();
    }

    private String truncate(String value, int limit) {
        if (value.length() <= limit) {
            return value;
        }
        return value.substring(0, Math.max(0, limit - 1)).stripTrailing() + "…";
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }
        for (String value : values) {
            String normalized = normalizeWhitespace(value);
            if (!normalized.isBlank()) {
                return normalized;
            }
        }
        return "";
    }

    private String stripLeadingAts(String value) {
        String normalized = normalizeWhitespace(value);
        while (normalized.startsWith("@")) {
            normalized = normalized.substring(1);
        }
        return normalized;
    }

    private int positiveOrDefault(int value, int defaultValue) {
        return value > 0 ? value : defaultValue;
    }

    private String escape(String value) {
        return HtmlUtils.htmlEscape(value == null ? "" : value);
    }

    private String javascriptString(String value) {
        String escaped = value
                .replace("\\", "\\\\")
                .replace("'", "\\'")
                .replace("\r", "")
                .replace("\n", "");
        return "'" + escaped + "'";
    }

    private record ShareOrigin(String baseUrl) {
    }

    private record ShareImage(String url, String alt, int width, int height, String source) {
    }

    private record ShareMediaAsset(
            String kind,
            String url,
            String thumbUrl,
            String smallUrl,
            String mediumUrl,
            String displayUrl,
            String originalUrl,
            int width,
            int height,
            String processingStatus
    ) {
        static ShareMediaAsset from(MainPostDetailMediaAssetResponse asset) {
            return new ShareMediaAsset(
                    asset.kind(),
                    asset.url(),
                    asset.thumbUrl(),
                    asset.smallUrl(),
                    asset.mediumUrl(),
                    asset.displayUrl(),
                    asset.originalUrl(),
                    asset.width(),
                    asset.height(),
                    asset.processingStatus()
            );
        }

        static ShareMediaAsset from(MediaAssetResponse asset) {
            return new ShareMediaAsset(
                    asset.kind(),
                    asset.url(),
                    asset.thumbUrl(),
                    asset.smallUrl(),
                    asset.mediumUrl(),
                    asset.displayUrl(),
                    asset.originalUrl(),
                    asset.width(),
                    asset.height(),
                    asset.processingStatus()
            );
        }
    }

    private record TargetSubPost(SubPost subPost, List<MediaAssetResponse> mediaAssets) {
    }

    private record TargetSubPostResolution(TargetSubPost targetSubPost, String outcome) {
    }

    private record TargetSubPostId(Long value, boolean valid) {
    }
}
