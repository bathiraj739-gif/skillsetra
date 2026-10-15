const questionQualityService = require('../services/questionQualityService');

async function getQualityList(req, res, next) {
  try {
    const filters = {
      category: req.query.category,
      difficulty: req.query.difficulty,
      quality: req.query.quality,
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit,
      sortBy: req.query.sortBy,
      sortDir: req.query.sortDir
    };

    const data = await questionQualityService.getQuestionQualityList(filters);
    res.json({
      success: true,
      ...data
    });
  } catch (err) {
    next(err);
  }
}

async function getQuestionAnalytics(req, res, next) {
  try {
    const { id } = req.params;
    const data = await questionQualityService.getQuestionDetailedAnalytics(id);
    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }
    res.json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getQualityList,
  getQuestionAnalytics
};
