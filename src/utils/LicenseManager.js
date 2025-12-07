/**
 * License Manager Module
 * Handles license validation, activation, and management
 */

class LicenseManager {
  constructor() {
    this.WHOP_API_URL = 'https://api.whop.com';
    this.API_KEY = atob('YmZWUzcyeV9uLXc0U2NMaXR4TTlqWUxDZVJ6cEg3WlR3emljUXhuZnNvNA==');
    this.isLicenseValid = true; // INTERNAL BUILD: Always valid
  }

  /**
   * Obfuscate a license key for storage
   * @param {string} key - The plain license key
   * @returns {string} Obfuscated license key
   */
  obfuscateLicenseKey(key) {
    const base64 = btoa(key);
    const parts = base64.match(/.{1,4}/g) || [];
    return parts.reverse().join('_');
  }

  /**
   * Deobfuscate a license key for use
   * @param {string} obfuscatedKey - The obfuscated license key
   * @returns {string} Plain license key
   */
  deobfuscateLicenseKey(obfuscatedKey) {
    const parts = obfuscatedKey.split('_');
    const base64 = parts.reverse().join('');
    return atob(base64);
  }

  /**
   * Validate and activate a license
   * @param {string} obfuscatedLicenseKey - The obfuscated license key
   * @returns {Promise<Object>} Validation result
   */
  async validateAndActivateLicense(obfuscatedLicenseKey) {
    console.log('🔐 Starting license validation and activation process');

    try {
      // Validate input
      if (!obfuscatedLicenseKey || typeof obfuscatedLicenseKey !== 'string') {
        throw new Error('License key is required and must be a string');
      }

      // Deobfuscate the license key
      let licenseKey;
      try {
        licenseKey = this.deobfuscateLicenseKey(obfuscatedLicenseKey);
        if (!licenseKey) {
          throw new Error('Failed to deobfuscate license key');
        }
      } catch (deobfuscateError) {
        console.error('❌ License key deobfuscation failed:', deobfuscateError);
        return { isValid: false, errorMessage: 'Invalid license key format' };
      }

      const url = `${this.WHOP_API_URL}/v5/company/memberships/${licenseKey}`;
      console.log('📡 Contacting license server for validation...');

      // Step 1: Check if license exists and get membership details
      let getMembershipResponse;
      try {
        getMembershipResponse = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
      } catch (networkError) {
        console.error('❌ Network error during license check:', networkError);
        return { isValid: false, errorMessage: 'Network error: unable to connect to license server' };
      }

      console.log('📡 License server response status:', getMembershipResponse.status);

      if (!getMembershipResponse.ok) {
        const errorText = await getMembershipResponse.text();
        console.error('❌ License server error:', errorText);

        if (getMembershipResponse.status === 404) {
          return { isValid: false, errorMessage: 'License key not found or invalid' };
        } else if (getMembershipResponse.status === 401) {
          return { isValid: false, errorMessage: 'License server authentication failed' };
        } else {
          return { isValid: false, errorMessage: `License server error: ${getMembershipResponse.status}` };
        }
      }

      let membershipData;
      try {
        membershipData = await getMembershipResponse.json();
      } catch (parseError) {
        console.error('❌ Failed to parse license server response:', parseError);
        return { isValid: false, errorMessage: 'Invalid response from license server' };
      }

      // Check if license is already in use
      if (membershipData.metadata && membershipData.metadata.in_use) {
        console.warn('⚠️ License is already in use');
        return { isValid: false, errorMessage: 'This license is already in use on another device' };
      }

      // Step 2: Activate the license by marking it as in use
      console.log('✅ License validated, activating...');

      let updateResponse;
      try {
        updateResponse = await fetch(url, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${this.API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            metadata: { in_use: true }
          })
        });
      } catch (networkError) {
        console.error('❌ Network error during license activation:', networkError);
        return { isValid: false, errorMessage: 'Network error during license activation' };
      }

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error('❌ License activation failed:', errorText);

