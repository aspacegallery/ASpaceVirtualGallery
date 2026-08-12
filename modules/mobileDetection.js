/**
 * Mobile Device Detection Utilities
 * Uses combination approach for accurate mobile device detection
 */

/**
 * Detects if the current device is a mobile device (phone or tablet)
 * @returns {boolean} True if mobile device detected
 */
export function isMobileDevice() {
  // Primary check: touch capability
  const hasTouch = ('ontouchstart' in window) || 
                   (navigator.maxTouchPoints > 0) || 
                   (navigator.msMaxTouchPoints > 0);
  
  // Secondary check: user agent for phones/tablets
  const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Tertiary check: screen size (phones typically < 768px, tablets < 1024px)
  const isSmallScreen = window.innerWidth <= 1024;
  
  // Special detection for Chrome DevTools mobile mode
  const isChromeDevTools = window.innerWidth <= 1024 && 
                          /Chrome/i.test(navigator.userAgent) && 
                          !(/Windows NT|Macintosh|Linux x86_64/i.test(navigator.userAgent) && window.innerWidth > 1024);
  
  // Logic: has touch AND is actually a mobile device
  // OR has mobile user agent OR is small screen (to catch Chrome DevTools)
  return (hasTouch && (mobileUA || isSmallScreen)) || (mobileUA && isSmallScreen) || (isSmallScreen && window.innerWidth < 768);
}

/**
 * Detects if the current device is specifically a mobile phone
 * @returns {boolean} True if mobile phone detected
 */
export function isMobilePhone() {
  const phoneUA = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isPhoneSize = window.innerWidth <= 768;
  const hasTouch = ('ontouchstart' in window) || 
                   (navigator.maxTouchPoints > 0) || 
                   (navigator.msMaxTouchPoints > 0);
  
  return hasTouch && phoneUA && isPhoneSize;
}

/**
 * Detects if the current device is specifically a tablet
 * @returns {boolean} True if tablet detected
 */
export function isTablet() {
  const tabletUA = /iPad|Android/i.test(navigator.userAgent);
  const isTabletSize = window.innerWidth > 768 && window.innerWidth <= 1024;
  const hasTouch = ('ontouchstart' in window) || 
                   (navigator.maxTouchPoints > 0) || 
                   (navigator.msMaxTouchPoints > 0);
  
  // Must have touch, match tablet UA or size, but not be phone-sized
  const notPhoneSize = window.innerWidth > 768;
  
  return hasTouch && (tabletUA || isTabletSize) && notPhoneSize;
}

/**
 * Detects iOS devices specifically
 * @returns {boolean} True if iOS device detected
 */
export function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Detects Android devices specifically
 * @returns {boolean} True if Android device detected
 */
export function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

/**
 * Gets device information
 * @returns {Object} Device information object
 */
export function getDeviceInfo() {
  return {
    isMobile: isMobileDevice(),
    isPhone: isMobilePhone(),
    isTablet: isTablet(),
    isIOS: isIOS(),
    isAndroid: isAndroid(),
    hasTouch: ('ontouchstart' in window) || (navigator.maxTouchPoints > 0),
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    userAgent: navigator.userAgent
  };
}

/**
 * Logs device detection information to console (for debugging)
 */
export function logDeviceInfo() {
  const info = getDeviceInfo();
  console.log('=== Device Detection ===');
  console.log('Is Mobile:', info.isMobile);
  console.log('Is Phone:', info.isPhone);
  console.log('Is Tablet:', info.isTablet);
  console.log('Is iOS:', info.isIOS);
  console.log('Is Android:', info.isAndroid);
  console.log('Has Touch:', info.hasTouch);
  console.log('Screen Size:', `${info.screenWidth}x${info.screenHeight}`);
  console.log('User Agent:', info.userAgent);
  console.log('=======================');
}
