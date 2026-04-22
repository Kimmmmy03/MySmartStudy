/// Announcement model — parses from FastAPI snake_case JSON responses.
class AnnouncementModel {
  final String id;
  final String subjectId;
  final String subjectName;
  final String title;
  final String message;
  final String senderId;
  final String senderName;
  final String senderPhotoUrl;
  final DateTime? createdAt;

  AnnouncementModel({
    required this.id,
    required this.subjectId,
    this.subjectName = '',
    required this.title,
    required this.message,
    this.senderId = '',
    this.senderName = '',
    this.senderPhotoUrl = '',
    required this.createdAt,
  });

  factory AnnouncementModel.fromApi(Map<String, dynamic> data,
      {String subjectName = ''}) {
    DateTime? created;
    final ts = data['created_at'] ?? data['createdAt'];
    if (ts is String && ts.isNotEmpty) created = DateTime.tryParse(ts);

    return AnnouncementModel(
      id: (data['id'] ?? '').toString(),
      subjectId: (data['course_id'] ?? data['courseId'] ?? '').toString(),
      subjectName: subjectName,
      title: (data['title'] ?? '').toString(),
      message: (data['content'] ?? data['message'] ?? '').toString(),
      senderId: (data['sender_id'] ?? data['senderId'] ?? '').toString(),
      senderName: (data['sender_name'] ?? data['senderName'] ?? '').toString(),
      senderPhotoUrl:
          (data['sender_photo_url'] ?? data['senderPhotoUrl'] ?? '').toString(),
      createdAt: created,
    );
  }
}
