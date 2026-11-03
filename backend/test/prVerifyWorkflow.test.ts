import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

describe("PR Automated CI Quality Gate Workflow (GL-50)", () => {
  const rootDir = path.resolve(__dirname, "../..");
  const workflowPath = path.join(rootDir, ".github", "workflows", "pr-verify.yml");

  it("verifies pr-verify.yml workflow file exists", () => {
    assert.strictEqual(
      fs.existsSync(workflowPath),
      true,
      "Expected .github/workflows/pr-verify.yml to exist"
    );
  });

  const workflowContent = fs.existsSync(workflowPath) ? fs.readFileSync(workflowPath, "utf8") : "";

  describe("TC-1.5-01: PR verification workflow trigger (AC1)", () => {
    it("triggers on pull_request targeting main branch with expected event types", () => {
      assert.match(
        workflowContent,
        /pull_request:\s*\n\s*branches:\s*\n\s*-\s*main/,
        "Workflow must trigger on pull_request targeting branch 'main'"
      );
      assert.match(
        workflowContent,
        /types:\s*\[opened,\s*synchronize,\s*reopened\]/,
        "Workflow must trigger on opened, synchronize, and reopened PR events"
      );
    });

    it("includes workflow_dispatch for manual trigger capability", () => {
      assert.match(
        workflowContent,
        /workflow_dispatch:/,
        "Workflow must include workflow_dispatch trigger"
      );
    });
  });

  describe("TC-1.5-02: Quality gate steps for pass & merge (AC2)", () => {
    it("installs dependencies and builds shared contracts before verification", () => {
      assert.match(
        workflowContent,
        /npm ci/,
        "Workflow must run npm ci for clean dependency installation"
      );
      assert.match(
        workflowContent,
        /npm run build --workspace=@genai-lab\/contracts/,
        "Workflow must build shared contracts"
      );
    });

    it("executes formatting, linting, typechecking, graph verification, and unit tests", () => {
      assert.match(workflowContent, /npm run format:check/, "Workflow must execute format check");
      assert.match(workflowContent, /npm run lint/, "Workflow must execute linting");
      assert.match(
        workflowContent,
        /npm run typecheck/,
        "Workflow must execute TypeScript typechecking"
      );
      assert.match(workflowContent, /npm run graph:verify/, "Workflow must verify knowledge graph");
      assert.match(workflowContent, /npm test/, "Workflow must execute unit and integration tests");
      assert.match(workflowContent, /npm run build/, "Workflow must execute application build");
    });
  });

  describe("TC-1.5-03: Failure blocks merge on typecheck or test errors (AC3)", () => {
    it("ensures critical verification steps fail closed without continue-on-error", () => {
      assert.doesNotMatch(
        workflowContent,
        /continue-on-error:\s*true/,
        "Workflow must not bypass failures with continue-on-error: true"
      );
    });
  });

  describe("TC-1.5-04: CI execution time budget and caching (AC4)", () => {
    it("runs on ubuntu-latest with npm dependency caching", () => {
      assert.match(
        workflowContent,
        /runs-on:\s*ubuntu-latest/,
        "Workflow must run on ubuntu-latest"
      );
      assert.match(
        workflowContent,
        /cache:\s*["']npm["']/,
        "Workflow must enable npm cache in actions/setup-node"
      );
      assert.match(
        workflowContent,
        /cache-dependency-path:\s*package-lock\.json/,
        "Workflow must point npm cache to package-lock.json"
      );
    });

    it("enables concurrency cancellation to conserve runner execution time", () => {
      assert.match(
        workflowContent,
        /cancel-in-progress:\s*true/,
        "Workflow must cancel superseded PR runs to stay within execution budget"
      );
    });
  });
});
