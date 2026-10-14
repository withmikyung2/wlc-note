import { getSettings, setSetting } from './db.js';

// 확인되지 않은 사업자 정보·강사 경력·수강료·시간표는 비워 두고 관리자 화면에서 입력함
export const DEFAULT_SETTINGS = {
  site_name_ko: '한국어로 잇다',
  site_name_en: 'Korean Together',
  tagline_ko: '한국어로 대화하고, 새로운 일상을 연결하세요.',
  tagline_en: 'Talk in Korean, connect to a new everyday life.',
  intro_ko: '자격을 갖춘 한국어 선생님과 함께, 나의 속도에 맞춰 배우는 온라인 한국어 수업.',
  intro_en: 'Online Korean classes with a qualified Korean teacher, at your own pace.',
  org_name: '',
  representative: '',
  business_reg_no: '',
  mail_order_reg_no: '',
  address: '',
  contact_email: '',
  phone: '',
  privacy_officer: '',
  terms_ko: '',
  terms_en: '',
  privacy_ko: '',
  privacy_en: '',
  refund_general_ko: '',
  refund_general_en: '',
  reference_rates: {}
};

const C = (o) => ({ formats: ['group', 'private'], level_min: 0, level_max: 4, ...o });

const COURSES = [
  C({
    slug: 'hangul-first-steps', sort: 1, category: 'foundation', level_min: 0, level_max: 0,
    formats: ['group', 'private', 'recorded'], purposes: ['study', 'daily', 'work', 'friends', 'travel', 'family', 'culture', 'hobby'],
    title_ko: '한글 첫걸음', title_en: 'Hangul First Steps',
    summary_ko: '한글 자음과 모음을 익히고, 소리 내어 읽고, 내 이름을 한국어로 씁니다.',
    summary_en: 'Learn Korean consonants and vowels, read aloud, and write your name in Korean.',
    level_ko: '입문 (한글을 처음 배우는 분)', level_en: 'Absolute beginner',
    prerequisites_ko: '필요 없음', prerequisites_en: 'None',
    goals_ko: ['한글 자모를 읽고 쓸 수 있다', '받침이 있는 글자를 소리 내어 읽을 수 있다', '간단한 인사와 자기소개를 할 수 있다'],
    goals_en: ['Read and write Hangul letters', 'Read syllables with final consonants aloud', 'Give simple greetings and introduce yourself'],
    lessons: [['기본 모음', 'Basic vowels'], ['기본 자음', 'Basic consonants'], ['글자 만들기', 'Building syllables'], ['받침', 'Final consonants'],
      ['겹모음', 'Compound vowels'], ['된소리·거센소리', 'Tense and aspirated sounds'], ['인사와 자기소개', 'Greetings and self-introduction'], ['읽기 연습과 정리', 'Reading practice and review']],
    materials_ko: '교재는 수업 전 안내합니다. 필기도구, 이어폰(마이크 포함).', materials_en: 'Materials announced before class. Notebook, earphones with microphone.'
  }),
  C({
    slug: 'everyday-korean', sort: 2, category: 'general', level_min: 1, level_max: 2,
    purposes: ['daily', 'friends', 'travel', 'family'],
    title_ko: '생활 한국어', title_en: 'Everyday Korean',
    summary_ko: '장보기, 길 묻기, 약속 잡기처럼 매일 쓰는 표현을 대화로 익힙니다.',
    summary_en: 'Practise the phrases you use every day: shopping, directions, making plans.',
    level_ko: '초급 (한글을 읽을 수 있는 분)', level_en: 'Beginner (can read Hangul)',
    prerequisites_ko: '한글을 천천히 읽을 수 있어야 합니다.', prerequisites_en: 'You can read Hangul slowly.',
    goals_ko: ['일상 상황에서 필요한 것을 요청할 수 있다', '시간·숫자·가격을 말하고 이해할 수 있다', '과거와 미래의 일을 짧게 말할 수 있다'],
    goals_en: ['Ask for what you need in daily situations', 'Say and understand time, numbers and prices', 'Talk briefly about past and future events'],
    lessons: [['숫자와 시간', 'Numbers and time'], ['가게에서', 'At the shop'], ['식당에서', 'At a restaurant'], ['길 묻기', 'Asking directions'],
      ['약속 잡기', 'Making plans'], ['하루 일과', 'My daily routine'], ['지난 주말', 'Last weekend'], ['종합 대화 연습', 'Conversation review']],
    materials_ko: '교재는 수업 전 안내합니다.', materials_en: 'Materials announced before class.'
  }),
  C({
    slug: 'campus-work-life', sort: 3, category: 'youth', level_min: 1, level_max: 4,
    purposes: ['study', 'work', 'friends', 'daily'],
    title_ko: '청년 생활·학교·직장 한국어', title_en: 'Korean for Campus, Work & Life',
    summary_ko: '유학 생활, 수업 참여, 아르바이트·직장, 친구 관계에 필요한 실용 한국어를 배웁니다.',
    summary_en: 'Practical Korean for studying abroad, classes, part-time jobs and work, and friendships.',
    level_ko: '초급~중급 (수준 확인 후 반 배정)', level_en: 'Beginner–intermediate (placement after level check)',
    prerequisites_ko: '한글 읽기와 기본 인사가 가능해야 합니다.', prerequisites_en: 'You can read Hangul and give basic greetings.',
    goals_ko: ['학교·직장에서 쓰는 높임말을 상황에 맞게 쓸 수 있다', '자기소개서·이메일·메시지를 짧게 쓸 수 있다', '친구·동료와 자연스럽게 대화할 수 있다'],
    goals_en: ['Use honorifics appropriately at school and work', 'Write a short self-introduction, email and messages', 'Chat naturally with friends and colleagues'],
    lessons: [['캠퍼스 생활', 'Campus life'], ['수업과 과제', 'Classes and assignments'], ['친구 사귀기', 'Making friends'], ['아르바이트 면접', 'Part-time job interviews'],
      ['직장 높임말', 'Workplace honorifics'], ['이메일과 메시지', 'Emails and messages'], ['발표하기', 'Giving a presentation'], ['나의 계획 말하기', 'Talking about my plans']]
  }),
  C({
    slug: 'travel-family-hobby', sort: 4, category: 'senior', level_min: 0, level_max: 3,
    purposes: ['travel', 'family', 'hobby', 'culture'],
    title_ko: '시니어 여행·가족·취미 한국어', title_en: 'Korean for Travel, Family & Hobbies',
    summary_ko: '여행, 가족과의 대화, 문화와 취미를 주제로 천천히 반복하며 배웁니다. 나이와 상관없이 같은 목적을 가진 분이라면 누구나 참여할 수 있습니다.',
    summary_en: 'Learn slowly with repetition around travel, family conversation, culture and hobbies. Open to anyone with these goals, whatever their age.',
    level_ko: '입문~초중급 (수준 확인 후 반 배정)', level_en: 'Beginner–lower intermediate (placement after level check)',
    prerequisites_ko: '필요 없음 (한글을 모르면 한글 첫걸음과 함께 추천)', prerequisites_en: 'None (Hangul First Steps recommended alongside if new to Hangul)',
    goals_ko: ['여행지에서 필요한 표현을 말할 수 있다', '가족에게 안부를 묻고 내 소식을 전할 수 있다', '좋아하는 취미와 문화를 한국어로 소개할 수 있다'],
    goals_en: ['Use key phrases while travelling', 'Ask after family members and share your news', 'Introduce your hobbies and favourite culture in Korean'],
    lessons: [['반가운 인사', 'Warm greetings'], ['가족 소개', 'Introducing family'], ['안부 묻기', 'Asking how someone is'], ['공항과 호텔', 'Airport and hotel'],
      ['교통과 길 찾기', 'Transport and directions'], ['음식 주문', 'Ordering food'], ['나의 취미', 'My hobbies'], ['사진으로 이야기하기', 'Telling stories with photos']]
  }),
  C({
    slug: 'culture-conversation', sort: 5, category: 'culture', level_min: 2, level_max: 4,
    purposes: ['culture', 'friends', 'hobby', 'daily'],
    title_ko: '한국 문화와 대화', title_en: 'Korean Culture & Conversation',
    summary_ko: '명절, 음식, 드라마·음악, 예절 등 한국 문화를 주제로 생각을 나누는 대화 수업입니다.',
    summary_en: 'Conversation classes on Korean holidays, food, dramas and music, and etiquette.',
    level_ko: '초중급 이상', level_en: 'Lower intermediate and above',
    prerequisites_ko: '간단한 생활 대화가 가능해야 합니다.', prerequisites_en: 'You can hold a simple everyday conversation.',
    goals_ko: ['문화 주제에 대해 내 생각을 말할 수 있다', '상황에 맞는 예절 표현을 쓸 수 있다', '짧은 글과 영상을 이해하고 요약할 수 있다'],
    goals_en: ['Share your views on cultural topics', 'Use polite expressions that suit the situation', 'Understand and summarise short texts and videos'],
    lessons: [['설날과 추석', 'Seollal and Chuseok'], ['한국의 음식 문화', 'Food culture'], ['드라마와 음악', 'Dramas and music'], ['예절과 높임말', 'Etiquette and honorifics'],
      ['한국의 도시와 여행지', 'Cities and destinations'], ['세대와 가족', 'Generations and family'], ['요즘 한국', 'Korea today'], ['나의 문화 소개 발표', 'Presenting my own culture']]
  }),
  C({
    slug: 'private-tailored', sort: 6, category: 'private', level_min: 0, level_max: 4,
    formats: ['private'], purposes: ['study', 'daily', 'work', 'friends', 'travel', 'family', 'culture', 'hobby'],
    title_ko: '1:1 맞춤 한국어', title_en: '1:1 Tailored Korean',
    summary_ko: '수준 확인과 상담을 바탕으로 학습 목표와 속도를 함께 정하는 개인 수업입니다.',
    summary_en: 'Private lessons where goals and pace are set together after a level check and consultation.',
    level_ko: '모든 수준', level_en: 'All levels',
    prerequisites_ko: '필요 없음 (상담 후 시작)', prerequisites_en: 'None (starts after consultation)',
    goals_ko: ['나에게 필요한 목표를 정하고 단계별로 달성한다', '원하는 일정과 속도로 학습한다'],
    goals_en: ['Set personal goals and reach them step by step', 'Learn on your own schedule and pace'],
    lessons: [['상담과 수준 확인', 'Consultation and level check'], ['목표별 맞춤 학습', 'Goal-based lessons'], ['중간 점검', 'Progress check'], ['다음 단계 계획', 'Planning the next step']]
  })
];

