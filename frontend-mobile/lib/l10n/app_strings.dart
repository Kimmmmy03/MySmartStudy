import 'package:flutter/material.dart';
import '../utils/locale_provider.dart';

/// Simple localization helper. Access via `S.of(context).key`.
class S {
  final Locale _locale;
  S(this._locale);

  static S of(BuildContext context) {
    return S(LocaleScope.of(context).locale);
  }

  String get _code => _locale.languageCode;

  String _t(String en, String ms) => _code == 'ms' ? ms : en;

  // ── Common ──
  String get appName => 'MySmartStudy';
  String get cancel => _t('Cancel', 'Batal');
  String get save => _t('Save', 'Simpan');
  String get delete => _t('Delete', 'Padam');
  String get confirm => _t('Confirm', 'Sahkan');
  String get retry => _t('Retry', 'Cuba Semula');
  String get ok => _t('OK', 'OK');
  String get done => _t('Done', 'Selesai');
  String get next => _t('Next', 'Seterusnya');
  String get skip => _t('Skip', 'Langkau');
  String get close => _t('Close', 'Tutup');
  String get search => _t('Search', 'Cari');
  String get loading => _t('Loading...', 'Memuatkan...');
  String get error => _t('Error', 'Ralat');
  String get success => _t('Success', 'Berjaya');
  String get noData => _t('No data', 'Tiada data');

  // ── Auth ──
  String get signIn => _t('Sign In', 'Log Masuk');
  String get signUp => _t('Sign Up', 'Daftar');
  String get signOut => _t('Log Out', 'Log Keluar');
  String get email => _t('Email', 'E-mel');
  String get password => _t('Password', 'Kata Laluan');
  String get forgotPassword => _t('Forgot password?', 'Lupa kata laluan?');
  String get signInToContinue => _t('Sign in to continue', 'Log masuk untuk meneruskan');
  String get createAccount => _t('Create Account', 'Cipta Akaun');
  String get dontHaveAccount => _t("Don't have an account?", 'Belum mempunyai akaun?');
  String get alreadyHaveAccount => _t('Already have an account?', 'Sudah mempunyai akaun?');
  String get orContinueWith => _t('OR', 'ATAU');
  String get signInWithGoogle => _t('Sign in with Google', 'Log masuk dengan Google');
  String get resetPasswordSent => _t('Password reset email sent!', 'E-mel tetapan semula kata laluan dihantar!');

  // ── Nav ──
  String get navHome => _t('Home', 'Utama');
  String get navCourses => _t('Courses', 'Kursus');
  String get navClassManagement => _t('Class Management', 'Pengurusan Kelas');
  String get navPlanner  => _t('Planner',  'Perancang');
  String get navSchedule => _t('Schedule', 'Jadual');
  String get navCalendar => _t('Calendar', 'Kalendar');
  String get navMaps => _t('Maps', 'Peta');
  String get navReviewMaps => _t('Review Maps', 'Semak Peta');
  String get navProfile => _t('Profile', 'Profil');

  // ── Home ──
  String get greetingMorning => _t('Good morning', 'Selamat pagi');
  String get greetingAfternoon => _t('Good afternoon', 'Selamat tengah hari');
  String get greetingEvening => _t('Good evening', 'Selamat petang');
  String get quickAccess => _t('Quick Access', 'Akses Pantas');
  String get recentMaps => _t('Recent Maps', 'Peta Terkini');
  String get recentBadges => _t('Recent Badges', 'Lencana Terkini');
  String get viewAll => _t('View All', 'Lihat Semua');
  String get tipOfTheDay => _t('Tip of the Day', 'Tip Hari Ini');
  String get upcomingDeadlines => _t('Upcoming Deadlines', 'Tarikh Akhir Akan Datang');
  String get todaysTasks => _t("Today's Tasks", 'Tugasan Hari Ini');
  String get courseActivity => _t('Course Activity', 'Aktiviti Kursus');
  String get noUpcomingDeadlines => _t('No upcoming deadlines', 'Tiada tarikh akhir akan datang');
  String get student => _t('Student', 'Pelajar');
  String get lecturer => _t('Lecturer', 'Pensyarah');

  // ── Quick Actions ──
  String get notifications => _t('Notifications', 'Pemberitahuan');
  String get messages => _t('Messages', 'Mesej');
  String get calendar => _t('Calendar', 'Kalendar');
  String get activity => _t('Activity', 'Aktiviti');
  String get certificates => _t('Certificates', 'Sijil');
  String get studyGuide => _t('Study Guide', 'Panduan Belajar');
  String get examPlan => _t('Exam Plan', 'Rancangan Peperiksaan');
  String get aiMaterials => _t('AI Materials', 'Bahan AI');
  String get learningPlan => _t('Learning Plan', 'Rancangan Pembelajaran');

  // ── Stats ──
  String get maps => _t('Maps', 'Peta');
  String get streak => _t('Streak', 'Kesinambungan');
  String get points => _t('Points', 'Mata');
  String get courses => _t('Courses', 'Kursus');
  String get badges => _t('Badges', 'Lencana');

