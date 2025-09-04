import WebSocket from "ws";
import { generateSystemPrompt, getAvailableFunctions } from "./utils.js";
import { validateConfig } from "./config.js";
import { handleFunctionCall } from "./functionHandlers.js";

// Get configuration
const config = validateConfig();

// TTS Model testing configuration
const AVAILABLE_TTS_MODELS = [
  "aura-2-thalia-en",    // Default - Natural, conversational
  "aura-2-luna-en",     // Warm, friendly
  "aura-2-stella-en",   // Professional, clear
  "aura-2-athena-en",   // Authoritative, confident
  "aura-2-hera-en",     // Calm, soothing
  "aura-2-orion-en",    // Deep, resonant
  "aura-2-arcas-en",    // Youthful, energetic
  "aura-2-perseus-en",  // Mature, sophisticated
  "aura-2-angus-en",    // Casual, approachable
];

// Current model selection (can be changed via environment variable or for testing)
let currentTTSModel = process.env.DEEPGRAM_TTS_MODEL || "aura-2-thalia-en";

/**
 * Get the current TTS model for Deepgram
 * @returns {string} - The TTS model name
 */
function getTTSModel() {
  if (!AVAILABLE_TTS_MODELS.includes(currentTTSModel)) {
    console.warn(`⚠️ Invalid TTS model '${currentTTSModel}', falling back to default`);
    currentTTSModel = "aura-2-thalia-en";
  }
  console.log(`🎤 Using TTS model: ${currentTTSModel}`);
  return currentTTSModel;
}

/**
 * Set TTS model for testing purposes
 * @param {string} modelName - The model name to use
 * @returns {boolean} - Success status
 */
function setTTSModel(modelName) {
  if (!AVAILABLE_TTS_MODELS.includes(modelName)) {
    console.error(`❌ Invalid TTS model: ${modelName}`);
    console.log(`Available models: ${AVAILABLE_TTS_MODELS.join(", ")}`);
    return false;
  }
  
  const previousModel = currentTTSModel;
  currentTTSModel = modelName;
  console.log(`🔄 TTS model changed from '${previousModel}' to '${currentTTSModel}'`);
  return true;
}

/**
 * Get available TTS models for testing
 * @returns {Array<string>} - Array of available model names
 */
function getAvailableTTSModels() {
  return [...AVAILABLE_TTS_MODELS];
}

/**
 * Initialize Deepgram Voice Agent connection
 * @param {Object} businessConfig - Business configuration object
 * @param {Object} callContext - Call context information
 * @param {Function} handleFunctionCall - Function to handle function calls
 * @returns {Promise<WebSocket>} - Connected Deepgram WebSocket
 */
