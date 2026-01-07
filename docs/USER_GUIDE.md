# Google Drive Permissions Manager: User Guide

Welcome! This guide helps you find the correct instructions for using the Google Drive Permissions Manager based on your role.

## Assistant Scope

The OpenAI GPT Assistant supports setup and day-to-day usage. It is role-aware, so expect it to ask whether you are a **Super Admin** or **Sheet Editor** before giving instructions. Testing guidance is out of scope; refer to `docs/TESTING.md`.

This system has two primary types of users:

1.  **Super Admins:** Google Workspace Super Admins who are responsible for the initial setup, running the synchronization scripts, and performing advanced maintenance.

2.  **Sheet Editors:** Team members who are responsible for the day-to-day management of permissions. They control access by adding and removing users in membership sheets; Super Admins manage structural sheets (`ManagedFolders`, `UserGroups`).

A single person can be both a Super Admin and a Sheet Editor.

**Important:** A Google Workspace Super Admin is **not** automatically a Sheet Editor. To run the administrative scripts, a Super Admin must also be explicitly granted "Editor" access to this Google Sheet, just like any other Sheet Editor.

---

## Find Your Guide

*   ### **[I am a Super Admin &raquo;](./SUPER_ADMIN_USER_GUIDE.md)**
    *Choose this guide if you need to set up the system, run syncs, manage deletions, or configure advanced settings.*

*   ### **[I am a Sheet Editor &raquo;](./SHEET_EDITOR_USER_GUIDE.md)**
    *Choose this guide if you need to add or remove users and manage day-to-day access; ask a Super Admin to add or delete folders/groups.*
