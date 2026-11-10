// Written by Express from the connection address, never accepted from the browser.
export const AUTH_IP_HEADER = "x-ngc-client-ip";
export const authRateLimit = {
  enabled: true,
  storage: "memory" as const,
  window: 10,
  max: 100,
  customRules: {
    "/sign-in/email": { window: 60, max: 5 },
    "/sign-up/email": { window: 60, max: 5 },
    "/sign-out": { window: 60, max: 20 },
  },
};
