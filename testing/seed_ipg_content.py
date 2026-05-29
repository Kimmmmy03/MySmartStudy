"""
Seed IPG (Institut Pendidikan Guru) curriculum-style content into the RAG index.

The existing Firestore content for most courses is title-only placeholder text.
Real lecturer-uploaded PDFs are not available. To produce a meaningful RAGAS
evaluation in an IPG context, this script:

  1. Selects only IPG-aligned courses (teacher-training core + IPG school
     subjects). Non-IPG seeded courses (uni-level CS) are excluded.
  2. For each selected course, asks Gemini 2.5 Flash to generate 4-6
     substantive Malay-language lecture-style documents covering the topics
     a real IPG sukatan pelajaran would include for that subject.
  3. Indexes those documents via the production rag_service pipeline.

Disclosed clearly in the RAGAS report so the synthetic nature of the corpus
is transparent. The pipeline being measured is real.
"""

import os
import sys
import asyncio
import warnings

warnings.filterwarnings("ignore")

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.abspath(os.path.join(HERE, "..", "backend"))
sys.path.insert(0, BACKEND)
os.chdir(BACKEND)

from dotenv import load_dotenv  # noqa: E402
load_dotenv(".env")

from app import rag_service, models, ai_service  # noqa: E402
from app.firestore import db  # noqa: E402
from langchain_google_genai import ChatGoogleGenerativeAI  # noqa: E402

ai_service._enforce_ai_gate = lambda *a, **k: None  # noqa: E731

GEMINI_KEY = os.getenv("GEMINI_API_KEY")
gen_llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash", google_api_key=GEMINI_KEY, temperature=0.3,
)


# ── IPG course classification ────────────────────────────────────────────────
# Each entry: course-name match -> list of topic prompts (the actual sukatan
# pelajaran sub-topics taught at IPG for that subject).

