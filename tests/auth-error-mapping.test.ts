import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { authErrorMessage } from '@/components/auth/auth-errors';

describe('Vietnamese auth error mapping', () => {
  it('maps credentials without exposing the API response', () => {
    expect(authErrorMessage(new ApiError(401, { error: 'Invalid credentials' }), 'login')).toBe('Email hoặc mật khẩu không đúng.');
  });

  it('maps an existing account and weak password', () => {
    expect(authErrorMessage(new ApiError(400, { error: 'User already registered' }), 'register')).toBe('Email này đã được đăng ký.');
    expect(authErrorMessage(new ApiError(422, { error: 'Password must be at least 8 characters.' }), 'register')).toBe('Mật khẩu chưa đáp ứng yêu cầu.');
  });

  it('maps connection and reset-token failures', () => {
    expect(authErrorMessage(new TypeError('fetch failed'), 'recover')).toBe('Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.');
    expect(authErrorMessage(new ApiError(401, { error: 'Recovery token expired' }), 'reset')).toBe('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
  });
});
