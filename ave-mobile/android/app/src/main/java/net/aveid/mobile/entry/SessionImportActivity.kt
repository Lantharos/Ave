package net.aveid.mobile.entry

import android.app.Activity
import android.net.Uri
import android.os.Bundle
import net.aveid.auth.service.SessionState
import net.aveid.auth.service.SessionStore

class SessionImportActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        importSession(intent?.data)
        finish()
    }

    private fun importSession(uri: Uri?) {
        if (uri == null) {
            return
        }

        val token = uri.getQueryParameter("sessionToken") ?: return
        val identityId = uri.getQueryParameter("identityId") ?: return
        val expiresAt = uri.getQueryParameter("expiresAt")?.toLongOrNull() ?: return

        SessionStore(applicationContext).saveSessionState(
            SessionState(
                sessionToken = token,
                identityId = identityId,
                expiresAtEpochMs = expiresAt,
            )
        )
    }
}
