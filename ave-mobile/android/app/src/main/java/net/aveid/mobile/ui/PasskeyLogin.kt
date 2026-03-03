package net.aveid.mobile.ui

import android.app.Activity
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetPublicKeyCredentialOption
import androidx.credentials.PublicKeyCredential

suspend fun getPasskeyAuthenticationCredentialJson(activity: Activity, authOptionsJson: String): String {
    val credentialManager = CredentialManager.create(activity)
    val option = GetPublicKeyCredentialOption(authOptionsJson)
    val request = GetCredentialRequest(listOf(option))
    val result = credentialManager.getCredential(activity, request)
    val credential = result.credential

    if (credential !is PublicKeyCredential) {
        throw IllegalStateException("Passkey response was not a public key credential")
    }

    return credential.authenticationResponseJson
}
