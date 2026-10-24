/**
 * with.study 예약센터 — Google Apps Script 백엔드
 *
 * 이 스크립트는 예약용 Google 스프레드시트에 붙여서(확장 프로그램 → Apps Script) 사용합니다.
 * 처음 한 번: setup() → installTriggers() 를 편집기에서 실행하고, 웹앱으로 배포합니다.
 * 자세한 순서는 booking/README.md 를 보세요.
 */

var SHEET = {SERVICES: 'Services', SLOTS: 'Slots', BOOKINGS: 'Bookings', SETTINGS: 'Settings'};

var HEADERS = {
  Services: ['service_id', 'active', 'sort', 'type', 'category_ko', 'category_en', 'name_ko', 'name_en',
    'duration_ko', 'duration_en', 'mode_ko', 'mode_en', 'price_ko', 'price_en',
    'summary_ko', 'summary_en', 'detail_ko', 'detail_en'],
  Slots: ['slot_id', 'service_id', 'date', 'start', 'end', 'capacity', 'booked', 'open'],
  Bookings: ['booking_id', 'created_at', 'status', 'service_id', 'service_name', 'slot_id', 'date', 'time',
    'pref_dates', 'pref_time', 'headcount', 'venue', 'topic',
    'name', 'phone', 'email', 'org', 'message', 'consent', 'lang',
    'admin_memo', 'calendar_event_id', 'updated_at'],
  Settings: ['key', 'value', 'note']
};

var STATUS = {RECEIVED: '접수', CONFIRMED: '확정', CHANGE: '변경요청', CANCELLED: '취소'};

var DEFAULT_SETTINGS = [
  ['ADMIN_EMAIL', '', '새 예약 알림을 받을 운영자 이메일'],
  ['SITE_NAME', 'with.study 예약센터', '메일 제목·본문에 쓰는 이름'],
  ['SITE_URL', 'https://booking.with.study/', '메일에 넣는 사이트 주소'],
  ['CALENDAR_ID', '', '확정 시 일정을 넣을 캘린더 ID (비우면 기본 캘린더)'],
  ['RETENTION_DAYS', '365', '예약 기록 보관 일수 (지나면 자동 삭제)'],
  ['REQUEST_DEFAULT_HOURS', '2', '의뢰서형 예약을 캘린더에 넣을 때 기본 시간(시간)'],
  ['MIN_LEAD_DAYS', '1', '오늘부터 며칠 뒤 시간부터 예약을 받을지'],
  ['MAX_DAYS_AHEAD', '60', '앞으로 며칠까지의 시간을 보여 줄지']
];

/* ================= 웹앱 입구 ================= */

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    switch (p.action) {
      case 'services': return json_({ok: true, services: listServices_()});
      case 'slots': return json_({ok: true, slots: listSlots_(String(p.service || ''))});
      case 'lookup': return json_(lookup_(String(p.id || ''), String(p.last4 || '')));
      default: return json_({ok: true, name: 'with.study booking API'});
    }
  } catch (err) {
    console.error(err);
    return json_({ok: false, error: 'SERVER'});
  }
}

function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ok: false, error: 'INVALID'});
  }
  if (data.action !== 'book') return json_({ok: false, error: 'INVALID'});

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (err) {
    return json_({ok: false, error: 'BUSY'});
  }
  try {
    return json_(createBooking_(data));
  } catch (err) {
    console.error(err);
    return json_({ok: false, error: 'SERVER'});
  } finally {
    lock.releaseLock();
  }
}

/* ================= 조회 ================= */

function listServices_() {
  return readRows_(SHEET.SERVICES)
    .filter(function (r) { return String(r.active).toUpperCase() === 'Y'; })
    .sort(function (a, b) { return (Number(a.sort) || 0) - (Number(b.sort) || 0); })
    .map(function (r) {
      var o = {};
      HEADERS.Services.forEach(function (h) { if (h !== 'active' && h !== 'sort') o[h] = String(r[h] == null ? '' : r[h]); });
      return o;
    });
}

