import type { QuestionStatus } from './admin-types';
import type { SectionId } from './types';

export const ADMIN_SECTION_LABELS:Record<SectionId,string>={
  script_vocabulary:'Chữ viết & Từ vựng',
  conversation_expression:'Hội thoại & Biểu đạt',
  listening:'Nghe hiểu',
  reading:'Đọc hiểu',
};

export const ADMIN_STATUS_LABELS:Record<QuestionStatus,string>={
  draft:'Bản nháp',
  review:'Chờ duyệt',
  approved:'Đã duyệt',
  archived:'Đã lưu trữ',
};

export const ADMIN_VERDICT_LABELS:Record<'PASS'|'REVIEW'|'FAIL',string>={
  PASS:'Đạt',
  REVIEW:'Cần xem lại',
  FAIL:'Không đạt',
};

export const ADMIN_CONFIDENCE_LABELS:Record<'HIGH'|'MEDIUM'|'LOW',string>={
  HIGH:'Cao',
  MEDIUM:'Trung bình',
  LOW:'Thấp',
};

export function humanizeAdminCode(value:string){
  return value.replaceAll('_',' ').toLocaleLowerCase('vi-VN');
}
