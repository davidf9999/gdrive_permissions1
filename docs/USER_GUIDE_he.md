# מדריך למשתמש: מנהל הרשאות Google Drive

ברוכים הבאים! מדריך זה מסביר כיצד להשתמש בגליון Google לניהול הרשאות תיקיות לאחר שההתקנה הראשונית הושלמה.

---

## הרעיון המרכזי

המערכת פועלת על־ידי קישור תיקיות Google Drive לקבוצות Google. במקום לשתף תיקיה עם מאות כתובות אימייל בודדות, משתפים אותה עם קבוצה אחת (לדוגמה: `my-project-editors@your-domain.com`). לאחר מכן ניתן לשלוט בגישה על־ידי הוספה או הסרה של אנשים מהקבוצה.

הגליון הזה הוא לוח הבקרה המרכזי של כל התהליך. הסקריפט קורא את ההגדרות מהגליונות הללו, ויוצר אוטומטית את הקבוצות, מנהל את החברים בהן, ומגדיר את ההרשאות הנכונות על התיקיות.

---

## גליונות הבקרה

לאחר שמפעילים את הסקריפט בפעם הראשונה, נוצרים מספר גליונות באופן אוטומטי. להלן פירוט של תפקידיהם.

### 1. `ManagedFolders` (גליון הבקרה הראשי)

זהו הגליון החשוב ביותר. כל שורה מייצגת תיקיה שהסקריפט ינהל.

* **`FolderName` (עמודה A):** שם תיקיית Google Drive. 
  * אם לא קיימת תיקיה בשם הזה, הסקריפט ייצור אותה עבורך.
  * אם קיימת תיקיה בשם הזה, הסקריפט יאתר אותה וישתמש בה.
* **`FolderID` (עמודה B):** המזהה הייחודי של התיקיה. 
  * אפשר להשאיר ריק. הסקריפט ימצא או ייצור את התיקיה לפי ה־`FolderName` וימלא את ה־ID עבורך.
  * אם יש כמה תיקיות עם אותו שם, ניתן להדביק כאן את ה־ID הספציפי כדי למנוע בלבול.
* **`Role` (עמודה C):** רמת ההרשאה שברצונך להעניק. ניתן לבחור מתוך התפריט:
  * `Editor`: יכול לארגן, להוסיף ולערוך קבצים.
  * `Viewer`: יכול לצפות בקבצים.
  * `Commenter`: יכול להוסיף הערות.
