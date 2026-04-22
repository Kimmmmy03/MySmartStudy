# Welcome Email Setup Guide

This guide explains how to set up welcome emails for new MySmartStudy users.

## Option 1: Firebase Extension (Recommended for Production)

### Steps

1. **Install the "Trigger Email from Firestore" extension**
   - Go to Firebase Console > Extensions > Browse Extensions
   - Search for "Trigger Email from Firestore" and install it
   - Configure with your SMTP provider (SendGrid, Mailgun, etc.)

2. **Configure SMTP credentials**
   - **SendGrid**: Create an API key at https://app.sendgrid.com/settings/api_keys
   - **Mailgun**: Get SMTP credentials at https://app.mailgun.com/app/sending/domains
   - During extension setup, provide:
     - SMTP host (e.g., `smtp.sendgrid.net`)
     - SMTP port (`587` for TLS)
     - SMTP username (e.g., `apikey` for SendGrid)
     - SMTP password (your API key)
     - Default "from" address (e.g., `noreply@mysmartstudy.com`)

3. **Set the Firestore collection**
   - The extension watches a Firestore collection (default: `mail`) for new documents
   - Each document triggers an email send

4. **Write a welcome email document on registration**
   In your backend `auth.py` sync endpoint, after creating the user document:
   ```python
   db.collection("mail").add({
       "to": [user_email],
       "message": {
           "subject": "Welcome to MySmartStudy!",
           "html": f"""
           <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
               <div style="text-align: center; margin-bottom: 24px;">
                   <h1 style="color: #1B2A80; font-size: 28px;">Welcome to MySmartStudy!</h1>
               </div>
               <p>Hi <strong>{display_name}</strong>,</p>
               <p>Your account has been created successfully. You're now part of the
               MySmartStudy learning community at IPG Kampus Perempuan Melayu Melaka.</p>
               <p>Here's what you can do:</p>
               <ul>
                   <li>Create interactive mind maps</li>
                   <li>Join courses with a class code</li>
                   <li>Collaborate with classmates in real-time</li>
                   <li>Track your achievements and streaks</li>
               </ul>
               <div style="text-align: center; margin: 32px 0;">
                   <a href="https://mysmartstudy.com/login"
                      style="background: linear-gradient(135deg, #1B2A80, #2E4DA7);
                             color: white; padding: 14px 32px; border-radius: 12px;
                             text-decoration: none; font-weight: 600;">
                       Start Learning Now
                   </a>
               </div>
               <p style="color: #666; font-size: 12px; text-align: center;">
                   &copy; MySmartStudy - Institut Pendidikan Guru
               </p>
           </div>
           """
       }
   })
   ```

---

## Option 2: Backend SMTP Endpoint (Simple Setup)

### 1. Environment Variables

Add to your backend `.env` or environment:

```bash
SMTP_HOST=smtp.gmail.com        # or smtp.sendgrid.net, smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=your-email@gmail.com  # or API key username
SMTP_PASSWORD=your-app-password  # Gmail app password or API key
SMTP_FROM=noreply@mysmartstudy.com
```

For Gmail:
- Enable 2FA on your Google account
- Generate an App Password at https://myaccount.google.com/apppasswords
- Use that as `SMTP_PASSWORD`

### 2. Backend Code

The welcome email endpoint is already included in `backend/app/routers/auth.py`.
It uses Python's built-in `smtplib` and `email` modules (no extra dependencies).

The endpoint `POST /api/auth/welcome-email` is called automatically by the frontend
after successful registration.

### 3. Frontend Integration

The frontend calls `authApi.sendWelcomeEmail()` after successful registration.
If the email fails to send, registration still succeeds (email is best-effort).

---

## Testing

1. Set your SMTP environment variables
2. Register a new account
3. Check the registered email inbox for the welcome message
4. If using Gmail, check the Spam folder initially

## Troubleshooting

- **Gmail "Less secure apps" error**: Use App Passwords instead (requires 2FA)
- **SendGrid 403**: Verify your sender identity in SendGrid dashboard
- **Connection timeout**: Check firewall allows outbound port 587
- **No email received**: Check spam folder; verify SMTP credentials are correct
