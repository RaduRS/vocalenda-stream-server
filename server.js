import WebSocket, { WebSocketServer } from "ws";
import express from "express";
import { createServer } from "http";
import { validateConfig } from "./config.js";
import { loadBusinessConfig } from "./businessConfig.js";
import {
  initializeDeepgram,
  handleDeepgramMessage,
  cleanupAudioSystem,
  closeDeepgramConnection,
} from "./deepgram.js";
import { clearCallSession } from "./functionHandlers.js";
import { db } from "./database.js";

// Validate configuration on startup
const config = validateConfig();

// Create Express app and HTTP server
const app = express();
const server = createServer(app);

// Create WebSocket server attached to HTTP server
const wss = new WebSocketServer({ server });

// Basic health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Start the HTTP server
server.listen(config.websocket.port, () => {
  console.log(
    `HTTP server with WebSocket support running on port ${config.websocket.port}`
  );
});

// Handle WebSocket connections
wss.on("connection", async (ws, req) => {
  console.log("New WebSocket connection established");

  let deepgramWs = null;
  let businessId = null;
  let callSid = null;
  let businessConfig = null;
  let deepgramReady = false; // Track if Deepgram is ready to receive audio
  let expectingFunctionCall = false;
  let functionCallTimeout = null;

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message.toString());

      switch (data.event) {
        case "connected":
          console.log("Twilio connected:", data);
          break;

        case "start":
          console.log("Media stream started:", data);
          console.log("Media format:", data.start?.mediaFormat);

          // Extract parameters from Twilio
          const customParameters = data.start?.customParameters || {};
          businessId = customParameters.business_id;
          callSid = customParameters.call_sid;
          const callerPhone = customParameters.caller_phone;
          const businessPhone = customParameters.business_phone;
          const timezone = customParameters.timezone || "UTC";

          if (!businessId) {
            console.error("No business_id provided");
            ws.close();
            return;
          }

          // Load business configuration
          businessConfig = await loadBusinessConfig(businessId);

          if (!businessConfig) {
            console.error("Failed to load business configuration");
            ws.close();
            return;
          }

          // Log the incoming call to database
          try {
            if (callSid && callerPhone && businessPhone) {
              console.log(`📞 Logging incoming call: ${callSid}`);
              await db.logIncomingCall(
                businessId,
                callerPhone,
                businessPhone,
                callSid
              );
              console.log(`✅ Call logged successfully: ${callSid}`);

              // Update call status to in_progress
              await db.updateCallStatus(callSid, "in_progress");
              console.log(`📞 Call status updated to in_progress: ${callSid}`);
            }
          } catch (error) {
            console.error("❌ Failed to log call:", error);
            // Continue with call even if logging fails
          }

          // Initialize Deepgram connection with proper error handling
          try {
            console.log("🔄 Initializing Deepgram connection...");
            deepgramWs = await initializeDeepgram(businessConfig, {
              businessId,
              callSid: callSid || "",
              callerPhone,
              businessPhone,
              timezone: businessConfig.business?.timezone || timezone || "UTC",
            });
            console.log("✅ Deepgram connection initialized successfully");
            console.log("Final readyState:", deepgramWs.readyState);

            // Enable KeepAlive messages now that Twilio connection is active
            deepgramWs.setTwilioConnectionActive(true);
          } catch (error) {
            console.error("❌ Failed to initialize Deepgram:", error);
            ws.close();
            return;
          }

          // Use the centralized Deepgram message handler
          deepgramWs.on("message", async (deepgramMessage) => {
            await handleDeepgramMessage(
              deepgramMessage,
              ws,
              deepgramWs,
              businessConfig,
              data.start?.streamSid,
              {
                expectingFunctionCall,
                functionCallTimeout,
                deepgramReady,
                callSid,
                callerPhone,
                setExpectingFunctionCall: (value) => {
                  expectingFunctionCall = value;
                },
                setFunctionCallTimeout: (value) => {
                  functionCallTimeout = value;
                },
                setDeepgramReady: (value) => {
                  deepgramReady = value;
                },
              }
            );
          });

          deepgramWs.on("error", (error) => {
            console.error("Deepgram WebSocket error:", error);
            // Don't close the Twilio connection on Deepgram errors
            // Just log and continue
          });

          deepgramWs.on("close", (code, reason) => {
            console.log(
              `Deepgram WebSocket closed. Code: ${code}, Reason: ${reason}`
            );
            // Clean up audio system when Deepgram closes
            cleanupAudioSystem();
            // Only close Twilio connection if it's an unexpected close
            if (code !== 1000 && code !== 1001) {
              console.error(
                "🚨 Unexpected Deepgram close - this may cause issues"
              );
            }
          });

          break;

        case "media":
          // Forward audio to Deepgram only when connection is ready
          if (
            deepgramWs &&
            deepgramWs.readyState === WebSocket.OPEN &&
            deepgramReady
          ) {
            // Validate incoming audio data
            if (!data.media?.payload) {
              console.warn("⚠️ Received media event without payload");
              return;
            }

            try {
              // Convert base64 to buffer and validate
              const audioBuffer = Buffer.from(data.media.payload, "base64");

              if (audioBuffer.length === 0) {
                console.warn("⚠️ Received empty audio buffer from Twilio");
                return;
              }

              // Validate buffer size (Twilio sends 160 bytes for 8kHz mulaw)
              if (audioBuffer.length !== 160) {
                console.warn(
                  `⚠️ Unexpected audio buffer size: ${audioBuffer.length} bytes (expected 160)`
                );
              }

              deepgramWs.send(audioBuffer);
            } catch (error) {
              console.error("❌ Error processing audio from Twilio:", error);
            }
          } else {
            console.log(
              `⚠️ Cannot forward audio - deepgramWs ready: ${
                !!deepgramWs && deepgramWs.readyState === WebSocket.OPEN
              }, isReady: ${deepgramReady}`
            );
          }
          break;

        case "stop":
          console.log("Media stream stopped");
          // Log call completion
          try {
            if (callSid) {
              const endTime = new Date().toISOString();
              console.log(`📞 Logging call completion: ${callSid}`);
              await db.updateCallStatus(callSid, "completed", endTime);
              console.log(`✅ Call completion logged: ${callSid}`);
            }
          } catch (error) {
            console.error("❌ Failed to log call completion:", error);
          }

          // Close the Deepgram connection when media stream stops to prevent timeouts
          if (deepgramWs) {
            closeDeepgramConnection(deepgramWs);
          }
          break;
      }
    } catch (error) {
      console.error("Error processing WebSocket message:", error);
    }
  });

  ws.on("close", async () => {
    console.log("Twilio WebSocket connection closed");
  // Log call completion if not already logged
    try {
      if (callSid) {
        const endTime = new Date().toISOString();
        console.log(`📞 Logging call completion on close: ${callSid}`);
        await db.updateCallStatus(callSid, 'completed', endTime);
        console.log(`✅ Call completion logged on close: ${callSid}`);
      }
    } catch (error) {
      console.error("❌ Failed to log call completion on close:", error);
    }
    // Close the Deepgram connection to prevent CLIENT_MESSAGE_TIMEOUT errors
    if (deepgramWs) {
      closeDeepgramConnection(deepgramWs);
    }

    // Clear the call session if needed
    if (callSid) {
      clearCallSession(callSid);
    }
  });

  ws.on("error", (error) => {
    console.error("Twilio WebSocket error:", error);
  });
});

// Load business configuration from Supabase

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("Shutting down server...");
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("Shutting down server...");
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
});
