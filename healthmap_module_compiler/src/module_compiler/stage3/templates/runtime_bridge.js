// -------------------------
// Runtime Environment Detection
// -------------------------

const RuntimeEnv = {
  isFlutter: typeof window !== "undefined" && !!window.flutter_inappwebview,
  isBrowser: typeof window !== "undefined" && !window.flutter_inappwebview
};


// -------------------------
// Runtime Bridge (Platform Adapter)
// -------------------------

const RuntimeBridge = {

  // -------------------------
  // Exit Module
  // -------------------------
  exit() {
    try {
      if (RuntimeEnv.isFlutter && window.flutter_inappwebview?.callHandler) {
        window.flutter_inappwebview.callHandler("exitModule");
      } else {
        // Browser fallback
        if (window.history.length > 1) {
          window.history.back();
        } else {
          console.log("No history — staying on page");
        }
      }
    } catch (err) {
      console.error("Exit failed:", err);
    }
  },


  // -------------------------
  // Open PDF Resource
  // -------------------------
  openPdf(url) {
    try {
      if (RuntimeEnv.isFlutter && window.flutter_inappwebview?.callHandler) {
        window.flutter_inappwebview.callHandler("openPdf", url);
      } else {
        // Browser fallback
        window.open(url, "_blank", "noopener");
      }
    } catch (err) {
      console.error("PDF open failed:", err);
    }
  },


  // -------------------------
  // Debug Helper (optional)
  // -------------------------
  logEnv() {
    console.log("Runtime Environment:", {
      isFlutter: RuntimeEnv.isFlutter,
      isBrowser: RuntimeEnv.isBrowser,
      protocol: window.location?.protocol
    });
  }
};