const FAQS = [
  ['수준 확인 결과는 공식 성적인가요?', 'Is the level check an official score?',
    '아닙니다. 사이트의 수준 확인은 과정 선택을 돕는 학습 안내용이며, 공식 한국어 능력 인증이나 시험 성적이 아닙니다.',
    'No. The level check only helps you choose a course. It is not an official Korean proficiency certificate or test score.'],
  ['나이에 따라 반이 정해지나요?', 'Are classes grouped by age?',
    '아닙니다. 한국어 수준, 학습 목적, 희망 속도를 기준으로 과정을 추천합니다.',
    'No. Courses are recommended by your Korean level, learning goal and preferred pace.'],
  ['수업 시간은 어느 시간대 기준인가요?', 'Which time zone are class times in?',
    '각 과정의 기준 시간대와 함께, 내 기기에 설정된 현지 시간으로도 표시합니다.',
    'Each class shows its base time zone together with your local time.'],
  ['화상수업 링크는 어디에서 보나요?', 'Where do I find the video class link?',
    '결제와 수강 등록이 끝나면 \'나의 학습\'에서 \'수업 참여하기\' 버튼으로 확인할 수 있습니다. 링크는 등록한 학습자에게만 보입니다.',
    'After payment and enrolment, use "Join class" in My Learning. Links are shown only to enrolled learners.'],
  ['수강료와 일정은 언제 알 수 있나요?', 'When will fees and schedules be announced?',
    '확정되지 않은 수강료와 일정은 \'추후 안내\'로 표시되며, 확정 전에는 결제할 수 없습니다.',
    'Unconfirmed fees and schedules show as "To be announced" and cannot be paid for until confirmed.']
];

