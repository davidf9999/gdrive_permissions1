# Testing the Hybrid DNS Delegation Model

This document outlines the step-by-step process to test the "Hybrid DNS Delegation Model" implemented in the `gdrive-permissions1` project. This test plan assumes you, the administrator, will play both roles: the Administrator (setting up credentials) and the Tester (experiencing the automated setup).

## Objective

To verify that the AI Assistant can successfully automate the creation/update of DNS records for a specific, delegated subdomain within Cloudflare, utilizing a sandboxed API token provided by the administrator, and that the administrative setup process is clear and secure.

## Test Plan

---

### Part 1: The Administrator Hat 🎩 (Your Setup)

First, you'll perform the one-time setup required for a trusted tester.

**1. Generate the Sandboxed Cloudflare API Token:**

This is the most critical step, ensuring the tester receives a token with limited scope.

*   **Log in to Cloudflare.**
*   Navigate to your domain's DNS records page.
*   **Create a placeholder record:** Manually create an `A` record for the subdomain you plan to delegate.
    *   **Type:** `A`
    *   **Name:** `tester-u` (or any unique name for your test subdomain, e.g., `ai-test`)
    *   **IPv4 address:** `192.0.2.1` (this is a reserved IP for documentation, perfect for a placeholder that will be updated by the AI Assistant).
    *   **Proxy status:** Ensure it's orange-clouded (proxied) if you want Cloudflare's CDN/security features.
*   **Create the API Token:**
    *   Go to **My Profile** (from the top right icon) -> **API Tokens**.
    *   Click **Create Token** and select **"Create Custom Token"**.
    *   **Token Name:** Give it a descriptive name (e.g., `gdrive-permissions-tester-u` or `ai-assistant-dns-test`).
    *   **Permissions:**
        *   Select `Zone` -> `DNS` -> `Edit`.
    *   **Zone Resources:**
        *   `Include` -> `Specific zone` -> Your root domain (e.g., `your-domain.com`).
    *   **Record Resources (Crucial Security Step):**
        *   Click **"Add"**.
        *   `Include` -> `Specific record` -> Your specific subdomain (e.g., `tester-u.your-domain.com`). This ensures the token can *only* affect this single record.
    *   Click **"Continue to summary"** and then **"Create Token"**.
*   **Copy the generated token.** Keep it safe for the next step.

**2. Get Your Cloudflare Zone ID:**

*   Go to your Cloudflare dashboard and select your domain.
*   On the **Overview** page, scroll down. You will find the **Zone ID** on the right-hand side. Copy it.

**3. Configure GitHub Codespaces Secrets:**

*   Navigate to your GitHub repository page.
*   Go to **Settings -> Secrets and variables -> Codespaces**.
*   Create three **new repository secrets**:
    1.  **Name:** `CLOUDFLARE_API_TOKEN`
        *   **Value:** Paste the sandboxed API token you generated.
    2.  **Name:** `CLOUDFLARE_ZONE_ID`
        *   **Value:** Paste your Zone ID.
    3.  **Name:** `ROOT_DOMAIN_NAME`
        *   **Value:** Your root domain (e.g., `your-domain.com`).

You have now completed the administrator's work.

---

### Part 2: The Tester Hat 🧢 (Simulating User `U`)

Now, put on your tester hat. You are User `U`, who has just been given access and told to set up the project.

**1. Launch a Fresh Codespace:**

*   To ensure you get a clean environment with the new secrets, you *must* launch a new Codespace. Go to your repository's main page on GitHub, click the **"< > Code"** button, switch to the **Codespaces** tab, and create a **new Codespace** for the repository. This will ensure your newly added Codespaces secrets are injected into the environment.

**2. Start the AI Assistant:**

*   The Codespace will build and run the startup scripts automatically.
*   The terminal will clear, and the AI assistant will greet you and start its process.

**3. Follow the Assistant's Guidance:**

*   Proceed through the initial phases as prompted (e.g., skill level assessment, `gcloud` login, etc.). You can confirm these steps as completed, as the focus is on the DNS configuration.
*   When you reach **"Phase 6.5: DNS Record Configuration,"** pay close attention.

**4. The Automated DNS Flow (The Moment of Truth):**

*   The assistant should announce that it has detected Cloudflare environment variables and will attempt an automated setup.
*   It will ask you for your desired subdomain name. Enter the name you configured earlier (e.g., `tester-u`).
*   The assistant will confirm the full domain (`tester-u.your-domain.com`) and then execute the `scripts/dns_manager.sh` script.
*   You should see output similar to this, confirming the script ran and successfully updated the DNS record via the local FastAPI service:
    ```
    Attempting to create/update DNS records for tester-u.your-domain.com pointing to X.X.X.X...
    DNS records successfully applied for tester-u.your-domain.com.
    It may take a few minutes for changes to propagate.
    ```
    (Where `X.X.X.X` is the public IP of your Codespace).

---

### Part 3: Verification (Admin Hat On Again)

Finally, put your administrator hat back on to verify the result.

*   Go back to your **Cloudflare DNS dashboard**.
*   Find the `A` record for `tester-u.your-domain.com`.
*   **Verify that its IP address has been updated** from the placeholder `1.1.1.1` to the actual public IP of your Codespace (the `X.X.X.X` from the assistant's output).
*   **(Optional) Test Resolution:** You can also try to `ping tester-u.your-domain.com` from a terminal (either in the Codespace or locally) to see if it resolves to the correct IP.

This end-to-end test validates the entire workflow, from the secure administrative setup to the seamless, automated experience for your tester.