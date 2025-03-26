# Agent Chat UI

Agent Chat UI is a Vite + React application which enables chatting with any LangGraph server with a `messages` key through a chat interface. It supports optional user authentication via Supabase.

> [!NOTE]
> 🎥 Watch the video setup guide [here](https://youtu.be/lInrwVnZ83o).

## Setup

> [!TIP]
> Don't want to run the app locally? Use the deployed site here: [agentchat.vercel.app](https://agentchat.vercel.app)!

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
# Authentication Settings
# Set to 'true' to enable user authentication
VITE_ENABLE_AUTH=true

# Supabase Settings (Required if VITE_ENABLE_AUTH=true)
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Supabase Setup

If you're using Supabase authentication:

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Enable Email/Password authentication in the Auth settings
3. Create a `profiles` table with the following schema:
   ```sql
   create table profiles (
     id uuid references auth.users on delete cascade primary key,
     full_name text,
     avatar_url text,
     updated_at timestamp with time zone
   );
   ```
4. Set up a trigger to create a profile when a new user signs up:
   ```sql
   create function public.handle_new_user() 
   returns trigger as $$
   begin
     insert into public.profiles (id, full_name)
     values (new.id, new.raw_user_meta_data->>'full_name');
     return new;
   end;
   $$ language plpgsql security definer;
   
   create trigger on_auth_user_created
     after insert on auth.users
     for each row execute procedure public.handle_new_user();
   ```
5. Copy your Supabase URL and anon key to your `.env` file

### Extending Authentication

The authentication system is designed to be pluggable. Currently, it supports Supabase, but you can extend it to support other providers by modifying the following files:

- `src/lib/auth-config.ts`: Add new provider types and configuration
- `src/providers/Auth.tsx`: Implement provider-specific authentication logic
