import WebSocket from "ws";
import { getConfig } from "./config.js";
import {
  parseISODate,
  parseUKDate,
  parseUKTime,
  getDayOfWeekName,
  convert12to24Hour,
  UK_TIMEZONE,
  formatISODate,
  getDayOfWeekNumber,
  getShortTimestamp,
  isBookingInPast,
} from "./dateUtils.js";
import { isWithinBusinessHours } from "./utils.js";
import { db } from "./database.js";

const config = getConfig();

// In-memory session store for call context
const callSessions = new Map();

// Track processed function call IDs to prevent duplicates
const processedFunctionCalls = new Set();
const functionCallTimestamps = new Map();

// Clean up old function call IDs every 5 minutes
setInterval(() => {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  for (const [functionCallId, timestamp] of functionCallTimestamps.entries()) {
    if (timestamp < fiveMinutesAgo) {
      processedFunctionCalls.delete(functionCallId);
      functionCallTimestamps.delete(functionCallId);
      console.log(`🧹 CLEANUP: Removed old function call ID ${functionCallId}`);
    }
  }
}, 5 * 60 * 1000); // Run every 5 minutes

/**
 * Store session data for a call
 * @param {string} callSid - The Twilio call SID
 * @param {Object} sessionData - Data to store for this call session
 */
export function setCallSession(callSid, sessionData) {
  if (!callSid) return;
  const existing = callSessions.get(callSid) || {};
  callSessions.set(callSid, { ...existing, ...sessionData });
  console.log(
    `📝 Session updated for call ${callSid}:`,
    callSessions.get(callSid)
  );
}

/**
 * Get session data for a call
 * @param {string} callSid - The Twilio call SID
 * @returns {Object} Session data or empty object
 */
export function getCallSession(callSid) {
  if (!callSid) return {};
  return callSessions.get(callSid) || {};
}

/**
 * Clear session data for a call
 * @param {string} callSid - The Twilio call SID
 */
export function clearCallSession(callSid) {
  if (!callSid) return;
  callSessions.delete(callSid);
  console.log(`🗑️ Session cleared for call ${callSid}`);
}

/**
 * Generate a unique booking reference ID for session tracking
 * @returns {string} A unique booking reference (e.g., "BK1", "BK2", etc.)
 */
function generateBookingReference() {
  return `BK${Date.now().toString().slice(-6)}${Math.random().toString(36).substr(2, 2).toUpperCase()}`;
}

/**
 * List current bookings in session with reference IDs for AI identification
 * @param {string} callSid - The Twilio call SID
 * @returns {Object} List of bookings with references and summary
 */
export function listCurrentBookings(callSid) {
  if (!callSid) {
    return { error: "No call session found" };
  }

  const session = getCallSession(callSid);
  const bookings = session.bookings || [];
  
  if (bookings.length === 0) {
    return { 
      message: "No bookings found in this session",
      bookings: []
    };
  }

  // Format bookings for AI reference
  const formattedBookings = bookings.map((booking, index) => {
    const status = booking.appointmentId ? 'CONFIRMED' : 'PENDING';
    const orderDescription = index === 0 ? 'first' : 
                           index === bookings.length - 1 ? 'last' : 
                           `${index + 1}${getOrdinalSuffix(index + 1)}`;
    
    // Determine booking source for better AI context
    const bookingSource = booking.type === 'existing' ? 'from previous call' : 
                         booking.type === 'create' ? 'created in this call' :
                         booking.type === 'update' ? 'updated in this call' : 'unknown';
    
    return {
      reference: booking.bookingReference,
      order: orderDescription,
      position: index + 1,
      status: status,
      customer: booking.customerName,
      service: booking.serviceName,
      date: booking.date,
      time: booking.time,
      appointmentId: booking.appointmentId,
      type: booking.type || 'create',
      source: bookingSource
    };
  });

  return {
    message: `Found ${bookings.length} booking${bookings.length > 1 ? 's' : ''} in this session`,
    bookings: formattedBookings,
    totalCount: bookings.length
  };
}

/**
 * Helper function to get ordinal suffix (1st, 2nd, 3rd, etc.)
 */
function getOrdinalSuffix(num) {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
}

/**
 * Proactively look up and store existing customer bookings in session
 * This should be called when a customer is first identified by phone number
 * @param {string} callSid - The Twilio call SID
 * @param {string} callerPhone - The caller's phone number
 * @param {Object} business - The business configuration
 * @returns {Object|null} The most recent future booking or null
 */
export async function lookupAndStoreCustomerBookings(callSid, callerPhone, business) {
  if (!callSid || !callerPhone || !business) {
    console.log("⚠️ Missing required parameters for customer booking lookup");
    return null;
  }

  try {
    console.log(`🔍 Looking up existing bookings for phone: ${callerPhone}`);
    
    // Call the lookup API to find existing bookings
    const lookupResponse = await fetch(
      `${config.nextjs.siteUrl}/api/voice/lookup-customer-bookings`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": config.nextjs.internalApiSecret,
        },
        body: JSON.stringify({
          business_id: business.id,
          caller_phone: callerPhone
        }),
      }
    );

    if (lookupResponse.ok) {
      const lookupResult = await lookupResponse.json();
      if (lookupResult.bookings && lookupResult.bookings.length > 0) {
        // Filter for future bookings only
        const futureBookings = lookupResult.bookings.filter(b => {
          const bookingDate = new Date(b.appointment_date + 'T' + b.start_time);
          return bookingDate > new Date();
        });
        
        if (futureBookings.length > 0) {
          // Convert existing bookings to session format with booking references
          const sessionBookings = futureBookings.map(booking => ({
            bookingReference: generateBookingReference(),
            customerName: booking.customer_name,
            serviceName: booking.service_name,
            date: booking.appointment_date,
            time: booking.start_time,
            appointmentId: booking.id,
            type: 'existing', // Mark as existing booking from previous call
            originalBookingId: booking.id // Keep original ID for updates
          }));

          // Store ALL future bookings in session for better handling
          setCallSession(callSid, {
            customerName: futureBookings[0].customer_name,
            hasExistingBookings: true,
            existingBookingsCount: futureBookings.length,
            allFutureBookings: futureBookings,
            bookings: sessionBookings, // Add to bookings array with references
            // Only set current booking details if there's exactly one booking
            ...(futureBookings.length === 1 ? {
              currentDate: futureBookings[0].appointment_date,
              currentTime: futureBookings[0].start_time,
              currentServiceName: futureBookings[0].service_name,
              selectedBookingId: futureBookings[0].id
            } : {})
          });
          
          console.log("✅ Stored existing bookings in session:", {
            customer: futureBookings[0].customer_name,
            totalFutureBookings: futureBookings.length,
            bookings: futureBookings.map(b => ({
              id: b.id,
              date: b.appointment_date,
              time: b.start_time,
              service: b.service_name
            }))
          });
          
          return futureBookings.length === 1 ? futureBookings[0] : futureBookings;
        } else {
          console.log("📅 No future bookings found for this customer");
        }
      } else {
        console.log("📅 No existing bookings found for this customer");
      }
    } else {
      console.log("⚠️ Could not lookup existing bookings:", lookupResponse.status);
    }
  } catch (error) {
    console.error("❌ Error during proactive booking lookup:", error);
  }
  
  return null;
}

/**
 * Main function call handler that routes function calls to appropriate handlers
 * @param {WebSocket} deepgramWs - The Deepgram WebSocket connection
 * @param {Object} functionCallData - The function call data from Deepgram
 * @param {Object} businessConfig - The business configuration
 */
