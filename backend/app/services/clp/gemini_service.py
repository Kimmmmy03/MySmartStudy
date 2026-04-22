"""
CLP — Gemini AI Service

Uses the centralized google-genai client from app.ai_service.
Generates weekly teaching plan content in Bahasa Melayu.
"""

import asyncio
import json
import re
from google import genai
from app.ai_service import _get_client
from app.services.clp.config import settings, build_system_prompt


def _extract_field(data: dict, *keys) -> str:
    """Extract a field from AI response, trying multiple possible key names."""
    for key in keys:
        val = data.get(key)
        if val is not None and val != "":
            if isinstance(val, list):
                return "\n".join(str(item) for item in val)
            return str(val).strip()
    return ""


EXCEPTION_WEEK_LABELS: tuple[str, ...] = (
    "CUTI PERTENGAHAN SEMESTER IPG",
    "MINGGU ULANGKAJI",
    "PEPERIKSAAN AKHIR",
    "CUTI AKHIR SEMESTER IPG",
)


def is_exception_week(topik: str) -> bool:
    """Return True if the topik is an exception-week label (holiday / exam / break)."""
    t = topik.strip().upper()
    return any(label in t or t in label for label in EXCEPTION_WEEK_LABELS)


def _build_prompt(topik: str, minggu: int) -> str:
    """Build a Bahasa Melayu prompt for a single week."""
    return (
        f"Topik Minggu {minggu}: {topik}\n\n"
        "Berdasarkan topik di atas, sila berikan dalam format JSON.\n"
        "JSON MESTI mempunyai LIMA kunci sahaja: hasil_pembelajaran, strategi, refleksi_kuliah, refleksi_tutorial, refleksi_epembelajaran\n"
        "Setiap nilai MESTI berupa STRING (teks biasa), BUKAN array atau list.\n\n"
        "Contoh format jawapan (IKUT PANJANG DAN GAYA INI):\n"
        "{\n"
        '  "hasil_pembelajaran": "Pada akhir sesi ini, pelajar dapat:\\n'
        "i. Menjelaskan definisi dan konsep asas topik ini berdasarkan pandangan tokoh-tokoh utama dalam bidang pendidikan dengan merujuk kepada konteks pendidikan di Malaysia\\n"
        "ii. Menghuraikan ciri-ciri utama dan prinsip-prinsip yang mendasari topik ini secara terperinci dengan memberikan contoh-contoh yang relevan dalam situasi bilik darjah\\n"
        "iii. Menganalisis hubungan antara teori dan amalan dalam konteks pengajaran dan pembelajaran di sekolah rendah dengan membuat perbandingan antara pendekatan yang berbeza\\n"
        "iv. Mengaplikasikan pengetahuan topik ini dalam merancang aktiviti pengajaran dan pembelajaran yang berkesan serta sesuai dengan tahap perkembangan murid\\n"
        'v. Menilai kepentingan topik ini dalam pembangunan profesionalisme guru dan perkembangan murid secara holistik merangkumi aspek kognitif, afektif dan psikomotor",\n'
        '  "strategi": "Kuliah\\n'
        "- Pensyarah memulakan sesi dengan tayangan slaid berkaitan definisi dan konsep utama topik.\\n"
        "- Pensyarah menerangkan teori-teori dan pandangan tokoh utama menggunakan peta minda di papan putih.\\n"
        "- Aktiviti soal jawab dijalankan secara berstruktur menggunakan teknik Think-Pair-Share.\\n"
        "- Pensyarah menunjukkan video pendek atau kajian kes berkaitan aplikasi topik.\\n"
        "- Pensyarah membuat rumusan keseluruhan dan mengaitkan topik dengan isu semasa.\\n\\n"
        "Tutorial\\n"
        "- Pelajar dibahagikan kepada kumpulan kecil untuk membincangkan soalan tugasan.\\n"
        "- Setiap kumpulan menyediakan peta minda atau poster ringkas.\\n"
        "- Pembentangan kumpulan dijalankan selama 5-7 minit setiap kumpulan.\\n"
        "- Aktiviti refleksi bertulis: pelajar menulis 3 perkara utama yang dipelajari.\\n\\n"
        "E-pembelajaran\\n"
        "- Pelajar diminta menyertai forum perbincangan dalam talian melalui Google Classroom.\\n"
        "- Kuiz interaktif menggunakan Kahoot dijalankan untuk menguji kefahaman pelajar.\\n"
        '- Pelajar membina infografik atau peta minda digital menggunakan Canva.",\n'
        '  "refleksi_kuliah": "Sesi kuliah minggu ini memberi tumpuan kepada penguasaan ilmu teoritikal yang mendalam. '
        "Pelajar didedahkan kepada konsep-konsep teras dan prinsip asas yang menjadi landasan. "
        "Sesi syarahan berlangsung dengan lancar di mana pelajar menunjukkan penglibatan yang aktif. "
        "Penggunaan pelbagai bahan bantu mengajar berjaya memperkukuh pemahaman pelajar. "
        'Bagi sesi akan datang, pensyarah merancang untuk mengintegrasikan lebih banyak kajian kes.",\n'
        '  "refleksi_tutorial": "Sesi tutorial minggu ini direka bentuk untuk mengukuhkan penerapan teori melalui aktiviti hands-on. '
        "Pelajar bekerja dalam kumpulan kecil untuk menyelesaikan tugasan praktikal. "
        "Kebanyakan kumpulan berjaya mengemukakan penyelesaian yang kreatif dan berasas teori. "
        "Aktiviti penyelesaian masalah berstruktur berjaya merangsang diskusi mendalam. "
        'Pensyarah akan menambah baik reka bentuk tugasan tutorial.",\n'
        '  "refleksi_epembelajaran": "Sesi e-pembelajaran minggu ini memberikan peluang kepada pelajar untuk meneroka kandungan secara kendiri. '
        "Pelajar menunjukkan tahap penyertaan yang menggalakkan dalam forum perbincangan Google Classroom. "
        "Penggunaan platform digital berjaya meningkatkan motivasi pelajar. "
        "Disiplin diri dan kemahiran pengurusan masa pelajar turut diuji. "
        'Penambahbaikan termasuk menyediakan panduan penggunaan platform yang lebih terperinci."\n'
        "}\n\n"
        "PERATURAN PENTING:\n"
        "- hasil_pembelajaran: Bermula dengan 'Pada akhir sesi ini, pelajar dapat:' "
        "diikuti 5-6 poin menggunakan penomboran Roman kecil (i. ii. iii. iv. v. vi.). "
        "SETIAP POIN mesti PANJANG (sekurang-kurangnya 20 patah perkataan).\n"
        "- strategi: WAJIB ada bahagian Kuliah, Tutorial, DAN E-pembelajaran. "
        "Kuliah mesti ada 5-6 aktiviti, Tutorial 4-5, E-pembelajaran 3-4. "
        "SETIAP aktiviti mesti PANJANG (sekurang-kurangnya 25 patah perkataan).\n"
        "- refleksi_kuliah: MESTI 1-2 perenggan PANJANG (sekurang-kurangnya 6-7 ayat). FOKUS pada aspek teoritikal.\n"
        "- refleksi_tutorial: MESTI 1-2 perenggan PANJANG (sekurang-kurangnya 6-7 ayat). FOKUS pada aspek praktikal.\n"
        "- refleksi_epembelajaran: MESTI 1-2 perenggan PANJANG (sekurang-kurangnya 6-7 ayat). FOKUS pada aspek pembelajaran kendiri digital.\n"
        "- SETIAP refleksi MESTI berbeza sepenuhnya dalam isi dan tumpuan.\n"
        "- Bahasa Melayu akademik\n"
        "- JANGAN tinggalkan mana-mana kunci kosong"
    )


