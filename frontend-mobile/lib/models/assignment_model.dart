/// Assignment model — parses from FastAPI snake_case JSON responses.
class AssignmentModel {
  final String id;
  final String subjectId;
  final String subjectName;
  final String title;
  final String details;
  final DateTime? dueAt;
  final String createdBy;
  final DateTime? createdAt;

  AssignmentModel({
    required this.id,
    required this.subjectId,
    this.subjectName = '',
    required this.title,
    required this.details,
    required this.dueAt,
    required this.createdBy,
    this.createdAt,
  });

  factory AssignmentModel.fromApi(Map<String, dynamic> data,
      {String subjectName = ''}) {
    DateTime? due;
    final ts = data['deadline'] ?? data['due_at'];
    if (ts is String && ts.isNotEmpty) due = DateTime.tryParse(ts);

    DateTime? created;
    final ca = data['created_at'];
    if (ca is String && ca.isNotEmpty) created = DateTime.tryParse(ca);

    return AssignmentModel(
      id: (data['id'] ?? '').toString(),
      subjectId: (data['course_id'] ?? data['courseId'] ?? '').toString(),
      subjectName: subjectName,
      title: (data['title'] ?? '').toString(),
      details: (data['description'] ?? data['details'] ?? '').toString(),
      dueAt: due,
      createdBy: (data['lecturer_id'] ?? data['lecturerId'] ?? '').toString(),
      createdAt: created,
    );
  }

  bool get isOverdue => dueAt != null && dueAt!.isBefore(DateTime.now());
}
