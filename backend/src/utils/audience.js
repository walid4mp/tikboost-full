const { COUNTRY_CODES } = require('../constants/countries');

const USER_GENDERS = ['MALE', 'FEMALE'];
const TARGET_GENDERS = ['ALL', 'MALE', 'FEMALE'];
const WORLDWIDE = 'WORLDWIDE';

function normalizeGender(value) {
  const text = String(value || '').trim().toUpperCase();
  return USER_GENDERS.includes(text) ? text : null;
}

function normalizeTargetGender(value) {
  const text = String(value || '').trim().toUpperCase();
  return TARGET_GENDERS.includes(text) ? text : null;
}

function normalizeCountryCode(value, { allowWorldwide = false } = {}) {
  const text = String(value || '').trim().toUpperCase();
  if (!text) return null;
  if (allowWorldwide && text === WORLDWIDE) return WORLDWIDE;
  return COUNTRY_CODES.has(text) ? text : null;
}

function normalizeTargetCountry(value) {
  return normalizeCountryCode(value, { allowWorldwide: true }) || WORLDWIDE;
}

function isValidCountryCode(value, options = {}) {
  return !!normalizeCountryCode(value, options);
}

function getProfileCompletionMissing(user) {
  const missing = [];
  if (!normalizeGender(user?.gender)) missing.push('gender');
  if (!normalizeCountryCode(user?.countryCode)) missing.push('countryCode');
  return missing;
}

function buildProfileStatus(user) {
  const missingFields = getProfileCompletionMissing(user);
  return {
    isComplete: missingFields.length === 0,
    missingFields,
  };
}

function ensureProfileComplete(user) {
  const profileStatus = buildProfileStatus(user);
  return {
    ...profileStatus,
    gender: normalizeGender(user?.gender),
    countryCode: normalizeCountryCode(user?.countryCode),
  };
}

function campaignMatchesUser(campaign, user) {
  const gender = normalizeGender(user?.gender);
  const countryCode = normalizeCountryCode(user?.countryCode);
  const targetGender = normalizeTargetGender(campaign?.targetGender) || 'ALL';
  const targetCountry = normalizeTargetCountry(campaign?.targetCountry);

  if (!gender || !countryCode) return false;
  if (targetGender !== 'ALL' && targetGender !== gender) return false;
  if (targetCountry !== WORLDWIDE && targetCountry !== countryCode) return false;
  return true;
}

function buildAudienceWhere(user) {
  const gender = normalizeGender(user?.gender);
  const countryCode = normalizeCountryCode(user?.countryCode);
  if (!gender || !countryCode) {
    return {
      id: '__profile_incomplete__',
    };
  }

  return {
    AND: [
      {
        OR: [{ targetGender: 'ALL' }, { targetGender: gender }],
      },
      {
        OR: [{ targetCountry: WORLDWIDE }, { targetCountry: countryCode }],
      },
    ],
  };
}

module.exports = {
  USER_GENDERS,
  TARGET_GENDERS,
  WORLDWIDE,
  normalizeGender,
  normalizeTargetGender,
  normalizeCountryCode,
  normalizeTargetCountry,
  isValidCountryCode,
  getProfileCompletionMissing,
  buildProfileStatus,
  ensureProfileComplete,
  campaignMatchesUser,
  buildAudienceWhere,
};
