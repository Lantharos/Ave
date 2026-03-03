package net.aveid.auth.crypto

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.nio.ByteBuffer
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class MasterKeyStore(context: Context) {
    private val prefs = context.getSharedPreferences("ave_keys", Context.MODE_PRIVATE)

    fun saveMasterKey(masterKeyRaw: ByteArray) {
        val cipher = Cipher.getInstance(AES_MODE)
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
        val encrypted = cipher.doFinal(masterKeyRaw)
        val packed = ByteBuffer.allocate(cipher.iv.size + encrypted.size)
            .put(cipher.iv)
            .put(encrypted)
            .array()
        prefs.edit().putString(KEY_MASTER, Base64.encodeToString(packed, Base64.NO_WRAP)).apply()
    }

    fun readMasterKey(): ByteArray? {
        val stored = prefs.getString(KEY_MASTER, null) ?: return null
        val packed = Base64.decode(stored, Base64.DEFAULT)
        if (packed.size < 13) {
            return null
        }

        val iv = packed.copyOfRange(0, 12)
        val encrypted = packed.copyOfRange(12, packed.size)

        val cipher = Cipher.getInstance(AES_MODE)
        val spec = GCMParameterSpec(128, iv)
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), spec)
        return cipher.doFinal(encrypted)
    }

    private fun getOrCreateKey(): SecretKey {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val existing = keyStore.getKey(KEY_ALIAS, null)
        if (existing is SecretKey) {
            return existing
        }

        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        val spec = KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setUserAuthenticationRequired(false)
            .build()

        generator.init(spec)
        return generator.generateKey()
    }

    companion object {
        private const val KEY_ALIAS = "ave.master.key.local"
        private const val KEY_MASTER = "master_key_encrypted"
        private const val AES_MODE = "AES/GCM/NoPadding"
    }
}
