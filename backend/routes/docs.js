const express = require('express');
const router = express.Router();
const Documentation = require('../models/Documentation');
const {
  generateDocumentation,
  generateComments,
  generateREADME
} = require('../services/aiService');
// const archiver = require('archiver');

// Validate code input
const validateCode = (code) => {
  if (!code || code.trim().length < 10) {
    throw new Error('Code must be at least 10 characters long');
  }
};

// POST: Generate Documentation
router.post('/generate-docs', async (req, res) => {
  try {
    const { code, language, projectName } = req.body;

    // Validation
    if (!code || !language) {
      return res.status(400).json({ error: 'Code and language are required' });
    }
    validateCode(code);

    const validLanguages = ['python', 'javascript', 'typescript', 'go', 'java', 'cpp'];
    if (!validLanguages.includes(language.toLowerCase())) {
      return res.status(400).json({ error: 'Unsupported language' });
    }

    // Generate documentation using AI
    console.log('Generating documentation...');
    const documentation = await generateDocumentation(code, language);

    // Save to database
    const doc = new Documentation({
      code,
      language: language.toLowerCase(),
      projectName: projectName || 'Untitled Project',
      documentation
    });

    await doc.save();
    console.log('Documentation saved:', doc._id);

    res.json({
      success: true,
      id: doc._id,
      documentation,
      message: 'Documentation generated successfully'
    });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST: Generate Comments
router.post('/generate-comments', async (req, res) => {
  try {
    const { code, language } = req.body;

    // Validation
    if (!code || !language) {
      return res.status(400).json({ error: 'Code and language are required' });
    }
    validateCode(code);

    const validLanguages = ['python', 'javascript', 'typescript', 'go', 'java', 'cpp'];
    if (!validLanguages.includes(language.toLowerCase())) {
      return res.status(400).json({ error: 'Unsupported language' });
    }

    // Generate comments using AI
    console.log('Generating comments...');
    const comments = await generateComments(code, language);

    res.json({
      success: true,
      comments,
      message: 'Comments generated successfully'
    });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST: Generate README
router.post('/generate-readme', async (req, res) => {
  try {
    const { code, language, projectName } = req.body;

    // Validation
    if (!code || !language || !projectName) {
      return res.status(400).json({
        error: 'Code, language, and projectName are required'
      });
    }
    validateCode(code);

    const validLanguages = ['python', 'javascript', 'typescript', 'go', 'java', 'cpp'];
    if (!validLanguages.includes(language.toLowerCase())) {
      return res.status(400).json({ error: 'Unsupported language' });
    }

    // Generate README using AI
    console.log('Generating README...');
    const readme = await generateREADME(code, language, projectName);

    res.json({
      success: true,
      readme,
      message: 'README generated successfully'
    });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET: Retrieve documentation by ID
router.get('/docs/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const doc = await Documentation.findById(id);
    if (!doc) {
      return res.status(404).json({ error: 'Documentation not found' });
    }

    res.json({
      success: true,
      data: doc
    });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET: Retrieve all documentations (last 10)
router.get('/docs', async (req, res) => {
  try {
    const docs = await Documentation.find()
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      count: docs.length,
      data: docs
    });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// DELETE: Delete documentation by ID
router.delete('/docs/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if document exists
    const doc = await Documentation.findByIdAndDelete(id);
    if (!doc) {
      return res.status(404).json({ error: 'Documentation not found' });
    }

    res.json({
      success: true,
      message: 'Documentation deleted successfully',
      id: doc._id
    });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// PUT: Update documentation (add new outputs to existing)
router.put('/docs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { documentation, comments, readme } = req.body;

    const doc = await Documentation.findByIdAndUpdate(
      id,
      {
        ...(documentation && { documentation }),
        ...(comments && { comments }),
        ...(readme && { readme }),
        updatedAt: Date.now()
      },
      { new: true }
    );

    if (!doc) {
      return res.status(404).json({ error: 'Documentation not found' });
    }

    res.json({
      success: true,
      message: 'Documentation updated successfully',
      data: doc
    });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET: Search documentation by language
// GET: Search/filter documentation with pagination
router.get('/search', async (req, res) => {
  try {
    const { language, projectName, page = 1, limit = 10 } = req.query;
    
    // Build query object dynamically
    let query = {};
    
    if (language) {
      query.language = language.toLowerCase();
    }
    
    if (projectName) {
      query.projectName = {
        $regex: projectName,
        $options: 'i'  // Case-insensitive
      };
    }

    // Calculate skip for pagination
    const skip = (page - 1) * limit;

    // Get total count for pagination info
    const total = await Documentation.countDocuments(query);

    // Find with pagination
    const docs = await Documentation.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      count: docs.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: docs
    });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET: Get stats (count by language)
router.get('/stats', async (req, res) => {
  try {
    // Group by language and count
    const stats = await Documentation.aggregate([
      {
        $group: {
          _id: '$language',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET: Export all documentations as JSON
// GET: Export all documentations as JSON
router.get('/docs/export/json', async (req, res) => {
  try {
    const docs = await Documentation.find().sort({ createdAt: -1 });
    
    if (docs.length === 0) {
      return res.status(404).json({ error: 'No documentations to export' });
    }

    const exportData = {
      exportDate: new Date().toISOString(),
      totalDocs: docs.length,
      documentations: docs.map(doc => ({
        projectName: doc.projectName,
        language: doc.language,
        documentation: doc.documentation || '',
        comments: doc.comments || '',
        readme: doc.readme || '',
        createdAt: doc.createdAt
      }))
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="documentation-export.json"');
    res.send(JSON.stringify(exportData, null, 2));

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;