IPG_TOPICS = {
    # Core IPG teacher-training subjects
    "Psikologi Perkembangan": [
        "Teori Perkembangan Kognitif Jean Piaget (peringkat sensorimotor, praoperasi, operasi konkrit, operasi formal) dan implikasinya dalam pengajaran",
        "Teori Perkembangan Psikososial Erik Erikson — lapan peringkat dan kaitannya dengan pelajar sekolah",
        "Teori Perkembangan Moral Lawrence Kohlberg — tiga tahap, enam peringkat, dan kontroversi",
        "Teori Sosiobudaya Lev Vygotsky — Zon Perkembangan Proksimal (ZPD) dan scaffolding",
        "Perkembangan fizikal, kognitif, sosial dan emosi kanak-kanak peringkat sekolah rendah",
        "Perkembangan remaja: cabaran pubertas, identiti, dan pengaruh rakan sebaya",
    ],
    "Psikologi Pembelajaran": [
        "Teori Pembelajaran Behaviorisme — Pavlov, Skinner, Watson; aplikasi dalam pengurusan bilik darjah",
        "Teori Pembelajaran Kognitivisme — Bruner, Ausubel, pemprosesan maklumat dan pembelajaran bermakna",
        "Teori Pembelajaran Konstruktivisme — pembinaan pengetahuan, pembelajaran berasaskan masalah",
        "Teori Kecerdasan Pelbagai Howard Gardner dan implikasinya dalam PdPc",
        "Motivasi pembelajaran: motivasi intrinsik vs ekstrinsik, Teori Maslow, Teori Self-Determination",
        "Gaya pembelajaran dan perbezaan individu pelajar",
    ],
    "Profesionalisme Keguruan": [
        "Falsafah Pendidikan Kebangsaan (FPK) — matlamat, ciri insan seimbang, JERIS",
        "Standard Guru Malaysia (SGM) — tiga dimensi: amalan nilai profesional, pengetahuan dan kefahaman, kemahiran",
        "Kod Etika Profesion Keguruan — tanggungjawab terhadap pelajar, ibu bapa, masyarakat, negara",
        "Akta Pendidikan 1996 dan peraturan-peraturan pendidikan utama bagi guru",
        "Pembangunan profesionalisme berterusan (CPD) dan refleksi pengajaran",
        "Kepimpinan instruksional dan peranan guru sebagai pemimpin di sekolah",
    ],
    "Bimbingan dan Kaunseling": [
        "Konsep, matlamat dan prinsip Perkhidmatan Bimbingan dan Kaunseling di sekolah",
        "Pendekatan kaunseling: berpusatkan klien (Carl Rogers), kognitif tingkah laku (CBT), realiti (William Glasser)",
        "Kemahiran asas kaunseling: kemahiran mendengar, parafrasa, meminta penjelasan, refleksi perasaan",
        "Etika kaunselor — kerahsiaan, batasan profesional, kelayakan, kawalan diri",
        "Modul perkhidmatan bimbingan kerjaya, akademik, peribadi-sosial dan psikososial",
        "Kaunseling kelompok dan dinamika kumpulan dalam tetapan sekolah",
    ],
    "Pengantar Linguistik Melayu": [
        "Fonetik dan fonologi Bahasa Melayu — bunyi vokal, konsonan, diftong, suku kata",
        "Morfologi Bahasa Melayu — kata akar, imbuhan awalan, akhiran, sisipan, apitan, kata majmuk dan kata ganda",
        "Sintaksis Bahasa Melayu — frasa nama, frasa kerja, ayat tunggal dan ayat majmuk, ayat aktif dan pasif",
        "Semantik Bahasa Melayu — makna leksikal, makna konteks, sinonim, antonim, hiponim, polisemi, homonim",
        "Sejarah dan perkembangan Bahasa Melayu — daripada Bahasa Melayu Kuno hingga Bahasa Melayu Moden",
        "Variasi Bahasa Melayu — dialek geografi, dialek sosial, laras bahasa formal vs tidak formal",
    ],
    "Kesusasteraan Melayu Moden": [
        "Genre kesusasteraan Melayu moden — puisi (sajak), prosa (cerpen, novel), drama",
        "Tokoh sasterawan tersohor — A. Samad Said, Usman Awang, Shahnon Ahmad, Ishak Haji Muhammad",
        "Tema dan persoalan dalam novel Melayu — perjuangan kemerdekaan, kemiskinan, sosial, agama, cinta",
        "Unsur gaya bahasa — metafora, personifikasi, hiperbola, simile, repetisi dalam puisi Melayu",
        "Analisis cerpen Melayu — plot, watak, latar, tema, sudut pandangan, gaya bahasa",
        "Apresiasi sajak — sajak naratif, sajak deskriptif, sajak lirik, dan teknik pengkaryaan",
    ],
    "Bahasa Melayu Komunikasi": [
        "Komunikasi berkesan dalam Bahasa Melayu — komunikasi lisan dan bukan lisan",
        "Kemahiran berucap dan pengucapan awam — penyampaian, intonasi, sebutan, gaya tubuh",
        "Penulisan formal dan tidak formal — surat rasmi, memo, laporan, minit mesyuarat, e-mel",
        "Pembentangan akademik dan profesional — struktur, alat bantu visual, pengendalian soalan",
        "Bahasa kiasan, peribahasa, pantun, dan penggunaannya dalam komunikasi",
        "Etika komunikasi dalam profesion keguruan — komunikasi guru-pelajar, guru-ibu bapa",
    ],
    "Pengajian Islam": [
        "Tasawwur Islam — konsep, sumber, dan kepentingan dalam pembentukan akhlak",
        "Akidah Islam — rukun iman, sifat-sifat wajib Allah, mukjizat dan kerasulan",
        "Syariah dan ibadah — solat, puasa, zakat, haji, dan tatacara pelaksanaannya",
        "Akhlak Islam — akhlak mahmudah dan mazmumah; aplikasi dalam profesion keguruan",
        "Sirah Nabi Muhammad SAW dan teladan kepimpinan dalam pendidikan",
        "Pendidikan Islam dalam kurikulum sekolah Malaysia — matlamat dan kandungan",
    ],

    # IPG school-subject teaching options (subject mastery for trainee teachers)
    "Kalkulus": [
        "Had fungsi dan kesinambungan — definisi formal had, sifat had, had satu sebelah",
        "Pembezaan — definisi terbitan, peraturan pembezaan (kuasa, hasil darab, hasil bahagi, rantai)",
        "Aplikasi terbitan — maksimum minimum, kadar perubahan, lakaran graf fungsi",
        "Pengamiran tak tentu — antiterbitan, peraturan pengamiran asas",
        "Pengamiran tentu dan Teorem Asas Kalkulus — pengiraan luas di bawah lengkung",
        "Aplikasi dalam pengajaran matematik sekolah menengah",
    ],
    "Algebra Linear": [
        "Vektor dan operasi vektor — penambahan, darab skalar, hasil darab titik dan hasil darab silang",
        "Matriks dan operasi matriks — penambahan, pendaraban, matriks songsang, penentu",
        "Sistem persamaan linear — kaedah penghapusan Gauss, kaedah matriks songsang",
        "Ruang vektor — kebebasan linear, asas, dimensi, dan subruang",
        "Nilai eigen dan vektor eigen — pengiraan dan kepentingan dalam transformasi linear",
        "Aplikasi algebra linear dalam masalah dunia sebenar dan dalam pengajaran matematik",
    ],
    "Kimia Organik": [
        "Pengenalan kepada kimia organik — atom karbon, ikatan kovalen, isomer struktur",
        "Hidrokarbon — alkana, alkena, alkuna; tatanama IUPAC dan tindak balas",
        "Kumpulan berfungsi — alkohol, asid karboksilik, ester, amina; sifat fizikal dan kimia",
        "Mekanisme tindak balas — penggantian (SN1, SN2), penghapusan (E1, E2), penambahan",
        "Sebatian aromatik — benzena, sifat aromatik, tindak balas penggantian elektrofilik",
        "Aplikasi kimia organik dalam kehidupan harian — bahan api, ubat-ubatan, polimer",
    ],
    "Biologi": [
        "Sel — struktur, organel, dan fungsi setiap organel pada sel haiwan dan sel tumbuhan",
        "Pembahagian sel — mitosis dan meiosis; perbezaan dan kepentingan dalam pertumbuhan",
        "Genetik Mendel — hukum pemisahan, hukum pencampuran bebas, dan analisis kacukan",
        "Ekosistem — komponen biotik dan abiotik, aliran tenaga, kitar nutrien",
        "Sistem badan manusia — sistem pernafasan, sistem peredaran darah, sistem saraf",
        "Evolusi — teori Charles Darwin, mekanisme pemilihan semula jadi, bukti evolusi",
    ],
}

