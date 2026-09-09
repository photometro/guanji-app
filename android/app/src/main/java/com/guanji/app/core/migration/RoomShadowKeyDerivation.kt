package com.guanji.app.core.migration

import android.util.Base64
import java.nio.charset.StandardCharsets
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/** #223：现有 DEK 不直接作为 SQLCipher 口令，使用版本化 HKDF-SHA256 派生。 */
object RoomShadowKeyDerivation {
    const val INFO = "guanji-room-sqlcipher-v1"

    fun deriveFromBase64(dekB64: String): ByteArray {
        val input = Base64.decode(dekB64, Base64.DEFAULT)
        require(input.size >= 16) { "invalid DEK" }
        val prk = hmac(ByteArray(32), input)
        return hmac(prk, INFO.toByteArray(StandardCharsets.UTF_8) + byteArrayOf(1))
    }

    private fun hmac(key: ByteArray, value: ByteArray): ByteArray =
        Mac.getInstance("HmacSHA256").run {
            init(SecretKeySpec(key, "HmacSHA256"))
            doFinal(value)
        }
}
