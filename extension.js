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
            const gitDiff = await getGitDiff();
            if (!gitDiff) {
                outputChannel.appendLine('No changes detected to generate commit message');
                console.log('No changes detected to generate commit message');
                vscode.window.showInformationMessage('No changes detected to generate commit message.');
                loadingStatusBarItem.hide();
                return;
            }

            outputChannel.appendLine(`Git diff retrieved, length: ${gitDiff.length}`);
            console.log('Git diff retrieved, length:', gitDiff.length);
            // Generate commit message using Mistral AI agent
            const commitMessage = await generateCommitMessageWithAI(gitDiff);
            
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
 * @returns {Promise<string>} The git diff output
 */
async function getGitDiff() {
    try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            outputChannel.appendLine('No workspace folder open');
            console.error('No workspace folder open');
            vscode.window.showErrorMessage('No workspace folder open');
            return null;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        outputChannel.appendLine(`Using workspace root path: ${rootPath}`);
        console.log('Using workspace root path:', rootPath);

        try {
            // Get staged files
            outputChannel.appendLine('Checking for staged files...');
            const stagedFiles = execSync('git diff --staged --name-only', { cwd: rootPath }).toString().trim();
            if (!stagedFiles) {
                outputChannel.appendLine('No staged files, checking modified files');
                console.log('No staged files, checking modified files');
                // If no staged files, get all modified files
                const modifiedFiles = execSync('git diff --name-only', { cwd: rootPath }).toString().trim();
                if (!modifiedFiles) {
                    outputChannel.appendLine('No modified files found');
                    console.log('No modified files found');
                    return null;
                }

                outputChannel.appendLine('Modified files found, getting diff');
                console.log('Modified files found, getting diff');
                // Get diff for modified files
                return execSync('git diff', { cwd: rootPath }).toString();
            }

            outputChannel.appendLine('Staged files found, getting diff');
            console.log('Staged files found, getting diff');
            // Get diff for staged files
            return execSync('git diff --staged', { cwd: rootPath }).toString();
        } catch (execError) {
            outputChannel.appendLine(`Error executing git command: ${execError.message}`);
            console.error('Error executing git command:', execError.message);
            vscode.window.showErrorMessage(`Error executing git command: ${execError.message}`);
            return null;
        }
    } catch (error) {
        outputChannel.appendLine(`Error getting git diff: ${error.message}`);
        outputChannel.appendLine(`Stack trace: ${error.stack}`);
        console.error('Error getting git diff:', error);
        return null;
    }
}

/**
 * Generate commit message using Mistral AI agent
 * @param {string} gitDiff The git diff to analyze
 * @returns {Promise<string>} The generated commit message
 */
async function generateCommitMessageWithAI(gitDiff) {
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

        // Truncate git diff if it's too large
        const maxDiffLength = 10000;
        const truncatedDiff = gitDiff.length > maxDiffLength
            ? gitDiff.substring(0, maxDiffLength) + '...(truncated)'
            : gitDiff;

        outputChannel.appendLine('Calling Mistral AI agent API');
        console.log('Calling Mistral AI agent API');
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
                    messages: [{ role: 'user', content: truncatedDiff }]
                }
            });

            outputChannel.appendLine('Mistral AI agent API response received');
            console.log('Mistral AI agent API response received');
            if (response.data && response.data.choices && response.data.choices.length > 0) {
                return response.data.choices[0].message.content.trim();
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
