package net.aveid.auth;

import net.aveid.auth.IAveAuthCallback;

interface IAveAuthService {
    void requestAuth(String clientPackage, String scope, boolean interactive, IAveAuthCallback callback);
    void cancelRequest(String requestId);
}
