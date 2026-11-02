# Getting Started with [Fastify-CLI](https://www.npmjs.com/package/fastify-cli)

This project was bootstrapped with Fastify-CLI.

## Environment Configuration

Protected Grizz endpoints (such as `GET /portfolio/stats` and streaming chat) require internal authorization using an API key passed via the `x-internal-api-key` header.

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Configure `INTERNAL_API_KEY` with a secret value of your choice:
   ```dotenv
   INTERNAL_API_KEY=your-internal-api-key-here
   ```
3. When testing protected endpoints locally, include the header:
   ```bash
   curl -H "x-internal-api-key: your-internal-api-key-here" http://localhost:3001/portfolio/stats
   ```

## Available Scripts

In the project directory, you can run:

### `npm run dev`

To start the app in dev mode.\
Open [http://localhost:3001](http://localhost:3001) to view it in the browser.

### `npm start`

For production mode

### `npm run test`

Run the test cases.

## Learn More

To learn Fastify, check out the [Fastify documentation](https://fastify.dev/docs/latest/).
