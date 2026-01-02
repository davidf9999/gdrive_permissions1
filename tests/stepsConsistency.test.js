const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.join(__dirname, '..');
const STEPS_PATH = path.join(ROOT, 'docs', 'common', 'steps.yaml');
const KNOWLEDGE_PATH = path.join(ROOT, 'GPT_KNOWLEDGE.md');

describe('GPT knowledge consistency', () => {
  test('each setup step appears in GPT_KNOWLEDGE.md', () => {
    const rawSteps = fs.readFileSync(STEPS_PATH, 'utf8');
    const stepsData = yaml.load(rawSteps);
    const steps = Array.isArray(stepsData?.steps) ? stepsData.steps : [];

    const knowledge = fs.readFileSync(KNOWLEDGE_PATH, 'utf8');

    steps.forEach((step, index) => {
      const stepNumber = index + 1;
      const expectedHeading = `## ${stepNumber}. ${step.title}`;
      expect(knowledge).toContain(expectedHeading);
    });
  });
});