export async function handleFunctionCall(
  deepgramWs,
  functionCallData,
  businessConfig,
  callSid = null,
  callerPhone = null
) {
  // Store caller phone in session if provided
  if (callSid && callerPhone) {
    setCallSession(callSid, { callerPhone });
  }
  const timestamp = getShortTimestamp();
  console.log(`[${timestamp}] 🚀 FUNCTION: ${functionCallData?.function_name}`);

  try {
    const { function_name, function_call_id } = functionCallData;
    // Handle both 'params' and 'parameters' properties
    const params = functionCallData.params || functionCallData.parameters || {};

    // Check for duplicate create_booking requests
    if (function_name === "create_booking" && function_call_id) {
      console.log(`🔍 DEDUP CHECK: Checking function call ID ${function_call_id}`);
      console.log(`🔍 DEDUP CHECK: Current processed calls:`, Array.from(processedFunctionCalls));
      console.log(`🔍 DEDUP CHECK: Function parameters:`, JSON.stringify(params, null, 2));
      console.log(`🔍 DEDUP CHECK: Timestamp:`, getShortTimestamp());
      
      if (processedFunctionCalls.has(function_call_id)) {
        console.log(
          `🚫 DUPLICATE BOOKING REQUEST DETECTED: ${function_call_id}`
        );
        console.log(`⏭️ Skipping duplicate create_booking call`);
        return {
          error:
            "Duplicate booking request detected - booking already processed",
        };
      }
      // Mark this function call as processed
      processedFunctionCalls.add(function_call_id);
      functionCallTimestamps.set(function_call_id, Date.now());
      console.log(
        `✅ TRACKING: Added function call ID ${function_call_id} to processed set`
      );
      console.log(`✅ TRACKING: Updated processed calls:`, Array.from(processedFunctionCalls));
    }

    // --- START: CRITICAL VALIDATION FOR BOOKING-RELATED FUNCTION CALLS ---
    // 🚨 ALWAYS validate booking requests BEFORE making any API calls
    if (function_name === "create_booking" || function_name === "get_available_slots") {
      const { date, time } = params;
      
      // CRITICAL: We need a date to proceed with any booking-related function
      if (!date) {
        console.error(`❌ FUNCTION_CALL_BLOCKED: No date provided for ${function_name}`);
        const errorResponse = {
          type: "FunctionCallResponse",
          id: function_call_id,
          name: function_name,
          content: JSON.stringify({ 
            error: "Please specify a date for your appointment."
          }),
        };
        
        try {
          if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
            deepgramWs.send(JSON.stringify(errorResponse));
            console.log("✅ Validation error response sent to Deepgram");
          }
        } catch (sendError) {
          console.error("❌ Error sending validation response:", sendError);
        }
        return;
      }

      // Get current time and business info for validation
      const businessInfo = businessConfig.business;
      const validationTimezone = businessInfo.timezone || UK_TIMEZONE;
      const now = new Date();
      const ukNow = new Date(now.toLocaleString("en-US", { timeZone: validationTimezone }));
      const currentTime = ukNow.toTimeString().slice(0, 5); // HH:MM format
      const currentDate = ukNow.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      console.log(`🕐 Current UK time: ${currentTime}, Current date: ${currentDate}`);
      console.log(`📅 Validating request for date: ${date}, time: ${time || 'not specified'}`);

      // Parse the requested date
      let requestedDate;
      try {
        requestedDate = parseISODate(date);
      } catch (error) {
        console.error(`❌ FUNCTION_CALL_BLOCKED: Invalid date format: ${date}`);
        const errorResponse = {
          type: "FunctionCallResponse",
          id: function_call_id,
          name: function_name,
          content: JSON.stringify({ 
            error: "Please provide a valid date format (e.g., 2024-01-15 or today)."
          }),
        };
        
        try {
          if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
            deepgramWs.send(JSON.stringify(errorResponse));
            console.log("✅ Validation error response sent to Deepgram");
          }
        } catch (sendError) {
          console.error("❌ Error sending validation response:", sendError);
        }
        return;
      }

      // Check if the requested date is in the past
      const requestedDateStr = requestedDate.toISOString().split('T')[0];
      if (requestedDateStr < currentDate) {
        console.error(`❌ FUNCTION_CALL_BLOCKED: Date ${date} is in the past`);
        const errorResponse = {
          type: "FunctionCallResponse",
          id: function_call_id,
          name: function_name,
          content: JSON.stringify({ 
            error: `Sorry, I cannot book appointments for past dates. Today is ${currentDate}. Please choose today or a future date.`
          }),
        };
        
        try {
          if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
            deepgramWs.send(JSON.stringify(errorResponse));
            console.log("✅ Validation error response sent to Deepgram");
          }
        } catch (sendError) {
          console.error("❌ Error sending validation response:", sendError);
        }
        return;
      }

      // Check if the requested date is a business day
      const businessHoursCheck = isWithinBusinessHours(
        date,
        "09:00", // Use a default time just to check if the day is open
        businessConfig
      );
      
      if (!businessHoursCheck.isWithin && businessHoursCheck.message.includes("closed")) {
        console.error(`❌ FUNCTION_CALL_BLOCKED: Business closed on ${date}`);
        const errorResponse = {
          type: "FunctionCallResponse",
          id: function_call_id,
          name: function_name,
          content: JSON.stringify({ 
            error: `Sorry, we are closed on that day. ${businessHoursCheck.message}`
          }),
        };
        
        try {
          if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
            deepgramWs.send(JSON.stringify(errorResponse));
            console.log("✅ Validation error response sent to Deepgram");
          }
        } catch (sendError) {
          console.error("❌ Error sending validation response:", sendError);
        }
        return;
      }

      // If we have both date and time, do additional time validation
      if (time) {
        // Convert 12-hour format to 24-hour if needed for validation
        const validationTime = time.includes("AM") || time.includes("PM") || time.includes("am") || time.includes("pm")
          ? convert12to24Hour(time)
          : time;

        // Check if the booking time is in the past (for today's bookings)
        const pastCheck = isBookingInPast(date, validationTime, validationTimezone);
        
        if (pastCheck.isPast) {
          console.error(`❌ FUNCTION_CALL_BLOCKED: ${pastCheck.message}`);
          const errorResponse = {
            type: "FunctionCallResponse",
            id: function_call_id,
            name: function_name,
            content: JSON.stringify({ 
              error: `Sorry, I cannot book appointments in the past. The current time is ${pastCheck.currentTime}. Please choose a future time.`
            }),
          };
          
          try {
            if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
              deepgramWs.send(JSON.stringify(errorResponse));
              console.log("✅ Validation error response sent to Deepgram");
            }
          } catch (sendError) {
            console.error("❌ Error sending validation response:", sendError);
          }
          return;
        }

        // Check if the requested time is within business hours
        const timeBusinessHoursCheck = isWithinBusinessHours(
          date,
          validationTime,
          businessConfig
        );
        
        if (!timeBusinessHoursCheck.isWithin) {
          console.error(`❌ FUNCTION_CALL_BLOCKED: ${timeBusinessHoursCheck.message}`);
          const errorResponse = {
            type: "FunctionCallResponse",
            id: function_call_id,
            name: function_name,
            content: JSON.stringify({ 
              error: `Sorry, I cannot book appointments outside business hours. ${timeBusinessHoursCheck.message}`
            }),
          };
          
          try {
            if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
              deepgramWs.send(JSON.stringify(errorResponse));
              console.log("✅ Validation error response sent to Deepgram");
            }
          } catch (sendError) {
            console.error("❌ Error sending validation response:", sendError);
          }
          return;
        }
      }
      
      console.log(`✅ FUNCTION_CALL_VALIDATION: ${function_name} passed all checks - proceeding with API call`);
    }
    // --- END: CRITICAL VALIDATION ---

    let result;

    switch (function_name) {
      case "get_services":
        console.log("🔧 Processing get_services function call");
        console.log(
          "📊 Raw services from config:",
          businessConfig.services.length,
          "services found"
        );

        result = businessConfig.services.map((s) => ({
          id: s.id,
          name: s.name,
          duration: s.duration_minutes,
          price: s.price,
          description: s.description,
        }));

        console.log(
          "📋 Mapped services result:",
          JSON.stringify(result, null, 2)
        );
        console.log("✅ get_services processing complete");
        break;

      case "get_staff_members":
        console.log("👥 Processing get_staff_members function call");
        console.log(
          "📊 Raw staff from config:",
          businessConfig.staffMembers?.length || 0,
          "staff members found"
        );

        result = (businessConfig.staffMembers || []).map((staff) => ({
          id: staff.id,
          name: staff.name,
          specialties: staff.specialties || [],
          working_hours: staff.working_hours,
        }));

        console.log("👥 Mapped staff result:", JSON.stringify(result, null, 2));
        console.log("✅ get_staff_members processing complete");
        break;

      case "get_available_slots":
        result = await getAvailableSlots(businessConfig, params, callSid);
        break;

      case "list_current_bookings":
        result = listCurrentBookings(callSid);
        break;

      case "create_booking":
        result = await createBooking(businessConfig, params, callSid);
        break;

      case "update_booking":
        result = await updateBooking(businessConfig, params, callSid);
        break;

      case "cancel_booking":
        result = await cancelBooking(businessConfig, params, callSid);
        break;

      case "end_call":
        result = await endCall(callSid, params, businessConfig);
        break;

      case "get_current_time":
        try {
          console.log("🕐 Getting current time");
          const now = new Date();
          const ukTime = new Date(now.toLocaleString("en-US", { timeZone: UK_TIMEZONE }));
          
          const currentTime24 = ukTime.toTimeString().slice(0, 5); // HH:MM format
          const currentTime12 = ukTime.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
          });
          
          console.log(`✅ Current UK time: ${currentTime24} (${currentTime12})`);
          result = {
            current_time_24h: currentTime24,
            current_time_12h: currentTime12,
            timezone: "Europe/London",
            timestamp: ukTime.toISOString(),
            formatted: `It is currently ${currentTime12} UK time`
          };
        } catch (error) {
          console.error("❌ Error getting current time:", error);
          result = {
            error: "Unable to get current time",
            details: error.message
          };
        }
        break;

      case "get_day_of_week":
        try {
          // Handle both 'params' and 'parameters' properties, and ensure we have the date
          const functionParams = params || functionCallData.parameters || {};
          const dateValue = functionParams.date;
          
          console.log("📅 Function call data:", JSON.stringify(functionCallData, null, 2));
          console.log("📅 Extracted params:", JSON.stringify(functionParams, null, 2));
          console.log("📅 Getting day of week for:", dateValue);
          console.log("📅 Date type:", typeof dateValue);
          console.log("📅 Date value:", JSON.stringify(dateValue));
          
          if (!dateValue) {
            result = {
              error: "No date provided. Please specify a date in DD/MM/YYYY format (e.g., 18/09/2025).",
              debug_info: {
                received_params: functionParams,
                function_call_data: functionCallData
              }
            };
            break;
          }
          
          // Try to parse the date
          const parsedDate = parseUKDate(dateValue);
          console.log("📅 Parsed date successfully:", parsedDate);
          
          const dayName = getDayOfWeekName(parsedDate);
          const dayNumber = getDayOfWeekNumber(parsedDate);

          console.log(`✅ ${dateValue} is a ${dayName}`);
          result = {
            date: dateValue,
            day_of_week: dayName,
            day_number: dayNumber,
            formatted: `${dayName}, ${parsedDate.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}`,
          };
        } catch (error) {
          console.error("❌ Error getting day of week:", error);
          console.error("❌ Error details:", error.message);
          console.error("❌ Error stack:", error.stack);
          
          // Try alternative parsing approaches
          console.log("🔄 Attempting alternative date parsing...");
          try {
            const functionParams = params || functionCallData.parameters || {};
            const dateValue = functionParams.date;
            
            if (!dateValue) {
              throw new Error("No date value available for alternative parsing");
            }
            
            // Try direct Date parsing
            const directParse = new Date(dateValue);
            console.log("📅 Direct Date() parsing result:", directParse);
            console.log("📅 Direct Date() is valid:", !isNaN(directParse.getTime()));
            
            // Try manual parsing for DD/MM/YYYY
            const parts = dateValue.split('/');
            if (parts.length === 3) {
              const day = parseInt(parts[0], 10);
              const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
              const year = parseInt(parts[2], 10);
              const manualDate = new Date(year, month, day);
              console.log("📅 Manual parsing result:", manualDate);
              console.log("📅 Manual parsing is valid:", !isNaN(manualDate.getTime()));
              
              if (!isNaN(manualDate.getTime())) {
                const dayName = getDayOfWeekName(manualDate);
                const dayNumber = getDayOfWeekNumber(manualDate);
                console.log(`✅ Manual parsing success: ${dateValue} is a ${dayName}`);
                result = {
                  date: dateValue,
                  day_of_week: dayName,
                  day_number: dayNumber,
                  formatted: `${dayName}, ${manualDate.toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}`,
                };
                break;
              }
            }
          } catch (altError) {
            console.error("❌ Alternative parsing also failed:", altError);
          }
          
          const functionParams = params || functionCallData.parameters || {};
          const dateValue = functionParams.date;
          
          result = {
            error: `Invalid date format: "${dateValue || 'undefined'}". Please use DD/MM/YYYY format (e.g., 16/09/2025).`,
            debug_info: {
              received_date: dateValue,
              date_type: typeof dateValue,
              error_message: error.message,
              function_call_data: functionCallData
            }
          };
        }
        break;

      case "select_booking":
        console.log("🎯 Processing select_booking function call");
        try {
          const session = getCallSession(callSid);
          
          if (!session || !session.allFutureBookings || session.allFutureBookings.length === 0) {
            result = { error: "No bookings available to select from. Please lookup your bookings first." };
            break;
          }
          
          const { appointment_date, start_time, service_name } = params;
          
          // Find the matching booking based on provided criteria
          let selectedBooking = null;
          
          for (const booking of session.allFutureBookings) {
            let matches = 0;
            let totalCriteria = 0;
            
            // Check date match
            if (appointment_date) {
              totalCriteria++;
              if (booking.appointment_date === appointment_date) {
                matches++;
              }
            }
            
            // Check time match
            if (start_time) {
              totalCriteria++;
              if (booking.start_time === start_time) {
                matches++;
              }
            }
            
            // Check service match (fuzzy matching for service names)
            if (service_name) {
              totalCriteria++;
              if (booking.service_name.toLowerCase().includes(service_name.toLowerCase()) ||
                  service_name.toLowerCase().includes(booking.service_name.toLowerCase())) {
                matches++;
              }
            }
            
            // If all provided criteria match, this is our booking
            if (matches === totalCriteria && totalCriteria > 0) {
              selectedBooking = booking;
              break;
            }
          }
          
          if (selectedBooking) {
            // Store the selected booking details in session
            setCallSession(callSid, {
              ...session,
              currentDate: selectedBooking.appointment_date,
              currentTime: selectedBooking.start_time,
              currentServiceName: selectedBooking.service_name,
              selectedBookingId: selectedBooking.id
            });
            
            result = {
              success: true,
              message: `Selected your ${selectedBooking.service_name} appointment on ${selectedBooking.appointment_date} at ${selectedBooking.start_time}. How would you like to modify this booking?`,
              selected_booking: {
                id: selectedBooking.id,
                customer_name: selectedBooking.customer_name,
                appointment_date: selectedBooking.appointment_date,
                start_time: selectedBooking.start_time,
                service_name: selectedBooking.service_name
              }
            };
          } else {
            // No exact match found, provide available options
            const availableOptions = session.allFutureBookings.map(booking => 
              `${booking.service_name} on ${booking.appointment_date} at ${booking.start_time}`
            ).join(', ');
            
            result = {
              success: false,
              message: `I couldn't find a booking matching those details. Your available appointments are: ${availableOptions}. Please specify which one you'd like to modify.`,
              available_bookings: session.allFutureBookings.map(booking => ({
                id: booking.id,
                customer_name: booking.customer_name,
                appointment_date: booking.appointment_date,
                start_time: booking.start_time,
                service_name: booking.service_name,
                formatted_info: `${booking.service_name} on ${booking.appointment_date} at ${booking.start_time}`
              }))
            };
          }
        } catch (error) {
          console.error("❌ Error in select_booking:", error);
          result = { error: "Failed to select booking" };
        }
        break;

      case "transfer_to_human":
        result = await transferToHuman(businessConfig, params, callSid);
        break;

      case "lookup_customer":
        console.log("🔍 Processing lookup_customer function call");
        try {
          const session = getCallSession(callSid);
          const phoneToUse = callerPhone || session.callerPhone;
          
          if (!phoneToUse) {
            result = { error: "No phone number available for customer lookup" };
            break;
          }
          
          const existingBooking = await lookupAndStoreCustomerBookings(
            callSid, 
            phoneToUse, 
            businessConfig.business
          );
          
          if (existingBooking) {
            // Check if it's a single booking or multiple bookings
            if (Array.isArray(existingBooking)) {
              // Multiple bookings found
              result = {
                success: true,
                message: `Found ${existingBooking.length} future bookings for ${existingBooking[0].customer_name}. Please specify which appointment you'd like to modify by mentioning the date, time, or service.`,
                multiple_bookings: true,
                bookings: existingBooking.map(booking => ({
                  id: booking.id,
                  customer_name: booking.customer_name,
                  appointment_date: booking.appointment_date,
                  start_time: booking.start_time,
                  service_name: booking.service_name,
                  formatted_info: `${booking.service_name} on ${booking.appointment_date} at ${booking.start_time}`
                }))
              };
            } else {
              // Single booking found
              result = {
                success: true,
                message: `Found existing booking for ${existingBooking.customer_name} on ${existingBooking.appointment_date} at ${existingBooking.start_time} for ${existingBooking.service_name}`,
                multiple_bookings: false,
                booking: {
                  id: existingBooking.id,
                  customer_name: existingBooking.customer_name,
                  appointment_date: existingBooking.appointment_date,
                  start_time: existingBooking.start_time,
                  service_name: existingBooking.service_name
                }
              };
            }
          } else {
            result = {
              success: true,
              message: "No existing future bookings found for this customer",
              multiple_bookings: false,
              booking: null
            };
          }
        } catch (error) {
          console.error("❌ Error in lookup_customer:", error);
          result = { error: "Failed to lookup customer bookings" };
        }
        break;

      default:
        result = { error: "Unknown function" };
    }

    // Send response back to Deepgram
    const response = {
      type: "FunctionCallResponse",
      id: functionCallData.function_call_id,
      name: function_name,
      content: JSON.stringify(result), // Deepgram expects content as string
    };

    console.log(`✅ Sending ${function_name} response to Deepgram`);
    // Reduced logging for better performance

    try {
      if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
        deepgramWs.send(JSON.stringify(response));
        console.log("✅ Function response sent successfully to Deepgram");
        console.log("🔄 Waiting for Deepgram to process the response...");

        // Add a small delay to ensure Deepgram processes the response before any KeepAlive
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else {
        console.error(
          "❌ Cannot send function response - Deepgram connection not open"
        );
        console.error("   - WebSocket exists:", !!deepgramWs);
        console.error("   - ReadyState:", deepgramWs?.readyState);
        throw new Error("Deepgram connection not available");
      }
    } catch (sendError) {
      console.error("❌ Error sending response to Deepgram:", sendError);
      // Don't throw the error to prevent connection closure
      console.error("🔧 Continuing despite send error to maintain connection");
    }
  } catch (error) {
    console.error("Error handling function call:", error);

    // Send error response
    const errorResponse = {
      type: "FunctionCallResponse",
      id: functionCallData.function_call_id,
      name: functionCallData.function_name,
      content: JSON.stringify({ error: "Function execution failed" }),
    };

    deepgramWs.send(JSON.stringify(errorResponse));
  }
}

