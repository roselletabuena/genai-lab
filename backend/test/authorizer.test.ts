import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { handler } from "../src/authorizer";
import { APIGatewayRequestAuthorizerEvent } from "aws-lambda";

describe("authorizer handler", () => {
  const originalEnv = process.env.INTERNAL_API_KEY;

  beforeEach(() => {
    process.env.INTERNAL_API_KEY = "test-auth-secret";
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.INTERNAL_API_KEY = originalEnv;
    } else {
      delete process.env.INTERNAL_API_KEY;
    }
  });

  const createEvent = (headers?: Record<string, string>): APIGatewayRequestAuthorizerEvent =>
    ({
      type: "REQUEST",
      methodArn: "arn:aws:execute-api:us-east-1:123456789012:api-id/dev/GET/portfolio/stats",
      headers,
    }) as unknown as APIGatewayRequestAuthorizerEvent;

  test("allows when valid x-internal-api-key is supplied", async () => {
    const res = await handler(createEvent({ "x-internal-api-key": "test-auth-secret" }));
    assert.strictEqual(res.policyDocument.Statement[0].Effect, "Allow");
    assert.strictEqual(
      res.policyDocument.Statement[0].Resource,
      "arn:aws:execute-api:us-east-1:123456789012:api-id/dev/GET/portfolio/stats"
    );
  });

  test("allows when valid Title-Case X-Internal-Api-Key is supplied", async () => {
    const res = await handler(createEvent({ "X-Internal-Api-Key": "test-auth-secret" }));
    assert.strictEqual(res.policyDocument.Statement[0].Effect, "Allow");
  });

  test("denies when key is invalid", async () => {
    const res = await handler(createEvent({ "x-internal-api-key": "wrong-secret" }));
    assert.strictEqual(res.policyDocument.Statement[0].Effect, "Deny");
  });

  test("denies when header is missing", async () => {
    const res = await handler(createEvent({}));
    assert.strictEqual(res.policyDocument.Statement[0].Effect, "Deny");
  });

  test("denies when INTERNAL_API_KEY is unset (fail closed)", async () => {
    delete process.env.INTERNAL_API_KEY;
    const res = await handler(createEvent({ "x-internal-api-key": "test-auth-secret" }));
    assert.strictEqual(res.policyDocument.Statement[0].Effect, "Deny");
  });
});
