import { APIGatewayRequestAuthorizerEvent } from "aws-lambda";
import { isAuthorized } from "./utils/auth";

export const handler = async (event: APIGatewayRequestAuthorizerEvent) => {
  const effect = isAuthorized(event.headers) ? "Allow" : "Deny";

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