function listSlots_(serviceId) {
  var s = settings_();
  var today = todayStr_();
  var from = addDays_(today, Number(s.MIN_LEAD_DAYS || 1));
  var to = addDays_(today, Number(s.MAX_DAYS_AHEAD || 60));
  return readRows_(SHEET.SLOTS)
    .filter(function (r) {
      var d = normDate_(r.date);
      return r.service_id === serviceId && String(r.open).toUpperCase() === 'Y' && d >= from && d <= to;
    })
    .map(function (r) {
      return {
        slot_id: String(r.slot_id), date: normDate_(r.date), start: normTime_(r.start), end: normTime_(r.end),
        remaining: Math.max(0, (Number(r.capacity) || 1) - (Number(r.booked) || 0))
      };
    })
    .sort(function (a, b) { return (a.date + a.start) < (b.date + b.start) ? -1 : 1; });
}

function lookup_(id, last4) {
  id = id.trim().toUpperCase();
  last4 = digits_(last4);
  if (!/^WS-\d{8}-\d{3,}$/.test(id) || last4.length !== 4) return {ok: false, error: 'NOT_FOUND'};
  var rows = readRows_(SHEET.BOOKINGS);
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (String(r.booking_id) === id && digits_(r.phone).slice(-4) === last4) {
      // 개인정보는 돌려주지 않고 진행 상태만 보여 줍니다
      return {ok: true, booking: {
        booking_id: id, status: String(r.status), service_name: String(r.service_name),
        date: normDate_(r.date) || firstPref_(r.pref_dates), time: String(r.time || r.pref_time || ''),
        created_at: normDate_(r.created_at)
      }};
    }
  }
  return {ok: false, error: 'NOT_FOUND'};
}

/* ================= 예약 저장 ================= */

function createBooking_(d) {
  if (d.website) return {ok: false, error: 'INVALID'}; // 스팸 방지용 숨김 칸
  if (d.consent !== true) return {ok: false, error: 'INVALID'};

  var svc = listServices_().filter(function (s) { return s.service_id === d.service_id; })[0];
  if (!svc) return {ok: false, error: 'INVALID'};

  var name = clip_(d.name, 40), phone = clip_(d.phone, 20), email = clip_(d.email, 120);
  var phoneDigits = digits_(phone);
  if (!name || phoneDigits.length < 9 || phoneDigits.length > 15 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {ok: false, error: 'INVALID'};
  }

  var row = {
    status: STATUS.RECEIVED, service_id: svc.service_id, service_name: svc.name_ko,
    name: name, phone: phone, email: email, org: clip_(d.org, 80), message: clip_(d.message, 1500),
    consent: 'Y', lang: d.lang === 'en' ? 'en' : 'ko'
  };

  var slotSheet, slotRowIndex, slotRow;
  if (svc.type === 'slot') {
    var found = findRow_(SHEET.SLOTS, 'slot_id', String(d.slot_id || ''));
    if (!found) return {ok: false, error: 'SLOT_TAKEN'};
    slotRow = found.row;
    var s = settings_();
    var date = normDate_(slotRow.date);
    var ok = slotRow.service_id === svc.service_id &&
      String(slotRow.open).toUpperCase() === 'Y' &&
      date >= addDays_(todayStr_(), Number(s.MIN_LEAD_DAYS || 1)) &&
      (Number(slotRow.booked) || 0) < (Number(slotRow.capacity) || 1);
    if (!ok) return {ok: false, error: 'SLOT_TAKEN'};
    slotSheet = found.sheet; slotRowIndex = found.index;
    row.slot_id = String(slotRow.slot_id);
    row.date = date;
    row.time = normTime_(slotRow.start) + '–' + normTime_(slotRow.end);
  } else {
    var tmr = addDays_(todayStr_(), 1);
    var prefs = [d.pref1, d.pref2, d.pref3].map(function (v) { return clip_(v, 10); })
      .filter(function (v) { return /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= tmr; });
    var hc = parseInt(d.headcount, 10);
    if (!prefs.length || !(hc >= 1 && hc <= 2000) || !clip_(d.venue, 120) || !clip_(d.topic, 1500)) {
      return {ok: false, error: 'INVALID'};
    }
    row.pref_dates = prefs.join(', ');
    row.pref_time = clip_(d.pref_time, 60);
    row.headcount = hc;
    row.venue = clip_(d.venue, 120);
    row.topic = clip_(d.topic, 1500);
  }

  var now = new Date();
  row.booking_id = nextBookingId_(now);
  row.created_at = Utilities.formatDate(now, tz_(), 'yyyy-MM-dd HH:mm');
  row.updated_at = row.created_at;
  appendRow_(SHEET.BOOKINGS, row);

  if (slotSheet) {
    var bookedCol = HEADERS.Slots.indexOf('booked') + 1;
    slotSheet.getRange(slotRowIndex, bookedCol).setValue((Number(slotRow.booked) || 0) + 1);
  }
  SpreadsheetApp.flush();

  try { sendReceivedMails_(row, svc); } catch (err) { console.error('mail failed', err); }
  return {ok: true, booking_id: row.booking_id};
}