export async function initializeDeepgram(businessConfig, callContext) {
  return new Promise((resolve, reject) => {
    const deepgramWs = new WebSocket(
      "wss://agent.deepgram.com/v1/agent/converse",
      ["token", config.deepgram.apiKey]
    );

    deepgramWs.on("open", () => {
      console.log(
        "✅ Deepgram WebSocket connected successfully - waiting for Welcome message"
      );
      console.log("Connection readyState:", deepgramWs.readyState);
    });

    // Wait for Welcome message before sending configuration (like official example)
    deepgramWs.on("message", async (message) => {
      try {
        const timestamp = new Date().toISOString();

        // Check if this is binary data (audio) vs JSON message
        if (message instanceof Buffer && message.length > 0) {
          // First check: if it's clearly not text-based, skip it
          if (
            message.length > 100 &&
            !message.toString("utf8", 0, 10).includes("{")
          ) {
            return;
          }

          const messageStr = message.toString("utf8");

          // Check if it looks like JSON by examining the content
          if (
            !messageStr.trim().startsWith("{") &&
            !messageStr.trim().startsWith("[")
          ) {
            // This is binary audio data, not a JSON message
            console.log(
              `[${timestamp}] 🔊 INIT: Ignoring non-JSON data (${message.length} bytes)`
            );
            return;
          }

          // Additional check for binary patterns and invalid UTF-8
          if (
            messageStr.includes("\x00") ||
            messageStr.includes("\xFF") ||
            messageStr.includes("�") ||
            /[\x00-\x08\x0E-\x1F\x7F-\xFF]/.test(messageStr)
          ) {
            // Contains binary characters, ignore it in initialization
            console.log(
              `[${timestamp}] 🔊 INIT: Ignoring binary data in initialization (${message.length} bytes)`
            );
            return;
          }
        }

        const data = JSON.parse(message.toString());
        console.log(`[${timestamp}] 📨 INIT: Deepgram message:`, data.type);
        console.log(
          `[${timestamp}] 📦 INIT: Full data:`,
          JSON.stringify(data, null, 2)
        );

        if (data.type === "Welcome") {
          console.log(
            `[${timestamp}] ✅ WELCOME: Received - sending agent configuration...`
          );

          // Generate system prompt
          const systemPrompt = generateSystemPrompt(
            businessConfig,
            callContext
          );

          console.log(
            `[${timestamp}] 📝 PROMPT: Generated length:`,
            systemPrompt.length,
            "characters"
          );
          console.log(
            `[${timestamp}] 📝 PROMPT: Preview (first 500 chars):`,
            systemPrompt.substring(0, 500) + "..."
          );
          console.log(`[${timestamp}] 🔧 PROMPT: Full content:`);
          console.log(systemPrompt);
          console.log(`[${timestamp}] 🔧 PROMPT: End of content`);
          console.log(
            `[${timestamp}] 🎯 PROMPT: Function calling rules included:`,
            systemPrompt.includes("get_available_slots")
          );

          const functionsArray = getAvailableFunctions();
          console.log(
            `[${timestamp}] 🔧 FUNCTIONS: Available count:`,
            Array.isArray(functionsArray) ? functionsArray.length : 0
          );

          const config = {
            type: "Settings",
            audio: {
              input: {
                encoding: "mulaw",
                sample_rate: 8000,
              },
              output: {
                encoding: "mulaw",
                sample_rate: 8000,
                container: "none",
              },
            },
            agent: {
              language: "en",
              listen: {
                provider: {
                  type: "deepgram",
                  model: "nova-3",
                },
              },
              think: {
                provider: {
                  type: "open_ai",
                  model: "gpt-4o-mini",
                },
                prompt: systemPrompt,
                functions: Array.isArray(functionsArray) ? functionsArray : [],
              },
              speak: {
                provider: {
                  type: "deepgram",
                  model: getTTSModel(),
                },
              },
              greeting: "Thank you for calling, how can I help you today?",
            },
          };

          console.log(`[${timestamp}] 📋 CONFIG: Summary:`);
          console.log(`[${timestamp}]    - Audio input: mulaw, 8000Hz`);
          console.log(`[${timestamp}]    - Audio output: mulaw, 8000Hz`);
          console.log(`[${timestamp}]    - Think model: gpt-4o-mini`);
          console.log(`[${timestamp}]    - Speak model: aura-2-thalia-en`);
          console.log(
            `[${timestamp}]    - Functions available:`,
            Array.isArray(functionsArray) ? functionsArray.length : 0
          );
          console.log(
            `[${timestamp}]    - Prompt length:`,
            systemPrompt?.length || 0,
            "characters"
          );

          // Validate config before sending
          if (!config.agent.think.prompt) {
            console.error(`[${timestamp}] ❌ CONFIG: Missing system prompt!`);
            reject(new Error("Missing system prompt"));
            return;
          }

          if (
            !config.agent.think.functions ||
            config.agent.think.functions.length === 0
          ) {
            console.error(`[${timestamp}] ❌ CONFIG: Missing functions!`);
            reject(new Error("Missing function definitions"));
            return;
          }

          console.log(
            `[${timestamp}] 📤 SENDING: Configuration to Deepgram...`
          );
          console.log(
            `[${timestamp}] 📦 CONFIG: Full payload:`,
            JSON.stringify(config, null, 2)
          );

          try {
            deepgramWs.send(JSON.stringify(config));
            console.log(
              `[${timestamp}] ✅ SENT: Configuration sent successfully to Deepgram`
            );
            console.log(
              `[${timestamp}] ⏳ WAITING: For SettingsApplied confirmation...`
            );
          } catch (configError) {
            console.error(
              `[${timestamp}] ❌ ERROR: Sending configuration to Deepgram:`,
              configError
            );
            reject(configError);
            return;
          }

          // Set up keep-alive messages to maintain connection
          // Track if we're processing function calls to avoid conflicts
          let processingFunctionCall = false;

          const keepAliveInterval = setInterval(() => {
            if (
              deepgramWs &&
              deepgramWs.readyState === WebSocket.OPEN &&
              !processingFunctionCall
            ) {
              deepgramWs.send(JSON.stringify({ type: "KeepAlive" }));
              console.log(
                `[${new Date().toISOString()}] 💓 KEEPALIVE: Sent to Deepgram`
              );
            } else if (processingFunctionCall) {
              console.log(
                `[${new Date().toISOString()}] ⏸️ KEEPALIVE: Skipped - processing function call`
              );
            } else {
              clearInterval(keepAliveInterval);
            }
          }, 5000);

          // Add function to control KeepAlive during function processing
          deepgramWs.pauseKeepAlive = () => {
            processingFunctionCall = true;
            console.log(
              `[${new Date().toISOString()}] ⏸️ KEEPALIVE: Paused for function processing`
            );
          };

          deepgramWs.resumeKeepAlive = () => {
            processingFunctionCall = false;
            console.log(
              `[${new Date().toISOString()}] ▶️ KEEPALIVE: Resumed after function processing`
            );
          };

          // Clean up interval when connection closes
          deepgramWs.on("close", () => {
            clearInterval(keepAliveInterval);
          });
        } else if (data.type === "SettingsApplied") {
          console.log(
            `[${timestamp}] ✅ SETTINGS_APPLIED: Agent configuration confirmed!`
          );
          console.log(
            `[${timestamp}] 🎯 READY: Agent can now handle conversations and function calls`
          );
          console.log(
            `[${timestamp}] 🔧 APPLIED: Audio settings:`,
            data.audio || "No audio config"
          );
          console.log(
            `[${timestamp}] 🔧 APPLIED: Agent settings:`,
            data.agent || "No agent config"
          );

          // Resolve the promise with the connected WebSocket
          resolve(deepgramWs);
        } else if (data.type === "FunctionCallRequest") {
          console.log(
            `[${timestamp}] 🚨🚨 FUNCTION_CALL_REQUEST in INIT! 🚨🚨`
          );
          console.log(
            `[${timestamp}] ✅ SUCCESS: AI requesting function calls!`
          );
          console.log(
            `[${timestamp}] 📋 Functions:`,
            JSON.stringify(data.functions, null, 2)
          );

          // Pause KeepAlive during function processing
          if (deepgramWs.pauseKeepAlive) {
            deepgramWs.pauseKeepAlive();
          }

          // Process each function in the request
          for (const func of data.functions) {
            console.log(`[${timestamp}] 🔧 Processing function:`, func.name);

            // Create the function call data in the expected format
            const functionCallData = {
              function_name: func.name,
              function_call_id: func.id,
              parameters: JSON.parse(func.arguments),
            };

            console.log(
              `[${timestamp}] 🔧 CALLING: handleFunctionCall for ${func.name}...`
            );
            await handleFunctionCall(
              deepgramWs,
              functionCallData,
              businessConfig,
              callContext.callSid
            );
            console.log(
              `[${timestamp}] ✅ COMPLETED: handleFunctionCall for ${func.name}`
            );
          }

          // Resume KeepAlive after function processing
          if (deepgramWs.resumeKeepAlive) {
            deepgramWs.resumeKeepAlive();
          }
        } else {
          console.log(
            `[${timestamp}] 📨 OTHER: Initialization message type:`,
            data.type
          );
          console.log(
            `[${timestamp}] 📦 OTHER: Full data:`,
            JSON.stringify(data, null, 2)
          );
        }
      } catch (error) {
        const timestamp = new Date().toISOString();
        console.error(
          `[${timestamp}] ❌ INIT_ERROR: Processing message:`,
          error
        );
        reject(error);
      }
    });

    deepgramWs.on("error", (error) => {
      console.error("Deepgram WebSocket error in initializeDeepgram:", error);
      reject(error);
    });

    deepgramWs.on("close", (code, reason) => {
      console.log(
        `Deepgram WebSocket closed in initializeDeepgram. Code: ${code}, Reason: ${reason}`
      );
      if (code !== 1000) {
        reject(new Error(`WebSocket closed with code ${code}: ${reason}`));
      }
    });

    // Set a timeout for connection establishment
    setTimeout(() => {
      if (deepgramWs.readyState !== WebSocket.OPEN) {
        reject(new Error("Deepgram connection timeout"));
      }
    }, 10000); // 10 second timeout
  });
}

