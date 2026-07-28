import { test } from "node:test";
import assert from "node:assert/strict";
import { isBlockedHost } from "./urlGuard";

/** Host di-cek lewat URL.hostname (bukan string mentah) — persis seperti
 *  route-nya — supaya normalisasi parser ikut teruji. */
const blocked = (url: string) => isBlockedHost(new URL(url).hostname);

test("blokir loopback & localhost", () => {
  assert.ok(blocked("http://127.0.0.1/"));
  assert.ok(blocked("http://127.1/")); // dotted-quad pendek
  assert.ok(blocked("http://localhost/"));
  assert.ok(blocked("http://foo.localhost/"));
  assert.ok(blocked("http://0.0.0.0/"));
});

test("blokir IPv6 literal (regresi: dulu lolos karena hostname berkurung siku)", () => {
  assert.ok(blocked("http://[::1]/"), "loopback IPv6");
  assert.ok(blocked("http://[::ffff:127.0.0.1]/"), "loopback ter-map IPv4");
  assert.ok(blocked("http://[fd00::1]/"), "unique-local");
  assert.ok(blocked("http://[fe80::1]/"), "link-local");
  assert.ok(blocked("http://[::]/"), "unspecified");
});

test("blokir rentang privat & metadata cloud", () => {
  assert.ok(blocked("http://10.0.0.5/"));
  assert.ok(blocked("http://192.168.1.1/"));
  assert.ok(blocked("http://172.16.0.1/"));
  assert.ok(blocked("http://172.31.255.255/"));
  assert.ok(blocked("http://169.254.169.254/"), "metadata cloud");
  assert.ok(blocked("http://svc.internal/"));
});

test("bentuk IP non-desimal dinormalkan parser URL, jadi tetap terblokir", () => {
  assert.ok(blocked("http://2130706433/"), "desimal");
  assert.ok(blocked("http://0x7f000001/"), "heksa");
  assert.ok(blocked("http://0177.0.0.1/"), "oktal");
});

test("host publik tetap boleh", () => {
  assert.ok(!blocked("https://example.com/"));
  assert.ok(!blocked("https://github.com/a/b"));
  assert.ok(!blocked("http://8.8.8.8/"));
  assert.ok(!blocked("http://172.15.0.1/"), "tepat di luar 172.16/12");
  assert.ok(!blocked("http://172.32.0.1/"), "tepat di luar 172.16/12");
});
