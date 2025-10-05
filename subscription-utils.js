import { supabase } from "./database.js";

/**
 * Calculate minutes from call duration in seconds (rounds up to nearest minute)
 */
export function calculateMinutesFromDuration(durationSeconds) {
  if (!durationSeconds || durationSeconds <= 0) return 0;
  return Math.ceil(durationSeconds / 60);
}

/**
 * Check if a business can make calls based on subscription status and minutes remaining
 */
export async function canMakeCall(businessId) {
  try {
    // Get business details including subscription info
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select(`
        id,
        subscription_id,
        minutes_allowed,
        minutes_used
      `)
      .eq('id', businessId)
      .single();

    if (businessError || !business) {
      console.error('Error fetching business:', businessError);
      return {
        allowed: false,
        reason: 'Business not found'
      };
    }

    // If no subscription, check if they have any free minutes
    if (!business.subscription_id) {
      const minutesUsed = business.minutes_used || 0;
      const minutesAllowed = business.minutes_allowed || 0;
      
      if (minutesUsed >= minutesAllowed) {
        return {
          allowed: false,
          reason: 'No active subscription and free minutes exhausted'
        };
      }
      
      return {
        allowed: true,
        reason: 'Using free minutes',
        minutesRemaining: minutesAllowed - minutesUsed
      };
    }

    // Get subscription details
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('status, monthly_minutes_included, monthly_minutes_used')
      .eq('id', business.subscription_id)
      .single();

    if (subscriptionError || !subscription) {
      console.error('Error fetching subscription:', subscriptionError);
      return {
        allowed: false,
        reason: 'Subscription not found'
      };
    }

    // Check if subscription is active
    if (subscription.status !== 'active') {
      return {
        allowed: false,
        reason: `Subscription is ${subscription.status}`
      };
    }

    // Check if monthly minutes are available
    const minutesUsed = subscription.monthly_minutes_used || 0;
    const minutesIncluded = subscription.monthly_minutes_included || 0;
    
    if (minutesUsed >= minutesIncluded) {
      return {
        allowed: false,
        reason: 'Monthly minutes limit exceeded'
      };
    }

    return {
      allowed: true,
      reason: 'Active subscription with available minutes',
      minutesRemaining: minutesIncluded - minutesUsed
    };

  } catch (error) {
    console.error('Error checking subscription status:', error);
    return {
      allowed: false,
      reason: 'Subscription check failed'
    };
  }
}

/**
 * Update minutes usage for a business after a call
 */
export async function updateMinutesUsage(businessId, minutesUsed) {
  try {
    // Get current minutes_used
    const { data: business } = await supabase
      .from('businesses')
      .select('minutes_used')
      .eq('id', businessId)
      .single();

    if (business) {
      const newMinutesUsed = (business.minutes_used || 0) + minutesUsed;
      
      // Update the business minutes_used counter
      await supabase
        .from('businesses')
        .update({ minutes_used: newMinutesUsed })
        .eq('id', businessId);
    }
  } catch (error) {
    console.error('Error updating minutes usage:', error);
    throw error;
  }
}

/**
 * Log subscription usage for tracking and billing
 */
export async function logSubscriptionUsage(subscriptionId, businessId, callLogId, minutesUsed) {
  try {
    // Log the usage in subscription_usage table
    await supabase
      .from('subscription_usage')
      .insert({
        subscription_id: subscriptionId,
        business_id: businessId,
        call_log_id: callLogId,
        minutes_used: minutesUsed,
        usage_date: new Date().toISOString().split('T')[0],
        usage_month: new Date().getMonth() + 1,
        usage_year: new Date().getFullYear(),
      });

    console.log(`📊 Logged subscription usage: ${minutesUsed} minutes for business ${businessId}`);
  } catch (error) {
    console.error('Error logging subscription usage:', error);
    throw error;
  }
}