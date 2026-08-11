import { Hono } from "hono";
import approvalRoutes from "./login/approval";
import logoutRoutes from "./login/logout";
import passkeyRoutes from "./login/passkey";
import recoveryRoutes from "./login/recovery";
import startRoutes from "./login/start";
import type { Bindings } from "./login/shared";

const app = new Hono<{ Bindings: Bindings }>();

app.route("/", startRoutes);
app.route("/", passkeyRoutes);
app.route("/", approvalRoutes);
app.route("/", recoveryRoutes);
app.route("/", logoutRoutes);

export default app;
