export type CallingCode = {
  iso: string;
  name: string;
  dialCode: string;
};

export const callingCodes: CallingCode[] = [
  { iso: "JO", name: "Jordan", dialCode: "+962" },
  { iso: "PS", name: "Palestine", dialCode: "+970" },
  { iso: "SA", name: "Saudi Arabia", dialCode: "+966" },
  { iso: "AE", name: "United Arab Emirates", dialCode: "+971" },
  { iso: "QA", name: "Qatar", dialCode: "+974" },
  { iso: "KW", name: "Kuwait", dialCode: "+965" },
  { iso: "BH", name: "Bahrain", dialCode: "+973" },
  { iso: "OM", name: "Oman", dialCode: "+968" },
  { iso: "IQ", name: "Iraq", dialCode: "+964" },
  { iso: "LB", name: "Lebanon", dialCode: "+961" },
  { iso: "SY", name: "Syria", dialCode: "+963" },
  { iso: "EG", name: "Egypt", dialCode: "+20" },
  { iso: "TR", name: "Turkey", dialCode: "+90" },
  { iso: "GB", name: "United Kingdom", dialCode: "+44" },
  { iso: "US", name: "United States", dialCode: "+1" },
];

const e164Pattern = /^\+[1-9]\d{7,14}$/;

export function normalizeMobile(dialCode: string, input: string) {
  const allowedDialCode = callingCodes.find((country) => country.dialCode === dialCode)?.dialCode;
  if (!allowedDialCode) throw new Error("Select a valid country code.");

  const raw = input.trim();
  const digits = raw.replace(/\D/g, "");
  const dialDigits = allowedDialCode.slice(1);

  let internationalDigits: string;
  if (raw.startsWith("+")) {
    internationalDigits = digits;
  } else if (raw.startsWith("00")) {
    internationalDigits = digits.slice(2);
  } else if (digits.startsWith(dialDigits)) {
    internationalDigits = digits;
  } else {
    internationalDigits = `${dialDigits}${digits.replace(/^0+/, "")}`;
  }

  const normalized = `+${internationalDigits}`;
  if (!e164Pattern.test(normalized)) throw new Error("Enter a valid mobile number.");

  return normalized;
}

export function mobileAuthEmail(normalizedMobile: string) {
  if (!e164Pattern.test(normalizedMobile)) throw new Error("A normalized mobile number is required.");
  return `${normalizedMobile.slice(1)}@mobile.idstore.invalid`;
}
