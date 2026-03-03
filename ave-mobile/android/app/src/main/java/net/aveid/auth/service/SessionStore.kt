package net.aveid.auth.service

import android.content.Context
import net.aveid.auth.mobile.IdentityProfile
import org.json.JSONArray
import org.json.JSONObject

class SessionStore(context: Context) {
    private val prefs = context.getSharedPreferences("ave_auth", Context.MODE_PRIVATE)

    fun getSessionState(): SessionState? {
        val token = prefs.getString("session_token", null) ?: return null
        val identity = prefs.getString("identity_id", null) ?: return null
        val expiresAt = prefs.getLong("expires_at", 0L)
        if (expiresAt <= System.currentTimeMillis()) {
            clear()
            return null
        }
        return SessionState(token, identity, expiresAt)
    }

    fun saveSessionState(state: SessionState) {
        prefs.edit()
            .putString("session_token", state.sessionToken)
            .putString("identity_id", state.identityId)
            .putLong("expires_at", state.expiresAtEpochMs)
            .apply()
    }

    fun getCachedIdentities(): List<IdentityProfile> {
        val raw = prefs.getString("cached_identities", null) ?: return emptyList()
        val parsed = runCatching {
            val array = JSONArray(raw)
            buildList {
                for (index in 0 until array.length()) {
                    val item = array.getJSONObject(index)
                    add(
                        IdentityProfile(
                            id = item.optString("id"),
                            handle = item.optString("handle"),
                            displayName = item.optString("displayName"),
                            avatarUrl = item.optString("avatarUrl").ifBlank { null },
                            bannerUrl = item.optString("bannerUrl").ifBlank { null },
                            isPrimary = item.optBoolean("isPrimary", false),
                        )
                    )
                }
            }
        }.getOrElse { emptyList() }

        return parsed
    }

    fun saveCachedIdentities(identities: List<IdentityProfile>) {
        val payload = JSONArray().apply {
            identities.forEach { identity ->
                put(
                    JSONObject().apply {
                        put("id", identity.id)
                        put("handle", identity.handle)
                        put("displayName", identity.displayName)
                        put("avatarUrl", identity.avatarUrl)
                        put("bannerUrl", identity.bannerUrl)
                        put("isPrimary", identity.isPrimary)
                    }
                )
            }
        }

        prefs.edit().putString("cached_identities", payload.toString()).apply()
    }

    fun clear() {
        prefs.edit().clear().apply()
    }
}
