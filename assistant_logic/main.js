/* eslint-disable no-console */

// =================================================================================================
// State Machine for the AI Setup Assistant
// =================================================================================================

// --- State Definitions ---
const STATES = {
  START: 'START',
  WORKSPACE_TENANT_CREATED: 'WORKSPACE_TENANT_CREATED',
  SUPER_ADMIN_PREPARED: 'SUPER_ADMIN_PREPARED',
  CONTROL_SPREADSHEET_CREATED: 'CONTROL_SPREADSHEET_CREATED',
  CLASP_PROJECT_SETUP: 'CLASP_PROJECT_SETUP',
  APIS_ENABLED_AND_CONSENT_GRANTED: 'APIS_ENABLED_AND_CONSENT_GRANTED',
  FIRST_SYNC_COMPLETE: 'FIRST_SYNC_COMPLETE',
  DONE: 'DONE',
};

// The order of states is crucial for the discovery loop.
const STATE_ORDER = [
  STATES.WORKSPACE_TENANT_CREATED,
  STATES.SUPER_ADMIN_PREPARED,
  STATES.CONTROL_SPREADSHEET_CREATED,
  STATES.CLASP_PROJECT_SETUP,
  STATES.APIS_ENABLED_AND_CONSENT_GRANTED,
  STATES.FIRST_SYNC_COMPLETE,
  STATES.DONE,
];

// --- In-Memory State ---
// This will hold data collected during the session, like scriptId.
const sessionState = {
  scriptId: null,
  gcpProjectNumber: null,
};

const fs = require('fs');
const { exec } = require('child_process');
const readline = require('readline');

// =================================================================================================
// State Machine for the AI Setup Assistant
// =================================================================================================

// --- Helper Functions ---
function execPromise(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        // Don't reject, just return the error payload
        resolve({ error, stdout, stderr });
        return;
      }
      resolve({ error: null, stdout, stderr });
    });
  });
}

function confirmWithUser(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => {
        rl.question(`${question} (yes/no): `, answer => {
            rl.close();
            resolve(answer.toLowerCase() === 'yes');
        });
    });
}


// --- State Definitions ---
const STATES = {
  START: 'START',
  WORKSPACE_TENANT_CREATED: 'WORKSPACE_TENANT_CREATED',
  SUPER_ADMIN_PREPARED: 'SUPER_ADMIN_PREPARED',
  CONTROL_SPREADSHEET_CREATED: 'CONTROL_SPREADSHEET_CREATED',
  CLASP_PROJECT_SETUP: 'CLASP_PROJECT_SETUP',
  APIS_ENABLED_AND_CONSENT_GRANTED: 'APIS_ENABLED_AND_CONSENT_GRANTED',
  FIRST_SYNC_COMPLETE: 'FIRST_SYNC_COMPLETE',
  DONE: 'DONE',
};

// The order of states is crucial for the discovery loop.
const STATE_ORDER = [
  STATES.WORKSPACE_TENANT_CREATED,
  STATES.SUPER_ADMIN_PREPARED,
  STATES.CONTROL_SPREADSHEET_CREATED,
  STATES.CLASP_PROJECT_SETUP,
  STATES.APIS_ENABLED_AND_CONSENT_GRANTED,
  STATES.FIRST_SYNC_COMPLETE,
  STATES.DONE,
];

// --- In-Memory State ---
// This will hold data collected during the session, like scriptId.
const sessionState = {
  scriptId: null,
  gcpProjectNumber: null,
};

// =================================================================================================
// Verification Functions (`verify_`)
// These functions check if a state's exit criteria have been met.
// They should be non-interactive and return `true` or `false`.
// =================================================================================================

async function verify_workspace_tenant_created() {
  console.log('--- Verifying State: WORKSPACE_TENANT_CREATED ---');
  const isComplete = await confirmWithUser('Have you created a Google Workspace tenant?');
  return isComplete;
}

async function verify_super_admin_prepared() {
    console.log('--- Verifying State: SUPER_ADMIN_PREPARED ---');
    const isComplete = await confirmWithUser('Have you prepared the Super Admin account?');
    return isComplete;
}

