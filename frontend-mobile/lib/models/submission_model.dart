/// Submission model — parses from FastAPI snake_case JSON responses.
class SubmissionModel {
  final String id;
  final String assignmentId;
  final String studentUid;
  final String studentName;
  final String submissionType;
  final String? mapId;
  final String externalLink;
  final String comments;
  final DateTime? submittedAt;

  final double? grade;
  final String feedback;

  SubmissionModel({
    required this.id,
    this.assignmentId = '',
    required this.studentUid,
    required this.studentName,
    this.submissionType = 'external_link',
    this.mapId,
    this.externalLink = '',
    this.comments = '',
    required this.submittedAt,
    required this.grade,
    required this.feedback,
  });

  factory SubmissionModel.fromApi(Map<String, dynamic> data) {
    DateTime? submitted;
    final s = data['submitted_at'] ?? data['submittedAt'];
    if (s is String && s.isNotEmpty) submitted = DateTime.tryParse(s);

    double? gradeVal;
    final m = data['grade'] ?? data['marks'];
    if (m is num) gradeVal = m.toDouble();

    return SubmissionModel(
      id: (data['id'] ?? '').toString(),
      assignmentId:
          (data['assignment_id'] ?? data['assignmentId'] ?? '').toString(),
      studentUid:
          (data['student_id'] ?? data['studentId'] ?? '').toString(),
      studentName:
          (data['student_name'] ?? data['studentName'] ?? '').toString(),
      submissionType:
          (data['submission_type'] ?? data['submissionType'] ?? 'external_link')
              .toString(),
      mapId: data['map_id']?.toString(),
      externalLink:
          (data['external_link'] ?? data['externalLink'] ?? '').toString(),
      comments: (data['comments'] ?? '').toString(),
      submittedAt: submitted,
      grade: gradeVal,
      feedback: (data['feedback'] ?? '').toString(),
    );
  }

  bool get isGraded => grade != null;

  String get gradeLetterAndPercent {
    if (grade == null) return 'Not graded';
    final g = grade!;
    final letter = g >= 80 ? 'A' : g >= 60 ? 'B' : g >= 50 ? 'C' : 'F';
    return '$letter (${g.toStringAsFixed(0)}%)';
  }

  String get status => isGraded ? 'graded' : 'submitted';
}
