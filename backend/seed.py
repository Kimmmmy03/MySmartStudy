"""
Seed script — clears ALL Firestore collections, recreates Firebase Auth accounts,
and seeds rich test data for every user (IPG-aligned).

Run:  python seed.py
"""

import sys, os
sys.path.insert(0, os.path.dirname(__file__))

import firebase_admin
from firebase_admin import credentials, auth as firebase_auth, firestore
from datetime import datetime, timedelta, timezone
import uuid
import random
import string
import json

_cred_path = os.path.join(os.path.dirname(__file__), "serviceAccountKey.json")
if not firebase_admin._apps:
    firebase_admin.initialize_app(credentials.Certificate(_cred_path))

db = firestore.client()

DEFAULT_PASSWORD = "Test1234!"

def gen_id():
    return str(uuid.uuid4())

def gen_code():
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))

# ═══════════════════════════════════════════
# All collections to clear
# ═══════════════════════════════════════════
ALL_COLLECTIONS = [
    "users", "maps", "courses", "assignments", "submissions",
    "announcements", "discussions", "courseModules", "moduleItems",
    "reminders", "auditLogs", "activityFeed", "notifications",
    "reflections", "fcmTokens", "resourceProgress", "homepageContent",
    "quizzes", "quizQuestions", "quizAttempts", "messages",
    "conversations", "peerReviews", "attendance", "attendanceRecords",
    "rubrics", "certificates", "courseGroups", "gradeSettings",
    "discussionTopics",
    "aiPlagiarismReports", "aiGradeRecommendations", "learningProfiles",
    "aiChatHistory", "generatedStudyMaterials", "aiStudyPlans", "examSchedules",
    "savedTimetables", "ragIndexState", "knowledgeGraphs",
    "mapHistory", "aiMindmapBuddyMemory", "badgeDefinitions",
]

# ═══════════════════════════════════════════
# User definitions
# ═══════════════════════════════════════════
USERS = [
    # 5 Lecturers
    {"email": "lecturer1@mysmartstudy.com", "displayName": "Dr. Siti Aminah", "role": "lecturer", "department": "Pendidikan Bahasa Melayu", "className": ""},
    {"email": "lecturer2@mysmartstudy.com", "displayName": "Prof. Ahmad Razak", "role": "lecturer", "department": "Sains Komputer", "className": ""},
    {"email": "lecturer3@mysmartstudy.com", "displayName": "Dr. Lim Wei Shan", "role": "lecturer", "department": "Matematik", "className": ""},
    {"email": "lecturer4@mysmartstudy.com", "displayName": "Dr. Kavitha Nair", "role": "lecturer", "department": "Pendidikan Sains", "className": ""},
    {"email": "lecturer5@mysmartstudy.com", "displayName": "Prof. Zulkifli Hassan", "role": "lecturer", "department": "Teknologi Maklumat", "className": ""},
    # 5 Students
    {"email": "student1@mysmartstudy.com", "displayName": "Nurul Aisyah", "role": "student", "className": "PISMP BM 2024", "year": 2, "semester": 1, "department": "Pendidikan Bahasa Melayu"},
    {"email": "student2@mysmartstudy.com", "displayName": "Muhammad Hafiz", "role": "student", "className": "PISMP SK 2024", "year": 1, "semester": 2, "department": "Sains Komputer"},
    {"email": "student3@mysmartstudy.com", "displayName": "Tan Mei Ling", "role": "student", "className": "PISMP MT 2024", "year": 2, "semester": 2, "department": "Matematik"},
    {"email": "student4@mysmartstudy.com", "displayName": "Arun Prasad", "role": "student", "className": "PISMP SN 2023", "year": 3, "semester": 1, "department": "Pendidikan Sains"},
    {"email": "student5@mysmartstudy.com", "displayName": "Fatimah Zahra", "role": "student", "className": "PISMP IT 2024", "year": 1, "semester": 1, "department": "Teknologi Maklumat"},
    # 1 Admin
    {"email": "admin@mysmartstudy.com", "displayName": "Admin MySmartStudy", "role": "admin", "department": "Pentadbiran", "className": ""},
]

# ═══════════════════════════════════════════
# Clear everything
# ═══════════════════════════════════════════
def clear_all():
    print("\n=== Clearing ALL Firestore collections ===")
    total = 0
    for coll_name in ALL_COLLECTIONS:
        docs = list(db.collection(coll_name).limit(500).stream())
        count = 0
        for doc in docs:
            doc.reference.delete()
            count += 1
        if count:
            print(f"  [{coll_name}] Deleted {count} docs")
        total += count
    print(f"  Total deleted: {total} documents")


def delete_auth_users():
    print("\n=== Cleaning Firebase Auth accounts ===")
    for u in USERS:
        try:
            fb_user = firebase_auth.get_user_by_email(u["email"])
            firebase_auth.delete_user(fb_user.uid)
            print(f"  [deleted] {u['email']}")
        except firebase_auth.UserNotFoundError:
            pass
        except Exception as e:
            print(f"  [error] {u['email']}: {e}")


# ═══════════════════════════════════════════
# Create users
# ═══════════════════════════════════════════
def create_users():
    print("\n=== Creating users ===")
    now = datetime.now(timezone.utc)
    uids = {}

    for u in USERS:
        try:
            fb_user = firebase_auth.create_user(
                email=u["email"],
                password=DEFAULT_PASSWORD,
                display_name=u["displayName"],
            )
            uid = fb_user.uid
        except Exception as e:
            print(f"  [error] {u['email']}: {e}")
            continue

        user_data = {
            "uid": uid,
            "email": u["email"],
            "displayName": u["displayName"],
            "role": u["role"],
            "className": u.get("className", ""),
            "photoURL": "",
            "year": u.get("year"),
            "semester": u.get("semester"),
            "department": u.get("department"),
            "points": random.randint(50, 300),
            "streak": random.randint(1, 14),
            "badges": [],
            "createdAt": now,
            "lastActiveAt": now,
        }
        db.collection("users").document(uid).set(user_data)
        uids[u["email"]] = uid
        print(f"  [created] {u['email']} ({u['role']}) uid={uid}")

    return uids


# ═══════════════════════════════════════════
# Helper: get user name from uid
# ═══════════════════════════════════════════
def _name(uids, uid):
    for u in USERS:
        if uids.get(u["email"]) == uid:
            return u["displayName"]
    return "Unknown"


