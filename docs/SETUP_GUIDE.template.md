# Google Workspace setup & installation guide

> **Note for AI Assistant Users**
>
> Welcome! You've been directed here from the AI Assistant. This document is the master guide for all setup steps. The [AI Assistant in your terminal](AI_ASSISTANT_GUIDE.md) will automate many of these steps for you.
>
> *   **Follow the Assistant:** The assistant will guide you interactively. Refer to this guide for the manual steps you'll need to perform in your web browser. The assistant will tell you when.
> *   **Be Patient:** The initial Codespaces setup can take a few minutes.
> *   **Read the Chat:** The assistant will show you the commands it's running. You don't need to read all of the output, just focus on the assistant's chat responses.
> *   **Sharing Screenshots:** If you need to show the assistant something from your screen, you can copy text and paste it into the chat. For images, save a screenshot to a file and share the file path with the assistant so it can open the image.
> *   **Open in Preview Mode:** If this guide opens as raw Markdown, switch to preview mode with `Ctrl+Shift+V` (Windows/Linux) or `Cmd+Shift+V` (macOS).
> *   **Hide the Chat Pane:** If VS Code opens with the chat pane visible, you can hide it via **View → Appearance → Toggle Chat** or by running **View: Toggle Chat** from the Command Palette. VS Code will remember the layout the next time you open it.
> *   **You're in Control:** While the assistant can run commands for you, you can always choose to copy the commands and run them manually in a separate terminal.
> *   **Codespaces by default:** The assistant runs inside GitHub Codespaces unless you choose to run it locally. See [What is Codespaces?](CODESPACES_OVERVIEW.md) for details and cost/management tips.

This document is the comprehensive, step-by-step guide for setting up the Google Drive Permission Manager. For a successful deployment, follow these steps in the presented order.

---

## Prerequisites

*   **Administrative Skills:** Even with the AI assistant, this setup requires a basic understanding of administrative concepts like domain management and user permissions.
*   **GitHub Account:** Required to run the assistant in Codespaces or manage Codespaces settings.
*   **Google Account:** For authenticating the `gemini` CLI tool, you will need a standard Google account (like a `@gmail.com` address). This account does **not** need to be your GitHub or Google Workspace admin account.

### Authenticating the Gemini CLI

Before starting the Setup Steps, you need to authenticate the `gemini` command-line tool.

1.  In the terminal, you will be prompted to authenticate.
2.  Select **1: Login with Google**.
3.  A URL will be displayed. Copy and paste it into your browser.
4.  Sign in with any Google account. This authentication provides a free daily quota for using the AI assistant.

---

## Setup Steps Overview

{{SETUP_STEPS_LIST}}

---

## A Note on GUI Language
The instructions and screenshots in this guide assume the Google Admin and Google Cloud consoles are in English. If your interface is in another language, the assistant can provide guidance on how to temporarily switch it to English to make following the steps easier.

---

## Understanding Roles

This setup requires acting as an **Installer** using a **Google Workspace Super Admin** account. For a full breakdown, see [Roles and Responsibilities](ROLES_AND_RESPONSIBILITIES.md).

{{SETUP_STEPS}}
