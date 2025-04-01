import { Client } from "@langchain/langgraph-sdk";

/**
 * Create a LangGraph client with authentication
 * @param apiUrl The URL of the LangGraph API
 * @param apiKey The API key for the LangGraph API
 * @returns A LangGraph client instance
 */
export function createClient(apiUrl: string, apiKey: string | undefined) {
  return new Client({
    apiKey,
    apiUrl,
  });
}
