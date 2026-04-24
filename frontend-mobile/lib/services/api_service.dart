import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;

/// Thrown when the backend is unreachable (connection refused, DNS failure,
/// timeout, etc.). `toString()` returns the plain message so it can be fed
/// directly into a SnackBar without an `Exception:` prefix.
class NetworkException implements Exception {
  final String message;
  const NetworkException(
      [this.message =
          'Failed to connect to server. Please check your connection and try again.']);
  @override
  String toString() => message;
}

/// Centralized API service for the MySmartStudy mobile app.
/// Mirrors the web's api.ts, calling the FastAPI backend at localhost:8000.
/// On Android emulator, 10.0.2.2 resolves back to the host machine's localhost.
class ApiService {
  static const String _base = "https://mysmartstudy-api-qf5vai3csq-as.a.run.app/api";
  static const String _origin = "https://mysmartstudy-api-qf5vai3csq-as.a.run.app";

  /// Resolve a possibly-relative photo URL (e.g. "/uploads/avatars/foo.jpg")
  /// to a fully-qualified URL usable by the image loader. Returns null for
  /// empty/invalid input.
  static String? resolvePhotoUrl(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    return '$_origin$raw';
  }

  // ── Token helper ──
  static Future<Map<String, String>> _authHeaders() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      debugPrint("[API] No Firebase user — sending request without auth");
      return {'Content-Type': 'application/json'};
    }
    final token = await user.getIdToken();
    return {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    };
  }

  /// Default timeout for every HTTP request. After this window we assume the
  /// backend is unreachable and surface [NetworkException].
  static const Duration _timeout = Duration(seconds: 15);

  /// Runs [send] and converts low-level connection failures (DNS, refused,
  /// reset, TLS handshake, timeout) into [NetworkException] with a friendly
  /// message. HTTP-level errors (4xx/5xx) are still thrown by callers using
  /// the existing `isOk` check.
  static Future<http.Response> _safeSend(
    Future<http.Response> Function() send,
    String method,
    String path,
  ) async {
    try {
      return await send().timeout(_timeout);
    } on SocketException catch (e) {
      debugPrint('[API] $method $path NETWORK FAIL: $e');
      throw const NetworkException();
    } on TimeoutException catch (e) {
      debugPrint('[API] $method $path TIMEOUT: $e');
      throw const NetworkException(
          'Server took too long to respond. Please try again.');
    } on http.ClientException catch (e) {
      debugPrint('[API] $method $path CLIENT FAIL: $e');
      throw const NetworkException();
    } on HandshakeException catch (e) {
      debugPrint('[API] $method $path TLS FAIL: $e');
      throw const NetworkException(
          'Secure connection to server failed. Please try again.');
    }
  }

  // ── Generic request helper ──
  static Future<dynamic> _get(String path) async {
    final headers = await _authHeaders();
    debugPrint("[API] GET $path");
    final res = await _safeSend(
      () => http.get(Uri.parse('$_base$path'), headers: headers),
      'GET',
      path,
    );
    if (!res.isOk) {
      debugPrint("[API] GET $path FAILED: ${res.statusCode} ${res.body}");
      throw Exception('GET $path failed: ${res.statusCode} ${res.body}');
    }
    final body = res.body;
    if (body.isEmpty) return null;
    return jsonDecode(body);
  }

  static Future<dynamic> _post(String path, Map<String, dynamic> body) async {
    final headers = await _authHeaders();
    debugPrint("[API] POST $path");
    final res = await _safeSend(
      () => http.post(
        Uri.parse('$_base$path'),
        headers: headers,
        body: jsonEncode(body),
      ),
      'POST',
      path,
    );
    if (!res.isOk) {
      debugPrint("[API] POST $path FAILED: ${res.statusCode} ${res.body}");
      throw Exception('POST $path failed: ${res.statusCode} ${res.body}');
    }
    final b = res.body;
    if (b.isEmpty) return null;
    return jsonDecode(b);
  }

  static Future<dynamic> _patch(String path, Map<String, dynamic> body) async {
    final headers = await _authHeaders();
    final res = await _safeSend(
      () => http.patch(
        Uri.parse('$_base$path'),
        headers: headers,
        body: jsonEncode(body),
      ),
      'PATCH',
      path,
    );
    if (!res.isOk) {
      throw Exception('PATCH $path failed: ${res.statusCode} ${res.body}');
    }
    final b = res.body;
    if (b.isEmpty) return null;
    return jsonDecode(b);
  }

  static Future<dynamic> _delete(String path) async {
    final headers = await _authHeaders();
    final res = await _safeSend(
      () => http.delete(Uri.parse('$_base$path'), headers: headers),
      'DELETE',
      path,
    );
    if (!res.isOk) {
      throw Exception('DELETE $path failed: ${res.statusCode} ${res.body}');
    }
    return null;
  }

  // ───────────────────────────────────────────────────────────────────
  // Auth
  // ───────────────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> syncUser({
    required String idToken,
    String? displayName,
    String? role,
  }) async {
    final data = await _post('/auth/sync', {
      'id_token': idToken,
      if (displayName != null) 'display_name': displayName,
      if (role != null) 'role': role,
    });
    return Map<String, dynamic>.from(data);
  }

  static Future<Map<String, dynamic>> getMe() async {
    final data = await _get('/auth/me');
    return Map<String, dynamic>.from(data);
  }

  /// Fire-and-forget welcome-email trigger. Backend logs failures internally;
  /// we swallow errors so registration is never blocked by mail delivery.
  static Future<void> sendWelcomeEmail() async {
    try {
      await _post('/auth/welcome-email', {});
    } catch (e) {
      debugPrint('[API] sendWelcomeEmail failed (non-fatal): $e');
    }
  }

  /// Ask the backend to email a Firebase password-reset link via our own SMTP.
  /// Backend responds 200 even when the email is unknown (no enumeration), so
  /// surfacing success is safe; HTTP errors (network, server) bubble up.
  static Future<void> requestPasswordReset(String email) async {
    await _post('/auth/request-password-reset', {'email': email});
  }

  // ───────────────────────────────────────────────────────────────────
  // Users
  // ───────────────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> updateMe(Map<String, dynamic> fields) async {
    final data = await _patch('/users/me', fields);
    return Map<String, dynamic>.from(data);
  }

  static Future<Map<String, dynamic>> getUser(String userId) async {
    final data = await _get('/users/$userId');
    return Map<String, dynamic>.from(data);
  }

  /// Upload avatar image. Returns {"photo_url": "..."}.
  static Future<Map<String, dynamic>> uploadAvatar(String filePath) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) throw Exception('Not authenticated');
    final token = await user.getIdToken();

    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$_base/users/me/avatar'),
    );
    request.headers['Authorization'] = 'Bearer $token';
    request.files.add(await http.MultipartFile.fromPath('file', filePath));

    final streamed = await request.send();
    final res = await http.Response.fromStream(streamed);
    if (!res.isOk) {
      throw Exception('Avatar upload failed: ${res.statusCode} ${res.body}');
    }
    return Map<String, dynamic>.from(jsonDecode(res.body));
  }

  // ───────────────────────────────────────────────────────────────────
  // Courses
  // ───────────────────────────────────────────────────────────────────
  static Future<List<dynamic>> getTeachingCourses() =>
      _get('/courses/teaching').then((d) => List.from(d));

  static Future<List<dynamic>> getEnrolledCourses() =>
      _get('/courses/enrolled').then((d) => List.from(d));

  static Future<Map<String, dynamic>> createCourse(
      {required String courseName,
      String courseCode = '',
      String semester = '',
      String description = ''}) async {
    final data = await _post('/courses/', {
      'course_name': courseName,
      'course_code': courseCode,
      'semester': semester,
      'description': description,
    });
    return Map<String, dynamic>.from(data);
  }

  static Future<Map<String, dynamic>> getCourse(String courseId) async {
    final data = await _get('/courses/$courseId');
    return Map<String, dynamic>.from(data);
  }

  static Future<Map<String, dynamic>> joinCourse(String joinCode) async {
    final data = await _post('/courses/join', {'join_code': joinCode});
    return Map<String, dynamic>.from(data);
  }

  static Future<Map<String, dynamic>> updateCourse(
      String courseId, Map<String, dynamic> fields) async {
    final data = await _patch('/courses/$courseId', fields);
    return Map<String, dynamic>.from(data);
  }

  static Future<void> deleteCourse(String courseId) =>
      _delete('/courses/$courseId');

  static Future<List<dynamic>> getCourseStudents(String courseId) =>
      _get('/courses/$courseId/students').then((d) => List.from(d));

  // ───────────────────────────────────────────────────────────────────
  // Assignments
  // ───────────────────────────────────────────────────────────────────
  static Future<List<dynamic>> getAssignments(String courseId) =>
      _get('/assignments/?course_id=${Uri.encodeComponent(courseId)}').then((d) => List.from(d));

  static Future<List<dynamic>> getAssignmentsByLecturer() =>
      _get('/assignments/by-lecturer').then((d) => List.from(d));

  static Future<Map<String, dynamic>> createAssignment({
    required String courseId,
    required String title,
    String description = '',
    required String deadline,
    bool peerReviewEnabled = false,
  }) async {
    final data = await _post('/assignments/', {
      'course_id': courseId,
      'title': title,
      'description': description,
      'deadline': deadline,
      'peer_review_enabled': peerReviewEnabled,
    });
    return Map<String, dynamic>.from(data);
  }

  static Future<Map<String, dynamic>> updateAssignment(
      String assignmentId, Map<String, dynamic> fields) async {
    final data = await _patch('/assignments/$assignmentId', fields);
    return Map<String, dynamic>.from(data);
  }

  static Future<void> deleteAssignment(String assignmentId) =>
      _delete('/assignments/$assignmentId');

  static Future<List<dynamic>> getSubmissions(String assignmentId) =>
      _get('/assignments/$assignmentId/submissions').then((d) => List.from(d));

  static Future<dynamic> getMySubmission(String assignmentId) =>
      _get('/assignments/$assignmentId/submissions/mine');

  static Future<Map<String, dynamic>> submitAssignment(
      String assignmentId, Map<String, dynamic> body) async {
    final data = await _post('/assignments/$assignmentId/submissions', body);
    return Map<String, dynamic>.from(data);
  }

  static Future<Map<String, dynamic>> gradeSubmission(
      String assignmentId, String submissionId, int grade, String feedback) async {
    final data = await _patch(
        '/assignments/$assignmentId/submissions/$submissionId/grade',
        {'grade': grade, 'feedback': feedback});
    return Map<String, dynamic>.from(data);
  }

  static Future<Map<String, dynamic>> bulkGradeSubmissions(
      String assignmentId, List<Map<String, dynamic>> grades) async {
    final data = await _post(
        '/assignments/$assignmentId/submissions/bulk-grade',
        {'grades': grades});
    return Map<String, dynamic>.from(data);
  }

  static Future<Map<String, dynamic>> releaseGrades(String assignmentId) async {
    final data = await _post('/assignments/$assignmentId/release-grades', {});
    return Map<String, dynamic>.from(data);
  }

  // ───────────────────────────────────────────────────────────────────
  // Discussions
  // ───────────────────────────────────────────────────────────────────
  static Future<List<dynamic>> getDiscussions(String courseId) =>
      _get('/courses/$courseId/discussions/').then((d) => List.from(d));

  static Future<Map<String, dynamic>> createDiscussion(
      String courseId, String text) async {
    final data = await _post('/courses/$courseId/discussions/', {'text': text});
    return Map<String, dynamic>.from(data);
  }

  static Future<void> deleteDiscussion(String courseId, String msgId) =>
      _delete('/courses/$courseId/discussions/$msgId');

  // ───────────────────────────────────────────────────────────────────
  // Announcements
  // ───────────────────────────────────────────────────────────────────
  static Future<List<dynamic>> getAnnouncements(String courseId) =>
      _get('/courses/$courseId/announcements/').then((d) => List.from(d));

  static Future<Map<String, dynamic>> createAnnouncement(
      String courseId, String title, String content) async {
    final data = await _post(
        '/courses/$courseId/announcements/', {'title': title, 'content': content});
    return Map<String, dynamic>.from(data);
  }

  static Future<void> deleteAnnouncement(String courseId, String annId) =>
      _delete('/courses/$courseId/announcements/$annId');

  // ───────────────────────────────────────────────────────────────────
  // Modules (Course Materials / Resources)
  // ───────────────────────────────────────────────────────────────────
  static Future<List<dynamic>> getModules(String courseId) =>
      _get('/courses/$courseId/modules/').then((d) => List.from(d));

  static Future<Map<String, dynamic>> createModule(
      String courseId, String title, {String description = ''}) async {
    final data = await _post('/courses/$courseId/modules/',
        {'title': title, 'description': description});
    return Map<String, dynamic>.from(data);
  }

  static Future<void> deleteModule(String courseId, String moduleId) =>
      _delete('/courses/$courseId/modules/$moduleId');

  static Future<Map<String, dynamic>> createModuleItem(
      String courseId, String moduleId, String title,
      {String type = 'link', String url = ''}) async {
    final data = await _post(
        '/courses/$courseId/modules/$moduleId/items',
        {'title': title, 'type': type, 'url': url});
    return Map<String, dynamic>.from(data);
  }

  static Future<void> deleteModuleItem(
      String courseId, String moduleId, String itemId) =>
      _delete('/courses/$courseId/modules/$moduleId/items/$itemId');

  /// Upload a file (PDF / docx / pptx) as a module item. Returns the created item.
  static Future<Map<String, dynamic>> uploadModuleItem({
    required String courseId,
    required String moduleId,
    required String title,
    required String fileType, // 'pdf' | 'document'
    required String filePath,
  }) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) throw Exception('Not authenticated');
    final token = await user.getIdToken();

    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$_base/courses/$courseId/modules/$moduleId/items/upload'),
    );
    request.headers['Authorization'] = 'Bearer $token';
    request.fields['title']     = title;
    request.fields['file_type'] = fileType;
    request.files.add(await http.MultipartFile.fromPath('file', filePath));

    final streamed = await request.send();
    final res = await http.Response.fromStream(streamed);
    if (!res.isOk) {
      throw Exception('Upload failed: ${res.statusCode} ${res.body}');
    }
    return Map<String, dynamic>.from(jsonDecode(res.body));
  }

  // ───────────────────────────────────────────────────────────────────
  // Maps (Mind Maps)
  // ───────────────────────────────────────────────────────────────────
  static Future<List<dynamic>> getMaps() =>
      _get('/maps/').then((d) => List.from(d));

  static Future<Map<String, dynamic>> getMap(String mapId) async {
    final data = await _get('/maps/$mapId');
    return Map<String, dynamic>.from(data);
  }

  static Future<List<dynamic>> searchMapsByCode(String code) =>
      _get('/maps/search/by-code?code=${Uri.encodeComponent(code)}')
          .then((d) => List.from(d));

  static Future<List<dynamic>> searchMapsByEmail(String email) =>
      _get('/maps/search/by-email?email=${Uri.encodeComponent(email)}')
          .then((d) => List.from(d));

  static Future<List<dynamic>> searchMapsByCourse(String courseId) =>
      _get('/maps/search/by-course/${Uri.encodeComponent(courseId)}')
          .then((d) => List.from(d));

  /// Record that the current lecturer just opened a map.
  /// Backend skips the write for non-lecturers; safe to call unconditionally.
  static Future<void> markMapViewed(String mapId) =>
      _post('/maps/$mapId/view', {});

  /// Fetch the current user's recently viewed maps (synced across devices).
  static Future<List<dynamic>> getRecentlyViewedMaps() =>
      _get('/maps/views/recent').then((d) => List.from(d));

  static Future<Map<String, dynamic>> createMap({
    String title = 'Untitled Map',
    String? graphData,
    String graphFormat = 'reactflow',
    String? nodesText,
    String? thumbnail,
  }) async {
    final data = await _post('/maps/', {
      'title': title,
      if (graphData != null) 'graph_data': graphData,
      'graph_format': graphFormat,
      if (nodesText != null) 'nodes_text': nodesText,
      if (thumbnail != null) 'thumbnail': thumbnail,
    });
    return Map<String, dynamic>.from(data);
  }

  static Future<Map<String, dynamic>> updateMap(
    String mapId, {
    String? title,
    String? graphData,
    String? nodesText,
    String? thumbnail,
  }) async {
    final data = await _patch('/maps/$mapId', {
      if (title != null) 'title': title,
      if (graphData != null) 'graph_data': graphData,
      if (nodesText != null) 'nodes_text': nodesText,
      if (thumbnail != null) 'thumbnail': thumbnail,
    });
    return Map<String, dynamic>.from(data);
  }

  static Future<void> deleteMap(String mapId) => _delete('/maps/$mapId');

  static Future<Map<String, dynamic>> renameMap(
      String mapId, String title) async {
    final data = await _patch('/maps/$mapId', {'title': title});
    return Map<String, dynamic>.from(data);
  }

  static Future<void> addCollaborator(String mapId, String email) =>
      _post('/maps/$mapId/collaborators?email=${Uri.encodeComponent(email)}', {});

  static Future<void> removeCollaborator(String mapId, String email) =>
      _delete('/maps/$mapId/collaborators?email=${Uri.encodeComponent(email)}');

  static Future<List<dynamic>> searchStudents(String query) =>
      _get('/maps/search/students?query=${Uri.encodeComponent(query)}')
          .then((d) => List.from(d));

  // ───────────────────────────────────────────────────────────────────
  // Analytics
  // ───────────────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> getAnalytics() async {
    final data = await _get('/analytics/');
    return Map<String, dynamic>.from(data);
  }

  // ───────────────────────────────────────────────────────────────────
  // Reminders (tasks/planner)
  // ───────────────────────────────────────────────────────────────────
  static Future<List<dynamic>> getReminders(String date) =>
      _get('/reminders/?date=${Uri.encodeComponent(date)}').then((d) => List.from(d));

  static Future<Map<String, dynamic>> createReminder({
    required String date,
    required String title,
    String type = 'other',
    String priority = 'medium',
  }) async {
    final data = await _post('/reminders/', {
      'date': date,
      'title': title,
      'type': type,
      'priority': priority,
    });
    return Map<String, dynamic>.from(data);
  }

  static Future<Map<String, dynamic>> updateReminder(
      String reminderId, Map<String, dynamic> fields) async {
    final data = await _patch('/reminders/$reminderId', fields);
    return Map<String, dynamic>.from(data);
  }

  static Future<void> deleteReminder(String reminderId) =>
      _delete('/reminders/$reminderId');

  // ───────────────────────────────────────────────────────────────────
  // Badges
  // ───────────────────────────────────────────────────────────────────
  static Future<void> awardBadge(String studentId, String badgeId) =>
      _post('/badges/award', {'student_id': studentId, 'badge_id': badgeId});

  static Future<void> revokeBadge(String studentId, String badgeId) =>
      _post('/badges/revoke', {'student_id': studentId, 'badge_id': badgeId});

  static Future<List<dynamic>> getBadgeDefinitions() =>
      _get('/badges/definitions').then((d) => List.from(d));

  static Future<void> checkMyBadges() =>
      _post('/badges/check-my-badges', {});

  // ───────────────────────────────────────────────────────────────────
  // Quizzes
  // ───────────────────────────────────────────────────────────────────
  static Future<List<dynamic>> getQuizzes(String courseId) =>
      _get('/quizzes/?course_id=${Uri.encodeComponent(courseId)}').then((d) => List.from(d));

  static Future<Map<String, dynamic>> getQuiz(String quizId) async {
    final data = await _get('/quizzes/$quizId');
    return Map<String, dynamic>.from(data);
  }

  static Future<List<dynamic>> getQuizQuestions(String quizId) =>
      _get('/quizzes/$quizId/questions').then((d) => List.from(d));

  static Future<Map<String, dynamic>> createQuiz(Map<String, dynamic> body) async {
    final data = await _post('/quizzes/', body);
    return Map<String, dynamic>.from(data);
  }

  static Future<Map<String, dynamic>> updateQuiz(String quizId, Map<String, dynamic> fields) async {
    final data = await _patch('/quizzes/$quizId', fields);
    return Map<String, dynamic>.from(data);
  }

  static Future<void> deleteQuiz(String quizId) => _delete('/quizzes/$quizId');

  static Future<Map<String, dynamic>> addQuizQuestion(String quizId, Map<String, dynamic> body) async {
    final data = await _post('/quizzes/$quizId/questions', body);
    return Map<String, dynamic>.from(data);
  }

  static Future<void> deleteQuizQuestion(String quizId, String questionId) =>
      _delete('/quizzes/$quizId/questions/$questionId');

  static Future<Map<String, dynamic>> submitQuizAttempt(String quizId, Map<String, dynamic> body) async {
    final data = await _post('/quizzes/$quizId/attempt', body);
    return Map<String, dynamic>.from(data);
  }

  static Future<dynamic> getMyQuizAttempt(String quizId) =>
      _get('/quizzes/$quizId/attempt/mine');

  static Future<List<dynamic>> getQuizAttempts(String quizId) =>
      _get('/quizzes/$quizId/attempts').then((d) => List.from(d));

  static Future<Map<String, dynamic>> getQuizResults(String quizId) async {
    final data = await _get('/quizzes/$quizId/results');
    return Map<String, dynamic>.from(data);
  }

  // ───────────────────────────────────────────────────────────────────
  // Gradebook
  // ───────────────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> getGradebookSettings(String courseId) async {
    final data = await _get('/gradebook/settings/$courseId');
    return Map<String, dynamic>.from(data);
  }

  static Future<Map<String, dynamic>> saveGradebookSettings(String courseId, Map<String, dynamic> body) async {
    final data = await _post('/gradebook/settings/$courseId', body);
    return Map<String, dynamic>.from(data);
  }

  static Future<List<dynamic>> getMyGrades(String courseId) =>
      _get('/gradebook/my?course_id=${Uri.encodeComponent(courseId)}').then((d) => List.from(d));

  static Future<List<dynamic>> getCourseGradebook(String courseId) =>
      _get('/gradebook/course/$courseId').then((d) => List.from(d));

  /// Fetches the CSV export as a raw string (lecturer only).
  static Future<String> exportGradebookCsv(String courseId) async {
    final headers = await _authHeaders();
    final res = await http.get(
      Uri.parse('$_base/gradebook/course/$courseId/export'),
      headers: headers,
    );
    if (!res.isOk) {
      throw Exception('Export failed: ${res.statusCode}');
    }
    return res.body;
  }

  // ───────────────────────────────────────────────────────────────────
  // Peer Reviews
  // ───────────────────────────────────────────────────────────────────
  /// List assignments in a course that have peer review enabled (student view).
  static Future<List<dynamic>> getEnabledPeerReviewAssignments(String courseId) =>
      _get('/peer-reviews/enabled/$courseId').then((d) => List.from(d));

  /// Return submissions that the current user can peer-review for an assignment.
  static Future<List<dynamic>> getPeerReviews(String assignmentId) =>
      _get('/peer-reviews/assignment/$assignmentId').then((d) => List.from(d));

  static Future<Map<String, dynamic>> submitPeerReview(String submissionId, Map<String, dynamic> body) async {
    final data = await _post('/peer-reviews/submission/$submissionId', body);
    return Map<String, dynamic>.from(data);
  }

  static Future<List<dynamic>> getSubmissionReviews(String submissionId) =>
      _get('/peer-reviews/submission/$submissionId').then((d) => List.from(d));

  static Future<List<dynamic>> getMyPeerReviews() =>
      _get('/peer-reviews/my-reviews').then((d) => List.from(d));

  // ───────────────────────────────────────────────────────────────────
  // Discussion Topics (Forum)
  // ───────────────────────────────────────────────────────────────────
  static Future<List<dynamic>> getTopics(String courseId) =>
      _get('/courses/$courseId/topics/').then((d) => List.from(d));

  static Future<Map<String, dynamic>> createTopic(String courseId, Map<String, dynamic> body) async {
    final data = await _post('/courses/$courseId/topics/', body);
    return Map<String, dynamic>.from(data);
  }

  static Future<Map<String, dynamic>> updateTopic(String courseId, String topicId, Map<String, dynamic> body) async {
    final data = await _patch('/courses/$courseId/topics/$topicId', body);
    return Map<String, dynamic>.from(data);
  }

  static Future<void> deleteTopic(String courseId, String topicId) =>
      _delete('/courses/$courseId/topics/$topicId');

  static Future<void> toggleTopicPin(String courseId, String topicId) =>
      _patch('/courses/$courseId/topics/$topicId/pin', {});

  static Future<List<dynamic>> getTopicPosts(String courseId, String topicId) =>
      _get('/courses/$courseId/topics/$topicId/posts').then((d) => List.from(d));

  static Future<Map<String, dynamic>> createTopicPost(String courseId, String topicId, Map<String, dynamic> body) async {
    final data = await _post('/courses/$courseId/topics/$topicId/posts', body);
    return Map<String, dynamic>.from(data);
  }

  static Future<void> deleteTopicPost(String courseId, String topicId, String postId) =>
      _delete('/courses/$courseId/topics/$topicId/posts/$postId');

  // ───────────────────────────────────────────────────────────────────
  // Attendance
  // ───────────────────────────────────────────────────────────────────
  static Future<List<dynamic>> getCourseAttendance(String courseId) =>
      _get('/attendance/course/$courseId').then((d) => List.from(d));

  static Future<Map<String, dynamic>> createAttendanceSession(String courseId, Map<String, dynamic> body) async {
    final data = await _post('/attendance/course/$courseId', body);
    return Map<String, dynamic>.from(data);
  }

  static Future<void> updateAttendanceRecord(String sessionId, Map<String, dynamic> body) =>
      _patch('/attendance/session/$sessionId/record', body);

  /// [records] is a list of `{student_id, status}` maps (sent as raw JSON array body).
  static Future<void> bulkUpdateAttendance(
      String sessionId, List<Map<String, dynamic>> records) async {
    final headers = await _authHeaders();
    final res = await http.patch(
      Uri.parse('$_base/attendance/session/$sessionId/bulk'),
      headers: headers,
      body: jsonEncode(records),
    );
    if (!res.isOk) {
      throw Exception(
          'PATCH /attendance/session/$sessionId/bulk failed: ${res.statusCode} ${res.body}');
    }
  }

  static Future<void> deleteAttendanceSession(String sessionId) =>
      _delete('/attendance/session/$sessionId');

  static Future<List<dynamic>> getMyAttendance() =>
      _get('/attendance/student/my').then((d) => List.from(d));

  // ───────────────────────────────────────────────────────────────────
  // Course Completion
  // ───────────────────────────────────────────────────────────────────
  static Future<List<dynamic>> getCourseCompletion(String courseId) =>
      _get('/completion/course/$courseId').then((d) => List.from(d));

  static Future<Map<String, dynamic>> getCompletionSummary(String courseId) async {
    final data = await _get('/completion/course/$courseId/summary');
    return Map<String, dynamic>.from(data);
  }

  // ───────────────────────────────────────────────────────────────────
  // Groups
  // ───────────────────────────────────────────────────────────────────
  static Future<List<dynamic>> getCourseGroups(String courseId) =>
      _get('/courses/$courseId/groups/').then((d) => List.from(d));

  static Future<Map<String, dynamic>> createGroup(String courseId, Map<String, dynamic> body) async {
    final data = await _post('/courses/$courseId/groups/', body);
    return Map<String, dynamic>.from(data);
  }

  static Future<void> addGroupMember(String courseId, String groupId, Map<String, dynamic> body) =>
      _post('/courses/$courseId/groups/$groupId/members', body);

  static Future<void> removeGroupMember(String courseId, String groupId, String studentId) =>
      _delete('/courses/$courseId/groups/$groupId/members/$studentId');

  static Future<void> deleteGroup(String courseId, String groupId) =>
      _delete('/courses/$courseId/groups/$groupId');

  static Future<List<dynamic>> autoAssignGroups(String courseId, Map<String, dynamic> body) async {
    final data = await _post('/courses/$courseId/groups/auto-assign', body);
    return List.from(data);
  }

  // ───────────────────────────────────────────────────────────────────
  // Group Tasks (task/project-scoped groups)
  // ───────────────────────────────────────────────────────────────────
  static Future<List<dynamic>> getGroupTasks(String courseId) =>
      _get('/courses/$courseId/group-tasks/').then((d) => List.from(d));

  static Future<Map<String, dynamic>> createGroupTask(String courseId, Map<String, dynamic> body) async {
    final data = await _post('/courses/$courseId/group-tasks/', body);
    return Map<String, dynamic>.from(data);
  }

  static Future<Map<String, dynamic>> getGroupTask(String courseId, String taskId) async {
    final data = await _get('/courses/$courseId/group-tasks/$taskId');
    return Map<String, dynamic>.from(data);
  }

  static Future<void> deleteGroupTask(String courseId, String taskId) =>
      _delete('/courses/$courseId/group-tasks/$taskId');

  static Future<Map<String, dynamic>> createGroupInTask(
      String courseId, String taskId, Map<String, dynamic> body) async {
    final data = await _post('/courses/$courseId/group-tasks/$taskId/groups', body);
    return Map<String, dynamic>.from(data);
  }

  static Future<void> deleteGroupInTask(String courseId, String taskId, String groupId) =>
      _delete('/courses/$courseId/group-tasks/$taskId/groups/$groupId');

  static Future<void> addGroupTaskMembers(
          String courseId, String taskId, String groupId, List<String> studentIds) =>
      _post('/courses/$courseId/group-tasks/$taskId/groups/$groupId/members',
          {'student_ids': studentIds});

  static Future<void> removeGroupTaskMember(
          String courseId, String taskId, String groupId, String studentId) =>
      _delete('/courses/$courseId/group-tasks/$taskId/groups/$groupId/members/$studentId');

  static Future<List<dynamic>> autoAssignGroupTask(
      String courseId, String taskId, int groupCount) async {
    final data = await _post(
        '/courses/$courseId/group-tasks/$taskId/auto-assign?group_count=$groupCount', {});
    return List.from(data);
  }

  // ───────────────────────────────────────────────────────────────────
  // Notifications
  // ───────────────────────────────────────────────────────────────────
  static Future<List<dynamic>> getNotifications({int limit = 50}) =>
      _get('/notifications/?limit=$limit').then((d) => List.from(d));

  /// Instagram-style grouped feed: collapses same-type same-link
  /// notifications within a rolling window into one digest entry with
  /// `actors` + `count`. Screens render the digest count + actor line.
  static Future<List<dynamic>> getNotificationsGrouped({int limit = 50, int windowHours = 24}) =>
      _get('/notifications/grouped?limit=$limit&window_hours=$windowHours')
          .then((d) => List.from(d));

  static Future<void> markNotificationRead(String notifId) =>
      _patch('/notifications/$notifId/read', {});

  static Future<void> markAllNotificationsRead() =>
      _post('/notifications/read-all', {});

  // ───────────────────────────────────────────────────────────────────
  // Messaging
  // ───────────────────────────────────────────────────────────────────
  static Future<List<dynamic>> getConversations() =>
      _get('/messages/conversations').then((d) => List.from(d));

  static Future<Map<String, dynamic>> startConversation(String otherUserId) async {
    final data = await _post('/messages/conversations/$otherUserId', {});
    return Map<String, dynamic>.from(data);
  }

  static Future<List<dynamic>> getMessages(String convId, {int limit = 50}) =>
      _get('/messages/conversations/$convId/messages?limit=$limit').then((d) => List.from(d));

  static Future<Map<String, dynamic>> sendMessage(String convId, Map<String, dynamic> body) async {
    final data = await _post('/messages/conversations/$convId', body);
    return Map<String, dynamic>.from(data);
  }

  static Future<List<dynamic>> searchUsers(String query) =>
      _get('/messages/search-users?q=${Uri.encodeComponent(query)}').then((d) => List.from(d));

  // ───────────────────────────────────────────────────────────────────
  // Activity Log
  // ───────────────────────────────────────────────────────────────────
  static Future<List<dynamic>> getActivity({int limit = 50}) =>
      _get('/activity/?limit=$limit').then((d) => List.from(d));

  static Future<Map<String, dynamic>> createReflection(Map<String, dynamic> body) async {
    final data = await _post('/activity/reflections', body);
    return Map<String, dynamic>.from(data);
  }

  static Future<List<dynamic>> getReflections({int limit = 20}) =>
      _get('/activity/reflections?limit=$limit').then((d) => List.from(d));

  // ───────────────────────────────────────────────────────────────────
  // Progress & Calendar
  // ───────────────────────────────────────────────────────────────────
  static Future<List<dynamic>> getCourseProgress() =>
      _get('/progress/courses').then((d) => List.from(d));

  static Future<List<dynamic>> getCalendarEvents(String month) =>
      _get('/progress/calendar?month=${Uri.encodeComponent(month)}').then((d) => List.from(d));

  // ───────────────────────────────────────────────────────────────────
  // Certificates
  // ───────────────────────────────────────────────────────────────────
  static Future<List<dynamic>> getMyCertificates() =>
      _get('/certificates/my').then((d) => List.from(d));

  static Future<List<dynamic>> getCourseCertificates(String courseId) =>
      _get('/certificates/course/$courseId').then((d) => List.from(d));

  static Future<Map<String, dynamic>> claimCertificate(String courseId) async {
    final data = await _post('/certificates/claim/$courseId', {});
    return Map<String, dynamic>.from(data);
  }

  // ───────────────────────────────────────────────────────────────────
  // AI Companion
  // ───────────────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> aiChat(String message, {Map<String, dynamic>? context}) async {
    final data = await _post('/ai/companion/chat', {
      'message': message,
      if (context != null) 'context': context,
    });
    return Map<String, dynamic>.from(data);
  }

  static Future<Map<String, dynamic>> aiChatHistory() async {
    final data = await _get('/ai/companion/history');
    return Map<String, dynamic>.from(data);
  }

  static Future<void> aiClearHistory() => _delete('/ai/companion/history');

  static Future<dynamic> aiGetLearningProfile() =>
      _get('/ai/companion/learning-profile');

  static Future<Map<String, dynamic>> aiUpdateLearningProfile(
      String style, List<String> strengths, List<String> weaknesses) async {
    final data = await _post('/ai/companion/learning-profile', {
      'learning_style': style,
      'strengths': strengths,
      'weaknesses': weaknesses,
    });
    return Map<String, dynamic>.from(data);
  }

  static Future<Map<String, dynamic>> aiAssessStyle() async {
    final data = await _post('/ai/companion/assess-style', {});
    return Map<String, dynamic>.from(data);
  }

  // ───────────────────────────────────────────────────────────────────
  // AI Study Materials
  // ───────────────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> aiGenerateStudyMaterial(
      String resourceId, String type, String courseId) async {
    final data = await _post('/ai/study-materials/generate', {
      'resource_id': resourceId,
      'type': type,
      'course_id': courseId,
    });
    return Map<String, dynamic>.from(data);
  }

  static Future<List<dynamic>> aiGetStudyMaterials({String? courseId}) {
    var path = '/ai/study-materials/';
    if (courseId != null) path += '?course_id=${Uri.encodeComponent(courseId)}';
    return _get(path).then((d) => List.from(d ?? []));
  }

  static Future<void> aiDeleteStudyMaterial(String materialId) =>
      _delete('/ai/study-materials/$materialId');

  // ───────────────────────────────────────────────────────────────────
  // AI Study Plan
  // ───────────────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> aiDailyGuide() async {
    final data = await _get('/ai/study-plan/daily-guide');
    return Map<String, dynamic>.from(data);
  }

  static Future<Map<String, dynamic>> aiCreateExamPlan(List<Map<String, dynamic>> exams) async {
    final data = await _post('/ai/study-plan/exam-plan', {'exams': exams});
    return Map<String, dynamic>.from(data);
  }

  static Future<List<dynamic>> aiGetExamPlans() =>
      _get('/ai/study-plan/exam-plans').then((d) => List.from(d ?? []));

  static Future<void> aiDeleteExamPlan(String planId) =>
      _delete('/ai/study-plan/$planId');

  static Future<Map<String, dynamic>> aiAnalyzeTimetable(String timetableText) async {
    final data = await _post('/ai/study-plan/timetable-analyze', {
      'timetable_text': timetableText,
    });
    return Map<String, dynamic>.from(data);
  }

  static Future<Map<String, dynamic>> aiUploadTimetablePdf(String filePath) async {
    final user = FirebaseAuth.instance.currentUser;
    final token = user != null ? await user.getIdToken() : '';
    final uri = Uri.parse('$_base/ai/study-plan/timetable-upload');
    final request = http.MultipartRequest('POST', uri)
      ..headers['Authorization'] = 'Bearer $token'
      ..files.add(await http.MultipartFile.fromPath('file', filePath));
    final streamed = await request.send();
    final body = await streamed.stream.bytesToString();
    if (streamed.statusCode >= 400) throw Exception(body);
    return Map<String, dynamic>.from(jsonDecode(body));
  }

  // ───────────────────────────────────────────────────────────────────
  // AI Study Plan — Timetable Save/List/Delete
  // ───────────────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> aiSaveTimetable(Map<String, dynamic> data) async {
    final result = await _post('/ai/study-plan/timetables', data);
    return Map<String, dynamic>.from(result);
  }

  static Future<List<dynamic>> aiListTimetables() =>
      _get('/ai/study-plan/timetables').then((d) => List.from(d ?? []));

  static Future<void> aiDeleteTimetable(String id) =>
      _delete('/ai/study-plan/timetables/$id');

  // ───────────────────────────────────────────────────────────────────
  // AI Plagiarism (Lecturer)
  // ───────────────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> aiAnalyzePlagiarism(String submissionId) async {
    final data = await _post('/ai/plagiarism/analyze/$submissionId', {});
    return Map<String, dynamic>.from(data);
  }

  static Future<dynamic> aiGetPlagiarismReport(String submissionId) =>
      _get('/ai/plagiarism/report/$submissionId');

  static Future<Map<String, dynamic>> aiAnalyzeAssignmentPlagiarism(String assignmentId) async {
    final data = await _post('/ai/plagiarism/analyze-assignment/$assignmentId', {});
    return Map<String, dynamic>.from(data);
  }

  // ───────────────────────────────────────────────────────────────────
  // AI Grading (Lecturer)
  // ───────────────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> aiRecommendGrade(String submissionId) async {
    final data = await _post('/ai/grading/recommend/$submissionId', {});
    return Map<String, dynamic>.from(data);
  }

  static Future<dynamic> aiGetGradeRecommendation(String submissionId) =>
      _get('/ai/grading/recommendation/$submissionId');

  // ───────────────────────────────────────────────────────────────────
  // Advanced Analytics (Lecturer)
  // ───────────────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> getEngagementHeatmap(String courseId) async {
    final data = await _get('/analytics/heatmap/$courseId');
    return Map<String, dynamic>.from(data);
  }

  static Future<List<dynamic>> getSubmissionTrends(String courseId) async {
    final data = await _get('/analytics/submission-trends/$courseId');
    return data is List ? data : [];
  }

  static Future<Map<String, dynamic>> getStudyActivity() async {
    final data = await _get('/stats/study-activity');
    return Map<String, dynamic>.from(data);
  }

  static Future<List<dynamic>> getMonthlyComparison() async {
    final data = await _get('/stats/monthly-comparison');
    return data is List ? data : [];
  }

  static Future<Map<String, dynamic>> getMapTypeDistribution() async {
    final data = await _get('/stats/map-type-distribution');
    return Map<String, dynamic>.from(data);
  }

  static Future<List<dynamic>> getAtRiskStudents(String courseId) async {
    final data = await _get('/analytics/at-risk/$courseId');
    return data is List ? data : [];
  }

  // ───────────────────────────────────────────────────────────────────
  // Admin
  // ───────────────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> adminGetDashboard() async {
    final data = await _get('/admin/dashboard');
    return Map<String, dynamic>.from(data);
  }

  static Future<List<dynamic>> adminGetUsers({String? role, String? search}) async {
    final params = <String>[];
    if (role != null) params.add('role=$role');
    if (search != null) params.add('search=$search');
    final q = params.isNotEmpty ? '?${params.join('&')}' : '';
    final data = await _get('/admin/users$q');
    return data is List ? data : [];
  }

  static Future<void> adminUpdateUserRole(String userId, String role) =>
      _patch('/admin/users/$userId/role', {'role': role});

  static Future<void> adminDeleteUser(String userId) =>
      _delete('/admin/users/$userId');

  static Future<List<dynamic>> adminGetAuditLogs({int page = 1, int limit = 50}) async {
    final data = await _get('/admin/audit-logs?page=$page&limit=$limit');
    return data is List ? data : [];
  }

  static Future<List<dynamic>> adminGetBadgeDefinitions() async {
    final data = await _get('/admin/badges');
    return data is List ? data : [];
  }

  static Future<Map<String, dynamic>> adminCreateBadge(Map<String, dynamic> body) async {
    final data = await _post('/admin/badges', body);
    return Map<String, dynamic>.from(data);
  }

  static Future<void> adminDeleteBadge(String badgeId) =>
      _delete('/admin/badges/$badgeId');

  static Future<List<dynamic>> adminGetHomepageContent() async {
    final data = await _get('/admin/homepage');
    return data is List ? data : [];
  }

  static Future<Map<String, dynamic>> adminUpdateHomepageContent(Map<String, dynamic> body) async {
    final data = await _post('/admin/homepage', body);
    return Map<String, dynamic>.from(data);
  }

  static Future<Map<String, dynamic>> adminGetAiUsage({int limit = 100}) async {
    final data = await _get('/admin/ai-usage?limit=$limit');
    return Map<String, dynamic>.from(data);
  }

  static Future<void> adminSetUserImageQuota(String userId, int? limit) =>
      _patch('/admin/users/$userId/image-quota', {'limit': limit});

  // ───────────────────────────────────────────────────────────────────
  // Usage Analytics Heartbeat
  // ───────────────────────────────────────────────────────────────────
  static Future<void> activityHeartbeat(String feature, {String platform = 'mobile'}) async {
    try {
      await _post('/activity/heartbeat', {'feature': feature, 'platform': platform});
    } catch (_) {
      // Best-effort — swallow errors so analytics never breaks the app.
    }
  }

  // ───────────────────────────────────────────────────────────────────
  // QR Attendance
  // ───────────────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> attendanceCheckIn(String token) async {
    final data = await _post('/attendance/check-in', {'token': token});
    return Map<String, dynamic>.from(data);
  }

  static Future<Map<String, dynamic>> attendanceRegenerateQr(String sessionId) async {
    final data = await _post('/attendance/session/$sessionId/regenerate-qr', {});
    return Map<String, dynamic>.from(data);
  }

  static Future<Map<String, dynamic>> getAttendanceSession(String sessionId) async {
    final data = await _get('/attendance/session/$sessionId');
    return Map<String, dynamic>.from(data);
  }

  static Future<Map<String, dynamic>> getStudentReport(String studentId, String courseId) async {
    final data = await _get(
        '/gradebook/student/${Uri.encodeComponent(studentId)}/course/${Uri.encodeComponent(courseId)}');
    return Map<String, dynamic>.from(data);
  }

  // ───────────────────────────────────────────────────────────────────
  // Rubrics
  // ───────────────────────────────────────────────────────────────────
  static Future<List<dynamic>> getRubrics(String courseId) async {
    final data = await _get('/rubrics/course/$courseId');
    return data is List ? data : [];
  }

  static Future<Map<String, dynamic>> createRubric(Map<String, dynamic> body) async {
    final data = await _post('/rubrics', body);
    return Map<String, dynamic>.from(data);
  }

  static Future<void> deleteRubric(String rubricId) =>
      _delete('/rubrics/$rubricId');

  static Future<Map<String, dynamic>> gradeWithRubric(String submissionId, Map<String, dynamic> body) async {
    final data = await _post('/rubrics/grade/$submissionId', body);
    return Map<String, dynamic>.from(data);
  }

  // ───────────────────────────────────────────────────────────────────
  // AI Images
  // ───────────────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> aiGenerateImage(String prompt, {String? style}) async {
    final data = await _post('/ai/images/generate', {'prompt': prompt, if (style != null) 'style': style});
    return Map<String, dynamic>.from(data);
  }

  static Future<List<dynamic>> aiGetImageStyles() async {
    final data = await _get('/ai/images/styles');
    return data is List ? data : [];
  }

  static Future<Map<String, dynamic>> aiGetImageQuota() async {
    final data = await _get('/ai/images/quota');
    return Map<String, dynamic>.from(data);
  }

  // ───────────────────────────────────────────────────────────────────
  // AI MindMap Buddy
  // ───────────────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> aiBuddyAnalyze(String mapId) async {
    final data = await _post('/ai/mindmap-buddy/analyze', {'map_id': mapId});
    return Map<String, dynamic>.from(data);
  }

  static Future<List<dynamic>> aiBuddyRecommendNodes(String mapId) async {
    final data = await _post('/ai/mindmap-buddy/recommend-nodes', {'map_id': mapId});
    return data is List ? data : [];
  }

  static Future<Map<String, dynamic>> aiBuddySuggestAll(String mapId) async {
    final data = await _post('/ai/mindmap-buddy/suggest-all', {'map_id': mapId});
    return Map<String, dynamic>.from(data);
  }

  static Future<Map<String, dynamic>> aiBuddyChat(String mapId, String message) async {
    final data = await _post('/ai/mindmap-buddy/chat', {'map_id': mapId, 'message': message});
    return Map<String, dynamic>.from(data);
  }


  // ───────────────────────────────────────────────────────────────────
  // Participation
  // ───────────────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> getParticipation(String courseId) async {
    final data = await _get('/participation/course/$courseId');
    return Map<String, dynamic>.from(data);
  }

  // ───────────────────────────────────────────────────────────────────
  // Certificates verify
  // ───────────────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> verifyCertificate(String certId) async {
    final data = await _get('/certificates/verify/$certId');
    return Map<String, dynamic>.from(data);
  }

  // ───────────────────────────────────────────────────────────────────
  // Homepage Content (public)
  // ───────────────────────────────────────────────────────────────────
  static Future<List<dynamic>> getHomepageContent() async {
    final data = await _get('/homepage/content');
    return data is List ? data : [];
  }

  // ───────────────────────────────────────────────────────────────────
  // CLP (Course Learning Plan) — Lecturer
  // ───────────────────────────────────────────────────────────────────

  /// Upload a syllabus file (.xlsx/.pdf) and extract metadata + weekly topics.
  static Future<Map<String, dynamic>> clpUpload(String filePath, String fileName) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) throw Exception('Not authenticated');
    final token = await user.getIdToken();
    final uri = Uri.parse('$_base/clp/upload');
    final req = http.MultipartRequest('POST', uri)
      ..headers['Authorization'] = 'Bearer $token'
      ..files.add(await http.MultipartFile.fromPath('file', filePath, filename: fileName));
    final streamed = await req.send();
    final res = await http.Response.fromStream(streamed);
    if (!res.isOk) throw Exception('Upload failed: ${res.statusCode} ${res.body}');
    return Map<String, dynamic>.from(jsonDecode(res.body));
  }

  /// Stream AI enrichment progress per-week via SSE.
  /// Returns a Stream of parsed SSE events (Map with 'type' key: progress/done/error).
  static Stream<Map<String, dynamic>> clpGenerate(Map<String, dynamic> body) async* {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) throw Exception('Not authenticated');
    final token = await user.getIdToken();
    final request = http.Request('POST', Uri.parse('$_base/clp/generate'));
    request.headers['Authorization'] = 'Bearer $token';
    request.headers['Content-Type'] = 'application/json';
    request.body = jsonEncode(body);
    final streamed = await http.Client().send(request);
    String buffer = '';
    String currentEvent = '';
    await for (final chunk in streamed.stream.transform(utf8.decoder)) {
      buffer += chunk;
      final lines = buffer.split('\n');
      buffer = lines.removeLast();
      for (final line in lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.substring(7).trim();
        } else if (line.startsWith('data: ')) {
          try {
            final data = jsonDecode(line.substring(6)) as Map<String, dynamic>;
            data['_event'] = currentEvent;
            yield data;
          } catch (_) {}
        }
      }
    }
  }

  /// List all CLP drafts for the current lecturer.
  static Future<List<dynamic>> clpListDrafts() async {
    final data = await _get('/clp/drafts');
    return data is List ? data : [];
  }

  /// Get a specific CLP draft by session ID.
  static Future<Map<String, dynamic>> clpGetDraft(String sessionId) async {
    final data = await _get('/clp/drafts/$sessionId');
    return Map<String, dynamic>.from(data);
  }

  /// Update a CLP draft with user edits.
  static Future<Map<String, dynamic>> clpUpdateDraft(
      String sessionId, Map<String, dynamic> body) async {
    final headers = await _authHeaders();
    final res = await http.put(
      Uri.parse('$_base/clp/drafts/$sessionId'),
      headers: headers,
      body: jsonEncode(body),
    );
    if (!res.isOk) throw Exception('Update draft failed: ${res.statusCode}');
    return Map<String, dynamic>.from(jsonDecode(res.body));
  }

  /// Delete a CLP draft.
  static Future<void> clpDeleteDraft(String sessionId) async {
    await _delete('/clp/drafts/$sessionId');
  }

  /// Download CLP Excel/ZIP as bytes.
  static Future<List<int>> clpDownload(Map<String, dynamic> body) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) throw Exception('Not authenticated');
    final token = await user.getIdToken();
    final res = await http.post(
      Uri.parse('$_base/clp/download'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode(body),
    );
    if (!res.isOk) throw Exception('Download failed: ${res.statusCode}');
    return res.bodyBytes;
  }

  // ───────────────────────────────────────────────────────────────────
  // Social — followers, feed, explore, likes, comments
  // Mirrors frontend-web/src/lib/api.ts::socialApi so the two clients stay
  // shape-for-shape identical. All responses come back as JSON maps/lists
  // already decoded by _get/_post/_delete.
  // ───────────────────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> followUser(String userId) async {
    final data = await _post('/social/follow/$userId', {});
    return Map<String, dynamic>.from(data);
  }

  static Future<Map<String, dynamic>> unfollowUser(String userId) async {
    final headers = await _authHeaders();
    final res = await _safeSend(
      () => http.delete(Uri.parse('$_base/social/follow/$userId'), headers: headers),
      'DELETE',
      '/social/follow/$userId',
    );
    if (!res.isOk) {
      throw Exception('unfollowUser failed: ${res.statusCode} ${res.body}');
    }
    final body = res.body;
    if (body.isEmpty) return {'ok': true};
    return Map<String, dynamic>.from(jsonDecode(body));
  }

  static Future<List<dynamic>> getFollowers(String userId, {int limit = 100}) =>
      _get('/social/followers/$userId?limit=$limit').then((d) => List.from(d));

  static Future<List<dynamic>> getFollowing(String userId, {int limit = 100}) =>
      _get('/social/following/$userId?limit=$limit').then((d) => List.from(d));

  /// Public profile view for any user — returns the PublicProfileOut shape
  /// (same as followers/following list items, plus is_following flag).
  static Future<Map<String, dynamic>> getPublicProfile(String userId) async {
    final data = await _get('/social/profile/$userId');
    return Map<String, dynamic>.from(data);
  }

  static Future<List<dynamic>> getFeed({int limit = 20}) =>
      _get('/social/feed?limit=$limit').then((d) => List.from(d));

  static Future<List<dynamic>> getTrending({int days = 30, int limit = 20}) =>
      _get('/social/explore/trending?days=$days&limit=$limit').then((d) => List.from(d));

  static Future<List<dynamic>> getSuggestedUsers({int limit = 10}) =>
      _get('/social/explore/suggested?limit=$limit').then((d) => List.from(d));

  /// Search users for the social layer (feed/explore discovery). Distinct
  /// from `searchUsers` above which hits `/messages/search-users` for DMs.
  static Future<List<dynamic>> searchSocialUsers(String q, {int limit = 15}) =>
      _get('/social/users/search?q=${Uri.encodeComponent(q)}&limit=$limit')
          .then((d) => List.from(d));

  /// Like a map. Returns `{ok, already_liked, like_count}`.
  static Future<Map<String, dynamic>> likeMap(String mapId) async {
    final data = await _post('/social/maps/$mapId/like', {});
    return Map<String, dynamic>.from(data);
  }

  /// Unlike a map. Returns `{ok, was_liked}`.
  static Future<Map<String, dynamic>> unlikeMap(String mapId) async {
    final headers = await _authHeaders();
    final res = await _safeSend(
      () => http.delete(Uri.parse('$_base/social/maps/$mapId/like'), headers: headers),
      'DELETE',
      '/social/maps/$mapId/like',
    );
    if (!res.isOk) {
      throw Exception('unlikeMap failed: ${res.statusCode} ${res.body}');
    }
    final body = res.body;
    if (body.isEmpty) return {'ok': true};
    return Map<String, dynamic>.from(jsonDecode(body));
  }

  static Future<List<dynamic>> listMapComments(String mapId, {int limit = 100}) =>
      _get('/social/maps/$mapId/comments?limit=$limit').then((d) => List.from(d));

  static Future<Map<String, dynamic>> createMapComment(String mapId, String text) async {
    final data = await _post('/social/maps/$mapId/comments', {'text': text});
    return Map<String, dynamic>.from(data);
  }

  static Future<void> deleteMapComment(String mapId, String commentId) =>
      _delete('/social/maps/$mapId/comments/$commentId');

  /// Public maps authored by a user (for the public-profile grid). Lives
  /// under /maps, not /social, but belongs to this group conceptually.
  static Future<List<dynamic>> getPublicMapsByUser(String userId, {int limit = 30}) =>
      _get('/maps/public/user/$userId?limit=$limit').then((d) => List.from(d));

  /// Upload cover-photo banner. Returns `{cover_photo_url: "..."}`.
  static Future<Map<String, dynamic>> uploadCoverPhoto(String filePath) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) throw Exception('Not authenticated');
    final token = await user.getIdToken();

    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$_base/users/me/cover-photo'),
    );
    request.headers['Authorization'] = 'Bearer $token';
    request.files.add(await http.MultipartFile.fromPath('file', filePath));

    final streamed = await request.send();
    final res = await http.Response.fromStream(streamed);
    if (!res.isOk) {
      throw Exception('Cover photo upload failed: ${res.statusCode} ${res.body}');
    }
    return Map<String, dynamic>.from(jsonDecode(res.body));
  }

  /// Update notification preferences (per-type opt-ins). Takes snake_case
  /// keys matching backend schema: new_follower, map_like, map_comment,
  /// followed_user_posts.
  static Future<Map<String, dynamic>> updateNotificationPrefs(
      Map<String, bool> prefs) async {
    final data = await _patch('/users/me', {'notification_prefs': prefs});
    return Map<String, dynamic>.from(data);
  }
}

extension _StatusExt on http.Response {
  bool get isOk => statusCode >= 200 && statusCode < 300;
}
