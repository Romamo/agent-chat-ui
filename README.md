# Agent Chat UI

Agent Chat UI is a Vite + React application which enables chatting with any LangGraph server with a `messages` key through a chat interface. It supports optional user authentication via Supabase.

> [!NOTE]
> 🎥 Watch the video setup guide [here](https://youtu.be/lInrwVnZ83o).

## Setup

> [!TIP]
> Don't want to run the app locally? Use the deployed site here: [agent-chat-ui-auth.vercel.app](https://agent-chat-ui-auth.vercel.app/)!

First, clone the repository, or run the [`npx` command](https://www.npmjs.com/package/create-agent-chat-app):

```bash
npx create-agent-chat-app
```

or

```bash
git clone https://github.com/langchain-ai/agent-chat-ui.git

cd agent-chat-ui
```

Install dependencies:

```bash
pnpm install
```

Run the app:

```bash
pnpm dev
```

The app will be available at `http://localhost:5173`.

## Usage

Once the app is running (or if using the deployed site), you'll be prompted to enter:

- **Deployment URL**: The URL of the LangGraph server you want to chat with. This can be a production or development URL.
- **Assistant/Graph ID**: The name of the graph, or ID of the assistant to use when fetching, and submitting runs via the chat interface.
- **LangSmith API Key**: (only required for connecting to deployed LangGraph servers) Your LangSmith API key to use when authenticating requests sent to LangGraph servers.

After entering these values, click `Continue`. You'll then be redirected to a chat interface where you can start chatting with your LangGraph server.

## Authentication

The application supports optional user authentication via Supabase. This allows users to create accounts, sign in, and maintain persistent chat history tied to their accounts.

### Configuration

Authentication is controlled through environment variables. You can create a `.env` file in the root of the project based on the `.env.example` template:

```bash
# Auth Provider (Optional, defaults to 'none' if not specified)
# Options: 'supabase', 'anon'
VITE_AUTH_PROVIDER=supabase

# Supabase Settings (Required if VITE_AUTH_PROVIDER=supabase)
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Supabase Setup

If you're using Supabase authentication:

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Enable Email/Password authentication in the Auth settings
3. Copy your Supabase URL and anon key to your `.env` file

### Extending Authentication

The authentication system is designed to be pluggable. Currently, it supports Supabase, but you can extend it to support other providers by modifying the following files:

- `src/lib/auth-config.ts`: Add new provider types and configuration
- `src/providers/Auth.tsx`: Implement provider-specific authentication logic

## Environment Variables

You can bypass the initial setup form by setting the following environment variables:

```
VITE_API_URL=http://localhost:2024
VITE_ASSISTANT_ID=agent
VITE_LANGSMITH_API_KEY=your_api_key_if_needed
```

To use these variables:

1. Copy the `.env.example` file to a new file named `.env`
2. Fill in the values in the `.env` file
3. Restart the application

When these environment variables are set, the application will use them instead of showing the setup form.

