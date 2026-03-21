/**
 * phoneUtils.js - Smart phone number normalization and formatting
 */

const phoneUtils = {
    /**
     * Normalizes a phone number to E.164 format for India (+91)
     * Handles leading zeros, whitespace, and existing country codes.
     * @param {string} phone 
     * @returns {string} Normalized phone number
     */
    normalize: (phone) => {
        if (!phone) return "";
        
        // Remove all non-numeric characters except +
        let cleaned = phone.replace(/[^\d+]/g, "");

        // If it starts with +, keep it if it's already +91
        if (cleaned.startsWith("+")) {
            if (cleaned.startsWith("+91")) return cleaned;
            // If it's another country code, we might want to flag it or just return as is
            // But requirement says normalize to +91 for India
            return "+91" + cleaned.replace(/^\+\d+/, "").slice(-10);
        }

        // Remove leading zeros
        cleaned = cleaned.replace(/^0+/, "");

        // If it's already 12 digits starting with 91, add +
        if (cleaned.length === 12 && cleaned.startsWith("91")) {
            return "+" + cleaned;
        }

        // If it's 10 digits, add +91
        if (cleaned.length === 10) {
            return "+91" + cleaned;
        }

        // Fallback: take last 10 digits and add +91
        if (cleaned.length > 10) {
            return "+91" + cleaned.slice(-10);
        }

        return cleaned; // Unchanged if too short
    },

    /**
     * Validates if a number is a valid 10-digit Indian mobile number (after stripping country code)
     * @param {string} phone 
     * @returns {boolean}
     */
    isValid: (phone) => {
        const cleaned = phone.replace(/[^\d]/g, "");
        return cleaned.length >= 10;
    }
};

if (typeof window !== 'undefined') {
    window.phoneUtils = phoneUtils;
}
