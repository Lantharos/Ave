# Ave Testing Guide

This guide walks you through testing Ave's passwordless authentication and end-to-end encryption features.

## Prerequisites

1. **Start the Backend Server**
   ```bash
   cd ave-server
   bun run dev
   ```

2. **Start the Frontend**
   ```bash
   cd ave-web
   bun run dev
   ```

3. **Ensure Database is Running**
   - PostgreSQL should be running with the Ave database created
   - Run migrations if you haven't: `cd ave-server && bun run db:push`

---

## Test 1: Account Registration (E2EE Setup)

### What You're Testing
- Passkey creation (WebAuthn)
- Master key generation (client-side)
- Master key encryption with security questions
- Trust code generation

### Steps

1. **Go to Registration Page**
   - Navigate to `http://localhost:5173` (or 5174)
   - Click "Register" or go to `/register`

2. **Create Identity**
   - Enter a unique handle (e.g., `testuser`)
   - Enter your name, email (optional), birthday (optional)
   - Upload an avatar (optional)
   - Click "Continue"

3. **Create Passkey**
   - Click "Set up passkey"
   - Your browser will prompt you to create a passkey
   - Use your device's biometric (Touch ID, Face ID, Windows Hello) or PIN
   - ✅ **E2EE Checkpoint**: Master key is generated in browser, never sent to server

4. **Answer Security Questions**
   - Choose 3 security questions from the dropdown
   - Enter answers (save these somewhere for testing recovery later!)
   - Click "Continue"
   - ✅ **E2EE Checkpoint**: Answers are hashed locally, master key is encrypted with your answers

5. **Save Trust Codes**
   - You'll see 2 trust codes in format: `XXXXX-XXXXX-XXXXX-XXXXX-XXXXX`
   - **IMPORTANT**: Copy these codes! You'll need them for testing recovery
   - Check the box "I have saved my trust codes"
   - Click "Continue"
   - ✅ **E2EE Checkpoint**: Trust codes encrypt a backup of your master key

6. **Enrollment Complete**
   - You should be automatically logged in
   - You'll see the Dashboard

---

## Test 2: Normal Login (Passkey Authentication)

### What You're Testing
- Passkey authentication (WebAuthn)
- Master key retrieval from encrypted storage
- Session management

### Steps

1. **Log Out**
   - Click your profile icon in the top right
   - Click "Log out"

2. **Start Login**
   - Enter your handle
   - Click "Continue"

3. **Authenticate with Passkey**
   - Click "Continue with passkey"
   - Browser will prompt for biometric/PIN
   - Use the same method you used during registration
   - ✅ **Auth Checkpoint**: Server verifies passkey signature, issues session

4. **Verify Login**
   - You should be logged in and see the Dashboard
   - Check that your identities, devices, and data are accessible

---

## Test 3: Trust Code Recovery

### What You're Testing
- Account recovery without passkey
- Master key decryption using trust code
- Re-enrollment of new device

### Steps

1. **Log Out**
   - Log out from the dashboard

2. **Start Login**
   - Enter your handle
   - Click "Continue"

3. **Use Trust Code**
   - Click "Use a trust code"
   - Enter one of the trust codes you saved during registration
   - Click "Continue"
   - ✅ **E2EE Checkpoint**: Trust code decrypts your master key backup locally

4. **Verify Recovery**
   - You should be logged in
   - All your data should be accessible
   - Check Dashboard → Devices - you should see a new device entry
   - Go to Dashboard → Security - you should have 1 trust code remaining

---

## Test 4: Security Question Recovery

### What You're Testing
- Account recovery using security questions
- Master key reconstruction from answers
- Trust code regeneration

### Steps

1. **Log Out**

2. **Start Login**
   - Enter your handle
   - Click "Continue"

3. **Use Security Questions**
   - Click "Answer security questions"
   - You'll see your 3 security questions
   - Enter the EXACT answers you provided during registration
   - Click "Verify Answers"
   - ✅ **E2EE Checkpoint**: Answers decrypt your master key locally

4. **Verify Recovery**
   - You should be logged in
   - All your data should be accessible

---

## Test 5: Multi-Device Login (✅ NEWLY IMPLEMENTED)

