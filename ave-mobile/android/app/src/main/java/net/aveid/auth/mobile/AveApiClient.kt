package net.aveid.auth.mobile

import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets

data class PendingLoginRequest(
    val id: String,
    val deviceName: String,
    val browser: String,
    val os: String,
    val ipAddress: String,
    val requesterPublicKey: String,
)

data class IdentitySummary(
    val id: String,
    val handle: String,
    val displayName: String,
)

data class IdentityProfile(
    val id: String,
    val handle: String,
    val displayName: String,
    val avatarUrl: String?,
    val bannerUrl: String?,
    val isPrimary: Boolean,
)

data class LoginStartResponse(
    val userId: String,
    val identity: IdentitySummary,
    val hasDevices: Boolean,
    val hasPasskeys: Boolean,
    val authSessionId: String?,
    val authOptionsJson: String?,
)

data class DeviceApprovalStartResponse(
    val requestId: String,
    val expiresAt: String,
    val qrToken: String,
)

data class RequestStatusResponse(
    val status: String,
    val sessionToken: String?,
    val encryptedMasterKey: String?,
    val approverPublicKey: String?,
    val identityId: String?,
    val expiresAtEpochMs: Long?,
)

data class TrustCodeLoginResponse(
    val sessionToken: String,
    val encryptedMasterKeyBackup: String?,
    val identityId: String,
    val expiresAtEpochMs: Long,
)

data class PasskeyLoginResponse(
    val sessionToken: String,
    val identityId: String,
    val expiresAtEpochMs: Long,
    val needsMasterKey: Boolean,
)