# ═══════════════════════════════════════════
# Seed rich data
# ═══════════════════════════════════════════
def seed_data(uids):
    now = datetime.now(timezone.utc)
    lecturers = {k: v for k, v in uids.items() if k.startswith("lecturer")}
    students = {k: v for k, v in uids.items() if k.startswith("student")}
    student_list = list(students.values())
    student_emails = list(students.keys())

    # ── Courses (2 per lecturer = 10 courses) ──
    print("\n=== Seeding courses ===")
    course_data_defs = [
        ("Pengantar Linguistik Melayu", "BM101", "2", "lecturer1@mysmartstudy.com"),
        ("Kesusasteraan Melayu Moden", "BM202", "2", "lecturer1@mysmartstudy.com"),
        ("Pengaturcaraan Python", "CS101", "2", "lecturer2@mysmartstudy.com"),
        ("Struktur Data & Algoritma", "CS201", "2", "lecturer2@mysmartstudy.com"),
        ("Kalkulus I", "MT101", "2", "lecturer3@mysmartstudy.com"),
        ("Algebra Linear", "MT201", "2", "lecturer3@mysmartstudy.com"),
        ("Biologi Asas", "SN101", "2", "lecturer4@mysmartstudy.com"),
        ("Kimia Organik", "SN202", "2", "lecturer4@mysmartstudy.com"),
        ("Asas Pangkalan Data", "IT101", "2", "lecturer5@mysmartstudy.com"),
        ("Rangkaian Komputer", "IT201", "2", "lecturer5@mysmartstudy.com"),
    ]

    courses = []
    for cname, ccode, sem, lec_email in course_data_defs:
        cid = gen_id()
        lec_uid = uids[lec_email]
        lec_name = _name(uids, lec_uid)
        jcode = gen_code()
        enrolled = random.sample(student_list, random.randint(3, min(5, len(student_list))))
        course_doc = {
            "lecturerId": lec_uid,
            "lecturerName": lec_name,
            "courseName": cname,
            "courseCode": ccode,
            "semester": sem,
            "joinCode": jcode,
            "description": f"Kursus {cname} ({ccode}) untuk pelajar semester {sem} di IPG.",
            "enrolledStudents": enrolled,
            "createdAt": now,
        }
        db.collection("courses").document(cid).set(course_doc)
        courses.append({"id": cid, "name": cname, "code": ccode, "lecturerId": lec_uid, "lecturerName": lec_name, "enrolled": enrolled, "joinCode": jcode})
        print(f"  [course] {ccode} — {cname} (join: {jcode}, students: {len(enrolled)})")

    # ── Assignments (2 per course = 20 assignments) ──
    print("\n=== Seeding assignments ===")
    assignments = []
    assignment_details = {
        "BM101": [
            ("Tugasan 1: Analisis Morfologi Kata Kerja", "Analisis 20 kata kerja Bahasa Melayu dari aspek imbuhan awalan, akhiran, dan apitan. Sertakan contoh ayat bagi setiap kata kerja."),
            ("Tutorial 1: Fonetik dan Fonologi BM", "Transkripsi fonetik bagi 15 perkataan Bahasa Melayu. Kenal pasti vokal, konsonan, dan diftong."),
        ],
        "BM202": [
            ("Projek: Kajian Novel Melayu Moden", "Pilih satu novel Melayu moden (Sasterawan Negara) dan analisis tema, watak, dan gaya bahasa penulis. Minimum 2000 patah perkataan."),
            ("Tugasan 2: Puisi Melayu Tradisional vs Moden", "Bandingkan dua puisi dari era tradisional dan moden dari aspek bentuk, isi, dan bahasa."),
        ],
        "CS101": [
            ("Tugasan 1: Program Kalkulator Python", "Bina program kalkulator menggunakan Python yang boleh melakukan operasi tambah, tolak, darab, bahagi, dan kuasa. Gunakan fungsi dan pengendalian ralat."),
            ("Tutorial 1: Struktur Kawalan Python", "Selesaikan 10 soalan latihan berkaitan if-else, for loop, dan while loop dalam Python. Sertakan output bagi setiap program."),
        ],
        "CS201": [
            ("Projek: Implementasi Senarai Berpaut", "Implementasi senarai berpaut tunggal (singly linked list) dalam Python dengan operasi insert, delete, search, dan display."),
            ("Tugasan 2: Analisis Kerumitan Algoritma", "Analisis kerumitan masa (Big O) bagi 5 algoritma pengisihan: Bubble Sort, Selection Sort, Insertion Sort, Merge Sort, Quick Sort."),
        ],
        "MT101": [
            ("Tugasan 1: Had dan Keselanjaran", "Selesaikan 15 soalan berkaitan had fungsi, had kiri/kanan, dan keselanjaran fungsi. Tunjukkan semua langkah penyelesaian."),
            ("Tutorial 1: Pembezaan Asas", "Cari terbitan bagi 20 fungsi menggunakan peraturan kuasa, peraturan hasil darab, dan peraturan rantai."),
        ],
        "MT201": [
            ("Projek: Sistem Persamaan Linear", "Selesaikan sistem persamaan linear 4x4 menggunakan kaedah Gauss-Jordan dan kaedah Cramer. Bandingkan kedua-dua kaedah."),
            ("Tugasan 2: Ruang Vektor dan Subruang", "Tentukan sama ada 5 set yang diberikan membentuk subruang bagi R^3. Buktikan dengan aksiom ruang vektor."),
        ],
        "SN101": [
            ("Tugasan 1: Struktur Sel Eukariot", "Lukis dan label komponen sel eukariot (haiwan dan tumbuhan). Jelaskan fungsi setiap organel. Sertakan perbandingan dalam bentuk jadual."),
            ("Tutorial 1: Mitosis dan Meiosis", "Bandingkan proses mitosis dan meiosis dari aspek fasa, hasil, dan kepentingan biologi."),
        ],
        "SN202": [
            ("Projek: Tindak Balas Organik", "Tunjukkan mekanisme tindak balas penukargantian nukleofilik (SN1 dan SN2) bagi 5 sebatian organik berbeza."),
            ("Tugasan 2: Kumpulan Berfungsi", "Kenal pasti kumpulan berfungsi dalam 15 sebatian organik dan namakan menggunakan tatanama IUPAC."),
        ],
        "IT101": [
            ("Tugasan 1: Reka Bentuk Pangkalan Data", "Reka bentuk pangkalan data untuk sistem perpustakaan IPG menggunakan gambar rajah ER. Sertakan entiti, atribut, dan perhubungan."),
            ("Tutorial 1: Pertanyaan SQL", "Tulis 15 pertanyaan SQL (SELECT, INSERT, UPDATE, DELETE, JOIN) berdasarkan pangkalan data perpustakaan yang direka."),
        ],
        "IT201": [
            ("Projek: Analisis Model OSI", "Analisis 7 lapisan model OSI dengan contoh protokol dan peranti bagi setiap lapisan. Sertakan gambar rajah."),
            ("Tugasan 2: Pengalamatan IP dan Subnetting", "Selesaikan 10 soalan pengalamatan IPv4, subnet mask, dan subnetting VLSM."),
        ],
    }

    a_types = ["assignment", "tutorial", "project"]
    for c in courses:
        details = assignment_details.get(c["code"], [
            (f"Tugasan 1: {c['name']}", f"Sila siapkan tugasan ini sebelum tarikh akhir."),
            (f"Tutorial 1: {c['name']}", f"Sila siapkan tutorial ini sebelum tarikh akhir."),
        ])
        for i, (title, desc) in enumerate(details):
            aid = gen_id()
            atype = a_types[i % 3] if "Projek" in title else ("tutorial" if "Tutorial" in title else "assignment")
            deadline = (now + timedelta(days=random.randint(7, 30))).strftime("%Y-%m-%dT%H:%M:%S")
            a_doc = {
                "lecturerId": c["lecturerId"],
                "courseId": c["id"],
                "title": title,
                "description": desc,
                "deadline": deadline,
                "allowedMapTypes": [],
                "assignmentType": atype,
                "createdAt": now,
            }
            db.collection("assignments").document(aid).set(a_doc)
            assignments.append({"id": aid, "courseId": c["id"], "enrolled": c["enrolled"], "type": atype, "title": title, "code": c["code"]})
            print(f"  [assignment] {title} ({atype})")

    # ── Submissions with detailed content for AI testing ──
    print("\n=== Seeding submissions ===")
    submission_comments = {
        "BM101": [
            "Saya telah menganalisis 20 kata kerja BM termasuk 'membaca', 'berlari', 'memperkatakan'. Imbuhan awalan me- memberikan makna aktif, manakala ber- menunjukkan perbuatan refleksif.",
            "Analisis morfologi menunjukkan bahawa kata kerja transitif memerlukan objek manakala kata kerja tak transitif tidak. Contoh: 'memukul' (transitif) vs 'tidur' (tak transitif).",
            "Kajian imbuhan apitan memper-...-kan dan memper-...-i menunjukkan perbezaan semantik yang ketara dalam penggunaan bahasa formal dan tidak formal.",
        ],
        "CS101": [
            "Program kalkulator saya menggunakan fungsi berasingan untuk setiap operasi. Saya juga menambah pengendalian ralat untuk pembahagian dengan sifar menggunakan try-except.",
            "Saya menggunakan dictionary untuk memetakan operator kepada fungsi. Program ini juga menyokong operasi kuasa dan punca kuasa dua.",
            "Kalkulator ini menggunakan while loop untuk membolehkan pengguna membuat pengiraan berulang kali sehingga memasukkan 'keluar'.",
        ],
        "MT101": [
            "Untuk soalan had, saya menggunakan penggantian langsung untuk had yang wujud dan pemfaktoran untuk bentuk tak tentu 0/0. Peraturan L'Hopital digunakan untuk kes yang lebih kompleks.",
            "Keselanjaran fungsi f(x) disahkan dengan menyemak tiga syarat: f(a) wujud, had f(x) apabila x menghampiri a wujud, dan kedua-duanya sama.",
        ],
        "SN101": [
            "Sel eukariot haiwan mempunyai sentriol dan lisosom manakala sel tumbuhan mempunyai dinding sel, kloroplas, dan vakuol pusat yang besar. Mitokondria hadir dalam kedua-dua jenis sel.",
            "Organel utama: nukleus (mengawal aktiviti sel), ribosom (sintesis protein), retikulum endoplasma (pengangkutan bahan), aparatus Golgi (pembungkusan).",
        ],
        "IT101": [
            "Pangkalan data perpustakaan saya mempunyai entiti: Buku (ISBN, tajuk, pengarang), Ahli (ID, nama, alamat), Pinjaman (tarikh pinjam, tarikh pulang). Perhubungan: Ahli meminjam Buku (M:N).",
            "Normalisasi dilakukan sehingga 3NF untuk mengelakkan redundansi data. Kunci asing digunakan untuk menghubungkan jadual.",
        ],
    }
    sub_count = 0
    all_submissions = []
    for a in assignments:
        comments_pool = submission_comments.get(a["code"], [
            "Ini adalah tugasan saya. Saya telah mengikuti semua arahan yang diberikan oleh pensyarah.",
            "Tugasan ini telah disiapkan dengan merujuk nota kuliah dan bahan rujukan tambahan.",
            "Saya telah membuat kajian mendalam untuk tugasan ini dan menyertakan rujukan yang sesuai.",
        ])
        for sid in a["enrolled"]:
            if random.random() < 0.65:
                sub_id = gen_id()
                s_name = _name(uids, sid)
                grade = random.choice([None, None, round(random.uniform(45, 100), 1)])
                feedback = None
                if grade is not None:
                    if grade >= 80:
                        feedback = "Kerja yang cemerlang! Analisis anda menunjukkan pemahaman yang mendalam."
                    elif grade >= 60:
                        feedback = "Kerja yang baik. Boleh diperbaiki dari segi kedalaman analisis."
                    else:
                        feedback = "Perlu penambahbaikan. Sila rujuk nota kuliah dan berjumpa pensyarah untuk bimbingan."
                s_doc = {
                    "assignmentId": a["id"],
                    "studentId": sid,
                    "studentName": s_name,
                    "submissionType": "map",
                    "mapId": None,
                    "externalLink": None,
                    "comments": random.choice(comments_pool),
                    "grade": grade,
                    "feedback": feedback,
                    "submittedAt": now - timedelta(hours=random.randint(1, 120)),
                }
                db.collection("submissions").document(sub_id).set(s_doc)
                all_submissions.append({"id": sub_id, "assignmentId": a["id"], "studentId": sid, "studentName": s_name})
                sub_count += 1
    print(f"  Created {sub_count} submissions")

    # ── Quizzes (1 per course with IPG-specific questions) ──
    print("\n=== Seeding quizzes ===")
    quizzes = []
    quiz_questions_per_course = {
        "BM101": [
            {"text": "Apakah jenis imbuhan dalam kata 'membaca'?", "type": "mcq", "options": ["Imbuhan awalan", "Imbuhan akhiran", "Imbuhan apitan", "Imbuhan sisipan"], "correct_answer": "0", "points": 2},
            {"text": "Fonologi ialah kajian tentang sistem bunyi bahasa.", "type": "true_false", "options": [], "correct_answer": "true", "points": 1},
            {"text": "Berikan contoh kata majmuk dalam Bahasa Melayu.", "type": "short_answer", "options": [], "correct_answer": "rumah sakit", "points": 3},
            {"text": "Kata ganti nama diri pertama ialah:", "type": "mcq", "options": ["dia", "mereka", "saya", "kamu"], "correct_answer": "2", "points": 2},
            {"text": "Ayat pasif menggunakan kata kerja berimbuhan di-.", "type": "true_false", "options": [], "correct_answer": "true", "points": 1},
        ],
        "BM202": [
            {"text": "Siapakah Sasterawan Negara pertama Malaysia?", "type": "mcq", "options": ["Usman Awang", "A. Samad Said", "Keris Mas", "Shahnon Ahmad"], "correct_answer": "2", "points": 2},
            {"text": "Novel 'Ranjau Sepanjang Jalan' ditulis oleh Shahnon Ahmad.", "type": "true_false", "options": [], "correct_answer": "true", "points": 1},
            {"text": "Nyatakan satu tema utama dalam novel 'Salina'.", "type": "short_answer", "options": [], "correct_answer": "kemiskinan", "points": 3},
            {"text": "Pantun mempunyai berapa baris?", "type": "mcq", "options": ["2 baris", "4 baris", "6 baris", "8 baris"], "correct_answer": "1", "points": 2},
        ],
        "CS101": [
            {"text": "Apakah output bagi: print(type(3.14))?", "type": "mcq", "options": ["<class 'int'>", "<class 'float'>", "<class 'str'>", "<class 'double'>"], "correct_answer": "1", "points": 2},
            {"text": "Python adalah bahasa pengaturcaraan bertaip statik.", "type": "true_false", "options": [], "correct_answer": "false", "points": 1},
            {"text": "Nyatakan satu perbezaan antara list dan tuple dalam Python.", "type": "short_answer", "options": [], "correct_answer": "list boleh diubah, tuple tidak", "points": 3},
            {"text": "Apakah kata kunci untuk mentakrifkan fungsi dalam Python?", "type": "mcq", "options": ["function", "def", "func", "define"], "correct_answer": "1", "points": 2},
            {"text": "Indeks pertama dalam senarai Python bermula pada 0.", "type": "true_false", "options": [], "correct_answer": "true", "points": 1},
        ],
        "CS201": [
            {"text": "Kerumitan masa bagi Binary Search ialah:", "type": "mcq", "options": ["O(n)", "O(log n)", "O(n^2)", "O(1)"], "correct_answer": "1", "points": 2},
            {"text": "Stack menggunakan prinsip FIFO (First In First Out).", "type": "true_false", "options": [], "correct_answer": "false", "points": 1},
            {"text": "Apakah perbezaan antara Stack dan Queue?", "type": "short_answer", "options": [], "correct_answer": "Stack LIFO, Queue FIFO", "points": 3},
            {"text": "Algoritma Merge Sort mempunyai kerumitan masa:", "type": "mcq", "options": ["O(n)", "O(n log n)", "O(n^2)", "O(log n)"], "correct_answer": "1", "points": 2},
        ],
        "MT101": [
            {"text": "Had bagi (x^2 - 1)/(x - 1) apabila x menghampiri 1 ialah:", "type": "mcq", "options": ["0", "1", "2", "Tak wujud"], "correct_answer": "2", "points": 2},
            {"text": "Terbitan bagi f(x) = x^3 ialah f'(x) = 3x^2.", "type": "true_false", "options": [], "correct_answer": "true", "points": 1},
            {"text": "Cari terbitan bagi f(x) = 5x^4 + 3x^2.", "type": "short_answer", "options": [], "correct_answer": "20x^3 + 6x", "points": 3},
            {"text": "Terbitan bagi sin(x) ialah:", "type": "mcq", "options": ["-sin(x)", "cos(x)", "-cos(x)", "tan(x)"], "correct_answer": "1", "points": 2},
            {"text": "Kamiran tentu boleh mempunyai nilai negatif.", "type": "true_false", "options": [], "correct_answer": "true", "points": 1},
        ],
        "MT201": [
            {"text": "Dimensi bagi R^3 ialah:", "type": "mcq", "options": ["1", "2", "3", "4"], "correct_answer": "2", "points": 2},
            {"text": "Matriks identiti I_n mempunyai determinan bernilai 1.", "type": "true_false", "options": [], "correct_answer": "true", "points": 1},
            {"text": "Nyatakan syarat bagi dua vektor untuk menjadi ortogonal.", "type": "short_answer", "options": [], "correct_answer": "hasil darab titik sama dengan sifar", "points": 3},
        ],
        "SN101": [
            {"text": "Organel yang bertanggungjawab untuk sintesis protein ialah:", "type": "mcq", "options": ["Mitokondria", "Ribosom", "Lisosom", "Vakuol"], "correct_answer": "1", "points": 2},
            {"text": "Mitosis menghasilkan 4 sel anak.", "type": "true_false", "options": [], "correct_answer": "false", "points": 1},
            {"text": "Nyatakan fungsi utama mitokondria.", "type": "short_answer", "options": [], "correct_answer": "penghasilan tenaga ATP", "points": 3},
            {"text": "Dinding sel tumbuhan terdiri daripada:", "type": "mcq", "options": ["Protein", "Lipid", "Selulosa", "Kitin"], "correct_answer": "2", "points": 2},
            {"text": "Fotosintesis berlaku di dalam kloroplas.", "type": "true_false", "options": [], "correct_answer": "true", "points": 1},
        ],
        "SN202": [
            {"text": "Tindak balas SN2 berlaku dalam satu langkah.", "type": "true_false", "options": [], "correct_answer": "true", "points": 1},
            {"text": "Kumpulan berfungsi bagi alkohol ialah:", "type": "mcq", "options": ["-COOH", "-OH", "-NH2", "-CHO"], "correct_answer": "1", "points": 2},
            {"text": "Namakan sebatian CH3CH2OH menggunakan IUPAC.", "type": "short_answer", "options": [], "correct_answer": "etanol", "points": 3},
            {"text": "Alkena mempunyai ikatan:", "type": "mcq", "options": ["Tunggal sahaja", "Ganda dua", "Ganda tiga", "Tiada ikatan"], "correct_answer": "1", "points": 2},
        ],
        "IT101": [
            {"text": "SQL adalah singkatan bagi:", "type": "mcq", "options": ["Standard Query Language", "Structured Query Language", "Simple Query Language", "System Query Language"], "correct_answer": "1", "points": 2},
            {"text": "PRIMARY KEY boleh mempunyai nilai NULL.", "type": "true_false", "options": [], "correct_answer": "false", "points": 1},
            {"text": "Apakah perbezaan antara DDL dan DML?", "type": "short_answer", "options": [], "correct_answer": "DDL untuk struktur, DML untuk data", "points": 3},
            {"text": "Perintah SQL untuk memadam data ialah:", "type": "mcq", "options": ["REMOVE", "DELETE", "DROP", "ERASE"], "correct_answer": "1", "points": 2},
            {"text": "Normalisasi bertujuan mengurangkan redundansi data.", "type": "true_false", "options": [], "correct_answer": "true", "points": 1},
        ],
        "IT201": [
            {"text": "Lapisan ke-3 dalam model OSI ialah:", "type": "mcq", "options": ["Data Link", "Network", "Transport", "Session"], "correct_answer": "1", "points": 2},
            {"text": "Alamat IP versi 4 mempunyai 128 bit.", "type": "true_false", "options": [], "correct_answer": "false", "points": 1},
            {"text": "Apakah fungsi router dalam rangkaian?", "type": "short_answer", "options": [], "correct_answer": "menghala paket data antara rangkaian", "points": 3},
            {"text": "Protokol HTTP beroperasi pada lapisan:", "type": "mcq", "options": ["Network", "Transport", "Session", "Application"], "correct_answer": "3", "points": 2},
        ],
    }

    for c in courses:
        qid = gen_id()
        questions = quiz_questions_per_course.get(c["code"], [
            {"text": f"Soalan umum untuk {c['name']}", "type": "mcq", "options": ["A", "B", "C", "D"], "correct_answer": "0", "points": 2},
        ])
        total_pts = sum(q["points"] for q in questions)
        q_doc = {
            "courseId": c["id"],
            "lecturerId": c["lecturerId"],
            "title": f"Kuiz: {c['name']}",
            "description": f"Kuiz untuk menguji pemahaman pelajar dalam kursus {c['code']} - {c['name']}.",
            "timeLimitMinutes": 20,
            "deadline": (now + timedelta(days=14)).strftime("%Y-%m-%dT%H:%M:%S"),
            "shuffleQuestions": True,
            "showResults": True,
            "createdAt": now,
        }
        db.collection("quizzes").document(qid).set(q_doc)
        quizzes.append({"id": qid, "courseId": c["id"], "enrolled": c["enrolled"], "questions": questions, "totalPts": total_pts, "title": q_doc["title"]})

        for idx, qt in enumerate(questions):
            qques_id = gen_id()
            db.collection("quizQuestions").document(qques_id).set({
                "quizId": qid,
                "type": qt["type"],
                "text": qt["text"],
                "options": qt["options"],
                "correctAnswer": qt["correct_answer"],
                "points": qt["points"],
                "order": idx,
            })
        print(f"  [quiz] Kuiz: {c['name']} ({len(questions)} questions, {total_pts} pts)")

    # ── Quiz Attempts ──
    attempt_count = 0
    for q in quizzes:
        for sid in q["enrolled"]:
            if random.random() < 0.5:
                att_id = gen_id()
                s_name = _name(uids, sid)
                score = round(random.uniform(q["totalPts"] * 0.3, q["totalPts"]), 1)
                pct = round(score / q["totalPts"] * 100, 1)
                db.collection("quizAttempts").document(att_id).set({
                    "quizId": q["id"],
                    "quizTitle": q["title"],
                    "studentId": sid,
                    "studentName": s_name,
                    "answers": {},
                    "score": score,
                    "totalPoints": q["totalPts"],
                    "percentage": pct,
                    "startedAt": now - timedelta(hours=random.randint(2, 48)),
                    "submittedAt": now - timedelta(hours=random.randint(1, 47)),
                })
                attempt_count += 1
    print(f"  Created {attempt_count} quiz attempts")

    # ── Announcements ──
    print("\n=== Seeding announcements ===")
    ann_count = 0
    ann_templates = {
        "BM101": ["Peringatan: Hantar tugasan analisis morfologi sebelum tarikh akhir.", "Kelas ganti minggu depan di Dewan Kuliah A."],
        "CS101": ["Nota Python Bab 3 telah dimuat naik. Sila muat turun.", "Lab Python dibuka untuk latihan bebas setiap Rabu petang."],
        "MT101": ["Formula penting untuk peperiksaan telah disediakan.", "Kelas tambahan Kalkulus pada hari Sabtu 10 pagi."],
        "SN101": ["Lawatan ke makmal biologi pada minggu 8.", "Nota Bab 4: Pembahagian Sel telah dimuat naik."],
        "IT101": ["Tugasan SQL perlu dihantar secara online.", "Workshop pangkalan data pada Jumaat ini."],
    }
    for c in courses:
        templates = ann_templates.get(c["code"], [f"Pengumuman penting untuk {c['name']}."])
        for i, text in enumerate(templates):
            ann_id = gen_id()
            db.collection("announcements").document(ann_id).set({
                "courseId": c["id"],
                "title": f"Pengumuman: {c['name']}",
                "content": text,
                "senderName": c["lecturerName"],
                "senderId": c["lecturerId"],
                "createdAt": now - timedelta(days=random.randint(0, 7)),
            })
            ann_count += 1
    print(f"  Created {ann_count} announcements")

    # ── Discussions ──
    print("\n=== Seeding discussions ===")
    disc_count = 0
    disc_texts = [
        "Adakah sesiapa boleh terangkan topik minggu lepas?",
        "Saya ada soalan tentang tugasan. Adakah kita perlu sertakan rujukan?",
        "Terima kasih pensyarah, bahan ini sangat membantu!",
        "Bila tarikh akhir untuk projek semester ini?",
        "Bolehkah kita bincang dalam kumpulan untuk tutorial?",
        "Saya dapati konsep ini agak sukar. Ada tips?",
        "Adakah kuiz seterusnya meliputi bab 3 dan 4?",
    ]
    for c in courses:
        for i in range(random.randint(2, 4)):
            msg_id = gen_id()
            sender = random.choice(c["enrolled"])
            db.collection("discussions").document(msg_id).set({
                "courseId": c["id"],
                "text": random.choice(disc_texts),
                "senderId": sender,
                "senderName": _name(uids, sender),
                "senderRole": "student",
                "createdAt": now - timedelta(hours=random.randint(1, 72)),
                "replyCount": 0,
            })
            disc_count += 1
    print(f"  Created {disc_count} discussion messages")

    # ── Discussion Topics (Forum) ──
    print("\n=== Seeding forum topics ===")
    topic_count = 0
    post_count = 0
    forum_topics = {
        "BM101": [("Tips Menghafal Imbuhan", "Bagaimana cara terbaik untuk menghafal imbuhan awalan, akhiran, dan apitan?")],
        "CS101": [("Masalah dengan Loop", "Saya menghadapi masalah infinite loop. Bagaimana cara debug?")],
        "MT101": [("Soalan Kalkulus", "Adakah sesiapa boleh jelaskan Peraturan Rantai dengan contoh?")],
        "SN101": [("Perbezaan Mitosis & Meiosis", "Saya keliru antara fasa-fasa mitosis dan meiosis.")],
        "IT101": [("SQL JOIN", "Boleh sesiapa terangkan perbezaan INNER JOIN dan LEFT JOIN?")],
    }
    for c in courses:
        topics = forum_topics.get(c["code"], [(f"Perbincangan Umum: {c['name']}", f"Ruangan perbincangan untuk kursus {c['name']}.")])
        for title, body in topics:
            topic_id = gen_id()
            author = random.choice(c["enrolled"])
            db.collection("discussionTopics").document(topic_id).set({
                "courseId": c["id"],
                "title": title,
                "body": body,
                "authorId": author,
                "authorName": _name(uids, author),
                "isPinned": False,
                "postCount": 2,
                "createdAt": now - timedelta(days=random.randint(1, 10)),
            })
            topic_count += 1
            # 2 replies per topic
            for r in range(2):
                pid = gen_id()
                replier = random.choice(c["enrolled"])
                db.collection("discussionTopics").document(topic_id).collection("posts").document(pid).set({
                    "topicId": topic_id,
                    "text": random.choice(["Saya setuju, topik ini memang sukar.", "Terima kasih, ini membantu saya faham.", "Cuba rujuk nota minggu 3, ada penjelasan yang baik."]),
                    "authorId": replier,
                    "authorName": _name(uids, replier),
                    "createdAt": now - timedelta(hours=random.randint(1, 48)),
                })
                post_count += 1
    print(f"  Created {topic_count} forum topics, {post_count} posts")

    # ── Course Modules & Items ──
    print("\n=== Seeding modules & items ===")
    mod_count = 0
    item_count = 0
    for c in courses:
        for week in range(1, random.randint(3, 4)):
            mid = gen_id()
            db.collection("courseModules").document(mid).set({
                "courseId": c["id"],
                "title": f"Minggu {week}: {c['name']}",
                "description": f"Bahan pembelajaran untuk minggu {week} kursus {c['code']}.",
                "createdAt": now,
                "order": week,
            })
            mod_count += 1
            for j in range(random.randint(1, 3)):
                iid = gen_id()
                item_type = random.choice(["link", "pdf", "video"])
                db.collection("moduleItems").document(iid).set({
                    "moduleId": mid,
                    "title": f"Nota {c['code']} Minggu {week} - Bahagian {j+1}",
                    "type": item_type,
                    "url": f"https://example.com/{c['code']}/week{week}/part{j+1}",
                    "createdAt": now,
                })
                item_count += 1
    print(f"  Created {mod_count} modules, {item_count} items")

    # ── Reminders ──
    print("\n=== Seeding reminders ===")
    rem_count = 0
    rem_data = [
        ("Siapkan tugasan Bahasa Melayu", "Assignment", "high"),
        ("Ulangkaji untuk kuiz Sains Komputer", "Study", "high"),
        ("Baca nota Kalkulus Bab 3", "Study", "normal"),
        ("Hantar projek Biologi", "Assignment", "high"),
        ("Latihan SQL", "Study", "normal"),
        ("Revisi algebra linear", "Study", "low"),
        ("Persediaan pembentangan", "Assignment", "high"),
    ]
    for email, uid in students.items():
        for i in range(random.randint(2, 4)):
            rid = gen_id()
            title, rtype, prio = random.choice(rem_data)
            db.collection("reminders").document(rid).set({
                "ownerId": uid,
                "date": (now + timedelta(days=random.randint(0, 14))).strftime("%Y-%m-%d"),
                "title": title,
                "type": rtype,
                "priority": prio,
                "isCompleted": random.choice([True, False, False]),
            })
            rem_count += 1
    print(f"  Created {rem_count} reminders")

    # ── Mind Maps (richer with more nodes) ──
    print("\n=== Seeding mind maps ===")
    map_count = 0
    map_defs = {
        "student1": [
            ("Peta Minda: Tatabahasa BM", ["Tatabahasa", "Morfologi", "Sintaksis", "Imbuhan Awalan", "Imbuhan Akhiran", "Ayat Tunggal", "Ayat Majmuk"]),
            ("Peta Minda: Kesusasteraan", ["Kesusasteraan", "Novel", "Puisi", "Drama", "Sasterawan Negara", "Tema", "Gaya Bahasa"]),
        ],
        "student2": [
            ("Konsep Python", ["Python", "Pembolehubah", "Fungsi", "Gelung For", "Gelung While", "Senarai", "Kamus", "Tuple"]),
            ("Struktur Data", ["Struktur Data", "Array", "Linked List", "Stack", "Queue", "Tree", "Graph", "Sorting"]),
        ],
        "student3": [
            ("Kalkulus Asas", ["Kalkulus", "Had", "Terbitan", "Kamiran", "Peraturan Kuasa", "Peraturan Rantai", "Fungsi Trigonometri"]),
        ],
        "student4": [
            ("Biologi Sel", ["Sel", "Nukleus", "Mitokondria", "Ribosom", "Membran Sel", "Mitosis", "Meiosis", "DNA", "RNA"]),
            ("Kimia Organik", ["Kimia Organik", "Alkana", "Alkena", "Alkohol", "Asid Karboksilik", "Ester", "Tindak Balas"]),
        ],
        "student5": [
            ("Model OSI", ["Model OSI", "Fizikal", "Data Link", "Network", "Transport", "Session", "Presentation", "Application"]),
            ("Pangkalan Data", ["Pangkalan Data", "SQL", "Entiti", "Atribut", "Perhubungan", "Normalisasi", "Kunci Primer", "Kunci Asing"]),
        ],
    }
    for email, uid in students.items():
        skey = email.split("@")[0]
        defs = map_defs.get(skey, [("Peta Minda Umum", ["Topik Utama", "Subtopik A", "Subtopik B"])])
        for title, labels in defs:
            map_id = gen_id()
            nodes = []
            edges = []
            for idx, label in enumerate(labels):
                x = 300 + (idx % 4) * 200
                y = 200 + (idx // 4) * 150
                nodes.append({
                    "id": str(idx + 1),
                    "type": "rectangle",
                    "position": {"x": x, "y": y},
                    "data": {"label": label, "fillColor": "#1a1a28", "strokeColor": "#6366f1", "fontColor": "#e0e0e0", "fontSize": 14, "strokeWidth": 2, "shape": "rectangle", "opacity": 1},
                })
                if idx > 0:
                    edges.append({"id": f"e{idx}", "source": "1", "target": str(idx + 1), "type": "smoothstep"})
            graph = json.dumps({"nodes": nodes, "edges": edges})
            nodes_text = ", ".join(labels)
            db.collection("maps").document(map_id).set({
                "ownerId": uid,
                "ownerEmail": email,
                "title": title,
                "graphData": graph,
                "graphFormat": "reactflow",
                "nodesText": nodes_text,
                "thumbnail": "",
                "shareCode": gen_code(),
                "collaborators": [],
                "lastModified": now,
            })
            map_count += 1
    print(f"  Created {map_count} mind maps")

    # ── Attendance ──
    print("\n=== Seeding attendance ===")
    att_count = 0
    for c in courses:
        for w in range(1, 4):
            sess_id = gen_id()
            db.collection("attendance").document(sess_id).set({
                "courseId": c["id"],
                "date": (now - timedelta(days=7 * w)).strftime("%Y-%m-%d"),
                "title": f"Kelas Minggu {w}",
                "createdAt": now,
            })
            for sid in c["enrolled"]:
                rec_id = gen_id()
                db.collection("attendanceRecords").document(rec_id).set({
                    "sessionId": sess_id,
                    "studentId": sid,
                    "studentName": _name(uids, sid),
                    "status": random.choice(["present", "present", "present", "present", "late", "absent"]),
                })
                att_count += 1
    print(f"  Created {att_count} attendance records")

    # ── Grade Settings ──
    for c in courses:
        db.collection("gradeSettings").document(c["id"]).set({
            "courseId": c["id"],
            "assignmentWeight": 60,
            "quizWeight": 40,
        })

    # ── Notifications ──
    print("\n=== Seeding notifications ===")
    notif_count = 0
    notif_templates = [
        ("Tugasan baru telah diberikan", "assignment"),
        ("Kuiz tersedia untuk dicuba", "quiz"),
        ("Pengumuman baru dari pensyarah", "announcement"),
        ("Gred tugasan anda telah dikeluarkan", "grade"),
        ("Anda mempunyai mesej baru", "message"),
    ]
    for email, uid in uids.items():
        for i in range(random.randint(2, 4)):
            nid = gen_id()
            title, ntype = random.choice(notif_templates)
            db.collection("notifications").document(nid).set({
                "userId": uid,
                "title": title,
                "message": "Sila semak perkara ini dalam MySmartStudy.",
                "type": ntype,
                "link": "",
                "read": random.choice([True, False]),
                "createdAt": now - timedelta(hours=random.randint(1, 72)),
            })
            notif_count += 1
    print(f"  Created {notif_count} notifications")

    # ═══════════════════════════════════════════
    # NEW: Enhanced data for AI feature testing
    # ═══════════════════════════════════════════

    # ── Saved Timetables ──
    print("\n=== Seeding saved timetables ===")
    timetable_defs = {
        "student1": {
            "label": "Semester 2 2025/2026",
            "schedule": [
                {"day": "Monday", "classes": [
                    {"time": "8:00 AM - 10:00 AM", "subject": "Pengantar Linguistik Melayu (BM101)", "location": "DK-A"},
                    {"time": "2:00 PM - 4:00 PM", "subject": "Kesusasteraan Melayu Moden (BM202)", "location": "DK-B"},
                ]},
                {"day": "Tuesday", "classes": [
                    {"time": "10:00 AM - 12:00 PM", "subject": "Pengaturcaraan Python (CS101)", "location": "Makmal IT 1"},
                    {"time": "2:00 PM - 3:00 PM", "subject": "Kalkulus I (MT101)", "location": "DK-C"},
                ]},
                {"day": "Wednesday", "classes": [
                    {"time": "8:00 AM - 10:00 AM", "subject": "Pengantar Linguistik Melayu (BM101)", "location": "DK-A"},
                    {"time": "11:00 AM - 1:00 PM", "subject": "Biologi Asas (SN101)", "location": "Makmal Sains"},
                ]},
                {"day": "Thursday", "classes": [
                    {"time": "9:00 AM - 11:00 AM", "subject": "Kesusasteraan Melayu Moden (BM202)", "location": "DK-B"},
                    {"time": "2:00 PM - 4:00 PM", "subject": "Asas Pangkalan Data (IT101)", "location": "Makmal IT 2"},
                ]},
                {"day": "Friday", "classes": [
                    {"time": "8:00 AM - 10:00 AM", "subject": "Kalkulus I (MT101)", "location": "DK-C"},
                ]},
            ],
            "study_times": [
                {"day": "Monday", "time": "10:00 AM - 12:00 PM", "duration_minutes": 120, "reason": "Free gap after BM101"},
                {"day": "Tuesday", "time": "8:00 AM - 10:00 AM", "duration_minutes": 120, "reason": "Morning free slot"},
                {"day": "Wednesday", "time": "2:00 PM - 4:00 PM", "duration_minutes": 120, "reason": "Afternoon free after SN101"},
                {"day": "Thursday", "time": "11:00 AM - 2:00 PM", "duration_minutes": 180, "reason": "Long gap between classes"},
                {"day": "Friday", "time": "10:00 AM - 12:00 PM", "duration_minutes": 120, "reason": "Free after morning class"},
            ],
        },
        "student2": {
            "label": "Semester 2 2025/2026",
            "schedule": [
                {"day": "Monday", "classes": [
                    {"time": "9:00 AM - 11:00 AM", "subject": "Pengaturcaraan Python (CS101)", "location": "Makmal IT 1"},
                    {"time": "2:00 PM - 4:00 PM", "subject": "Struktur Data & Algoritma (CS201)", "location": "Makmal IT 2"},
                ]},
                {"day": "Tuesday", "classes": [
                    {"time": "8:00 AM - 10:00 AM", "subject": "Kalkulus I (MT101)", "location": "DK-C"},
                    {"time": "11:00 AM - 1:00 PM", "subject": "Rangkaian Komputer (IT201)", "location": "Makmal IT 3"},
                ]},
                {"day": "Wednesday", "classes": [
                    {"time": "10:00 AM - 12:00 PM", "subject": "Pengaturcaraan Python (CS101)", "location": "Makmal IT 1"},
                    {"time": "3:00 PM - 5:00 PM", "subject": "Algebra Linear (MT201)", "location": "DK-D"},
                ]},
                {"day": "Thursday", "classes": [
                    {"time": "9:00 AM - 11:00 AM", "subject": "Struktur Data & Algoritma (CS201)", "location": "Makmal IT 2"},
                ]},
                {"day": "Friday", "classes": [
                    {"time": "8:00 AM - 10:00 AM", "subject": "Rangkaian Komputer (IT201)", "location": "Makmal IT 3"},
                    {"time": "11:00 AM - 1:00 PM", "subject": "Algebra Linear (MT201)", "location": "DK-D"},
                ]},
            ],
            "study_times": [
                {"day": "Monday", "time": "11:00 AM - 1:00 PM", "duration_minutes": 120, "reason": "Free gap between CS classes"},
                {"day": "Tuesday", "time": "2:00 PM - 4:00 PM", "duration_minutes": 120, "reason": "Afternoon free slot"},
                {"day": "Wednesday", "time": "12:00 PM - 3:00 PM", "duration_minutes": 180, "reason": "Long gap before MT201"},
                {"day": "Thursday", "time": "11:00 AM - 2:00 PM", "duration_minutes": 180, "reason": "Free after morning class"},
            ],
        },
        "student3": {
            "label": "Semester 2 2025/2026",
            "schedule": [
                {"day": "Monday", "classes": [
                    {"time": "8:00 AM - 10:00 AM", "subject": "Kalkulus I (MT101)", "location": "DK-C"},
                    {"time": "11:00 AM - 1:00 PM", "subject": "Algebra Linear (MT201)", "location": "DK-D"},
                ]},
                {"day": "Tuesday", "classes": [
                    {"time": "10:00 AM - 12:00 PM", "subject": "Pengantar Linguistik Melayu (BM101)", "location": "DK-A"},
                    {"time": "2:00 PM - 4:00 PM", "subject": "Biologi Asas (SN101)", "location": "Makmal Sains"},
                ]},
                {"day": "Wednesday", "classes": [
                    {"time": "8:00 AM - 10:00 AM", "subject": "Kalkulus I (MT101)", "location": "DK-C"},
                    {"time": "2:00 PM - 4:00 PM", "subject": "Kimia Organik (SN202)", "location": "Makmal Kimia"},
                ]},
                {"day": "Thursday", "classes": [
                    {"time": "9:00 AM - 11:00 AM", "subject": "Algebra Linear (MT201)", "location": "DK-D"},
                    {"time": "3:00 PM - 5:00 PM", "subject": "Asas Pangkalan Data (IT101)", "location": "Makmal IT 2"},
                ]},
                {"day": "Friday", "classes": [
                    {"time": "10:00 AM - 12:00 PM", "subject": "Biologi Asas (SN101)", "location": "Makmal Sains"},
                ]},
            ],
            "study_times": [
                {"day": "Monday", "time": "2:00 PM - 4:00 PM", "duration_minutes": 120, "reason": "Afternoon revision"},
                {"day": "Tuesday", "time": "8:00 AM - 10:00 AM", "duration_minutes": 120, "reason": "Morning study before class"},
                {"day": "Wednesday", "time": "10:00 AM - 12:00 PM", "duration_minutes": 120, "reason": "Free gap after Kalkulus"},
                {"day": "Thursday", "time": "11:00 AM - 3:00 PM", "duration_minutes": 240, "reason": "Long free gap"},
                {"day": "Friday", "time": "1:00 PM - 3:00 PM", "duration_minutes": 120, "reason": "Afternoon study"},
            ],
        },
        "student4": {
            "label": "Semester 2 2025/2026",
            "schedule": [
                {"day": "Monday", "classes": [
                    {"time": "8:00 AM - 10:00 AM", "subject": "Biologi Asas (SN101)", "location": "Makmal Sains"},
                    {"time": "2:00 PM - 4:00 PM", "subject": "Kimia Organik (SN202)", "location": "Makmal Kimia"},
                ]},
                {"day": "Tuesday", "classes": [
                    {"time": "9:00 AM - 11:00 AM", "subject": "Pengaturcaraan Python (CS101)", "location": "Makmal IT 1"},
                    {"time": "2:00 PM - 4:00 PM", "subject": "Kalkulus I (MT101)", "location": "DK-C"},
                ]},
                {"day": "Wednesday", "classes": [
                    {"time": "8:00 AM - 10:00 AM", "subject": "Biologi Asas (SN101)", "location": "Makmal Sains"},
                    {"time": "11:00 AM - 1:00 PM", "subject": "Rangkaian Komputer (IT201)", "location": "Makmal IT 3"},
                ]},
                {"day": "Thursday", "classes": [
                    {"time": "10:00 AM - 12:00 PM", "subject": "Kimia Organik (SN202)", "location": "Makmal Kimia"},
                ]},
                {"day": "Friday", "classes": [
                    {"time": "8:00 AM - 10:00 AM", "subject": "Kalkulus I (MT101)", "location": "DK-C"},
                    {"time": "11:00 AM - 1:00 PM", "subject": "Pengaturcaraan Python (CS101)", "location": "Makmal IT 1"},
                ]},
            ],
            "study_times": [
                {"day": "Monday", "time": "10:00 AM - 12:00 PM", "duration_minutes": 120, "reason": "Free gap after SN101"},
                {"day": "Tuesday", "time": "11:00 AM - 2:00 PM", "duration_minutes": 180, "reason": "Long midday gap"},
                {"day": "Wednesday", "time": "2:00 PM - 4:00 PM", "duration_minutes": 120, "reason": "Afternoon study"},
                {"day": "Thursday", "time": "1:00 PM - 4:00 PM", "duration_minutes": 180, "reason": "Afternoon free after SN202"},
            ],
        },
        "student5": {
            "label": "Semester 2 2025/2026",
            "schedule": [
                {"day": "Monday", "classes": [
                    {"time": "9:00 AM - 11:00 AM", "subject": "Asas Pangkalan Data (IT101)", "location": "Makmal IT 2"},
                    {"time": "2:00 PM - 4:00 PM", "subject": "Rangkaian Komputer (IT201)", "location": "Makmal IT 3"},
                ]},
                {"day": "Tuesday", "classes": [
                    {"time": "8:00 AM - 10:00 AM", "subject": "Struktur Data & Algoritma (CS201)", "location": "Makmal IT 2"},
                    {"time": "11:00 AM - 1:00 PM", "subject": "Kesusasteraan Melayu Moden (BM202)", "location": "DK-B"},
                ]},
                {"day": "Wednesday", "classes": [
                    {"time": "10:00 AM - 12:00 PM", "subject": "Asas Pangkalan Data (IT101)", "location": "Makmal IT 2"},
                    {"time": "2:00 PM - 4:00 PM", "subject": "Pengantar Linguistik Melayu (BM101)", "location": "DK-A"},
                ]},
                {"day": "Thursday", "classes": [
                    {"time": "9:00 AM - 11:00 AM", "subject": "Rangkaian Komputer (IT201)", "location": "Makmal IT 3"},
                    {"time": "3:00 PM - 5:00 PM", "subject": "Algebra Linear (MT201)", "location": "DK-D"},
                ]},
                {"day": "Friday", "classes": [
                    {"time": "8:00 AM - 10:00 AM", "subject": "Kesusasteraan Melayu Moden (BM202)", "location": "DK-B"},
                ]},
            ],
            "study_times": [
                {"day": "Monday", "time": "11:00 AM - 1:00 PM", "duration_minutes": 120, "reason": "Free between IT classes"},
                {"day": "Tuesday", "time": "2:00 PM - 4:00 PM", "duration_minutes": 120, "reason": "Afternoon revision"},
                {"day": "Wednesday", "time": "8:00 AM - 10:00 AM", "duration_minutes": 120, "reason": "Morning study"},
                {"day": "Thursday", "time": "11:00 AM - 3:00 PM", "duration_minutes": 240, "reason": "Long gap between classes"},
                {"day": "Friday", "time": "10:00 AM - 12:00 PM", "duration_minutes": 120, "reason": "Study after BM202"},
            ],
        },
    }

    tt_count = 0
    for email, uid in students.items():
        skey = email.split("@")[0]
        tt = timetable_defs.get(skey)
        if not tt:
            continue
        tt_id = gen_id()
        db.collection("savedTimetables").document(tt_id).set({
            "userId": uid,
            "semesterLabel": tt["label"],
            "parsed_schedule": tt["schedule"],
            "recommended_study_times": tt["study_times"],
            "createdAt": now.isoformat(),
        })
        tt_count += 1
    print(f"  Created {tt_count} saved timetables")

    # ── Learning Profiles (VARK) ──
    print("\n=== Seeding learning profiles ===")
    vark_profiles = {
        "student1": {"style": "reading", "strengths": ["Menulis esei", "Membaca nota", "Menganalisis teks"], "weaknesses": ["Persembahan lisan", "Kerja kumpulan"]},
        "student2": {"style": "kinesthetic", "strengths": ["Pengaturcaraan hands-on", "Eksperimen makmal"], "weaknesses": ["Membaca nota panjang", "Hafalan teori"]},
        "student3": {"style": "visual", "strengths": ["Peta minda", "Gambar rajah", "Grafik"], "weaknesses": ["Mendengar kuliah panjang", "Nota bertulis"]},
        "student4": {"style": "auditory", "strengths": ["Perbincangan kumpulan", "Mendengar penjelasan", "Pembentangan"], "weaknesses": ["Membaca sendiri", "Kerja individu"]},
        "student5": {"style": "visual", "strengths": ["Video tutorial", "Gambar rajah rangkaian", "Carta alir"], "weaknesses": ["Hafalan formula", "Nota panjang"]},
    }
    lp_count = 0
    for email, uid in students.items():
        skey = email.split("@")[0]
        profile = vark_profiles.get(skey)
        if not profile:
            continue
        lp_id = gen_id()
        db.collection("learningProfiles").document(lp_id).set({
            "userId": uid,
            "learningStyle": profile["style"],
            "strengths": profile["strengths"],
            "weaknesses": profile["weaknesses"],
            "updatedAt": now.isoformat(),
        })
        lp_count += 1
    print(f"  Created {lp_count} learning profiles")

    # ── Conversations & Messages ──
    print("\n=== Seeding conversations & messages ===")
    conv_count = 0
    msg_count = 0

    conversation_scripts = [
        # Student1 ↔ Lecturer1
        ("student1", "lecturer1", [
            ("student1", "Assalamualaikum Dr. Siti, saya ada soalan tentang tugasan morfologi."),
            ("lecturer1", "Waalaikumussalam Nurul. Sila tanya, saya sedia membantu."),
            ("student1", "Adakah kita perlu analisis imbuhan sisipan juga?"),
            ("lecturer1", "Ya, sila sertakan imbuhan sisipan seperti -el-, -er-, -em- dalam analisis anda."),
            ("student1", "Terima kasih Dr. Siti, faham sekarang."),
        ]),
        # Student2 ↔ Lecturer2
        ("student2", "lecturer2", [
            ("student2", "Prof. Ahmad, saya ada masalah dengan code Python saya. Boleh bantu?"),
            ("lecturer2", "Boleh, apakah error yang anda dapat?"),
            ("student2", "IndexError: list index out of range. Saya cuba akses elemen ke-5 dalam senarai 3 elemen."),
            ("lecturer2", "Pastikan indeks tidak melebihi len(list)-1. Gunakan len() untuk semak panjang senarai terlebih dahulu."),
        ]),
        # Student1 ↔ Student3
        ("student1", "student3", [
            ("student1", "Mei Ling, kamu dah siap tugasan MT101 belum?"),
            ("student3", "Belum lagi, masih stuck soalan nombor 7. Kamu?"),
            ("student1", "Saya pun sama. Jom study group esok petang?"),
            ("student3", "OK, jumpa di perpustakaan pukul 2 petang."),
        ]),
        # Student4 ↔ Lecturer4
        ("student4", "lecturer4", [
            ("student4", "Dr. Kavitha, bolehkah saya dapatkan nota tambahan untuk Bab 4 Mitosis?"),
            ("lecturer4", "Sudah saya muat naik di bahagian Resources. Sila semak Minggu 4."),
            ("student4", "Terima kasih Dr. Kavitha."),
        ]),
        # Student5 ↔ Student2
        ("student5", "student2", [
            ("student5", "Hafiz, kamu faham konsep SQL JOIN?"),
            ("student2", "INNER JOIN ambil yang sama je, LEFT JOIN ambil semua dari kiri."),
            ("student5", "Ohh, faham dah. Thanks bro!"),
        ]),
    ]

    for user_a_key, user_b_key, messages in conversation_scripts:
        uid_a = uids.get(f"{user_a_key}@mysmartstudy.com")
        uid_b = uids.get(f"{user_b_key}@mysmartstudy.com")
        if not uid_a or not uid_b:
            continue
        conv_id = gen_id()
        last_msg = messages[-1][1]
        db.collection("conversations").document(conv_id).set({
            "participants": [uid_a, uid_b],
            "lastMessage": last_msg,
            "lastMessageAt": now.isoformat(),
            "createdAt": (now - timedelta(days=3)).isoformat(),
        })
        conv_count += 1

        for idx, (sender_key, text) in enumerate(messages):
            mid = gen_id()
            sender_uid = uids.get(f"{sender_key}@mysmartstudy.com")
            db.collection("messages").document(mid).set({
                "conversationId": conv_id,
                "senderId": sender_uid,
                "senderName": _name(uids, sender_uid),
                "text": text,
                "readBy": [sender_uid],
                "createdAt": (now - timedelta(hours=len(messages) - idx)).isoformat(),
            })
            msg_count += 1

    print(f"  Created {conv_count} conversations, {msg_count} messages")

    # ── Peer Reviews ──
    print("\n=== Seeding peer reviews ===")
    pr_count = 0
    review_comments = [
        "Kerja yang baik. Analisis anda mendalam dan terperinci. Cadangan: tambahkan lebih banyak contoh.",
        "Strukturnya jelas dan mudah difahami. Boleh diperbaiki dari segi format rujukan.",
        "Tugasan ini menunjukkan pemahaman yang baik. Sila semak ejaan beberapa perkataan.",
        "Saya suka cara anda menyusun maklumat. Mungkin boleh tambah gambar rajah.",
        "Kerja yang memuaskan. Cadangan: jelaskan lebih lanjut bahagian kesimpulan.",
        "Analisis yang kritis dan baik. Beberapa poin boleh diperkembangkan lagi.",
    ]
    reviewed_subs = random.sample(all_submissions, min(10, len(all_submissions)))
    for sub in reviewed_subs:
        reviewer_candidates = [s for s in student_list if s != sub["studentId"]]
        if not reviewer_candidates:
            continue
        reviewer = random.choice(reviewer_candidates)
        pr_id = gen_id()
        db.collection("peerReviews").document(pr_id).set({
            "submissionId": sub["id"],
            "reviewerId": reviewer,
            "reviewerName": _name(uids, reviewer),
            "rating": random.randint(3, 5),
            "comment": random.choice(review_comments),
            "createdAt": now - timedelta(hours=random.randint(1, 48)),
        })
        pr_count += 1
    print(f"  Created {pr_count} peer reviews")

    # ── Rubrics (for some assignments) ──
    print("\n=== Seeding rubrics ===")
    rubric_count = 0
    for a in assignments[:6]:
        rubric_id = gen_id()
        criteria = [
            {"name": "Isi Kandungan", "description": "Ketepatan dan kedalaman isi kandungan", "maxPoints": 40},
            {"name": "Persembahan", "description": "Kekemasan, format, dan susun atur", "maxPoints": 20},
            {"name": "Bahasa", "description": "Tatabahasa, ejaan, dan gaya penulisan", "maxPoints": 20},
            {"name": "Kreativiti", "description": "Keunikan pendekatan dan idea", "maxPoints": 20},
        ]
        db.collection("rubrics").document(rubric_id).set({
            "assignmentId": a["id"],
            "courseId": a["courseId"],
            "criteria": criteria,
            "createdAt": now,
        })
        rubric_count += 1
    print(f"  Created {rubric_count} rubrics")

    print("\n=== Data seeding complete! ===")


# ═══════════════════════════════════════════
# Main
# ═══════════════════════════════════════════
if __name__ == "__main__":
    clear_all()
    delete_auth_users()
    uids = create_users()
    seed_data(uids)

    print("\n" + "=" * 60)
    print("ALL ACCOUNTS — Password: " + DEFAULT_PASSWORD)
    print("=" * 60)
    print("\nLecturers:")
    for i in range(1, 6):
        u = [x for x in USERS if x["email"] == f"lecturer{i}@mysmartstudy.com"][0]
        print(f"  {u['email']} — {u['displayName']} ({u.get('department', '')})")
    print("\nStudents:")
    for i in range(1, 6):
        u = [x for x in USERS if x["email"] == f"student{i}@mysmartstudy.com"][0]
        print(f"  {u['email']} — {u['displayName']} (Class: {u.get('className', '')}, Year {u.get('year', '')}/Sem {u.get('semester', '')})")
    print("\nAdmin:")
    print(f"  admin@mysmartstudy.com — Admin MySmartStudy")
    print()
