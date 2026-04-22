/// User profile model — parses from FastAPI snake_case JSON responses.
class UserProfile {
  final String uid;
  final String displayName;
  final String email;
  final String role;

  final String className;
  final int? year;
  final int? semester;

  final String department;
  final String photoURL;
  final int points;
  final int streak;
  final List<String> badges;

  UserProfile({
    required this.uid,
    required this.displayName,
    required this.email,
    required this.role,
    this.className = '',
    this.year,
    this.semester,
    this.department = '',
    this.photoURL = '',
    this.points = 0,
    this.streak = 0,
    this.badges = const [],
  });

  factory UserProfile.fromApi(Map<String, dynamic> data) {
    int? toInt(dynamic v) {
      if (v == null) return null;
      if (v is int) return v;
      if (v is num) return v.toInt();
      return int.tryParse(v.toString());
    }

    return UserProfile(
      uid: (data['id'] ?? data['uid'] ?? '').toString(),
      displayName:
          (data['display_name'] ?? data['displayName'] ?? '').toString(),
      email: (data['email'] ?? '').toString(),
      role: (data['role'] ?? 'student').toString(),
      className:
          (data['class_name'] ?? data['className'] ?? '').toString(),
      year: toInt(data['year']),
      semester: toInt(data['semester']),
      department: (data['department'] ?? '').toString(),
      photoURL:
          (data['photo_url'] ?? data['photoURL'] ?? '').toString(),
      points: toInt(data['points']) ?? 0,
      streak: toInt(data['streak']) ?? 0,
      badges: List<String>.from(data['badges'] ?? []),
    );
  }

  /// Full avatar URL for display, or null if no photo set.
  String? get avatarUrl {
    if (photoURL.isEmpty) return null;
    if (photoURL.startsWith('http')) return photoURL;
    return 'http://10.0.2.2:8000$photoURL';
  }

  /// Whether this user has a profile photo.
  bool get hasAvatar => photoURL.isNotEmpty;
}
