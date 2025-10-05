// src/crypto/crypto.ts
import sodium from "libsodium-wrappers-sumo";

// base64 helpers (URL-safe off by default; use ORIGINAL to be compatible with backends)
const B64 = {
    enc: (u8: Uint8Array) => sodium.to_base64(u8, sodium.base64_variants.ORIGINAL),
    dec: (b64: string) => sodium.from_base64(b64, sodium.base64_variants.ORIGINAL),
};

let ready = false;
export async function initCrypto() {
    if (!ready) {
        await sodium.ready;
        ready = true;
    }
}

// random bytes
export function randomBytes(n: number) {
    const out = new Uint8Array(n);
    crypto.getRandomValues(out);
    return out;
}

// --- Key derivation (Argon2id) ---
export async function deriveKekFromPassword(password: string, salt: Uint8Array) {
    await initCrypto();
    // params: interactive-ish but decent for web MVP; tune up later
    const opslimit = sodium.crypto_pwhash_OPSLIMIT_MODERATE; // or SENSITIVE if perf allows
    const memlimit = sodium.crypto_pwhash_MEMLIMIT_MODERATE;
    const algo = sodium.crypto_pwhash_ALG_ARGON2ID13;

    const kek = sodium.crypto_pwhash(
        32,
        password,
        salt,
        opslimit,
        memlimit,
        algo
    );
    return new Uint8Array(kek);
}

// --- Wrap/unwrap (XChaCha20-Poly1305) ---
export async function wrapMEK(kek: Uint8Array, mek: Uint8Array, aad?: Uint8Array) {
    await initCrypto();
    const nonce = randomBytes(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES); // 24
    const ct = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
        mek,                  // message (MEK plaintext)
        aad ?? null,          // additional data: deviceId bytes recommended
        null,                 // no secret nonce
        nonce,
        kek
    );
    return { ciphertext: new Uint8Array(ct), nonce };
}

export async function unwrapMEK(kek: Uint8Array, ciphertext: Uint8Array, nonce: Uint8Array, aad?: Uint8Array) {
    await initCrypto();
    const mek = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,                 // no secret data
        ciphertext,
        aad ?? null,
        nonce,
        kek
    );
    return new Uint8Array(mek);
}

// --- MEK helpers ---
export function newMEK() {
    return randomBytes(32); // 256-bit symmetric key
}

// --- serializers for API ---
export const s = {
    toB64: B64.enc,
    fromB64: B64.dec,
    toHex: (u8: Uint8Array) => Array.from(u8).map(b=>b.toString(16).padStart(2,"0")).join(""),
};

// --- Normalization so "Blue " == "blue" etc.
export function norm(s: string) {
    return s.trim().toLowerCase().normalize("NFKC");
}

// --- Argon2id (encode result + include params so we can change later)
export async function argon2idHash(input: string, salt?: Uint8Array) {
    await initCrypto();
    const sodium = (await import("libsodium-wrappers-sumo")).default;
    const _salt = salt ?? randomBytes(16);

    const opslimit = sodium.crypto_pwhash_OPSLIMIT_MODERATE; // tune later
    const memlimit = sodium.crypto_pwhash_MEMLIMIT_MODERATE;
    const algo = sodium.crypto_pwhash_ALG_ARGON2ID13;

    const hash = sodium.crypto_pwhash(
        32,                           // dkLen
        input,
        _salt,
        opslimit,
        memlimit,
        algo
    );

    return {
        salt: _salt,
        hash: new Uint8Array(hash),
        // Store a versioned descriptor so server knows params used
        encoded: `raven$argon2id$v1$${opslimit}:${memlimit}:${algo}$${B64.enc(_salt)}$${B64.enc(new Uint8Array(hash))}`
    };
}

// --- One-liners for answers & codes
export async function hashSecurityAnswer(answer: string, userTag: string) {
    // userTag can be username/email; adds context so identical answers across users differ
    return argon2idHash(norm(answer) + "|" + userTag);
}

export async function hashTrustCode(code: string, userTag: string) {
    // DO NOT normalize away hyphens; treat as literal to avoid ambiguous transforms
    return argon2idHash(code.trim() + "|" + userTag);
}
