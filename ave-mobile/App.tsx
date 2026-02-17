import "react-native-get-random-values";
import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { useCameraPermissions } from "expo-camera";
import { api, type Identity, type LoginRequest } from "./src/lib/api";
import {
  createRequesterKeyPair,
  decryptMasterKeyFromApprover,
  encryptMasterKeyForRequester,
  recoverMasterKeyFromBackup,
} from "./src/lib/crypto";
import { clearSession, loadMasterKeyRaw, loadSession, saveMasterKeyRaw, saveSession } from "./src/lib/storage";
import { parseRequestIdFromQr } from "./src/lib/qr";
import { WelcomeScreen } from "./src/screens/WelcomeScreen";
import { LoginHandleScreen } from "./src/screens/LoginHandleScreen";
import { LoginMethodsScreen } from "./src/screens/LoginMethodsScreen";
import { LoginTrustCodeScreen } from "./src/screens/LoginTrustCodeScreen";
import { LoginWaitingScreen } from "./src/screens/LoginWaitingScreen";
import { ScannerScreen } from "./src/screens/ScannerScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import type { DashboardTab } from "./src/components/navigation/BottomTabs";
import "./app.css";

type Screen = "welcome" | "login-handle" | "login-methods" | "login-trust" | "login-waiting" | "dashboard" | "scanner";

