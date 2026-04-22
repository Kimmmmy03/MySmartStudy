/// Reminder/task model — parses from FastAPI snake_case JSON responses.
class TaskModel {
  final String id;
  final String title;
  final DateTime? dueDate;
  final bool isDone;
  final String priority;
  final String category;

  TaskModel({
    required this.id,
    required this.title,
    required this.dueDate,
    required this.isDone,
    required this.priority,
    required this.category,
  });

  factory TaskModel.fromApi(Map<String, dynamic> data) {
    DateTime? due;
    final ts = data['date'] ?? data['dueDate'];
    if (ts is String && ts.isNotEmpty) due = DateTime.tryParse(ts);

    return TaskModel(
      id: (data['id'] ?? '').toString(),
      title: (data['title'] ?? '').toString(),
      dueDate: due,
      isDone: data['is_completed'] ?? data['isCompleted'] ?? false,
      priority: (data['priority'] ?? 'normal').toString(),
      category: (data['type'] ?? data['category'] ?? 'Study').toString(),
    );
  }
}