* **`UserSheetName` (עמודה D):** *מנוהל על־ידי הסקריפט.* שם הגליון שיכיל את רשימת המשתמשים עבור השילוב תיקיה/הרשאה (למשל: `MyProject_Editor`).
* **`GroupEmail` (עמודה E):** *מנוהל על־ידי הסקריפט או ידנית.* הסקריפט יפיק אוטומטית את כתובת האימייל של קבוצת Google שהוא יוצר עבור התיקיה/תפקיד הזה.
    *   **עבור שמות תיקיות באותיות ASCII** (אנגלית, מספרים): יש להשאיר ריק - הסקריפט יפיק אוטומטית (למשל `my-project-editor@yourdomain.com`)
    *   **עבור שמות תיקיות שאינם באותיות ASCII** (עברית, ערבית, סינית וכו'): חובה לציין ידנית כתובת אימייל באותיות ASCII (למשל `coordinators-editor@jvact.org`). ראה [עבודה עם תווים שאינם ASCII](#working-with-non-ascii-characters) להלן.
* **`Last Synced` (עמודה F):** *מנוהל על־ידי הסקריפט.* חותמת זמן של הסנכרון האחרון.
* **`Status` (עמודה G):** *מנוהל על־ידי הסקריפט.* מציג את סטטוס הסנכרון האחרון (`OK`, `Processing...` או הודעת שגיאה).

### 2. גליונות משתמשים (לדוגמה: `MyProject_Editor`)

עבור כל שורה ב־`ManagedFolders`, הסקריפט יוצר גליון משתמש מתאים. שמו מופיע בעמודת `UserSheetName`.

* **מטרה:** כאן מוסיפים את כתובות האימייל של האנשים שצריכים לקבל את ההרשאה לתיקיה.
* **שימוש:** יש להזין **כתובת אימייל חוקית אחת בדיוק בכל שורה** בעמודה A (`User Email Address`). אם תא מכיל מספר כתובות או כל דבר אחר שאינו כתובת אימייל בודדת וחוקית, הסקריפט יתעד שגיאה ויתעלם מהרשומה. עמודה B האופציונלית (`Disabled`) מאפשרת לך להחריג משתמש באופן זמני מקבלת הרשאות — הגדר אותה ל-`TRUE`, `YES`, או סמן את התיבה כדי להשבית את המשתמש מבלי למחוק את השורה שלו.

**חשוב: בדיקת כפילויות בכתובות אימייל**
- כל כתובת אימייל חייבת להופיע **פעם אחת בלבד** בכל גיליון (לא תלוי רישיות)
- המערכת תזהה אוטומטית כפילויות ותעצור את העיבוד של אותה תיקיה עם הודעת שגיאה ברורה
- דוגמה לשגיאה: `"user@domain.com" מופיע בשורות 2, 5, 8`
- השתמש באפשרות **"Validate All User Sheets"** בתפריט כדי לבדוק את כל הגליונות בבת אחת
- כפילויות מונעות פעולות סנכרון כדי לשמור על תקינות הנתונים

### 3. `UserGroups`

גליון זה מאפשר ליצור קבוצות משתמשים לשימוש חוזר.

* **`GroupName` (עמודה A):** שם ידידותי לקבוצה (למשל: "צוות שיווק", "מפתחי פרויקט X", "מתאמים").
* **`GroupEmail` (עמודה B):** *מנוהל על־ידי הסקריפט או ידנית.* הסקריפט יפיק את כתובת האימייל של הקבוצה.
    *   **עבור שמות קבוצות באותיות ASCII** (אנגלית, מספרים): יש להשאיר ריק - הסקריפט יפיק אוטומטית (למשל `marketing-team@yourdomain.com`)
    *   **עבור שמות קבוצות שאינם באותיות ASCII** (עברית, ערבית, סינית וכו'): חובה לציין ידנית כתובת אימייל באותיות ASCII (למשל `coordinators@jvact.org`). ראה [עבודה עם תווים שאינם ASCII](#working-with-non-ascii-characters) להלן.
* **איך זה עובד:** עבור כל `GroupName` שתגדיר כאן, הסקריפט יוצר גיליון מתאים עם השם `GroupName_G` (הסיומת "_G" מבדילה בין גליונות קבוצה לגליונות תיקיה). לאחר מכן, אתה מפרט את חברי הקבוצה באותו גיליון. תוכל להשתמש ב-`GroupEmail` בכל אחד מגליונות המשתמשים האחרים שלך כדי להעניק גישה לכל חברי הקבוצה בבת אחת.
    *   **דוגמה:** שם קבוצה "צוות שיווק" יוצר גיליון "צוות שיווק_G"
    *   **הערה:** הסקריפט מעביר אוטומטית גליונות ישנים ללא הסיומת "_G" בעת הפעלת סנכרון.

### 4. `Admins`

גליון זה שולט במי יכול לערוך את הגליון הראשי. יש להוסיף את כתובות האימייל של המנהלים.

**מבנה הגיליון:**
- **עמודה A**: אימיילים של מנהלים - רשום את כתובות האימייל של כל המנהלים (אחד בכל שורה)
- **עמודה B**: סונכרן לאחרונה - חותמת זמן של הסנכרון המוצלח האחרון
- **עמודה C**: סטטוס - סטטוס סנכרון נוכחי (OK, Processing..., ERROR, וכו')

כל סנכרון גם שומר על קבוצת Google ייעודית מסונכרנת עם רשימה זו. כתובת האימייל של קבוצת המנהלים (למשל, `admins-control-panel@yourdomain.com`) מאוחסנת בגיליון **Config** תחת `AdminGroupEmail`. ניתן להשתמש בכתובת אימייל זו של הקבוצה כדי להעניק גישת מנהל לכל תיקיה מנוהלת על ידי הוספתה לגיליון המשתמשים של אותה תיקיה.

**הוספת צופים לגיליון הבקרה:** אם ברצונך להעניק למשתמשים מסוימים גישת **צפייה בלבד** לגליונות הבקרה (ללא הרשאות עריכה), פשוט השתמש בפונקציונליות השיתוף הרגילה של Google Sheets. לחץ על כפתור "שיתוף" בפינה הימנית העליונה של הגיליון והוסף משתמשים עם הרשאות "צופה". אין צורך לנהל זאת דרך הסקריפט.

### 5. `Config`

כאן ניתן להגדיר אפשרויות מתקדמות, כמו קבלת התראות במקרה של שגיאות בסקריפט. הגיליון גם מציג מידע חשוב של המערכת:

- **AdminGroupEmail**: מציג את כתובת האימייל של קבוצת המנהלים (לדוגמה: `admins-control-panel@yourdomain.com`). מתעדכן אוטומטית כשמריצים "Sync Admins" וניתן להשתמש בכתובת זו כדי להעניק למנהלים גישה לכל תיקיה מנוהלת על־ידי הוספת כתובת הקבוצה לגיליון המשתמשים של התיקיה.

### 6. `Log` ו־`TestLog`

גליונות אלה מכילים לוגים מפורטים עם חותמות זמן של כל הפעולות שהסקריפט מבצע. שימושיים לאיתור בעיות.

### 7. Advanced Logging with Google Cloud

For more robust logging, especially in production environments, you can enable integration with Google Cloud Logging. When enabled, the script sends detailed, structured logs to your own Google Cloud project.

**To enable this:**

1.  First, you must have linked the script to a Google Cloud project. See the instructions in the main [README.md file](../../README.md#upgrading-to-a-production-environment).
2.  In the `Config` sheet, set the value of `EnableGCPLogging` to `TRUE`.

Once enabled, you can view the logs in the [Google Cloud Logs Explorer](https://console.cloud.google.com/logs/viewer), which provides powerful searching and filtering capabilities.

---

## **<font color="red">NEEDS TRANSLATION</font>**

## Verifying Permissions with the Dry Run Audit

The script includes a powerful, read-only **Dry Run Audit** feature that lets you check for any issues or discrepancies without making any changes. It's highly recommended to run this periodically to ensure the integrity of your permissions setup.

### How to Run the Audit

From the spreadsheet menu, select **Permissions Manager > Dry Run Audit**.

The script will run in the background and post its findings to a dedicated log sheet.

### Understanding the `DryRunAuditLog` Sheet

After the audit runs, check the **`DryRunAuditLog`** sheet.

*   **If the sheet is empty:** Congratulations! The audit found no problems. Your configured permissions match the actual state in Google Drive and Google Groups.
*   **If the sheet has entries:** Each row represents a discrepancy that the audit found. Here are the common issues it can detect:

| Issue Type          | Identifier    | Issue                 | Details                                                                              |
| :------------------ | :------------ | :-------------------- | :----------------------------------------------------------------------------------- |
| **Folder Permission** | Folder Name   | `Permission Mismatch` | The group has a different role on the folder than what is configured. (e.g., Expected: Viewer, Actual: NONE). |
| **Folder**          | Folder Name   | `Folder Not Found`    | The Folder ID in the `ManagedFolders` sheet is invalid or points to a deleted folder. |
| **Group Membership**  | Group Name    | `VALIDATION ERROR`    | Duplicate emails found in the user sheet (e.g., "user@domain.com" appears in rows 2, 5). |
| **Group Membership**  | Group Name    | `Missing Members`     | Users are listed in the user sheet but are not in the actual Google Group.         |
| **Group Membership**  | Group Name    | `Extra Members`       | Users are in the Google Group but are not listed in the corresponding user sheet.    |
| **Group Membership**  | Group Name    | `Error`               | The audit could not check the group, often because the group itself does not exist.  |

Running the audit is a safe and effective way to confirm that your permissions are exactly as you've defined them in the sheets.

---

## בדיקת גליונות משתמשים לכפילויות בכתובות אימייל

כדי לשמור על תקינות הנתונים ולמנוע שגיאות סנכרון, המערכת בודקת אוטומטית שכל כתובת אימייל מופיעה רק פעם אחת בכל גיליון משתמשים (לא תלוי רישיות). הבדיקה מתבצעת אוטומטית במהלך פעולות סנכרון ואודיט.

### בדיקה אוטומטית

בדיקת כפילויות מתבצעת אוטומטית במצבים הבאים:
- **במהלך פעולות סנכרון**: לפני עיבוד כל תיקיה, הסקריפט בודק את גיליון המשתמשים שלה
- **במהלך אודיט**: כל גיליון משתמשים נבדק לפני בדיקת חברות בקבוצה
- **בגישה לגליונות קיימים**: אם גיליון משתמשים כבר קיים עם נתונים, הוא נבדק לפני שימוש

אם נמצאו כפילויות, הסקריפט:
- יעצור את העיבוד של אותה תיקיה/קבוצה ספציפית
- ירשום הודעת שגיאה ברורה עם כתובות האימייל הכפולות ומספרי השורות המדויקים
- יעדכן את הסטטוס של התיקיה להציג את שגיאת הבדיקה
- ימשיך לעבד תיקיות אחרות כרגיל (לא חוסם)

### בדיקה ידנית: "Validate All User Sheets"

ניתן לבדוק ידנית את כל גליונות המשתמשים בבת אחת באמצעות אפשרות התפריט: **Permissions Manager > Validate All User Sheets**

הבדיקה תבצע:
1. בדיקה של כל גליונות המשתמשים מ־`ManagedFolders`, `UserGroups` ו־`Admins`
2. תציג סיכום המראה אילו גליונות יש בהם שגיאות
3. תספק מידע מפורט על כל כפילות שנמצאה

**דוגמה לפלט:**
```
Validated 10 user sheets.

Sheets with errors: 2
Sheets without errors: 8

Details:
✓ Project_A_Editors: OK
✓ Project_A_Viewers: OK
❌ Project_B_Editors: Duplicate emails found: "user@domain.com" appears in rows 3, 7
✓ Project_C_Editors: OK
❌ Marketing_Team: Duplicate emails found: "admin@company.com" appears in rows 2, 5, 9
✓ Admins: OK
...
```

### תיקון שגיאות כפילויות

כאשר רואים שגיאת בדיקה:
1. שימו לב באיזה גיליון יש בעיה
2. פתחו את הגיליון והסתכלו על מספרי השורות שהוזכרו
3. הסירו את הערכים הכפולים (השאירו רק מופע אחד של כל אימייל)
4. הריצו מחדש את הסנכרון או הבדיקה כדי לאשר שהבעיה נפתרה

**זכרו:** השוואת אימיילים אינה תלויה רישיות, כך ש־`user@domain.com`, `USER@domain.com` ו־`UsEr@DoMaIn.CoM` כולם נחשבים ככפילויות.

---

## **<font color="red">NEEDS TRANSLATION</font>**

## Working with Non-ASCII Characters

The system fully supports using non-ASCII characters (Hebrew, Arabic, Chinese, emoji, etc.) in most places, with one important limitation: **Google Group email addresses must use only ASCII characters** (a-z, 0-9, hyphens).

### What Works Everywhere

✅ **Folder names**: Hebrew, Arabic, Chinese, etc. are fully supported
✅ **Group names**: Hebrew, Arabic, Chinese, etc. are fully supported
✅ **Sheet names**: Any Unicode characters work
✅ **User email addresses**: Any valid email format (including international domains)

### The Email Address Limitation

❌ **Group email addresses**: Must be ASCII only (Google's requirement, not ours)

### How to Handle Non-ASCII Names

When you create groups or folders with non-ASCII names, you must **manually specify the group email** using ASCII characters:

#### Example 1: UserGroups Sheet

| Column A (GroupName) | Column B (GroupEmail) ← **Manual for Hebrew** | Column C | Column D |
|---------------------|-----------------------------------------------|----------|----------|
| Marketing Team      | (leave empty - auto-generates)                |          |          |
| מתאמים              | `coordinators@jvact.org`                      |          |          |
| פעילים              | `activists@jvact.org`                         |          |          |

#### Example 2: ManagedFolders Sheet

| FolderName | FolderID | Role | UserSheetName | **Column E (GroupEmail)** ← **Manual for Hebrew** |
|------------|----------|------|---------------|---------------------------------------------------|
| Reports    | ...      | Editor | (auto)      | (leave empty - auto-generates)                    |
| מתאמים     | ...      | Editor | (auto)      | `coordinators-editor@jvact.org`                   |
| admin      | ...      | Viewer | (auto)      | (leave empty - auto-generates)                    |

### Important Notes

**💡 Google Groups are FREE!** You are not paying per group email - Google Groups are included with Google Workspace at no extra cost. When you specify a group email manually, the script still creates and manages the group for you automatically.

**🎯 The script auto-creates everything:** Whether you let the script auto-generate the email or you specify it manually, the script handles creating the Google Group, adding members, and managing permissions. You're just choosing the email address format.

**⚠️ Collision risk with auto-generation:** If you don't manually specify emails for non-ASCII names, multiple groups may generate the same email address (e.g., both "מתאמים" and "פעילים" would try to use similar ASCII-stripped emails), causing permission conflicts.

### What Happens if You Forget

If you forget to manually specify a group email for a non-ASCII name, the script will give you a clear, helpful error message:

**For UserGroups:**
'''
Group name "מתאמים" contains only non-ASCII characters (e.g., Hebrew, Arabic,
Chinese) which cannot be used in email addresses. Please manually specify a
group email in the "GroupEmail" column (Column B) using only ASCII characters
(a-z, 0-9, hyphens). Example: for "מתאמים", you could use "coordinators@jvact.org"
or "team-a@jvact.org".
'''

**For ManagedFolders:**
'''
Cannot auto-generate group email for folder "מתאמים" with role "Editor".
The folder name contains non-ASCII characters (e.g., Hebrew, Arabic, Chinese).
Please manually specify a group email in the "GroupEmail" column (Column E)
of the ManagedFolders sheet. Example: "coordinators-editor@jvact.org"
'''

Simply fill in the appropriate column with an ASCII email address and run the sync again!

### Duplicate Group Email Validation

**Important:** Each group email must be unique across your entire configuration. The system validates that no two groups share the same email address, as this would cause them to have the same members and create permission conflicts.

**The validation checks:**
- ✅ Within UserGroups sheet (Column B)
- ✅ Within ManagedFolders sheet (Column E)
- ✅ Between UserGroups and ManagedFolders

**When duplicates are found:**
- Sync is blocked before any changes are made
- Clear error message shows all duplicate locations
- Dry Run Audit reports duplicates in the audit log

**Example error:**
'''
VALIDATION ERROR: Duplicate group emails detected!

Duplicate group email "team@jvact.org" found in:
UserGroups row 2 (Group: Marketing);
ManagedFolders row 5 (Folder: Project A, Role: Editor)

Each group must have a unique email address. Please fix these duplicates and try again.
'''

**How to fix:**
1. Review the error message to see which groups/folders share the same email
2. Update one or more of the duplicate emails to be unique
3. Run the sync again

**Note:** This validation prevents a common mistake where manually specifying the same email for multiple groups would silently cause them to share members.

---

## **<font color="red">NEEDS TRANSLATION</font>**

## Common Workflows

### How to Grant a Team Access to a New Folder

Let's say you want to give the "Sales Team" editor access to a new folder called "Q4 Sales Reports".

1.  **Go to the `ManagedFolders` sheet.**
2.  In a new row, enter:
    *   `FolderName`: `Q4 Sales Reports`
    *   `Role`: `Editor`
3.  **Go to the `UserGroups` sheet.**
4.  In a new row, enter:
    *   `GroupName`: `Sales Team`
5.  **Run the creation sync.** From the spreadsheet menu, click **Permissions Manager > Sync Adds**.
6.  The script will now run. It will:
    *   Create the "Q4 Sales Reports" folder in Google Drive.
    *   Create a user sheet named `Q4 Sales Reports_Editor`.
    *   Create a Google Group for the Sales Team and a sheet named `Sales Team`.
7.  **Go to the `Sales Team` sheet.** Add the email addresses of your sales team members to Column A. Mark Column B if you want any member to stay listed but not yet receive access.
8.  **Go to the `Q4 Sales Reports_Editor` sheet.** In Column A, add the group email address for the sales team (you can copy this from the `GroupEmail` column in the `UserGroups` sheet).
9. **Run the final sync.** Click **Permissions Manager > Sync Adds** again.

The script will now add all the members from the `Sales Team` group to the `Q4 Sales Reports_Editor` group, granting them all editor access to the folder.

### How to Add a User

1.  Find the correct user sheet for the folder and role you want to change (e.g., `Q4 Sales Reports_Editor`).
2.  To add a user, add their email address to a new row in Column A. You can temporarily disable access later by marking Column B.
3.  Run **Permissions Manager > Sync Adds**.

### How to Remove a User

1.  Find the correct user sheet for the folder and role you want to change.
2.  To remove a user, delete the row containing their email address.
3.  Run **Permissions Manager > Sync Deletes**. You will be asked to confirm the deletion.

**Note on `Sync Deletes`**: This function only *revokes permissions* by removing users from the Google Groups associated with your folders. It does **not** delete the Google Group itself, the Google Drive folder, or the user sheet from your spreadsheet. This is a safety feature to prevent accidental data loss. See the next section for how to handle obsolete resources.

---

## **<font color="red">NEEDS TRANSLATION</font>**

## Handling Obsolete Permissions (Manual Deletion)

When you no longer need to manage a folder or a group, you might remove its corresponding row from the `ManagedFolders` or `UserGroups` sheet. It is important to understand what happens when you do this.

**The script does not automatically delete any resources.**

Removing a row from a control sheet simply tells the script to *stop managing* that resource. The actual Google Drive folder, the Google Group, and the associated user sheet in your spreadsheet will **not** be deleted automatically. This is a critical safety feature to prevent accidental deletion of important data.

After you have removed a folder or group from your control sheets and run a sync, you will need to manually clean up the obsolete resources if you wish to remove them completely.

### Manual Deletion Checklist

1.  **Delete the Google Drive Folder:**
    *   Go to [Google Drive](https://drive.google.com).
    *   Navigate to the folder you no longer need.
    *   Right-click the folder and select **Move to trash**.

2.  **Delete the Google Group:**
    *   Go to [Google Groups](https://groups.google.com/my-groups).
    *   Find the group associated with the folder/role you removed (the group email is visible in the `ManagedFolders` or `UserGroups` sheet before you delete the row).
    *   Open the group, go to **Group settings**, and look for an option to **Delete group**.
    *   *Note: You must be an owner of the group to delete it. The script automatically makes the script owner an owner of each group it creates.*

3.  **Delete the User Sheet:**
    *   In your control spreadsheet, find the user sheet associated with the folder/role you removed (e.g., `MyProject_Editor`).
    *   Right-click on the sheet tab at the bottom of the screen.
    *   Select **Delete**. You will be asked to confirm.

By following these steps, you can ensure that your Google Drive and Google Groups environment stays clean and free of obsolete items.

---

## **<font color="red">NEEDS TRANSLATION</font>**

## Troubleshooting & FAQ

### I added a user, but they didn't get an email notification. Why?

This is a common and complex issue that can have several causes:

1.  **The Group Already Had Permission:** The script works by giving a *Google Group* access to a folder. The "Folder shared with you" email is only sent the very first time the group is granted access. If the group already had permission from a previous run, adding a new user to that group will *not* trigger a new folder-sharing email from Google. The only notification the user might receive is one saying "You have been added to group X," which is controlled by the Google Group's own settings.

2.  **Browser/Gmail Notification Settings:** Notification delivery depends heavily on the user's own client-side settings. For notifications to appear, the user must have granted Gmail permission to show notifications in their browser. They can typically check this by looking for a prompt from their browser when in Gmail or by checking their browser's site settings for `mail.google.com`.

3.  **Google Workspace / Account Settings:** Notification behavior can sometimes vary based on your organization's Google Workspace settings or a user's individual Google account settings.