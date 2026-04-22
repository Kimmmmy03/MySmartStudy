/// Predefined dropdown options for IPG Kampus Perempuan Melayu Melaka.
/// Keep in sync with `frontend-web/src/lib/constants.ts`.
library;

const List<String> kDepartments = [
  'Jabatan Sains Sosial',
  'Jabatan Pengajian Melayu',
  'Jabatan Pendidikan Jasmani dan Kesihatan',
  'Jabatan Teknologi Pendidikan',
  'Jabatan Matematik dan Sains',
  'Jabatan Pengajian Islam',
  'Jabatan Bahasa Inggeris',
  'Jabatan Pengajian Cina',
  'Jabatan Pengajian Tamil',
  'Jabatan Ilmu Pendidikan',
  'Jabatan Hal Ehwal Pelajar',
];

const List<String> kClassUnits = [
  // PISMP (Bachelor — Pendidikan Rendah)
  'PISMP Bahasa Melayu',
  'PISMP Bahasa Inggeris (TESL)',
  'PISMP Bahasa Cina (SJKC)',
  'PISMP Bahasa Tamil (SJKT)',
  'PISMP Bahasa Arab',
  'PISMP Matematik',
  'PISMP Sains',
  'PISMP Sejarah',
  'PISMP Reka Bentuk & Teknologi (RBT)',
  'PISMP Teknologi Maklumat & Komunikasi (TMK)',
  'PISMP Pendidikan Islam',
  'PISMP Pendidikan Moral',
  'PISMP Pendidikan Jasmani & Kesihatan',
  'PISMP Pendidikan Seni Visual',
  'PISMP Pendidikan Muzik',
  'PISMP Pendidikan Awal Kanak-kanak (PAKK)',
  'PISMP Pendidikan Khas (Masalah Pembelajaran)',
  'PISMP Pendidikan Khas (Masalah Pendengaran)',
  'PISMP Pendidikan Khas (Masalah Penglihatan)',
  'PISMP Bimbingan & Kaunseling',

  // PPISMP (Foundation)
  'PPISMP Bahasa Melayu',
  'PPISMP Bahasa Inggeris (TESL)',
  'PPISMP Bahasa Cina',
  'PPISMP Bahasa Tamil',
  'PPISMP Bahasa Arab',
  'PPISMP Matematik',
  'PPISMP Sains',
  'PPISMP Sejarah',
  'PPISMP Reka Bentuk & Teknologi',
  'PPISMP Pendidikan Islam',
  'PPISMP Pendidikan Jasmani & Kesihatan',
  'PPISMP Pendidikan Seni Visual',
  'PPISMP Pendidikan Muzik',
  'PPISMP Pendidikan Awal Kanak-kanak',
  'PPISMP Pendidikan Khas (Masalah Pembelajaran)',
  'PPISMP Bimbingan & Kaunseling',

  // Post-graduate / Master's pathways
  'DPLI Pendidikan Rendah',
  'KPLD Pendidikan Rendah',
  'PISP Pendidikan Rendah',
];

/// Sentinel value used in dropdowns to signal "user wants to type a custom
/// value that isn't in the preset list".
const String kOtherOption = '__other__';
