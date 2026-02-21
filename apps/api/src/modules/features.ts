/**
 * This provides a way to toggle features on and off.
 */
export const config = {
  slack: {
    enabled: !!process.env.SLACK_TOKEN,
  },
  posthog: {
    enabled: true,
  },
  resend: {
    enabled: true,
  },
};
