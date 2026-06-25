const mongoose = require('mongoose');

const documentationSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Code is required'],
      minlength: [10, 'Code must be at least 10 characters']
    },
    language: {
      type: String,
      enum: ['python', 'javascript', 'typescript', 'go', 'java', 'cpp'],
      required: [true, 'Language is required']
    },
    projectName: {
      type: String,
      default: 'Untitled Project'
    },
    documentation: {
      type: String,
      default: null
    },
    comments: {
      type: String,
      default: null
    },
    readme: {
      type: String,
      default: null
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Documentation', documentationSchema);