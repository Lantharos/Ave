package net.aveid.mobile.ui

import android.app.Activity
import android.net.Uri
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import net.aveid.auth.crypto.KeyExchangeCrypto
import net.aveid.auth.crypto.MasterKeyStore
import net.aveid.auth.crypto.TrustCodeRecoveryCrypto
import net.aveid.auth.mobile.AveApiClient
import net.aveid.auth.mobile.IdentityProfile
import net.aveid.auth.mobile.PendingLoginRequest
import net.aveid.auth.service.SessionState
import net.aveid.auth.service.SessionStore

private const val API_BASE = "https://api.aveid.net"

private enum class AuthScreen {
    START,
    METHODS,
    TRUST_CODE,
    WAITING_APPROVAL,
    DASHBOARD,
}

@Composable
fun AuthAppScreen(onOpenRequest: (String) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val sessionStore = remember { SessionStore(context.applicationContext) }

    val screen = remember { mutableStateOf(AuthScreen.START) }
    val error = remember { mutableStateOf<String?>(null) }
    val loading = remember { mutableStateOf(false) }

    val handle = remember { mutableStateOf("") }
    val trustCode = remember { mutableStateOf("") }
    val displayName = remember { mutableStateOf("") }

    val hasDevices = remember { mutableStateOf(false) }
    val hasPasskeys = remember { mutableStateOf(false) }
    val authSessionId = remember { mutableStateOf<String?>(null) }
    val authOptionsJson = remember { mutableStateOf<String?>(null) }

    val pendingRequestId = remember { mutableStateOf<String?>(null) }
    val requesterPrivateKey = remember { mutableStateOf<String?>(null) }
    val waitingTicks = remember { mutableIntStateOf(0) }

    val sessionToken = remember { mutableStateOf<String?>(null) }
    val pendingSessionFromPasskey = remember { mutableStateOf<SessionState?>(null) }

    val dashboardRequests = remember { mutableStateOf<List<PendingLoginRequest>>(emptyList()) }
    val identities = remember { mutableStateOf(sessionStore.getCachedIdentities()) }

    fun fallbackIdentityList(): List<IdentityProfile> = sessionStore.getCachedIdentities()

    fun saveSession(session: SessionState) {
        sessionStore.saveSessionState(session)
        sessionToken.value = session.sessionToken
        pendingSessionFromPasskey.value = null
        screen.value = AuthScreen.DASHBOARD
    }

    fun loadDashboardRequests() {
        val token = sessionToken.value ?: return
        loading.value = true
        error.value = null

        scope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    val api = AveApiClient(API_BASE, token)
                    val requests = api.getPendingRequests()
                    val loadedIdentities = api.getIdentities()
                    Pair(requests, loadedIdentities)
                }
            }
            loading.value = false

            result.onSuccess {
                dashboardRequests.value = it.first
                identities.value = if (it.second.isNotEmpty()) {
                    sessionStore.saveCachedIdentities(it.second)
                    it.second
                } else {
                    fallbackIdentityList()
                }
            }
            result.onFailure {
                error.value = it.message ?: "Failed to load requests"
                if (identities.value.isEmpty()) {
                    identities.value = fallbackIdentityList()
                }
            }
        }
    }

    fun openQrScanner() {
        val activity = context as? Activity ?: run {
            error.value = "Scanner unavailable"
            return
        }
        val token = sessionToken.value ?: run {
            error.value = "Session expired"
            return
        }

        val options = GmsBarcodeScannerOptions.Builder()
            .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
            .build()

        GmsBarcodeScanning.getClient(activity, options)
            .startScan()
            .addOnSuccessListener { barcode ->
                val rawValue = barcode.rawValue?.trim().orEmpty()
                if (rawValue.isBlank()) {
                    error.value = "Invalid QR code"
                    return@addOnSuccessListener
                }

                val parsedToken = runCatching { Uri.parse(rawValue).getQueryParameter("qrToken") }
                    .getOrNull()
                    .takeUnless { it.isNullOrBlank() }
                    ?: rawValue

                loading.value = true
                scope.launch {
                    val claimResult = withContext(Dispatchers.IO) {
                        runCatching { AveApiClient(API_BASE, token).claimQrToken(parsedToken) }
                    }
                    loading.value = false

                    claimResult.onSuccess { request ->
                        onOpenRequest(request.id)
                        loadDashboardRequests()
                    }.onFailure {
                        error.value = it.message ?: "Could not claim QR login"
                    }
                }
            }
            .addOnFailureListener {
                error.value = it.message ?: "QR scan canceled"
            }
    }

    fun denyPendingRequest(requestId: String) {
        val token = sessionToken.value ?: run {
            error.value = "Session expired"
            return
        }

        loading.value = true
        scope.launch {
            val denyResult = withContext(Dispatchers.IO) {
                runCatching { AveApiClient(API_BASE, token).denyRequest(requestId) }
            }
            loading.value = false

            denyResult.onSuccess {
                dashboardRequests.value = dashboardRequests.value.filterNot { it.id == requestId }
                loadDashboardRequests()
            }.onFailure {
                error.value = it.message ?: "Could not deny login request"
            }
        }
    }

    fun lookupHandle() {
        if (handle.value.isBlank()) {
            error.value = "Enter your handle"
            return
        }

        loading.value = true
        error.value = null

        scope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching { AveApiClient(API_BASE, "").loginStart(handle.value.trim()) }
            }
            loading.value = false

            result.onSuccess {
                displayName.value = it.identity.displayName
                hasDevices.value = it.hasDevices
                hasPasskeys.value = it.hasPasskeys
                authSessionId.value = it.authSessionId
                authOptionsJson.value = it.authOptionsJson
                screen.value = AuthScreen.METHODS
            }.onFailure {
                error.value = it.message ?: "Account lookup failed"
            }
        }
    }

    fun startDeviceApproval() {
        val keyPair = KeyExchangeCrypto.createRequesterKeyPair()
        requesterPrivateKey.value = keyPair.privateKeyPkcs8B64
        loading.value = true
        error.value = null

        scope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    AveApiClient(API_BASE, "").requestDeviceApproval(
                        handle = handle.value.trim(),
                        requesterPublicKey = keyPair.publicKeySpkiB64,
                    )
                }
            }
            loading.value = false

            result.onSuccess {
                pendingRequestId.value = it.requestId
                waitingTicks.intValue = 0
                screen.value = AuthScreen.WAITING_APPROVAL
            }.onFailure {
                error.value = it.message ?: "Could not start approval"
            }
        }
    }

    fun loginWithPasskey() {
        val activity = context as? Activity
        val sessionId = authSessionId.value
        val optionsJson = authOptionsJson.value
        if (activity == null || sessionId.isNullOrBlank() || optionsJson.isNullOrBlank()) {
            error.value = "Passkey is unavailable for this account"
            return
        }

        loading.value = true
        error.value = null
        scope.launch {
            val credentialResult = runCatching {
                getPasskeyAuthenticationCredentialJson(activity, optionsJson)
            }

            if (credentialResult.isFailure) {
                loading.value = false
                error.value = credentialResult.exceptionOrNull()?.message ?: "Passkey authentication failed"
                return@launch
            }

            val apiResult = withContext(Dispatchers.IO) {
                runCatching {
                    AveApiClient(API_BASE, "").loginWithPasskey(sessionId, credentialResult.getOrThrow())
                }
            }
            loading.value = false

            apiResult.onSuccess {
                val session = SessionState(
                    sessionToken = it.sessionToken,
                    identityId = it.identityId,
                    expiresAtEpochMs = it.expiresAtEpochMs,
                )
                if (it.needsMasterKey) {
                    pendingSessionFromPasskey.value = session
                    screen.value = AuthScreen.TRUST_CODE
                    error.value = "Trust code required to recover encryption key"
                } else {
                    saveSession(session)
                    loadDashboardRequests()
                }
            }.onFailure {
                error.value = it.message ?: "Passkey login failed"
            }
        }
    }

    fun loginWithTrustCode() {
        if (handle.value.isBlank() || trustCode.value.isBlank()) {
            error.value = "Handle and trust code are required"
            return
        }

        loading.value = true
        error.value = null

        scope.launch {
            val pendingPasskey = pendingSessionFromPasskey.value
            if (pendingPasskey != null) {
                val recoverResult = withContext(Dispatchers.IO) {
                    runCatching {
                        AveApiClient(API_BASE, "").recoverMasterKeyBackup(handle.value.trim(), trustCode.value.trim())
                    }
                }
                loading.value = false

                recoverResult.onSuccess { backup ->
                    val recovered = TrustCodeRecoveryCrypto.recoverMasterKeyFromBackup(backup, trustCode.value.trim())
                    if (recovered == null) {
                        error.value = "Could not recover key from trust code"
                        return@onSuccess
                    }
                    MasterKeyStore(context.applicationContext).saveMasterKey(recovered)
                    saveSession(pendingPasskey)
                    loadDashboardRequests()
                }.onFailure {
                    error.value = it.message ?: "Trust code recovery failed"
                }
                return@launch
            }

            val result = withContext(Dispatchers.IO) {
                runCatching {
                    AveApiClient(API_BASE, "").loginWithTrustCode(handle.value.trim(), trustCode.value.trim())
                }
            }
            loading.value = false

            result.onSuccess { data ->
                if (!data.encryptedMasterKeyBackup.isNullOrBlank()) {
                    val recovered = TrustCodeRecoveryCrypto.recoverMasterKeyFromBackup(
                        data.encryptedMasterKeyBackup,
                        trustCode.value.trim(),
                    )
                    if (recovered != null) {
                        MasterKeyStore(context.applicationContext).saveMasterKey(recovered)
                    }
                }

                saveSession(
                    SessionState(
                        sessionToken = data.sessionToken,
                        identityId = data.identityId,
                        expiresAtEpochMs = data.expiresAtEpochMs,
                    )
                )
                loadDashboardRequests()
            }.onFailure {
                error.value = it.message ?: "Trust code login failed"
            }
        }
    }

    LaunchedEffect(Unit) {
        val existing = sessionStore.getSessionState()
        if (existing != null) {
            sessionToken.value = existing.sessionToken
            screen.value = AuthScreen.DASHBOARD
            loadDashboardRequests()
        }
    }

    LaunchedEffect(screen.value, pendingRequestId.value) {
        if (screen.value != AuthScreen.WAITING_APPROVAL) return@LaunchedEffect

        val requestId = pendingRequestId.value ?: return@LaunchedEffect
        val privateKey = requesterPrivateKey.value ?: return@LaunchedEffect

        while (screen.value == AuthScreen.WAITING_APPROVAL) {
            waitingTicks.intValue += 1
            val statusResult = withContext(Dispatchers.IO) {
                runCatching { AveApiClient(API_BASE, "").checkRequestStatus(requestId) }
            }

            val status = statusResult.getOrNull()
            if (status == null) {
                error.value = statusResult.exceptionOrNull()?.message ?: "Status check failed"
                screen.value = AuthScreen.METHODS
                break
            }

            when (status.status) {
                "approved" -> {
                    val encrypted = status.encryptedMasterKey
                    val approverPublic = status.approverPublicKey
                    val token = status.sessionToken
                    val id = status.identityId
                    if (encrypted.isNullOrBlank() || approverPublic.isNullOrBlank() || token.isNullOrBlank() || id.isNullOrBlank()) {
                        error.value = "Approval response incomplete"
                        screen.value = AuthScreen.METHODS
                        break
                    }

                    val decryptedMasterKey = runCatching {
                        KeyExchangeCrypto.decryptMasterKeyFromApprover(encrypted, approverPublic, privateKey)
                    }.getOrNull()

                    if (decryptedMasterKey == null) {
                        pendingSessionFromPasskey.value = SessionState(
                            sessionToken = token,
                            identityId = id,
                            expiresAtEpochMs = status.expiresAtEpochMs
                                ?: (System.currentTimeMillis() + 30L * 24L * 60L * 60L * 1000L),
                        )
                        error.value = "Could not import key from approval. Enter trust code once on this device."
                        screen.value = AuthScreen.TRUST_CODE
                        break
                    }

                    MasterKeyStore(context.applicationContext).saveMasterKey(decryptedMasterKey)
                    saveSession(
                        SessionState(
                            sessionToken = token,
                            identityId = id,
                            expiresAtEpochMs = status.expiresAtEpochMs ?: (System.currentTimeMillis() + 30L * 24L * 60L * 60L * 1000L),
                        )
                    )
                    loadDashboardRequests()
                    break
                }

                "denied" -> {
                    error.value = "Request denied"
                    screen.value = AuthScreen.METHODS
                    break
                }

                "expired" -> {
                    error.value = "Request expired"
                    screen.value = AuthScreen.METHODS
                    break
                }
            }

            delay(2000)
        }
    }

    if (screen.value == AuthScreen.DASHBOARD) {
        val token = sessionToken.value
        if (token != null) {
            MainAppScreen(
                identities = identities.value.ifEmpty { fallbackIdentityList() },
                pendingRequests = dashboardRequests.value,
                onOpenRequest = onOpenRequest,
                onDenyRequest = ::denyPendingRequest,
                onOpenQrScanner = ::openQrScanner,
                onLogout = {
                    sessionStore.clear()
                    sessionToken.value = null
                    identities.value = emptyList()
                    dashboardRequests.value = emptyList()
                    screen.value = AuthScreen.START
                },
            )
            return
        }
    }

    AuthAppLayout(
        screen = screen.value,
        loading = loading.value,
        error = error.value,
        handle = handle.value,
        trustCode = trustCode.value,
        displayName = displayName.value,
        hasDevices = hasDevices.value,
        hasPasskeys = hasPasskeys.value,
        waitingTicks = waitingTicks.intValue,
        dashboardRequests = dashboardRequests.value,
        onHandleChange = { handle.value = it },
        onTrustCodeChange = { trustCode.value = it },
        onLookupHandle = { lookupHandle() },
        onStartDeviceApproval = { startDeviceApproval() },
        onLoginWithTrustCode = { loginWithTrustCode() },
        onLoginWithPasskey = { loginWithPasskey() },
        onBackToMethods = { screen.value = AuthScreen.METHODS },
        onGoToTrustCode = { screen.value = AuthScreen.TRUST_CODE },
        onRefreshDashboard = { loadDashboardRequests() },
        onOpenRequest = onOpenRequest,
    )
}