### What You're Testing
- Login approval flow
- WebSocket real-time notifications
- Master key transfer between devices via ephemeral key exchange (ECDH)
- Polling fallback if WebSocket is unavailable

### Prerequisites
- You must already be logged in on Device 1 (or Browser Window 1)
- Device 1 must have the master key stored locally

### Steps

1. **On Device 1 (Already Logged In)**
   - Open Ave in a normal browser window (e.g., Chrome)
   - Go to the Dashboard
   - Keep this window open in the background
   - ✅ **WebSocket Checkpoint**: You should be connected (check browser console for "WebSocket connected")

2. **On Device 2 (New Device/Browser)**
   - Open Ave in an incognito window or different browser
   - Go to the login page
   - Enter your handle (e.g., `testuser`)
   - Click "Continue"

3. **Choose Login Method**
   - You should see multiple options:
     - "USE PASSKEY" (if you have passkeys)
     - **"CONFIRM ON A TRUSTED DEVICE"** ← Click this one
     - "USE TRUST CODES"
   - Click the button on **"CONFIRM ON A TRUSTED DEVICE"**
   - ✅ **Ephemeral Key Checkpoint**: Device 2 generates an ECDH key pair locally

4. **Wait for Approval**
   - Device 2 should show: "WAITING FOR APPROVAL"
   - A spinning loader with "Waiting for approval..." text
   - Instructions to open Ave on a trusted device
   - ✅ **WebSocket Checkpoint**: Device 2 subscribes to login request status
   - ✅ **Backend Checkpoint**: Login request saved to database with requester's public key

5. **On Device 1 - See Notification**
   - Switch back to Device 1 (the window you left open)
   - You should see a **red badge** with a number on "Login Requests" in the sidebar
   - ✅ **WebSocket Checkpoint**: Real-time notification received
   - If you don't see it, refresh the page or check Dashboard → Login Requests manually

6. **On Device 1 - Approve Request**
   - Click **"Login Requests"** in the sidebar
   - You should see a card showing:
     - Device icon (computer/phone/tablet)
     - Device name
     - Browser and OS information
     - IP address
     - Time ago (e.g., "Just now")
   - Click the **"Approve"** button (white button)
   - ✅ **E2EE Checkpoint**: 
     - Device 1 loads its master key from localStorage
     - Device 1 generates its own ephemeral ECDH key pair
     - Device 1 derives shared secret using Device 2's public key
     - Master key is encrypted with the shared secret
     - Encrypted master key is sent to the backend
   - ✅ **WebSocket Checkpoint**: Backend notifies Device 2 via WebSocket

7. **On Device 2 - Automatic Login**
   - Switch back to Device 2
   - You should see:
     - Green checkmark icon
     - "Approved! Signing you in..." message
   - After 1-2 seconds, you should be redirected to the Dashboard
   - ✅ **E2EE Checkpoint**: 
     - Device 2 receives encrypted master key
     - Device 2 derives the same shared secret using Device 1's ephemeral public key
     - Master key is decrypted locally
     - Master key is stored in localStorage
   - ✅ **Success**: You're now logged in on both devices with full E2EE!

### Testing Denial Flow

1. **Repeat Steps 1-5** above to create a new login request

2. **On Device 1 - Deny Request**
   - Go to Dashboard → Login Requests
   - Click the **"Deny"** button (red button) instead of Approve
   - ✅ **WebSocket Checkpoint**: Backend notifies Device 2 of denial

3. **On Device 2 - See Denial**
   - You should see:
     - Red X icon
     - "Request denied" message
     - Option to "Try another method"

### Testing Expiration

1. **Create a login request** (Steps 1-4 above)

2. **Wait 5 minutes** without approving or denying

3. **On Device 2**
   - You should see:
     - Yellow clock icon
     - "Request expired" message
     - Option to "Try another method"

### Testing Without WebSocket (Polling Fallback)

1. **Disable WebSocket** (in browser DevTools):
   - Open DevTools → Network tab
   - Find WS filter
   - Block WebSocket connections (or close the connection manually)

2. **Create a login request** as normal

3. **The flow should still work**:
   - Device 2 polls the status every 2 seconds via HTTP GET
   - Device 1 still sees requests (refresh the page if needed)
   - Approval/denial works via HTTP POST
   - Device 2 gets the result via polling

