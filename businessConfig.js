import { supabase } from "./database.js";

/**
 * Load complete business configuration including business details, config, and services
 * @param {string} businessId - The business ID to load configuration for
 * @returns {Object|null} Business configuration object or null if failed
 */
export async function loadBusinessConfig(businessId) {
  try {
    // Load business details
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .single();

    if (businessError || !business) {
      console.error("Failed to load business:", businessError);
      return null;
    }

    // Load business configuration
    const { data: config } = await supabase
      .from("business_config")
      .select("*")
      .eq("business_id", businessId)
      .single();

    // Load active services
    const { data: services } = await supabase
      .from("services")
      .select("*")
      .eq("business_id", businessId)
      .eq("is_active", true);

    // Load active staff members
    const { data: staffMembers } = await supabase
      .from("staff_members")
      .select("*")
      .eq("business_id", businessId)
      .eq("is_active", true);

    // Parse payment methods from business data
    let paymentMethods = [];
    if (business.payment_methods) {
      try {
        // If payment_methods is a string (JSON), parse it
        if (typeof business.payment_methods === 'string') {
          paymentMethods = JSON.parse(business.payment_methods);
        } else if (Array.isArray(business.payment_methods)) {
          // If it's already an array, use it directly
          paymentMethods = business.payment_methods;
        }
      } catch (error) {
        console.error("Error parsing payment_methods:", error);
        paymentMethods = [];
      }
    }

    // Log Google Calendar connection status for debugging
    logGoogleCalendarStatus(business, config);

    return {
      business,
      config: config || null,
      services: services || [],
      staffMembers: staffMembers || [],
      paymentMethods: paymentMethods,
    };
  } catch (error) {
    console.error("Error loading business config:", error);
    return null;
  }
}

/**
 * Check if Google Calendar is properly connected for a business
 * @param {Object} businessConfig - Complete business configuration object
 * @returns {boolean} True if Google Calendar is connected and configured
 */
export function isGoogleCalendarConnected(businessConfig) {
  const business = businessConfig?.business;
  const config = businessConfig?.config;
  
  // Must have calendar ID in business table
  if (!business?.google_calendar_id) {
    return false;
  }
  
  // Must have valid Google tokens in integration settings
  let integrationSettings;
  if (config?.integration_settings) {
    if (typeof config.integration_settings === 'string') {
      try {
        integrationSettings = JSON.parse(config.integration_settings);
      } catch (e) {
        return false;
      }
    } else {
      integrationSettings = config.integration_settings;
    }
  }
  
  const hasGoogleTokens = !!(integrationSettings && 
    typeof integrationSettings === 'object' && 
    integrationSettings !== null &&
    'google' in integrationSettings &&
    typeof integrationSettings.google === 'object' &&
    integrationSettings.google !== null &&
    'access_token' in integrationSettings.google);
    
  return !!(business.google_calendar_id && hasGoogleTokens);
}

/**
 * Log Google Calendar connection status for debugging purposes
 * @param {Object} business - Business object
 * @param {Object} config - Business configuration object
 */
function logGoogleCalendarStatus(business, config) {
  console.log(`📅 Business ${business.name} Google Calendar Status:`);
  console.log(
    `   - Calendar ID: ${business.google_calendar_id || "Not connected"}`
  );
  console.log(`   - Timezone: ${business.timezone || "Not set"}`);
  console.log(
    `   - Integration Config: ${
      config?.integration_settings?.google ? "Available" : "Not available"
    }`
  );
}

// Removed unused utility functions
