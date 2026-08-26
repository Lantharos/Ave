import { isJwtVerificationSupported } from "../crypto-runtime.js";
import { verifyJwt } from "../jwt.js";
import type { AveIdTokenClaims, AveJwtClaims } from "../types.js";

export async function verifyReturnedTokens(params: {
  issuer?: string;
  clientId: string;
  expectedNonce: string;
  expectedSubject?: string;
  idToken?: string;
  accessTokenJwt?: string;
}): Promise<void> {
  if (!(await isJwtVerificationSupported())) return;

  if (params.idToken) {
    const idPayload = await verifyJwt<AveIdTokenClaims>(params.idToken, {
      issuer: params.issuer,
      audience: params.clientId,
      nonce: params.expectedNonce,
    });
    if (!idPayload) throw new Error("[Ave] Invalid id_token — signature or claims validation failed.");
    if (params.expectedSubject && idPayload.sub !== params.expectedSubject) {
      throw new Error("[Ave] id_token subject mismatch.");
    }
  }

  if (params.accessTokenJwt) {
    const accessPayload = await verifyJwt<AveJwtClaims>(params.accessTokenJwt, { issuer: params.issuer });
    if (!accessPayload) throw new Error("[Ave] Invalid access_token_jwt — signature or claims validation failed.");
    if (params.expectedSubject && accessPayload.sub !== params.expectedSubject) {
      throw new Error("[Ave] access_token_jwt subject mismatch.");
    }
  }
}