/**
 * Export cleanup function for external use
 */
export function cleanupAudioSystem() {
  cleanupPersistentPacer();
  audioBuffer = Buffer.alloc(0);
  isStreamingAudio = false;
  if (audioStreamTimeout) {
    clearTimeout(audioStreamTimeout);
    audioStreamTimeout = null;
  }
  streamSid = null;
  twilioWsRef = null;
  
  // Reset audio diagnostics
  audioStats = {
    totalChunks: 0,
    totalBytes: 0,
    skippedChunks: 0,
    corruptedChunks: 0,
    alignmentIssues: 0,
    lastChunkTime: null,
    averageChunkSize: 0,
    minChunkSize: Infinity,
    maxChunkSize: 0
  };
}

/**
 * Handle Deepgram WebSocket messages
 * @param {Buffer|string} deepgramMessage - The message from Deepgram
 * @param {WebSocket} twilioWs - Twilio WebSocket connection
 * @param {WebSocket} deepgramWs - Deepgram WebSocket connection
 * @param {Object} businessConfig - Business configuration
 * @param {string} streamSid - Twilio stream ID
 * @param {Object} state - State object containing flags and timeouts
 * @returns {Promise<void>}
 */
// Persistent pacer system for continuous audio flow
let audioBuffer = Buffer.alloc(0); // Buffer for incoming audio data
let isStreamingAudio = false;
let audioStreamTimeout = null;
let pacer = null; // Persistent 20ms interval timer
let streamSid = null; // Store streamSid for pacer access
let twilioWsRef = null; // Store Twilio WebSocket reference for pacer

// Audio diagnostics
let audioStats = {
  totalChunks: 0,
  totalBytes: 0,
  skippedChunks: 0,
  corruptedChunks: 0,
  alignmentIssues: 0,
  lastChunkTime: null,
  averageChunkSize: 0,
  minChunkSize: Infinity,
  maxChunkSize: 0
};

// Audio constants for μ-law format (8kHz, 20ms frames)
const FRAME_SIZE = 160; // 20ms of 8kHz μ-law audio
const FADE_FRAMES = 8; // Number of frames for fade-in/fade-out (160ms)

/**
 * Generate proper μ-law silence according to ITU-T G.711 standard
 * @returns {Buffer} - Properly encoded μ-law silence buffer
 */
function generateMuLawSilence() {
  // According to ITU-T G.711, μ-law silence is encoded as 0xFF
  // This represents a linear PCM value of 0 (true silence)
  // The 0xFF value is the result of:
  // 1. Linear PCM value 0
  // 2. μ-law compression algorithm
  // 3. Bit inversion (as per G.711 standard for clock recovery)
  return Buffer.alloc(FRAME_SIZE, 0xFF);
}

/**
 * Generate high-quality μ-law silence with optional dithering
 * @param {boolean} useDithering - Whether to add minimal dithering for better quality
 * @returns {Buffer} - High-quality μ-law silence buffer
 */
function generateHighQualityMuLawSilence(useDithering = false) {
  if (!useDithering) {
    return generateMuLawSilence();
  }
  
  // Add minimal dithering to prevent potential digital artifacts
  // This creates very quiet pseudo-random noise that's below audible threshold
  const silenceBuffer = Buffer.alloc(FRAME_SIZE);
  
  for (let i = 0; i < FRAME_SIZE; i++) {
    // Generate very small random variation around true silence
    // Range: 0xFE to 0xFF (represents very quiet noise around 0)
    const dither = Math.random() < 0.95 ? 0xFF : 0xFE;
    silenceBuffer[i] = dither;
  }
  
  return silenceBuffer;
}

// Use high-quality silence generation
const SILENCE_PAYLOAD = generateHighQualityMuLawSilence().toString('base64');

/**
 * Get silence payload for different quality levels
 * @param {string} quality - 'standard', 'high', or 'dithered'
 * @returns {string} - Base64 encoded silence payload
 */
function getSilencePayload(quality = 'high') {
  switch (quality) {
    case 'standard':
      return generateMuLawSilence().toString('base64');
    case 'dithered':
      return generateHighQualityMuLawSilence(true).toString('base64');
    case 'high':
    default:
      return generateHighQualityMuLawSilence(false).toString('base64');
  }
}

/**
 * Initialize the persistent pacer that sends audio packets every 20ms
 */
