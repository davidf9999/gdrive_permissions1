# How to Use Screenshots with the AI Assistant

When working on user interfaces or debugging visual issues, providing a screenshot gives the assistant the same context you have, leading to more accurate and helpful responses.

This guide explains how to capture a screenshot, upload it to your GitHub Codespace, and reference it in a prompt to the assistant.

### 1. Take a Screenshot

First, you need to capture what's on your screen and save it as an image file (like `.png` or `.jpg`). The method varies depending on your operating system.

**Windows:**

*   **Capture a selected area (Recommended - generates a file after saving):**
    1.  Press `Win + Shift + S` to open the Snipping Tool. Your screen will dim, and you'll get crosshairs.
    2.  Drag the cursor to select the part of the screen you want to capture.
    3.  The capture is automatically copied to your clipboard. A notification will pop up; click it to open the Snipping Tool editor.
    4.  In the editor, click the **Save** icon (looks like a floppy disk) and choose a memorable location, like your Desktop or Downloads folder, to save the screenshot as a PNG file.
*   **Capture the full screen (Automatically saves to a file):**
    1    Press `Win + PrtSc`. Your screen will briefly dim.
    2    The screenshot is automatically saved as a PNG file in `C:\Users\<your-username>\Pictures\Screenshots`.
*   **Note on clipboard-only captures:** Pressing `PrtSc` (Print Screen key alone) or `Alt + PrtSc` (active window) will copy the screenshot directly to your clipboard but will *not* automatically save it as a file. For use with the AI assistant, you need a saved file.

**macOS:**

*   **Capture a selected area (Recommended):**
    1.  Press `Cmd + Shift + 4`. Your cursor will become a crosshair.
    2.  Click and drag to select the area you want to capture.
    3.  When you release the mouse button, the screenshot is automatically saved to your Desktop as a `.png` file.
*   **Capture the full screen:**
    1.  Press `Cmd + Shift + 3`.
    2.  The screenshot is automatically saved to your Desktop.

**Linux:**

*   Screenshot tools vary by distribution. Most have a built-in utility.
*   Pressing the `PrtSc` key often opens a screenshot tool.
*   Check your system's application launcher or settings for "Screenshot" to find and configure your default tool.

### 2. Upload the Screenshot to Your Codespace

With your GitHub Codespace open in the browser:

1.  Locate your saved screenshot file on your computer (e.g., on your Desktop).
2.  In the Codespace **Explorer** panel (left sidebar), make sure you are in the root directory of the project.
3.  **Drag and drop** the screenshot file from your computer directly into the Explorer file list.

GitHub will automatically upload the file into your project's main directory.

### 3. Use the Screenshot in a Prompt

Once the file is uploaded and visible in the Explorer, you can reference it in a prompt to the AI assistant using an `@` mention.

**Example Prompts:**

*   `Please identify the primary user interface elements in this image. @Screenshot (24).png`
*   `I'm getting this error. What could be causing it? @error-message.jpg`
*   `Can you suggest improvements to the layout of this UI? @webapp-design.png`

The assistant will then be able to "see" the image and use it to answer your question.