class AveApiClient(
    private val apiBase: String,
    private val sessionToken: String,
) {
    fun loginStart(handle: String): LoginStartResponse {
        val response = post("/api/login/start", JSONObject(mapOf("handle" to handle)).toString())
        val root = JSONObject(response)
        val identity = root.getJSONObject("identity")
        return LoginStartResponse(
            userId = root.optString("userId"),
            identity = IdentitySummary(
                id = identity.optString("id"),
                handle = identity.optString("handle"),
                displayName = identity.optString("displayName"),
            ),
            hasDevices = root.optBoolean("hasDevices"),
            hasPasskeys = root.optBoolean("hasPasskeys"),
            authSessionId = root.optString("authSessionId").ifBlank { null },
            authOptionsJson = root.optJSONObject("authOptions")?.toString(),
        )
    }

    fun requestDeviceApproval(handle: String, requesterPublicKey: String): DeviceApprovalStartResponse {
        val payload = JSONObject(
            mapOf(
                "handle" to handle,
                "requesterPublicKey" to requesterPublicKey,
                "device" to mapOf(
                    "name" to "Ave Android",
                    "type" to "phone",
                    "os" to "android",
                    "browser" to "native",
                ),
            )
        )

        val response = post("/api/login/request-approval", payload.toString())
        val root = JSONObject(response)
        return DeviceApprovalStartResponse(
            requestId = root.optString("requestId"),
            expiresAt = root.optString("expiresAt"),
            qrToken = root.optString("qrToken"),
        )
    }

    fun checkRequestStatus(requestId: String): RequestStatusResponse {
        val response = get("/api/login/request-status/$requestId")
        val root = JSONObject(response)

        val firstIdentity = root.optJSONArray("identities")
            ?.optJSONObject(0)
            ?.optString("id")

        return RequestStatusResponse(
            status = root.optString("status"),
            sessionToken = root.optString("sessionToken").ifBlank { null },
            encryptedMasterKey = root.optString("encryptedMasterKey").ifBlank { null },
            approverPublicKey = root.optString("approverPublicKey").ifBlank { null },
            identityId = firstIdentity,
            expiresAtEpochMs = root.optLong("expiresAt", 0L).takeIf { it > 0L },
        )
    }

    fun loginWithTrustCode(handle: String, code: String): TrustCodeLoginResponse {
        val payload = JSONObject(
            mapOf(
                "handle" to handle,
                "code" to code,
                "device" to mapOf(
                    "name" to "Ave Android",
                    "type" to "phone",
                    "os" to "android",
                    "browser" to "native",
                ),
            )
        )

        val response = post("/api/login/trust-code", payload.toString())
        val root = JSONObject(response)
        val identityId = root.optJSONArray("identities")
            ?.optJSONObject(0)
            ?.optString("id")
            .orEmpty()

        return TrustCodeLoginResponse(
            sessionToken = root.optString("sessionToken"),
            encryptedMasterKeyBackup = root.optString("encryptedMasterKeyBackup").ifBlank { null },
            identityId = identityId,
            expiresAtEpochMs = System.currentTimeMillis() + (30L * 24L * 60L * 60L * 1000L),
        )
    }

    fun loginWithPasskey(authSessionId: String, credentialJson: String): PasskeyLoginResponse {
        val credential = JSONObject(credentialJson)
        val payload = JSONObject(
            mapOf(
                "authSessionId" to authSessionId,
                "credential" to credential,
                "device" to mapOf(
                    "name" to "Ave Android",
                    "type" to "phone",
                    "os" to "android",
                    "browser" to "native",
                ),
            )
        )

        val response = post("/api/login/passkey", payload.toString())
        val root = JSONObject(response)
        val identity = root.optJSONArray("identities")?.optJSONObject(0)

        return PasskeyLoginResponse(
            sessionToken = root.optString("sessionToken"),
            identityId = identity?.optString("id").orEmpty(),
            expiresAtEpochMs = System.currentTimeMillis() + (30L * 24L * 60L * 60L * 1000L),
            needsMasterKey = root.optBoolean("needsMasterKey", false),
        )
    }

    fun recoverMasterKeyBackup(handle: String, code: String): String {
        val payload = JSONObject(mapOf("handle" to handle, "code" to code))
        val response = post("/api/login/recover-key", payload.toString())
        val root = JSONObject(response)
        return root.optString("encryptedMasterKeyBackup")
    }

    fun getPendingRequests(): List<PendingLoginRequest> {
        val response = get("/api/devices/pending-requests")
        val root = JSONObject(response)
        val requests = root.optJSONArray("requests") ?: JSONArray()
        val output = mutableListOf<PendingLoginRequest>()
        for (index in 0 until requests.length()) {
            val item = requests.getJSONObject(index)
            output += PendingLoginRequest(
                id = item.optString("id"),
                deviceName = item.optString("deviceName", "Unknown Device"),
                browser = item.optString("browser", "Unknown Browser"),
                os = item.optString("os", "Unknown OS"),
                ipAddress = item.optString("ipAddress", "Unknown IP"),
                requesterPublicKey = item.optString("requesterPublicKey"),
            )
        }
        return output
    }

    fun getIdentities(): List<IdentityProfile> {
        val response = get("/api/identities")
        val root = JSONObject(response)
        val identities = root.optJSONArray("identities") ?: JSONArray()
        val output = mutableListOf<IdentityProfile>()
        for (index in 0 until identities.length()) {
            val item = identities.getJSONObject(index)
            output += IdentityProfile(
                id = item.optString("id"),
                handle = item.optString("handle"),
                displayName = item.optString("displayName"),
                avatarUrl = item.optString("avatarUrl").ifBlank { null },
                bannerUrl = item.optString("bannerUrl").ifBlank { null },
                isPrimary = item.optBoolean("isPrimary", false),
            )
        }
        return output
    }

    fun claimQrToken(qrToken: String): PendingLoginRequest {
        val response = post("/api/login/scan-claim", JSONObject(mapOf("qrToken" to qrToken)).toString())
        val request = JSONObject(response).getJSONObject("request")
        return PendingLoginRequest(
            id = request.optString("id"),
            deviceName = request.optString("deviceName", "Unknown Device"),
            browser = request.optString("browser", "Unknown Browser"),
            os = request.optString("os", "Unknown OS"),
            ipAddress = request.optString("ipAddress", "Unknown IP"),
            requesterPublicKey = request.optString("requesterPublicKey"),
        )
    }

    fun approveRequest(requestId: String, encryptedMasterKey: String, approverPublicKey: String) {
        post(
            "/api/devices/approve-request",
            JSONObject(
                mapOf(
                    "requestId" to requestId,
                    "encryptedMasterKey" to encryptedMasterKey,
                    "approverPublicKey" to approverPublicKey,
                )
            ).toString()
        )
    }

    fun denyRequest(requestId: String) {
        post(
            "/api/devices/deny-request",
            JSONObject(mapOf("requestId" to requestId)).toString()
        )
    }

    private fun get(path: String): String {
        val connection = buildConnection(path, "GET")
        return readResponse(connection)
    }

    private fun post(path: String, body: String): String {
        val connection = buildConnection(path, "POST")
        connection.doOutput = true
        connection.setRequestProperty("Content-Type", "application/json")
        connection.outputStream.use { stream ->
            OutputStreamWriter(stream).use { writer ->
                writer.write(body)
            }
        }
        return readResponse(connection)
    }

    private fun buildConnection(path: String, method: String): HttpURLConnection {
        val connection = (URL(apiBase + path).openConnection() as HttpURLConnection)
        connection.requestMethod = method
        connection.setRequestProperty("Authorization", "Bearer $sessionToken")
        connection.setRequestProperty("Accept", "application/json")
        connection.connectTimeout = 10_000
        connection.readTimeout = 10_000
        return connection
    }

    private fun readResponse(connection: HttpURLConnection): String {
        val code = connection.responseCode
        val stream = if (code in 200..299) connection.inputStream else connection.errorStream
        val body = stream?.bufferedReader(StandardCharsets.UTF_8)?.use(BufferedReader::readText).orEmpty()

        if (code !in 200..299) {
            val parsedError = runCatching {
                JSONObject(body).optString("error")
            }.getOrNull()
            val message = if (!parsedError.isNullOrBlank()) parsedError else "HTTP $code"
            throw IllegalStateException(message)
        }

        return body
    }
}
