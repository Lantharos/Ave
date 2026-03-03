package net.aveid.mobile.ui

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import net.aveid.auth.ui.LoginRequestsActivity
import net.aveid.mobile.push.AveFirebaseMessagingService

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        createNotificationChannel()

        setContent {
            MaterialTheme {
                Surface {
                    AuthAppScreen(
                        onOpenRequest = { requestId ->
                            startActivity(
                                Intent(this, LoginRequestsActivity::class.java)
                                    .putExtra(LoginRequestsActivity.EXTRA_REQUEST_ID, requestId)
                            )
                        }
                    )
                }
            }
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            AveFirebaseMessagingService.CHANNEL_ID,
            "Account events",
            NotificationManager.IMPORTANCE_DEFAULT,
        )
        channel.description = "Login and security events"
        manager.createNotificationChannel(channel)
    }
}