async function verify_control_spreadsheet_created() {
    console.log('--- Verifying State: CONTROL_SPREADSHEET_CREATED ---');
    if (sessionState.scriptId) return true; // Already have it in memory

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
        rl.question('Please enter the Apps Script ID from your control spreadsheet (or leave blank to skip): ', answer => {
            rl.close();
            if (answer) {
                sessionState.scriptId = answer;
                resolve(true);
            } else {
                resolve(false);
            }
        });
    });
}

async function verify_clasp_project_setup() {
  console.log('--- Verifying State: CLASP_PROJECT_SETUP ---');

  // 1. Check for .clasp.json
  if (!fs.existsSync('.clasp.json')) {
    console.log('Status: .clasp.json not found.');
    return false;
  }
  console.log('Status: .clasp.json found.');

  // 2. Check clasp login status
  const loginResult = await execPromise('clasp login --status');
  if (loginResult.error || !loginResult.stdout.includes('You are logged in as')) {
    console.log('Status: Not logged in to clasp.');
    return false;
  }
  console.log('Status: Logged in to clasp.');

  // 3. Check clasp status
  const statusResult = await execPromise('clasp status');
  if (statusResult.error) {
      console.log('Status: `clasp status` failed. Project may not be pushed or configured correctly.');
      return false;
  }
  console.log('Status: `clasp status` successful. Project is connected.');
  
  return true;
}

async function verify_apis_enabled() {
  console.log('Verification function for APIS_ENABLED_AND_CONSENT_GRANTED not implemented.');
  return false;
}

async function verify_first_sync_complete() {
  console.log('Verification function for FIRST_SYNC_COMPLETE not implemented.');
  return false;
}

async function verify_done() {
    console.log('Verification function for DONE not implemented.');
    return false;
}

const VERIFY_MAP = {
  [STATES.WORKSPACE_TENANT_CREATED]: verify_workspace_tenant_created,
  [STATES.SUPER_ADMIN_PREPARED]: verify_super_admin_prepared,
  [STATES.CONTROL_SPREADSHEET_CREATED]: verify_control_spreadsheet_created,
  [STATES.CLASP_PROJECT_SETUP]: verify_clasp_project_setup,
  [STATES.APIS_ENABLED_AND_CONSENT_GRANTED]: verify_apis_enabled,
  [STATES.FIRST_SYNC_COMPLETE]: verify_first_sync_complete,
  [STATES.DONE]: verify_done,
};


// =================================================================================================
// Action Functions (`do_`)
// These functions perform the actions required to complete a state.
// They are interactive and will guide the user.
// =================================================================================================

async function do_workspace_tenant_created() {
  console.log('--- Action: Create Google Workspace Tenant ---');
  console.log('This is a manual step that must be completed in your web browser.');
  console.log('Please follow the instructions in the SETUP_GUIDE.md file to create your Workspace account.');
  console.log('Once you have completed this step, please restart this assistant to continue.');
  // In a real implementation, we would wait here instead of exiting.
  process.exit(0);
}

async function do_super_admin_prepared() {
    console.log('--- Action: Prepare Super Admin Account ---');
    console.log('This is a manual step that must be completed in your web browser.');
    console.log('Please follow the instructions in the SETUP_GUIDE.md file to prepare your Super Admin account.');
    console.log('Once you have completed this step, please restart this assistant to continue.');
    process.exit(0);
}

async function do_control_spreadsheet_created() {
    console.log('--- Action: Create Control Spreadsheet ---');
    console.log('This is a manual step that must be completed in your web browser.');
    console.log('Please follow the instructions in the SETUP_GUIDE.md file to create the spreadsheet and get the Script ID.');
    console.log('When you restart the assistant, it will ask you for the Script ID.');
    process.exit(0);
}

