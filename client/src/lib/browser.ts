/**
 * Detects if the current browser is an in-app WebView (e.g. Facebook, Instagram,
 * Messenger, TikTok, Twitter/X, LinkedIn, Snapchat, WeChat).
 * Google blocks OAuth sign-in from these embedded browsers (Error 403: disallowed_useragent).
 */
export function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";

  return (
    // Facebook / Messenger
    /FBAN|FBAV|FB_IAB|FB4A|FBIOS|MessengerForiOS|MessengerForAndroid/i.test(ua) ||
    // Instagram
    /Instagram/i.test(ua) ||
    // TikTok
    /musical_ly|TikTok/i.test(ua) ||
    // Twitter / X
    /Twitter/i.test(ua) ||
    // LinkedIn
    /LinkedInApp/i.test(ua) ||
    // Snapchat
    /Snapchat/i.test(ua) ||
    // WeChat
    /MicroMessenger/i.test(ua) ||
    // Generic WebView markers
    /wv\)/i.test(ua) ||
    (/Android/i.test(ua) && /Version\/\d+\.\d+/i.test(ua) && /Chrome\/\d+/i.test(ua) && !/SamsungBrowser/i.test(ua) && /wv/i.test(ua))
  );
}

/**
 * Returns the name of the detected in-app browser for user-facing messages.
 */
export function getInAppBrowserName(): string {
  if (typeof navigator === "undefined") return "this app";
  const ua = navigator.userAgent || "";
  if (/FBAN|FBAV|FB_IAB|FB4A|FBIOS/i.test(ua)) return "Facebook";
  if (/MessengerForiOS|MessengerForAndroid/i.test(ua)) return "Messenger";
  if (/Instagram/i.test(ua)) return "Instagram";
  if (/TikTok|musical_ly/i.test(ua)) return "TikTok";
  if (/Twitter/i.test(ua)) return "X (Twitter)";
  if (/LinkedInApp/i.test(ua)) return "LinkedIn";
  if (/Snapchat/i.test(ua)) return "Snapchat";
  if (/MicroMessenger/i.test(ua)) return "WeChat";
  return "this app";
}

/**
 * Safely navigate to the login URL.
 * If inside an in-app browser, opens in the system browser instead.
 */
export function navigateToLogin(loginUrl: string): void {
  if (isInAppBrowser()) {
    // Force open in system browser — in-app browsers block Google OAuth
    window.open(loginUrl, "_system") || window.open(loginUrl, "_blank");
  } else {
    window.location.href = loginUrl;
  }
}