const REVIEW = [
  ['"안녕하세요"는 언제 쓰나요? / When do you say "안녕하세요"?', ['처음 만날 때·인사할 때 / Greeting someone', '헤어질 때만 / Only when leaving', '밥 먹을 때 / When eating'], 0],
  ['"만나서 반갑습니다"의 뜻은? / Meaning of "만나서 반갑습니다"?', ['감사합니다 / Thank you', '만나서 반갑습니다 / Nice to meet you', '미안합니다 / Sorry'], 1],
  ['ㄱ + ㅏ = ?', ['나', '가', '다'], 1]
];

export function seed(db) {
  const current = getSettings(db);
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) if (!(k in current)) setSetting(db, k, v);

  if (db.prepare('SELECT COUNT(*) n FROM courses').get().n === 0) {
    const ins = db.prepare(`INSERT INTO courses(slug, sort, category, title_ko, title_en, summary_ko, summary_en, level_ko, level_en,
      prerequisites_ko, prerequisites_en, goals_ko, goals_en, formats, purposes, level_min, level_max, materials_ko, materials_en)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const lesson = db.prepare('INSERT INTO lessons(course_id, no, title_ko, title_en) VALUES (?,?,?,?)');
    for (const c of COURSES) {
      const r = ins.run(c.slug, c.sort, c.category, c.title_ko, c.title_en, c.summary_ko, c.summary_en, c.level_ko, c.level_en,
        c.prerequisites_ko, c.prerequisites_en, JSON.stringify(c.goals_ko), JSON.stringify(c.goals_en), JSON.stringify(c.formats),
        JSON.stringify(c.purposes), c.level_min, c.level_max, c.materials_ko || '', c.materials_en || '');
      c.lessons.forEach(([ko, en], i) => lesson.run(r.lastInsertRowid, i + 1, ko, en));
      if (c.slug === 'hangul-first-steps') {
        const ri = db.prepare('INSERT INTO review_items(course_id, lesson_no, prompt, choices, answer) VALUES (?,?,?,?,?)');
        REVIEW.forEach(([p, ch, a], i) => ri.run(r.lastInsertRowid, i < 2 ? 7 : 3, p, JSON.stringify(ch), a));
      }
    }
  }
  if (db.prepare('SELECT COUNT(*) n FROM faqs').get().n === 0) {
    const f = db.prepare('INSERT INTO faqs(sort, q_ko, q_en, a_ko, a_en) VALUES (?,?,?,?,?)');
    FAQS.forEach((row, i) => f.run(i + 1, ...row));
  }
}
