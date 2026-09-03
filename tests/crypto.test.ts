import assert from "node:assert/strict";
import test from "node:test";
import {
  generateRecoveryCode,
  generateSessionToken,
  hashPassword,
  hashToken,
  needsRehash,
  normalizeRecoveryCode,
  verifyPassword,
} from "../src/lib/crypto";

test("a password verifies against its own hash and nothing else", async () => {
  const hash = await hashPassword("correct horse battery staple");
  assert.equal(await verifyPassword("correct horse battery staple", hash), true);
  assert.equal(await verifyPassword("correct horse battery stapl", hash), false);
  assert.equal(await verifyPassword("", hash), false);
});

test("hashes are salted, so the same password hashes differently", async () => {
  const a = await hashPassword("same-password");
  const b = await hashPassword("same-password");
  assert.notEqual(a, b);
  assert.equal(await verifyPassword("same-password", a), true);
  assert.equal(await verifyPassword("same-password", b), true);
});

test("the stored hash records its own parameters", async () => {
  const hash = await hashPassword("pw");
  const [algo, n, r, p] = hash.split("$");
  assert.equal(algo, "scrypt");
  // OWASP-listed setting: N = 2^15, r = 8, p = 3.
  assert.equal(n, "32768");
  assert.equal(r, "8");
  assert.equal(p, "3");
  assert.equal(hash.split("$").length, 6);
});

test("passwords are compared under NFC, not NFKC", async () => {
  // NFC keeps these distinct; NFKC would fold the ligature onto "fi" and let
  // the wrong password in.
  const hash = await hashPassword("ﬁnal");
  assert.equal(await verifyPassword("ﬁnal", hash), true);
  assert.equal(await verifyPassword("final", hash), false);

  // Composed and decomposed forms of the same text must still match.
  const cafe = await hashPassword("café");
  assert.equal(await verifyPassword("café", cafe), true);
});

test("malformed stored hashes are rejected rather than throwing", async () => {
  for (const bad of [
    "",
    "not-a-hash",
    "scrypt$32768$8",
    "scrypt$32768$8$3$$",
    "bcrypt$32768$8$3$aa$bb",
    "scrypt$abc$8$3$aa$bb",
  ]) {
    assert.equal(await verifyPassword("pw", bad), false, `should reject ${bad}`);
  }
});

test("needsRehash flags hashes weaker than the current setting", async () => {
  assert.equal(needsRehash(await hashPassword("pw")), false);
  assert.equal(needsRehash("scrypt$1024$8$3$aa$bb"), true);
  assert.equal(needsRehash("scrypt$32768$8$1$aa$bb"), true);
  assert.equal(needsRehash("bcrypt$32768$8$3$aa$bb"), true);
});

test("session tokens carry full entropy and hash deterministically", () => {
  const a = generateSessionToken();
  const b = generateSessionToken();
  assert.notEqual(a, b);
  // 32 random bytes in base64url.
  assert.equal(a.length, 43);
  assert.match(a, /^[A-Za-z0-9_-]+$/);

  assert.equal(hashToken(a), hashToken(a));
  assert.notEqual(hashToken(a), hashToken(b));
  // The digest must not reveal the token it came from.
  assert.notEqual(hashToken(a), a);
});

test("recovery codes avoid look-alike characters and normalise loosely", () => {
  const code = generateRecoveryCode();
  assert.match(code, /^[A-Z0-9]{5}(-[A-Z0-9]{5}){3}$/);
  // I, L, O, U and 0/1 are excluded so a handwritten copy cannot be misread.
  assert.equal(/[ILOU01]/.test(code), false);

  assert.equal(
    normalizeRecoveryCode(code.toLowerCase().replace(/-/g, " ")),
    code.replace(/-/g, ""),
  );
});
