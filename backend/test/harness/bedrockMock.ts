import { mockClient, AwsClientStub } from "aws-sdk-client-mock";
import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  StopReason,
} from "@aws-sdk/client-bedrock-runtime";
import { BedrockAgentRuntimeClient, RetrieveCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import { bedrockClient, bedrockAgentClient } from "../../src/lib/bedrock/client";

export interface BedrockMockHarness {
  bedrockMock: AwsClientStub<BedrockRuntimeClient>;
  agentMock: AwsClientStub<BedrockAgentRuntimeClient>;
  mockConverse: (text?: string, stopReason?: StopReason) => void;
  mockConverseStream: (tokens?: string[], stopReason?: StopReason) => void;
  mockRetrieve: (results?: string[]) => void;
  mockThrottling: (errorMessage?: string) => void;
  reset: () => void;
  restore: () => void;
}

/**
 * Creates an async iterable stream matching the Bedrock ConverseStream output.
 */
export async function* createMockConverseStream(
  tokens: string[] = ["Hello from deterministic Bedrock mock stream!"],
  stopReason: StopReason = "end_turn"
): AsyncIterable<any> {
  yield { messageStart: { role: "assistant" } };
  for (const text of tokens) {
    yield {
      contentBlockDelta: {
        delta: { text },
      },
    };
  }
  yield { contentBlockStop: {} };
  yield { messageStop: { stopReason } };
}

/**
 * Sets up and configures mock instances for BedrockRuntimeClient and BedrockAgentRuntimeClient.
 */
export function setupBedrockMock(): BedrockMockHarness {
  const bedrockMock = mockClient(bedrockClient);
  const agentMock = mockClient(bedrockAgentClient);

  const mockRetrieve = (results: string[] = ["Mocked knowledge base document context"]) => {
    agentMock.on(RetrieveCommand).resolves({
      retrievalResults: results.map((text, idx) => ({
        content: { text },
        score: 0.85,
        location: {
          type: "S3",
          s3Location: { uri: `s3://mock-kb-bucket/doc-${idx}.txt` },
        },
      })),
    });
  };

  const mockConverse = (
    text = "Hello! I am Grizz, Roselle's AI assistant.",
    stopReason: StopReason = "end_turn"
  ) => {
    bedrockMock.on(ConverseCommand).resolves({
      output: {
        message: {
          role: "assistant",
          content: [{ text }],
        },
      },
      stopReason,
    });
  };

  const mockConverseStream = (
    tokens: string[] = ["Hello", " from", " deterministic", " Bedrock", " mock", " stream!"],
    stopReason: StopReason = "end_turn"
  ) => {
    bedrockMock.on(ConverseStreamCommand).resolves({
      stream: createMockConverseStream(tokens, stopReason),
    });
  };

  const mockThrottling = (errorMessage = "Rate exceeded: Bedrock requests throttled") => {
    const throttlingError = new Error(errorMessage);
    throttlingError.name = "ThrottlingException";
    (throttlingError as any).code = "ThrottlingException";

    bedrockMock.on(ConverseCommand).rejects(throttlingError);
    bedrockMock.on(ConverseStreamCommand).rejects(throttlingError);
  };

  // Provide initial deterministic defaults
  mockRetrieve();
  mockConverse();
  mockConverseStream();

  return {
    bedrockMock,
    agentMock,
    mockConverse,
    mockConverseStream,
    mockRetrieve,
    mockThrottling,
    reset: () => {
      bedrockMock.reset();
      agentMock.reset();
      mockRetrieve();
      mockConverse();
      mockConverseStream();
    },
    restore: () => {
      bedrockMock.restore();
      agentMock.restore();
    },
  };
}
