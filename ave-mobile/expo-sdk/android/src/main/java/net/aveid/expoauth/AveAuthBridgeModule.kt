package net.aveid.expoauth

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.os.IBinder
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import net.aveid.auth.IAveAuthCallback
import net.aveid.auth.IAveAuthService

class AveAuthBridgeModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("AveAuthBridge")

        AsyncFunction("isAveInstalledAsync") { promise: Promise ->
            val context = appContext.reactContext ?: run {
                promise.resolve(false)
                return@AsyncFunction
            }
            promise.resolve(isAveInstalled(context))
        }

        AsyncFunction("authenticateAsync") { scope: String, interactive: Boolean, promise: Promise ->
            val context = appContext.reactContext ?: run {
                promise.reject("NO_CONTEXT", "React context is unavailable", null)
                return@AsyncFunction
            }

            if (!isAveInstalled(context)) {
                promise.reject("APP_NOT_INSTALLED", "Ave app is not installed", null)
                return@AsyncFunction
            }

            val intent = Intent("net.aveid.auth.BIND").setPackage(AVE_PACKAGE)
            var bound = false
            lateinit var connection: ServiceConnection

            fun unbind() {
                if (!bound) {
                    return
                }
                runCatching { context.unbindService(connection) }
                bound = false
            }

            connection = object : ServiceConnection {
                override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
                    val authService = IAveAuthService.Stub.asInterface(service)
                    if (authService == null) {
                        promise.reject("SERVICE_UNAVAILABLE", "Ave auth service unavailable", null)
                        unbind()
                        return
                    }

                    val callback = object : IAveAuthCallback.Stub() {
                        override fun onAuthSuccess(
                            sessionToken: String,
                            identityId: String,
                            expiresAtEpochMs: Long
                        ) {
                            promise.resolve(
                                mapOf(
                                    "sessionToken" to sessionToken,
                                    "identityId" to identityId,
                                    "expiresAtEpochMs" to expiresAtEpochMs,
                                )
                            )
                            unbind()
                        }

                        override fun onUserInteractionRequired(requestId: String) {
                        }

                        override fun onAuthError(code: String, message: String) {
                            promise.reject(code, message, null)
                            unbind()
                        }
                    }

                    try {
                        authService.requestAuth(context.packageName, scope, interactive, callback)
                    } catch (error: Throwable) {
                        promise.reject("AUTH_REQUEST_FAILED", error.message ?: "Request failed", error)
                        unbind()
                    }
                }

                override fun onServiceDisconnected(name: ComponentName?) {
                    unbind()
                }
            }

            bound = context.bindService(intent, connection, Context.BIND_AUTO_CREATE)
            if (!bound) {
                promise.reject("BIND_FAILED", "Unable to bind to Ave auth service", null)
            }
        }
    }

    private fun isAveInstalled(context: Context): Boolean {
        return try {
            context.packageManager.getPackageInfo(AVE_PACKAGE, PackageManager.GET_ACTIVITIES)
            true
        } catch (_: Throwable) {
            false
        }
    }

    companion object {
        private const val AVE_PACKAGE = "net.aveid.mobile"
    }
}