function initializePersistentPacer() {
  if (pacer) {
    clearInterval(pacer);
  }
  
  console.log('🎵 Initializing persistent pacer for continuous audio flow');
  
  pacer = setInterval(() => {
    if (!twilioWsRef || twilioWsRef.readyState !== WebSocket.OPEN || !streamSid) {
      return;
    }
    
    let payload;
    
    if (audioBuffer.length >= FRAME_SIZE) {
      // Send real audio if available
      const frame = audioBuffer.slice(0, FRAME_SIZE);
      audioBuffer = audioBuffer.slice(FRAME_SIZE);
      payload = frame.toString('base64');
    } else {
      // Send high-quality silence to keep the stream alive
        payload = getSilencePayload('high');
    }
    
    // Always send a media message to maintain continuous flow
    const audioMessage = {
      event: 'media',
      streamSid: streamSid,
      media: { payload: payload },
    };
    
    try {
      twilioWsRef.send(JSON.stringify(audioMessage));
    } catch (error) {
      console.error('❌ Error sending audio packet in pacer:', error);
    }
  }, 20); // 20ms interval for continuous flow
  
  console.log('✅ Persistent pacer initialized - sending packets every 20ms');
}

/**
 * Update audio diagnostics with new chunk data
 * @param {number} base64Length - Length of base64 encoded audio
 * @param {number} decodedLength - Length of decoded audio buffer
 */
function updateAudioDiagnostics(base64Length, decodedLength) {
  audioStats.totalChunks++;
  audioStats.totalBytes += decodedLength;
  audioStats.lastChunkTime = Date.now();
  
  // Update size statistics
  audioStats.minChunkSize = Math.min(audioStats.minChunkSize, base64Length);
  audioStats.maxChunkSize = Math.max(audioStats.maxChunkSize, base64Length);
  audioStats.averageChunkSize = audioStats.totalBytes / audioStats.totalChunks;
  
  // Log diagnostics every 50 chunks
  if (audioStats.totalChunks % 50 === 0) {
    console.log(`📊 Audio Stats: ${audioStats.totalChunks} chunks, ${audioStats.totalBytes} bytes, avg: ${Math.round(audioStats.averageChunkSize)}, skipped: ${audioStats.skippedChunks}, corrupted: ${audioStats.corruptedChunks}, alignment issues: ${audioStats.alignmentIssues}`);
  }
}

/**
 * Log comprehensive audio diagnostics at the end of a stream
 */
function logFinalAudioDiagnostics() {
  if (audioStats.totalChunks === 0) {
    console.log(`📊 No audio chunks processed in this stream`);
    return;
  }
  
  const successRate = ((audioStats.totalChunks - audioStats.skippedChunks - audioStats.corruptedChunks) / audioStats.totalChunks * 100).toFixed(1);
  const avgChunkSize = Math.round(audioStats.averageChunkSize);
  
  console.log(`📊 Final Audio Stream Diagnostics:`);
  console.log(`   Total chunks: ${audioStats.totalChunks}`);
  console.log(`   Total bytes: ${audioStats.totalBytes}`);
  console.log(`   Success rate: ${successRate}%`);
  console.log(`   Skipped chunks: ${audioStats.skippedChunks}`);
  console.log(`   Corrupted chunks: ${audioStats.corruptedChunks}`);
  console.log(`   Alignment issues: ${audioStats.alignmentIssues}`);
  console.log(`   Chunk size - Min: ${audioStats.minChunkSize}, Max: ${audioStats.maxChunkSize}, Avg: ${avgChunkSize}`);
  
  // Provide recommendations based on diagnostics
  if (audioStats.skippedChunks > audioStats.totalChunks * 0.1) {
    console.warn(`⚠️ High skip rate (${(audioStats.skippedChunks/audioStats.totalChunks*100).toFixed(1)}%) - consider checking Deepgram TTS settings`);
  }
  if (audioStats.corruptedChunks > 0) {
    console.warn(`⚠️ Detected ${audioStats.corruptedChunks} corrupted chunks - potential network or encoding issues`);
  }
  if (audioStats.alignmentIssues > audioStats.totalChunks * 0.05) {
    console.warn(`⚠️ High alignment issues (${(audioStats.alignmentIssues/audioStats.totalChunks*100).toFixed(1)}%) - audio frame boundaries may be inconsistent`);
  }
}

/**
 * Clean up the persistent pacer
 */
function cleanupPersistentPacer() {
  if (pacer) {
    clearInterval(pacer);
    pacer = null;
    console.log('🔇 Persistent pacer cleaned up');
  }
}

/**
 * Apply smoothing to audio buffer to prevent crackling
 * @param {Buffer} audioBuffer - The audio buffer to smooth
 * @param {boolean} isFirstBuffer - Whether this is the first buffer in the stream
 * @returns {Buffer} - Smoothed audio buffer
 */
function applySmoothingToAudioBuffer(audioBuffer, isFirstBuffer = false) {
  if (audioBuffer.length === 0) {
    return audioBuffer;
  }

  const smoothedBuffer = Buffer.from(audioBuffer);
  const fadeFrameSize = Math.min(FADE_FRAMES * FRAME_SIZE, audioBuffer.length);

  // Apply fade-in at the beginning if this is the first buffer
  if (isFirstBuffer && fadeFrameSize > 0) {
    for (let i = 0; i < fadeFrameSize; i++) {
      const fadeRatio = i / fadeFrameSize;
      const originalValue = audioBuffer[i];
      // For μ-law, 0xFF is silence, so fade from silence to audio
      const silenceValue = 0xFF;
      const fadedValue = Math.round(silenceValue + (originalValue - silenceValue) * fadeRatio);
      smoothedBuffer[i] = Math.max(0, Math.min(255, fadedValue));
    }
  }

  // Apply fade-out at the end (for potential cross-fading with next buffer)
  if (fadeFrameSize > 0 && audioBuffer.length > fadeFrameSize) {
    const startFadeOut = audioBuffer.length - fadeFrameSize;
    for (let i = 0; i < fadeFrameSize; i++) {
      const fadeRatio = 1 - (i / fadeFrameSize);
      const bufferIndex = startFadeOut + i;
      const originalValue = audioBuffer[bufferIndex];
      const silenceValue = 0xFF;
      const fadedValue = Math.round(silenceValue + (originalValue - silenceValue) * fadeRatio);
      smoothedBuffer[bufferIndex] = Math.max(0, Math.min(255, fadedValue));
    }
  }

  return smoothedBuffer;
}

