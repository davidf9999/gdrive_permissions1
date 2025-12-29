# Google Workspace setup & installation guide

## There are three common setup modes

*   **Manual:** You follow the steps in this guide without a specialized chatbot.
*   **Gemini CLI Assistant:** A terminal-based helper that can automate commands and prompts, often used in GitHub Codespaces. See the [Gemini CLI Assistant Guide](AI_ASSISTANT_GUIDE.md).
*   **OpenAI GPT Assistant:** A chat-based helper that explains steps and generates commands, but does not run them for you.

For brevity, this guide refers to these modes as **manual**, **gemini**, and **gpt**.

> **Note**
>
> This document is the master guide for all setup steps. The steps are the same in every mode; only the way you get help differs.
>
> *   **Follow the Guide:** Gemini CLI and OpenAI GPT assistants should reference this document for browser steps.
> *   **Read the Chat:** Follow the assistant's responses and the steps here.
> *   **Sharing Screenshots:** If you need to show the assistant something from your screen, you can copy text and paste it into the chat. For images, save a screenshot to a file and share the file path with the assistant so it can open the image.
> *   **You're in Control:** Assistants can run commands for you, but you can always choose to run them manually.

This document is the comprehensive, step-by-step guide for setting up the Google Drive Permission Manager. For a successful deployment, follow these steps in the presented order.

---

## Prerequisites

*   **Administrative Skills:** Even with assistance (Gemini CLI or OpenAI GPT), this setup requires a basic understanding of administrative concepts like domain management and user permissions.
*   **GitHub Account (Gemini CLI only):** Required to run the Gemini CLI Assistant in Codespaces or manage Codespaces settings.
*   **Google Account (Gemini CLI only):** Required to authenticate the `gemini` CLI tool. This account does **not** need to be your GitHub or Google Workspace admin account.

### Authenticating the Gemini CLI (Gemini CLI Assistant only)

If you are using the Gemini CLI Assistant, you need to authenticate the `gemini` command-line tool. This is not required for manual setup or OpenAI GPT usage.

1.  In the terminal, you will be prompted to authenticate.
2.  Select **1: Login with Google**.
3.  A URL will be displayed. Copy and paste it into your browser.
4.  Sign in with any Google account. This authentication provides a free daily quota for using the Gemini CLI Assistant.

---

## Setup Steps Overview

{{SETUP_STEPS_LIST}}

---

## A Note on GUI Language
The instructions and screenshots in this guide assume the Google Admin and Google Cloud consoles are in English. If your interface is in another language, the Gemini CLI Assistant or OpenAI GPT Assistant can provide guidance on how to temporarily switch it to English to make following the steps easier.

---

## Understanding Roles

This setup requires acting as an **Installer** using a **Google Workspace Super Admin** account. For a full breakdown, see [Roles and Responsibilities](ROLES_AND_RESPONSIBILITIES.md).

{{SETUP_STEPS}}