function nextBookingId_(now) {
  var prefix = 'WS-' + Utilities.formatDate(now, tz_(), 'yyyyMMdd') + '-';
  var max = 0;
  readRows_(SHEET.BOOKINGS).forEach(function (r) {
    var id = String(r.booking_id);
    if (id.indexOf(prefix) === 0) max = Math.max(max, Number(id.slice(prefix.length)) || 0);
  });
  return prefix + ('00' + (max + 1)).slice(-3);
}

/* ================= 운영자 상태 변경 (설치형 onEdit 트리거) ================= */

function onBookingEdit(e) {
  if (!e || !e.range) return;
  var sh = e.range.getSheet();
  if (sh.getName() !== SHEET.BOOKINGS) return;
  var statusCol = HEADERS.Bookings.indexOf('status') + 1;
  if (e.range.getColumn() > statusCol || e.range.getLastColumn() < statusCol) return;

  for (var r = e.range.getRow(); r <= e.range.getLastRow(); r++) {
    if (r === 1) continue;
    var oldStatus = e.range.getNumRows() === 1 ? String(e.oldValue || '') : '';
    handleStatusChange_(sh, r, oldStatus);
  }
}

function handleStatusChange_(sh, rowIndex, oldStatus) {
  var values = sh.getRange(rowIndex, 1, 1, HEADERS.Bookings.length).getValues()[0];
  var b = {};
  HEADERS.Bookings.forEach(function (h, i) { b[h] = values[i]; });
  var status = String(b.status);
  if (!b.booking_id || status === oldStatus) return;

  var set = function (field, value) { sh.getRange(rowIndex, HEADERS.Bookings.indexOf(field) + 1).setValue(value); };

  if (status === STATUS.CONFIRMED) {
    if (!b.calendar_event_id) {
      var evId = createCalendarEvent_(b);
      if (evId) set('calendar_event_id', evId);
    }
    sendStatusMail_(b, status);
  } else if (status === STATUS.CANCELLED) {
    if (oldStatus !== STATUS.CANCELLED) releaseSlot_(String(b.slot_id || ''));
    if (b.calendar_event_id) {
      deleteCalendarEvent_(String(b.calendar_event_id));
      set('calendar_event_id', '');
    }
    sendStatusMail_(b, status);
  } else if (status === STATUS.CHANGE) {
    sendStatusMail_(b, status);
  } else {
    return;
  }
  set('updated_at', Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd HH:mm'));
}

function releaseSlot_(slotId) {
  if (!slotId) return;
  var found = findRow_(SHEET.SLOTS, 'slot_id', slotId);
  if (!found) return;
  var col = HEADERS.Slots.indexOf('booked') + 1;
  found.sheet.getRange(found.index, col).setValue(Math.max(0, (Number(found.row.booked) || 0) - 1));
}

/* ================= 캘린더 ================= */

function calendar_() {
  var id = settings_().CALENDAR_ID;
  return (id && CalendarApp.getCalendarById(id)) || CalendarApp.getDefaultCalendar();
}

function createCalendarEvent_(b) {
  var date = normDate_(b.date);
  if (!date) return ''; // 의뢰서형은 운영자가 date·time 칸에 확정 일정을 적은 뒤 확정합니다
  var times = String(b.time || '').split(/[–~-]/).map(function (s) { return s.trim(); });
  var start = toDate_(date, times[0] || '10:00');
  var end = times[1] ? toDate_(date, times[1])
    : new Date(start.getTime() + Number(settings_().REQUEST_DEFAULT_HOURS || 2) * 3600 * 1000);
  var title = '[예약] ' + b.service_name + ' - ' + b.name + (b.org ? ' (' + b.org + ')' : '');
  var desc = [
    '예약번호: ' + b.booking_id, '연락처: ' + b.phone, '이메일: ' + b.email,
    b.venue ? '장소: ' + b.venue : '', b.headcount ? '인원: ' + b.headcount : '',
    b.topic ? '주제: ' + b.topic : '', b.message ? '요청사항: ' + b.message : ''
  ].filter(String).join('\n');
  try {
    return calendar_().createEvent(title, start, end, {description: desc}).getId();
  } catch (err) {
    console.error('calendar failed', err);
    return '';
  }
}

function deleteCalendarEvent_(eventId) {
  try {
    var ev = calendar_().getEventById(eventId);
    if (ev) ev.deleteEvent();
  } catch (err) {
    console.error('calendar delete failed', err);
  }
}

/* ================= 메일 ================= */

function sendReceivedMails_(b, svc) {
  var s = settings_();
  var en = b.lang === 'en';
  var when = b.date ? b.date + ' ' + b.time : (en ? 'Preferred: ' : '희망일: ') + b.pref_dates + (b.pref_time ? ' / ' + b.pref_time : '');
  var body = en ? [
    'Hello ' + b.name + ',', '',
    'Your request has been received. The operator will review it and email you a confirmation.', '',
    'Booking number: ' + b.booking_id, 'Service: ' + (svc.name_en || svc.name_ko), 'Schedule: ' + when, '',
    'Look up your booking: ' + s.SITE_URL + '#lookup/' + b.booking_id,
    'To change or cancel, just reply to this email.'
  ] : [
    b.name + '님, 안녕하세요.', '',
    '신청이 접수되었습니다. 운영자가 확인한 뒤 확정 안내를 다시 보내 드립니다.', '',
    '예약번호: ' + b.booking_id, '서비스: ' + svc.name_ko, '일정: ' + when, '',
    '예약 조회: ' + s.SITE_URL + '#lookup/' + b.booking_id,
    '변경·취소는 이 메일에 답장해 주세요.'
  ];
  var opts = {name: s.SITE_NAME};
  if (s.ADMIN_EMAIL) opts.replyTo = s.ADMIN_EMAIL;
  MailApp.sendEmail(b.email, '[' + s.SITE_NAME + '] ' + (en ? 'Request received ' : '신청 접수 ') + b.booking_id, body.join('\n'), opts);

  if (s.ADMIN_EMAIL) {
    var admin = [
      '새 예약이 접수되었습니다.', '',
      '예약번호: ' + b.booking_id, '서비스: ' + svc.name_ko, '일정: ' + when,
      '이름: ' + b.name, '연락처: ' + b.phone, '이메일: ' + b.email, '소속: ' + (b.org || '-'),
      b.headcount ? '인원: ' + b.headcount : '', b.venue ? '장소: ' + b.venue : '', b.topic ? '주제: ' + b.topic : '',
      '요청사항: ' + (b.message || '-'), '',
      '시트에서 상태를 "확정"으로 바꾸면 신청자에게 확정 메일이 자동으로 갑니다.',
      SpreadsheetApp.getActiveSpreadsheet().getUrl()
    ].filter(String);
    MailApp.sendEmail(s.ADMIN_EMAIL, '[새 예약] ' + svc.name_ko + ' - ' + b.name + ' ' + b.booking_id, admin.join('\n'), {replyTo: b.email});
  }
}

function sendStatusMail_(b, status) {
  if (!b.email) return;
  var s = settings_();
  var en = String(b.lang) === 'en';
  var when = normDate_(b.date) ? normDate_(b.date) + ' ' + b.time : String(b.pref_dates || '');
  var memo = String(b.admin_memo || '').trim();
  var lines = {
    '확정': en ? ['Your booking is confirmed.', 'Schedule: ' + when] : ['예약이 확정되었습니다.', '일정: ' + when],
    '변경요청': en ? ['We need to adjust your booking. We will contact you shortly, or reply to this email.']
      : ['예약 일정 조정이 필요합니다. 곧 연락드리겠습니다. 이 메일에 답장하셔도 됩니다.'],
    '취소': en ? ['Your booking has been cancelled.'] : ['예약이 취소되었습니다.']
  }[status];
  var subject = {
    '확정': en ? 'Booking confirmed' : '예약 확정',
    '변경요청': en ? 'Change needed' : '일정 조정 안내',
    '취소': en ? 'Booking cancelled' : '예약 취소'
  }[status];
  var body = [en ? 'Hello ' + b.name + ',' : b.name + '님, 안녕하세요.', '']
    .concat(lines)
    .concat([en ? 'Service: ' + b.service_name : '서비스: ' + b.service_name, (en ? 'Booking number: ' : '예약번호: ') + b.booking_id])
    .concat(memo ? ['', (en ? 'Note from the operator: ' : '안내: ') + memo] : [])
    .concat(['', s.SITE_URL + '#lookup/' + b.booking_id]);
  var opts = {name: s.SITE_NAME};
  if (s.ADMIN_EMAIL) opts.replyTo = s.ADMIN_EMAIL;
  try {
    MailApp.sendEmail(String(b.email), '[' + s.SITE_NAME + '] ' + subject + ' ' + b.booking_id, body.join('\n'), opts);
  } catch (err) {
    console.error('status mail failed', err);
  }
}

/* ================= 개인정보 보관기간 정리 (매일 실행) ================= */

function purgeOldBookings() {
  var days = Number(settings_().RETENTION_DAYS || 365);
  var cutoff = addDays_(todayStr_(), -days);
  var sh = sheet_(SHEET.BOOKINGS);
  var values = sh.getDataRange().getValues();
  var col = HEADERS.Bookings.indexOf('created_at');
  for (var i = values.length - 1; i >= 1; i--) {
    var created = normDate_(values[i][col]);
    if (created && created < cutoff) sh.deleteRow(i + 1);
  }
}

/* ================= 처음 설정 (편집기에서 한 번 실행) ================= */

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(HEADERS).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]).setFontWeight('bold')
        .setBackground('#1F3864').setFontColor('#FFFFFF');
      sh.setFrozenRows(1);
    }
  });

  // 날짜·시간이 자동 변환되지 않도록 일반 텍스트로 고정
  var slots = ss.getSheetByName(SHEET.SLOTS);
  ['date', 'start', 'end'].forEach(function (h) {
    slots.getRange(2, HEADERS.Slots.indexOf(h) + 1, slots.getMaxRows() - 1, 1).setNumberFormat('@');
  });
  var bookings = ss.getSheetByName(SHEET.BOOKINGS);
  ['date', 'time', 'created_at', 'updated_at', 'phone'].forEach(function (h) {
    bookings.getRange(2, HEADERS.Bookings.indexOf(h) + 1, bookings.getMaxRows() - 1, 1).setNumberFormat('@');
  });
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList([STATUS.RECEIVED, STATUS.CONFIRMED, STATUS.CHANGE, STATUS.CANCELLED], true).build();
  bookings.getRange(2, HEADERS.Bookings.indexOf('status') + 1, bookings.getMaxRows() - 1, 1).setDataValidation(rule);

  var settings = ss.getSheetByName(SHEET.SETTINGS);
  var existing = readRows_(SHEET.SETTINGS).map(function (r) { return r.key; });
  DEFAULT_SETTINGS.forEach(function (row) { if (existing.indexOf(row[0]) < 0) settings.appendRow(row); });

  var services = ss.getSheetByName(SHEET.SERVICES);
  if (services.getLastRow() === 1) SAMPLE_SERVICES.forEach(function (o) { appendRow_(SHEET.SERVICES, o); });

  var def = ss.getSheetByName('Sheet1') || ss.getSheetByName('시트1');
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(def);
}

