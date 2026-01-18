import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-east-1"
});

const MODEL_ID = "anthropic.claude-3-sonnet-20240229-v1:0";

export async function invokeClaudeWithContext(
  context: string,
  question: string,
): Promise<string> {
  const prompt = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are a helpful assistant that answers questions based on the provided document context. 
Only use information from the context to answer. If the answer is not in the context, say so.

<context>
${context}
</context>

Question: ${question}`,
      },
    ],
  };

  const response = await client.send(
    new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(prompt),
    }),
  );

  const result = JSON.parse(new TextDecoder().decode(response.body));
  return result.content[0].text;
}