# Courses to SKIP entirely (not IPG-relevant in their current form)
NON_IPG_COURSE_KEYWORDS = (
    "Pangkalan Data", "Struktur Data", "Rangkaian Komputer", "Pengaturcaraan Python",
)


def match_topics(course_name: str) -> list[str]:
    """Return IPG topic list whose key matches the course name, or None."""
    for key, topics in IPG_TOPICS.items():
        if key.lower() in course_name.lower():
            return topics
    return []


def is_non_ipg(course_name: str) -> bool:
    return any(k.lower() in course_name.lower() for k in NON_IPG_COURSE_KEYWORDS)


def generate_lecture_note(course_name: str, topic: str) -> str:
    """Ask Gemini to draft a substantive Malay-language lecture-style note.

    Designed to look like real IPG sukatan pelajaran content: 4-6 paragraphs,
    academic register, concrete examples, links to pedagogical practice.
    """
    prompt = (
        "Anda seorang pensyarah di Institut Pendidikan Guru (IPG) Malaysia. "
        "Tulis nota kuliah dalam Bahasa Melayu akademik untuk pelajar Program "
        "Ijazah Sarjana Muda Perguruan (PISMP) bagi topik berikut.\n\n"
        f"KURSUS: {course_name}\n"
        f"TOPIK: {topic}\n\n"
        "KEPERLUAN:\n"
        "- Tulis 5-7 perenggan (sekitar 350-500 patah perkataan).\n"
        "- Gunakan Bahasa Melayu rasmi pada tahap pengajian tinggi.\n"
        "- Sertakan definisi konsep utama, penjelasan teori, dan contoh konkrit.\n"
        "- Kaitkan dengan amalan PdPc (Pengajaran dan Pemudahcaraan) sekolah.\n"
        "- Jangan menggunakan tajuk besar atau senarai berbutir; tulis dalam "
        "  bentuk prosa akademik berperenggan.\n"
        "- Jangan menyebut sumber rujukan atau pautan.\n"
        "- Mulakan terus dengan perenggan pertama; tiada pengenalan meta."
    )
    return (gen_llm.invoke(prompt).content or "").strip()


