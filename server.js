import WebSocket, { WebSocketServer } from "ws";
import express from "express";
import { createServer } from "http";
import { validateConfig } from "./config.js";
import {
  loadBusinessConfig,
  isGoogleCalendarConnected,
} from "./businessConfig.js";
import {
  initializeDeepgram,
  handleDeepgramMessage,
  cleanupAudioSystem,
  closeDeepgramConnection,
  saveConversationTranscript,
} from "./deepgram.js";
import {
  clearCallSession,
  getCallSession,
  setCallSession,
  endCall,
  sendConsolidatedSMSConfirmation,
} from "./functionHandlers.js";
import { db, supabase } from "./database.js";

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
wss.on("connection", async (ws) => {
  console.log("New WebSocket connection established");

  let deepgramWs = null;
  let businessId = null;
  let callSid = null;
  let businessConfig = null;
  let transcriptSaved = false;
  let smsConfirmationSent = false; // Track if SMS confirmations have been sent
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

        case "start": {
          console.log("Media stream started:", data);

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

          // Check if Google Calendar is connected
          if (!isGoogleCalendarConnected(businessConfig)) {
            console.log(
              `📅 No Google Calendar connected for business ${businessId}`
            );
            console.log(
              `📞 Rejecting call ${callSid} - Google Calendar required`
            );

            // Log the call as rejected due to no calendar
            try {
              if (callSid && callerPhone && businessPhone) {
                await db.logIncomingCall(
                  businessId,
                  callerPhone,
                  businessPhone,
                  callSid
                );
                await db.updateCallStatus(callSid, "failed");

                // Update ai_summary with rejection reason
                const { error: summaryError } = await supabase
                  .from("call_logs")
                  .update({
                    ai_summary: "Call rejected - Google Calendar not connected",
                  })
                  .eq("twilio_call_sid", callSid);

                if (summaryError) {
                  console.error(
                    "❌ Failed to update call summary:",
                    summaryError
                  );
                }

                console.log(`📞 Call logged as rejected: ${callSid}`);
              }
            } catch (error) {
              console.error("❌ Failed to log rejected call:", error);
            }

            // Close the connection immediately
            ws.close();
            return;
          }

          console.log(
            `📅 Google Calendar connected for business ${businessId}`
          );
          console.log(`📞 Proceeding with call ${callSid}`);

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

              // Transcript tracking is now handled by ConnectionState
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
            cleanupAudioSystem(deepgramWs);
            // Only close Twilio connection if it's an unexpected close
            if (code !== 1000 && code !== 1001) {
              console.error(
                "🚨 Unexpected Deepgram close - this may cause issues"
              );
            }
          });

          break;
        }

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

        case "stop": {
          console.log("Media stream stopped");
          // Log call completion
          try {
            if (callSid) {
              const endTime = new Date().toISOString();
              console.log(`📞 Logging call completion: ${callSid}`);
              await db.updateCallStatus(callSid, "completed", endTime);
              console.log(`✅ Call completion logged: ${callSid}`);

              // Send SMS confirmations for any pending bookings before call ends
              if (!smsConfirmationSent) {
                try {
                  const session = getCallSession(callSid);
                  if (
                    session &&
                    session.bookings &&
                    session.bookings.length > 0 &&
                    session.callerPhone &&
                    !session.bookingCancelled &&
                    businessConfig
                  ) {
                    console.log(
                      `📱 Media stream stopped - sending SMS confirmations for ${callSid}`
                    );
                    await endCall(
                      callSid,
                      { reason: "media stream stopped" },
                      businessConfig
                    );
                    smsConfirmationSent = true;
                    console.log(
                      `✅ SMS confirmations sent on media stop: ${callSid}`
                    );
                  }
                } catch (smsError) {
                  console.error(
                    `❌ Error sending SMS confirmations on media stop ${callSid}:`,
                    smsError
                  );
                }
              }

              // Save conversation transcript
              await saveConversationTranscript(callSid, deepgramWs);
              transcriptSaved = true;
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

        // Get the call record to calculate duration
        const { data: callRecord, error: fetchError } = await supabase
          .from("call_logs")
          .select("started_at")
          .eq("twilio_call_sid", callSid)
          .single();

        let duration = null;
        if (!fetchError && callRecord?.started_at) {
          const startTime = new Date(callRecord.started_at);
          const endTimeDate = new Date(endTime);
          duration = Math.round(
            (endTimeDate.getTime() - startTime.getTime()) / 1000
          );
          console.log(`📊 Call duration calculated: ${duration} seconds`);
        } else {
          console.error(
            "❌ Failed to fetch call start time for duration calculation:",
            fetchError
          );
        }

        await db.updateCallStatus(callSid, "completed", endTime, duration);
        console.log(`✅ Call completion logged on close: ${callSid}`);

        // Save conversation transcript only if not already saved
        if (!transcriptSaved) {
          await saveConversationTranscript(callSid, deepgramWs);
        }
      }
    } catch (error) {
      console.error("❌ Failed to log call completion on close:", error);
    }
    // Close the Deepgram connection to prevent CLIENT_MESSAGE_TIMEOUT errors
    if (deepgramWs) {
      closeDeepgramConnection(deepgramWs);
    }

    // Handle SMS confirmations for abrupt disconnections before clearing session
    if (callSid) {
      try {
        // Only send SMS confirmations if not already sent
        if (!smsConfirmationSent) {
          const session = getCallSession(callSid);
          if (
            session &&
            session.bookings &&
            session.bookings.length > 0 &&
            session.callerPhone &&
            !session.bookingCancelled &&
            !session.smsConfirmationSent
          ) {
            console.log(
              `📱 Call disconnected abruptly - checking for pending SMS confirmations for ${callSid}`
            );

            // Use existing businessConfig or load it if needed
            let configToUse = businessConfig;
            if (!configToUse) {
              configToUse = await loadBusinessConfig(
                session.businessId || callSid
              );
            }

            if (configToUse) {
              // Use the endCall function which already has the SMS confirmation logic and clears session
              await endCall(
                callSid,
                { reason: "abrupt disconnect" },
                configToUse
              );

              // Check if session still exists (means SMS failed and session was retained)
              const sessionAfterEndCall = getCallSession(callSid);
              if (sessionAfterEndCall) {
                console.log(
                  `⚠️ Session still exists after endCall - SMS likely failed, attempting direct SMS retry for ${callSid}`
                );

                // Try to send SMS directly one more time
                try {
                  // Prepare final bookings from session
                  const finalBookings = [];
                  if (sessionAfterEndCall.bookings) {
                    for (const booking of sessionAfterEndCall.bookings) {
                      if (booking.appointmentId) {
                        finalBookings.push(booking);
                      }
                    }
                  }

                  if (finalBookings.length > 0) {
                    // Get customer name from session or fallback to first booking's customer name
                    const customerName =
                      sessionAfterEndCall.customerName ||
                      (finalBookings.length > 0
                        ? finalBookings[0].customerName
                        : null) ||
                      "Valued Customer";

                    await sendConsolidatedSMSConfirmation(
                      {
                        businessId: configToUse.business.id,
                        customerPhone: sessionAfterEndCall.callerPhone,
                        customerName: customerName,
                        bookings: finalBookings,
                      },
                      configToUse
                    );
                    console.log(
                      `✅ SMS retry successful for abrupt disconnect: ${callSid}`
                    );

                    // Mark SMS as sent to prevent further duplicates
                    const updatedSession = getCallSession(callSid);
                    if (updatedSession) {
                      setCallSession(callSid, {
                        ...updatedSession,
                        smsConfirmationSent: true,
                      });
                    }
                  }

                  // Clear session after successful retry
                  clearCallSession(callSid);
                } catch (retryError) {
                  console.error(
                    `❌ SMS retry failed for abrupt disconnect ${callSid}:`,
                    retryError
                  );
                  // Clear session anyway to prevent memory leaks
                  clearCallSession(callSid);
                }
              }

              smsConfirmationSent = true;
              console.log(
                `✅ SMS confirmations handled for abrupt disconnect: ${callSid}`
              );
            } else {
              console.error(
                `❌ Could not load business config for SMS confirmations: ${callSid}`
              );
              clearCallSession(callSid);
            }
          } else {
            // No bookings to confirm, just clear the session
            clearCallSession(callSid);
          }
        } else {
          // SMS confirmations already sent, just clear the session
          clearCallSession(callSid);
        }
      } catch (error) {
        console.error(
          `❌ Error handling SMS confirmations for abrupt disconnect ${callSid}:`,
          error
        );
        // Still clear the session even if SMS fails
        clearCallSession(callSid);
      }
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
