/** Standard API success response wrapper */
export interface ApiSuccess<T> {
  success: true
  data: T
}

/** Standard API error response wrapper */
export interface ApiError {
  success: false
  error: {
    code: string // Machine-readable code, e.g. "EMAIL_ALREADY_EXISTS"
    message: string // Human-readable message
    field?: string // Which field caused the error (for form validation)
  }
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError
