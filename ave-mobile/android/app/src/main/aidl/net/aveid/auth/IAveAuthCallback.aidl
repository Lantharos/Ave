package net.aveid.auth;

interface IAveAuthCallback {
    void onAuthSuccess(String sessionToken, String identityId, long expiresAtEpochMs);
    void onUserInteractionRequired(String requestId);
    void onAuthError(String code, String message);
}
