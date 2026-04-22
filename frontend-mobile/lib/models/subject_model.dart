/// Course model — parses from FastAPI snake_case JSON responses.
class SubjectModel {
  final String id;
  final String name;
  final String courseCode;
  final String joinCode;
  final String createdBy;
  final String lecturerName;
  final String semester;
  final String description;
  final int enrolledCount;
  final DateTime? createdAt;

  SubjectModel({
    required this.id,
    required this.name,
    this.courseCode = '',
    required this.joinCode,
    required this.createdBy,
    this.lecturerName = '',
    this.semester = '1',
    this.description = '',
    this.enrolledCount = 0,
    required this.createdAt,
  });

  factory SubjectModel.fromApi(Map<String, dynamic> data) {
    DateTime? created;
    final ts = data['created_at'] ?? data['createdAt'];
    if (ts is String && ts.isNotEmpty) created = DateTime.tryParse(ts);

    return SubjectModel(
      id: (data['id'] ?? '').toString(),
      name: (data['course_name'] ?? data['courseName'] ?? '').toString(),
      courseCode: (data['course_code'] ?? data['courseCode'] ?? '').toString(),
      joinCode: (data['join_code'] ?? data['joinCode'] ?? '').toString(),
      createdBy: (data['lecturer_id'] ?? data['lecturerId'] ?? '').toString(),
      lecturerName:
          (data['lecturer_name'] ?? data['lecturerName'] ?? '').toString(),
      semester: (data['semester'] ?? '1').toString(),
      description: (data['description'] ?? '').toString(),
      enrolledCount: (data['enrolled_count'] ?? 0) is int
          ? data['enrolled_count'] ?? 0
          : int.tryParse(data['enrolled_count']?.toString() ?? '0') ?? 0,
      createdAt: created,
    );
  }
}

/// Lightweight model for the user's course list view.
class UserSubjectModel {
  final String subjectId;
  final String name;
  final String courseCode;
  final String joinCode;
  final String lecturerName;
  final String semester;
  final String roleInSubject;
  final int enrolledCount;

  UserSubjectModel({
    required this.subjectId,
    required this.name,
    this.courseCode = '',
    required this.joinCode,
    this.lecturerName = '',
    this.semester = '',
    required this.roleInSubject,
    this.enrolledCount = 0,
  });

  factory UserSubjectModel.fromApi(Map<String, dynamic> data, String role) {
    return UserSubjectModel(
      subjectId: (data['id'] ?? '').toString(),
      name: (data['course_name'] ?? data['courseName'] ?? '').toString(),
      courseCode: (data['course_code'] ?? '').toString(),
      joinCode: (data['join_code'] ?? data['joinCode'] ?? '').toString(),
      lecturerName: (data['lecturer_name'] ?? '').toString(),
      semester: (data['semester'] ?? '').toString(),
      roleInSubject: role,
      enrolledCount: (data['enrolled_count'] ?? 0) is int
          ? data['enrolled_count'] ?? 0
          : int.tryParse(data['enrolled_count']?.toString() ?? '0') ?? 0,
    );
  }
}
