# Messaging Flow

## Overview
Private direct messaging between users (student-to-student, student-to-lecturer). Supports user search, conversation creation, real-time-like message display via polling.

## Flowchart

```mermaid
flowchart TD
    subgraph Start Conversation
        START([User opens Messages page]) --> LOAD_CONVOS[GET /api/messages/conversations]
        LOAD_CONVOS --> DISPLAY_LIST[Display conversation list sorted by lastMessageAt]

        DISPLAY_LIST --> NEW_MSG[Click New Message]
        NEW_MSG --> SEARCH_USER[GET /api/messages/search-users?q=query]
        SEARCH_USER --> USER_RESULTS[Display matching users]
        USER_RESULTS --> SELECT_USER[Select recipient]
        SELECT_USER --> CREATE_CONVO[POST /api/messages/conversations/recipientId]

        subgraph Backend - Get or Create Conversation
            CREATE_CONVO --> CHECK_EXISTS{Conversation between these 2 users exists?}
            CHECK_EXISTS -->|Yes| RETURN_EXISTING[Return existing conversation]
            CHECK_EXISTS -->|No| CREATE_NEW[Create new conversation doc]
            CREATE_NEW --> SET_PARTICIPANTS["Set participants: [userId, recipientId]"]
            SET_PARTICIPANTS --> RETURN_EXISTING
        end

        RETURN_EXISTING --> OPEN_CHAT[Open chat view for conversation]
    end

    subgraph Chat View
        OPEN_CHAT --> LOAD_MESSAGES[GET /api/messages/conversations/cid/messages]
        LOAD_MESSAGES --> DISPLAY_MSGS[Display messages in chronological order]

        DISPLAY_MSGS --> MSG_LAYOUT{Message sender?}
        MSG_LAYOUT -->|Current user| BUBBLE_RIGHT[Right-aligned bubble with blue background]
        MSG_LAYOUT -->|Other user| BUBBLE_LEFT[Left-aligned bubble with gray background]

        DISPLAY_MSGS --> MARK_READ[Mark messages as read - update readBy array]
    end

    subgraph Send Message
        OPEN_CHAT --> TYPE_MSG[Type message in input field]
        TYPE_MSG --> SEND_BTN[Click send or press Enter]
        SEND_BTN --> POST_MSG[POST /api/messages/conversations/cid/messages]

        subgraph Backend - Save Message
            POST_MSG --> CREATE_MSG_DOC[Create message doc in messages collection]
            CREATE_MSG_DOC --> MSG_DATA["Store: conversationId, senderId, senderName, text, readBy=[senderId], createdAt"]
            MSG_DATA --> UPDATE_CONVO[Update conversation: lastMessage, lastMessageAt]
            UPDATE_CONVO --> CREATE_NOTIF[Create notification for recipient]
        end

        CREATE_NOTIF --> RETURN_MSG[Return created message]
        RETURN_MSG --> APPEND_UI[Append message to chat view]
    end

    subgraph Polling for New Messages
        OPEN_CHAT --> POLL_TIMER[Poll every 5 seconds]
        POLL_TIMER --> REFETCH[GET /api/messages/conversations/cid/messages]
        REFETCH --> DIFF_CHECK{New messages since last fetch?}
        DIFF_CHECK -->|Yes| APPEND_NEW[Append new messages to view]
        DIFF_CHECK -->|No| WAIT[Wait for next poll]
        APPEND_NEW --> POLL_TIMER
        WAIT --> POLL_TIMER
    end

    subgraph Conversation List
        LOAD_CONVOS --> CONVO_CARD[Each conversation shows:]
        CONVO_CARD --> CARD_AVATAR[Other user avatar + name]
        CARD_AVATAR --> CARD_PREVIEW[Last message preview text]
        CARD_PREVIEW --> CARD_TIME[Last message timestamp]
        CARD_TIME --> CARD_UNREAD{Unread messages?}
        CARD_UNREAD -->|Yes| UNREAD_DOT[Show unread indicator dot]
    end
```

## Key Files
- `frontend-web/src/app/(dashboard)/student/messages/page.tsx` — Student messages page
- `frontend-web/src/app/(dashboard)/lecturer/messages/page.tsx` — Lecturer messages page
- `frontend-web/src/lib/api.ts` — messagingApi namespace
- `frontend-mobile/lib/screens/messaging_screen.dart` — Mobile messaging
- `backend/app/routers/messaging.py` — Conversations, messages, search endpoints
