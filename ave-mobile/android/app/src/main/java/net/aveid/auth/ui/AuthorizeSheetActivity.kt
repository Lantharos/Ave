package net.aveid.auth.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import net.aveid.auth.service.AuthCallbackRegistry
import net.aveid.auth.service.SessionStore

class AuthorizeSheetActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val requestId = intent.getStringExtra(EXTRA_REQUEST_ID)
        val scope = intent.getStringExtra(EXTRA_SCOPE).orEmpty()
        val callerPackage = intent.getStringExtra(EXTRA_CALLER_PACKAGE).orEmpty()

        if (requestId.isNullOrBlank()) {
            finish()
            return
        }

        val request = AuthCallbackRegistry.get(requestId)
        if (request == null) {
            finish()
            return
        }

        setContent {
            MaterialTheme {
                Surface {
                    AuthorizeSheet(
                        callerPackage = callerPackage,
                        scope = scope,
                        onApprove = {
                            val session = SessionStore(applicationContext).getSessionState()
                            if (session == null) {
                                request.callback.onAuthError("NO_SESSION", "No Ave session is available")
                            } else {
                                request.callback.onAuthSuccess(
                                    session.sessionToken,
                                    session.identityId,
                                    session.expiresAtEpochMs,
                                )
                            }
                            AuthCallbackRegistry.remove(requestId)
                            finish()
                        },
                        onDeny = {
                            request.callback.onAuthError("DENIED", "User denied authorization")
                            AuthCallbackRegistry.remove(requestId)
                            finish()
                        },
                    )
                }
            }
        }
    }

    @Composable
    private fun AuthorizeSheet(
        callerPackage: String,
        scope: String,
        onApprove: () -> Unit,
        onDeny: () -> Unit,
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFF090909))
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(300.dp)
                    .background(
                        brush = Brush.radialGradient(
                            colors = listOf(Color(0x552A5D9B), Color(0x22246578), Color.Transparent),
                        )
                    )
            )

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(22.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text(
                    text = "Authorize app login",
                    color = Color(0xFFEDEFF5),
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.SemiBold,
                )

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF121214), RoundedCornerShape(20.dp))
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = callerPackage,
                        color = Color(0xFFF4F5FA),
                        style = MaterialTheme.typography.titleMedium,
                    )
                    Text(
                        text = scope,
                        color = Color(0xFFA8ABB4),
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }

                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Button(
                        onClick = onDeny,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF1A1A1C),
                            contentColor = Color(0xFFD2D5DD),
                        ),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Deny")
                    }

                    Button(
                        onClick = onApprove,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFFE8E9EE),
                            contentColor = Color(0xFF111114),
                        ),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Approve")
                    }
                }
            }
        }
    }

    companion object {
        const val EXTRA_REQUEST_ID = "request_id"
        const val EXTRA_SCOPE = "scope"
        const val EXTRA_CALLER_PACKAGE = "caller_package"
    }
}
