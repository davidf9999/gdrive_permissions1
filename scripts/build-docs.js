const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const projectRoot = path.join(__dirname, '..');
const commonDir = path.join(projectRoot, 'docs', 'common');

function buildStepArtifacts(steps, options = {}) {
  const guidePath = options.guidePath || 'docs/SETUP_GUIDE.md';
  const guideLabel = options.guideLabel || 'Setup Guide';
  const setupStepsList = steps
    .map((step, index) => `${index + 1}. [${step.title}](#${index + 1}-${step.id.replace(/_/g, '-')})`)
    .join('\n');

  const aiMenu = steps
    .map((step, index) => `${index + 1}. ${step.menu_title || step.title}`)
    .join('\n') + "\ns. I'm not sure, please scan my system for me.";

  const aiStateDefinitions = "1. `START`\n" + steps
    .map((step, index) => `${index + 2}. \n*` + '`' + `${step.state}` + '`' + '\n' + '`' + `${step.title}` + '`')
    .join('\n');

  const setupSteps = steps
    .map(step => step.setup_guide)
    .filter(guide => guide && guide.trim() !== '')
    .join('\n\n');

  const aiAssistantSteps = steps
    .map((step, index) => {
      const stepNumber = index + 1;
      const anchor = `${stepNumber}-${step.id.replace(/_/g, '-')}`;
      const menuTitle = step.menu_title || step.title;
      const stateLine = `*** Current state: ${stepNumber} "${menuTitle}" out of ${steps.length} steps. ***`;
      const header = `### Step ${stepNumber}: ${step.title}`;
      if (step.manual) {
        return [
          header,
          stateLine,
          'This step is manual and requires your action in a web browser.',
          '',
          '**Manual Action Required:**',
          `Follow the instructions in the [${guideLabel}](${guidePath}#${anchor}).`,
          '',
          "**Once you've completed the manual steps, type 'done' to continue.**",
        ].join('\n');
      }
      return [
        header,
        stateLine,
        'This step includes automated commands with some manual follow-up in your browser.',
        '',
        '**Automated Action (with your approval):**',
        'I can run the required commands for you.',
        '',
        '**Manual Action Required:**',
        `Follow the instructions in the [${guideLabel}](${guidePath}#${anchor}) for any browser-based steps.`,
        '',
        '**Do you want me to proceed? (yes/no)**',
      ].join('\n');
    })
    .join('\n');

  return {
    setupStepsList,
    aiMenu,
    aiStateDefinitions,
    setupSteps,
    aiAssistantSteps,
  };
}

function buildDocs() {
  console.log('Starting documentation build...');

  try {
    // 1. Read and parse the steps.yaml file
    const stepsFile = fs.readFileSync(path.join(commonDir, 'steps.yaml'), 'utf8');
    const stepsData = yaml.load(stepsFile);
    const steps = stepsData.steps;

    const gcpStepsFile = fs.readFileSync(path.join(commonDir, 'gcp_steps.yaml'), 'utf8');
    const gcpStepsData = yaml.load(gcpStepsFile);
    const gcpSteps = gcpStepsData.steps;

    const coreArtifacts = buildStepArtifacts(steps, {
      guidePath: 'docs/SETUP_GUIDE.md',
      guideLabel: 'Setup Guide',
    });
    const gcpArtifacts = buildStepArtifacts(gcpSteps, {
      guidePath: 'docs/GCP_SETUP_GUIDE.md',
      guideLabel: 'GCP Setup Guide',
    });

    // 2. Generate content for the common files
    fs.writeFileSync(path.join(commonDir, '_SETUP_STEPS_LIST.md'), coreArtifacts.setupStepsList);
    console.log('Successfully generated docs/common/_SETUP_STEPS_LIST.md');

    fs.writeFileSync(path.join(commonDir, '_AI_MENU.md'), coreArtifacts.aiMenu);
    console.log('Successfully generated docs/common/_AI_MENU.md');

    fs.writeFileSync(path.join(commonDir, '_AI_STATE_DEFINITIONS.md'), coreArtifacts.aiStateDefinitions);
    console.log('Successfully generated docs/common/_AI_STATE_DEFINITIONS.md');

    fs.writeFileSync(path.join(commonDir, '_SETUP_STEPS.md'), coreArtifacts.setupSteps);
    console.log('Successfully generated docs/common/_SETUP_STEPS.md');

    fs.writeFileSync(path.join(commonDir, '_AI_ASSISTANT_STEPS.md'), `${coreArtifacts.aiAssistantSteps}\n`);
    console.log('Successfully generated docs/common/_AI_ASSISTANT_STEPS.md');


    // 3. Assemble the final documents
    const setupGuideTemplate = fs.readFileSync(path.join(projectRoot, 'docs', 'SETUP_GUIDE.template.md'), 'utf8');
    const setupGuide = setupGuideTemplate
      .replace('{{SETUP_STEPS_LIST}}', coreArtifacts.setupStepsList)
      .replace('{{SETUP_STEPS}}', coreArtifacts.setupSteps);
    fs.writeFileSync(path.join(projectRoot, 'docs', 'SETUP_GUIDE.md'), setupGuide);
    console.log('Successfully generated docs/SETUP_GUIDE.md');

    const gcpSetupGuideTemplate = fs.readFileSync(path.join(projectRoot, 'docs', 'GCP_SETUP_GUIDE.template.md'), 'utf8');
    const gcpSetupGuide = gcpSetupGuideTemplate
      .replace('{{GCP_SETUP_STEPS_LIST}}', gcpArtifacts.setupStepsList)
      .replace('{{GCP_SETUP_STEPS}}', gcpArtifacts.setupSteps);
    fs.writeFileSync(path.join(projectRoot, 'docs', 'GCP_SETUP_GUIDE.md'), gcpSetupGuide);
    console.log('Successfully generated docs/GCP_SETUP_GUIDE.md');

    const assistantPromptTemplate = fs.readFileSync(path.join(projectRoot, 'AI_ASSISTANT_PROMPT.template.md'), 'utf8');
    const assistantPrompt = assistantPromptTemplate
      .replace('{{AI_STATE_DEFINITIONS}}', coreArtifacts.aiStateDefinitions)
      .replace('{{AI_MENU}}', coreArtifacts.aiMenu)
      .replace('{{SETUP_STEPS}}', coreArtifacts.aiAssistantSteps);
    fs.writeFileSync(path.join(projectRoot, 'AI_ASSISTANT_PROMPT.md'), assistantPrompt);
    console.log('Successfully generated AI_ASSISTANT_PROMPT.md');

    const gcpAssistantPromptTemplate = fs.readFileSync(path.join(projectRoot, 'AI_ASSISTANT_PROMPT_GCP.template.md'), 'utf8');
    const gcpAssistantPrompt = gcpAssistantPromptTemplate
      .replace('{{AI_STATE_DEFINITIONS}}', gcpArtifacts.aiStateDefinitions)
      .replace('{{AI_MENU}}', gcpArtifacts.aiMenu)
      .replace('{{SETUP_STEPS}}', gcpArtifacts.aiAssistantSteps);
    fs.writeFileSync(path.join(projectRoot, 'AI_ASSISTANT_PROMPT_GCP.md'), gcpAssistantPrompt);
    console.log('Successfully generated AI_ASSISTANT_PROMPT_GCP.md');


    console.log('\n✅ Documentation build complete.');
  } catch (error) {
    console.error('❌ An error occurred during the build process:', error);
    process.exit(1);
  }
}

buildDocs();
