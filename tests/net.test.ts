import assert from "node:assert/strict";
import test from "node:test";
import {
  clientAddress,
  normaliseAddress,
  safeRedirectPath,
} from "../src/lib/net";

test("IPv6 addresses collapse to their /64 prefix", () => {
  // A phone rotating its SLAAC interface identifier must land in one bucket.
  const a = normaliseAddress("2001:db8:85a3:1:aaaa:bbbb:cccc:dddd");
  const b = normaliseAddress("2001:db8:85a3:1:1111:2222:3333:4444");
  assert.equal(a, b);
  assert.equal(a, "2001:0db8:85a3:0001");

  // A genuinely different /64 must stay a different bucket.
  assert.notEqual(a, normaliseAddress("2001:db8:85a3:2:aaaa:bbbb:cccc:dddd"));
});

test("IPv6 shorthand and bracketed forms expand correctly", () => {
  assert.equal(normaliseAddress("2001:db8::1"), "2001:0db8:0000:0000");
  assert.equal(normaliseAddress("[2001:db8::1]"), "2001:0db8:0000:0000");
  assert.equal(normaliseAddress("::1"), "0000:0000:0000:0000");
});

test("IPv4 addresses are used whole", () => {
  assert.equal(normaliseAddress("203.0.113.9"), "203.0.113.9");
  assert.equal(normaliseAddress(" 203.0.113.9 "), "203.0.113.9");
});

test("a spoofed leftmost X-Forwarded-For entry is ignored", () => {
  // The client sent "1.2.3.4"; our proxy appended the real address.
  assert.equal(clientAddress("1.2.3.4, 203.0.113.9", null, 1), "203.0.113.9");
});

test("X-Forwarded-For respects the configured proxy depth", () => {
  const chain = "1.2.3.4, 203.0.113.9, 198.51.100.1";
  assert.equal(clientAddress(chain, null, 1), "198.51.100.1");
  assert.equal(clientAddress(chain, null, 2), "203.0.113.9");
  // More hops claimed than exist must not read past the start of the chain.
  assert.equal(clientAddress(chain, null, 99), "1.2.3.4");
});

test("client address falls back through x-real-ip to a constant", () => {
  assert.equal(clientAddress(null, "198.51.100.7"), "198.51.100.7");
  assert.equal(clientAddress(null, null), "unknown");
  assert.equal(clientAddress("", ""), "unknown");
});

test("redirect targets escaping to another origin are rejected", () => {
  // Each of these parses to an external origin when resolved naively.
  for (const attack of [
    "//evil.com",
    "/\\evil.com",
    "/\\\\evil.com",
    "https://evil.com",
    "http://evil.com",
    "\\\\evil.com",
    "javascript:alert(1)",
  ]) {
    assert.equal(safeRedirectPath(attack), "/", `should reject ${attack}`);
  }
});

test("ordinary in-app paths survive redirect validation", () => {
  assert.equal(safeRedirectPath("/facilities"), "/facilities");
  assert.equal(
    safeRedirectPath("/facilities?sort=highest_rated&page=2"),
    "/facilities?sort=highest_rated&page=2",
  );
  assert.equal(
    safeRedirectPath("/facilities/king-fahd-abc123/review"),
    "/facilities/king-fahd-abc123/review",
  );
});

test("missing or empty redirect targets fall back", () => {
  assert.equal(safeRedirectPath(null), "/");
  assert.equal(safeRedirectPath(undefined), "/");
  assert.equal(safeRedirectPath(""), "/");
  assert.equal(safeRedirectPath("relative/path"), "/");
  assert.equal(safeRedirectPath("/ok", "/fallback"), "/ok");
  assert.equal(safeRedirectPath("//bad", "/fallback"), "/fallback");
});
