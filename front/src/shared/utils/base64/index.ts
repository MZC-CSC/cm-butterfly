/**
 * Encode a string to Base64
 *
 * @param {string} text - The text to encode
 * @returns {string} Base64 encoded string
 * 
 * @example
 * const encoded = encodeBase64('Hello World');
 * console.log(encoded); // 'SGVsbG8gV29ybGQ='
 */
export function encodeBase64(text: string): string {
  try {
    if (!text) {
      return '';
    }
    // Use btoa for browser environment
    return btoa(unescape(encodeURIComponent(text)));
  } catch (error) {
    console.error('Base64 encoding error:', error);
    return text;
  }
}

/**
 * Decode a Base64 string
 *
 * @param {string} encoded - The Base64 encoded string
 * @returns {string} Decoded string
 * 
 * @example
 * const decoded = decodeBase64('SGVsbG8gV29ybGQ=');
 * console.log(decoded); // 'Hello World'
 */
export function decodeBase64(encoded: string): string {
  try {
    if (!encoded) {
      return '';
    }
    // Use atob for browser environment
    return decodeURIComponent(escape(atob(encoded)));
  } catch (error) {
    console.error('Base64 decoding error:', error);
    return encoded;
  }
}
