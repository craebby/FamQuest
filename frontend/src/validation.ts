// Muss zu den Regeln im Backend passen (backend/app/schemas.py).
export const PASSWORD_MIN_LENGTH = 10
export const PIN_MIN_LENGTH = 4
export const PIN_MAX_LENGTH = 8

export const isValidEmail = (value: string) => /^[^@\s]+@[^@\s]+$/.test(value.trim())
