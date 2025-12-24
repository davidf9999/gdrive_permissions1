const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const projectRoot = path.join(__dirname, '..');
const commonDir = path.join(projectRoot, 'docs', 'common');

function buildDocs() {
  console.log('Starting documentation build...');

  try {
    // 1. Read and parse the steps.yaml file
    const stepsFile = fs.readFileSync(path.join(commonDir, 'steps.yaml'), 'utf8');
    const stepsData = yaml.load(stepsFile);
    const steps = stepsData.steps;

    // 2. Generate content for the common files
    const setupStepsList = steps
      .map((step, index) => `${index + 1}. [${step.title}](#${index + 1}-${step.id.replace(/_/g, '-')})`)
      .join('\n');
    fs.writeFileSync(path.join(commonDir, '_SETUP_STEPS_LIST.md'), setupStepsList);
    console.log('Successfully generated docs/common/_SETUP_STEPS_LIST.md');

    const aiMenu = steps
      .map((step, index) => `${index + 1}. ${step.menu_title || step.title}`)
      .join('\n') + "\ns. I'm not sure, please scan my system for me.";
    fs.writeFileSync(path.join(commonDir, '_AI_MENU.md'), aiMenu);
    console.log('Successfully generated docs/common/_AI_MENU.md');

    const aiStateDefinitions = "1. `START`\n" + steps
      .map((step, index) => `${index + 2}. 
*` + '`' + `${step.state}` + '`' + '\n' + '`' + `${step.title}` + '`')
      .join('\n');
    fs.writeFileSync(path.join(commonDir, '_AI_STATE_DEFINITIONS.md'), aiStateDefinitions);
    console.log('Successfully generated docs/common/_AI_STATE_DEFINITIONS.md');

    const setupSteps = steps
      .map(step => step.setup_guide)
      .filter(guide => guide && guide.trim() !== '')
      .join('\n\n');
    fs.writeFileSync(path.join(commonDir, '_SETUP_STEPS.md'), setupSteps);
    console.log('Successfully generated docs/common/_SETUP_STEPS.md');

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
            `Follow the instructions in the [Setup Guide](docs/SETUP_GUIDE.md#${anchor}).`,
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
          `Follow the instructions in the [Setup Guide](docs/SETUP_GUIDE.md#${anchor}) for any browser-based steps.`,
          '',
          '**Do you want me to proceed? (yes/no)**',
        ].join('\n');
      })
      .join('\n');
    fs.writeFileSync(path.join(commonDir, '_AI_ASSISTANT_STEPS.md'), `${aiAssistantSteps}\n`);
    console.log('Successfully generated docs/common/_AI_ASSISTANT_STEPS.md');


    // 3. Assemble the final documents
    const setupGuideTemplate = fs.readFileSync(path.join(projectRoot, 'docs', 'SETUP_GUIDE.template.md'), 'utf8');
    const setupGuide = setupGuideTemplate
      .replace('{{SETUP_STEPS_LIST}}', setupStepsList)
      .replace('{{SETUP_STEPS}}', setupSteps);
    fs.writeFileSync(path.join(projectRoot, 'docs', 'SETUP_GUIDE.md'), setupGuide);
    console.log('Successfully generated docs/SETUP_GUIDE.md');

    const assistantPromptTemplate = fs.readFileSync(path.join(projectRoot, 'AI_ASSISTANT_PROMPT.template.md'), 'utf8');
    const assistantPrompt = assistantPromptTemplate
      .replace('{{AI_STATE_DEFINITIONS}}', aiStateDefinitions)
      .replace('{{AI_MENU}}', aiMenu)
      .replace('{{SETUP_STEPS}}', aiAssistantSteps);
    fs.writeFileSync(path.join(projectRoot, 'AI_ASSISTANT_PROMPT.md'), assistantPrompt);
    console.log('Successfully generated AI_ASSISTANT_PROMPT.md');

    const gptKnowledgeTemplate = fs.readFileSync(path.join(projectRoot, 'GPT_KNOWLEDGE.template.md'), 'utf8');
    const gptKnowledge = gptKnowledgeTemplate
      .replace('{{SETUP_STEPS_LIST}}', setupStepsList)
      .replace('{{SETUP_STEPS}}', setupSteps)
      .replace('{{BUNDLE_PATH}}', 'dist/apps_scripts_bundle.gs')
      .replace('{{BUILD_COMMAND}}', 'npm run build:bundle');
    fs.writeFileSync(path.join(projectRoot, 'GPT_KNOWLEDGE.md'), gptKnowledge);
    console.log('Successfully generated GPT_KNOWLEDGE.md');

    const gptPromptTemplate = fs.readFileSync(path.join(projectRoot, 'GPT_PROMPT.template.md'), 'utf8');
    const gptPrompt = gptPromptTemplate
      .replace('{{KNOWLEDGE_FILE}}', 'GPT_KNOWLEDGE.md')
      .replace('{{REPO_URL}}', 'https://github.com/davidf9999/gdrive_permissions1');
    fs.writeFileSync(path.join(projectRoot, 'GPT_PROMPT.md'), gptPrompt);
    console.log('Successfully generated GPT_PROMPT.md');


    console.log('\n✅ Documentation build complete.');
  } catch (error) {
    console.error('❌ An error occurred during the build process:', error);
    process.exit(1);
  }
}

buildDocs();