@Composable
private fun AuthAppLayout(
    screen: AuthScreen,
    loading: Boolean,
    error: String?,
    handle: String,
    trustCode: String,
    displayName: String,
    hasDevices: Boolean,
    hasPasskeys: Boolean,
    waitingTicks: Int,
    dashboardRequests: List<PendingLoginRequest>,
    onHandleChange: (String) -> Unit,
    onTrustCodeChange: (String) -> Unit,
    onLookupHandle: () -> Unit,
    onStartDeviceApproval: () -> Unit,
    onLoginWithTrustCode: () -> Unit,
    onLoginWithPasskey: () -> Unit,
    onBackToMethods: () -> Unit,
    onGoToTrustCode: () -> Unit,
    onRefreshDashboard: () -> Unit,
    onOpenRequest: (String) -> Unit,
) {


    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(AveColors.Background)
    ) {
        // Soft aurora glow at bottom, explicitly subtle not 'slop'
    

    Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(400.dp)
                .align(Alignment.BottomCenter)
                .background(
                    brush = Brush.radialGradient(
                        colors = listOf(Color(0x33646464), Color.Transparent),
                        radius = 800f
                    )
                )
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 60.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            
            if (!error.isNullOrBlank()) {
                Text(
                    text = error,
                    color = Color(0xFFE39DA7),
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(bottom = 24.dp)
                )
            }

            when (screen) {
                AuthScreen.START -> {
                    MainTitle("Who's signing in")
                    SubTitle("Enter your handle to continue.", Modifier.padding(top = 10.dp, bottom = 40.dp))
                    
                    InputWrapperBox {
                        Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
                            AveTextField(handle, "Your Handle or ID", onHandleChange)
                            AvePrimaryButton(if (loading) "Checking..." else "Continue", !loading, onLookupHandle)
                        }
                    }
                }

                AuthScreen.METHODS -> {
                    MainTitle("Prove it's you")
                    SubTitle("$displayName @$handle", Modifier.padding(top = 10.dp, bottom = 40.dp))
                    
                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        if (hasDevices) {
                            AuthMethodCard("Confirm device", "Approve on another logged-in Ave device", onStartDeviceApproval)
                        }
                        AuthMethodCard("Use trust code", "Sign in with your backup trust code", onGoToTrustCode)
                        if (hasPasskeys) {
                            AuthMethodCard("Use passkey", "Use your device passkey", onLoginWithPasskey)
                        }
                    }
                }

                AuthScreen.TRUST_CODE -> {
                    MainTitle("Enter trust code")
                    SubTitle("You can find it in your backup.", Modifier.padding(top = 10.dp, bottom = 40.dp))
                    
                    InputWrapperBox {
                        Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
                            AveTextField(trustCode, "XXXXX-XXXXX-XXXXX", onTrustCodeChange)
                            AvePrimaryButton(if (loading) "Signing in..." else "Sign in", !loading, onLoginWithTrustCode)
                            AveSecondaryButton("Back", onBackToMethods)
                        }
                    }
                }

                                AuthScreen.WAITING_APPROVAL -> {
                    MainTitle("Waiting")
                    SubTitle("Open Ave on your trusted device.", Modifier.padding(top = 10.dp, bottom = 40.dp))

                    InputWrapperBox {
                        Column(verticalArrangement = Arrangement.spacedBy(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Spacer(modifier = Modifier.height(16.dp))
                            androidx.compose.material3.CircularProgressIndicator(color = Color.White)
                            Spacer(modifier = Modifier.height(16.dp))
                            AveSecondaryButton("Try another method", onBackToMethods)
                        }
                    }
                }

                AuthScreen.DASHBOARD -> {
                    MainTitle("Requests")
                    SubTitle("Approve logic requests here.", Modifier.padding(top = 10.dp, bottom = 40.dp))
                    
                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        if (dashboardRequests.isEmpty()) {
                            SubTitle("No pending requests.")
                        } else {
                            dashboardRequests.take(5).forEach { request ->
                                DashboardRequestRow(request, onOpenRequest)
                            }
                        }
                        
                        AveSecondaryButton(if (loading) "Refreshing..." else "Refresh", onRefreshDashboard)
                    }
                }
            }
        }
    }
}