function installTriggers() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var fn = t.getHandlerFunction();
    if (fn === 'onBookingEdit' || fn === 'purgeOldBookings') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onBookingEdit').forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger('purgeOldBookings').timeBased().everyDays(1).atHour(3).create();
}

/**
 * 반복 시간대를 한 번에 만드는 도우미.
 * 예) 앞으로 4주 동안 월~금 10:00-11:00, 14:00-15:00 코칭 시간 열기
 *     addWeeklySlots('coach-wl', [1,2,3,4,5], [['10:00','11:00'], ['14:00','15:00']], 4, 1)
 * weekdays: 0=일 1=월 ... 6=토
 */
function addWeeklySlots(serviceId, weekdays, times, weeks, capacity) {
  var existing = {};
  readRows_(SHEET.SLOTS).forEach(function (r) { existing[r.slot_id] = true; });
  var start = addDays_(todayStr_(), 1);
  for (var i = 0; i < weeks * 7; i++) {
    var date = addDays_(start, i);
    if (weekdays.indexOf(toDate_(date, '12:00').getDay()) < 0) continue;
    times.forEach(function (tm) {
      var id = serviceId + '-' + date.replace(/-/g, '') + '-' + tm[0].replace(':', '');
      if (existing[id]) return;
      appendRow_(SHEET.SLOTS, {slot_id: id, service_id: serviceId, date: date, start: tm[0], end: tm[1],
        capacity: capacity || 1, booked: 0, open: 'Y'});
    });
  }
}