### Troubleshooting

**Device 1 doesn't show the notification:**
- Check if WebSocket is connected (browser console)
- Manually navigate to Dashboard → Login Requests
- The request should appear in the list

**Device 2 stuck on "Waiting":**
- Check browser console for errors
- Verify the backend is running
- Check if the request expired (5-minute timeout)
- Try the polling fallback (WebSocket might have failed)

**"Master key not available" error:**
- Device 1 must have the master key stored locally
- If you cleared localStorage, you need to recover using trust codes first

**Encrypted master key transfer fails:**
- Check browser console for crypto errors
- Verify both devices support ECDH (P-256 curve)
- Check that public keys are properly encoded in base64

---

## Test 6: Identity Management

### What You're Testing
- Creating additional identities
- Switching between identities
- Updating identity information

### Steps

1. **Create Additional Identity**
   - Go to Dashboard → Identity
   - Click "New Identity" (if available)
   - Enter different handle, name
   - Save

2. **Switch Between Identities**
   - Click on identity selector
   - Choose different identity
   - Verify data is scoped to that identity

3. **Update Identity**
   - Go to Dashboard → Identity
   - Click edit icon on any field
   - Update name, email, birthday
   - Upload avatar
   - Change banner color or upload banner image
   - ✅ **R2 Checkpoint**: Images uploaded to Cloudflare R2

---

## Test 7: Device Management

### What You're Testing
- Viewing active devices
- Revoking device access
- Understanding current device indicator

### Steps

1. **View Devices**
   - Go to Dashboard → Devices
   - You should see all active devices with:
     - Device type (computer/phone/tablet)
     - Browser
     - Last seen timestamp
     - "This device" badge on current device

2. **Revoke a Device**
   - If you have multiple devices, click the revoke icon on one
   - Confirm revocation
   - That device's session should be invalidated

3. **Revoke All Devices**
   - Click "Revoke All Devices"
   - Confirm
   - All devices except current should be logged out

---

## Test 8: Security Management

### What You're Testing
- Adding/removing passkeys
- Regenerating trust codes
- Updating security questions

### Steps

1. **View Security Settings**
   - Go to Dashboard → Security
   - See all your passkeys
   - See trust codes remaining count

2. **Add New Passkey**
   - Click "Add a new passkey"
   - Follow browser prompts
   - Verify new passkey appears in list

3. **Rename Passkey**
   - Click edit icon on a passkey
   - Give it a descriptive name (e.g., "MacBook Pro Touch ID")
   - Save

4. **Regenerate Trust Codes**
   - Click "Regenerate trust codes"
   - Confirm warning (old codes will be invalidated)
   - Save new codes somewhere safe
   - ✅ **E2EE Checkpoint**: New codes generated, master key re-encrypted

5. **Delete Passkey** (if you have multiple)
   - Click delete icon on a passkey
   - Confirm deletion
   - Note: You cannot delete your only passkey

---

## Test 9: Activity Log

### What You're Testing
- Activity logging
- Filtering by severity
- Search functionality

### Steps

1. **View Activity Log**
   - Go to Dashboard → Activity Log
   - You should see all your recent actions:
     - Account created
     - Login events
     - Passkey added/removed
     - Trust codes regenerated
     - Profile updates

2. **Filter by Severity**
   - Click "Info" - see informational events
   - Click "Warning" - see security-related events
   - Click "Danger" - see critical security events

3. **Search Activity**
   - Use the search box to find specific actions
   - Try searching for "login" or "passkey"

---

## Test 10: Data Export & Account Deletion

### What You're Testing
- GDPR data export
- Account deletion with confirmation

### Steps

1. **Export Your Data**
   - Go to Dashboard → My Data
   - Click "Export my data"
   - A JSON file should download with all your data

2. **Delete Account** (Optional - Test on Throwaway Account)
   - Click "Delete my account"
   - Type `DELETE MY ACCOUNT` exactly
   - Confirm deletion
   - Account and all data should be permanently deleted

---

## Test 11: OAuth Authorization (If OAuth Apps Configured)

### What You're Testing
- Third-party app authorization
- Identity selection for OAuth
- E2EE support in OAuth flow

