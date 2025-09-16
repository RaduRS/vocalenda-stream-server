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
  formatConversationalDate,
  formatConversationalTime,
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
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🚀 STARTING handleFunctionCall`);
  console.log(
    `[${timestamp}] 🔧 Function call received:`,
    JSON.stringify(functionCallData, null, 2)
  );
  console.log(
    `[${timestamp}] 📋 Function name:`,
    functionCallData?.function_name
  );
  console.log(
    `[${timestamp}] 📊 Parameters:`,
    JSON.stringify(functionCallData?.parameters, null, 2)
  );
  console.log(`[${timestamp}] 🏢 Business config exists:`, !!businessConfig);
  console.log(`[${timestamp}] 🌐 WebSocket state:`, deepgramWs?.readyState);

  try {
    console.log(
      "🔧 Function call received:",
      JSON.stringify(functionCallData, null, 2)
    );
    const { function_name, parameters, function_call_id } = functionCallData;

    // Check for duplicate create_booking requests
    if (function_name === "create_booking" && function_call_id) {
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
    }

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
        result = await getAvailableSlots(businessConfig, parameters, callSid);
        break;

      case "create_booking":
        result = await createBooking(businessConfig, parameters, callSid);
        break;

      case "update_booking":
        result = await updateBooking(businessConfig, parameters, callSid);
        break;

      case "cancel_booking":
        result = await cancelBooking(businessConfig, parameters, callSid);
        break;

      case "end_call":
        result = await endCall(callSid, parameters, businessConfig);
        break;

      case "get_day_of_week":
        try {
          console.log("📅 Getting day of week for:", parameters.date);
          const parsedDate = parseUKDate(parameters.date);
          const dayName = getDayOfWeekName(parsedDate);
          const dayNumber = getDayOfWeekNumber(parsedDate);

          console.log(`✅ ${parameters.date} is a ${dayName}`);
          result = {
            date: parameters.date,
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
          result = {
            error: "Invalid date format. Please use DD/MM/YYYY format.",
          };
        }
        break;

      case "transfer_to_human":
        result = await transferToHuman(businessConfig, parameters, callSid);
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
      name: function_name,
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
  const timestamp = new Date().toISOString();
  console.log(
    `[${timestamp}] 🚀 STARTING getAvailableSlots with params:`,
    JSON.stringify(params, null, 2)
  );
  console.log(
    `[${timestamp}] 🏢 Business config:`,
    businessConfig?.business?.name
  );
  console.log(
    `[${timestamp}] 📋 Services count:`,
    businessConfig?.services?.length
  );
  console.log(
    `[${timestamp}] 🌐 Site URL:`,
    config.nextjs?.siteUrl || "Not configured"
  );
  console.log(
    `[${timestamp}] 🔑 Secret exists:`,
    !!config.nextjs?.internalApiSecret
  );

  try {
    console.log(
      "🗓️ Getting available slots for:",
      JSON.stringify(params, null, 2)
    );
    const { date, service_id } = params;
    const business = businessConfig.business;

    if (!business?.google_calendar_id) {
      console.error("❌ No Google Calendar connected for business");
      return { error: "Calendar not connected" };
    }

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
    const apiUrl = `${config.nextjs.siteUrl}/api/calendar/availability?businessId=${business.id}&serviceId=${serviceId}&date=${date}`;

    console.log(`[${timestamp}] 🌐 About to make API call:`);
    console.log(`[${timestamp}] 🔗 API URL:`, apiUrl);
    console.log(
      `[${timestamp}] 🔑 Secret exists:`,
      !!config.nextjs?.internalApiSecret
    );
    console.log(`[${timestamp}] 🏢 Business ID:`, business.id);
    console.log(`[${timestamp}] 📋 Service ID:`, serviceId);
    console.log(`[${timestamp}] 📅 Date:`, date);

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "x-internal-secret": config.nextjs.internalApiSecret,
      },
    });

    console.log(`[${timestamp}] 📡 API Response status:`, response.status);
    console.log(`[${timestamp}] 📡 API Response ok:`, response.ok);

    const result = await response.json();
    console.log(
      `[${timestamp}] 📅 Calendar API response:`,
      JSON.stringify(result, null, 2)
    );
    console.log(`[${timestamp}] 📊 Response type:`, typeof result);
    console.log(`[${timestamp}] 📊 Has slots:`, !!result.slots);
    console.log(`[${timestamp}] 📊 Slots count:`, result.slots?.length || 0);

    if (!response.ok) {
      console.error("❌ Calendar API error:", result);
      return { error: result.error || "Failed to get available slots" };
    }

    // Extract just the time strings from the slots
    const availableTimes = result.slots?.map((slot) => slot.startTime) || [];
    console.log("✅ Available time slots:", availableTimes);

    // Store the checked date in session for context awareness
    if (callSid && date) {
      const session = getCallSession(callSid);
      setCallSession(callSid, {
        ...session,
        lastCheckedDate: date,
        lastCheckedTimestamp: new Date().toISOString()
      });
      console.log(`📅 Stored checked date in session: ${date}`);
    }

    return {
      available_slots: availableTimes,
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
    console.log(
      "🎯 createBooking called with params:",
      JSON.stringify(params, null, 2)
    );
    console.log(
      "📋 Available services:",
      businessConfig.services.map((s) => ({ id: s.id, name: s.name }))
    );

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
    let parsedDate, parsedTime;
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
      parsedTime = parseUKTime(timeIn24h, parsedDate);

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
    console.log(
      "📝 updateBooking called with params:",
      JSON.stringify(params, null, 2)
    );

    const {
      customer_name,
      current_date,
      current_time,
      new_date,
      new_time,
      new_service_id,
    } = params;

    // Get session data to fill in missing customer information
    const session = getCallSession(callSid);
    console.log("📋 Session data:", session);

    // Use session data as fallback for missing information
    const customerNameToUse = customer_name || session.customerName;
    
    // Improved logic to identify which appointment to update
    let currentDateToUse = current_date;
    let currentTimeToUse = current_time;
    
    // If no specific date/time provided, try to infer from context
    if (!currentDateToUse || !currentTimeToUse) {
      const bookings = session.bookings || [];
      
      // Look for the most recent 'create' booking that matches the context
      // If new_service_id is provided, try to find a booking with that service
      let targetBooking = null;
      
      if (new_service_id) {
        // Find booking with matching service
        targetBooking = bookings.reverse().find(b => 
          b.type === 'create' && 
          b.serviceId === new_service_id && 
          b.appointmentId
        );
      }
      
      // If no service match or no service specified, use the most recent create booking
      if (!targetBooking) {
        targetBooking = bookings.reverse().find(b => 
          b.type === 'create' && 
          b.appointmentId
        );
      }
      
      if (targetBooking) {
        currentDateToUse = currentDateToUse || targetBooking.date;
        currentTimeToUse = currentTimeToUse || targetBooking.time;
        console.log("🎯 Identified target booking:", {
          appointmentId: targetBooking.appointmentId,
          service: targetBooking.serviceName,
          date: targetBooking.date,
          time: targetBooking.time
        });
      } else {
        // Fallback to session data (old behavior)
        currentDateToUse = currentDateToUse || session.lastBookingDate;
        currentTimeToUse = currentTimeToUse || session.lastBookingTime;
        console.log("⚠️ Using fallback session data - this may update the wrong appointment");
      }
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

    const business = businessConfig.business;

    if (!business?.google_calendar_id) {
      console.error("❌ No Google Calendar connected for business");
      return { error: "Calendar not connected" };
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
      current_date: currentDateToUse,
      current_time: currentTimeToUse,
      caller_phone: callerPhone,
      sessionId: callSid, // Pass session ID for filler phrase generation
    };

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
          "X-Internal-Secret": config.nextjs.internalApiSecret,
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
          lastBooking.finalDate = result.booking.date;
          lastBooking.finalTime = result.booking.start_time;
          lastBooking.appointmentId = result.booking.id;
          lastBooking.serviceName = result.booking.service_name;
        }
      }
      
      setCallSession(callSid, { bookings: bookings });
    }

    return {
      success: true,
      message: `Booking updated successfully for ${customer_name}`,
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
    console.log(
      "❌ cancelBooking called with params:",
      JSON.stringify(params, null, 2)
    );

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
          "X-Internal-Secret": config.nextjs.internalApiSecret,
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
            }
          }
          
          if (finalBooking && finalBooking.appointmentId) {
            finalBookings.push(finalBooking);
          }
        }
        
        if (finalBookings.length > 0) {
          console.log(
            "📱 Sending consolidated SMS confirmation for bookings:",
            finalBookings.map(b => b.appointmentId)
          );
          
          await sendConsolidatedSMSConfirmation(
            {
              businessId: businessConfig.business.id,
              customerPhone: session.callerPhone,
              customerName: session.customerName,
              bookings: finalBookings,
            },
            businessConfig
          );
          console.log("✅ Consolidated SMS confirmation sent successfully");
        }
      } catch (smsError) {
        console.error("❌ Failed to send consolidated SMS confirmation:", smsError);
        // Don't fail the call ending if SMS fails
      }
    } else if (session.bookingCancelled) {
      console.log("🚫 Skipping SMS confirmation - booking was cancelled in this call");
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

    // Clear call session when call ends
    clearCallSession(callSid);

    return {
      success: true,
      message: `Call ended: ${reason}`,
      callSid: callSid,
      status: call.status,
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
 * Send SMS confirmation for appointment booking
 * @param {Object} params - SMS parameters
 * @returns {Promise<void>}
 */
async function sendSMSConfirmation(params, businessConfig) {
  const {
    businessId,
    customerPhone,
    appointmentId,
    customerName,
    appointmentDate,
    appointmentTime,
    serviceName,
    serviceDuration,
  } = params;

  // Get custom SMS template from business config or use default
  const template =
    businessConfig?.sms_configuration?.confirmation_message ||
    `Hi {customer_name}, your appointment at {business_name} is confirmed for {date} at {time} for {service_name}. Duration: {duration} mins. Questions? Call {business_phone}`;

  // Replace template variables with actual values
  const message = template
    .replace(/{customer_name}/g, customerName)
    .replace(
      /{business_name}/g,
      businessConfig?.business?.name || "our business"
    )
    .replace(/{date}/g, appointmentDate)
    .replace(/{time}/g, appointmentTime)
    .replace(/{service_name}/g, serviceName)
    .replace(/{duration}/g, serviceDuration ? `${serviceDuration} minutes` : "")
    .replace(/{business_phone}/g, businessConfig?.business?.phone || "");

  // Call the SMS API
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
      appointmentId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SMS API error: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  console.log("📱 SMS confirmation result:", result);
}

/**
 * Send consolidated SMS confirmation for multiple bookings
 * @param {Object} params - SMS parameters
 * @param {Object} businessConfig - Business configuration
 * @returns {Promise<void>}
 */
async function sendConsolidatedSMSConfirmation(params, businessConfig) {
  const { businessId, customerPhone, customerName, bookings } = params;

  // Get the template from dashboard configuration
  const template = businessConfig?.sms_configuration?.confirmation_message ||
    `Hi {customer_name}, your appointment at {business_name} is confirmed for {date} at {time} for {service_name}. Duration: {duration} mins. Questions? Call {business_phone}`;

  // For multiple bookings, create a consolidated message using the template structure
  let message;
  
  if (bookings.length === 1) {
    // Single booking - use template directly
    const booking = bookings[0];
    const date = booking.finalDate || booking.date;
    const time = booking.finalTime || booking.time;
    const serviceName = booking.serviceName || booking.service_name || "your service";
    const duration = booking.serviceDuration || booking.duration || "";
    
    message = template
      .replace(/{customer_name}/g, customerName)
      .replace(/{business_name}/g, businessConfig?.business?.name || "our business")
      .replace(/{date}/g, date)
      .replace(/{time}/g, time)
      .replace(/{service_name}/g, serviceName)
      .replace(/{duration}/g, duration)
      .replace(/{business_phone}/g, businessConfig?.business?.phone || "");
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
    
    message += `\nQuestions? Call ${businessConfig?.business?.phone || ""}`;
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
