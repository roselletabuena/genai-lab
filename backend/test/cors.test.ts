import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { app } from "../src/app";

describe("CORS configuration", () => {
  test("allows requests from https://roselle.dev", async () => {
    const response = await app.inject({
      method: "OPTIONS",
      url: "/",
      headers: {
        origin: "https://roselle.dev",
        "access-control-request-method": "GET",
      },
    });
    assert.strictEqual(response.headers["access-control-allow-origin"], "https://roselle.dev");
  });

  test("allows requests from http://localhost:3000", async () => {
    const response = await app.inject({
      method: "OPTIONS",
      url: "/",
      headers: {
        origin: "http://localhost:3000",
        "access-control-request-method": "GET",
      },
    });
    assert.strictEqual(response.headers["access-control-allow-origin"], "http://localhost:3000");
  });

  test("disallows requests from legacy ai-document-assistant-six.vercel.app origin", async () => {
    const response = await app.inject({
      method: "OPTIONS",
      url: "/",
      headers: {
        origin: "https://ai-document-assistant-six.vercel.app",
        "access-control-request-method": "GET",
      },
    });
    assert.strictEqual(response.headers["access-control-allow-origin"], undefined);
  });

  test("disallows requests from untrusted origins", async () => {
    const response = await app.inject({
      method: "OPTIONS",
      url: "/",
      headers: {
        origin: "https://untrusted-domain.com",
        "access-control-request-method": "GET",
      },
    });
    assert.strictEqual(response.headers["access-control-allow-origin"], undefined);
  });

  test("allows x-client-ip in CORS preflight request headers", async () => {
    const response = await app.inject({
      method: "OPTIONS",
      url: "/",
      headers: {
        origin: "https://roselle.dev",
        "access-control-request-method": "POST",
        "access-control-request-headers": "x-client-ip",
      },
    });
    assert.strictEqual(response.headers["access-control-allow-origin"], "https://roselle.dev");
    assert.ok(
      String(response.headers["access-control-allow-headers"]).toLowerCase().includes("x-client-ip")
    );
  });
});
