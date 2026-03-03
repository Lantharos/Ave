package net.aveid.auth.service

import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Binder
import android.os.IBinder
import net.aveid.auth.IAveAuthCallback
import net.aveid.auth.IAveAuthService
import net.aveid.auth.ui.AuthorizeSheetActivity

class AveAuthService : Service() {
    private lateinit var sessionStore: SessionStore

    override fun onCreate() {
        super.onCreate()
        sessionStore = SessionStore(applicationContext)
    }

    private val binder = object : IAveAuthService.Stub() {
        override fun requestAuth(
            clientPackage: String,
            scope: String,
            interactive: Boolean,
            callback: IAveAuthCallback,
        ) {
            if (!isCallingPackageTrusted(clientPackage)) {
                callback.onAuthError("UNAUTHORIZED_CALLER", "Calling package mismatch")
                return
            }

            val session = sessionStore.getSessionState()
            if (session != null) {
                callback.onAuthSuccess(session.sessionToken, session.identityId, session.expiresAtEpochMs)
                return
            }

            if (!interactive) {
                callback.onAuthError("INTERACTION_REQUIRED", "No active Ave session")
                return
            }

            val request = AuthCallbackRegistry.put(
                PendingAuthRequest(
                    callerPackage = clientPackage,
                    scope = scope,
                    callback = callback,
                )
            )

            callback.onUserInteractionRequired(request.id)

            val intent = Intent(this@AveAuthService, AuthorizeSheetActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                .putExtra(AuthorizeSheetActivity.EXTRA_REQUEST_ID, request.id)
                .putExtra(AuthorizeSheetActivity.EXTRA_SCOPE, scope)
                .putExtra(AuthorizeSheetActivity.EXTRA_CALLER_PACKAGE, clientPackage)
            startActivity(intent)
        }

        override fun cancelRequest(requestId: String) {
            AuthCallbackRegistry.remove(requestId)
        }
    }

    override fun onBind(intent: Intent?): IBinder = binder

    private fun isCallingPackageTrusted(clientPackage: String): Boolean {
        val uid = Binder.getCallingUid()
        val packages = packageManager.getPackagesForUid(uid)?.toSet().orEmpty()
        if (!packages.contains(clientPackage)) {
            return false
        }

        return runCatching {
            val aveSignatures = packageManager.getPackageInfo(packageName, PackageManager.GET_SIGNING_CERTIFICATES)
                .signingInfo
                ?.apkContentsSigners
                ?.map { it.toCharsString() }
                ?.toSet()
                .orEmpty()

            val callerSignatures = packageManager.getPackageInfo(clientPackage, PackageManager.GET_SIGNING_CERTIFICATES)
                .signingInfo
                ?.apkContentsSigners
                ?.map { it.toCharsString() }
                ?.toSet()
                .orEmpty()

            aveSignatures.isNotEmpty() && aveSignatures == callerSignatures
        }.getOrDefault(false)
    }
}
