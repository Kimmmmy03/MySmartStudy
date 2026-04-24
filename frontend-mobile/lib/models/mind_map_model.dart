import 'dart:convert';

class ReactFlowNode {
  String id;
  String type;
  double x;
  double y;
  String label;

  // Styling fields (match web editor's CustomNodeData)
  String fillColor;
  String strokeColor;
  double strokeWidth;
  String fontColor;
  double fontSize;
  String shape;
  double width;
  double height;
  String textAlign;
  String fontWeight;
  String fontStyle;
  bool shadow;
  double opacity;

  ReactFlowNode({
    required this.id,
    required this.type,
    required this.x,
    required this.y,
    required this.label,
    this.fillColor = '#ffffff',
    this.strokeColor = '#6366f1',
    this.strokeWidth = 2,
    this.fontColor = '#1e1e2e',
    this.fontSize = 14,
    this.shape = 'roundedRect',
    this.width = 140,
    this.height = 60,
    this.textAlign = 'center',
    this.fontWeight = 'normal',
    this.fontStyle = 'normal',
    this.shadow = false,
    this.opacity = 1.0,
  });

  factory ReactFlowNode.fromMap(Map<String, dynamic> map) {
    final position = map['position'] as Map<String, dynamic>? ?? {};
    final data = map['data'] as Map<String, dynamic>? ?? {};
    final style = map['style'] as Map<String, dynamic>? ?? {};

    return ReactFlowNode(
      id: map['id']?.toString() ?? '',
      type: map['type']?.toString() ?? 'roundedRect',
      x: (position['x'] ?? 0).toDouble(),
      y: (position['y'] ?? 0).toDouble(),
      label: data['label']?.toString() ?? '',
      fillColor: data['fillColor']?.toString() ?? '#ffffff',
      strokeColor: data['strokeColor']?.toString() ?? '#6366f1',
      strokeWidth: (data['strokeWidth'] ?? 2).toDouble(),
      fontColor: data['fontColor']?.toString() ?? '#1e1e2e',
      fontSize: (data['fontSize'] ?? 14).toDouble(),
      shape: data['shape']?.toString() ?? map['type']?.toString() ?? 'roundedRect',
      width: (style['width'] ?? 140).toDouble(),
      height: (style['height'] ?? 60).toDouble(),
      textAlign: data['textAlign']?.toString() ?? 'center',
      fontWeight: data['fontWeight']?.toString() ?? 'normal',
      fontStyle: data['fontStyle']?.toString() ?? 'normal',
      shadow: data['shadow'] == true,
      opacity: (data['opacity'] ?? 1.0).toDouble(),
    );
  }

  Map<String, dynamic> toMap() => {
        'id': id,
        'type': type,
        'position': {'x': x, 'y': y},
        'data': {
          'label': label,
          'fillColor': fillColor,
          'strokeColor': strokeColor,
          'strokeWidth': strokeWidth,
          'fontColor': fontColor,
          'fontSize': fontSize,
          'shape': shape,
          'textAlign': textAlign,
          'fontWeight': fontWeight,
          'fontStyle': fontStyle,
          'shadow': shadow,
          'opacity': opacity,
        },
        'style': {'width': width, 'height': height},
      };

  ReactFlowNode copyWith({
    String? id,
    String? type,
    double? x,
    double? y,
    String? label,
    String? fillColor,
    String? strokeColor,
    double? strokeWidth,
    String? fontColor,
    double? fontSize,
    String? shape,
    double? width,
    double? height,
    String? textAlign,
    String? fontWeight,
    String? fontStyle,
    bool? shadow,
    double? opacity,
  }) =>
      ReactFlowNode(
        id: id ?? this.id,
        type: type ?? this.type,
        x: x ?? this.x,
        y: y ?? this.y,
        label: label ?? this.label,
        fillColor: fillColor ?? this.fillColor,
        strokeColor: strokeColor ?? this.strokeColor,
        strokeWidth: strokeWidth ?? this.strokeWidth,
        fontColor: fontColor ?? this.fontColor,
        fontSize: fontSize ?? this.fontSize,
        shape: shape ?? this.shape,
        width: width ?? this.width,
        height: height ?? this.height,
        textAlign: textAlign ?? this.textAlign,
        fontWeight: fontWeight ?? this.fontWeight,
        fontStyle: fontStyle ?? this.fontStyle,
        shadow: shadow ?? this.shadow,
        opacity: opacity ?? this.opacity,
      );
}

