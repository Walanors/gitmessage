const vscode = require('vscode');
const axios = require('axios');
const { execSync } = require('child_process');

// Create output channel for logging
const outputChannel = vscode.window.createOutputChannel('Git Message Generator');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    outputChannel.appendLine('Git Message Generator extension is now active');
    outputChannel.show();
    console.log('Git Message Generator extension is now active');

    // Create status bar item for loading indicator
    const loadingStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    loadingStatusBarItem.text = "$(sync~spin) Generating commit message...";
    context.subscriptions.push(loadingStatusBarItem);

    // Register the command to generate commit message
    let disposable = vscode.commands.registerCommand('gitmessage.generateCommitMessage', async function () {
        outputChannel.appendLine('Generate commit message command triggered');
        outputChannel.show();
        
        try {
            console.log('Generate commit message command triggered');
            // Show loading indicator
            loadingStatusBarItem.show();
            
            // Get git diff to analyze changes
            const { diffOutput, changedFiles, newFiles } = await getGitDiff();
            if (!diffOutput && !newFiles.length) {
                outputChannel.appendLine('No changes detected to generate commit message');
                console.log('No changes detected to generate commit message');
                vscode.window.showInformationMessage('No changes detected to generate commit message.');
                loadingStatusBarItem.hide();
                return;
            }

            // Prepare a comprehensive summary of all changes
            let fullSummary = '';
            
            if (diffOutput) {
                outputChannel.appendLine(`Git diff retrieved, length: ${diffOutput.length}`);
                console.log('Git diff retrieved, length:', diffOutput.length);
                
                // Log the diff for debugging
                console.log('FULL GIT DIFF:');
                console.log(diffOutput);
                
                // Log the first 500 characters of the diff for debugging in output channel
                outputChannel.appendLine(`Diff preview: ${diffOutput.substring(0, 500)}...`);
                
                // Count the number of files in the diff
                const fileCount = (diffOutput.match(/^diff --git/gm) || []).length;
                outputChannel.appendLine(`Number of modified files in diff: ${fileCount}`);
                console.log(`Number of modified files in diff: ${fileCount}`);
                
                fullSummary = diffOutput;
            }
            
            // Add new files information
            if (newFiles.length > 0) {
                outputChannel.appendLine(`Found ${newFiles.length} new files`);
                console.log(`Found ${newFiles.length} new files:`, newFiles);
                
                const newFilesSummary = `
# New Files Added (${newFiles.length})
${newFiles.map(file => `* ${file}`).join('\n')}
`;
                fullSummary = fullSummary ? `${fullSummary}\n\n${newFilesSummary}` : newFilesSummary;
            }
            
            // Generate commit message using Mistral AI agent
            const commitMessage = await generateCommitMessageWithAI(fullSummary, changedFiles, newFiles);
            
            // Hide loading indicator
            loadingStatusBarItem.hide();
            
            if (commitMessage) {
                outputChannel.appendLine('Commit message generated successfully');
                console.log('Commit message generated successfully');
                // Find the Git extension's SCM input box
                const gitExtension = vscode.extensions.getExtension('vscode.git');
                if (gitExtension) {
                    outputChannel.appendLine('Git extension found');
                    console.log('Git extension found');
                    const git = gitExtension.exports.getAPI(1);
                    if (git && git.repositories && git.repositories.length > 0) {
                        outputChannel.appendLine('Git repository found');
                        console.log('Git repository found');
                        const repository = git.repositories[0];
                        repository.inputBox.value = commitMessage;
                        vscode.window.showInformationMessage('Commit message generated successfully!');
                    } else {
                        outputChannel.appendLine('No Git repository found');
                        console.error('No Git repository found');
                        vscode.window.showErrorMessage('No Git repository found.');
                    }
                } else {
                    outputChannel.appendLine('Git extension not found, trying generic SCM input box');
                    console.log('Git extension not found, trying generic SCM input box');
                    // Fallback to generic SCM input box if Git extension not found
                    const scmInputBox = vscode.scm.inputBox;
                    if (scmInputBox) {
                        outputChannel.appendLine('SCM input box found');
                        console.log('SCM input box found');
                        scmInputBox.value = commitMessage;
                        vscode.window.showInformationMessage('Commit message generated successfully!');
                    } else {
                        outputChannel.appendLine('Could not find SCM input box');
                        console.error('Could not find SCM input box');
                        vscode.window.showErrorMessage('Could not find SCM input box.');
                    }
                }
            } else {
                outputChannel.appendLine('Failed to generate commit message');
                console.error('Failed to generate commit message');
            }
        } catch (error) {
            // Hide loading indicator on error
            loadingStatusBarItem.hide();
            outputChannel.appendLine(`Error in generateCommitMessage command: ${error.message}`);
            outputChannel.appendLine(`Stack trace: ${error.stack}`);
            console.error('Error in generateCommitMessage command:', error);
            vscode.window.showErrorMessage(`Error generating commit message: ${error.message}`);
        }
    });

    context.subscriptions.push(disposable);
    
    // Add a status bar item to test command activation
    const testItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
    testItem.text = "$(zap) Test Git Message";
    testItem.tooltip = "Test Git Message Generator";
    testItem.command = 'gitmessage.generateCommitMessage';
    testItem.show();
    context.subscriptions.push(testItem);
    
    outputChannel.appendLine('Extension activation completed, command registered');
}

