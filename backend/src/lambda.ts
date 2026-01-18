import awsLambdaFastify from "@fastify/aws-lambda";
import { app } from "./app";

export const handler = awsLambdaFastify(app, {
  callbackWaitsForEmptyEventLoop: false,
  serializeLambdaArguments: false,
});
