// Razorpay Checkout: Razorpay's own payment window. Loaded once, only when a donor first pays.
// It only ever receives the public key ID and the order the server created; the secret key stays on the server.
const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
const LOAD_TIMEOUT_MS = 15000;

let loading = null;

/** Resolves with window.Razorpay. Rejects if the script can't load; the next call tries again. */
export const loadRazorpayCheckout = () => {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      let timer;
      const fail = () => {
        clearTimeout(timer);
        script.remove();
        loading = null;
        reject(new Error("Razorpay Checkout could not be loaded."));
      };
      timer = setTimeout(fail, LOAD_TIMEOUT_MS);
      script.src = CHECKOUT_SRC;
      script.async = true;
      script.onload = () => {
        clearTimeout(timer);
        if (window.Razorpay) resolve(window.Razorpay);
        else fail();
      };
      script.onerror = fail;
      document.body.appendChild(script);
    });
  }
  return loading;
};
