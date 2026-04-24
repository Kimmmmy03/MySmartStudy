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

  // Phase 1+ social fields. These come back empty/zero for users who haven't
  // opted into the social layer yet, so defaulting keeps /me calls safe on
  // older accounts without requiring a migration.
  final String bio;
  final String coverPhotoURL;
  final int followerCount;
  final int followingCount;
  final NotificationPrefs notificationPrefs;

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
    this.bio = '',
    this.coverPhotoURL = '',
    this.followerCount = 0,
    this.followingCount = 0,
    this.notificationPrefs = const NotificationPrefs(),
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
      bio: (data['bio'] ?? '').toString(),
      coverPhotoURL:
          (data['cover_photo_url'] ?? data['coverPhotoURL'] ?? '').toString(),
      followerCount:
          toInt(data['follower_count'] ?? data['followerCount']) ?? 0,
      followingCount:
          toInt(data['following_count'] ?? data['followingCount']) ?? 0,
      notificationPrefs: NotificationPrefs.fromApi(
          data['notification_prefs'] ?? data['notificationPrefs']),
    );
  }

  /// Full avatar URL for display, or null if no photo set.
  String? get avatarUrl {
    if (photoURL.isEmpty) return null;
    if (photoURL.startsWith('http')) return photoURL;
    return 'http://10.0.2.2:8000$photoURL';
  }

  /// Full cover-photo URL for display, or null if none set.
  String? get coverUrl {
    if (coverPhotoURL.isEmpty) return null;
    if (coverPhotoURL.startsWith('http')) return coverPhotoURL;
    return 'http://10.0.2.2:8000$coverPhotoURL';
  }

  /// Whether this user has a profile photo.
  bool get hasAvatar => photoURL.isNotEmpty;
  bool get hasCover => coverPhotoURL.isNotEmpty;
}

/// Per-type notification opt-ins. Matches backend `NotificationPrefs` schema
/// (snake_case keys, all default-on except `followed_user_posts`).
class NotificationPrefs {
  final bool newFollower;
  final bool mapLike;
  final bool mapComment;
  final bool followedUserPosts;

  const NotificationPrefs({
    this.newFollower = true,
    this.mapLike = true,
    this.mapComment = true,
    this.followedUserPosts = false,
  });

  factory NotificationPrefs.fromApi(dynamic raw) {
    if (raw is! Map) return const NotificationPrefs();
    return NotificationPrefs(
      newFollower: raw['new_follower'] ?? raw['newFollower'] ?? true,
      mapLike: raw['map_like'] ?? raw['mapLike'] ?? true,
      mapComment: raw['map_comment'] ?? raw['mapComment'] ?? true,
      followedUserPosts:
          raw['followed_user_posts'] ?? raw['followedUserPosts'] ?? false,
    );
  }

  Map<String, dynamic> toApi() => {
        'new_follower': newFollower,
        'map_like': mapLike,
        'map_comment': mapComment,
        'followed_user_posts': followedUserPosts,
      };

  NotificationPrefs copyWith({
    bool? newFollower,
    bool? mapLike,
    bool? mapComment,
    bool? followedUserPosts,
  }) =>
      NotificationPrefs(
        newFollower: newFollower ?? this.newFollower,
        mapLike: mapLike ?? this.mapLike,
        mapComment: mapComment ?? this.mapComment,
        followedUserPosts: followedUserPosts ?? this.followedUserPosts,
      );
}
