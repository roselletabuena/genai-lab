import { APIGatewayRequestAuthorizerEvent } from "aws-lambda";

export const handler = async (event: APIGatewayRequestAuthorizerEvent) => {
  const receivedKey =
    event.headers?.["x-internal-api-key"] ||
    event.headers?.["X-Internal-Api-Key"];

  const effect =
    receivedKey === process.env.INTERNAL_API_KEY ? "Allow" : "Deny";

  return {
    principalId: "nextjs-server",
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: effect,
          Resource: event.methodArn,
        },
      ],
    },
  };
};