/**
 * Get available appointment slots for a given date and service
 * @param {Object} businessConfig - The business configuration
 * @param {Object} params - Parameters including date and service_id
 * @returns {Object} Available slots or error
 */
export async function getAvailableSlots(businessConfig, params, callSid = null) {
  const timestamp = getShortTimestamp();
  console.log(`[${timestamp}] 🗓️ GET_SLOTS: ${params.date} service:${params.service_id}`);

  try {
    const { date, service_id } = params;
    // Business config already defined at the top of the function

    // Check if the requested date falls within business operating days
    // This uses the proper UK date parsing and business hours validation
    try {
      const parsedDate = parseISODate(date);
      const businessHoursCheck = isWithinBusinessHours(
        parsedDate,
        "09:00",
        businessConfig
      );

      if (!businessHoursCheck.isWithin) {
        console.log(`📅 Business closed: ${businessHoursCheck.message}`);
        return {
          slots: [],
          message: businessHoursCheck.message,
        };
      }
      console.log(`📅 Business open on ${getDayOfWeekName(parsedDate)}`);
    } catch (error) {
      console.error("Error checking business hours:", error);
      // Continue with normal flow if error
    }

    // Get service details and duration
    let serviceId = service_id;
    let service = null;

    if (serviceId) {
      // First try to find by ID (UUID)
      service = businessConfig.services.find((s) => s.id === serviceId);

      // If not found by ID, try to find by name (case-insensitive)
      if (!service) {
        service = businessConfig.services.find(
          (s) => s.name.toLowerCase() === serviceId.toLowerCase()
        );
        if (service) {
          serviceId = service.id; // Use the actual UUID
          console.log(
            `📋 Found service by name '${service_id}' -> ID: ${serviceId}`
          );
        }
      }

      if (service) {
        console.log(
          "📋 Using service:",
          service.name,
          "(Duration:",
          service.duration_minutes,
          "minutes)"
        );
      } else {
        console.error("❌ Service not found with ID/Name:", serviceId);
        console.error(
          "📋 Available services:",
          businessConfig.services.map((s) => `${s.name} (${s.id})`)
        );
        return {
          error: `Service not found: ${serviceId}. Available services: ${businessConfig.services
            .map((s) => s.name)
            .join(", ")}`,
        };
      }
    } else if (businessConfig.services.length > 0) {
      // Use first available service as default
      service = businessConfig.services[0];
      serviceId = service.id;
      console.log(
        "📋 Using default service:",
        service.name,
        "(Duration:",
        service.duration_minutes,
        "minutes)"
      );
    } else {
      console.error("❌ No services available");
      return { error: "No services available" };
    }

    // Call the new simplified calendar availability API
    let apiUrl = `${config.nextjs.siteUrl}/api/calendar/availability?businessId=${businessConfig.business.id}&serviceId=${serviceId}&date=${date}`;
    
    // Add customer context if available (for update scenarios)
    const session = callSid ? getCallSession(callSid) : null;
    if (session?.callerPhone) {
      apiUrl += `&customerPhone=${encodeURIComponent(session.callerPhone)}`;
      console.log(`🔍 Including customer context for availability check: ${session.callerPhone}`);
    }
    if (callSid) {
      apiUrl += `&sessionId=${encodeURIComponent(callSid)}`;
    }

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "x-internal-secret": config.nextjs.internalApiSecret,
      },
    });

    const result = await response.json();
    console.log(`[${timestamp}] 📡 API: ${response.status} - ${result.slots?.length || 0} slots`);

    if (!response.ok) {
      console.error("❌ Calendar API error:", result);
      return { error: result.error || "Failed to get available slots" };
    }

    // Extract just the time strings from the slots
    const availableTimes = result.slots?.map((slot) => slot.startTime) || [];
    console.log("✅ Available time slots:", availableTimes);

    // Helper function to convert 24-hour to 12-hour format
    const convertTo12Hour = (time24) => {
      const [hours, minutes] = time24.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return `${hour12}:${minutes} ${ampm}`;
    };

    // Create both 24-hour and 12-hour formats for AI processing
    const availableSlots12Hour = availableTimes.map(convertTo12Hour);
    console.log("✅ Available slots (12-hour):", availableSlots12Hour);

    // Store the checked date in session for context awareness
    if (callSid && date) {
      const session = getCallSession(callSid);
      setCallSession(callSid, {
        ...session,
        lastCheckedDate: date,
        lastCheckedTimestamp: getShortTimestamp()
      });
      console.log(`📅 Stored checked date in session: ${date}`);
    }

    return {
      available_slots: availableTimes,
      available_slots_12hour: availableSlots12Hour,
      conversion_map: availableTimes.reduce((map, time24, index) => {
        map[availableSlots12Hour[index]] = time24;
        return map;
      }, {})
    };
  } catch (error) {
    console.error("❌ Error getting available slots:", error);
    return { error: "Failed to get available slots" };
  }
}

