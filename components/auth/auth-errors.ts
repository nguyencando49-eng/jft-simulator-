import { ApiError } from '@/lib/api-client';

export type AuthAction = 'login' | 'register' | 'recover' | 'reset';

export function authErrorMessage(error: unknown, action: AuthAction): string {
  if (error instanceof ApiError) {
    const message = String(error.payload.error ?? '').toLowerCase();
    if (action === 'login' && (error.status === 401 || message.includes('credential'))) return 'Email hoặc mật khẩu không đúng.';
    if (action === 'register' && (message.includes('already') || message.includes('registered') || message.includes('exists'))) return 'Email này đã được đăng ký.';
    if (message.includes('password') || error.status === 422) return 'Mật khẩu chưa đáp ứng yêu cầu.';
    if (action === 'reset' && (error.status === 401 || message.includes('expired') || message.includes('token'))) return 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.';
  }
  if (error instanceof TypeError) return 'Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.';
  return 'Đã xảy ra lỗi. Vui lòng thử lại.';
}
