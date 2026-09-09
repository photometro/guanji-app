package com.guanji.app.core.ai

/**
 * #222：AI Provider 与 UI/网络实现解耦。
 * v4.0 只建立接口和缓存契约，现有 JS AI 请求保持不变；#240 后再切换 UI 调用入口。
 */
interface InsightProvider {
    val id: String
    fun generate(context: InsightContext): InsightResult
}

data class InsightContext(
    val statsSnapshotJson: String,
    val behaviorModelJson: String,
    val evidenceGraphJson: String,
    val dataRevision: Long,
    val timezone: String,
)

sealed class InsightResult {
    data class Success(val reportJson: String, val provider: String, val model: String) : InsightResult()
    data class Failure(val code: String, val message: String, val retryable: Boolean) : InsightResult()
}

object NoOpInsightProvider : InsightProvider {
    override val id: String = "none"
    override fun generate(context: InsightContext): InsightResult =
        InsightResult.Failure("NOT_CONFIGURED", "AI provider is not configured", retryable = false)
}

data class InsightCacheKey(
    val dataRevision: Long,
    val statsRuleVersion: String,
    val timezone: String,
    val provider: String,
    val model: String,
)

interface InsightCacheStore {
    fun read(key: InsightCacheKey): String?
    fun write(key: InsightCacheKey, reportJson: String): Boolean
    fun invalidate(): Boolean
}