class ReactFlowEdge {
  String id;
  String source;
  String target;
  String type; // bezier, straight, step, elbowed
  String strokeColor;
  double strokeWidth;
  String? label;
  bool animated;
  String targetArrow; // none, arrow, openArrow, diamond, circle, block, thinArrow
  String sourceArrow; // none, arrow, openArrow, diamond, circle, block, thinArrow
  String? strokeDasharray; // null=solid, "dashed", "dotted"
  String? labelBgColor;
  String? labelColor;
  double arrowSize;

  ReactFlowEdge({
    required this.id,
    required this.source,
    required this.target,
    this.type = 'bezier',
    this.strokeColor = '#6366f1',
    this.strokeWidth = 2,
    this.label,
    this.animated = false,
    this.targetArrow = 'block',
    this.sourceArrow = 'none',
    this.strokeDasharray,
    this.labelBgColor,
    this.labelColor,
    this.arrowSize = 8,
  });

  factory ReactFlowEdge.fromMap(Map<String, dynamic> map) {
    final style = map['style'] as Map<String, dynamic>? ?? {};
    final data = map['data'] as Map<String, dynamic>? ?? {};

    // Parse stroke dash pattern
    String? dash;
    final rawDash = style['strokeDasharray'] ?? data['strokeDasharray'];
    if (rawDash != null && rawDash.toString().isNotEmpty && rawDash.toString() != 'null') {
      final s = rawDash.toString();
      if (s.contains('2') || s.contains('1')) {
        dash = 'dotted';
      } else {
        dash = 'dashed';
      }
    }

    return ReactFlowEdge(
      id: map['id']?.toString() ?? '',
      source: map['source']?.toString() ?? '',
      target: map['target']?.toString() ?? '',
      type: map['type']?.toString() ?? 'bezier',
      strokeColor: style['stroke']?.toString() ?? '#6366f1',
      strokeWidth: (style['strokeWidth'] ?? 2).toDouble(),
      label: data['label']?.toString(),
      animated: data['animated'] == true,
      targetArrow: data['targetArrow']?.toString() ?? 'block',
      sourceArrow: data['sourceArrow']?.toString() ?? 'none',
      strokeDasharray: dash,
      labelBgColor: data['labelBgColor']?.toString(),
      labelColor: data['labelColor']?.toString(),
      arrowSize: (data['arrowSize'] ?? 8).toDouble(),
    );
  }

  Map<String, dynamic> toMap() => {
        'id': id,
        'source': source,
        'target': target,
        'type': type,
        'style': {
          'stroke': strokeColor,
          'strokeWidth': strokeWidth,
          if (strokeDasharray != null) 'strokeDasharray': strokeDasharray == 'dotted' ? '2 4' : '8 4',
        },
        'data': {
          if (label != null && label!.isNotEmpty) 'label': label,
          'targetArrow': targetArrow,
          'sourceArrow': sourceArrow,
          'animated': animated,
          'arrowSize': arrowSize,
          if (labelBgColor != null) 'labelBgColor': labelBgColor,
          if (labelColor != null) 'labelColor': labelColor,
        },
      };

  ReactFlowEdge copyWith({
    String? id,
    String? source,
    String? target,
    String? type,
    String? strokeColor,
    double? strokeWidth,
    String? label,
    bool? animated,
    String? targetArrow,
    String? sourceArrow,
    String? strokeDasharray,
    String? labelBgColor,
    String? labelColor,
    double? arrowSize,
  }) =>
      ReactFlowEdge(
        id: id ?? this.id,
        source: source ?? this.source,
        target: target ?? this.target,
        type: type ?? this.type,
        strokeColor: strokeColor ?? this.strokeColor,
        strokeWidth: strokeWidth ?? this.strokeWidth,
        label: label ?? this.label,
        animated: animated ?? this.animated,
        targetArrow: targetArrow ?? this.targetArrow,
        sourceArrow: sourceArrow ?? this.sourceArrow,
        strokeDasharray: strokeDasharray ?? this.strokeDasharray,
        labelBgColor: labelBgColor ?? this.labelBgColor,
        labelColor: labelColor ?? this.labelColor,
        arrowSize: arrowSize ?? this.arrowSize,
      );
}