/**
 * Get the git diff of staged changes
 * @returns {Promise<{diffOutput: string, changedFiles: string[], newFiles: string[]}>} The git diff output and file lists
 */
async function getGitDiff() {
    try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            outputChannel.appendLine('No workspace folder open');
            console.error('No workspace folder open');
            vscode.window.showErrorMessage('No workspace folder open');
            return { diffOutput: null, changedFiles: [], newFiles: [] };
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        outputChannel.appendLine(`Using workspace root path: ${rootPath}`);
        console.log('Using workspace root path:', rootPath);

        try {
            // Get a comprehensive diff that includes all changes
            let diffOutput = '';
            let changedFiles = [];
            let newFiles = [];
            
            // Get all modified and new files using the suggested command
            outputChannel.appendLine('Getting all modified and new files...');
            try {
                // Use the command suggested by the user to get all new and modified files
                const allChangedFilesOutput = execSync('git ls-files . --exclude-standard --others -m', { cwd: rootPath }).toString().trim();
                
                if (allChangedFilesOutput) {
                    const allChangedFiles = allChangedFilesOutput.split('\n');
                    outputChannel.appendLine(`Found ${allChangedFiles.length} total changed files`);
                    console.log(`Found ${allChangedFiles.length} total changed files`);
                    
                    // Separate new files from modified files
                    for (const file of allChangedFiles) {
                        try {
                            // Check if the file exists in the git index
                            execSync(`git ls-files --error-unmatch "${file}"`, { cwd: rootPath });
                            // If we get here, the file exists in the index, so it's modified
                            changedFiles.push(file);
                        } catch (e) {
                            // If we get an error, the file doesn't exist in the index, so it's new
                            newFiles.push(file);
                        }
                    }
                    
                    outputChannel.appendLine(`Separated into ${changedFiles.length} modified files and ${newFiles.length} new files`);
                    console.log(`Modified files:`, changedFiles);
                    console.log(`New files:`, newFiles);
                } else {
                    outputChannel.appendLine('No changed files detected');
                    console.log('No changed files detected');
                }
            } catch (e) {
                outputChannel.appendLine(`Error getting changed files: ${e.message}`);
                console.error('Error getting changed files:', e.message);
                
                // Fallback to separate commands for modified and new files
                try {
                    const modifiedFilesOutput = execSync('git diff --name-only', { cwd: rootPath }).toString().trim();
                    if (modifiedFilesOutput) {
                        changedFiles = modifiedFilesOutput.split('\n');
                        outputChannel.appendLine(`Found ${changedFiles.length} modified files (fallback method)`);
                        console.log(`Found ${changedFiles.length} modified files (fallback):`, changedFiles);
                    }
                    
                    const newFilesOutput = execSync('git ls-files --others --exclude-standard', { cwd: rootPath }).toString().trim();
                    if (newFilesOutput) {
                        newFiles = newFilesOutput.split('\n');
                        outputChannel.appendLine(`Found ${newFiles.length} new files (fallback method)`);
                        console.log(`Found ${newFiles.length} new files (fallback):`, newFiles);
                    }
                } catch (fallbackError) {
                    outputChannel.appendLine(`Fallback method also failed: ${fallbackError.message}`);
                    console.error('Fallback method also failed:', fallbackError.message);
                }
            }
            
            // Check for staged files first
            outputChannel.appendLine('Checking for staged files...');
            const stagedFiles = execSync('git diff --staged --name-only', { cwd: rootPath }).toString().trim();
            
            if (stagedFiles) {
                outputChannel.appendLine(`Found ${stagedFiles.split('\n').length} staged files`);
                console.log(`Found ${stagedFiles.split('\n').length} staged files: ${stagedFiles}`);
                // Get detailed diff for staged files with file names and context
                diffOutput = execSync('git diff --staged --patch', { cwd: rootPath, maxBuffer: 10 * 1024 * 1024 }).toString();
            } else if (changedFiles.length > 0) {
                // If no staged files, check for modified files
                outputChannel.appendLine('No staged files, checking modified files');
                console.log('No staged files, checking modified files');
                
                // Get detailed diff for modified files with file names and context
                diffOutput = execSync('git diff --patch', { cwd: rootPath, maxBuffer: 10 * 1024 * 1024 }).toString();
            }
            
            // Log some stats about the diff
            if (diffOutput) {
                const lineCount = diffOutput.split('\n').length;
                const fileCount = (diffOutput.match(/^diff --git/gm) || []).length;
                
                outputChannel.appendLine(`Generated diff with ${diffOutput.length} characters, ${lineCount} lines, across ${fileCount} files`);
                console.log(`Generated diff with ${diffOutput.length} characters, ${lineCount} lines, across ${fileCount} files`);
            }
            
            return { 
                diffOutput, 
                changedFiles, 
                newFiles 
            };
        } catch (execError) {
            outputChannel.appendLine(`Error executing git command: ${execError.message}`);
            console.error('Error executing git command:', execError.message);
            vscode.window.showErrorMessage(`Error executing git command: ${execError.message}`);
            return { diffOutput: null, changedFiles: [], newFiles: [] };
        }
    } catch (error) {
        outputChannel.appendLine(`Error getting git diff: ${error.message}`);
        outputChannel.appendLine(`Stack trace: ${error.stack}`);
        console.error('Error getting git diff:', error);
        return { diffOutput: null, changedFiles: [], newFiles: [] };
    }
}