  // ── Profile ──
  String get darkMode => _t('Dark Mode', 'Mod Gelap');
  String get toggleTheme => _t('Toggle light / dark theme', 'Tukar tema terang / gelap');
  String get language => _t('Language', 'Bahasa');
  String get languageSubtitle => _t('Switch between English and Malay', 'Tukar antara Inggeris dan Melayu');
  String get english => _t('English', 'Inggeris');
  String get malay => _t('Bahasa Melayu', 'Bahasa Melayu');
  String get settings => _t('SETTINGS', 'TETAPAN');
  String get account => _t('ACCOUNT', 'AKAUN');
  String get achievements => _t('ACHIEVEMENTS', 'PENCAPAIAN');
  String get editDisplayName => _t('Edit Display Name', 'Edit Nama Paparan');
  String get updateNameSubtitle => _t('Update how your name appears', 'Kemas kini nama yang dipaparkan');
  String get resetPassword => _t('Reset Password', 'Tetapkan Semula Kata Laluan');
  String get resetPasswordSubtitle => _t('Send a password reset email', 'Hantar e-mel tetapan semula kata laluan');
  String get logOut => _t('Log Out', 'Log Keluar');
  String get logOutSubtitle => _t('Sign out of your account', 'Log keluar dari akaun anda');
  String get logOutConfirm => _t('Are you sure you want to log out?', 'Adakah anda pasti mahu log keluar?');

  // ── Courses / Subjects ──
  String get myClasses => _t('My Classes', 'Kelas Saya');
  String get myCourses => _t('My Courses', 'Kursus Saya');
  String get joinCourse => _t('Join Course', 'Sertai Kursus');
  String get joinCode => _t('Join Code', 'Kod Penyertaan');
  String get createCourse => _t('Create Course', 'Cipta Kursus');
  String get students => _t('students', 'pelajar');
  String get joinedSuccess => _t('Joined course successfully!', 'Berjaya menyertai kursus!');
  String get courseTools => _t('Course Tools', 'Alat Kursus');

  // ── Course Tools ──
  String get resources => _t('Resources', 'Sumber');
  String get assignments => _t('Assignments', 'Tugasan');
  String get quizzes => _t('Quizzes', 'Kuiz');
  String get forum => _t('Forum', 'Forum');
  String get gradebook => _t('Gradebook', 'Buku Gred');
  String get attendance => _t('Attendance', 'Kehadiran');
  String get announcements => _t('Announcements', 'Pengumuman');
  String get classChat => _t('Class Chat', 'Sembang Kelas');
  String get peerReviews => _t('Peer Reviews', 'Ulasan Rakan');
  String get completion => _t('Completion', 'Penyelesaian');
  String get groups => _t('Groups', 'Kumpulan');

  // ── Planner ──
  String get planner => _t('Planner', 'Perancang');
  String get addTask => _t('Add Task', 'Tambah Tugasan');
  String get title => _t('Title', 'Tajuk');
  String get category => _t('Category', 'Kategori');
  String get priority => _t('Priority', 'Keutamaan');
  String get high => _t('High', 'Tinggi');
  String get medium => _t('Medium', 'Sederhana');
  String get low => _t('Low', 'Rendah');
  String get completed => _t('Completed', 'Selesai');

  // ── Mind Maps ──
  String get mindMaps => _t('Mind Maps', 'Peta Minda');
  String get noMindMaps => _t('No Mind Maps found', 'Tiada Peta Minda ditemui');
  String get createOnWeb => _t('Create them on the Web App', 'Cipta di Aplikasi Web');
  String get renameMap => _t('Rename Map', 'Namakan Semula Peta');
  String get deleteMap => _t('Delete Map?', 'Padam Peta?');

  // ── Tutorial ──
  String get tutorialWelcomeTitle => _t('Welcome!', 'Selamat Datang!');
  String get tutorialWelcomeDesc => _t(
    'This is your dashboard where you can see your progress and access everything.',
    'Ini adalah papan pemuka anda di mana anda boleh melihat kemajuan dan mengakses segala-galanya.',
  );
  String get tutorialStatsTitle => _t('Your Stats', 'Statistik Anda');
  String get tutorialStatsDesc => _t(
    'Track your mind maps, streak, and points here.',
    'Jejaki peta minda, kesinambungan, dan mata anda di sini.',
  );
  String get tutorialQuickTitle => _t('Quick Access', 'Akses Pantas');
  String get tutorialQuickDesc => _t(
    'Quickly access notifications, messages, calendar, and AI tools.',
    'Akses pantas ke pemberitahuan, mesej, kalendar, dan alat AI.',
  );
  String get tutorialNavTitle => _t('Navigation', 'Navigasi');
  String get tutorialNavDesc => _t(
    'Switch between Home, Courses, Planner, Maps, and Profile.',
    'Tukar antara Utama, Kursus, Perancang, Peta, dan Profil.',
  );
  String get tutorialDoneTitle => _t("You're All Set!", 'Anda Sudah Sedia!');
  String get tutorialDoneDesc => _t(
    'Start exploring MySmartStudy. You can always access help from your profile.',
    'Mula meneroka MySmartStudy. Anda boleh mengakses bantuan dari profil anda.',
  );
  String get getStarted => _t('Get Started', 'Mulakan');

  // ── Deadlines ──
  String dueIn(String time) => _t('Due in $time', 'Tarikh akhir dalam $time');
  String get overdue => _t('Overdue', 'Lewat');
  String daysLeft(int n) => _t('$n day${n == 1 ? '' : 's'}', '$n hari');
  String hoursLeft(int n) => _t('$n hour${n == 1 ? '' : 's'}', '$n jam');
  String tasksCompleted(int done, int total) =>
      _t('$done of $total completed', '$done daripada $total selesai');
}
