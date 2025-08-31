import { WebSocketServer } from "ws";
import { validateConfig } from "./config.js";
import { handleWebSocketConnection } from "./websocketHandlers.js";

// Load and validate configuration
const config = validateConfig();

// Create WebSocket server
const wss = new WebSocketServer({
  port: config.websocket.port,
});

console.log(`WebSocket server running on port ${config.websocket.port}`);

// Handle WebSocket connections
wss.on("connection", async (ws, req) => {
  console.log('WebSocket connection established');

  // Handle the WebSocket connection - businessConfig will be loaded when Twilio sends 'start' event
  handleWebSocketConnection(ws, req);
});

// Load business configuration from Supabase

// Deepgram initialization function has been extracted to deepgram.js

// Generate system prompt for the AI
// System prompt generator extracted to utils.js

// Available functions definition extracted to utils.js

// Handle function calls from the AI agent
// Function call handler extracted to functionHandlers.js

// Available slots handler extracted to functionHandlers.js

// Booking creation handler extracted to functionHandlers.js

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("Shutting down WebSocket server...");
  wss.close(() => {
    console.log("WebSocket server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("Shutting down WebSocket server...");
  wss.close(() => {
    console.log("WebSocket server closed");
    process.exit(0);
  });
});