package net.aveid.auth.crypto

import android.util.Base64
import java.nio.ByteBuffer
import java.security.KeyFactory
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.security.PrivateKey
import java.security.PublicKey
import java.security.spec.PKCS8EncodedKeySpec
import java.security.spec.X509EncodedKeySpec
import javax.crypto.Cipher
import javax.crypto.KeyAgreement
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

data class EncryptedTransfer(
    val encryptedMasterKey: String,
    val approverPublicKey: String,
)

data class RequesterKeyPair(
    val publicKeySpkiB64: String,
    val privateKeyPkcs8B64: String,
)

object KeyExchangeCrypto {
    private const val AES_MODE = "AES/GCM/NoPadding"
    private const val AES_KEY_BYTES = 32

    fun encryptMasterKeyForRequester(masterKeyRaw: ByteArray, requesterPublicKeySpkiB64: String): EncryptedTransfer {
        val requesterPublic = parseSpkiPublicKey(requesterPublicKeySpkiB64)
        val keyPair = generateP256KeyPair()
        val sharedAesKey = deriveSharedAesKeyRaw(keyPair.private, requesterPublic)
        val encrypted = encryptAesGcm(masterKeyRaw, sharedAesKey)
        val approverPublicKeyB64 = Base64.encodeToString(keyPair.public.encoded, Base64.NO_WRAP)

        return EncryptedTransfer(
            encryptedMasterKey = encrypted,
            approverPublicKey = approverPublicKeyB64,
        )
    }

    fun createRequesterKeyPair(): RequesterKeyPair {
        val keyPair = generateP256KeyPair()
        return RequesterKeyPair(
            publicKeySpkiB64 = Base64.encodeToString(keyPair.public.encoded, Base64.NO_WRAP),
            privateKeyPkcs8B64 = Base64.encodeToString(keyPair.private.encoded, Base64.NO_WRAP),
        )
    }

    fun decryptMasterKeyFromApprover(
        encryptedMasterKeyB64: String,
        approverPublicKeySpkiB64: String,
        requesterPrivateKeyPkcs8B64: String,
    ): ByteArray {
        val approverPublic = parseSpkiPublicKey(approverPublicKeySpkiB64)
        val requesterPrivate = parsePkcs8PrivateKey(requesterPrivateKeyPkcs8B64)
        val currentKey = deriveSharedAesKeyRaw(requesterPrivate, approverPublic)
        val currentAttempt = runCatching { decryptAesGcm(encryptedMasterKeyB64, currentKey) }
        if (currentAttempt.isSuccess) {
            return currentAttempt.getOrThrow()
        }

        val legacyKey = MessageDigest.getInstance("SHA-256").digest(currentKey)
        return decryptAesGcm(encryptedMasterKeyB64, legacyKey)
    }

    private fun parseSpkiPublicKey(spkiB64: String): PublicKey {
        val bytes = Base64.decode(spkiB64, Base64.DEFAULT)
        val keySpec = X509EncodedKeySpec(bytes)
        val keyFactory = KeyFactory.getInstance("EC")
        return keyFactory.generatePublic(keySpec)
    }

    private fun generateP256KeyPair(): KeyPair {
        val generator = KeyPairGenerator.getInstance("EC")
        generator.initialize(256)
        return generator.generateKeyPair()
    }

    private fun deriveSharedAesKeyRaw(privateKey: PrivateKey, peerPublic: PublicKey): ByteArray {
        val agreement = KeyAgreement.getInstance("ECDH")
        agreement.init(privateKey)
        agreement.doPhase(peerPublic, true)
        return normalizeToAes256Key(agreement.generateSecret())
    }

    private fun normalizeToAes256Key(sharedSecret: ByteArray): ByteArray {
        if (sharedSecret.size == AES_KEY_BYTES) return sharedSecret
        if (sharedSecret.size > AES_KEY_BYTES) {
            return sharedSecret.copyOfRange(sharedSecret.size - AES_KEY_BYTES, sharedSecret.size)
        }

        val padded = ByteArray(AES_KEY_BYTES)
        val offset = AES_KEY_BYTES - sharedSecret.size
        System.arraycopy(sharedSecret, 0, padded, offset, sharedSecret.size)
        return padded
    }

    private fun parsePkcs8PrivateKey(pkcs8B64: String): PrivateKey {
        val bytes = Base64.decode(pkcs8B64, Base64.DEFAULT)
        val keySpec = PKCS8EncodedKeySpec(bytes)
        val keyFactory = KeyFactory.getInstance("EC")
        return keyFactory.generatePrivate(keySpec)
    }

    private fun encryptAesGcm(plaintext: ByteArray, key: ByteArray): String {
        val cipher = Cipher.getInstance(AES_MODE)
        val iv = ByteArray(12)
        java.security.SecureRandom().nextBytes(iv)
        val secretKey = SecretKeySpec(key.copyOf(32), "AES")
        val spec = GCMParameterSpec(128, iv)
        cipher.init(Cipher.ENCRYPT_MODE, secretKey, spec)
        val ciphertext = cipher.doFinal(plaintext)
        val packed = ByteBuffer.allocate(iv.size + ciphertext.size)
            .put(iv)
            .put(ciphertext)
            .array()
        return Base64.encodeToString(packed, Base64.NO_WRAP)
    }

    private fun decryptAesGcm(encryptedPackedB64: String, key: ByteArray): ByteArray {
        val packed = Base64.decode(encryptedPackedB64, Base64.DEFAULT)
        require(packed.size > 12) { "Invalid encrypted payload" }
        val iv = packed.copyOfRange(0, 12)
        val ciphertext = packed.copyOfRange(12, packed.size)

        val cipher = Cipher.getInstance(AES_MODE)
        val secretKey = SecretKeySpec(key.copyOf(32), "AES")
        val spec = GCMParameterSpec(128, iv)
        cipher.init(Cipher.DECRYPT_MODE, secretKey, spec)
        return cipher.doFinal(ciphertext)
    }
}