        if (updateResponse.status === 409) {
          return { isValid: false, errorMessage: 'License was activated by another device during validation' };
        } else {
          return { isValid: false, errorMessage: `License activation failed: ${updateResponse.status}` };
        }
      }

      let updatedMembershipData;
      try {
        updatedMembershipData = await updateResponse.json();
      } catch (parseError) {
        console.error('❌ Failed to parse activation response:', parseError);
        return { isValid: false, errorMessage: 'Invalid activation response from server' };
      }

      console.log('✅ License successfully validated and activated');
      this.isLicenseValid = true;

      return { isValid: true, data: updatedMembershipData };

    } catch (error) {
      console.error('❌ Unexpected error during license validation:', error);
      return { isValid: false, errorMessage: 'An unexpected error occurred during license validation' };
    }
  }

  /**
   * Reset a license (mark as not in use)
   * @param {string} obfuscatedLicenseKey - The obfuscated license key
   * @returns {Promise<Object>} Reset result
   */
  async resetLicense(obfuscatedLicenseKey) {
    console.log('🔄 Starting license reset process');

    try {
      // Validate input
      if (!obfuscatedLicenseKey || typeof obfuscatedLicenseKey !== 'string') {
        throw new Error('License key is required and must be a string');
      }

      // Deobfuscate the license key
      let licenseKey;
      try {
        licenseKey = this.deobfuscateLicenseKey(obfuscatedLicenseKey);
        if (!licenseKey) {
          throw new Error('Failed to deobfuscate license key');
        }
      } catch (deobfuscateError) {
        console.error('❌ License key deobfuscation failed:', deobfuscateError);
        return { success: false, errorMessage: 'Invalid license key format' };
      }

      const url = `${this.WHOP_API_URL}/v5/company/memberships/${licenseKey}`;
      console.log('📡 Contacting license server to reset license...');

      let resetResponse;
      try {
        resetResponse = await fetch(url, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${this.API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            metadata: { in_use: false }
          })
        });
      } catch (networkError) {
        console.error('❌ Network error during license reset:', networkError);
        return { success: false, errorMessage: 'Network error: unable to connect to license server' };
      }

      console.log('📡 License reset response status:', resetResponse.status);

      if (!resetResponse.ok) {
        const errorText = await resetResponse.text();
        console.error('❌ License reset failed:', errorText);

        if (resetResponse.status === 404) {
          return { success: false, errorMessage: 'License key not found' };
        } else if (resetResponse.status === 401) {
          return { success: false, errorMessage: 'License server authentication failed' };
        } else {
          return { success: false, errorMessage: `License reset failed: ${resetResponse.status}` };
        }
      }

      let updatedMembershipData;
      try {
        updatedMembershipData = await resetResponse.json();
      } catch (parseError) {
        console.error('❌ Failed to parse license reset response:', parseError);
        return { success: false, errorMessage: 'Invalid response from license server' };
      }

      console.log('✅ License successfully reset');
      this.isLicenseValid = false; // Mark as invalid after reset

      return { success: true, data: updatedMembershipData };

    } catch (error) {
      console.error('❌ Unexpected error during license reset:', error);
      return { success: false, errorMessage: 'An unexpected error occurred during license reset' };
    }
  }

  /**
   * Schedule periodic license checks
   */
  schedulePeriodicLicenseCheck() {
    console.log('⏰ Scheduling periodic license checks (every 24 hours)');

    setInterval(async () => {
      try {
        console.log('🔍 Performing scheduled license check...');

        // Get stored license key
        const data = await new Promise((resolve, reject) => {
          chrome.storage.sync.get('licenseKey', (result) => {
            if (chrome.runtime.lastError) {
              reject(new Error(`Storage error: ${chrome.runtime.lastError.message}`));
            } else {
              resolve(result);
            }
          });
        });

        if (!data.licenseKey) {
          console.log('ℹ️ No license key found in storage');
          this.isLicenseValid = false;
          return;
        }

        // Validate the license
        const result = await this.validateAndActivateLicense(data.licenseKey);

        if (!result.isValid) {
          console.warn('⚠️ License validation failed during periodic check, removing invalid license');

          // Remove invalid license from storage
          await new Promise((resolve, reject) => {
            chrome.storage.sync.remove('licenseKey', () => {
              if (chrome.runtime.lastError) {
                reject(new Error(`Failed to remove license: ${chrome.runtime.lastError.message}`));
              } else {
                resolve();
              }
            });
          });

          // Notify extension that license is invalid
          try {
            await chrome.runtime.sendMessage({ action: "licenseInvalid" });
          } catch (messageError) {
            console.warn('⚠️ Failed to send license invalid message:', messageError);
          }

          this.isLicenseValid = false;
        } else {
          console.log('✅ License validation successful during periodic check');
          this.isLicenseValid = true;
        }

      } catch (error) {
        console.error('❌ Error during periodic license check:', error);
        // Don't set license as invalid on temporary network errors
        // Only mark as invalid on actual license validation failures
      }
    }, 1000 * 60 * 60 * 24); // Check every 24 hours
  }

  /**
   * Check if license is currently valid
   * @returns {boolean} License validity status
   */
  isValid() {
    return this.isLicenseValid;
  }
}

// Create global instance for background script access
const licenseManager = new LicenseManager();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LicenseManager;
}

// Make available globally for background script
if (typeof self !== 'undefined') {
  self.licenseManager = licenseManager;
}