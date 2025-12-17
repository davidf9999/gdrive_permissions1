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
      .replace('{{AI_MENU}}', aiMenu);
    fs.writeFileSync(path.join(projectRoot, 'AI_ASSISTANT_PROMPT.md'), assistantPrompt);
    console.log('Successfully generated AI_ASSISTANT_PROMPT.md');


    console.log('\n✅ Documentation build complete.');
  } catch (error) {
    console.error('❌ An error occurred during the build process:', error);
    process.exit(1);
  }
}

buildDocs();
