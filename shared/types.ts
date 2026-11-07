export interface CountryRegion {
  /** State, province or union territory name */
  name: string;
  /** e.g. "State" or "Union Territory" */
  type: string;
  /** Second-level areas (districts / counties) */
  districts: string[];
}

export interface CountryConfig {
  /** ISO 3166-1 alpha-2 code, e.g. "IN" */
  code: string;
  name: string;
  /** Only enabled countries appear in dropdowns and are accepted by the API */
  enabled: boolean;
  /** International dialling prefix, e.g. "+91" */
  dialCode: string;
  /** Regular expression (as a string) for the national mobile number, digits only */
  phonePattern: string;
  phoneExample: string;
  phoneHint: string;
  postalCodeLabel: string;
  postalCodePattern: string;
  postalCodeExample: string;
  regionLabel: string;
  districtLabel: string;
  cityLabel: string;
  /** Locale used to format dates and numbers, e.g. "en-IN" */
  locale: string;
  /** Data-protection law named in privacy and consent text */
  privacyLaw: string;
  /** Helplines are configured per deployment; empty means "not set" and the UI hides them */
  supportHelpline: string;
  emergencyLine: string;
  /** Public emergency number of the country (police / ambulance), shown when no helpline is set */
  nationalEmergencyNumber: string;
  regions: CountryRegion[];
}