/** 편집기에서 바로 실행해 보는 예시 */
function exampleAddSlots() {
  addWeeklySlots('coach-wl', [1, 2, 3, 4, 5], [['10:00', '11:00'], ['14:00', '15:00']], 4, 1);
  addWeeklySlots('consult-biz', [2, 4], [['13:00', '14:30'], ['15:00', '16:30']], 4, 1);
  addWeeklySlots('consult-gya', [3, 6], [['19:00', '19:30'], ['20:00', '20:30']], 4, 1);
}

var SAMPLE_SERVICES = [
  {service_id: 'lecture-wd', active: 'Y', sort: 1, type: 'request', category_ko: '강의', category_en: 'Lecture',
    name_ko: '웰다잉·엔딩노트 특강', name_en: 'Well-Dying & Ending Note Lecture', duration_ko: '2시간', duration_en: '2 hours',
    mode_ko: '방문 강의', mode_en: 'On-site', price_ko: '협의', price_en: 'By agreement',
    summary_ko: '복지관·지자체·기관을 위한 웰다잉 특강. 엔딩노트 작성 실습을 함께 진행합니다.',
    summary_en: 'Well-dying lecture for welfare centers and public institutions, with an ending-note workshop.',
    detail_ko: '대상: 중장년·시니어, 기관 종사자\n내용: 웰다잉의 의미, 엔딩노트 작성 실습, 사전의향서 안내\n준비: 강의실, 빔프로젝터, 필기도구\n취소·변경: 확정 후 일정 변경은 운영자와 협의합니다.',
    detail_en: 'For: middle-aged and senior adults, institution staff\nContent: meaning of well-dying, ending-note practice, advance directive overview\nPrepare: room, projector, pens\nChanges: discuss with the operator after confirmation.'},
  {service_id: 'coach-wl', active: 'Y', sort: 2, type: 'slot', category_ko: '코칭', category_en: 'Coaching',
    name_ko: '웰다잉라이프 1:1 코칭', name_en: 'Well-Dying Life 1:1 Coaching', duration_ko: '60분', duration_en: '60 min',
    mode_ko: '온라인 / 대면', mode_en: 'Online / In person', price_ko: '상담 후 안내', price_en: 'Shared after inquiry',
    summary_ko: '관계 정리, 남기고 싶은 말, 인생 후반기 설계를 1:1로 함께 정리합니다.',
    summary_en: 'One-on-one coaching on relationships, legacy messages and later-life design.',
    detail_ko: '대상: 인생 후반기를 정리하고 싶은 개인\n내용: 삶의 가치 3개 찾기, 관계 정리, 남기고 싶은 말 1페이지\n준비: 조용한 공간, 필기도구\n취소·변경: 예약일 2일 전까지 알려 주세요.',
    detail_en: 'For: individuals planning their later life\nContent: three core values, relationships, a one-page legacy message\nPrepare: a quiet space and a pen\nChanges: please tell us at least 2 days ahead.'},
  {service_id: 'consult-biz', active: 'Y', sort: 3, type: 'slot', category_ko: '컨설팅', category_en: 'Consulting',
    name_ko: '창업·사회적기업 경영진단', name_en: 'Startup & Social Enterprise Diagnosis', duration_ko: '90분', duration_en: '90 min',
    mode_ko: '온라인 / 대면', mode_en: 'Online / In person', price_ko: '상담 후 안내', price_en: 'Shared after inquiry',
    summary_ko: '매출·고객·수익모델·조직 중 막힌 곳을 진단하고 다음 단계를 정리합니다.',
    summary_en: 'Find where sales, customers, revenue model or team is stuck and set the next steps.',
    detail_ko: '대상: 예비창업자, 중소·벤처·여성기업, 사회적기업·소셜벤처·마을기업\n내용: 현황 진단, 수익모델 점검, 실행 과제 3가지 도출\n준비: 사업계획서 또는 회사 소개 자료(있으면)\n취소·변경: 예약일 2일 전까지 알려 주세요.',
    detail_en: 'For: founders, SMEs, women-led businesses, social enterprises\nContent: diagnosis, revenue model review, three action items\nPrepare: business plan or company profile if available\nChanges: please tell us at least 2 days ahead.'},
  {service_id: 'course-wlc', active: 'Y', sort: 4, type: 'request', category_ko: '교육과정', category_en: 'Course',
    name_ko: '웰다잉라이프코치(WLC) 2급 과정', name_en: 'Well-Dying Life Coach (WLC) Level 2', duration_ko: '회차별 운영', duration_en: 'Multi-session',
    mode_ko: '오프라인', mode_en: 'Offline', price_ko: '과정별 안내', price_en: 'Per course',
    summary_ko: '엔딩노트 실습 중심의 자격 과정. 기관 단체 개설 신청을 받습니다.',
    summary_en: 'Ending-note based certificate course. Group openings for institutions.',
    detail_ko: '대상: 웰다잉 강사·코치를 준비하는 분, 기관 단체\n내용: 엔딩노트 작성, 관계 정리, 의향서 실습, 코칭 실습\n준비: 과정 확정 후 안내\n취소·변경: 개설 확정 전까지 자유롭게 조정할 수 있습니다.',
    detail_en: 'For: aspiring well-dying coaches, institution groups\nContent: ending note, relationships, directives, coaching practice\nPrepare: shared after confirmation\nChanges: flexible until the course is confirmed.'},
  {service_id: 'consult-gya', active: 'Y', sort: 5, type: 'slot', category_ko: '상담', category_en: 'Consultation',
    name_ko: '국제개발협력·캄보디아 교실 후원 상담', name_en: 'Cambodia Classroom Support Consultation', duration_ko: '30분', duration_en: '30 min',
    mode_ko: '온라인', mode_en: 'Online', price_ko: '무료', price_en: 'Free',
    summary_ko: '캄보디아 무상영어교실 방문·후원·봉사 참여를 안내합니다.',
    summary_en: 'Visiting, sponsoring or volunteering at our free English classrooms in Cambodia.',
    detail_ko: '대상: 후원자, 봉사자, 협력 기관\n내용: 교실 운영 현황, 후원 방법, 방문·봉사 일정\n준비: 없음\n취소·변경: 언제든 알려 주세요.',
    detail_en: 'For: sponsors, volunteers, partner organizations\nContent: classroom status, how to give, visit and volunteer schedules\nPrepare: nothing\nChanges: anytime.'}
];