/// Mind map visibility tier — matches web `MapVisibility` string union.
/// `private` = owner/collaborators only (default).
/// `unlisted` = anyone with share code can open.
/// `public` = discoverable via feed/explore + likeable/commentable.
enum MapVisibility { private, unlisted, public }

extension MapVisibilityX on MapVisibility {
  String get apiValue => name; // private | unlisted | public

  static MapVisibility fromApi(dynamic raw) {
    switch (raw?.toString()) {
      case 'public':
        return MapVisibility.public;
      case 'unlisted':
        return MapVisibility.unlisted;
      case 'private':
      default:
        return MapVisibility.private;
    }
  }
}

/// Mind map model — parses from FastAPI snake_case JSON responses.
class MindMapModel {
  final String id;
  final String ownerId;
  final String ownerEmail;
  final String title;
  final String graphData;
  final String graphFormat;
  final String thumbnail;
  final String shareCode;
  final List<String> collaborators;
  final DateTime? lastModified;
  final MapVisibility visibility;
  final int likeCount;
  final int commentCount;

  final List<ReactFlowNode> nodes;
  final List<ReactFlowEdge> edges;

  MindMapModel({
    required this.id,
    required this.ownerId,
    required this.ownerEmail,
    required this.title,
    required this.graphData,
    required this.graphFormat,
    required this.thumbnail,
    required this.shareCode,
    required this.collaborators,
    required this.lastModified,
    required this.nodes,
    required this.edges,
    this.visibility = MapVisibility.private,
    this.likeCount = 0,
    this.commentCount = 0,
  });

  factory MindMapModel.fromApi(Map<String, dynamic> data) {
    final graphDataStr =
        data['graph_data']?.toString() ?? data['graphData']?.toString() ?? '{}';

    List<ReactFlowNode> parsedNodes = [];
    List<ReactFlowEdge> parsedEdges = [];

    try {
      final decoded = jsonDecode(graphDataStr) as Map<String, dynamic>;
      if (decoded['nodes'] is List) {
        parsedNodes = (decoded['nodes'] as List)
            .map((e) => ReactFlowNode.fromMap(e as Map<String, dynamic>))
            .toList();
      }
      if (decoded['edges'] is List) {
        parsedEdges = (decoded['edges'] as List)
            .map((e) => ReactFlowEdge.fromMap(e as Map<String, dynamic>))
            .toList();
      }
    } catch (_) {}

    DateTime? modified;
    final ts = data['last_modified'] ?? data['lastModified'];
    if (ts is String && ts.isNotEmpty) modified = DateTime.tryParse(ts);

    int toInt(dynamic v) {
      if (v is int) return v;
      if (v is num) return v.toInt();
      return int.tryParse(v?.toString() ?? '') ?? 0;
    }

    return MindMapModel(
      id: (data['id'] ?? '').toString(),
      ownerId: (data['owner_id'] ?? data['ownerId'] ?? '').toString(),
      ownerEmail:
          (data['owner_email'] ?? data['ownerEmail'] ?? '').toString(),
      title: (data['title'] ?? 'Untitled Map').toString(),
      graphData: graphDataStr,
      graphFormat:
          (data['graph_format'] ?? data['graphFormat'] ?? 'reactflow')
              .toString(),
      thumbnail: (data['thumbnail'] ?? '').toString(),
      shareCode:
          (data['share_code'] ?? data['shareCode'] ?? '').toString(),
      collaborators: List<String>.from(data['collaborators'] ?? []),
      lastModified: modified,
      visibility: MapVisibilityX.fromApi(data['visibility']),
      likeCount: toInt(data['like_count'] ?? data['likeCount']),
      commentCount: toInt(data['comment_count'] ?? data['commentCount']),
      nodes: parsedNodes,
      edges: parsedEdges,
    );
  }

  /// Serialize nodes+edges back to graph_data JSON string.
  static String serializeGraph(List<ReactFlowNode> nodes, List<ReactFlowEdge> edges) {
    return jsonEncode({
      'nodes': nodes.map((n) => n.toMap()).toList(),
      'edges': edges.map((e) => e.toMap()).toList(),
    });
  }

  /// Extract searchable text from all node labels.
  static String nodesText(List<ReactFlowNode> nodes) {
    return nodes.map((n) => n.label).where((l) => l.isNotEmpty).join(' ');
  }
}
