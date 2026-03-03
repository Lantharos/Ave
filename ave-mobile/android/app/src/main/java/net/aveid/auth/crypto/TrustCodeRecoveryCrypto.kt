package net.aveid.auth.crypto

import android.util.Base64
import java.nio.charset.StandardCharsets
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec
import org.json.JSONObject

object TrustCodeRecoveryCrypto {
    private const val TRUST_CODE_SALT = "ave-trust-code-salt-v1"

    fun recoverMasterKeyFromBackup(backupJson: String, trustCode: String): ByteArray? {
        val parsed = runCatching { JSONObject(backupJson) }.getOrNull() ?: return null
        val backups = parsed.optJSONArray("backups") ?: return null
        if (backups.length() == 0) {
            return null
        }

        val key = deriveTrustKey(trustCode)
        for (index in 0 until backups.length()) {
            val encrypted = backups.optString(index)
            if (encrypted.isNullOrBlank()) {
                continue
            }

            val decrypted = runCatching { decryptAesGcm(encrypted, key) }.getOrNull()
            if (decrypted != null) {
                return decrypted
            }
        }

        return null
    }

    private fun deriveTrustKey(code: String): ByteArray {
        val normalized = normalizeTrustCode(code)
        val spec = PBEKeySpec(
            normalized.toCharArray(),
            TRUST_CODE_SALT.toByteArray(StandardCharsets.UTF_8),
            100_000,
            256,
        )
        val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
        return factory.generateSecret(spec).encoded
    }

    private fun normalizeTrustCode(code: String): String {
        return code.uppercase().replace(Regex("[^A-Z0-9]"), "")
    }

    private fun decryptAesGcm(payloadB64: String, key: ByteArray): ByteArray {
        val packed = Base64.decode(payloadB64, Base64.DEFAULT)
        require(packed.size > 12) { "Invalid backup payload" }
        val iv = packed.copyOfRange(0, 12)
        val ciphertext = packed.copyOfRange(12, packed.size)

        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        val secretKey = SecretKeySpec(key, "AES")
        val spec = GCMParameterSpec(128, iv)
        cipher.init(Cipher.DECRYPT_MODE, secretKey, spec)
        return cipher.doFinal(ciphertext)
    }
}