async function do_clasp_project_setup() {
  console.log('--- Action: Set up Clasp Project ---');

  // Sub-step 1: Create .clasp.json
  if (!fs.existsSync('.clasp.json')) {
    console.log('The .clasp.json file is missing. I will create it for you.');
    if (!sessionState.scriptId) {
        console.log('Error: I cannot create .clasp.json without the Script ID. Please restart and provide the Script ID when prompted.');
        process.exit(1);
    }
    const claspJsonContent = {
        scriptId: sessionState.scriptId,
        rootDir: 'apps_script_project',
    };
    fs.writeFileSync('.clasp.json', JSON.stringify(claspJsonContent, null, 2));
    console.log('.clasp.json created successfully.');
  }

  // Sub-step 2: Log in to clasp
  let loginResult = await execPromise('clasp login --status');
  if (loginResult.error || !loginResult.stdout.includes('You are logged in as')) {
    console.log('You are not logged in to clasp. Please run `clasp login` in another terminal.');
    await confirmWithUser('Press enter when you have logged in.');
  }

  // Sub-step 3: Push the project
  console.log('Attempting to push the project files to Google Apps Script...');
  const pushResult = await execPromise('clasp push -f');
  if (pushResult.error) {
      console.log('`clasp push` failed. Error:', pushResult.stderr);
      console.log('Please try to resolve the issue and then restart the assistant.');
      process.exit(1);
  }
  console.log('`clasp push` was successful!');
  console.log(pushResult.stdout);
}

async function do_apis_enabled() {
  console.log('Action function for APIS_ENABLED_AND_CONSENT_GRANTED not implemented.');
}

async function do_first_sync_complete() {
  console.log('Action function for FIRST_SYNC_COMPLETE not implemented.');
}

async function do_done() {
    console.log('All setup steps are complete!');
  }

const ACTION_MAP = {
  [STATES.WORKSPACE_TENANT_CREATED]: do_workspace_tenant_created,
  [STATES.SUPER_ADMIN_PREPARED]: do_super_admin_prepared,
  [STATES.CONTROL_SPREADSHEET_CREATED]: do_control_spreadsheet_created,
  [STATES.CLASP_PROJECT_SETUP]: do_clasp_project_setup,
  [STATES.APIS_ENABLED_AND_CONSENT_GRANTED]: do_apis_enabled,
  [STATES.FIRST_SYNC_COMPLETE]: do_first_sync_complete,
  [STATES.DONE]: do_done,
};


// =================================================================================================
// The Main State Machine Loop
// =================================================================================================

async function runStateMachine() {
  console.log('Starting AI Assistant v2...');
  console.log('---');

  // --- 1. State Discovery ---
  console.log('Discovering current setup state...');
  let currentState = STATES.START;

  for (const state of STATE_ORDER) {
    const verifyFn = VERIFY_MAP[state];
    const isComplete = await verifyFn();
    if (!isComplete) {
      currentState = state;
      break;
    }
    // If the loop completes, all states are verified and the state will be DONE.
    currentState = STATES.DONE;
  }

  console.log(`---`);
  console.log(`Initial state detected: ${currentState}`);
  console.log(`---`);

  // --- 2. Execute State Actions ---
  while (currentState !== STATES.DONE) {
    const actionFn = ACTION_MAP[currentState];
    await actionFn();

    // After the action, verify the state again to ensure it's complete
    const verifyFn = VERIFY_MAP[currentState];
    const isComplete = await verifyFn();

    if (isComplete) {
      const currentIndex = STATE_ORDER.indexOf(currentState);
      currentState = STATE_ORDER[currentIndex + 1];
       console.log(`---`);
      console.log(`Transitioning to next state: ${currentState}`);
      console.log(`---`);
    } else {
      console.log(`---`);
      console.log(`State ${currentState} is not yet complete. Retrying action or waiting for user.`);
      // In a real implementation, we might retry or offer help here.
      // For now, we'll just break the loop to avoid infinite loops.
      break;
    }
  }

  if (currentState === STATES.DONE) {
    await do_done();
  }

  console.log('---');
  console.log('AI Assistant session finished.');
}

runStateMachine();
