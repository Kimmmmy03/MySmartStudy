import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';

import 'api_service.dart';

class AuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final GoogleSignIn _googleSignIn = GoogleSignIn();

  Future<UserCredential> signIn({
    required String email,
    required String password,
  }) async {
    return _auth.signInWithEmailAndPassword(
      email: email.trim(),
      password: password,
    );
  }

  Future<UserCredential> register({
    required String email,
    required String password,
  }) async {
    return _auth.createUserWithEmailAndPassword(
      email: email.trim(),
      password: password,
    );
  }

  /// Sign in with Google. Returns the Firebase [UserCredential].
  /// Throws if user cancels the Google sign-in flow.
  ///
  /// Always shows the account chooser (even if a Google account was used
  /// previously) by clearing the local Google session first.
  Future<UserCredential> signInWithGoogle() async {
    // Clear any cached Google session so the account picker appears every time.
    try {
      await _googleSignIn.signOut();
    } catch (_) {/* no cached session — ignore */}

    final googleUser = await _googleSignIn.signIn();
    if (googleUser == null) {
      throw FirebaseAuthException(
        code: 'sign-in-cancelled',
        message: 'Google sign-in was cancelled.',
      );
    }

    final googleAuth = await googleUser.authentication;
    final credential = GoogleAuthProvider.credential(
      accessToken: googleAuth.accessToken,
      idToken: googleAuth.idToken,
    );

    return _auth.signInWithCredential(credential);
  }

  Future<void> signOut() async {
    await _googleSignIn.signOut();
    await _auth.signOut();
  }

  /// Send a password-reset email. Routed through our own FastAPI + SMTP so
  /// delivery doesn't depend on Firebase's default mailer (which is
  /// unreliable on the free tier and often dropped by spam filters).
  Future<void> sendPasswordResetEmail(String email) async {
    await ApiService.requestPasswordReset(email.trim());
  }
}
