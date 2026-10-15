const intelligenceService = require('../services/intelligenceService');

async function getOverview(req, res, next) {
  try {
    const data = await intelligenceService.getPlacementOverview();
    res.json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
}

async function getDepartments(req, res, next) {
  try {
    const data = await intelligenceService.getDepartmentIntelligence();
    res.json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
}

async function getYears(req, res, next) {
  try {
    const data = await intelligenceService.getYearIntelligence();
    res.json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
}

async function getTrends(req, res, next) {
  try {
    const data = await intelligenceService.getPerformanceTrends();
    res.json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
}

async function getStudentSkills(req, res, next) {
  try {
    const limit = req.query.limit || 25;
    const data = await intelligenceService.getStudentSkillProfiles(limit);
    res.json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
}

async function getTopics(req, res, next) {
  try {
    const data = await intelligenceService.getTopicIntelligence();
    res.json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getOverview,
  getDepartments,
  getYears,
  getTrends,
  getStudentSkills,
  getTopics
};
