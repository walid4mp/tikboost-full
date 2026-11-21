const { AppError } = require('../utils/errors');
const { ensureProfileComplete } = require('../utils/audience');

function requireProfileCompletion(req, _res, next) {
  const profileStatus = ensureProfileComplete(req.user);
  if (!profileStatus.isComplete) {
    return next(
      new AppError(
        'Complete your profile before accessing core services',
        403,
        'PROFILE_INCOMPLETE',
        profileStatus,
      ),
    );
  }

  req.profileStatus = profileStatus;
  next();
}

module.exports = {
  requireProfileCompletion,
};
