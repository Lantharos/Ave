package net.aveid.auth.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import net.aveid.auth.crypto.KeyExchangeCrypto
import net.aveid.auth.crypto.MasterKeyStore
import net.aveid.auth.mobile.AveApiClient
import net.aveid.auth.mobile.PendingLoginRequest
import net.aveid.auth.service.SessionStore

class LoginRequestsActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val qrToken = intent.getStringExtra(EXTRA_QR_TOKEN)
        val requestId = intent.getStringExtra(EXTRA_REQUEST_ID)

        setContent {
            MaterialTheme {
                Surface {
                    LoginRequestScreen(
                        qrToken = qrToken,
                        requestId = requestId,
                        onClose = { finish() },
                    )
                }
            }
        }
    }

    companion object {
        const val EXTRA_QR_TOKEN = "qr_token"
        const val EXTRA_REQUEST_ID = "request_id"
        private const val API_BASE = "https://api.aveid.net"
    }

    @Composable
    private fun LoginRequestScreen(qrToken: String?, requestId: String?, onClose: () -> Unit) {
        val scope = rememberCoroutineScope()
        val loading = remember { mutableStateOf(true) }
        val status = remember { mutableStateOf("Loading request…") }
        val requestState = remember { mutableStateOf<PendingLoginRequest?>(null) }
        val actionBusy = remember { mutableStateOf(false) }

        fun load() {
            scope.launch {
                val session = SessionStore(applicationContext).getSessionState()
                if (session == null) {
                    loading.value = false
                    status.value = "No active Ave session on this device"
                    return@launch
                }

                val result = withContext(Dispatchers.IO) {
                    runCatching {
                        val api = AveApiClient(API_BASE, session.sessionToken)
                        when {
                            !qrToken.isNullOrBlank() -> api.claimQrToken(qrToken)
                            !requestId.isNullOrBlank() -> {
                                api.getPendingRequests().firstOrNull { it.id == requestId }
                                    ?: throw IllegalStateException("Request not found")
                            }
                            else -> api.getPendingRequests().firstOrNull()
                                ?: throw IllegalStateException("No pending requests")
                        }
                    }
                }

                result.onSuccess {
                    requestState.value = it
                    status.value = "Authorize this sign-in"
                    loading.value = false
                }.onFailure { error ->
                    status.value = error.message ?: "Failed to load request"
                    loading.value = false
                }
            }
        }

        fun approve() {
            val request = requestState.value ?: return
            actionBusy.value = true
            status.value = "Approving…"

            scope.launch {
                val session = SessionStore(applicationContext).getSessionState()
                val masterKey = MasterKeyStore(applicationContext).readMasterKey()

                if (session == null || masterKey == null) {
                    actionBusy.value = false
                    status.value = "Master key unavailable on this phone"
                    return@launch
                }

                val result = withContext(Dispatchers.IO) {
                    runCatching {
                        val transfer = KeyExchangeCrypto.encryptMasterKeyForRequester(
                            masterKeyRaw = masterKey,
                            requesterPublicKeySpkiB64 = request.requesterPublicKey,
                        )
                        AveApiClient(API_BASE, session.sessionToken).approveRequest(
                            requestId = request.id,
                            encryptedMasterKey = transfer.encryptedMasterKey,
                            approverPublicKey = transfer.approverPublicKey,
                        )
                    }
                }

                result.onSuccess {
                    status.value = "Approved"
                    onClose()
                }.onFailure { error ->
                    status.value = error.message ?: "Failed to approve"
                    actionBusy.value = false
                }
            }
        }

        fun deny() {
            val request = requestState.value ?: return
            actionBusy.value = true
            status.value = "Denying…"

            scope.launch {
                val session = SessionStore(applicationContext).getSessionState()
                if (session == null) {
                    actionBusy.value = false
                    status.value = "Session unavailable"
                    return@launch
                }

                val result = withContext(Dispatchers.IO) {
                    runCatching {
                        AveApiClient(API_BASE, session.sessionToken).denyRequest(request.id)
                    }
                }

                result.onSuccess {
                    status.value = "Denied"
                    onClose()
                }.onFailure { error ->
                    status.value = error.message ?: "Failed to deny"
                    actionBusy.value = false
                }
            }
        }

        LaunchedEffect(Unit) {
            load()
        }

        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFF090909))
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(360.dp)
                    .background(
                        brush = Brush.radialGradient(
                            colors = listOf(Color(0x55226E8A), Color(0x222A6E88), Color.Transparent),
                        )
                    )
            )

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 22.dp, vertical = 28.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text(
                    text = "Approve login",
                    style = MaterialTheme.typography.headlineSmall,
                    color = Color(0xFFEFF0F4),
                    fontWeight = FontWeight.SemiBold,
                )

                Text(
                    text = status.value,
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color(0xFFA1A4AD),
                )

                val request = requestState.value
                if (request != null) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF121214), RoundedCornerShape(20.dp))
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text(
                            text = request.deviceName,
                            style = MaterialTheme.typography.titleMedium,
                            color = Color(0xFFF5F6FA),
                        )
                        Text(
                            text = "${request.browser} on ${request.os}",
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color(0xFFB0B3BB),
                        )
                        Text(
                            text = request.ipAddress,
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFF838791),
                        )
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Button(
                            onClick = { deny() },
                            enabled = !actionBusy.value && !loading.value,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFF1A1A1C),
                                contentColor = Color(0xFFD7D9E2),
                                disabledContainerColor = Color(0xFF1A1A1C),
                                disabledContentColor = Color(0xFF6F737E),
                            ),
                            shape = RoundedCornerShape(16.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Deny")
                        }

                        Spacer(modifier = Modifier.width(2.dp))

                        Button(
                            onClick = { approve() },
                            enabled = !actionBusy.value && !loading.value,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFFE8E9EE),
                                contentColor = Color(0xFF111114),
                                disabledContainerColor = Color(0xFF2D2E31),
                                disabledContentColor = Color(0xFF8F9198),
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
    }
}
