# Example OAuth Apps - Login with Ave

This folder contains three example applications showing different ways to integrate "Sign in with Ave":

1. **`index.html`** - OAuth/OIDC with client secret (confidential clients)
2. **`index-pkce.html`** - OIDC PKCE flow without client secret (public clients)
3. **`index-e2ee.html`** - End-to-end encrypted notes app


---

## Quick Start

### Generate Credentials

```bash
node generate-credentials.js
```

This outputs SQL to insert into your database and credentials for your app config.

---

## Example 1: OAuth/OIDC (Client Secret)

**File:** `index.html`  
**Port:** `8000`  
**Best for:** Backend applications


### Setup:
1. Run `node generate-credentials.js`
2. Execute the SQL in your database
3. Update `CLIENT_ID` and `CLIENT_SECRET` in `index.html`
4. Run: `python -m http.server 8000`
5. Open: http://localhost:8000

---

## Example 2: OIDC PKCE (Public Client)

**File:** `index-pkce.html`  
**Port:** `8001`  
**Best for:** SPAs, mobile apps


### Setup:
1. Run `node generate-credentials.js`
2. Execute the SQL in your database
3. Update `CLIENT_ID` in `index-pkce.html` (NO client secret!)
4. Run: `python -m http.server 8001`
5. Open: http://localhost:8001

### Why PKCE?
- ✅ No client secret in frontend code
- ✅ Uses SHA-256 code challenge/verifier
- ✅ More secure for public clients
- ✅ Industry standard for SPAs + OIDC


---

## Example 3: E2EE Notes App

**File:** `index-e2ee.html`  
**Port:** `8002`  
**Best for:** Apps requiring end-to-end encryption

### Setup:

1. Generate credentials and **enable E2EE** in database:

```sql
INSERT INTO oauth_apps (
  name, description, icon_url, website_url, 
  client_id, client_secret_hash, redirect_uris, 
  supports_e2ee,  -- ← IMPORTANT!
  owner_id
) VALUES (
  'Secure Notes',
  'E2EE Notes Application',
  'https://example.com/icon.png',
  'http://localhost:8002',
  'YOUR_CLIENT_ID',
  'YOUR_SECRET_HASH',
  '["http://localhost:8002/callback"]'::jsonb,
  true,  -- ← Set to true
  NULL
);
```

2. Update `CLIENT_ID` in `index-e2ee.html`
3. Run: `python -m http.server 8002`
4. Open: http://localhost:8002

### How E2EE Works:

```
┌─────────────┐                    ┌─────────────┐
│   Client    │                    │   Server    │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │ 1. Login with Ave                │
       ├─────────────────────────────────>│
       │                                  │
       │ 2. Encrypted App Key             │
       │<─────────────────────────────────┤
       │                                  │
   3. Decrypt App Key                    │
      (with user's master key)           │
       │                                  │
   4. Encrypt Note                       │
      (with app key)                     │
       │                                  │
       │ 5. Store Encrypted Note          │
       ├─────────────────────────────────>│
       │                                  │
       │    Server can't read it! 🔒     │
```

**Key Points:**
- Each app gets its own encryption key
- App key is encrypted with user's master key
- User's master key never leaves their device
- Server stores only encrypted data
- Only the user can decrypt their data

### Demo Simplification

This demo generates a local encryption key for simplicity. In production:

1. Ave generates an app-specific key
2. Ave encrypts it with user's master key
3. Encrypted key stored on Ave's servers
4. On login, Ave returns encrypted app key
5. Client decrypts using master key (from passkey/trust code)
6. Client uses app key to encrypt/decrypt data

---

## OAuth/OIDC Flow Diagram


```
User                    Your App                    Ave
 │                         │                         │
 │  Click "Login"          │                         │
 ├────────────────────────>│                         │
 │                         │                         │
 │                         │  Authorization Request  │
 │                         ├────────────────────────>│
 │                         │                         │
 │                    Redirect to Ave                │
 │<──────────────────────────────────────────────────┤
 │                                                    │
 │  Login & Approve                                   │
 ├───────────────────────────────────────────────────>│
 │                                                    │
 │  Redirect with code                                │
 │<───────────────────────────────────────────────────┤
 │                         │                         │
 │                         │  Exchange code for token│
 │                         ├────────────────────────>│
 │                         │                         │
 │                         │  Access token + user    │
 │                         │<────────────────────────┤
 │                         │                         │
 │  Show user info         │                         │
 │<────────────────────────┤                         │
```

---

## Security Best Practices

### For All Apps:
- ✅ Use HTTPS in production
- ✅ Validate `state` parameter (CSRF protection)
- ✅ Store tokens securely
- ✅ Set short token expiration times
- ✅ Implement proper logout

### For Client Secret Apps:
- ✅ Never expose client secret in frontend
- ✅ Exchange tokens on backend only
- ✅ Use environment variables for secrets

### For PKCE Apps:
- ✅ Generate cryptographically random verifier
- ✅ Use S256 challenge method
- ✅ Clear verifier after use

### For E2EE Apps:
- ✅ Never send decryption keys to server
- ✅ Encrypt data before transmission
- ✅ Use strong encryption (AES-256-GCM)
- ✅ Securely derive per-app keys

---

## Troubleshooting

| Error | Solution |
|-------|----------|
| "Invalid redirect_uri" | Ensure redirect URI in database matches exactly (protocol + port) |
| "Invalid client_secret" | Check hash is correct: `crypto.createHash('sha256').update(secret).digest('hex')` |
| "App not found" | Verify `client_id` matches database |
| CORS errors | Configure Ave backend to allow requests from your origin |
| "Code verifier mismatch" | Ensure code_verifier matches the one used to generate code_challenge |
| "invalid_scope" | Ensure requested scopes are enabled for the app (openid/profile/email/offline_access) |
| Encryption fails | Check browser supports Web Crypto API (requires HTTPS or localhost) |


---

## Production Checklist

- [ ] Move token exchange to backend
- [ ] Use environment variables for secrets
- [ ] Enable HTTPS everywhere
- [ ] Implement token refresh
- [ ] Add proper error handling
- [ ] Log security events
- [ ] Rate limit OAuth endpoints
- [ ] Validate all redirects
- [ ] Implement CSRF protection
- [ ] Use secure cookie storage
- [ ] Add session timeout
- [ ] Test error scenarios

---

## Additional Resources

- OAuth 2.0 RFC: https://datatracker.ietf.org/doc/html/rfc6749
- OIDC Core: https://openid.net/specs/openid-connect-core-1_0.html
- PKCE RFC: https://datatracker.ietf.org/doc/html/rfc7636
- Web Crypto API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API

