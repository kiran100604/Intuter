const { StudyMaterial, StudySession } = require('../models');
const { success, error } = require('../utils/response');
const { extractTextFromPDF } = require('../services/file/pdfExtractor');
const { extractTextFromDOCX } = require('../services/file/docxExtractor');
const path = require('path');
const fs = require('fs');

exports.uploadMaterial = async (req, res, next) => {
  try {
    if (!req.file) return error(res, 'No file uploaded', 400);
    const { sessionId } = req.body;
    const session = await StudySession.findByPk(sessionId);
    if (!session) return error(res, 'Session not found', 404);
    const ext = path.extname(req.file.originalname).toLowerCase();
    let fileType = '';
    let extractedText = '';
    if (ext === '.pdf') {
      fileType = 'pdf';
      extractedText = await extractTextFromPDF(req.file.path);
    } else if (ext === '.docx') {
      fileType = 'docx';
      extractedText = await extractTextFromDOCX(req.file.path);
    } else if (ext === '.txt') {
      fileType = 'txt';
      extractedText = (await fs.promises.readFile(req.file.path, 'utf8')).trim();
    } else {
      fileType = 'image';
      // Optionally add OCR here
    }
    const material = await StudyMaterial.create({
      sessionId: session.id,
      title: req.file.originalname,
      file: req.file.filename,
      fileType,
      extractedText
    });
    return success(res, { material }, 'Material uploaded');
  } catch (err) {
    next(err);
  }
};

exports.getMaterial = async (req, res, next) => {
  try {
    const { materialId } = req.params;
    const material = await StudyMaterial.findByPk(materialId);
    if (!material) return error(res, 'Material not found', 404);
    return success(res, { material }, 'Material details fetched');
  } catch (err) {
    next(err);
  }
};

exports.deleteMaterial = async (req, res, next) => {
  try {
    const { materialId } = req.params;
    const material = await StudyMaterial.findByPk(materialId);
    if (!material) return error(res, 'Material not found', 404);
    await material.destroy();
    return success(res, {}, 'Material deleted');
  } catch (err) {
    next(err);
  }
};

exports.getSessionMaterials = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const materials = await StudyMaterial.findAll({ where: { sessionId } });
    return success(res, { materials }, 'Session materials fetched');
  } catch (err) {
    next(err);
  }
};