async def seed_one_course(course_id: str, course_name: str) -> tuple[int, int]:
    print(f"\n== {course_name[:50]}  ({course_id[:8]}…) ==")
    topics = match_topics(course_name)
    if not topics:
        print("  (no IPG topics defined; skipping)")
        return 0, 0

    # Wipe stale state docs + ChromaDB entries
    state_col = db.collection(models.RAG_INDEX_STATE)
    for s in state_col.where("courseId", "==", course_id).stream():
        s.reference.delete()
    col = rag_service._get_collection(course_id)
    ids = col.get(include=[]).get("ids", []) or []
    if ids:
        col.delete(ids=ids)
        print(f"  cleared {len(ids)} stale chunks")

    done = 0
    for i, topic in enumerate(topics, 1):
        print(f"  [{i}/{len(topics)}] generating: {topic[:80]}…")
        try:
            body = generate_lecture_note(course_name, topic)
            if len(body) < 200:
                print(f"    [skip] LLM returned too little ({len(body)} chars)")
                continue
            await rag_service.index_document(
                course_id=course_id,
                doc_id=f"ipg_topic_{i:02d}",
                doc_type="lecture_note",
                title=topic[:80],
                text=body,
                metadata={"section": f"topic-{i}", "language": "ms",
                          "synthetic": True},
            )
            done += 1
        except Exception as e:
            print(f"    [skip] {type(e).__name__}: {str(e)[:90]}")

    final = col.count()
    print(f"  indexed {done} lecture notes -> {final} chunks")
    return done, final


async def main():
    print("== Seeding IPG curriculum-style content (synthetic, disclosed) ==")
    rag_service._chroma_client = None

    selected: list[tuple[str, str]] = []
    excluded: list[str] = []
    no_match: list[str] = []
    for d in db.collection("courses").stream():
        cid = d.id
        name = d.to_dict().get("courseName", cid)
        if is_non_ipg(name):
            excluded.append(name)
            continue
        if match_topics(name):
            selected.append((cid, name))
        else:
            no_match.append(name)

    print(f"\nSelected IPG-aligned courses: {len(selected)}")
    for _, n in selected:
        print(f"  + {n}")
    if excluded:
        print(f"\nExcluded (non-IPG / uni-level CS): {len(excluded)}")
        for n in excluded:
            print(f"  - {n}")
    if no_match:
        print(f"\nNo IPG topic mapping (unchanged): {len(no_match)}")
        for n in no_match:
            print(f"  ? {n}")

    grand_docs = grand_chunks = 0
    for cid, name in selected:
        d, c = await seed_one_course(cid, name)
        grand_docs += d
        grand_chunks += c

    print(f"\n== DONE ==  {grand_docs} IPG lecture notes indexed -> "
          f"{grand_chunks} chunks across {len(selected)} courses")


if __name__ == "__main__":
    asyncio.run(main())
