// Set at build time. The local desktop edition keeps all data on the device and has no accounts,
// credits, billing, or support requests.
export const isLocalEdition = import.meta.env.VITE_CAREERDEN_EDITION === "local";