// Export TTS model functions for testing
export { getTTSModel, setTTSModel, getAvailableTTSModels };

export async function handleDeepgramMessage(
  deepgramMessage,
  twilioWs,
  deepgramWs,
  businessConfig,
  streamSidParam,
  state
) {
  // Store references for pacer access
  streamSid = streamSidParam;
  twilioWsRef = twilioWs;
  
  // Initialize persistent pacer if not already running
  if (!pacer && streamSid && twilioWs) {
    initializePersistentPacer();
  }
  
  const {
    expectingFunctionCall,
    functionCallTimeout,
    deepgramReady,
    setExpectingFunctionCall,
    setFunctionCallTimeout,
    setDeepgramReady,
  } = state;

  try {
    // Add timestamp to all logs
    const timestamp = new Date().toISOString();

    if (!Buffer.isBuffer(deepgramMessage)) {
      console.log("🔍 NON-BUFFER MESSAGE:", deepgramMessage.toString());
    }

    // Check if this is binary audio data
    if (Buffer.isBuffer(deepgramMessage)) {
      // Enhanced audio validation
      if (deepgramMessage.length === 0) {
        console.warn(`[${timestamp}] ⚠️ Received empty audio buffer from Deepgram`);
        return;
      }

      // Validate audio buffer size for mulaw 8kHz (should be consistent)
      if (deepgramMessage.length < 10) {
        console.warn(`[${timestamp}] ⚠️ Received suspiciously small audio buffer: ${deepgramMessage.length} bytes`);
        return;
      }

      // If we're receiving audio, Deepgram is clearly ready
      if (!deepgramReady) {
        console.log(`[${timestamp}] 🎉 Deepgram is sending audio - marking as ready!`);
        setDeepgramReady(true);
      }

      // Validate that we have a valid stream ID
      if (!streamSid) {
        console.warn(`[${timestamp}] ⚠️ No streamSid available for audio forwarding`);
        return;
      }

      // Feed audio buffer instead of sending directly (persistent pacer handles sending)
      try {
        // Mark that we're actively streaming audio
        if (!isStreamingAudio) {
          isStreamingAudio = true;
          console.log(`[${timestamp}] 🎵 Starting audio stream - feeding buffer`);
        }

        // Clear any existing timeout
        if (audioStreamTimeout) {
          clearTimeout(audioStreamTimeout);
        }

        // Add incoming audio to buffer instead of sending directly
        audioBuffer = Buffer.concat([audioBuffer, deepgramMessage]);
        console.log(`[${timestamp}] 📥 Added ${deepgramMessage.length} bytes to audio buffer (total: ${audioBuffer.length})`);

        // Set timeout to detect end of audio stream
        audioStreamTimeout = setTimeout(() => {
          if (isStreamingAudio) {
            console.log(`[${timestamp}] 🔇 Audio stream ended (timeout)`);
            isStreamingAudio = false;
          }
        }, 500); // 500ms timeout to detect stream end

      } catch (error) {
        console.error(`[${timestamp}] ❌ Error adding audio to buffer:`, error);
      }
      return;
    }

    // Log all non-binary messages for debugging
    console.log(
      "📨 Received Deepgram message:",
      deepgramMessage.toString().substring(0, 200) + "..."
    );

    // Try to parse as JSON for text messages
    const messageStr = deepgramMessage.toString();
    console.log("Message string:", messageStr);

    // Additional check: if it doesn't look like JSON, treat as binary
    if (
      !messageStr.trim().startsWith("{") &&
      !messageStr.trim().startsWith("[")
    ) {
      console.log(
        `Processing non-JSON data as binary audio (${deepgramMessage.length} bytes)`
      );

      // Validate audio data integrity
      if (deepgramMessage.length === 0) {
        console.warn("⚠️ Received empty non-JSON audio buffer from Deepgram");
        return;
      }

      // If we're receiving audio, Deepgram is clearly ready
      if (!deepgramReady) {
        console.log("🎉 Deepgram is sending audio - marking as ready!");
        setDeepgramReady(true);
      }

      // Validate that we have a valid stream ID
      if (!streamSid) {
        console.warn("⚠️ No streamSid available for non-JSON audio forwarding");
        return;
      }

      // This is likely binary audio data, add to buffer instead of sending directly
      try {
        audioBuffer = Buffer.concat([audioBuffer, deepgramMessage]);
        console.log(`📥 Added non-JSON audio to buffer: ${deepgramMessage.length} bytes (total: ${audioBuffer.length})`);
      } catch (error) {
        console.error("❌ Error adding non-JSON audio to buffer:", error);
      }
      return;
    }

    const deepgramData = JSON.parse(messageStr);

    // This is a JSON message - log it fully with timestamp
    console.log(`[${timestamp}] 📨 JSON MESSAGE FROM DEEPGRAM:`, messageStr);
    console.log(`[${timestamp}] === PARSED DEEPGRAM JSON ===`);
    console.log(JSON.stringify(deepgramData, null, 2));
    console.log(`[${timestamp}] === END PARSED JSON ===`);

    // Log the event type prominently
    console.log(`[${timestamp}] 🎯 DEEPGRAM EVENT TYPE: ${deepgramData.type}`);

    // Handle different types of Deepgram messages
    const context = {
      twilioWs,
      deepgramWs,
      businessConfig,
      streamSid,
      callSid: state.callSid,
      state: {
        expectingFunctionCall,
        functionCallTimeout,
        deepgramReady,
        setExpectingFunctionCall,
        setFunctionCallTimeout,
        setDeepgramReady,
      },
    };
    await handleDeepgramMessageType(deepgramData, timestamp, context);
  } catch (error) {
    console.error("❌ Error parsing Deepgram message:", error);
    console.error("Raw message:", deepgramMessage.toString());
  }
}

