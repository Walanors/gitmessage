const vscode = require('vscode');
const axios = require('axios');
const { execSync } = require('child_process');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('Git Message Generator extension is now active');

    // Create status bar item for loading indicator
    const loadingStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    loadingStatusBarItem.text = "$(sync~spin) Generating commit message...";
    context.subscriptions.push(loadingStatusBarItem);

    // Register the command to generate commit message
    let disposable = vscode.commands.registerCommand('gitmessage.generateCommitMessage', async function () {
        try {
            // Show loading indicator
            loadingStatusBarItem.show();
            
            // Get git diff to analyze changes
            const gitDiff = await getGitDiff();
            if (!gitDiff) {
                vscode.window.showInformationMessage('No changes detected to generate commit message.');
                loadingStatusBarItem.hide();
                return;
            }

            // Generate commit message using Mistral AI agent
            const commitMessage = await generateCommitMessageWithAI(gitDiff);
            
            // Hide loading indicator
            loadingStatusBarItem.hide();
            
            if (commitMessage) {
                // Find the Git extension's SCM input box
                const gitExtension = vscode.extensions.getExtension('vscode.git');
                if (gitExtension) {
                    const git = gitExtension.exports.getAPI(1);
                    if (git && git.repositories && git.repositories.length > 0) {
                        const repository = git.repositories[0];
                        repository.inputBox.value = commitMessage;
                        vscode.window.showInformationMessage('Commit message generated successfully!');
                    } else {
                        vscode.window.showErrorMessage('No Git repository found.');
                    }
                } else {
                    // Fallback to generic SCM input box if Git extension not found
                    const scmInputBox = vscode.scm.inputBox;
                    if (scmInputBox) {
                        scmInputBox.value = commitMessage;
                        vscode.window.showInformationMessage('Commit message generated successfully!');
                    } else {
                        vscode.window.showErrorMessage('Could not find SCM input box.');
                    }
                }
            }
        } catch (error) {
            // Hide loading indicator on error
            loadingStatusBarItem.hide();
            vscode.window.showErrorMessage(`Error generating commit message: ${error.message}`);
        }
    });

    context.subscriptions.push(disposable);
}

/**
 * Get the git diff of staged changes
 * @returns {Promise<string>} The git diff output
 */
async function getGitDiff() {
    try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace folder open');
            return null;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;

        // Get staged files
        const stagedFiles = execSync('git diff --staged --name-only', { cwd: rootPath }).toString().trim();
        if (!stagedFiles) {
            // If no staged files, get all modified files
            const modifiedFiles = execSync('git diff --name-only', { cwd: rootPath }).toString().trim();
            if (!modifiedFiles) {
                return null;
            }

            // Get diff for modified files
            return execSync('git diff', { cwd: rootPath }).toString();
        }

        // Get diff for staged files
        return execSync('git diff --staged', { cwd: rootPath }).toString();
    } catch (error) {
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

        // Call Mistral AI agent API directly
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

        if (response.data && response.data.choices && response.data.choices.length > 0) {
            return response.data.choices[0].message.content.trim();
        } else {
            throw new Error('Invalid response from Mistral AI agent');
        }
    } catch (error) {
        console.error('Error calling Mistral AI agent:', error);
        vscode.window.showErrorMessage(`Error calling Mistral AI agent: ${error.message}`);
        return null;
    }
}

function deactivate() { }

module.exports = {
    activate,
    deactivate
};