/**
 * Create a new booking by calling the internal Next.js API endpoint
 * @param {Object} businessConfig - The business configuration
 * @param {Object} params - Booking parameters including customer info, service, date, time
 * @returns {Object} Booking result or error
 */
export async function createBooking(businessConfig, params, callSid = null) {
  try {
    const timestamp = getShortTimestamp();
    console.log(`[${timestamp}] 📅 CREATE_BOOKING: ${params.customer_name} - ${params.service_id} on ${params.date} at ${params.time}`);

    const { customer_name, service_id, date, time, customer_phone } = params;

    // Get caller phone from session if not provided in params
    const session = getCallSession(callSid);
    const phoneToUse = customer_phone || session.callerPhone;

    // Validate required parameters
    if (!customer_name || !service_id || !date || !time) {
      console.error("❌ Missing required booking parameters:", {
        customer_name,
        service_id,
        date,
        time,
      });
      return {
        error:
          "Missing required information: name, service, date, and time are required",
      };
    }

    // --- START: CRITICAL SAFEGUARD FOR AI DUPLICATE BOOKING ATTEMPTS ---
    // Check if this exact booking has already been successfully made in this session
    if (callSid && session && session.bookings) {
      const existingBooking = session.bookings.find(
        (b) => 
          b.date === date && 
          b.time === time && 
          b.serviceId === service_id && 
          b.appointmentId // This ensures the first booking was successful
      );

      if (existingBooking) {
        const timestamp = getShortTimestamp();
        console.log(`[${timestamp}] ✅ DUPLICATE_BOOKING_IGNORED: Booking was already confirmed in this session.`);
        console.log(`📋 Existing booking details:`, {
          customer: existingBooking.customerName,
          service: existingBooking.serviceName,
          date: existingBooking.date,
          time: existingBooking.time,
          appointmentId: existingBooking.appointmentId
        });
        
        // Return the success details from the original booking to reinforce confirmation
        return {
          success: true,
          appointment_id: existingBooking.appointmentId,
          message: `✅ BOOKING CONFIRMED: Appointment was already successfully booked for ${customer_name} on ${date} at ${time}.`,
        };
      }
    }
    // --- END: CRITICAL SAFEGUARD ---

    // Find the service (try by ID first, then by name as fallback)
    let service = businessConfig.services.find((s) => s.id === service_id);
    if (!service) {
      // Try to find by name (case-insensitive)
      service = businessConfig.services.find(
        (s) => s.name.toLowerCase() === service_id.toLowerCase()
      );
      if (service) {
        console.log(
          `📋 Booking - Found service by name '${service_id}' -> ID: ${service.id}`
        );
      }
    }
    if (!service) {
      console.error("❌ Service not found. Service ID/Name:", service_id);
      console.error(
        "📋 Available services:",
        businessConfig.services.map((s) => `${s.id}: ${s.name}`)
      );
      return {
        error: `Service not found. Available services: ${businessConfig.services
          .map((s) => s.name)
          .join(", ")}`,
      };
    }
    console.log(
      "✅ Booking - Service found:",
      service.name,
      "(ID:",
      service.id,
      ")"
    );

    // Store customer info in session for future use
    if (callSid && customer_name) {
      const session = getCallSession(callSid);
      const bookings = session.bookings || [];
      
      // Add this booking to the list (will be updated with appointment ID later)
      const newBooking = {
        bookingReference: generateBookingReference(),
        customerName: customer_name,
        date: date,
        time: time,
        serviceId: service_id,
        serviceName: service.name,
        serviceDuration: service.duration_minutes,
        appointmentId: null, // Will be set after successful creation
        type: 'create'
      };
      
      bookings.push(newBooking);
      
      setCallSession(callSid, {
        customerName: customer_name,
        lastBookingDate: date,
        lastBookingTime: time,
        lastServiceId: service_id,
        lastServiceName: service.name,
        lastServiceDuration: service.duration_minutes,
        bookings: bookings
      });
    }

    // Calculate start and end times with proper UK timezone handling
    const business = businessConfig.business;
    const businessTimezone = business.timezone || UK_TIMEZONE;

    console.log(
      `🕐 Creating appointment for ${date} at ${time} in timezone: ${businessTimezone}`
    );

    // Parse and validate the date and time using UK standards
    let parsedDate;
    try {
      parsedDate = parseISODate(date);
      // Convert 12-hour format to 24-hour if needed
      const timeIn24h =
        time.includes("AM") ||
        time.includes("PM") ||
        time.includes("am") ||
        time.includes("pm")
          ? convert12to24Hour(time)
          : time;
      // Parse time for validation but don't store result as it's not used
      parseUKTime(timeIn24h, parsedDate);

      // Verify the day of the week is correct
      const dayOfWeek = getDayOfWeekName(parsedDate);
      console.log(
        `📅 Parsed date: ${formatISODate(parsedDate)} (${dayOfWeek})`
      );
    } catch (error) {
      console.error(`❌ Date/time parsing error:`, error.message);
      return { error: `Invalid date or time format: ${error.message}` };
    }

    // Convert time to 24-hour format if needed
    const timeIn24h =
      time.includes("AM") ||
      time.includes("PM") ||
      time.includes("am") ||
      time.includes("pm")
        ? convert12to24Hour(time)
        : time;

    // Calculate end time by adding service duration
    const [hours, minutes] = timeIn24h.split(":").map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + service.duration_minutes;
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    const endTimeIn24h = `${endHours.toString().padStart(2, "0")}:${endMins
      .toString()
      .padStart(2, "0")}`;

    // Send separate date and time components to avoid timezone conversion issues
    const startTime = timeIn24h;
    const endTimeString = endTimeIn24h;

    console.log(`🕐 Appointment datetime (UK local): ${startTime}`);
    console.log(`🕐 Business timezone: ${businessTimezone}`);
    console.log(`🕐 Start time: ${startTime}`);
    console.log(`🕐 End time: ${endTimeString}`);
    console.log(`📅 Day of week: ${getDayOfWeekName(parsedDate)}`);

    // CRITICAL: Check availability before creating booking to prevent double bookings
    console.log("🔍 Checking slot availability before booking...");
    try {
      const availabilityResponse = await fetch(
        `${
          config.nextjs.siteUrl || "http://localhost:3000"
        }/api/calendar/availability`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-secret": config.nextjs.internalApiSecret,
          },
          body: JSON.stringify({
            businessId: businessConfig.business.id,
            serviceId: service.id,
            appointmentDate: date,
            startTime: startTime,
            endTime: endTimeString,
          }),
        }
      );

      if (!availabilityResponse.ok) {
        console.error(
          "❌ Failed to check availability:",
          availabilityResponse.status
        );
        return {
          error: "Unable to verify slot availability. Please try again.",
        };
      }

      const availabilityResult = await availabilityResponse.json();
      console.log(
        "📋 Availability check result:",
        JSON.stringify(availabilityResult, null, 2)
      );

      if (!availabilityResult.available) {
        console.log("❌ Slot not available - preventing double booking");
        return {
          error: `Sorry, the ${time} slot on ${date} is no longer available. Please choose a different time.`,
        };
      }

      console.log("✅ Slot is available - proceeding with booking");
    } catch (error) {
      console.error("❌ Error checking availability:", error);
      return { error: "Unable to verify slot availability. Please try again." };
    }

    // Prepare booking data for the Next.js API
    const bookingData = {
      businessId: businessConfig.business.id,
      serviceId: service.id, // Use the actual service UUID, not the name
      appointmentDate: date,
      startTime: startTime,
      endTime: endTimeString,
      customerName: customer_name,
      customerPhone: phoneToUse || null,
      customerEmail: null, // Voice calls don't typically capture email
      notes: `Voice booking - Customer: ${customer_name}${
        phoneToUse ? ` - Phone: ${phoneToUse}` : ""
      }`,
      sessionId: callSid, // Pass session ID for filler phrase generation
    };

    console.log("📞 Calling internal Next.js booking API...");
    console.log(
      "🔗 API URL:",
      `${config.nextjs.siteUrl || "http://localhost:3000"}/api/internal/booking`
    );
    console.log("📦 Booking data:", JSON.stringify(bookingData, null, 2));

    // Call the internal Next.js booking API endpoint
    const baseUrl = config.nextjs.siteUrl || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/internal/booking`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": config.nextjs.internalApiSecret,
      },
      body: JSON.stringify(bookingData),
    });

    console.log(
      "📡 API Response status:",
      response.status,
      response.statusText
    );

    const result = await response.json();
    console.log("📋 API Response body:", JSON.stringify(result, null, 2));

    if (!response.ok) {
      console.error("❌ Booking API error:", result);
      return { error: result.error || "Failed to create booking" };
    }

    console.log(
      "✅ Appointment created successfully via API:",
      result.appointmentId
    );
    console.log("📅 Calendar event ID:", result.calendarEventId || "None");

    // Update call log with customer name if we have a call SID
    try {
      if (callSid && customer_name) {
        console.log(
          `📞 Updating call log with customer name: ${customer_name}`
        );
        await db.updateCallCustomer(callSid, customer_name);
        console.log(`✅ Call log updated with customer name: ${callSid}`);
      }
    } catch (error) {
      console.error("❌ Failed to update call log with customer name:", error);
      // Don't fail the booking if call logging fails
    }

    // Store appointment ID in session for SMS confirmation
    if (callSid && result.appointmentId) {
      const session = getCallSession(callSid);
      const bookings = session.bookings || [];
      
      // Update the most recent booking with the appointment ID
      if (bookings.length > 0) {
        const lastBooking = bookings[bookings.length - 1];
        if (lastBooking.appointmentId === null) {
          lastBooking.appointmentId = result.appointmentId;
        }
      }
      
      setCallSession(callSid, {
        lastAppointmentId: result.appointmentId,
        lastServiceDuration: service.duration_minutes,
        bookings: bookings
      });
      console.log(
        `📋 Stored appointment ID in session: ${result.appointmentId}`
      );
    }

    const successMessage = `✅ BOOKING CONFIRMED: Appointment successfully booked for ${customer_name} on ${date} at ${time} for ${service.name}. Your appointment is confirmed and secured.`;
    const calendarNote = result.calendarEventId
      ? " Event has been added to your Google Calendar."
      : "";

    return {
      success: true,
      appointment_id: result.appointmentId,
      calendar_event_id: result.calendarEventId,
      message: successMessage + calendarNote,
    };
  } catch (error) {
    console.error("Error in createBooking:", error);
    return { error: "Booking failed" };
  }
}

/**
 * Update an existing booking
 * @param {Object} businessConfig - The business configuration
 * @param {Object} params - Parameters including customer details and new booking info
 * @returns {Object} Update result or error
 */
export async function updateBooking(businessConfig, params, callSid = null) {
  try {
    const timestamp = getShortTimestamp();
    console.log(`[${timestamp}] 📝 UPDATE_BOOKING: Booking reference ${params.booking_reference || 'not specified'}`);

    const {
      booking_reference,
      customer_name,
      current_date,
      current_time,
      new_date,
      new_time,
      new_service_id,
    } = params;

    // Get business config early to avoid initialization errors
    const business = businessConfig.business;

    if (!business?.google_calendar_id) {
      console.error("❌ No Google Calendar connected for business");
      return { error: "Calendar not connected" };
    }

    // Get session data to find the specific booking
    const session = getCallSession(callSid);
    console.log("📋 Session data:", session);

    // CRITICAL: Use booking reference to identify the exact booking
    let targetBooking = null;
    
    if (booking_reference) {
      // Find booking by reference ID
      const bookings = session.bookings || [];
      targetBooking = bookings.find(b => b.bookingReference === booking_reference);
      
      if (!targetBooking) {
        console.error(`❌ Booking reference ${booking_reference} not found in session`);
        return { 
          error: `Booking reference ${booking_reference} not found. Please use list_current_bookings to see available bookings.` 
        };
      }
      
      if (!targetBooking.appointmentId) {
        console.error(`❌ Booking reference ${booking_reference} has no appointment ID`);
        return { 
          error: `Booking ${booking_reference} is not confirmed yet. Cannot update pending bookings.` 
        };
      }
      
      console.log("🎯 Found target booking by reference:", {
        reference: targetBooking.bookingReference,
        appointmentId: targetBooking.appointmentId,
        service: targetBooking.serviceName,
        date: targetBooking.date,
        time: targetBooking.time
      });
      
    } else {
      // FALLBACK: If no booking reference provided, require explicit date/time or error
      if (!current_date || !current_time) {
        return { 
          error: "Please specify which booking to update by providing either a booking reference (use list_current_bookings to see them) or the current date and time of the appointment." 
        };
      }
      
      // Try to find by date/time as fallback
      const bookings = session.bookings || [];
      targetBooking = bookings.find(b => 
        b.date === current_date && 
        b.time === current_time && 
        b.appointmentId &&
        !b.updatedTo
      );
      
      if (!targetBooking) {
        console.error(`❌ No booking found for ${current_date} at ${current_time}`);
        return { 
          error: `No confirmed booking found for ${current_date} at ${current_time}. Please use list_current_bookings to see available bookings.` 
        };
      }
      
      console.log("🎯 Found target booking by date/time:", {
        reference: targetBooking.bookingReference,
        appointmentId: targetBooking.appointmentId,
        service: targetBooking.serviceName,
        date: targetBooking.date,
        time: targetBooking.time
      });
    }

    // Use the target booking details for the update
    const currentDateToUse = targetBooking.date;
    const currentTimeToUse = targetBooking.time;
    const customerNameToUse = customer_name || targetBooking.customerName;

    // If we still don't have current booking details, something went wrong
    if (!currentDateToUse || !currentTimeToUse) {
      console.log("❌ No target booking found - cannot update without booking reference");
      return {
        success: false,
        message: "Could not identify which booking to update. Please specify which booking you'd like to change.",
        error: "NO_TARGET_BOOKING"
      };
    }

    console.log("🔄 Using customer info:", {
      customerName: customerNameToUse,
      currentDate: currentDateToUse,
      currentTime: currentTimeToUse,
    });

    // Check for recently checked date context
    // If user only provided new_time and recently checked availability for a different date,
    // they might want to move to that checked date
    if (new_time && !new_date && session.lastCheckedDate) {
      const checkedDate = session.lastCheckedDate;
      const checkedTimestamp = session.lastCheckedTimestamp;
      const now = new Date();
      const checkedTime = new Date(checkedTimestamp);
      const timeDiffMinutes = (now - checkedTime) / (1000 * 60);
      
      // If they checked availability within the last 10 minutes and it's a different date
      if (timeDiffMinutes <= 10 && checkedDate !== currentDateToUse) {
        console.log(`🎯 CONTEXT AWARENESS: User checked availability for ${checkedDate} ${timeDiffMinutes.toFixed(1)} minutes ago`);
        console.log(`📅 Current booking date: ${currentDateToUse}, Checked date: ${checkedDate}`);
        console.log(`💡 User likely wants to move to the checked date (${checkedDate}) at ${new_time}`);
        
        // Log this insight but don't automatically change the behavior
        // The AI should handle this based on the improved instructions
        console.log(`🤖 AI should consider suggesting: new_date: "${checkedDate}", new_time: "${new_time}"`);
      }
    }

    // Get caller phone from session for verification
    const callerPhone = session?.callerPhone;

    if (!callerPhone) {
      console.error("❌ No caller phone available for verification");
      return { error: "Phone verification required for updates" };
    }

    // Enhanced phone verification message for different numbers
    console.log(`📞 Caller phone: ${callerPhone}`);
    console.log(`👤 Customer: ${customerNameToUse}`);
    console.log(`📅 Booking: ${currentDateToUse} at ${currentTimeToUse}`);

    // Prepare request body with only defined values
    const requestBody = {
      business_id: business.id,
      customer_name: customerNameToUse,
      caller_phone: callerPhone,
      sessionId: callSid, // Pass session ID for filler phrase generation
      isUpdate: true, // Flag to indicate this is an update operation
    };

    // Always include current_date and current_time (required by API)
    requestBody.current_date = currentDateToUse;
    requestBody.current_time = currentTimeToUse;
    
    // For existing bookings, also include appointment_id for precise identification
    if (targetBooking.type === 'existing' && targetBooking.originalBookingId) {
      requestBody.appointment_id = targetBooking.originalBookingId;
      console.log(`🎯 Using appointment_id + date/time for existing booking: ${targetBooking.originalBookingId} (${currentDateToUse} at ${currentTimeToUse})`);
    } else {
      console.log(`📅 Using date/time for session booking: ${currentDateToUse} at ${currentTimeToUse}`);
    }

    // Update session with new booking details if provided
    if (callSid && (new_date || new_time || new_service_id)) {
      const session = getCallSession(callSid);
      const bookings = session.bookings || [];
      
      // Add this update to the bookings array
      const updateBooking = {
        customerName: customerNameToUse,
        currentDate: currentDateToUse,
        currentTime: currentTimeToUse,
        newDate: new_date,
        newTime: new_time,
        newServiceId: new_service_id,
        type: 'update'
      };
      
      bookings.push(updateBooking);
      
      const sessionUpdate = {
        bookings: bookings
      };
      if (new_date) sessionUpdate.lastBookingDate = new_date;
      if (new_time) sessionUpdate.lastBookingTime = new_time;
      if (new_service_id) sessionUpdate.lastServiceId = new_service_id;
      setCallSession(callSid, sessionUpdate);
    }

    // Only include new values if they are defined
    if (new_date !== undefined) requestBody.new_date = new_date;
    if (new_time !== undefined) requestBody.new_time = new_time;
    if (new_service_id !== undefined)
      requestBody.new_service_id = new_service_id;

    console.log(
      "📦 Update request body:",
      JSON.stringify(requestBody, null, 2)
    );

    // Call the internal Next.js API to update the booking
    const response = await fetch(
      `${config.nextjs.siteUrl}/api/voice/update-booking`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": config.nextjs.internalApiSecret,
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Update booking API error:", response.status, errorText);
      return {
        error: `Failed to update booking: ${errorText}`,
      };
    }

    const result = await response.json();
    console.log("✅ Booking updated successfully:", result);

    // Update the booking in the session with final details
    if (callSid && result.booking) {
      const session = getCallSession(callSid);
      const bookings = session.bookings || [];
      
      // Update the most recent update booking with final details
      if (bookings.length > 0) {
        const lastBooking = bookings[bookings.length - 1];
        if (lastBooking.type === 'update') {
          lastBooking.finalDate = result.booking.appointment_date;
          lastBooking.finalTime = result.booking.start_time;
          lastBooking.appointmentId = result.booking.id;
          lastBooking.serviceName = result.booking.service_name;
        }
      }
      
      // Mark any existing bookings with the same original date/time as updated
      // This prevents the AI from trying to update the same booking again
      for (const booking of bookings) {
        if (booking.type === 'create' && 
            booking.date === currentDateToUse && 
            booking.time === currentTimeToUse) {
          booking.updatedTo = {
            date: result.booking.appointment_date,
            time: result.booking.start_time,
            appointmentId: result.booking.id
          };
          console.log(`🔄 Marked original booking as updated:`, {
            originalDate: booking.date,
            originalTime: booking.time,
            newDate: result.booking.appointment_date,
            newTime: result.booking.start_time
          });
        }
      }
      
      setCallSession(callSid, { bookings: bookings });
    }

    // SMS will be sent at the end of the call, not immediately
    console.log("📝 Updated booking will receive SMS confirmation at call end");

    return {
      success: true,
      message: `Booking updated successfully for ${customerNameToUse}`,
      booking: result.booking,
    };
  } catch (error) {
    console.error("❌ Error updating booking:", error);
    return {
      error: `Failed to update booking: ${error.message}`,
    };
  }
}

/**
 * Cancel an existing booking
 * @param {Object} businessConfig - The business configuration
 * @param {Object} params - Parameters including customer details and booking info
 * @returns {Object} Cancellation result or error
 */
export async function cancelBooking(businessConfig, params, callSid = null) {
  try {
    const timestamp = getShortTimestamp();
    console.log(`[${timestamp}] ❌ CANCEL_BOOKING: ${params.customer_name} - ${params.date} ${params.time}`);

    const { customer_name, date, time, reason } = params;
    const business = businessConfig.business;

    if (!business?.google_calendar_id) {
      console.error("❌ No Google Calendar connected for business");
      return { error: "Calendar not connected" };
    }

    // Get session data to fill in missing customer information
    const session = getCallSession(callSid);
    console.log("📋 Session data for cancellation:", session);

    // Use session data as fallback for missing information
    const customerNameToUse = customer_name || session.customerName;
    const dateToUse = date || session.lastBookingDate;
    const timeToUse = time || session.lastBookingTime;
    const callerPhone = session?.callerPhone;

    console.log("🔄 Using booking info for cancellation:", {
      customerName: customerNameToUse,
      date: dateToUse,
      time: timeToUse,
    });

    if (!callerPhone) {
      console.error("❌ No caller phone available for verification");
      return { error: "Phone verification required for cancellations" };
    }

    // Enhanced phone verification message for different numbers
    console.log(`📞 Caller phone: ${callerPhone}`);
    console.log(`👤 Customer: ${customerNameToUse}`);
    console.log(`📅 Booking: ${dateToUse} at ${timeToUse}`);

    // Call the internal Next.js API to cancel the booking
    const response = await fetch(
      `${config.nextjs.siteUrl}/api/voice/cancel-booking`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": config.nextjs.internalApiSecret,
        },
        body: JSON.stringify({
          business_id: business.id,
          customer_name: customerNameToUse,
          date: dateToUse,
          time: timeToUse,
          reason: reason || "Customer requested cancellation",
          caller_phone: callerPhone,
          sessionId: callSid, // Pass session ID for filler phrase generation
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Cancel booking API error:", response.status, errorText);
      return {
        error: `Failed to cancel booking: ${errorText}`,
      };
    }

    const result = await response.json();
    console.log("✅ Booking cancelled successfully:", result);

    // Track the cancellation in the bookings array
    if (callSid) {
      const session = getCallSession(callSid);
      const bookings = session.bookings || [];
      
      const cancellation = {
        customerName: customerNameToUse,
        date: dateToUse,
        time: timeToUse,
        reason: reason || "Customer requested cancellation",
        type: 'cancellation',
        appointmentId: result.booking?.id
      };
      
      bookings.push(cancellation);
      
      setCallSession(callSid, { 
        bookings: bookings,
        bookingCancelled: true 
      });
      console.log("📝 Tracked cancellation in session - no SMS will be sent");
    }

    return {
      success: true,
      message: `Booking cancelled successfully for ${customer_name}`,
      booking: result.booking,
    };
  } catch (error) {
    console.error("❌ Error cancelling booking:", error);
    return {
      error: `Failed to cancel booking: ${error.message}`,
    };
  }
}

/**
 * End the current Twilio call
 * @param {string} callSid - The Twilio call SID to terminate
 * @param {Object} params - Parameters including reason for ending the call
 * @param {Object} businessConfig - The business configuration for SMS sending
 * @returns {Object} Result of call termination or error
 */
export async function endCall(callSid, params, businessConfig = null) {
  let smsSuccess = false; // Declare at function level to avoid scope issues
  
  try {
    console.log(
      "📞 endCall called with params:",
      JSON.stringify(params, null, 2)
    );
    console.log("📞 Call SID:", callSid);

    const { reason } = params;

    if (!callSid) {
      console.error("❌ No callSid available to end call");
      return { error: "Call ID not available" };
    }

    // Get session data before clearing it
    const session = getCallSession(callSid);
    console.log("📋 Session data before ending call:", session);

    // Send consolidated SMS with all bookings made during the call
    if (session.bookings && session.bookings.length > 0 && session.callerPhone && businessConfig && !session.bookingCancelled) {
      try {
        // Track booking evolution: group by appointment chains
        const bookingChains = new Map(); // appointmentId -> array of booking states
        const cancelledAppointments = new Set(); // Track cancelled appointment IDs
        const finalBookings = [];
        
        // First pass: track cancellations and group bookings by appointment ID
        for (const booking of session.bookings) {
          if (booking.type === 'cancellation') {
            // Track cancelled appointments
            if (booking.appointmentId) {
              cancelledAppointments.add(booking.appointmentId);
              console.log(`❌ Appointment ${booking.appointmentId} was cancelled - will not send SMS`);
            }
            continue;
          }
          
          // Skip original bookings that have been moved (have updatedTo field)
          if (booking.type === 'create' && booking.updatedTo) {
            console.log(`🔄 Skipping original booking that was moved: ${booking.appointmentId} (${booking.date} at ${booking.time}) -> moved to (${booking.updatedTo.date} at ${booking.updatedTo.time})`);
            continue;
          }
          
          if (booking.type === 'create' && booking.appointmentId) {
            // New booking created
            bookingChains.set(booking.appointmentId, [booking]);
          } else if (booking.type === 'update') {
            // Find which appointment this update belongs to
            let targetAppointmentId = booking.appointmentId;
            
            // If no appointmentId, this is an intermediate update - find the target appointment
            if (!targetAppointmentId) {
              // Look for the most recent booking that could be updated
              // Try to match by service first, then by most recent
              let targetBooking = null;
              
              // If the update specifies dates/times, try to match existing appointments
              if (booking.currentDate && booking.currentTime) {
                for (let i = session.bookings.indexOf(booking) - 1; i >= 0; i--) {
                  const prevBooking = session.bookings[i];
                  if (prevBooking.appointmentId && 
                      prevBooking.type === 'create' &&
                      prevBooking.date === booking.currentDate &&
                      prevBooking.time === booking.currentTime) {
                    targetBooking = prevBooking;
                    break;
                  }
                }
              }
              
              // If no exact match, find the most recent create booking
              if (!targetBooking) {
                for (let i = session.bookings.indexOf(booking) - 1; i >= 0; i--) {
                  const prevBooking = session.bookings[i];
                  if (prevBooking.appointmentId && prevBooking.type === 'create') {
                    targetBooking = prevBooking;
                    break;
                  }
                }
              }
              
              if (targetBooking) {
                targetAppointmentId = targetBooking.appointmentId;
                console.log(`🔗 Linked update to appointment ${targetAppointmentId} based on context`);
              }
            }
            
            if (targetAppointmentId) {
              if (!bookingChains.has(targetAppointmentId)) {
                bookingChains.set(targetAppointmentId, []);
              }
              bookingChains.get(targetAppointmentId).push(booking);
            } else {
              console.warn("⚠️ Could not link update to any appointment:", booking);
            }
          }
        }
        
        // Second pass: determine final state for each booking chain
        for (const [appointmentId, chain] of bookingChains) {
          if (chain.length === 0) continue;
          
          // Skip cancelled appointments - they should not receive SMS confirmations
          if (cancelledAppointments.has(appointmentId)) {
            console.log(`🚫 Skipping SMS for cancelled appointment ${appointmentId}`);
            continue;
          }
          
          // Find the final state by looking at the last booking with complete info
          let finalBooking = null;
          
          // Start with the create booking
          const createBooking = chain.find(b => b.type === 'create');
          if (createBooking) {
            finalBooking = {
              appointmentId: createBooking.appointmentId,
              serviceName: createBooking.serviceName,
              date: createBooking.date,
              time: createBooking.time,
              type: 'create'
            };
          }
          
          // Apply updates in order
          const updates = chain.filter(b => b.type === 'update').sort((a, b) => {
            // Sort by order in the bookings array (later updates override earlier ones)
            return session.bookings.indexOf(a) - session.bookings.indexOf(b);
          });
          
          for (const update of updates) {
            if (finalBooking) {
              // Update the final booking with new information
              if (update.finalDate) finalBooking.date = update.finalDate;
              if (update.finalTime) finalBooking.time = update.finalTime;
              if (update.newDate && !update.finalDate) finalBooking.date = update.newDate;
              if (update.newTime && !update.finalTime) finalBooking.time = update.newTime;
              if (update.serviceName) finalBooking.serviceName = update.serviceName;
              if (update.appointmentId) finalBooking.appointmentId = update.appointmentId;
              
              console.log(`📝 Applied update to appointment ${appointmentId}:`, {
                finalDate: update.finalDate,
                finalTime: update.finalTime,
                newDate: update.newDate,
                newTime: update.newTime,
                resultingDate: finalBooking.date,
                resultingTime: finalBooking.time
              });
            } else if (updates.length > 0) {
              // If there's no create booking but there are updates, create finalBooking from the first update
              // This handles the case where we're updating an existing appointment that wasn't created in this call
              const firstUpdate = updates[0];
              finalBooking = {
                appointmentId: firstUpdate.appointmentId,
                serviceName: firstUpdate.serviceName,
                date: firstUpdate.finalDate || firstUpdate.newDate,
                time: firstUpdate.finalTime || firstUpdate.newTime,
                type: 'update'
              };
              
              console.log(`📝 Created finalBooking from update for existing appointment ${appointmentId}:`, {
                date: finalBooking.date,
                time: finalBooking.time,
                serviceName: finalBooking.serviceName
              });
              
              // Apply any remaining updates
              for (let i = 1; i < updates.length; i++) {
                const laterUpdate = updates[i];
                if (laterUpdate.finalDate) finalBooking.date = laterUpdate.finalDate;
                if (laterUpdate.finalTime) finalBooking.time = laterUpdate.finalTime;
                if (laterUpdate.newDate && !laterUpdate.finalDate) finalBooking.date = laterUpdate.newDate;
                if (laterUpdate.newTime && !laterUpdate.finalTime) finalBooking.time = laterUpdate.newTime;
                if (laterUpdate.serviceName) finalBooking.serviceName = laterUpdate.serviceName;
                if (laterUpdate.appointmentId) finalBooking.appointmentId = laterUpdate.appointmentId;
              }
              break; // Exit the loop since we've processed all updates
            }
          }
          
          if (finalBooking && finalBooking.appointmentId) {
            finalBookings.push(finalBooking);
          }
        }
        
        if (finalBookings.length > 0) {
          // Deduplicate final bookings by appointmentId and content
          const uniqueBookings = [];
          const seenAppointmentIds = new Set();
          const seenContent = new Set();
          
          for (const booking of finalBookings) {
            const contentKey = `${booking.date}-${booking.time}-${booking.serviceName}`;
            
            // Skip if we've already seen this appointmentId or exact content
            if (booking.appointmentId && seenAppointmentIds.has(booking.appointmentId)) {
              console.log(`🔄 Skipping duplicate appointmentId: ${booking.appointmentId}`);
              continue;
            }
            
            if (seenContent.has(contentKey)) {
              console.log(`🔄 Skipping duplicate booking content: ${contentKey}`);
              continue;
            }
            
            // Add to unique bookings
            uniqueBookings.push(booking);
            if (booking.appointmentId) {
              seenAppointmentIds.add(booking.appointmentId);
            }
            seenContent.add(contentKey);
          }
          
          console.log(
            "📱 Sending consolidated SMS confirmation for unique bookings:",
            uniqueBookings.map(b => `${b.appointmentId} (${b.serviceName} on ${b.date} at ${b.time})`)
          );
          
          // Get customer name from session or fallback to first booking's customer name
          const customerName = session.customerName || 
                              (uniqueBookings.length > 0 ? uniqueBookings[0].customerName : null) ||
                              "Valued Customer";
          
          await sendConsolidatedSMSConfirmation(
            {
              businessId: businessConfig.business.id,
              customerPhone: session.callerPhone,
              customerName: customerName,
              bookings: uniqueBookings,
            },
            businessConfig
          );
          console.log("✅ Consolidated SMS confirmation sent successfully");
          
          // Mark SMS as sent in session to prevent duplicates
          setCallSession(callSid, { smsConfirmationSent: true });
          smsSuccess = true;
        } else {
          // No bookings to send SMS for, consider it successful
          smsSuccess = true;
        }
      } catch (smsError) {
        console.error("❌ Failed to send consolidated SMS confirmation:", smsError);
        // Don't fail the call ending if SMS fails, but don't clear session yet
        // This allows for potential retry in server.js disconnect handler
      }
    } else if (session.bookingCancelled) {
      console.log("🚫 Skipping SMS confirmation - booking was cancelled in this call");
      smsSuccess = true; // No SMS needed for cancelled bookings
    } else {
      // No bookings at all, consider SMS successful
      smsSuccess = true;
    }

    // Initialize Twilio client
    const twilio = (await import("twilio")).default(
      config.twilio.accountSid,
      config.twilio.authToken
    );

    console.log(`📞 Attempting to end call with SID: ${callSid}`);
    console.log(`📝 Reason: ${reason}`);

    // Update the call to completed status
    const call = await twilio.calls(callSid).update({
      status: "completed",
    });

    console.log(`✅ Call ended successfully:`, call.status);

    // Only clear call session if SMS was successful or not needed
    if (smsSuccess) {
      clearCallSession(callSid);
      console.log(`🧹 Session cleared for call ${callSid} after successful SMS handling`);
    } else {
      console.log(`⚠️ Session retained for call ${callSid} due to SMS failure - may retry`);
    }

    return {
      success: true,
      call_ended: true,
      callSid: callSid,
      status: call.status,
      reason: reason
    };
  } catch (error) {
    console.error("❌ Error ending call:", error);
    return { error: "Failed to end call" };
  }
}

/**
 * Transfer call to human representative
 * @param {Object} businessConfig - The business configuration
 * @param {Object} params - Parameters for the transfer
 * @param {string} callSid - The Twilio call SID
 * @returns {Object} Transfer result
 */
export async function transferToHuman(businessConfig, params, callSid) {
  try {
    console.log("📞 Processing human transfer request...");
    console.log("📞 Transfer params:", JSON.stringify(params, null, 2));
    console.log("📞 Call SID:", callSid);

    // Get bypass phone number from business config
    const bypassPhoneNumber = businessConfig.config?.bypass_phone_number;

    if (!bypassPhoneNumber) {
      console.error("❌ No bypass phone number configured for business");
      return {
        success: false,
        error: "Human transfer not available - no phone number configured",
        message:
          "I apologize, but human transfer is not currently available. Please try calling back later or leave a message.",
      };
    }

    console.log("📞 Bypass phone number found:", bypassPhoneNumber);

    // Log the transfer request
    console.log(
      `🔄 Initiating transfer from AI to human at ${bypassPhoneNumber}`
    );

    // Get caller information from session
    const session = getCallSession(callSid);
    const callerPhone = session?.callerPhone || "Unknown";

    console.log(`📞 Caller: ${callerPhone} requesting human transfer`);

    // Implement Twilio call transfer using REST API
    if (!config.twilio.accountSid || !config.twilio.authToken) {
      console.error("❌ Twilio credentials not configured");
      return {
        success: false,
        error: "Call transfer service is not properly configured",
        message:
          "I apologize, but call transfer is not properly configured. Please try calling back later.",
      };
    }

    // Create Twilio client
    const twilio = (await import("twilio")).default(
      config.twilio.accountSid,
      config.twilio.authToken
    );

    // Update the call to transfer it to the bypass number
    // This will redirect the call to the new number
    const siteUrl = config.nextjs.siteUrl;
    const transferUrl = `${siteUrl}/api/voice/transfer?to=${encodeURIComponent(
      bypassPhoneNumber
    )}&reason=${encodeURIComponent(
      params.reason || "Customer requested human assistance"
    )}`;

    console.log(`📞 Transferring call to: ${transferUrl}`);

    const call = await twilio.calls(callSid).update({
      url: transferUrl,
      method: "POST",
    });

    console.log(
      `✅ Call ${callSid} successfully transferred to ${bypassPhoneNumber}`
    );

    return {
      success: true,
      transfer_number: bypassPhoneNumber,
      message:
        "I'm connecting you to a human representative now. Please hold while I transfer your call.",
      caller_phone: callerPhone,
      reason: params.reason || "Customer requested human assistance",
      twilio_call_sid: call.sid,
    };
  } catch (error) {
    console.error("❌ Error processing human transfer:", error);
    return {
      success: false,
      error: error.message,
      message:
        "I apologize, but I'm unable to transfer you to a human right now. Please try calling back later.",
    };
  }
}



/**
 * Send consolidated SMS confirmation for multiple bookings
 * @param {Object} params - SMS parameters
 * @param {Object} businessConfig - Business configuration
 * @returns {Promise<void>}
 */
export async function sendConsolidatedSMSConfirmation(params, businessConfig) {
  const { businessId, customerPhone, customerName, bookings } = params;

  // Get the template from dashboard configuration
  const template = businessConfig?.config?.sms_confirmation_template ||
    `Hi {customer_name}, your appointment at {business_name} is confirmed for {date} at {time} for {service_name}. Duration: {duration} mins. Questions? Call {business_phone}`;

  // For multiple bookings, create a consolidated message using the template structure
  let message;
  
  if (bookings.length === 1) {
    // Single booking - use template directly
    const booking = bookings[0];
    const date = booking.finalDate || booking.date;
    const time = booking.finalTime || booking.time;
    const serviceName = booking.serviceName || booking.service_name || "your service";
    const duration = booking.serviceDuration || booking.duration || booking.lastServiceDuration || "";
    
    message = template
      .replace(/{customer_name}/g, customerName)
      .replace(/{business_name}/g, businessConfig?.business?.name || "our business")
      .replace(/{date}/g, date)
      .replace(/{time}/g, time)
      .replace(/{service_name}/g, serviceName)
      .replace(/{duration}/g, duration ? `${duration}` : "")
      .replace(/{business_phone}/g, businessConfig?.business?.phone_number || "");
  } else {
    // Multiple bookings - adapt template for consolidated format
    message = `Hi ${customerName}, your appointments at ${businessConfig?.business?.name || "our business"} are confirmed:\n\n`;
    
    bookings.forEach((booking, index) => {
      const date = booking.finalDate || booking.date;
      const time = booking.finalTime || booking.time;
      const serviceName = booking.serviceName || booking.service_name || "your service";
      const duration = booking.serviceDuration || booking.duration || "";
      
      message += `${index + 1}. ${serviceName} on ${date} at ${time}`;
      if (duration) {
        message += ` (${duration} mins)`;
      }
      message += `\n`;
    });
    
    message += `\nQuestions? Call ${businessConfig?.business?.phone_number || ""}`;
  }

  // Call the SMS API with the first booking's appointment ID for tracking
  const baseUrl = config.nextjs.siteUrl || "http://localhost:3000";
  const response = await fetch(`${baseUrl}/api/sms/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      businessId,
      customerPhone,
      message,
      type: "confirmation",
      appointmentId: bookings[0]?.appointmentId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Consolidated SMS API error: ${response.status} ${errorText}`);
  }

  console.log("✅ Consolidated SMS sent successfully");
}