/**
 * Generate commit message using Mistral AI agent
 * @param {string} gitDiff The git diff to analyze
 * @param {string[]} changedFiles List of modified files
 * @param {string[]} newFiles List of new files
 * @returns {Promise<string>} The generated commit message
 */
async function generateCommitMessageWithAI(gitDiff, changedFiles, newFiles) {
    try {
        const config = vscode.workspace.getConfiguration('gitmessage');
        const apiKey = config.get('mistralApiKey');

        if (!apiKey) {
            outputChannel.appendLine('Mistral AI API Key not found');
            console.error('Mistral AI API Key not found');
            const setApiKey = 'Set API Key';
            const response = await vscode.window.showErrorMessage(
                'Mistral AI API Key not found. Please set it in the extension settings.',
                setApiKey
            );

            if (response === setApiKey) {
                vscode.commands.executeCommand('workbench.action.openSettings', 'gitmessage.mistralApiKey');
            }

            return null;
        }

        // Truncate git diff if it's too large - increase the limit to capture more changes
        const maxDiffLength = 32000; // Increased from 10000 to capture more changes
        const truncatedDiff = gitDiff.length > maxDiffLength
            ? gitDiff.substring(0, maxDiffLength) + '...(truncated)'
            : gitDiff;

        // Add a clear instruction to the AI with specific guidance about new files
        let prompt = `Here is a summary of my changes. Please generate a concise, descriptive commit message that follows conventional commit format (type: description).`;
        
        // Add specific instructions based on what we have
        if (changedFiles.length > 0 && newFiles.length > 0) {
            prompt += ` Include ALL significant changes to existing files, and mention that ${newFiles.length} new files were added without going into detail about each new file.`;
        } else if (changedFiles.length > 0) {
            prompt += ` Include ALL significant changes to existing files.`;
        } else if (newFiles.length > 0) {
            prompt += ` This commit is primarily adding ${newFiles.length} new files. Mention this without going into detail about each file.`;
        }
        
        prompt += `\n\n${truncatedDiff}`;

        // Log the full prompt being sent to the API
        outputChannel.appendLine('===== FULL PROMPT BEING SENT TO MISTRAL AI =====');
        outputChannel.appendLine(prompt);
        outputChannel.appendLine('===== END OF PROMPT =====');
        console.log('===== FULL PROMPT BEING SENT TO MISTRAL AI =====');
        console.log(prompt);
        console.log('===== END OF PROMPT =====');

        outputChannel.appendLine('Calling Mistral AI agent API');
        console.log('Calling Mistral AI agent API');
        outputChannel.appendLine(`Sending ${prompt.length} characters to Mistral AI`);
        console.log(`Sending ${prompt.length} characters to Mistral AI`);
        
        // Call Mistral AI agent API directly
        try {
            const response = await axios({
                method: 'post',
                url: 'https://api.mistral.ai/v1/agents/completions',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                data: {
                    agent_id: "ag:952a4ff1:20250309:git-commit:d9a7e0dc",
                    messages: [{ role: 'user', content: prompt }]
                }
            });

            outputChannel.appendLine('Mistral AI agent API response received');
            console.log('Mistral AI agent API response received');
            if (response.data && response.data.choices && response.data.choices.length > 0) {
                const generatedMessage = response.data.choices[0].message.content.trim();
                outputChannel.appendLine(`Generated message: ${generatedMessage}`);
                console.log(`Generated message: ${generatedMessage}`);
                return generatedMessage;
            } else {
                outputChannel.appendLine(`Invalid response format from Mistral AI agent: ${JSON.stringify(response.data)}`);
                console.error('Invalid response format from Mistral AI agent:', response.data);
                throw new Error('Invalid response from Mistral AI agent');
            }
        } catch (apiError) {
            outputChannel.appendLine(`API error details: ${apiError.response ? JSON.stringify(apiError.response.data) : apiError.message}`);
            console.error('API error details:', apiError.response ? apiError.response.data : apiError.message);
            throw new Error(`API error: ${apiError.message}`);
        }
    } catch (error) {
        outputChannel.appendLine(`Error calling Mistral AI agent: ${error.message}`);
        outputChannel.appendLine(`Stack trace: ${error.stack}`);
        console.error('Error calling Mistral AI agent:', error);
        vscode.window.showErrorMessage(`Error calling Mistral AI agent: ${error.message}`);
        return null;
    }
}

function deactivate() { 
    outputChannel.appendLine('Git Message Generator extension deactivated');
}

module.exports = {
    activate,
    deactivate
};
