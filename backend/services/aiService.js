const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Generate Documentation
const generateDocumentation = async (code, language) => {
  try {
    const prompt = `You are a professional code documentation expert. Analyze the following ${language} code and generate comprehensive documentation.

Code:
\`\`\`${language}
${code}
\`\`\`

Please provide documentation in the following format:

## Overview
[Brief description of what the code does]

## Parameters
[List each function parameter with type and description]

## Returns
[What the function/code returns]

## Example
[A practical usage example]

## Notes
[Any important notes, warnings, or considerations]`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    return response.choices[0].message.content;
  } catch (error) {
    throw new Error(`Documentation generation failed: ${error.message}`);
  }
};

// Generate Comments
const generateComments = async (code, language) => {
  try {
    const prompt = `You are a code documentation expert. Add detailed inline comments to the following ${language} code. 

Explain:
1. What each section does
2. Why it's written that way
3. Any edge cases or important logic

Return ONLY the code with added comments, no explanations.

Code:
\`\`\`${language}
${code}
\`\`\``;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    return response.choices[0].message.content;
  } catch (error) {
    throw new Error(`Comments generation failed: ${error.message}`);
  }
};

// Generate README
const generateREADME = async (code, language, projectName) => {
  try {
    const prompt = `You are a professional README writer. Create a professional README.md file for a ${language} project.

Project Name: ${projectName}

Code:
\`\`\`${language}
${code}
\`\`\`

Generate a README with these sections:

# ${projectName}

## Description
[Brief description of the project]

## Installation
[How to install/setup]

## Usage
[How to use the code with examples]

## Features
[List key features]

## Requirements
[Any dependencies or requirements]

## License
MIT

Return ONLY the markdown content, no extra text.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    return response.choices[0].message.content;
  } catch (error) {
    throw new Error(`README generation failed: ${error.message}`);
  }
};

module.exports = {
  generateDocumentation,
  generateComments,
  generateREADME
};