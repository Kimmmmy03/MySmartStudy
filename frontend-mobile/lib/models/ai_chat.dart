// SmartBuddy chat response models — mirror the web's TypeScript types in
// frontend-web/src/lib/api.ts so the mobile UI can render source chips and
// suggested action buttons without re-deriving the shape from raw JSON.

/// Which evidence layer grounded an answer (or a saved study material).
enum EvidenceTier { course, online, generalKnowledge, mixed }

EvidenceTier? evidenceTierFromString(String? s) {
  switch (s) {
    case 'course':
      return EvidenceTier.course;
    case 'online':
      return EvidenceTier.online;
    case 'general_knowledge':
      return EvidenceTier.generalKnowledge;
    case 'mixed':
      return EvidenceTier.mixed;
    default:
      return null;
  }
}

String evidenceTierToString(EvidenceTier t) {
  switch (t) {
    case EvidenceTier.course:
      return 'course';
    case EvidenceTier.online:
      return 'online';
    case EvidenceTier.generalKnowledge:
      return 'general_knowledge';
    case EvidenceTier.mixed:
      return 'mixed';
  }
}

/// One citation behind a chat answer or a saved material.
class ChatSource {
  final EvidenceTier tier;
  final String title;
  // course-tier fields
  final String? docType;
  final String? courseId;
  final String? docId;
  final double? score;
  // online / general_knowledge fields
  final String? kind;
  final String? authors;
  final int? year;
  final String? venue;
  final String? doi;
  final String? url;
  final bool? verified; // general_knowledge only

  const ChatSource({
    required this.tier,
    required this.title,
    this.docType,
    this.courseId,
    this.docId,
    this.score,
    this.kind,
    this.authors,
    this.year,
    this.venue,
    this.doi,
    this.url,
    this.verified,
  });

  factory ChatSource.fromJson(Map<String, dynamic> j) => ChatSource(
        tier: evidenceTierFromString(j['tier'] as String?) ?? EvidenceTier.generalKnowledge,
        title: (j['title'] as String?) ?? '',
        docType: j['doc_type'] as String?,
        courseId: j['course_id'] as String?,
        docId: j['doc_id'] as String?,
        score: (j['score'] as num?)?.toDouble(),
        kind: j['kind'] as String?,
        authors: j['authors'] as String?,
        year: (j['year'] as num?)?.toInt(),
        venue: j['venue'] as String?,
        doi: j['doi'] as String?,
        url: j['url'] as String?,
        verified: j['verified'] as bool?,
      );
}

/// A "Generate flashcards / summary / quiz" CTA proposed by the chat for a
/// substantive study question.
class ChatSuggestedAction {
  final String type; // "flashcards" | "summary" | "quiz"
  final String topic;
  final EvidenceTier evidenceTier;
  final String? courseId;

  const ChatSuggestedAction({
    required this.type,
    required this.topic,
    required this.evidenceTier,
    this.courseId,
  });

  factory ChatSuggestedAction.fromJson(Map<String, dynamic> j) =>
      ChatSuggestedAction(
        type: (j['type'] as String?) ?? 'flashcards',
        topic: (j['topic'] as String?) ?? '',
        evidenceTier:
            evidenceTierFromString(j['evidence_tier'] as String?) ?? EvidenceTier.course,
        courseId: j['course_id'] as String?,
      );
}

/// Full tier-aware response from POST /ai/mindmap-buddy/chat.
class ChatResponse {
  final String response;
  final EvidenceTier? evidenceLevel;
  final List<ChatSource> sources;
  final List<ChatSuggestedAction> suggestedActions;

  const ChatResponse({
    required this.response,
    this.evidenceLevel,
    this.sources = const [],
    this.suggestedActions = const [],
  });

  factory ChatResponse.fromJson(Map<String, dynamic> j) => ChatResponse(
        response: (j['response'] as String?) ?? '',
        evidenceLevel: evidenceTierFromString(j['evidence_level'] as String?),
        sources: ((j['sources'] as List?) ?? const [])
            .map((e) => ChatSource.fromJson(Map<String, dynamic>.from(e as Map)))
            .toList(),
        suggestedActions: ((j['suggested_actions'] as List?) ?? const [])
            .map((e) => ChatSuggestedAction.fromJson(Map<String, dynamic>.from(e as Map)))
            .toList(),
      );
}
