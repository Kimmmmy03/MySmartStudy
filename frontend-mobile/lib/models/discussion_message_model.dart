/// Discussion message model — parses from FastAPI snake_case JSON responses.
class DiscussionMessageModel {
  final String id;
  final String courseId;
  final String text;
  final String senderId;
  final String senderName;
  final String senderRole;
  final DateTime createdAt;

  DiscussionMessageModel({
    required this.id,
    required this.courseId,
    required this.text,
    required this.senderId,
    required this.senderName,
    required this.senderRole,
    required this.createdAt,
  });

  factory DiscussionMessageModel.fromApi(Map<String, dynamic> data) {
    DateTime created = DateTime.now();
    final ts = data['created_at'] ?? data['createdAt'];
    if (ts is String && ts.isNotEmpty) {
      created = DateTime.tryParse(ts) ?? DateTime.now();
    }

    return DiscussionMessageModel(
      id: (data['id'] ?? '').toString(),
      courseId: (data['course_id'] ?? data['courseId'] ?? '').toString(),
      text: (data['text'] ?? '').toString(),
      senderId: (data['sender_id'] ?? data['senderId'] ?? '').toString(),
      senderName:
          (data['sender_name'] ?? data['senderName'] ?? 'Unknown').toString(),
      senderRole:
          (data['sender_role'] ?? data['senderRole'] ?? 'student').toString(),
      createdAt: created,
    );
  }
}
