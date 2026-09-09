package com.guanji.thesis;

import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** #222：仅用于毕设版本地联通演示，不代表发行版联网能力。 */
@RestController
public class HealthController {
    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of(
                "status", "ok",
                "service", "guanji-thesis-server",
                "privacyMode", "local-lan-only",
                "modules", List.of("announcement", "feedback", "snapshot", "review", "audit"));
    }
}
