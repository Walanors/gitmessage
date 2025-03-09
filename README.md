# Git Message Generator

A VS Code extension that uses Mistral AI to automatically generate meaningful git commit messages based on your code changes.

## Features

- Automatically generates commit messages based on pending git changes
- Adds a convenient button directly next to the Source Control message input
- Analyzes your code changes to create contextual commit messages
- Follows conventional commit format

## Requirements

- VS Code 1.60.0 or higher
- Git installed and configured in your workspace
- Mistral AI API key

## Setup

1. Install the extension
2. Get a Mistral AI API key from [Mistral AI's website](https://mistral.ai)
3. Set your API key in the extension settings:
   - Go to Settings > Extensions > Git Message Generator
   - Enter your Mistral AI API key in the provided field

## Usage

1. Stage your changes in Git
2. Click on the "Generate Commit Message with AI" button in the Source Control view
3. The extension will analyze your changes and generate a commit message
4. The generated message will be inserted into the commit message input box
5. Review the message and commit as usual

## Extension Settings

This extension contributes the following settings:

* `gitmessage.mistralApiKey`: Your Mistral AI API key

## Known Issues

- Large diffs may be truncated to stay within API limits
- Requires an active internet connection to generate messages

## Release Notes

### 0.1.0

Initial release of Git Message Generator

---

## Development

### Building the Extension

1. Clone the repository
2. Run `npm install` to install dependencies
3. Run `npm run lint` to lint the code
4. Run `vscode:package-extension` to package the extension

### Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This extension is licensed under the [MIT License](LICENSE).