/**
 * Handle specific Deepgram message types
 * @param {Object} deepgramData - Parsed Deepgram message data
 * @param {string} timestamp - Current timestamp
 * @param {Object} context - Context object
 */
async function handleDeepgramMessageType(deepgramData, timestamp, context) {
  const { twilioWs, deepgramWs, businessConfig, streamSid, state } = context;

  if (deepgramData.type === "SettingsApplied") {
    // Deepgram is now ready to receive audio
    console.log(
      `[${timestamp}] ✅ SETTINGS_APPLIED: Deepgram ready to receive audio`
    );
    console.log(
      `[${timestamp}] 🔧 Audio settings:`,
      deepgramData.audio || "No audio settings"
    );
    console.log(
      `[${timestamp}] 🤖 Agent config:`,
      deepgramData.agent || "No agent config"
    );
    state.setDeepgramReady(true);
    console.log(`[${timestamp}] 🎙️ Agent ready with automatic greeting`);
  } else if (deepgramData.type === "Welcome") {
    console.log(`[${timestamp}] ✅ WELCOME: Deepgram connection established`);
  } else if (deepgramData.type === "Results") {
    // Speech-to-text results
    const transcript = deepgramData.channel?.alternatives?.[0]?.transcript;
    console.log(`[${timestamp}] 📝 RESULTS: Transcript:`, transcript);
    console.log(
      `[${timestamp}] 🔍 Full Results:`,
      JSON.stringify(deepgramData, null, 2)
    );

    // Enhanced detection for booking triggers
    if (transcript) {
      await handleTranscriptAnalysis(transcript, timestamp, state);
    }
  } else if (deepgramData.type === "SpeechStarted") {
    console.log(`[${timestamp}] 🎤 SPEECH_STARTED: User began speaking`);
  } else if (deepgramData.type === "UtteranceEnd") {
    console.log(`[${timestamp}] 🔇 UTTERANCE_END: User finished speaking`);
    console.log(
      `[${timestamp}] 🧠 EXPECTING: AgentThinking → FunctionCall or TtsStart`
    );
  } else if (deepgramData.type === "TtsAudio") {
    console.log(
      `[${timestamp}] 🔊 TTS_AUDIO: AI sending audio response (${
        deepgramData.data?.length || 0
      } chars)`
    );
    
    // Enhanced audio validation and synchronization
     if (deepgramData.data && deepgramData.data.length > 0) {
       // Validate audio data quality
       const audioData = deepgramData.data;
       const isValidBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(audioData);
       
       if (!isValidBase64) {
         console.error(`[${timestamp}] ❌ Invalid base64 audio data received`);
         return;
       }
       
       // Enhanced audio quality validation
       let decodedAudioBuffer = Buffer.from(audioData, 'base64');
       
       // Update audio diagnostics
       updateAudioDiagnostics(audioData.length, decodedAudioBuffer.length);
       
       // Check for suspiciously small audio chunks that might cause crackling
       if (audioData.length < 100) {
         console.warn(`[${timestamp}] ⚠️ Very small audio chunk (${audioData.length} chars) - potential crackling risk`);
         // Skip very small chunks that could cause audio artifacts
         if (audioData.length < 50) {
           console.warn(`[${timestamp}] 🚫 Skipping extremely small audio chunk to prevent crackling`);
           audioStats.skippedChunks++;
           return;
         }
       }
       
       // Validate audio buffer integrity
       if (decodedAudioBuffer.length === 0) {
         console.warn(`[${timestamp}] ⚠️ Empty audio buffer after base64 decode`);
         return;
       }
       
       // Check for audio buffer size consistency (should be multiples of frame size for μ-law)
       if (decodedAudioBuffer.length % FRAME_SIZE !== 0) {
         console.warn(`[${timestamp}] ⚠️ Audio buffer size (${decodedAudioBuffer.length}) not aligned to frame size (${FRAME_SIZE})`);
         // Pad or trim to frame boundary to prevent audio artifacts
         const alignedSize = Math.floor(decodedAudioBuffer.length / FRAME_SIZE) * FRAME_SIZE;
         if (alignedSize > 0) {
           decodedAudioBuffer = decodedAudioBuffer.slice(0, alignedSize);
           console.log(`[${timestamp}] 🔧 Aligned audio buffer from ${decodedAudioBuffer.length + (decodedAudioBuffer.length % FRAME_SIZE)} to ${alignedSize} bytes`);
           audioStats.alignmentIssues++;
         } else {
           console.warn(`[${timestamp}] 🚫 Audio buffer too small after alignment, skipping`);
           audioStats.skippedChunks++;
           return;
         }
       }
       
       // Detect potential audio corruption (all same values could indicate issues)
       const firstByte = decodedAudioBuffer[0];
       const allSame = decodedAudioBuffer.every(byte => byte === firstByte);
       if (allSame && decodedAudioBuffer.length > FRAME_SIZE) {
         console.warn(`[${timestamp}] ⚠️ Detected potentially corrupted audio (all bytes = 0x${firstByte.toString(16).padStart(2, '0')})`);
         // If it's all silence (0xFF), that's normal, otherwise it might be corruption
         if (firstByte !== 0xFF) {
           console.warn(`[${timestamp}] 🚫 Skipping potentially corrupted audio data`);
           audioStats.corruptedChunks++;
           return;
         }
       }
      // Mark that we're actively streaming audio
      if (!isStreamingAudio) {
        isStreamingAudio = true;
        console.log(`[${timestamp}] 🎵 Starting audio stream`);
      }
      
      // Clear any existing timeout since we're getting new audio
      if (audioStreamTimeout) {
        clearTimeout(audioStreamTimeout);
        audioStreamTimeout = null;
      }
      
      // Add TTS audio to buffer instead of sending directly (persistent pacer handles sending)
      try {
        // Apply audio smoothing to prevent crackling
        let smoothedAudioBuffer = applySmoothingToAudioBuffer(decodedAudioBuffer, audioBuffer.length === 0);
        
        // Use the validated and processed audio buffer
        audioBuffer = Buffer.concat([audioBuffer, smoothedAudioBuffer]);
        console.log(`[${timestamp}] 📥 Added validated TTS audio to buffer: ${smoothedAudioBuffer.length} bytes (total: ${audioBuffer.length})`);
        
        // Set a timeout to detect end of audio stream if no AgentAudioDone is received
        audioStreamTimeout = setTimeout(() => {
          if (isStreamingAudio) {
            console.log(`[${timestamp}] ⏰ Audio stream timeout - assuming end of audio`);
            isStreamingAudio = false;
          }
        }, 1000); // 1 second timeout
      } catch (error) {
        console.error(`[${timestamp}] ❌ Error adding TTS audio to buffer:`, error);
      }
    } else {
       console.warn(`[${timestamp}] ⚠️ Empty or invalid audio data received`);
       
       // If we receive empty audio but we're supposed to be streaming,
       // this might indicate an issue with the audio stream
       if (isStreamingAudio) {
         console.warn(`[${timestamp}] 🔍 Empty audio during active stream - checking stream health`);
         
         // Set a shorter timeout for empty audio to detect stream issues faster
         if (audioStreamTimeout) {
           clearTimeout(audioStreamTimeout);
         }
         audioStreamTimeout = setTimeout(() => {
           console.log(`[${timestamp}] 🔄 Resetting audio stream state due to empty audio`);
           isStreamingAudio = false;
         }, 500); // Shorter timeout for empty audio
       }
     }
  } else if (deepgramData.type === "AgentAudioDone") {
    console.log(`[${timestamp}] 🔇 AGENT_AUDIO_DONE: AI finished sending audio`);
    
    // While the pacer handles most of this, explicitly clearing the streaming state is good practice.
    isStreamingAudio = false;
    
    // Clear any lingering timeout as a failsafe.
    if (audioStreamTimeout) {
      clearTimeout(audioStreamTimeout);
      audioStreamTimeout = null;
    }
    
    // Log final audio diagnostics
    logFinalAudioDiagnostics();
    
    // The pacer will automatically switch to sending silence once the buffer is empty.
    // No need to send extra silence here; the pacer's default state handles it.
    console.log(`[${timestamp}] ✅ Agent speech ended. Pacer will now send silence until next utterance.`);
  } else if (deepgramData.type === "AgentThinking") {
    console.log(`[${timestamp}] 🧠 AGENT_THINKING: AI processing...`);
    console.log(
      `[${timestamp}] 🔍 Thinking details:`,
      deepgramData.text ||
        deepgramData.content ||
        deepgramData.thinking ||
        "No thinking details"
    );
    console.log(
      `[${timestamp}] ⏰ CRITICAL: Function calls should happen during thinking!`
    );
  } else if (deepgramData.type === "TtsStart") {
    console.log(`[${timestamp}] 🎙️ TTS_START: AI generating speech...`);
  } else if (deepgramData.type === "TtsText") {
    console.log(`[${timestamp}] 💬 TTS_TEXT: AI response:`, deepgramData.text);
    // Check if AI is mentioning availability without calling function
    if (
      deepgramData.text &&
      (deepgramData.text.toLowerCase().includes("available") ||
        deepgramData.text.toLowerCase().includes("check") ||
        deepgramData.text.toLowerCase().includes("let me see"))
    ) {
      console.log(
        `[${timestamp}] 🚨 WARNING: AI mentioned availability but NO FUNCTION CALL detected!`
      );
    }
  } else if (deepgramData.type === "AgentResponse") {
    console.log(
      `[${timestamp}] 🤖 AGENT_RESPONSE:`,
      deepgramData.response || deepgramData.text || "No response text"
    );
  } else if (deepgramData.type === "FunctionCall") {
    await handleFunctionCallMessage(deepgramData, timestamp, context);
  } else if (deepgramData.type === "FunctionCallRequest") {
    await handleFunctionCallRequestMessage(deepgramData, timestamp, context);
  } else if (deepgramData.type === "Error") {
    console.error(`[${timestamp}] ❌ DEEPGRAM_ERROR:`, deepgramData);
  } else if (deepgramData.type === "Warning") {
    console.warn(`[${timestamp}] ⚠️ DEEPGRAM_WARNING:`, deepgramData);
  } else if (deepgramData.type === "ConversationText") {
    console.log(
      `[${timestamp}] 💭 CONVERSATION_TEXT:`,
      deepgramData.text || deepgramData.content
    );
  } else if (deepgramData.type === "FunctionResponse") {
    console.log(`[${timestamp}] 📤 FUNCTION_RESPONSE: Sent back to agent`);
    console.log(
      `[${timestamp}] 📋 Response data:`,
      JSON.stringify(deepgramData, null, 2)
    );
  } else {
    console.log(`[${timestamp}] ❓ UNKNOWN_EVENT_TYPE: ${deepgramData.type}`);
    console.log(
      `[${timestamp}] 📦 Full message:`,
      JSON.stringify(deepgramData, null, 2)
    );
  }
}