### Steps

1. **Initiate OAuth Flow**
   - Go to a test OAuth URL like:
     ```
     http://localhost:5173/authorize?client_id=test_client&redirect_uri=http://localhost:3001/callback&state=abc123
     ```

2. **Review App Info**
   - You should see the app's name, description, website
   - E2EE indicator if the app supports it

3. **Select Identity**
   - Choose which identity to authorize
   - Review the identity information that will be shared

4. **Authorize**
   - Swipe to authorize (if implemented)
   - You should be redirected to the app with an authorization code

---

## E2EE Verification Checklist

Here's what should **NEVER** be sent to the server in plaintext:

✅ **Master Key** - Generated in browser, never leaves in plaintext
✅ **Security Question Answers** - Only hashed versions sent to server
✅ **Decrypted User Data** - Server only stores encrypted data
✅ **Trust Code Plaintext** - Only hashed versions stored on server

Here's what the server **CAN** see:

- ✅ Hashed passkey challenges/responses (WebAuthn protocol)
- ✅ Encrypted master key backups
- ✅ Hashed security question answers
- ✅ Hashed trust codes
- ✅ Session tokens (for authentication)
- ✅ Device information (browser, OS, IP)
- ✅ Activity logs (actions, not content)

---

## Common Issues & Debugging

### Passkey Not Working
- **Issue**: Browser doesn't prompt for passkey
- **Fix**: 
  - Make sure you're using HTTPS or localhost
  - Check browser console for WebAuthn errors
  - Verify `RP_ID` in `.env` matches your domain
  - Try a different browser (Chrome/Edge/Safari support is best)

### Trust Code Not Working
- **Issue**: Trust code rejected
- **Fix**:
  - Ensure you're entering it exactly as shown (including dashes)
  - Check if you've already used this trust code
  - Verify trust codes haven't been regenerated

### Security Questions Not Working
- **Issue**: "Incorrect answers" error
- **Fix**:
  - Answers are case-sensitive and must be exact
  - Check for extra spaces or typos
  - Remember the exact wording you used during registration

### WebSocket Errors in Console
- **Issue**: `WebSocket connection failed`
- **Fix**:
  - This is normal if you're not logged in
  - WebSocket only connects for authenticated users
  - If logged in and still failing, restart the backend server

### R2 Upload Failing
- **Issue**: Avatar/banner upload returns 500 error
- **Fix**:
  - Verify R2 environment variables are set in `ave-server/.env`
  - Check R2 bucket exists and is accessible
  - Verify API token has read/write permissions
  - Check server logs for detailed error

---

## Performance Testing

### Test Network Conditions
1. Open browser DevTools → Network tab
2. Throttle to "Slow 3G"
3. Try authentication flows
4. Verify loading states and error handling

### Test Offline Behavior
1. Disconnect from internet
2. Try to use the app
3. Verify appropriate error messages
4. Reconnect and verify sync

---

## Security Testing

### Test Session Management
1. Log in on one device
2. Copy the session token from localStorage
3. Use it from another device
4. Verify it works (stateless sessions)
5. Log out on first device
6. Verify token is invalidated everywhere

### Test CORS
1. Try to make API requests from a different origin
2. Should be blocked unless origin is whitelisted

### Test Rate Limiting (If Implemented)
1. Try to make many login attempts rapidly
2. Should be rate limited after N attempts

---

## Next Steps

After testing these features, you might want to:

1. **Implement Multi-Device Login Flow**
   - Complete the WebSocket-based device approval
   - Test master key encryption for device-to-device transfer

2. **Add More OAuth Apps**
   - Register test OAuth applications
   - Test authorization flows end-to-end

3. **Production Hardening**
   - Set up proper HTTPS with SSL certificates
   - Configure production R2 bucket with CDN
   - Set up monitoring and logging
   - Configure rate limiting
   - Add CAPTCHA for registration

4. **Mobile Testing**
   - Test on iOS Safari with Face ID/Touch ID
   - Test on Android Chrome with fingerprint
   - Verify responsive design

---

## Questions?

If you encounter any issues or have questions:
- Check the browser console for errors
- Check the server logs in the terminal
- Verify environment variables are set correctly
- Make sure database migrations are up to date
