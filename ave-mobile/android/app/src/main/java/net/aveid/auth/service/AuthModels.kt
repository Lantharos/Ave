package net.aveid.auth.service

import net.aveid.auth.IAveAuthCallback
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

data class SessionState(
    val sessionToken: String,
    val identityId: String,
    val expiresAtEpochMs: Long,
)

data class PendingAuthRequest(
    val id: String = UUID.randomUUID().toString(),
    val callerPackage: String,
    val scope: String,
    val callback: IAveAuthCallback,
)

object AuthCallbackRegistry {
    private val pending = ConcurrentHashMap<String, PendingAuthRequest>()

    fun put(request: PendingAuthRequest): PendingAuthRequest {
        pending[request.id] = request
        return request
    }

    fun take(requestId: String): PendingAuthRequest? = pending.remove(requestId)

    fun get(requestId: String): PendingAuthRequest? = pending[requestId]

    fun remove(requestId: String) {
        pending.remove(requestId)
    }
}