async def enrich_week(topik: str, minggu: int, nama_kursus: str = "", program: str = "", detail_level: str = "normal") -> dict:
    """
    Call Gemini API to enrich a single week's content.
    Returns dict with hasil_pembelajaran, strategi_aktiviti, refleksi, refleksi_tutorial, refleksi_epembelajaran.
    """
    effective_topik = topik.strip() if topik else ""
    if not effective_topik or is_exception_week(effective_topik):
        return {
            "hasil_pembelajaran": "",
            "strategi_aktiviti": "",
            "refleksi": "",
            "refleksi_tutorial": "",
            "refleksi_epembelajaran": "",
        }

    prompt = _build_prompt(effective_topik, minggu)
    system_prompt = build_system_prompt(nama_kursus, program, detail_level)

    MAX_RETRIES = 2
    client = _get_client()

    token_limits = {"normal": 4096, "terperinci": 10240}
    max_tokens = token_limits.get(detail_level, 8192)

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=settings.GEMINI_MODEL,
                contents=prompt,
                config=genai.types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.5,
                    max_output_tokens=max_tokens,
                    response_mime_type="application/json",
                ),
            )

            raw_text = response.text
            print(f"[CLP Gemini] Week {minggu} (attempt {attempt}): {raw_text[:200]}")

            data = json.loads(raw_text)

            hasil = _extract_field(data,
                "hasil_pembelajaran", "hasilPembelajaran", "hasil",
                "learning_outcomes", "outcomes")
            strategi = _extract_field(data,
                "strategi", "strategi_aktiviti", "strategiAktiviti",
                "strategi_pengajaran", "aktiviti", "strategy", "activities")
            refleksi_kuliah = _extract_field(data,
                "refleksi_kuliah", "refleksi", "reflection", "catatan_refleksi")
            refleksi_tutorial = _extract_field(data,
                "refleksi_tutorial")
            refleksi_epembelajaran = _extract_field(data,
                "refleksi_epembelajaran", "refleksi_e_pembelajaran",
                "refleksi_elearning", "e_pembelajaran")

            if not refleksi_kuliah:
                refleksi_kuliah = f"Pelajar dapat memahami topik Minggu {minggu} dengan baik."
            if not refleksi_tutorial:
                refleksi_tutorial = refleksi_kuliah
            if not refleksi_epembelajaran:
                refleksi_epembelajaran = f"Pelajar menunjukkan penglibatan yang baik dalam aktiviti e-pembelajaran Minggu {minggu}."

            return {
                "hasil_pembelajaran": hasil or f"Hasil pembelajaran Minggu {minggu}",
                "strategi_aktiviti": strategi or f"Kuliah\nPerbincangan topik Minggu {minggu}\n\nTutorial\nLatihan dan pembentangan\n\nE-pembelajaran\nForum perbincangan dalam talian",
                "refleksi": refleksi_kuliah,
                "refleksi_tutorial": refleksi_tutorial,
                "refleksi_epembelajaran": refleksi_epembelajaran,
            }

        except json.JSONDecodeError as e:
            print(f"[CLP Gemini JSON Error] Week {minggu} (attempt {attempt}/{MAX_RETRIES}): {e}")
            if attempt < MAX_RETRIES:
                await asyncio.sleep(2)
                continue
            return {
                "hasil_pembelajaran": f"Hasil pembelajaran Minggu {minggu}",
                "strategi_aktiviti": f"Kuliah\nPerbincangan topik Minggu {minggu}\n\nTutorial\nLatihan dan pembentangan\n\nE-pembelajaran\nForum perbincangan dalam talian",
                "refleksi": f"Pelajar dapat memahami topik Minggu {minggu} dengan baik.",
                "refleksi_tutorial": f"Pelajar dapat memahami topik Minggu {minggu} dengan baik.",
                "refleksi_epembelajaran": f"Pelajar menunjukkan penglibatan yang baik dalam aktiviti e-pembelajaran Minggu {minggu}.",
            }

        except Exception as e:
            error_msg = str(e)[:80]
            print(f"[CLP Gemini Error] Week {minggu}: {e}")
            return {
                "hasil_pembelajaran": f"Ralat AI - Minggu {minggu}: {error_msg}",
                "strategi_aktiviti": "",
                "refleksi": "",
                "refleksi_tutorial": "",
                "refleksi_epembelajaran": "",
            }

    return {
        "hasil_pembelajaran": f"Hasil pembelajaran Minggu {minggu}",
        "strategi_aktiviti": "",
        "refleksi": "",
        "refleksi_tutorial": "",
        "refleksi_epembelajaran": "",
    }


