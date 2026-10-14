import { seatInfo, sectionPurchasable } from './orders.js';
import { toMajor, currencyDigits } from './payments.js';

const J = (s, d = []) => { try { return JSON.parse(s); } catch { return d; } };

export function serializeCourse(db, c, { admin = false } = {}) {
  const lessons = db.prepare('SELECT no, title_ko, title_en FROM lessons WHERE course_id = ? ORDER BY no').all(c.id);
  const instructor = c.instructor_id
    ? db.prepare('SELECT id, name_ko, name_en, published FROM instructors WHERE id = ?').get(c.instructor_id)
    : null;
  const sectionRows = db.prepare(`SELECT * FROM sections WHERE course_id = ? ${admin ? '' : "AND status != 'draft'"} ORDER BY id`).all(c.id);
  return {
    id: c.id, slug: c.slug, sort: c.sort, category: c.category, status: c.status,
    title: { ko: c.title_ko, en: c.title_en },
    summary: { ko: c.summary_ko, en: c.summary_en },
    level: { ko: c.level_ko, en: c.level_en },
    prerequisites: { ko: c.prerequisites_ko, en: c.prerequisites_en },
    goals: { ko: J(c.goals_ko), en: J(c.goals_en) },
    formats: J(c.formats), purposes: J(c.purposes), levelMin: c.level_min, levelMax: c.level_max,
    sessionCount: c.session_count, minutesPerSession: c.minutes_per_session,
    materials: { ko: c.materials_ko, en: c.materials_en },
    refundPolicy: { ko: c.refund_policy_ko, en: c.refund_policy_en },
    price: c.price_amount === null || c.price_amount === undefined ? null
      : { amount: c.price_amount, major: toMajor(c.price_amount, c.currency), currency: c.currency, digits: currencyDigits(c.currency) },
    currency: c.currency,
    instructor: instructor && (admin || instructor.published) ? { id: instructor.id, name: { ko: instructor.name_ko, en: instructor.name_en } } : null,
    lessons: lessons.map((l) => ({ no: l.no, title: { ko: l.title_ko, en: l.title_en } })),
    sections: sectionRows.map((s) => serializeSection(db, s, c, { admin })),
    ...(admin ? { paymentLinkUrl: c.payment_link_url, instructorId: c.instructor_id } : {})
  };
}

export function serializeSection(db, s, course, { admin = false } = {}) {
  const sessions = db.prepare('SELECT id, no, starts_at, meeting_url FROM class_sessions WHERE section_id = ? ORDER BY no').all(s.id);
  const seats = seatInfo(db, s.id);
  const blocked = sectionPurchasable(db, s, course);
  if (seats.remaining <= 0) blocked.push('sold_out');
  return {
    id: s.id, courseId: s.course_id, label: { ko: s.label_ko, en: s.label_en }, format: s.format, timezone: s.timezone,
    capacity: s.capacity, remaining: seats.remaining, enrollDeadline: s.enroll_deadline, status: s.status,
    // 화상수업 링크는 공개 응답에 절대 포함하지 않음
    sessions: sessions.map((x) => ({ id: x.id, no: x.no, startsAt: x.starts_at, ...(admin ? { meetingUrl: x.meeting_url } : {}) })),
    purchasable: blocked.length === 0, blockedReasons: blocked,
    ...(admin ? { enrolled: seats.enrolled, held: seats.held } : {})
  };
}

export function serializeOrder(db, o) {
  const course = db.prepare('SELECT title_ko, title_en, instructor_id, session_count, minutes_per_session FROM courses WHERE id = ?').get(o.course_id);
  const section = db.prepare('SELECT label_ko, label_en, format, timezone FROM sections WHERE id = ?').get(o.section_id);
  const instructor = course?.instructor_id ? db.prepare('SELECT name_ko, name_en, published FROM instructors WHERE id = ?').get(course.instructor_id) : null;
  const first = db.prepare('SELECT MIN(starts_at) s, COUNT(*) n FROM class_sessions WHERE section_id = ?').get(o.section_id);
  return {
    orderNo: o.order_no, status: o.status, amount: o.amount, major: toMajor(o.amount, o.currency), currency: o.currency,
    refundedAmount: o.refunded_amount, refundedMajor: toMajor(o.refunded_amount, o.currency),
    provider: o.provider, failureReason: o.failure_reason, needsReview: o.needs_review,
    holdExpiresAt: o.hold_expires_at, paidAt: o.paid_at, createdAt: o.created_at, providerReference: o.provider_reference,
    course: { id: o.course_id, title: { ko: course?.title_ko, en: course?.title_en }, sessionCount: course?.session_count, minutesPerSession: course?.minutes_per_session },
    instructor: instructor?.published ? { ko: instructor.name_ko, en: instructor.name_en } : null,
    section: { id: o.section_id, label: { ko: section?.label_ko, en: section?.label_en }, format: section?.format, timezone: section?.timezone, firstSession: first.s, sessionCount: first.n },
    refundPolicy: J(o.refund_policy_snapshot, {}),
    applicant: J(o.applicant, {}), consents: J(o.consents, {})
  };
}
