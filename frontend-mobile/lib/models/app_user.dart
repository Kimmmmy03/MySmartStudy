class AppUser {
  final String uid;
  final String email;
  final String displayName;
  final String role;

  AppUser({
    required this.uid,
    required this.email,
    required this.displayName,
    required this.role,
  });

  factory AppUser.fromMap(String uid, Map<String, dynamic> data) {
    return AppUser(
      uid: uid,
      email: (data['email'] ?? '').toString(),
      displayName:
          (data['display_name'] ?? data['displayName'] ?? data['name'] ?? '')
              .toString(),
      role: (data['role'] ?? 'student').toString(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'email': email,
      'display_name': displayName,
      'role': role,
    };
  }
}
