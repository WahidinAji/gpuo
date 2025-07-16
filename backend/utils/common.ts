export function validateRequired(fields: Record<string, any>, requiredFields: string[]) {
  const missing = requiredFields.filter(field => !fields[field]);
  
  if (missing.length > 0) {
    return {
      isValid: false,
      error: `${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} required`
    };
  }
  
  return { isValid: true };
}