async def extract_file_content(raw_text: str) -> dict:
    """
    Use Gemini to extract metadata and weekly data from raw file text.
    Returns dict with 'metadata' and 'weeks' keys.
    """
    prompt = (
        "Anda adalah pakar dalam membaca dokumen rancangan pengajaran IPG (Institut Pendidikan Guru).\n"
        "Berikut adalah kandungan fail silabus/rancangan pengajaran.\n"
        "Data disusun sebagai 'label : nilai'. Setiap baris mengandungi satu atau lebih pasangan label-nilai.\n\n"
        "KANDUNGAN FAIL:\n"
        f"{raw_text}\n\n"
        "TUGAS ANDA: Ekstrak SEMUA maklumat di bawah. Baca SETIAP baris dengan teliti.\n\n"
        "MEDAN METADATA YANG PERLU DICARI:\n"
        "- program, semester, tahun, pensyarah, ambilan, jabatan, kumpulan_diajar, nama_kursus, kod_kursus, jumlah_kredit\n\n"
        "ARAHAN MINGGUAN: Ekstrak TEPAT 19 minggu (Minggu 1 hingga Minggu 19).\n"
        "PENGENDALIAN MINGGU PENGECUALIAN:\n"
        "  * 'CUTI PERTENGAHAN SEMESTER IPG'\n"
        "  * 'MINGGU ULANGKAJI'\n"
        "  * 'PEPERIKSAAN AKHIR'\n"
        "  * 'CUTI AKHIR SEMESTER IPG'\n\n"
        "Pulangkan JSON:\n"
        "{\n"
        '  "metadata": {\n'
        '    "program": "", "semester": "", "tahun": "", "pensyarah": "",\n'
        '    "ambilan": "", "jabatan": "", "kumpulan_diajar": [],\n'
        '    "nama_kursus": "", "kod_kursus": "", "jumlah_kredit": ""\n'
        "  },\n"
        '  "weeks": [{"minggu": 1, "tarikh": "", "topik": "", "jam": "", "catatan": ""}]\n'
        "}\n\n"
        "PERATURAN: WAJIB isi SEMUA medan metadata. WAJIB 19 entri weeks. Pulangkan JSON sahaja."
    )

    try:
        client = _get_client()

        response = await asyncio.to_thread(
            client.models.generate_content,
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=8000,
                response_mime_type="application/json",
            ),
        )

        raw_response = response.text
        cleaned = raw_response.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*\n?", "", cleaned)
            cleaned = re.sub(r"\n?```\s*$", "", cleaned)
        cleaned = re.sub(r",\s*([}\]])", r"\1", cleaned)
        cleaned = cleaned.strip()

        data = json.loads(cleaned)

        if "metadata" not in data or "weeks" not in data:
            raise ValueError("Response missing 'metadata' or 'weeks' keys")

        return data

    except Exception as e:
        print(f"[CLP Gemini Extract Error] {e}")
        raise
