import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(32, 'Username cannot exceed 32 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain alphanumeric characters, underscores, and dashes'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password cannot exceed 128 characters'),
});

export const loginSchema = z.object({
  // Supports either identifier (username or email) or explicit email
  identifier: z.string().min(1).max(255).optional(),
  email: z.string().max(255).optional(),
  password: z.string().min(1, 'Password is required'),
  deviceId: z.string().min(1, 'deviceId is required').max(128),
  deviceModel: z.string().max(128).optional(),
  manufacturer: z.string().max(64).optional(),
  androidVersion: z.number().int().optional(),
  appVersion: z.string().max(32).default('1.0.0'),
}).refine((data) => !!(data.identifier || data.email), {
  message: 'Username or email identifier is required',
  path: ['identifier'],
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken is required'),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1).optional(),
  email: z.string().email('Invalid email address').optional(),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be a 6-digit number').optional(),
}).refine((data) => !!data.token || (!!data.email && !!data.otp), {
  message: 'Either verification token or email and 6-digit OTP must be provided',
  path: ['otp'],
});

export const resendOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .max(128, 'New password cannot exceed 128 characters'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .max(128, 'New password cannot exceed 128 characters'),
});

export const serverCredentialSchema = z.object({
  serverAddress: z.string().min(1, 'serverAddress is required').max(255),
});

export const verifyServerCredentialSchema = z.object({
  serverAddress: z.string().min(1, 'serverAddress is required').max(255),
  serverCredential: z.string().min(1, 'serverCredential is required').max(255),
  username: z.string().min(1, 'username is required').max(64),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendOtpInput = z.infer<typeof resendOtpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ServerCredentialInput = z.infer<typeof serverCredentialSchema>;
export type VerifyServerCredentialInput = z.infer<typeof verifyServerCredentialSchema>;
