import 'package:shared_preferences/shared_preferences.dart';

const _kTutorialDone = 'tutorial_completed';

class TutorialPrefs {
  static Future<bool> shouldShow() async {
    final prefs = await SharedPreferences.getInstance();
    return !(prefs.getBool(_kTutorialDone) ?? false);
  }

  static Future<void> markComplete() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kTutorialDone, true);
  }

  static Future<void> reset() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kTutorialDone);
  }
}
