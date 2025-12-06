const fs = require('fs');
const path = require('path');

const sourceDir = 'apps_script_project';
const outputDir = 'dist';
const outputFile = path.join(outputDir, 'apps_scripts_bundle.gs');

// Core files that must be loaded in a specific order.
const coreFiles = [
    'Code.js',
    'Utils.gs',
    'ConfigDiagnostic.gs',
    'Core.gs'
];

// Files to explicitly exclude from the bundle.
const excludeFiles = [
    'appsscript.json',
    'config.json.template'
];

try {
    // Ensure the output directory exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    // Discover all other .gs and .js files automatically
    const allFiles = fs.readdirSync(sourceDir);
    
    const otherFiles = allFiles
        .filter(file => {
            // Include only .gs and .js files
            return file.endsWith('.gs') || file.endsWith('.js');
        })
        .filter(file => {
            // Exclude core and excluded files
            return !coreFiles.includes(file) && !excludeFiles.includes(file);
        })
        .sort(); // Sort alphabetically for consistent order

    // Combine core files and other files to get the final processing order
    const fileOrder = [...coreFiles, ...otherFiles];

    console.log('Bundling files in the following order:');
    console.log(fileOrder.join(' -> '));

    // Concatenate files
    const bundleContent = fileOrder.reduce((content, fileName) => {
        const filePath = path.join(sourceDir, fileName);
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const header = `
// =====================================================================================
// START OF FILE: ${fileName}
// =====================================================================================
`;
            return content + header + fileContent;
        } else {
            // This case should ideally not be hit with the new discovery method
            console.warn(`WARNING: File not found and will be skipped: ${filePath}`);
            return content;
        }
    }, '');

    // Write the bundled file
    fs.writeFileSync(outputFile, bundleContent, 'utf8');

    console.log(`\n✅ Successfully created bundle at: ${outputFile}`);
    console.log('You can now copy the contents of that file and paste it into the Apps Script editor.');

} catch (error) {
    console.error('❌ An error occurred during the build process:');
    console.error(error);
    process.exit(1);
}