/* ================= 공통 도우미 ================= */

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('Missing sheet: ' + name + ' (setup()을 먼저 실행하세요)');
  return sh;
}

function readRows_(name) {
  var values = sheet_(name).getDataRange().getValues();
  if (values.length < 2) return [];
  var head = values[0];
  return values.slice(1).map(function (v) {
    var o = {};
    head.forEach(function (h, i) { o[h] = v[i]; });
    return o;
  });
}

function findRow_(name, key, value) {
  var sh = sheet_(name);
  var values = sh.getDataRange().getValues();
  var head = values[0], col = head.indexOf(key);
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][col]) === value) {
      var o = {};
      head.forEach(function (h, j) { o[h] = values[i][j]; });
      return {sheet: sh, index: i + 1, row: o};
    }
  }
  return null;
}

function appendRow_(name, obj) {
  var sh = sheet_(name);
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var row = head.map(function (h) { return obj[h] == null ? '' : obj[h]; });
  var r = sh.getLastRow() + 1;
  // 텍스트로 넣어 날짜·전화번호가 자동 변환되지 않게 합니다
  sh.getRange(r, 1, 1, row.length).setNumberFormat('@').setValues([row]);
}

var settingsCache_ = null;
function settings_() {
  if (settingsCache_) return settingsCache_;
  var o = {};
  readRows_(SHEET.SETTINGS).forEach(function (r) { o[r.key] = String(r.value == null ? '' : r.value).trim(); });
  settingsCache_ = o;
  return o;
}

function tz_() { return Session.getScriptTimeZone() || 'Asia/Seoul'; }
function todayStr_() { return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd'); }

function normDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
  var m = String(v || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : '';
}

function normTime_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, tz_(), 'HH:mm');
  var m = String(v || '').match(/^(\d{1,2}):(\d{2})/);
  return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : String(v || '');
}

function toDate_(ymd, hm) {
  var d = ymd.split('-').map(Number), t = String(hm).split(':').map(Number);
  return new Date(d[0], d[1] - 1, d[2], t[0] || 0, t[1] || 0);
}

function addDays_(ymd, n) {
  var d = toDate_(ymd, '12:00');
  d.setDate(d.getDate() + n);
  return Utilities.formatDate(d, tz_(), 'yyyy-MM-dd');
}

function firstPref_(s) { return String(s || '').split(',')[0].trim(); }
function digits_(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }
function clip_(s, n) { return String(s == null ? '' : s).trim().slice(0, n); }
