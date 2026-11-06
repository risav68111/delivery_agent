const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\s'.-]*$/u;
const PHONE_CHARACTERS = /^\+?[\d\s\-().]+$/;
const AREA_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}\s,./&()'-]*$/u;

/**
 * Client-side mirror of the API validation rules so users get instant feedback.
 * The API remains the source of truth and its messages are merged into the form.
 */
export function validateAgent(values) {
  const errors = {};

  const fullName = values.fullName.trim();
  if (!fullName) errors.fullName = 'Full name is required';
  else if (fullName.length < 2 || fullName.length > 120) {
    errors.fullName = 'Full name must be between 2 and 120 characters';
  } else if (!NAME_PATTERN.test(fullName)) {
    errors.fullName = 'Use letters, spaces, hyphens, apostrophes or periods';
  }

  const email = values.email.trim();
  if (!email) errors.email = 'Email address is required';
  else if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid email such as name@example.com';
  }

  const phone = values.phone.trim();
  const digits = phone.replace(/\D/g, '');
  if (!phone) errors.phone = 'Phone number is required';
  else if (!PHONE_CHARACTERS.test(phone)) {
    errors.phone = 'Use digits, spaces, +, -, . or parentheses';
  } else if (digits.length < 7 || digits.length > 15) {
    errors.phone = 'Phone number must contain 7 to 15 digits';
  }

  const serviceArea = values.serviceArea.trim();
  if (!serviceArea) errors.serviceArea = 'Service area is required';
  else if (serviceArea.length < 2 || serviceArea.length > 120) {
    errors.serviceArea = 'Service area must be between 2 and 120 characters';
  } else if (!AREA_PATTERN.test(serviceArea)) {
    errors.serviceArea = 'Use letters, digits, spaces and , . / & ( ) - \'';
  }

  if (!['active', 'inactive'].includes(values.status)) {
    errors.status = 'Choose active or inactive';
  }

  return errors;
}

export function normalizeAgent(values) {
  return {
    fullName: values.fullName.trim().replace(/\s+/g, ' '),
    email: values.email.trim().toLowerCase(),
    phone: values.phone.trim().replace(/\s+/g, ' '),
    serviceArea: values.serviceArea.trim().replace(/\s+/g, ' '),
    status: values.status,
  };
}
