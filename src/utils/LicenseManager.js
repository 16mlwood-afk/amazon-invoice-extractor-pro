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
    const licenseKey = this.deobfuscateLicenseKey(obfuscatedLicenseKey);
    const url = `${this.WHOP_API_URL}/v5/company/memberships/${licenseKey}`;
    console.log('Attempting to validate license');

    try {
      const getMembershipResponse = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('Response status:', getMembershipResponse.status);

      if (!getMembershipResponse.ok) {
        const errorText = await getMembershipResponse.text();
        console.error('Fout bij het ophalen van membership:', errorText);
        return { isValid: false, errorMessage: 'Ongeldige licentie' };
      }

      const membershipData = await getMembershipResponse.json();

      if (membershipData.metadata && membershipData.metadata.in_use) {
        return { isValid: false, errorMessage: 'Deze licentie is al in gebruik' };
      }

      const updateResponse = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          metadata: { in_use: true }
        })
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error('Fout bij het updaten van membership:', errorText);
        return { isValid: false, errorMessage: 'Fout bij het activeren van de licentie' };
      }

      const updatedMembershipData = await updateResponse.json();

      return { isValid: true, data: updatedMembershipData };
    } catch (error) {
      console.error('Fout bij licentievalidatie:', error);
      return { isValid: false, errorMessage: 'Er is een onverwachte fout opgetreden' };
    }
  }

  /**
   * Reset a license (mark as not in use)
   * @param {string} obfuscatedLicenseKey - The obfuscated license key
   * @returns {Promise<Object>} Reset result
   */
  async resetLicense(obfuscatedLicenseKey) {
    const licenseKey = this.deobfuscateLicenseKey(obfuscatedLicenseKey);
    const url = `${this.WHOP_API_URL}/v5/company/memberships/${licenseKey}`;
    console.log('Attempting to reset license');

    try {
      const resetResponse = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          metadata: { in_use: false }
        })
      });

      if (!resetResponse.ok) {
        const errorText = await resetResponse.text();
        console.error('Fout bij het resetten van de licentie:', errorText);
        return { success: false, errorMessage: 'Fout bij het resetten van de licentie' };
      }

      const updatedMembershipData = await resetResponse.json();

      return { success: true, data: updatedMembershipData };
    } catch (error) {
      console.error('Fout bij het resetten van de licentie:', error);
      return { success: false, errorMessage: 'Er is een onverwachte fout opgetreden bij het resetten van de licentie' };
    }
  }

  /**
   * Schedule periodic license checks
   */
  schedulePeriodicLicenseCheck() {
    setInterval(() => {
      chrome.storage.sync.get('licenseKey', (data) => {
        if (data.licenseKey) {
          this.validateAndActivateLicense(data.licenseKey)
            .then(result => {
              if (!result.isValid) {
                chrome.storage.sync.remove('licenseKey', () => {
                  if (chrome.runtime.lastError) {
                    console.error('Fout bij het verwijderen van de licentiesleutel:', chrome.runtime.lastError);
                  }
                  chrome.runtime.sendMessage({action: "licenseInvalid"});
                });
              } else {
                this.isLicenseValid = true;
              }
            })
            .catch(error => {
              console.error('License check failed:', error);
            });
        }
      });
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

// Export for use in background script
const licenseManager = new LicenseManager();

// Make globally available
self.licenseManager = licenseManager;