/**
 * Handle transcript analysis for booking triggers
 * @param {string} transcript - The transcript text
 * @param {string} timestamp - Current timestamp
 * @param {Object} state - State object
 */
async function handleTranscriptAnalysis(transcript, timestamp, state) {
  const lowerTranscript = transcript.toLowerCase();
  const bookingKeywords = [
    "available",
    "appointment",
    "book",
    "schedule",
    "tomorrow",
    "today",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
  const namePattern = /my name is|i'm|i am|this is|call me/i;

  const hasBookingKeyword = bookingKeywords.some((keyword) =>
    lowerTranscript.includes(keyword)
  );
  const hasName =
    namePattern.test(transcript) ||
    /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(transcript);

  if (hasBookingKeyword) {
    console.log(`[${timestamp}] 🎯 BOOKING_KEYWORD_DETECTED:`, transcript);
    console.log(
      `[${timestamp}] 🤖 EXPECTING: get_available_slots function call soon!`
    );

    // Set expectation for function call
    state.setExpectingFunctionCall(true);

    // Clear any existing timeout
    if (state.functionCallTimeout) {
      clearTimeout(state.functionCallTimeout);
    }

    // Set timeout to detect if function call doesn't happen
    const timeout = setTimeout(() => {
      if (state.expectingFunctionCall) {
        console.log("🚨🚨 CRITICAL: AI FAILED TO CALL FUNCTION! 🚨🚨");
        console.log(
          "💡 Expected get_available_slots but AI responded with text instead"
        );
        console.log("🔧 This indicates the system prompt needs adjustment");
        state.setExpectingFunctionCall(false);
      }
    }, 8000); // 8 second timeout
    state.setFunctionCallTimeout(timeout);
  }

  if (hasName) {
    console.log(`[${timestamp}] 👤 CUSTOMER_NAME_DETECTED:`, transcript);
    console.log(
      `[${timestamp}] 🚨 NEXT: Booking request should trigger function call!`
    );
  }
}

/**
 * Handle FunctionCall message type
 * @param {Object} deepgramData - Deepgram message data
 * @param {string} timestamp - Current timestamp
 * @param {Object} context - Context object
 */
async function handleFunctionCallMessage(deepgramData, timestamp, context) {
  const { businessConfig, deepgramWs, state } = context;

  console.log(`[${timestamp}] 🚨🚨 FUNCTION_CALL DETECTED! 🚨🚨`);
  console.log(`[${timestamp}] ✅ SUCCESS: AI calling function as expected!`);
  console.log(`[${timestamp}] 🔧 Function:`, deepgramData.function_name);
  console.log(
    `[${timestamp}] 📋 Parameters:`,
    JSON.stringify(deepgramData.parameters, null, 2)
  );
  console.log(
    `[${timestamp}] 📦 Full payload:`,
    JSON.stringify(deepgramData, null, 2)
  );

  // Clear expectation since function call happened
  state.setExpectingFunctionCall(false);
  if (state.functionCallTimeout) {
    clearTimeout(state.functionCallTimeout);
    state.setFunctionCallTimeout(null);
  }

  if (deepgramWs && businessConfig) {
    console.log(`[${timestamp}] 🔧 CALLING: handleFunctionCall...`);
    await handleFunctionCall(
      deepgramWs,
      deepgramData,
      businessConfig,
      context.callSid,
      context.callerPhone
    );
    console.log(`[${timestamp}] ✅ COMPLETED: handleFunctionCall`);
  } else {
    console.error(
      `[${timestamp}] ❌ CANNOT handle function call - missing dependencies`
    );
    console.log(`[${timestamp}]    - deepgramWs:`, !!deepgramWs);
    console.log(`[${timestamp}]    - businessConfig:`, !!businessConfig);
  }
}

/**
 * Handle FunctionCallRequest message type
 * @param {Object} deepgramData - Deepgram message data
 * @param {string} timestamp - Current timestamp
 * @param {Object} context - Context object
 */
async function handleFunctionCallRequestMessage(
  deepgramData,
  timestamp,
  context
) {
  const { businessConfig, deepgramWs, state } = context;

  console.log(`[${timestamp}] 🚨🚨 FUNCTION_CALL_REQUEST DETECTED! 🚨🚨`);
  console.log(`[${timestamp}] ✅ SUCCESS: AI requesting function calls!`);
  console.log(
    `[${timestamp}] 📋 Functions:`,
    JSON.stringify(deepgramData.functions, null, 2)
  );

  // Clear expectation since function call happened
  state.setExpectingFunctionCall(false);
  if (state.functionCallTimeout) {
    clearTimeout(state.functionCallTimeout);
    state.setFunctionCallTimeout(null);
  }

  // Pause KeepAlive during function processing
  if (deepgramWs && deepgramWs.pauseKeepAlive) {
    deepgramWs.pauseKeepAlive();
  }

  // Process each function in the request
  for (const func of deepgramData.functions) {
    console.log(`[${timestamp}] 🔧 Processing function:`, func.name);

    // Create the function call data in the expected format
    const functionCallData = {
      function_name: func.name,
      function_call_id: func.id,
      parameters: JSON.parse(func.arguments),
    };

    if (deepgramWs && businessConfig) {
      console.log(
        `[${timestamp}] 🔧 CALLING: handleFunctionCall for ${func.name}...`
      );
      await handleFunctionCall(
        deepgramWs,
        functionCallData,
        businessConfig,
        context.callSid,
        context.callerPhone
      );
      console.log(
        `[${timestamp}] ✅ COMPLETED: handleFunctionCall for ${func.name}`
      );
    } else {
      console.error(
        `[${timestamp}] ❌ CANNOT handle function call - missing dependencies`
      );
      console.log(`[${timestamp}]    - deepgramWs:`, !!deepgramWs);
      console.log(`[${timestamp}]    - businessConfig:`, !!businessConfig);
    }
  }

  // Resume KeepAlive after function processing
  if (deepgramWs && deepgramWs.resumeKeepAlive) {
    deepgramWs.resumeKeepAlive();
  }
}

// Utility functions are now imported from utils.js module
