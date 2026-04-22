/// Course member model — parses from FastAPI snake_case JSON (UserOut).
class SubjectMemberModel {
  final String uid;
  final String name;
  final String email;
  final String roleInSubject;

  SubjectMemberModel({
    required this.uid,
    required this.name,
    this.email = '',
    required this.roleInSubject,
  });

  factory SubjectMemberModel.fromApi(Map<String, dynamic> data,
      {String role = 'student'}) {
    return SubjectMemberModel(
      uid: (data['id'] ?? data['uid'] ?? '').toString(),
      name: (data['display_name'] ?? data['displayName'] ?? '').toString(),
      email: (data['email'] ?? '').toString(),
      roleInSubject: role,
    );
  }
}
