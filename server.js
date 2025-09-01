import WebSocket, { WebSocketServer } from "ws";
import express from "express";
import { createServer } from "http";
import { validateConfig } from "./config.js";
import { loadBusinessConfig } from "./businessConfig.js";
import { initializeDeepgram, handleDeepgramMessage } from "./deepgram.js";
import { AudioContinuityManager } from "./audioContinuity.js";
import { ConnectionHealthMonitor } from "./connectionHealthMonitor.js";

// Validate configuration on startup
const config = validateConfig();

// Create Express app and HTTP server
const app = express();
const server = createServer(app);

// Create WebSocket server attached to HTTP server
const wss = new WebSocketServer({ server });

// Initialize health monitor
const healthMonitor = new ConnectionHealthMonitor({
  checkInterval: 10000,  // Check every 10 seconds
  pingInterval: 30000,   // Ping every 30 seconds
  latencyThreshold: 300  // 300ms latency threshold
});

// Global audio continuity manager for status endpoint
let globalAudioContinuity = null;

// Set up health warning callback
healthMonitor.setHealthWarningCallback((warning) => {
  console.warn('🚨 CONNECTION_HEALTH: Health warning detected:', {
    unhealthyCount: warning.unhealthyConnections.length,
    averageQuality: warning.globalMetrics.averageQualityScore,
    activeConnections: warning.globalMetrics.activeConnections
  });
});

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Connection health status endpoint
app.get('/health/connections', (req, res) => {
  const globalMetrics = healthMonitor.getGlobalMetrics();
  const connectionStatuses = healthMonitor.getAllConnectionStatuses();
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    globalMetrics: globalMetrics,
    connections: connectionStatuses,
    summary: {
      totalConnections: globalMetrics.totalConnections,
      activeConnections: globalMetrics.activeConnections,
      healthyConnections: globalMetrics.healthyConnections,
      averageQualityScore: globalMetrics.averageQualityScore,
      averageLatency: globalMetrics.averageLatency
    }
  });
});

// Audio continuity status endpoint
app.get('/audio/status', (req, res) => {
  if (!globalAudioContinuity) {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      audioContinuity: {
        state: 'no_active_connection',
        message: 'No active WebSocket connection'
      }
    });
    return;
  }
  
  const audioContinuityStatus = globalAudioContinuity.getStatus();
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    audioContinuity: audioContinuityStatus
  });
});

// Start the HTTP server
server.listen(config.websocket.port, () => {
  console.log(`HTTP server with WebSocket support running on port ${config.websocket.port}`);
});

// Handle WebSocket connections
wss.on("connection", async (ws, req) => {
  console.log("📞 New Twilio connection established");

  // Generate unique connection ID
  const connectionId = `twilio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  let deepgramWs = null;
  let businessId = null;
  let callSid = null;
  let businessConfig = null;
  let deepgramReady = false; // Track if Deepgram is ready to receive audio
  let expectingFunctionCall = false;
  let functionCallTimeout = null;
  
  // Initialize audio continuity manager
  const audioContinuity = new AudioContinuityManager();
  
  // Set global reference for status endpoint
  globalAudioContinuity = audioContinuity;
  
  // Register connection with health monitor
  const connectionHealth = healthMonitor.registerConnection(connectionId, ws, {
    type: 'twilio',
    streamSid: null // Will be updated when available
  });
  
  // Set up audio forwarding function for continuity manager
    const forwardAudioToTwilio = (audioData) => {
       if (streamSid) {
         try {
           const audioMessage = {
             event: "media",
             streamSid: streamSid,
             media: {
               payload: audioData.toString ? audioData.toString("base64") : audioData,
             },
           };
           ws.send(JSON.stringify(audioMessage));
         } catch (error) {
           console.error("❌ Error forwarding audio via continuity:", error);
         }
       }
     };
    
    audioContinuity.setForwardFunction(forwardAudioToTwilio);

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
            
            // Register Deepgram connection with health monitor
            const deepgramConnectionId = `deepgram_${connectionId}`;
            healthMonitor.registerConnection(deepgramConnectionId, deepgramWs, {
              type: 'deepgram',
              businessId: businessId,
              streamSid: data.start?.streamSid
            });
            
            // Update Twilio connection metadata with streamSid
            connectionHealth.metadata.streamSid = data.start?.streamSid;
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
                setExpectingFunctionCall: (value) => { expectingFunctionCall = value; },
                setFunctionCallTimeout: (value) => { functionCallTimeout = value; },
                setDeepgramReady: (value) => { deepgramReady = value; }
              },
              audioContinuity
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
            // Basic validation for audio data
            if (!data.media?.payload) {
              return;
            }

            try {
              // Convert base64 to buffer - simplified processing
              const audioBuffer = Buffer.from(data.media.payload, "base64");
              
              // Only check for completely empty buffers
              if (audioBuffer.length > 0) {
                // Use audio continuity system for smooth processing
                audioContinuity.processAudioChunk(audioBuffer, (audio) => {
                  deepgramWs.send(audio);
                });
              }
            } catch (error) {
              console.error("❌ Error processing audio from Twilio:", error);
            }
          }
          break;

        case "stop":
          console.log("Media stream stopped");
          if (deepgramWs) {
            deepgramWs.close();
          }
          break;
      }
    } catch (error) {
      console.error("Error processing WebSocket message:", error);
    }
  });

  ws.on("close", () => {
    console.log("📞 Twilio connection closed");
    
    // Unregister connections from health monitor
    healthMonitor.unregisterConnection(connectionId);
    if (deepgramWs) {
      const deepgramConnectionId = `deepgram_${connectionId}`;
      healthMonitor.unregisterConnection(deepgramConnectionId);
      deepgramWs.close();
    }
    
    // Reset audio continuity manager
    audioContinuity.reset();
    
    // Clear global reference if this was the active connection
    if (globalAudioContinuity === audioContinuity) {
      globalAudioContinuity = null;
    }
  });

  ws.on("error", (error) => {
    console.error("❌ Twilio WebSocket error:", error);
    
    // Unregister connections from health monitor
    healthMonitor.unregisterConnection(connectionId);
    if (deepgramWs) {
      const deepgramConnectionId = `deepgram_${connectionId}`;
      healthMonitor.unregisterConnection(deepgramConnectionId);
      deepgramWs.close();
    }
    
    // Reset audio continuity manager
     audioContinuity.reset();
     
     // Clear global reference if this was the active connection
     if (globalAudioContinuity === audioContinuity) {
       globalAudioContinuity = null;
     }
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