export default function App() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [masterKeyRaw, setMasterKeyRaw] = useState<Uint8Array | null>(null);
  const [requesterPrivateKey, setRequesterPrivateKey] = useState<Uint8Array | null>(null);
  const [loginRequestId, setLoginRequestId] = useState<string | null>(null);
  const [methodIdentity, setMethodIdentity] = useState<Identity | null>(null);
  const [hasDevices, setHasDevices] = useState(false);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>("home");
  const [waitingText, setWaitingText] = useState("Waiting for one of your trusted devices to approve this login.");

  const [handle, setHandle] = useState("");
  const [trustCode, setTrustCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<LoginRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    (async () => {
      const session = await loadSession();
      const storedMasterKey = await loadMasterKeyRaw();
      setMasterKeyRaw(storedMasterKey);
      if (session.token) {
        setSessionToken(session.token);
        setHandle(session.handle || "");
        try {
          const identityData = await api.listIdentities(session.token);
          setIdentities(identityData.identities);
        } catch {
          setIdentities([]);
        }
        setScreen("dashboard");
      } else {
        setScreen("welcome");
      }
    })();
  }, []);

  useEffect(() => {
    if (screen === "dashboard" && sessionToken) {
      void refreshRequests();
      const id = setInterval(() => {
        void refreshRequests(true);
      }, 5000);
      return () => clearInterval(id);
    }
  }, [screen, sessionToken]);

  useEffect(() => {
    if (screen !== "login-waiting" || !loginRequestId) return;

    const id = setInterval(() => {
      void pollLoginRequest();
    }, 2000);

    return () => clearInterval(id);
  }, [screen, loginRequestId, requesterPrivateKey]);

  async function checkHandleAndMethods() {
    if (!handle.trim()) {
      Alert.alert("Missing details", "Enter your handle.");
      return;
    }

    setLoading(true);
    try {
      const result = await api.loginStart(handle.trim());
      setMethodIdentity(result.identity);
      setHasDevices(result.hasDevices);
      setScreen("login-methods");
    } catch (error) {
      Alert.alert("Sign in failed", error instanceof Error ? error.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function startTrustedDeviceLogin() {
    setLoading(true);
    try {
      const requesterKeyPair = createRequesterKeyPair();
      setRequesterPrivateKey(requesterKeyPair.requesterPrivateKey);
      const result = await api.requestApproval({
        handle: handle.trim(),
        requesterPublicKey: requesterKeyPair.requesterPublicKey,
      });
      setLoginRequestId(result.requestId);
      setWaitingText("Approve this sign-in request on one of your existing trusted devices.");
      setScreen("login-waiting");
    } catch (error) {
      Alert.alert("Request failed", error instanceof Error ? error.message : "Could not request approval");
    } finally {
      setLoading(false);
    }
  }

  async function pollLoginRequest() {
    if (!loginRequestId) return;
    try {
      const status = await api.checkRequestStatus(loginRequestId);
      if (status.status === "pending") {
        return;
      }

      if (status.status === "denied") {
        setWaitingText("This login request was denied.");
        return;
      }

      if (status.status === "expired") {
        setWaitingText("This login request expired. Try again.");
        return;
      }

      if (status.status === "approved" && status.sessionToken && status.identities) {
        if (!status.encryptedMasterKey || !status.approverPublicKey || !requesterPrivateKey) {
          throw new Error("Approval data incomplete");
        }

        const recoveredMasterKey = decryptMasterKeyFromApprover(
          status.encryptedMasterKey,
          status.approverPublicKey,
          requesterPrivateKey
        );

        await saveMasterKeyRaw(recoveredMasterKey);
        setMasterKeyRaw(recoveredMasterKey);
        await saveSession(status.sessionToken, handle.trim());
        setSessionToken(status.sessionToken);
        setIdentities(status.identities);
        setScreen("dashboard");
      }
    } catch (error) {
      console.warn("poll login status failed", error);
    }
  }

  async function doLogin() {
    if (!handle.trim() || !trustCode.trim()) {
      Alert.alert("Missing details", "Enter your handle and trust code.");
      return;
    }

    setLoading(true);
    try {
      const result = await api.loginWithTrustCode({
        handle: handle.trim(),
        code: trustCode.trim(),
      });

      if (result.encryptedMasterKeyBackup) {
        const recovered = recoverMasterKeyFromBackup(result.encryptedMasterKeyBackup, trustCode.trim());
        if (!recovered) {
          throw new Error("Trust code worked, but failed to recover encryption key");
        }
        await saveMasterKeyRaw(recovered);
        setMasterKeyRaw(recovered);
      }

      await saveSession(result.sessionToken, handle.trim());
      setSessionToken(result.sessionToken);
      setIdentities(result.identities);
      setTrustCode("");
      setScreen("dashboard");
    } catch (error) {
      Alert.alert("Login failed", error instanceof Error ? error.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function refreshRequests(silent = false) {
    if (!sessionToken) return;
    if (!silent) setRefreshing(true);
    try {
      const data = await api.getPendingRequests(sessionToken);
      setRequests(data.requests);
    } catch (error) {
      if (!silent) {
        Alert.alert("Error", error instanceof Error ? error.message : "Failed to load requests");
      }
    } finally {
      if (!silent) setRefreshing(false);
    }
  }

  async function approveRequest(requestId: string) {
    if (!sessionToken) return;

    if (!masterKeyRaw) {
      Alert.alert("Missing key", "This device does not have your master key yet. Sign in with a trust code first.");
      return;
    }

    const request = requests.find((item) => item.id === requestId);
    if (!request?.requesterPublicKey) {
      Alert.alert("Approve failed", "Missing requester key for secure approval.");
      return;
    }

    setLoading(true);
    try {
      const encrypted = encryptMasterKeyForRequester(masterKeyRaw, request.requesterPublicKey);
      await api.approveRequest(
        sessionToken,
        requestId,
        encrypted.encryptedMasterKey,
        encrypted.approverPublicKey
      );
      await refreshRequests();
      Alert.alert("Approved", "Login request approved.");
    } catch (error) {
      Alert.alert("Approve failed", error instanceof Error ? error.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function denyRequest(requestId: string) {
    if (!sessionToken) return;
    setLoading(true);
    try {
      await api.denyRequest(sessionToken, requestId);
      await refreshRequests();
      Alert.alert("Denied", "Login request denied.");
    } catch (error) {
      Alert.alert("Deny failed", error instanceof Error ? error.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await clearSession();
    setSessionToken(null);
    setMasterKeyRaw(null);
    setIdentities([]);
    setRequests([]);
    setScreen("welcome");
  }

  function handleQrScanned(value: string) {
    const requestId = parseRequestIdFromQr(value);
    if (!requestId) {
      Alert.alert("Invalid QR", "This QR code is not an Ave login request.");
      return;
    }
    void approveRequest(requestId);
    setScreen("dashboard");
  }

  if (screen === "welcome") return <WelcomeScreen onLogin={() => setScreen("login-handle")} />;

  if (screen === "login-handle") {
    return (
      <LoginHandleScreen
        handle={handle}
        loading={loading}
        onHandleChange={setHandle}
        onContinue={() => void checkHandleAndMethods()}
        onBack={() => setScreen("welcome")}
      />
    );
  }

  if (screen === "login-methods") {
    return (
      <LoginMethodsScreen
        identity={methodIdentity}
        hasDevices={hasDevices}
        loading={loading}
        onTrustedDevice={() => void startTrustedDeviceLogin()}
        onTrustCode={() => setScreen("login-trust")}
        onBack={() => setScreen("login-handle")}
      />
    );
  }

  if (screen === "login-trust") {
    return (
      <LoginTrustCodeScreen
        handle={handle}
        trustCode={trustCode}
        loading={loading}
        onTrustCodeChange={setTrustCode}
        onSubmit={() => void doLogin()}
        onBack={() => setScreen("login-methods")}
      />
    );
  }

  if (screen === "login-waiting") {
    return <LoginWaitingScreen statusText={waitingText} onBack={() => setScreen("login-methods")} />;
  }

  if (screen === "scanner") {
    return (
      <ScannerScreen
        permission={permission}
        onRequestPermission={() => void requestPermission()}
        onScan={handleQrScanned}
        onCancel={() => setScreen("dashboard")}
      />
    );
  }

  return (
    <DashboardScreen
      handle={handle}
      identities={identities}
      requests={requests}
      tab={dashboardTab}
      loading={loading}
      refreshing={refreshing}
      onTabChange={setDashboardTab}
      onOpenScanner={() => setScreen("scanner")}
      onRefresh={() => void refreshRequests()}
      onApprove={(requestId) => void approveRequest(requestId)}
      onDeny={(requestId) => void denyRequest(requestId)}
      onLogout={() => void logout()}
    />
  );
}
