import 'package:flutter/foundation.dart';

/// Global trigger that asks [AuthGate] to re-check the user's backend profile.
/// Increment the value after a successful registration/profile creation so the
/// gate transitions from the googleMode register screen to MainShell.
final ValueNotifier<int> authProfileRefresh = ValueNotifier<int>(0);
